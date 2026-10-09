// Release 10: the garden in 3D, and leaves dropping in winter. The scene is
// worked out without WebGL (src/three/scene.ts), so it's tested here: what
// stands where and how tall, trees and plants through the seasons, plants on
// top of their beds and pots, and the sun. Drawings from the side are checked
// for every plant, stage and season.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import shrubs from '../data/plants/shrub.json';
import vegetables from '../data/plants/vegetable.json';
import { drawPlant, seasonal, stageLook, type ArtStyle, type Look } from '../src/art/plants';
import { drawPlantSide } from '../src/art/side';
import { lookKey } from '../src/art/sprites';
import { bulbLeafMonths, runOf, seasonState, winterHabit } from '../src/lifecycle/seasons';
import { pathFor, type LifeStage } from '../src/lifecycle/stages';
import { newGarden } from '../src/model/defaults';
import { addFeature, makeFeature, rectPoints } from '../src/model/features';
import { makeTree, treeType } from '../src/model/trees';
import type { Feature, Garden, Plant, Planting, Point } from '../src/model/types';
import { validatePlant } from '../src/model/validate';
import { addPlanting, makePlanting, plantPositions, unknownPlant } from '../src/planting/place';
import { buildScene, frostOn, leafOf, MAX_PLANTS, roofOf, soilHeight, solidHeight, sunIn, type Scene3 } from '../src/three/scene';
import { BODY_MM, canStand, EDGE_MM, obstaclesOf, step, walk, walkStart, walkTowards } from '../src/three/walk';

const library = [...vegetables, ...herbs, ...fruit, ...flowers, ...shrubs] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id) ?? unknownPlant(id);

