// Reads every plant in data/plants and lists what looks wrong: contradictions in the data itself, and gaps. It can't say a
// plant is right, only where to look first, so it marks nothing as checked. Run with: node scripts/plant-check.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '../data/plants');
const plants = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && statSync(join(dir, f)).size)
  .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const months = (p) => p.cropping?.harvestMonths ?? [];
const tender = (p) => /^\s*tender/i.test(p.conditions?.hardiness ?? '');
const sowMonths = (p) => (p.sowing ?? []).flatMap((s) => s.months);

const checks = [
  ['Fruit with no flowering months: the app guesses the month before the harvest', (p) => p.category === 'fruit' && !p.flowerMonths?.length],
  ['Crops with no days to crop: their dates go by the months alone', (p) => months(p).length > 0 && months(p).length < 12 && !p.growth?.days && !['fruit', 'herb', 'shrub', 'tree'].includes(p.category)],
  ['Tender, and planted out before April', (p) => tender(p) && (p.plantOutMonths ?? []).some((m) => m >= 1 && m < 4) && p.category !== 'shrub'],
  ['Tender, and sown outside before May', (p) => tender(p) && (p.sowing ?? []).some((s) => s.method === 'direct' && s.months.some((m) => m >= 1 && m < 5))],
  ['Nothing to say when to sow or plant', (p) => p.category !== 'weed' && !sowMonths(p).length && !p.plantOutMonths?.length],
  ['No flowers or harvest months at all', (p) => p.category !== 'weed' && !months(p).length && !p.flowerMonths?.length],
  ['Spacing that looks wrong (under 2 cm, or over 5 m)', (p) => p.size?.spacingMm < 20 || p.size?.spacingMm > 5000],
  ['Spacing much tighter than its spread', (p) => p.size?.spreadMm && p.size?.spacingMm && p.size.spacingMm < p.size.spreadMm / 3],
  ['Close spacing wider than ordinary spacing', (p) => p.size?.closeSpacingMm > p.size?.spacingMm],
];

console.log(`${plants.length} plants, ${plants.filter((p) => p.verified).length} verified.\n`);
for (const [title, wrong] of checks) {
  const found = plants.filter(wrong).map((p) => p.id);
  console.log(`${title}: ${found.length}`);
  if (found.length) console.log(`  ${found.slice(0, 20).join(', ')}${found.length > 20 ? ', …' : ''}`);
}
