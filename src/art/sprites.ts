// Plant drawings, cached as small images so the plan can show thousands of
// plants and still pan smoothly. Each plant is drawn once per stage, look,
// size and variation; sizes are rounded up to a few steps so zooming reuses them.

import { LOOKS, type LookId, type Mode } from '../theme/looks';
import { drawPlant, hashString, OVERHANG, type ArtStyle, type Look, type Paint } from './plants';
import type { PlantArt } from '../model/types';

/** How each look draws its plants. */
export const ART_STYLE: Record<LookId, ArtStyle> = { cottage: 'wash', heritage: 'ink', allotment: 'wash', modern: 'flat', minimal: 'outline' };

export function paintFor(look: LookId, mode: Mode): Paint {
  const plan = LOOKS[look][mode].plan;
  return { style: ART_STYLE[look], mode, ink: plan.label, paper: plan.paper, soil: plan.bedFill };
}

/** Radii, px, that drawings are made at. Bigger than the last one, plants are drawn directly. */
const BUCKETS = [6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256];
export const bucketFor = (r: number): number | null => BUCKETS.find((b) => b >= r) ?? null;

/** Kinds of the same plant, so a row doesn't look stamped out. Each is also turned at random as it's drawn. */
export const VARIANTS = 3;

const LIMIT = 600;
const cache = new Map<string, HTMLCanvasElement>();

export const lookKey = (l: Look) => `${l.grow}${l.ghost ? 'g' : ''}${l.seedling ? 's' : ''}${l.seeds ? 'd' : ''}${l.flowers ? 'f' : ''}${l.crop ? 'c' : ''}${l.bare ? 'b' : ''}${l.dormant ? 'z' : ''}`;

/** A cached drawing of a plant, radius `bucket` px, at this pixel ratio. */
export function plantSprite(plantId: string, art: PlantArt, look: Look, paint: Paint, styleKey: string, bucket: number, dpr: number, variant: number): HTMLCanvasElement {
  // The traits are in the key, so editing your own plant's drawing shows at once.
  const key = `${plantId}|${art.form}${art.leaf}${art.foliage}${art.flower ?? ''}${art.bloom ?? ''}${art.crop ? art.crop.kind + art.crop.colour : ''}|${lookKey(look)}|${styleKey}|${bucket}|${dpr}|${variant}`;
  const hit = cache.get(key);
  if (hit) {
    // Most recently used last, so the oldest go first.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const half = Math.ceil(bucket * OVERHANG + 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(half * 2 * dpr);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.translate(half, half);
  drawPlant(ctx, { art, look, r: bucket, paint, seed: hashString(plantId) + variant * 7919 });
  cache.set(key, c);
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value!);
  return c;
}

/** Forgets every cached drawing, e.g. after a plant's drawing is edited. */
export const clearSprites = () => cache.clear();