/** A stand-in canvas that records calls, with gradients, so drawings run without a browser. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop: () => undefined });
      return (...args: unknown[]) => {
        log.push(`${String(key)}(${args.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).join(',')})`);
      };
    },
    set(target, key, value) {
      target[key] = value;
      log.push(`${String(key)}=${String(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const area = (x: number, y: number, w: number, h: number): Point[] => rectPoints({ x, y, w, h });

describe('leaves through the year', () => {
  it('knows how each perennial spends the winter', () => {
    expect(winterHabit(plant('apple'))).toBe('deciduous');
    expect(winterHabit(plant('blackcurrant'))).toBe('deciduous');
    expect(winterHabit(plant('rose'))).toBe('deciduous');
    expect(winterHabit(plant('hydrangea'))).toBe('deciduous');
    expect(winterHabit(plant('rosemary'))).toBe('evergreen');
    expect(winterHabit(plant('box'))).toBe('evergreen');
    expect(winterHabit(plant('strawberry'))).toBe('evergreen');
    expect(winterHabit(plant('mint'))).toBe('dies-back');
    expect(winterHabit(plant('peony'))).toBe('dies-back');
    expect(winterHabit(plant('rhubarb'))).toBe('dies-back');
    expect(winterHabit(plant('tulip'))).toBe('dies-back');
    // Annuals are cleared, not wintered.
    expect(winterHabit(plant('tomato'))).toBeNull();
    expect(winterHabit(plant('lettuce'))).toBeNull();
  });

  it('keeps every plant valid with its winter habit, and refuses an unknown one', () => {
    for (const p of library) expect(validatePlant(p), p.id).toEqual([]);
    expect(validatePlant({ ...plant('box'), lifePath: { winter: 'sleepy' as never } }).length).toBe(1);
  });

  it('finds runs of months, round the new year', () => {
    expect(runOf([6, 7, 8])).toEqual([6, 8]);
    expect(runOf([12, 1, 2])).toEqual([12, 2]);
    expect(runOf([1, 2, 11, 12])).toEqual([11, 2]);
    expect(runOf([])).toBeNull();
  });

  it('leaves deciduous plants bare from November to April, like the trees', () => {
    expect(seasonState(plant('apple'), 1)).toBe('bare');
    expect(seasonState(plant('apple'), 4)).toBe('bare');
    expect(seasonState(plant('apple'), 7)).toBe('full');
    expect(seasonState(plant('rosemary'), 1)).toBe('full');
    expect(seasonState(plant('tomato'), 1)).toBe('full');
  });

  it('cuts back plants that die back, and shows them small coming and going', () => {
    expect(seasonState(plant('mint'), 1)).toBe('dormant');
    expect(seasonState(plant('mint'), 3)).toBe('small');
    expect(seasonState(plant('mint'), 6)).toBe('full');
    expect(seasonState(plant('mint'), 11)).toBe('small');
  });

  it('shows bulbs only from two months before they flower to the month after', () => {
    const tulip = plant('tulip');
    const [from, to] = bulbLeafMonths(tulip);
    expect(seasonState(tulip, from)).toBe('full');
    expect(seasonState(tulip, to)).toBe('full');
    expect(seasonState(tulip, 9)).toBe('dormant');
    // Snowdrops flower in late winter, so their leaves run round the new year.
    const snowdrop = plant('snowdrop');
    expect(seasonState(snowdrop, 1)).toBe('full');
    expect(seasonState(snowdrop, 7)).toBe('dormant');
  });

  it('changes how a planting looks only while it’s growing in the ground, not in flower or cropping', () => {
    const apple = plant('apple');
    const pl = makePlanting(apple, 'bed', 'single', [0, 0]);
    expect(seasonal(stageLook('vegetative', apple, pl), apple, 1).bare).toBe(true);
    expect(seasonal(stageLook('vegetative', apple, pl), apple, 7).bare).toBeFalsy();
    expect(seasonal(stageLook('flowering', apple, pl), apple, 4).bare).toBeFalsy();
    expect(seasonal(stageLook('planned', apple, pl), apple, 1)).toEqual(stageLook('planned', apple, pl));
    const mint = plant('mint');
    expect(seasonal(stageLook('vegetative', mint, makePlanting(mint, 'bed', 'single', [0, 0])), mint, 1).dormant).toBe(true);
    const small = seasonal(stageLook('vegetative', mint, makePlanting(mint, 'bed', 'single', [0, 0])), mint, 3);
    expect(small.grow).toBeLessThan(1);
    // Each season is its own cached picture on the plan.
    expect(lookKey({ ...stageLook('vegetative', apple), bare: true })).not.toBe(lookKey(stageLook('vegetative', apple)));
  });
});

describe('drawings', () => {
  const winters: Partial<Look>[] = [{}, { bare: true }, { dormant: true }];
  it('draws every plant from above, bare and cut back, in every style', () => {
    for (const p of library)
      for (const w of winters)
        for (const style of ['wash', 'ink', 'flat', 'outline'] as ArtStyle[]) {
          const { ctx } = recorder();
          expect(() => drawPlant(ctx, { art: p.art!, look: { ...stageLook('vegetative', p), ...w }, r: 30, paint: { style, mode: 'light', ink: '#333333', paper: '#ffffff', soil: '#7a5a40' }, seed: 1 }), `${p.id} ${style}`).not.toThrow();
        }
  });

  it('draws every plant from the side, at every stage on its path and in winter', () => {
    for (const p of library) {
      const stages: LifeStage[] = ['planned', ...pathFor(p)];
      for (const s of stages)
        for (const w of winters) {
          const { ctx } = recorder();
          expect(() => drawPlantSide(ctx, { art: p.art!, look: { ...stageLook(s, p), ...w }, w: 120, h: 160, seed: 7 }), `${p.id} ${s}`).not.toThrow();
        }
    }
  });

  it('draws the same plant the same way every time, and differently as it grows', () => {
    const tomato = plant('tomato');
    const draw = (look: Look) => {
      const r = recorder();
      drawPlantSide(r.ctx, { art: tomato.art!, look, w: 100, h: 180, seed: 3 });
      return r.log.join(';');
    };
    expect(draw(stageLook('vegetative', tomato))).toBe(draw(stageLook('vegetative', tomato)));
    expect(draw(stageLook('harvesting', tomato))).not.toBe(draw(stageLook('vegetative', tomato)));
    // Seeds just sown don't show from the side.
    const carrot = plant('carrot');
    const sown = stageLook('sown', carrot, { ...makePlanting(carrot, 'bed', 'single', [0, 0]), sowing: 'direct' });
    expect(sown.seeds).toBe(true);
    const r = recorder();
    drawPlantSide(r.ctx, { art: carrot.art!, look: sown, w: 100, h: 100, seed: 3 });
    expect(r.log).toEqual([]);
  });
});

/** A small garden with one of most things in it. */
function sample(): { g: Garden; raised: Feature; pot: Feature; lawn: Feature } {
  let g: Garden = { ...newGarden(), latitude: 52.5, longitude: -1.5, northRotationDeg: 0, boundary: area(0, 0, 10000, 8000) };
  const lawn: Feature = { ...makeFeature('surface', { area: area(0, 0, 10000, 4000) }), material: 'lawn' };
  const path = makeFeature('path', { line: [[5000, 4000], [5000, 8000]] });
  const raised: Feature = { ...makeFeature('bed', { area: area(1000, 5000, 2400, 1200) }), edging: 'timber', name: 'Raised bed' };
  const flat: Feature = { ...makeFeature('bed', { area: area(6000, 5000, 2400, 1200) }), name: 'Border' };
  delete flat.edging;
  const pot = makeFeature('pot', { circle: { centre: [9000, 3000], radiusMm: 200 } });
  const fence = makeFeature('fence', { line: [[0, 8000], [10000, 8000]] });
  const hedge: Feature = { ...makeFeature('hedge', { line: [[0, 0], [0, 8000]] }), deciduous: true };
  const shed = makeFeature('building', { area: area(7000, 6500, 2400, 1800) });
  const house = makeFeature('greenhouse', { area: area(1000, 1000, 1800, 2400) });
  const birch = makeTree(treeType('silver-birch')!, 'medium', [4000, 2000]);
  const holly = makeTree(treeType('holly')!, 'medium', [8000, 1000]);
  for (const f of [lawn, path, raised, flat, pot, fence, hedge, shed, house, birch, holly]) g = addFeature(g, f);
  return { g, raised, pot, lawn };
}

