// Adds a seasonal photo from Wikimedia Commons.
//
//   node tools/add-photo.ts --month 10 --file "File:Pumpkin in the Walled Garden (8096949347).jpg" \
//        --alt "A large pumpkin ripening among its leaves by a wooden fence" [--focus 58,50] [--id october-pumpkin]
//
// The licence and author are read from the Commons API, never typed in. Anything
// not public domain, CC0, CC BY or CC BY-SA is refused. Geograph photos are on
// Commons too, so the same command covers them.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'src/content/photos.json');
const OUT_DIR = join(ROOT, 'public/seasons');
const WIDTHS = [640, 1280, 1920];
/** Same budget as tests/photos.test.ts. */
const BUDGET_KB = (w: number) => (w <= 640 ? 100 : w <= 1280 ? 200 : 350);
const ALLOWED = ['Public domain', 'CC0', 'CC BY', 'CC BY-SA'];
const UA = 'GardenPlanner/0.1 (https://github.com/chomprosie1/garden-planner)';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const stripHtml = (s: string) =>
  s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export function licenceFamily(licence: string): string {
  if (/^public domain/i.test(licence) || /^pd/i.test(licence)) return 'Public domain';
  if (/^cc0/i.test(licence)) return 'CC0';
  return licence.replace(/\s+\d+(\.\d+)?$/, '');
}

async function main() {
  const month = Number(arg('month'));
  const file = arg('file');
  const alt = arg('alt');
  if (!Number.isInteger(month) || month < 1 || month > 12) fail('--month must be 1 to 12');
  if (!file?.startsWith('File:')) fail('--file must be a Commons file title starting "File:"');
  if (!alt) fail('--alt is required: describe the photo for people who cannot see it');
  const focus = (arg('focus') ?? '50,50').split(',').map(Number) as [number, number];
  const id = arg('id') ?? `m${String(month).padStart(2, '0')}-${file.slice(5).toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '')}`;

  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: file,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '2400',
  }).toString();
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!res.ok) fail(`Commons API returned ${res.status}`);
  const page = Object.values((await res.json()).query.pages)[0] as {
    missing?: string;
    imageinfo?: { thumburl: string; url: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }[];
  };
  if (page.missing !== undefined || !page.imageinfo) fail(`${file} was not found on Commons`);
  const info = page.imageinfo[0]!;
  const meta = (k: string) => info.extmetadata[k]?.value ?? '';

  const licence = stripHtml(meta('LicenseShortName'));
  if (!ALLOWED.includes(licenceFamily(licence))) fail(`Licence "${licence}" is not allowed. Only ${ALLOWED.join(', ')}.`);
  const author = stripHtml(meta('Artist'));
  if (!author) fail('Commons gives no author for this file, so it cannot be credited properly.');
  const licenceUrl = meta('LicenseUrl') || (licenceFamily(licence) === 'Public domain' ? info.descriptionurl : '');
  if (!licenceUrl) fail('Commons gives no licence URL for this file.');
  // Drop the Flickr photo number and Geograph reference Commons appends to imported titles.
  const title = (stripHtml(meta('ObjectName')) || file.slice(5).replace(/\.[a-z]+$/i, ''))
    .replace(/\s*\(\d{6,}\)$/, '')
    .replace(/\s+-\s+geograph\.org\.uk\s+-\s+\d+$/i, '');

  const img = await fetch(info.thumburl || info.url, { headers: { 'User-Agent': UA } });
  if (!img.ok) fail(`Download failed: ${img.status}`);
  const input = Buffer.from(await img.arrayBuffer());

  mkdirSync(OUT_DIR, { recursive: true });
  const widths: number[] = [];
  for (const w of WIDTHS) {
    const base = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
    const { width } = await base.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    if (widths.includes(width)) continue;
    widths.push(width);
    // Busy, detailed photos compress less well: step quality down until each file fits its budget.
    const budget = BUDGET_KB(width) * 1024;
    for (const [ext, start, floor] of [['avif', 50, 30], ['webp', 72, 40]] as const) {
      let q = start;
      let buf: Buffer;
      for (;;) {
        const img = base.clone();
        buf = await (ext === 'avif' ? img.avif({ quality: q, effort: 6 }) : img.webp({ quality: q })).toBuffer();
        if (buf.length <= budget || q <= floor) break;
        q -= 6;
      }
      if (buf.length > budget) fail(`${id} at ${width}px ${ext} is still over budget at quality ${q}.`);
      writeFileSync(join(OUT_DIR, `${id}-${width}.${ext}`), buf);
    }
  }
  // Average colour of the whole photo, used as the placeholder while it loads.
  const px = await sharp(input).resize(1, 1, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const colour = `#${hex(px[0]!)}${hex(px[1]!)}${hex(px[2]!)}`;

  const entry = {
    id,
    month,
    title,
    alt,
    author,
    licence,
    licenceUrl,
    sourceUrl: info.descriptionurl,
    focus,
    colour,
    widths,
    changes: 'Resized and compressed from the original.',
  };
  const list = JSON.parse(readFileSync(MANIFEST, 'utf8')) as (typeof entry)[];
  // Several photos a month, which take turns: a new one joins its month, and one with the same id is replaced.
  const next = [...list.filter((p) => p.id !== id), entry].sort((a, b) => a.month - b.month);
  writeFileSync(MANIFEST, JSON.stringify(next, null, 2) + '\n');
  console.log(`✓ ${id}: "${title}" by ${author}, ${licence}. Sizes: ${widths.join(', ')}. Colour ${colour}.`);
}

void main();
