// Search everything (Ctrl+K): plants, things on the plan, and actions, from
// one box. "add tomato", "go to the shed" and "show sun" all work: every word
// must start a word in the result, and the result's own name counts most.

import { featureLabel, KINDS, MATERIAL_LABEL, type Target } from '../model/features';
import { STICKERS } from '../model/stickers';
import type { Garden, Plant } from '../model/types';
import type { View } from '../theme/prefs';
import type { Lens } from './Lenses';
import type { Tool } from './PlanCanvas';

export type Command =
  | { kind: 'go'; view: View }
  /** Put this plant on the plan: the next tap on a bed plants it. */
  | { kind: 'plant'; id: string }
  | { kind: 'about'; id: string }
  | { kind: 'sow'; id: string }
  | { kind: 'show'; target: Target }
  | { kind: 'lens'; lens: Lens }
  | { kind: 'sticker'; id: string }
  | { kind: 'tool'; tool: Tool }
  | { kind: 'lock'; on: boolean }
  | { kind: 'fit' }
  /** "Where are you growing?", for an empty plan. */
  | { kind: 'setup' }
  /** A picture of the plan, or a timelapse of the year. */
  | { kind: 'share' }
  | { kind: 'shortcuts' };

export type Group = 'Actions' | 'On your plan' | 'Plants';
export const GROUPS: Group[] = ['Actions', 'On your plan', 'Plants'];

export interface Result {
  key: string;
  group: Group;
  label: string;
  detail?: string;
  command: Command;
  /** The plant a result is about, for its icon. */
  plantId?: string;
}

interface Candidate extends Result {
  /** More words it can be found by. */
  words: string;
}

const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'in', 'on', 'of', 'for', 'some', 'me', 'at']);

/** Lower-case words, without accents. */
export const wordsOf = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** The words that count in a query. */
export const queryWords = (q: string) => wordsOf(q).filter((w) => !STOP.has(w));

/** How well a result matches, or null if any word doesn't. Its own name counts most. */
export function scoreOf(words: string[], label: string, extra: string): number | null {
  const own = wordsOf(label);
  const more = wordsOf(extra);
  let total = 0;
  for (const w of words) {
    if (own.includes(w)) total += 3;
    else if (own.some((x) => x.startsWith(w))) total += 2;
    else if (more.some((x) => x.startsWith(w))) total += 1;
    else return null;
  }
  // The whole query starting the name, as when typing it out.
  if (wordsOf(label).join(' ').startsWith(words.join(' '))) total += 2;
  return total;
}

const VIEWS: { view: View; label: string; words: string }[] = [
  { view: 'home', label: 'Go to Home', words: 'open page today jobs' },
  { view: 'plan', label: 'Go to the plan', words: 'open page map layout' },
  { view: 'plants', label: 'Go to Plants', words: 'open page library list' },
  { view: 'month', label: 'Go to Month', words: 'open page jobs calendar sowing list' },
  { view: 'shed', label: 'Go to the Potting Shed', words: 'open page seedlings trays sow indoors propagator windowsill' },
  { view: 'notes', label: 'Go to the journal', words: 'open page notes diary' },
  { view: 'settings', label: 'Go to Settings', words: 'open page backup location look theme dark frost weather forecast climate' },
  { view: 'new', label: 'What’s new', words: 'open page news changes updates latest release' },
];

/** "a pot", "gravel": no "a" for things you can't count. */
const withArticle = (label: string) => (/^(gravel|decking|bark chips)$/i.test(label) ? label.toLowerCase() : `a ${label.toLowerCase()}`);

function actions(g: Garden, locked: boolean): Candidate[] {
  const out: Candidate[] = VIEWS.map((v) => ({ key: `go-${v.view}`, group: 'Actions', label: v.label, words: v.words, command: { kind: 'go', view: v.view } }));
  out.push(
    { key: 'lens-sun', group: 'Actions', label: 'Show sun hours', words: 'light sunny lens', command: { kind: 'lens', lens: 'sun' } },
    { key: 'lens-shade', group: 'Actions', label: 'Show shade', words: 'shadows shadow time lens', command: { kind: 'lens', lens: 'shade' } },
    { key: 'lens-flower', group: 'Actions', label: 'Show what’s in flower', words: 'flowers bees pollinators lens bloom', command: { kind: 'lens', lens: 'flower' } },
    { key: 'lens-harvest', group: 'Actions', label: 'Show what’s ready to harvest', words: 'pick crops ripe lens', command: { kind: 'lens', lens: 'harvest' } },
    { key: 'lens-water', group: 'Actions', label: 'Show what needs water', words: 'watering thirsty dry lens', command: { kind: 'lens', lens: 'water' } },
    { key: 'lens-none', group: 'Actions', label: 'Show just the plan', words: 'hide sun shade lens plain', command: { kind: 'lens', lens: 'none' } },
    { key: 'share', group: 'Actions', label: 'Share a picture of the plan', words: 'picture photo image story post timelapse video instagram', command: { kind: 'share' } },
    locked
      ? { key: 'unlock', group: 'Actions', label: 'Unlock the layout', words: 'padlock lock move beds', command: { kind: 'lock', on: false } }
      : { key: 'lock', group: 'Actions', label: 'Lock the layout', words: 'padlock stop moving beds', command: { kind: 'lock', on: true } },
    { key: 'fit', group: 'Actions', label: 'Fit the garden to the screen', words: 'zoom whole all view', command: { kind: 'fit' } },
    { key: 'tool-boundary', group: 'Actions', label: 'Draw the boundary', words: 'edge outline garden corners precise', command: { kind: 'tool', tool: 'boundary' } },
    { key: 'tool-bed', group: 'Actions', label: 'Draw a bed by its corners', words: 'shape precise exact', command: { kind: 'tool', tool: 'bed' } },
    { key: 'tool-sketch', group: 'Actions', label: 'Sketch on the plan', words: 'draw pen notes idea', command: { kind: 'tool', tool: 'sketch' } },
    { key: 'shortcuts', group: 'Actions', label: 'Keyboard shortcuts', words: 'keys help', command: { kind: 'shortcuts' } },
  );
  if (g.boundary.length < 3 && g.features.length === 0)
    out.push({ key: 'setup', group: 'Actions', label: 'Set up your space', detail: 'Balcony, patio, garden or allotment', words: 'start where growing balcony patio yard garden allotment plot', command: { kind: 'setup' } });
  for (const s of STICKERS)
    out.push({ key: `sticker-${s.id}`, group: 'Actions', label: `Add ${withArticle(s.label)}`, detail: s.size, words: `put place new ${KINDS[s.kind].label} ${s.material ?? ''}`, command: { kind: 'sticker', id: s.id } });
  return out;
}