const stageIs = (stage: LifeStage) => () => ({ stage, guessed: false });
const scene = (g: Garden, date = '2027-07-01', stage?: LifeStage): Scene3 => buildScene({ garden: g, plantOf: plant, date, ...(stage ? { stageOf: stageIs(stage) } : {}) });

describe('the garden in 3D', () => {
  it('stands beds to their edging, and everything else to its height', () => {
    const { g } = sample();
    const s = scene(g);
    const by = (name: string) => s.solids.find((x) => x.name === name)!;
    expect(by('Raised bed').heightMm).toBe(300);
    expect(by('Border').heightMm).toBe(60);
    expect(s.solids.find((x) => x.kind === 'fence')!.heightMm).toBe(1800);
    expect(s.solids.find((x) => x.kind === 'pot')!.circle?.radiusMm).toBe(200);
    expect(s.solids.find((x) => x.kind === 'building')!.heightMm).toBe(2400);
    expect(solidHeight({ ...makeFeature('wall', { line: [[0, 0], [1000, 0]] }), heightMm: 0 })).toBe(2000);
  });

  it('lays surfaces and paths flat, in the order they’re drawn', () => {
    const s = scene(sample().g);
    expect(s.flats.map((f) => f.material)).toEqual(['lawn', 'path']);
    expect(s.flats[0]!.layer).toBeLessThan(s.flats[1]!.layer);
  });

  it('puts a pitched roof on a rectangular building, along its longer side', () => {
    const shed = makeFeature('building', { area: area(0, 0, 3000, 2000) });
    const r = roofOf(shed, 2400)!;
    expect(r.eavesMm).toBe(1800);
    expect(Math.abs(r.ridge[0][1] - r.ridge[1][1])).toBeLessThan(1);
    expect(Math.abs(r.ridge[0][0] - r.ridge[1][0])).toBeCloseTo(3000, 0);
    expect(r.halfSpan).toBeCloseTo(1000, 0);
    expect(roofOf(makeFeature('building', { area: [[0, 0], [3000, 0], [1500, 2000]] }), 2400)).toBeUndefined();
    expect(roofOf(makeFeature('bed', { area: area(0, 0, 3000, 2000) }), 300)).toBeUndefined();
  });

  it('leaves deciduous trees and hedges bare in winter, and evergreens in leaf', () => {
    const { g } = sample();
    const winter = scene(g, '2027-01-15');
    const summer = scene(g, '2027-07-15');
    const tree = (s: Scene3, name: string) => s.trees.find((t) => t.name === name)!;
    expect(tree(winter, 'Silver birch').bare).toBe(true);
    expect(tree(summer, 'Silver birch').bare).toBe(false);
    expect(tree(winter, 'Holly').bare).toBe(false);
    expect(tree(winter, 'Silver birch').shape).toBe('oval');
    expect(winter.solids.find((x) => x.kind === 'hedge')!.bare).toBe(true);
    expect(summer.solids.find((x) => x.kind === 'hedge')!.bare).toBeUndefined();
  });

  it('stands plants on the soil of their bed or pot, and on the lawn at ground level', () => {
    const { g: g0, raised, pot, lawn } = sample();
    let g = addPlanting(g0, makePlanting(plant('carrot'), raised.id, 'row', [1300, 5600], [3100, 5600]));
    g = addPlanting(g, makePlanting(plant('basil'), pot.id, 'single', [9000, 3000]));
    g = addPlanting(g, makePlanting(plant('crocus'), lawn.id, 'single', [2000, 3000]));
    const s = scene(g, '2027-07-01', 'vegetative');
    const base = (id: string) => s.groups.find((x) => x.plantId === id)!.spots[0]!.baseMm;
    expect(base('carrot')).toBe(soilHeight(raised));
    expect(base('carrot')).toBe(260);
    expect(base('basil')).toBe(270);
    expect(base('crocus')).toBe(0);
    // Every plant in the row is drawn.
    const carrots = s.groups.find((x) => x.plantId === 'carrot')!;
    expect(carrots.spots.length).toBe(plantPositions(g.plantings[0]!, plant('carrot')).length);
    expect(s.names[g.plantings[0]!.id]).toBe('Carrot in Raised bed: growing');
  });

  it('draws each plant at its stage on the day, and leaves out seeds and what’s cleared', () => {
    const { g: g0, raised } = sample();
    const pl: Planting = makePlanting(plant('lettuce'), raised.id, 'single', [2000, 5500]);
    const g = addPlanting(g0, pl);
    expect(scene(g, '2027-07-01', 'harvesting').groups[0]!.look.crop).toBe(true);
    expect(scene(g, '2027-07-01', 'planned').groups[0]!.look.ghost).toBe(true);
    expect(scene(g, '2027-07-01', 'cleared').groups).toEqual([]);
    expect(scene({ ...g, plantings: [{ ...pl, sowing: 'direct' }] }, '2027-07-01', 'sown').groups).toEqual([]);
    // Without a timeline, as marked now; a planting cleared is left out.
    expect(scene({ ...g, plantings: [{ ...pl, removedOn: '2026-09-01' }] }).groups).toEqual([]);
  });

  it('groups plants drawn the same way, so each picture is made once', () => {
    const { g: g0, raised } = sample();
    let g = addPlanting(g0, makePlanting(plant('lettuce'), raised.id, 'single', [1500, 5500]));
    g = addPlanting(g, makePlanting(plant('lettuce'), raised.id, 'single', [2500, 5500]));
    const s = scene(g, '2027-07-01', 'vegetative');
    expect(s.groups.length).toBe(1);
    expect(s.groups[0]!.spots.length).toBe(2);
    expect(s.plantCount).toBe(2);
    // Each plant is turned its own way, fixed by where it is.
    expect(s.groups[0]!.spots[0]!.turn).not.toBe(s.groups[0]!.spots[1]!.turn);
    expect(scene(g, '2027-07-01', 'vegetative').groups[0]!.spots[0]!.turn).toBe(s.groups[0]!.spots[0]!.turn);
  });

  it('makes fruit trees trees: bare in winter, in blossom, then with fruit', () => {
    const { g: g0, lawn } = sample();
    const g = addPlanting(g0, makePlanting(plant('apple'), lawn.id, 'single', [6000, 2000]));
    const apple = (date: string, stage: LifeStage) => scene(g, date, stage).trees.find((t) => t.plantingId)!;
    expect(apple('2027-01-15', 'vegetative').bare).toBe(true);
    expect(apple('2027-07-15', 'vegetative').bare).toBe(false);
    expect(apple('2027-04-20', 'flowering').blossom).toBe(plant('apple').art!.flower);
    expect(apple('2027-09-10', 'harvesting').fruit).toBe(plant('apple').art!.crop!.colour);
    expect(apple('2027-07-15', 'planned').ghost).toBe(true);
    expect(scene(g, '2027-07-15', 'vegetative').groups.some((x) => x.plantId === 'apple')).toBe(false);
  });

  it('cuts back perennials in the scene too', () => {
    const { g: g0, raised } = sample();
    const g = addPlanting(g0, makePlanting(plant('mint'), raised.id, 'single', [2000, 5500]));
    expect(scene(g, '2027-01-15', 'vegetative').groups[0]!.look.dormant).toBe(true);
    expect(scene(g, '2027-07-15', 'vegetative').groups[0]!.look.dormant).toBeFalsy();
  });

  it('thins a huge planting rather than drawing every plant', () => {
    const { g: g0, raised } = sample();
    const block = makePlanting(plant('radish'), raised.id, 'block', [0, 0], [60000, 60000]);
    const s = scene(addPlanting(g0, { ...block, count: undefined }), '2027-07-01', 'vegetative');
    expect(plantPositions(block, plant('radish')).length).toBeGreaterThan(MAX_PLANTS);
    expect(s.plantCount).toBeLessThanOrEqual(MAX_PLANTS);
    expect(s.plantCount).toBeGreaterThan(MAX_PLANTS / 3);
  });

  it('stands on the garden’s boundary, or round everything when there isn’t one', () => {
    const { g } = sample();
    expect(scene(g).ground).toEqual(g.boundary);
    const open = scene({ ...g, boundary: [] });
    expect(open.ground.length).toBe(4);
    expect(open.ground[0]![0]).toBeLessThan(0);
    expect(scene({ ...newGarden(), boundary: [] }).bounds.max[0]).toBeGreaterThan(0);
  });

  it('lights it from the real sun: high at midsummer, low at midwinter, from the south at midday', () => {
    const g = sample().g;
    const june = sunIn(g, '2027-06-21', 13 * 60)!;
    const dec = sunIn(g, '2027-12-21', 12 * 60 + 10)!;
    expect(june.altitude).toBeGreaterThan(55);
    expect(dec.altitude).toBeLessThan(16);
    expect(dec.altitude).toBeGreaterThan(10);
    // North is up the plan, so the midday sun is down the plan.
    expect(dec.dir[1]).toBeLessThan(-0.9);
    expect(Math.hypot(...dec.dir)).toBeCloseTo(1, 5);
    // Turn the plan so north points right: the sun moves round with it.
    const turned = sunIn({ ...g, northRotationDeg: 90 }, '2027-12-21', 12 * 60 + 10)!;
    expect(turned.dir[0]).toBeLessThan(-0.9);
    expect(sunIn(g, '2027-12-21', 0)).toBeNull();
  });

  it('works out a big garden quickly', () => {
    let { g } = sample();
    const bed = makeFeature('bed', { area: area(0, 0, 40000, 40000) });
    g = addFeature(g, bed);
    const ids = ['lettuce', 'carrot', 'tomato', 'onion', 'bean', 'kale', 'mint', 'apple'];
    for (let i = 0; i < 500; i++) {
      const x = (i % 25) * 1600;
      const y = Math.floor(i / 25) * 1600;
      g = addPlanting(g, makePlanting(plant(ids[i % ids.length]!), bed.id, 'row', [x, y], [x + 1200, y]));
    }
    const t0 = performance.now();
    const s = scene(g, '2027-07-01', 'vegetative');
    expect(performance.now() - t0).toBeLessThan(400);
    expect(s.plantCount).toBeGreaterThan(1000);
    expect(s.groups.length).toBeLessThanOrEqual(ids.length);
  });
});

