// Ready-made things to drop on the plan, at real sizes: beds and pots, ground,
// and structures. Each one becomes an ordinary feature where it's dropped, so
// it can be moved, resized, turned and reshaped like anything drawn.

import { makeFeature, rectPoints } from './features';
import { makeTree, treeSize, treeType } from './trees';
import { PLANT_SIZES, type Feature, type FeatureKind, type Material, type PlantSize, type Point } from './types';

export type StickerGroup = 'beds' | 'ground' | 'build';

export interface Sticker {
  id: string;
  group: StickerGroup;
  label: string;
  /** "2.4 × 1.2 m", shown under the label. */
  size: string;
  kind: FeatureKind;
  shape: { rect: [number, number] } | { circle: number } | { line: number };
  material?: Material;
  edging?: Feature['edging'];
  /** A tree of a type, at a size: see src/model/trees.ts. */
  tree?: { type: string; size: PlantSize };
}

/** "2.4 × 1.2 m", or "100 × 40 cm" when either side is under a metre: one unit for both. */
const rect = (w: number, h: number) => (w >= 1000 && h >= 1000 ? `${+(w / 1000).toFixed(2)} × ${+(h / 1000).toFixed(2)} m` : `${w / 10} × ${h / 10} cm`);

export const STICKERS: Sticker[] = [
  { id: 'raised-bed', group: 'beds', label: 'Raised bed', size: rect(2400, 1200), kind: 'bed', shape: { rect: [2400, 1200] }, edging: 'timber' },
  { id: 'small-bed', group: 'beds', label: 'Small bed', size: rect(1200, 1200), kind: 'bed', shape: { rect: [1200, 1200] }, edging: 'timber' },
  { id: 'long-bed', group: 'beds', label: 'Border', size: rect(4000, 900), kind: 'bed', shape: { rect: [4000, 900] } },
  { id: 'pot', group: 'beds', label: 'Pot', size: 'Ø 30 cm', kind: 'pot', shape: { circle: 150 } },
  { id: 'big-pot', group: 'beds', label: 'Big pot', size: 'Ø 50 cm', kind: 'pot', shape: { circle: 250 } },
  { id: 'window-box', group: 'beds', label: 'Window box', size: rect(800, 200), kind: 'planter', shape: { rect: [800, 200] } },
  { id: 'trough', group: 'beds', label: 'Trough', size: rect(1000, 400), kind: 'planter', shape: { rect: [1000, 400] } },
  { id: 'grow-bag', group: 'beds', label: 'Grow bag', size: rect(900, 350), kind: 'planter', shape: { rect: [900, 350] } },
  { id: 'greenhouse', group: 'beds', label: 'Greenhouse', size: rect(2400, 1800), kind: 'greenhouse', shape: { rect: [2400, 1800] } },
  { id: 'cold-frame', group: 'beds', label: 'Cold frame', size: rect(1200, 600), kind: 'cold-frame', shape: { rect: [1200, 600] } },
  { id: 'lawn', group: 'ground', label: 'Lawn', size: rect(4000, 3000), kind: 'surface', shape: { rect: [4000, 3000] }, material: 'lawn' },
  { id: 'meadow', group: 'ground', label: 'Wildflower meadow', size: rect(3000, 2000), kind: 'surface', shape: { rect: [3000, 2000] }, material: 'meadow' },
  { id: 'gravel', group: 'ground', label: 'Gravel', size: rect(2000, 2000), kind: 'surface', shape: { rect: [2000, 2000] }, material: 'gravel' },
  { id: 'paving', group: 'ground', label: 'Patio', size: rect(3000, 2400), kind: 'surface', shape: { rect: [3000, 2400] }, material: 'paving' },
  { id: 'decking', group: 'ground', label: 'Decking', size: rect(3000, 2400), kind: 'surface', shape: { rect: [3000, 2400] }, material: 'decking' },
  { id: 'bark', group: 'ground', label: 'Bark chips', size: rect(2000, 1000), kind: 'surface', shape: { rect: [2000, 1000] }, material: 'bark' },
  { id: 'path', group: 'ground', label: 'Path', size: '3 m', kind: 'path', shape: { line: 3000 }, material: 'gravel' },
  { id: 'pond', group: 'ground', label: 'Pond', size: rect(1500, 1000), kind: 'water', shape: { rect: [1500, 1000] } },
  { id: 'shed', group: 'build', label: 'Shed', size: rect(2400, 1800), kind: 'building', shape: { rect: [2400, 1800] } },
  { id: 'compost', group: 'build', label: 'Compost bin', size: rect(1000, 1000), kind: 'compost', shape: { rect: [1000, 1000] } },
  { id: 'fence', group: 'build', label: 'Fence', size: '3 m', kind: 'fence', shape: { line: 3000 } },
  { id: 'wall', group: 'build', label: 'Wall', size: '3 m', kind: 'wall', shape: { line: 3000 } },
  { id: 'hedge', group: 'build', label: 'Hedge', size: '3 m', kind: 'hedge', shape: { line: 3000 } },
];

/** A tree's sticker id: "tree:silver-birch:medium". Trees aren't in STICKERS; the dock lists them from TREE_TYPES. */
export const treeStickerId = (type: string, size: PlantSize) => `tree:${type}:${size}`;

export function stickerById(id: string): Sticker | undefined {
  const [head, typeId, size] = id.split(':');
  if (head === 'tree' && typeId) {
    const type = treeType(typeId);
    const sz = (PLANT_SIZES as readonly string[]).includes(size ?? '') ? (size as PlantSize) : 'medium';
    if (!type) return undefined;
    const across = treeSize(type, sz).spreadMm;
    return { id, group: 'build', label: type.name, size: `Ø ${+(across / 1000).toFixed(1)} m`, kind: 'tree', shape: { circle: across / 2 }, tree: { type: type.id, size: sz } };
  }
  return STICKERS.find((s) => s.id === id);
}

/** The feature a sticker makes, centred on a point. */
export function stickerFeature(s: Sticker, at: Point): Feature {
  const [x, y] = at;
  const type = s.tree && treeType(s.tree.type);
  if (s.tree && type) return makeTree(type, s.tree.size, at);
  let f: Feature;
  if ('rect' in s.shape) {
    const [w, h] = s.shape.rect;
    f = makeFeature(s.kind, { area: rectPoints({ x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h }) });
  } else if ('circle' in s.shape) f = makeFeature(s.kind, { circle: { centre: [x, y], radiusMm: s.shape.circle } });
  else {
    const half = s.shape.line / 2;
    f = makeFeature(s.kind, { line: [[x - half, y], [x + half, y]] });
  }
  if (s.material) f = { ...f, material: s.material };
  if (s.edging !== undefined) f = { ...f, edging: s.edging };
  else if (s.kind === 'bed' && !s.edging) {
    const { edging: _e, ...rest } = f;
    f = rest;
  }
  return f;
}
