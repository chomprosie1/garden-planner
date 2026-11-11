// A gardener's own copy of a library plant keeps what the original gets (release 57j).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { howTo } from '../src/content/howto';
import { climbs } from '../src/planting/supports';
import type { Job } from '../src/calendar/jobs';
import { careFor } from '../src/calendar/care';
import { blankPlant, copyAsUserPlant, deleteUserPlant, getsNoJobs, usesOf } from '../src/library/library';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { createStore } from '../src/model/store';
import { addPlanting, makePlanting } from '../src/planting/place';
import { newAppState } from '../src/model/defaults';
import type { Plant } from '../src/model/types';
import { validatePlant } from '../src/model/validate';
import { parseFileText, toFile } from '../src/storage/file';

const DIR = join(__dirname, '..', 'data', 'plants');
const library: Plant[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const apple = library.find((p) => p.id === 'apple')!;

describe('my own version of a library plant', () => {
  it('remembers what it was copied from and keeps its care jobs', () => {
    const copy = copyAsUserPlant(apple);
    expect(copy.id).not.toBe('apple');
    expect(copy.basedOn).toBe('apple');
    expect(careFor(apple, 1).length).toBeGreaterThan(0);
    expect(careFor(copy, 1)).toEqual(careFor(apple, 1));
  });

  it('a copy of a copy keeps the library id', () => {
    expect(copyAsUserPlant(copyAsUserPlant(apple)).basedOn).toBe('apple');
  });

  it('an older copy with no basedOn is not guessed at', () => {
    const { basedOn: _b, ...old } = copyAsUserPlant(apple);
    expect(careFor(old as Plant, 1)).toEqual([]);
  });

  it('is checked: a string is fine, a number is not', () => {
    const ok = { ...copyAsUserPlant(apple), basedOn: 'apple' };
    expect(validatePlant(ok)).toEqual([]);
    expect(validatePlant({ ...ok, basedOn: 5 }).length).toBeGreaterThan(0);
  });

  it('survives a backup and restore', () => {
    const state = { ...newAppState(), userPlants: [copyAsUserPlant(apple)] };
    const back = parseFileText(JSON.stringify(toFile(state)));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.state.userPlants[0]?.basedOn).toBe('apple');
  });

  it('a copy of an apple is picked like an apple and trained like one', () => {
    const copy = copyAsUserPlant(apple);
    const job = { key: 'k', kind: 'harvest', plantId: copy.id, plant: copy.commonName, where: '', plantingIds: [] } as unknown as Job;
    const at = (plant: Plant) => ({ plant, month: 10, style: 'rows' as const });
    expect(howTo(job, 'plants', false, at(copy)).steps).toEqual(howTo(job, 'plants', false, at(apple)).steps);
    expect(climbs(copy)).toBe(climbs(apple));
    expect(climbs(copy)).toBe(true);
  });
});

describe('deleting one of your own plants', () => {
  const mine: Plant = { ...blankPlant(), commonName: 'Grandad’s bean', sowing: [{ method: 'direct', months: [5] }] };
  const setup = () => {
    const bed = makeFeature('bed', { area: rectPoints({ x: 0, y: 0, w: 3000, h: 1200 }) });
    let g = addFeature(newAppState().garden, bed);
    g = addPlanting(g, makePlanting(mine, bed.id, 'single', [500, 500]));
    g = addPlanting(g, makePlanting(mine, bed.id, 'single', [1500, 500]));
    g = addPlanting(g, makePlanting(apple, bed.id, 'single', [2500, 500]));
    g = { ...g, wishlist: [mine.id, 'apple'], trays: [{ id: 't1', plantId: mine.id, container: 'module', count: 6, sownOn: '2027-04-01' } as never] };
    return { garden: g, userPlants: [mine] };
  };

  it('takes its plantings, trays and wish with it, and leaves everything else', () => {
    const s = setup();
    expect(usesOf(s, mine.id)).toBe(3);
    const after = deleteUserPlant(mine.id)(s);
    expect(after.userPlants).toEqual([]);
    expect(after.garden.plantings.map((p) => p.plantId)).toEqual(['apple']);
    expect(after.garden.trays).toEqual([]);
    expect(after.garden.wishlist).toEqual(['apple']);
    expect(after.garden.features).toBe(s.garden.features);
  });

  it('comes back whole with one Undo', () => {
    const s = setup();
    const store = createStore(s);
    store.apply(deleteUserPlant(mine.id));
    store.undo();
    expect(store.get()).toEqual(s);
  });

  it('an id that is not yours changes nothing', () => {
    const s = setup();
    expect(deleteUserPlant('apple')(s)).toBe(s);
  });
});

describe('a plant that will get no jobs', () => {
  it('is one with no months to sow, plant out or harvest, and nothing behind it', () => {
    expect(getsNoJobs(blankPlant())).toBe(true);
    expect(getsNoJobs({ ...blankPlant(), flowerMonths: [6, 7] })).toBe(true);
    expect(getsNoJobs({ ...blankPlant(), sowing: [{ method: 'direct', months: [] }] })).toBe(true);
    expect(getsNoJobs({ ...blankPlant(), sowing: [{ method: 'direct', months: [4] }] })).toBe(false);
    expect(getsNoJobs({ ...blankPlant(), plantOutMonths: [5] })).toBe(false);
    expect(getsNoJobs({ ...blankPlant(), cropping: { harvestMonths: [8] } })).toBe(false);
    expect(getsNoJobs({ ...copyAsUserPlant(apple), sowing: undefined, plantOutMonths: undefined, cropping: undefined })).toBe(false);
  });
});