// Release 17: walking through it, leaves you can recognise, and the season.
describe('walking through the garden', () => {
  const walkScene = () => scene(sample().g);

  it('can’t walk through beds, buildings, fences, hedges, pots or tree trunks, but can on the lawn and paths', () => {
    const s = walkScene();
    const obs = obstaclesOf(s);
    expect(canStand(s, obs, [5000, 3000])).toBe(true); // open lawn
    expect(canStand(s, obs, [5000, 6000])).toBe(true); // the path
    expect(canStand(s, obs, [2000, 5600])).toBe(false); // in the raised bed
    expect(canStand(s, obs, [7000, 5600])).toBe(false); // in the border, though it has no edging
    expect(canStand(s, obs, [8000, 7500])).toBe(false); // in the shed
    expect(canStand(s, obs, [5000, 7950])).toBe(false); // against the fence
    expect(canStand(s, obs, [9000, 3000])).toBe(false); // the pot
    expect(canStand(s, obs, [4000, 2050])).toBe(false); // the birch's trunk
    expect(canStand(s, obs, [4000, 2900])).toBe(true); // under its canopy
  });

  it('stops at a fence, and slides along a wall rather than sticking', () => {
    const s = walkScene();
    const obs = obstaclesOf(s);
    const end = walk(s, obs, [5000, 7000], [5000, 9500]);
    expect(end[1]).toBeLessThan(8000 - BODY_MM + 20);
    // Walking up and to the right into the fence: you end up further right, still on this side.
    const slid = walk(s, obs, [3000, 7300], [4000, 9000]);
    expect(slid[0]).toBeGreaterThan(3500);
    expect(slid[1]).toBeLessThan(8000);
    expect(canStand(s, obs, slid)).toBe(true);
  });

  it('never steps through a thin fence, however big the step', () => {
    const s = walkScene();
    const obs = obstaclesOf(s);
    expect(step(s, obs, [5000, 7600], [5000, 8600])).not.toEqual([5000, 8600]);
    expect(walk(s, obs, [5000, 7600], [5000, 12000])[1]).toBeLessThan(8000);
  });

  it('starts somewhere you can stand, looking up the garden, even with something in the way', () => {
    const s = walkScene();
    const obs = obstaclesOf(s);
    const { at, heading } = walkStart(s, obs);
    expect(canStand(s, obs, at)).toBe(true);
    expect(heading).toBeCloseTo(Math.PI / 2);
    // A shed right where you'd start: you start beside it.
    const g = addFeature(sample().g, makeFeature('building', { area: area(3500, 0, 3000, 2500) }));
    const s2 = scene(g);
    const obs2 = obstaclesOf(s2);
    const start2 = walkStart(s2, obs2);
    expect(canStand(s2, obs2, start2.at)).toBe(true);
  });

  it('walks towards a tapped spot as far as it can, or not at all when blocked', () => {
    const s = walkScene();
    const obs = obstaclesOf(s);
    const end = walkTowards(s, obs, [5000, 3000], [6000, 3000])!;
    expect(end[0]).toBeCloseTo(6000, 3);
    expect(end[1]).toBeCloseTo(3000, 3);
    const blocked = walkTowards(s, obs, [5000, 3000], [5000, 7400]);
    expect(blocked).not.toBeNull();
    expect(canStand(s, obs, blocked!)).toBe(true);
    expect(walkTowards(s, obs, [5000, 7800], [5000, 9000])).toBeNull();
  });

  it('goes down a 35 cm path between two beds', () => {
    let g = sample().g;
    g = addFeature(g, makeFeature('bed', { area: area(3000, 2500, 1000, 1200) }));
    g = addFeature(g, makeFeature('bed', { area: area(4350, 2500, 1000, 1200) }));
    const s = scene(g);
    const obs = obstaclesOf(s);
    const end = walk(s, obs, [4175, 2200], [4175, 4000]);
    expect(end[1]).toBeGreaterThan(3900);
  });

  it('is never stuck when something has grown up close by: it can always step away', () => {
    const s = walkScene();
    const obs = obstaclesOf(s);
    // Right by the birch's trunk, closer than you're meant to get.
    const from: Point = [4000, 2000 + 200 + BODY_MM / 2];
    expect(canStand(s, obs, from)).toBe(false);
    const away = step(s, obs, from, [from[0], from[1] + 40]);
    expect(away[1]).toBeGreaterThan(from[1]);
    expect(step(s, obs, from, [from[0], from[1] - 40])).toEqual(from);
  });

  it('stays within a few metres of the garden', () => {
    const s = walkScene();
    expect(canStand(s, obstaclesOf(s), [-EDGE_MM - 500, 3000])).toBe(false);
  });
});