function onPlan(g: Garden, plantOf: (id: string) => Plant): Candidate[] {
  const out: Candidate[] = [];
  const find = 'go show find select where';
  for (const f of g.features) {
    const label = featureLabel(f);
    const kind = KINDS[f.kind].label;
    out.push({ key: `f-${f.id}`, group: 'On your plan', label, ...(label !== kind ? { detail: kind } : {}), words: `${find} ${kind} ${f.material ? MATERIAL_LABEL[f.material] : ''}`, command: { kind: 'show', target: { type: 'feature', id: f.id } } });
  }
  for (const pl of g.plantings) {
    if (pl.removedOn) continue;
    const plant = plantOf(pl.plantId);
    const bed = g.features.find((f) => f.id === pl.featureId);
    out.push({
      key: `p-${pl.id}`,
      group: 'On your plan',
      label: plant.commonName,
      ...(bed ? { detail: `In ${featureLabel(bed)}` } : {}),
      words: `${find} growing ${plant.latinName ?? ''} ${bed ? featureLabel(bed) : ''}`,
      command: { kind: 'show', target: { type: 'planting', id: pl.id } },
      plantId: plant.id,
    });
  }
  if (g.boundary.length >= 3) out.push({ key: 'boundary', group: 'On your plan', label: 'Boundary', words: `${find} edge outline garden`, command: { kind: 'show', target: { type: 'boundary' } } });
  return out;
}

/** "sow …" and "about …" do that with a plant; anything else puts it on the plan. */
function plantVerb(words: string[]): { kind: 'plant' | 'about' | 'sow'; rest: string[] } {
  const [first, ...rest] = words;
  if (first === 'sow' && rest.length) return { kind: 'sow', rest };
  if ((first === 'about' || first === 'what' || first === 'info') && rest.length) return { kind: 'about', rest };
  if ((first === 'add' || first === 'plant' || first === 'grow' || first === 'put') && rest.length) return { kind: 'plant', rest };
  return { kind: 'plant', rest: words };
}

const PLANT_DETAIL = { plant: 'Add to the plan', about: 'About it', sow: 'Sow in the Potting Shed' } as const;

const LIMIT: Record<Group, number> = { Actions: 6, 'On your plan': 6, Plants: 8 };

/** Suggestions before anything's typed. */
const SUGGESTED = ['setup', 'sticker-raised-bed', 'sticker-pot', 'lens-sun', 'lens-shade', 'go-month', 'go-shed', 'shortcuts'];

export interface SearchContext {
  garden: Garden;
  plants: Plant[] | null;
  plantOf: (id: string) => Plant;
  locked: boolean;
}

/** Results for a query, best first in each group, groups in a fixed order. */
export function search(query: string, ctx: SearchContext): Result[] {
  const words = queryWords(query);
  const acts = actions(ctx.garden, ctx.locked);
  if (!words.length) return SUGGESTED.map((k) => acts.find((a) => a.key === k)).filter((a): a is Candidate => !!a).map(strip);

  const scored: { r: Candidate; score: number }[] = [];
  for (const r of [...acts, ...onPlan(ctx.garden, ctx.plantOf)]) {
    const score = scoreOf(words, r.label, `${r.words} ${r.detail ?? ''}`);
    if (score !== null) scored.push({ r, score });
  }
  // Plants match on their name alone, so "add" or "sow" before it says what to do.
  const verb = plantVerb(words);
  for (const p of ctx.plants ?? []) {
    const score = scoreOf(verb.rest, p.commonName, `${p.latinName ?? ''} ${p.category}`);
    if (score === null) continue;
    scored.push({
      r: { key: `plant-${p.id}`, group: 'Plants', label: p.commonName, detail: PLANT_DETAIL[verb.kind], words: '', command: { kind: verb.kind, id: p.id }, plantId: p.id },
      // A verb that was used counts for it.
      score: score + (verb.rest.length < words.length ? 1 : 0),
    });
  }
  const out: Result[] = [];
  for (const group of GROUPS) {
    const best = scored
      .filter((s) => s.r.group === group)
      .sort((a, b) => b.score - a.score || a.r.label.length - b.r.label.length || a.r.label.localeCompare(b.r.label))
      .slice(0, LIMIT[group]);
    out.push(...best.map((s) => strip(s.r)));
  }
  return out;
}

const strip = ({ words: _w, ...r }: Candidate): Result => r;
