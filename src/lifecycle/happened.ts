// "What's happened?": the things that can happen next to a planting, in a
// word or two, and recording one (with an optional note) as one edit. The
// stage rail and "Change stage…" are still there for correcting a mistake.

import { addNote, makeNote } from '../model/notes';
import type { Garden, Plant, Planting, Stage } from '../model/types';
import { harvestPlantings } from '../planting/place';
import { currentStage, isNewSeason, markFailed, nextStage, pathFor, setSowing, setStage } from './stages';

export type HappeningId = 'sown-indoors' | 'sown-direct' | 'planted' | Stage | 'new-season' | 'finished' | 'failed';

export interface Happening {
  id: HappeningId;
  label: string;
}

const LABEL: Partial<Record<HappeningId, string>> = {
  'sown-indoors': 'Sown indoors',
  'sown-direct': 'Sown outside',
  sown: 'Sown',
  planted: 'Planted',
  germinated: 'It’s up',
  hardening: 'Hardening off',
  transplanted: 'Planted out',
  vegetative: 'Growing well',
  flowering: 'Flowering',
  harvesting: 'First pick',
  'new-season': 'Growing again',
  finished: 'Finished',
  failed: 'Didn’t come up',
};

const order = (s: Stage | 'planned' | 'cleared') => (s === 'planned' ? -1 : s === 'cleared' ? 99 : (['sown', 'germinated', 'hardening', 'transplanted', 'vegetative', 'flowering', 'harvesting'] as Stage[]).indexOf(s));

/** What could happen next, in order: the stages still ahead on its path, then finishing, or a sowing that failed. */
export function happenings(plant: Plant, pl: Planting, covered = false): Happening[] {
  const now = currentStage(pl);
  if (now === 'cleared') return [];
  const path = pathFor(plant, pl, covered);
  const out: HappeningId[] = [];
  if (now === 'planned') {
    const methods = new Set((plant.sowing ?? []).map((s) => (s.method === 'direct' ? 'direct' : 'indoors')));
    if (!pl.sowing && methods.size > 1) out.push('sown-indoors', 'sown-direct');
    else out.push(path[0] === 'sown' ? 'sown' : 'planted');
  } else {
    for (const s of path) if (order(s) > order(now)) out.push(s);
    if (isNewSeason(plant, pl)) out.push('new-season');
    if (now === 'sown' || now === 'germinated' || now === 'hardening') out.push('failed');
    out.push('finished');
  }
  return out.map((id) => ({ id, label: id === 'transplanted' && path[0] === 'transplanted' ? 'Planted' : LABEL[id]! }));
}

/** The one it's probably ready for: the next stage on its path. */
export const likelyNext = (plant: Plant, pl: Planting, covered = false): HappeningId | null => {
  if (currentStage(pl) === 'planned') return null;
  const n = nextStage(plant, pl, covered);
  return n && isNewSeason(plant, pl) ? 'new-season' : n;
};

/** Records what happened on a date, with a note if there is one, as one edit. */
export function recordHappening(g: Garden, pl: Planting, plant: Plant, id: HappeningId, date: string, note = ''): Garden {
  const ids = [pl.id];
  let next: Garden;
  switch (id) {
    case 'sown-indoors':
    case 'sown-direct':
      next = setStage(setSowing(g, ids, id === 'sown-direct' ? 'direct' : 'indoors'), ids, 'sown', date);
      break;
    case 'planted':
      next = setStage(g, ids, 'transplanted', date);
      break;
    case 'new-season':
      next = setStage(g, ids, 'vegetative', date, { newSeason: true });
      break;
    case 'finished':
      next = harvestPlantings(g, ids, date);
      break;
    case 'failed':
      next = markFailed(g, pl.id, plant.commonName, date);
      break;
    default:
      next = setStage(g, ids, id, date);
  }
  return note.trim() ? addNote(next, makeNote(note, date, { plantingId: pl.id })) : next;
}