describe('leaves and the season in 3D', () => {
  it('gives each tree its own leaf shape', () => {
    let g = sample().g;
    for (const [id, x] of [['japanese-maple', 1000], ['rowan', 3000], ['scots-pine', 5000], ['olive', 7000]] as const) g = addFeature(g, makeTree(treeType(id)!, 'medium', [x, 3500]));
    g = addPlanting(g, makePlanting(plant('apple'), sample().raised.id, 'single', [2000, 5600]));
    const s = scene(g);
    const leaf = (name: string) => s.trees.find((t) => t.name.startsWith(name))!.leaf;
    expect(leaf('Silver birch')).toBe('broad');
    expect(leaf('Japanese maple')).toBe('lobed');
    expect(leaf('Rowan')).toBe('feathery');
    expect(leaf('Scots pine')).toBe('needle');
    expect(leaf('Olive')).toBe('strap');
    expect(leaf('Apple')).toBe('broad');
    expect(leafOf({ form: 'shrub', leaf: 'round', foliage: '#5e8a4a' })).toBe('broad');
  });

  it('greens the lawn in spring and pales it in late summer', () => {
    const g = sample().g;
    expect(scene(g, '2027-04-15').lawn).toBeGreaterThan(0);
    expect(scene(g, '2027-08-15').lawn).toBeLessThan(0);
  });

  it('puts frost on a winter morning, thinning through the day, and none in summer or under glass', () => {
    const g = sample().g;
    expect(frostOn(g, '2027-01-10', 8 * 60)).toBe(1);
    expect(frostOn(g, '2027-01-10', 14 * 60)).toBeLessThan(1);
    expect(frostOn(g, '2027-01-10', 14 * 60)).toBeGreaterThan(0);
    expect(frostOn(g, '2027-07-10', 8 * 60)).toBe(0);
    expect(buildScene({ garden: g, plantOf: plant, date: '2027-01-10', minutes: 9 * 60 }).frost).toBe(1);
    // A bed inside the greenhouse stays clear.
    const g2 = addFeature(g, makeFeature('bed', { area: area(1200, 1200, 600, 600) }));
    const s = scene(g2, '2027-01-10');
    const inside = s.solids.filter((x) => x.kind === 'bed' && x.polygon[0]![0] === 1200)[0]!;
    expect(inside.covered).toBe(true);
    expect(s.solids.find((x) => x.name === 'Raised bed')!.covered).toBeUndefined();
  });

  it('brings the plan’s sketches into the scene', () => {
    const g = { ...sample().g, sketches: [{ id: 'k1', kind: 'arrow' as const, points: [[1000, 1000], [3000, 1000]] as Point[], colour: 'red' as const, widthMm: 60 }] };
    expect(scene(g).sketches).toHaveLength(1);
  });
});

describe('fruit trees in pots (fix, 9 Oct 2026)', () => {
  it('stands a fig in a pot on the pot’s soil, and one on the lawn on the ground', () => {
    const { g: g0, pot, lawn } = sample();
    let g = addPlanting(g0, makePlanting(plant('fig'), pot.id, 'single', [9000, 3000]));
    g = addPlanting(g, makePlanting(plant('apple'), lawn.id, 'single', [6000, 2000]));
    const s = scene(g);
    const fig = s.trees.find((t) => t.name.startsWith('Fig'))!;
    expect(fig.baseMm).toBe(soilHeight(pot));
    expect(fig.baseMm).toBeGreaterThan(0);
    expect(s.trees.find((t) => t.name.startsWith('Apple'))!.baseMm).toBeUndefined();
  });
});
