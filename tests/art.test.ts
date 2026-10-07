// Illustrated plants (Stage 10): every plant has a drawing, stages change how
// it's drawn, and drawing is repeatable and safe for every plant, stage and look.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { artFor, drawPlant, showcaseStage, stageLook, type ArtStyle } from '../src/art/plants';
import { bucketFor, lookKey } from '../src/art/sprites';
import type { LifeStage } from '../src/lifecycle/stages';
import { blankPlant } from '../src/library/library';
import type { Plant } from '../src/model/types';
import { validatePlant } from '../src/model/validate';
import { makePlanting } from '../src/planting/place';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, p]));
const plant = (id: string) => byId.get(id)!;

/** A stand-in canvas that records what's drawn, so drawings can be compared without a browser. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const round = (v: unknown) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push(`${String(key)}(${args.map(round).join(',')})`);
      };
    },
    set(target, key, value) {
      target[key] = value;
      log.push(`${String(key)}=${round(value)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const paint = (style: ArtStyle) => ({ style, mode: 'light' as const, ink: '#333333', paper: '#ffffff', soil: '#7a5a40' });

describe('every plant has a drawing', () => {
  it('in the library', () => {
    for (const p of library) {
      expect(p.art, p.id).toBeDefined();
      expect(validatePlant(p)).toEqual([]);
    }
  });
  it('and your own plants get one for their category, in a colour that stays the same', () => {
    const mine = { ...blankPlant(), id: 'user-abc', commonName: 'Mystery', category: 'fruit' as const };
    expect(artFor(mine).form).toBe('shrub');
    expect(artFor(mine).foliage).toBe(artFor({ ...mine }).foliage);
    expect(artFor(mine).foliage).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('refuses colours that aren’t #rrggbb', () => {
    expect(validatePlant({ ...plant('tomato'), art: { ...plant('tomato').art!, foliage: 'green' } }).length).toBe(1);
    expect(validatePlant({ ...plant('tomato'), art: { ...plant('tomato').art!, form: 'blob' as never } }).length).toBe(1);
  });
});

describe('stages change the drawing', () => {
  it('shows each plant at its best on cards: crop, flowers or leaves', () => {
    expect(showcaseStage(plant('tomato'))).toBe('harvesting');
    expect(showcaseStage(plant('tulip'))).toBe('flowering');
    expect(showcaseStage(plant('lettuce'))).toBe('vegetative');
  });
  it('planned and indoor seedlings are faint, direct sowings show seeds then seedlings', () => {
    const carrot = plant('carrot');
    const pl = { ...makePlanting(carrot, 'b', 'single', [0, 0]), sowing: 'direct' as const };
    expect(stageLook('planned', carrot, pl).ghost).toBe(true);
    expect(stageLook('sown', carrot, pl)).toMatchObject({ seeds: true, ghost: false });
    expect(stageLook('germinated', carrot, pl)).toMatchObject({ seedling: true, ghost: false });
    const tomato = plant('tomato');
    expect(stageLook('germinated', tomato).ghost).toBe(true); // still indoors
    expect(stageLook('hardening', tomato).ghost).toBe(true);
  });
  it('young plants are planted out small, bought plants bigger, and grow to full size', () => {
    expect(stageLook('transplanted', plant('tomato')).grow).toBeLessThan(stageLook('transplanted', plant('strawberry')).grow);
    expect(stageLook('vegetative', plant('tomato')).grow).toBe(1);
  });
  it('flowers and crops show at their stages', () => {
    expect(stageLook('flowering', plant('tomato'))).toMatchObject({ flowers: true, crop: false });
    expect(stageLook('harvesting', plant('tomato'))).toMatchObject({ crop: true });
  });
  it('each look of a stage has its own cache key', () => {
    const keys = new Set((['planned', 'sown', 'germinated', 'transplanted', 'vegetative', 'flowering', 'harvesting'] as LifeStage[]).map((s) => lookKey(stageLook(s, plant('tomato')))));
    expect(keys.size).toBeGreaterThanOrEqual(5);
  });
});

describe('drawing', () => {
  it('is the same every time for the same plant and seed, and differs between seeds', () => {
    const draw = (seed: number) => {
      const { ctx, log } = recorder();
      drawPlant(ctx, { art: plant('tomato').art!, look: stageLook('harvesting', plant('tomato')), r: 40, paint: paint('wash'), seed });
      return log.join(';');
    };
    expect(draw(7)).toBe(draw(7));
    expect(draw(7)).not.toBe(draw(8));
  });

  it('works for every plant, at every stage, in every style', () => {
    const stages: LifeStage[] = ['planned', 'sown', 'germinated', 'hardening', 'transplanted', 'vegetative', 'flowering', 'harvesting'];
    for (const p of library)
      for (const s of stages)
        for (const style of ['wash', 'ink', 'flat', 'outline'] as ArtStyle[]) {
          const { ctx, log } = recorder();
          expect(() => drawPlant(ctx, { art: p.art!, look: stageLook(s, p), r: 24, paint: paint(style), seed: 1 })).not.toThrow();
          expect(log.length).toBeGreaterThan(0);
          // Every save has its restore, so one plant never changes how the next is drawn.
          expect(log.filter((l) => l.startsWith('save(')).length).toBe(log.filter((l) => l.startsWith('restore(')).length);
        }
    // Every plant, stage and style: a couple of seconds alone, longer while the other test files run beside it.
  }, 30_000);

  it('caches drawings at a few sizes, and draws very large plants directly', () => {
    expect(bucketFor(5)).toBe(6);
    expect(bucketFor(33)).toBe(40);
    expect(bucketFor(256)).toBe(256);
    expect(bucketFor(300)).toBeNull();
  });
});
