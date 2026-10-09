// Ready-made things to drop on the plan, at real sizes: beds and pots, ground,
// and structures. Each one becomes an ordinary feature where it's dropped, so
// it can be moved, resized, turned and reshaped like anything drawn.

import { makeFeature, rectPoints, withFootprint } from './features';
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
  /** Its own name on the plan ("Water butt"), where the kind's name won't do. */
  name?: string;
  /** How tall it stands, and for a line how thick it is, mm; the share of light it blocks. Absent: the kind's usual. */
  heightMm?: number;
  widthMm?: number;
  opacity?: number;
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
  { id: 'cardboard', group: 'ground', label: 'Cardboard over weeds', size: rect(2000, 1200), kind: 'surface', shape: { rect: [2000, 1200] }, material: 'cardboard' },
  { id: 'path', group: 'ground', label: 'Path', size: '3 m', kind: 'path', shape: { line: 3000 }, material: 'gravel' },
  { id: 'pond', group: 'ground', label: 'Pond', size: rect(1500, 1000), kind: 'water', shape: { rect: [1500, 1000] } },
  { id: 'shed', group: 'build', label: 'Shed', size: rect(2400, 1800), kind: 'building', shape: { rect: [2400, 1800] } },
  { id: 'compost', group: 'build', label: 'Compost bin', size: rect(1000, 1000), kind: 'compost', shape: { rect: [1000, 1000] } },
  { id: 'fence', group: 'build', label: 'Fence', size: '3 m', kind: 'fence', shape: { line: 3000 } },
  { id: 'wall', group: 'build', label: 'Wall', size: '3 m', kind: 'wall', shape: { line: 3000 } },
  { id: 'hedge', group: 'build', label: 'Hedge', size: '3 m', kind: 'hedge', shape: { line: 3000 } },
  // The everyday things a garden is planned round. Heights are typical, for the shade they cast; change them in More.
  { id: 'house', group: 'build', label: 'House', size: rect(7000, 5000), kind: 'building', shape: { rect: [7000, 5000] }, name: 'House', heightMm: 7500 },
  { id: 'water-butt', group: 'build', label: 'Water butt', size: 'Ø 60 cm', kind: 'other', shape: { circle: 300 }, name: 'Water butt', heightMm: 1000 },
  { id: 'gate', group: 'build', label: 'Gate', size: '1 m', kind: 'fence', shape: { line: 1000 }, name: 'Gate', heightMm: 1200 },
  { id: 'bench', group: 'build', label: 'Bench', size: rect(1500, 500), kind: 'other', shape: { rect: [1500, 500] }, name: 'Bench', heightMm: 900 },
  { id: 'table', group: 'build', label: 'Table and chairs', size: 'Ø 1.8 m', kind: 'other', shape: { circle: 900 }, name: 'Table and chairs', heightMm: 750 },
  { id: 'bins', group: 'build', label: 'Bins', size: rect(1400, 700), kind: 'other', shape: { rect: [1400, 700] }, name: 'Bins', heightMm: 1100 },
  { id: 'washing-line', group: 'build', label: 'Washing line', size: '4 m', kind: 'fence', shape: { line: 4000 }, name: 'Washing line', heightMm: 1800, widthMm: 20, opacity: 0.05 },
  { id: 'bird-bath', group: 'build', label: 'Bird bath', size: 'Ø 50 cm', kind: 'other', shape: { circle: 250 }, name: 'Bird bath', heightMm: 700 },
  { id: 'bird-feeder', group: 'build', label: 'Bird feeder', size: 'Ø 30 cm', kind: 'other', shape: { circle: 150 }, name: 'Bird feeder', heightMm: 1800, opacity: 0.1 },
  { id: 'bee-hotel', group: 'build', label: 'Bee hotel', size: rect(300, 200), kind: 'other', shape: { rect: [300, 200] }, name: 'Bee hotel', heightMm: 400 },
  { id: 'steps', group: 'ground', label: 'Steps', size: rect(1200, 900), kind: 'surface', shape: { rect: [1200, 900] }, material: 'paving', name: 'Steps' },
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
  if (s.name) f = { ...f, name: s.name };
  if (s.heightMm !== undefined) f = { ...f, heightMm: s.heightMm };
  if (s.opacity !== undefined) f = { ...f, opacityInLeaf: s.opacity, opacityBare: s.opacity };
  if (s.widthMm !== undefined && f.line) f = withFootprint({ ...f, widthMm: s.widthMm });
  if (s.material) f = { ...f, material: s.material };
  if (s.edging !== undefined) f = { ...f, edging: s.edging };
  else if (s.kind === 'bed' && !s.edging) {
    const { edging: _e, ...rest } = f;
    f = rest;
  }
  return f;
}
