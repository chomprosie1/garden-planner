// Plain words: the text people read in the app never uses the words we build
// it with. Scans the words on screen (JSX text, and quoted text with a space
// in it) in the app's source, leaving out comments and code.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'src');
/** Code that never shows text to people, or shows technical errors on purpose (a broken backup file). */
const SKIP = ['model/validate.ts', 'model/migrate.ts', 'storage/', 'canvas/', 'geometry/', 'sun/', 'weather/openMeteo.ts', 'main.tsx'];

/** Words that belong in the code, not on screen, with the plain words to use instead. */
const BANNED: [RegExp, string][] = [
  [/\bdegree[- ]days?\b/i, 'say how warm it is, or how long the season is'],
  [/\blens(es)?\b/i, '"Show: …", or "view"'],
  [/\bvegetative\b/i, '"growing"'],
  [/\btransplant(ed|ing|s)?\b/i, '"planted out"'],
  [/\bstickers?\b/i, 'name the thing: a raised bed, a pot'],
  [/\bfootprint\b/i, '"outline" or "shape"'],
  [/\bschema\b/i, 'leave it out'],
  [/\b(latitude|longitude)\b/i, '"where it is", or a place name'],
  [/\bGDD\b/, 'leave it out'],
];

/**
 * Where a word is all right: the exact location, under Advanced, has to say what the numbers are; and search's lists of
 * words a result can be found by aren't shown (someone may well type "lens").
 */
const ALLOWED: { file: string; text: RegExp }[] = [
  { file: 'ui/GardenSettings.tsx', text: /^(Latitude|Longitude)$/ },
  { file: 'ui/search.ts', text: /^[a-z ]+$/ },
];

/** Class names: lower-case words, one at least with a hyphen. Not words on screen. */
const isClassList = (t: string) => /^[a-z0-9 -]+$/.test(t) && t.split(/\s+/).some((w) => w.includes('-'));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const NL = '\n';
const BACKSLASH = '\\';
const TICK = '`';

/**
 * The text in a source file: string and template literals (template holes left out), with comments skipped. A small
 * scanner, not a parser: enough for this app's code.
 */
function literals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf(NL, i);
      if (end < 0) break;
      i = end;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === TICK) {
      let text = '';
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === BACKSLASH) {
          text += src[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (c !== TICK && src[j] === NL) break;
        if (c === TICK && src[j] === '$' && src[j + 1] === '{') {
          // Skip the hole, nested braces and all.
          let depth = 1;
          j += 2;
          while (j < src.length && depth) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') depth--;
            j++;
          }
          text += ' ';
          continue;
        }
        text += src[j];
        j++;
      }
      out.push(text);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

/** Text between JSX tags: after a tag's ">" (not an arrow), with no code in it. */
function jsxText(src: string): string[] {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return [...noComments.matchAll(/(?<![=-])>([^<>{}=;()&|]*[A-Za-z][^<>{}=;()&|]*)(?=<|\{)/g)].map((m) => m[1]!.trim());
}

/** The words on screen: text between JSX tags, and quoted text with a space in it. */
const shown = (src: string): string[] => [...jsxText(src), ...literals(src).filter((t) => /\s/.test(t.trim()))].filter(Boolean);

describe('plain words on screen', () => {
  const sources = files(ROOT).filter((f) => !SKIP.some((s) => relative(ROOT, f).replace(/\\/g, '/').startsWith(s)));

  it('finds the app’s text to check', () => {
    expect(sources.length).toBeGreaterThan(40);
  });

  it('can tell words on screen from code and comments', () => {
    const sample = ["// a lens in a comment", "const x = 'lens-ring';", "const t = 'The shade lens';", 'const y = a => b;', '<p>Latitude</p>', 'const s = `Water ${lens} lens`;'].join(NL);
    expect(shown(sample)).toEqual(['Latitude', 'The shade lens', 'Water   lens']);
  });

  for (const path of sources) {
    const file = relative(ROOT, path).replace(/\\/g, '/');
    it(`${file} uses plain words`, () => {
      const problems: string[] = [];
      for (const text of shown(readFileSync(path, 'utf8'))) {
        if (isClassList(text) || ALLOWED.some((a) => a.file === file && a.text.test(text))) continue;
        for (const [re, instead] of BANNED) if (re.test(text)) problems.push(`"${text.slice(0, 90)}": ${instead}`);
      }
      expect(problems).toEqual([]);
    });
  }
});
