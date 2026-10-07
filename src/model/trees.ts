// Trees to drop on the plan: about fifty that grow in UK gardens and round
// them, from a Japanese maple to an oak. Each has a typical size in a garden
// (medium) and how much light it blocks, which decide its shade. Small and
// large scale that: a young or hard-pruned tree, or an old one.
//
// Sizes are rough, from RHS and nursery figures for about twenty years' growth.
// Fruit trees are plants in the library, not here, so their jobs and harvests work.

import type { Feature, PlantSize, Point } from './types';
import { makeFeature, withFootprint } from './features';

/** Its outline from the side, for drawing it in 3D later; from above, most are round. */
export type TreeShape = 'round' | 'oval' | 'columnar' | 'conical' | 'spreading' | 'weeping';
export type TreeLeaf = 'broad' | 'lobed' | 'feathery' | 'needle' | 'strap';

export interface TreeType {
  id: string;
  name: string;
  latinName: string;
  evergreen: boolean;
  shape: TreeShape;
  leaf: TreeLeaf;
  /** Typical height and spread in a garden, in metres. */
  heightM: number;
  spreadM: number;
  /** Share of light its canopy blocks in leaf, and bare in winter (deciduous only). */
  inLeaf: number;
  bare?: number;
  /** Its leaf colour from above, when it isn't plain green. */
  foliage?: string;
  /** Planted in gardens more than most: listed first. */
  popular?: boolean;
}

const t = (id: string, name: string, latinName: string, o: Omit<TreeType, 'id' | 'name' | 'latinName'>): TreeType => ({ id, name, latinName, ...o });

export const TREE_TYPES: TreeType[] = [
  // Garden favourites first.
  t('silver-birch', 'Silver birch', 'Betula pendula', { evergreen: false, shape: 'oval', leaf: 'broad', heightM: 12, spreadM: 5, inLeaf: 0.5, bare: 0.15, foliage: '#7da05a', popular: true }),
  t('himalayan-birch', 'Himalayan birch', 'Betula utilis var. jacquemontii', { evergreen: false, shape: 'oval', leaf: 'broad', heightM: 10, spreadM: 4, inLeaf: 0.5, bare: 0.15, foliage: '#7da05a', popular: true }),
  t('japanese-maple', 'Japanese maple', 'Acer palmatum', { evergreen: false, shape: 'spreading', leaf: 'lobed', heightM: 3, spreadM: 3, inLeaf: 0.7, bare: 0.15, foliage: '#9c3b2e', popular: true }),
  t('rowan', 'Rowan', 'Sorbus aucuparia', { evergreen: false, shape: 'oval', leaf: 'feathery', heightM: 8, spreadM: 4, inLeaf: 0.6, bare: 0.15, popular: true }),
  t('amelanchier', 'Snowy mespilus', 'Amelanchier lamarckii', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 6, spreadM: 5, inLeaf: 0.6, bare: 0.15, popular: true }),
  t('crab-apple', 'Crab apple', 'Malus × robusta', { evergreen: false, shape: 'round', leaf: 'broad', heightM: 5, spreadM: 4, inLeaf: 0.65, bare: 0.2, popular: true }),
  t('ornamental-cherry', 'Ornamental cherry', 'Prunus serrulata', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 7, spreadM: 6, inLeaf: 0.7, bare: 0.15, popular: true }),
  t('flagpole-cherry', 'Flagpole cherry', "Prunus 'Amanogawa'", { evergreen: false, shape: 'columnar', leaf: 'broad', heightM: 6, spreadM: 1.5, inLeaf: 0.7, bare: 0.15, popular: true }),
  t('magnolia', 'Magnolia', 'Magnolia × soulangeana', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 5, spreadM: 5, inLeaf: 0.7, bare: 0.15, popular: true }),
  t('olive', 'Olive', 'Olea europaea', { evergreen: true, shape: 'round', leaf: 'strap', heightM: 4, spreadM: 3, inLeaf: 0.6, foliage: '#7f8f6a', popular: true }),
  t('holly', 'Holly', 'Ilex aquifolium', { evergreen: true, shape: 'conical', leaf: 'broad', heightM: 6, spreadM: 3, inLeaf: 0.9, foliage: '#3f5f36', popular: true }),
  t('hawthorn', 'Hawthorn', 'Crataegus monogyna', { evergreen: false, shape: 'round', leaf: 'lobed', heightM: 6, spreadM: 5, inLeaf: 0.75, bare: 0.25, popular: true }),
  t('field-maple', 'Field maple', 'Acer campestre', { evergreen: false, shape: 'round', leaf: 'lobed', heightM: 10, spreadM: 6, inLeaf: 0.75, bare: 0.2 }),
  t('tibetan-cherry', 'Tibetan cherry', 'Prunus serrula', { evergreen: false, shape: 'round', leaf: 'broad', heightM: 7, spreadM: 6, inLeaf: 0.7, bare: 0.15 }),
  t('judas-tree', 'Judas tree', 'Cercis siliquastrum', { evergreen: false, shape: 'round', leaf: 'broad', heightM: 6, spreadM: 5, inLeaf: 0.6, bare: 0.15 }),
  t('cornus-kousa', 'Chinese dogwood', 'Cornus kousa', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 5, spreadM: 4, inLeaf: 0.7, bare: 0.15 }),
  t('strawberry-tree', 'Strawberry tree', 'Arbutus unedo', { evergreen: true, shape: 'round', leaf: 'broad', heightM: 5, spreadM: 5, inLeaf: 0.85, foliage: '#4a6b3c' }),
  t('whitebeam', 'Whitebeam', 'Sorbus aria', { evergreen: false, shape: 'oval', leaf: 'broad', heightM: 9, spreadM: 6, inLeaf: 0.75, bare: 0.2, foliage: '#8ea47a' }),
  t('hazel', 'Hazel', 'Corylus avellana', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 5, spreadM: 4, inLeaf: 0.75, bare: 0.25 }),
  t('elder', 'Elder', 'Sambucus nigra', { evergreen: false, shape: 'spreading', leaf: 'feathery', heightM: 5, spreadM: 4, inLeaf: 0.65, bare: 0.2 }),
  t('parrotia', 'Persian ironwood', 'Parrotia persica', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 6, spreadM: 6, inLeaf: 0.7, bare: 0.2 }),
  t('cotoneaster-cornubia', 'Tree cotoneaster', "Cotoneaster 'Cornubia'", { evergreen: true, shape: 'spreading', leaf: 'broad', heightM: 5, spreadM: 5, inLeaf: 0.75, foliage: '#4a6b3c' }),
  t('laburnum', 'Laburnum', 'Laburnum × watereri', { evergreen: false, shape: 'oval', leaf: 'feathery', heightM: 6, spreadM: 4, inLeaf: 0.6, bare: 0.15 }),
  t('catalpa', 'Indian bean tree', 'Catalpa bignonioides', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 8, spreadM: 8, inLeaf: 0.85, bare: 0.15, foliage: '#7aa04e' }),
  t('mulberry', 'Black mulberry', 'Morus nigra', { evergreen: false, shape: 'spreading', leaf: 'broad', heightM: 6, spreadM: 6, inLeaf: 0.8, bare: 0.2 }),
  t('eucalyptus', 'Cider gum', 'Eucalyptus gunnii', { evergreen: true, shape: 'oval', leaf: 'strap', heightM: 12, spreadM: 5, inLeaf: 0.5, foliage: '#8fa3a0' }),
  t('sweet-gum', 'Sweet gum', 'Liquidambar styraciflua', { evergreen: false, shape: 'conical', leaf: 'lobed', heightM: 12, spreadM: 6, inLeaf: 0.8, bare: 0.2 }),
  t('ginkgo', 'Maidenhair tree', 'Ginkgo biloba', { evergreen: false, shape: 'columnar', leaf: 'broad', heightM: 10, spreadM: 5, inLeaf: 0.7, bare: 0.15, foliage: '#8aa64f' }),
  t('pussy-willow', 'Goat willow', 'Salix caprea', { evergreen: false, shape: 'spreading', leaf: 'strap', heightM: 8, spreadM: 6, inLeaf: 0.65, bare: 0.2 }),
  t('weeping-willow', 'Weeping willow', 'Salix × sepulcralis', { evergreen: false, shape: 'weeping', leaf: 'strap', heightM: 12, spreadM: 12, inLeaf: 0.7, bare: 0.2, foliage: '#8cab58' }),
  t('alder', 'Alder', 'Alnus glutinosa', { evergreen: false, shape: 'conical', leaf: 'broad', heightM: 12, spreadM: 6, inLeaf: 0.7, bare: 0.2 }),
  t('hornbeam', 'Hornbeam', 'Carpinus betulus', { evergreen: false, shape: 'oval', leaf: 'broad', heightM: 12, spreadM: 8, inLeaf: 0.85, bare: 0.3 }),
  // Conifers and other evergreens.
  t('yew', 'Yew', 'Taxus baccata', { evergreen: true, shape: 'conical', leaf: 'needle', heightM: 6, spreadM: 4, inLeaf: 0.95, foliage: '#2f4a2c' }),
  t('leylandii', 'Leyland cypress', '× Cuprocyparis leylandii', { evergreen: true, shape: 'columnar', leaf: 'needle', heightM: 15, spreadM: 4, inLeaf: 0.95, foliage: '#3c5a34' }),
  t('lawson-cypress', 'Lawson cypress', 'Chamaecyparis lawsoniana', { evergreen: true, shape: 'conical', leaf: 'needle', heightM: 10, spreadM: 4, inLeaf: 0.95, foliage: '#3f6040' }),
  t('scots-pine', 'Scots pine', 'Pinus sylvestris', { evergreen: true, shape: 'round', leaf: 'needle', heightM: 12, spreadM: 6, inLeaf: 0.7, foliage: '#4c6447' }),
  t('norway-spruce', 'Norway spruce', 'Picea abies', { evergreen: true, shape: 'conical', leaf: 'needle', heightM: 12, spreadM: 5, inLeaf: 0.9, foliage: '#2f4a33' }),
  t('deodar', 'Deodar cedar', 'Cedrus deodara', { evergreen: true, shape: 'conical', leaf: 'needle', heightM: 15, spreadM: 8, inLeaf: 0.85, foliage: '#5f7a63' }),
  t('monkey-puzzle', 'Monkey puzzle', 'Araucaria araucana', { evergreen: true, shape: 'conical', leaf: 'needle', heightM: 10, spreadM: 5, inLeaf: 0.8, foliage: '#3e5a35' }),
  // Big trees: in larger gardens, or over the fence.
  t('oak', 'English oak', 'Quercus robur', { evergreen: false, shape: 'spreading', leaf: 'lobed', heightM: 15, spreadM: 12, inLeaf: 0.85, bare: 0.25 }),
  t('beech', 'Beech', 'Fagus sylvatica', { evergreen: false, shape: 'round', leaf: 'broad', heightM: 15, spreadM: 10, inLeaf: 0.9, bare: 0.25 }),
  t('copper-beech', 'Copper beech', 'Fagus sylvatica Atropurpurea Group', { evergreen: false, shape: 'round', leaf: 'broad', heightM: 15, spreadM: 10, inLeaf: 0.9, bare: 0.25, foliage: '#6b2f3a' }),
  t('wild-cherry', 'Wild cherry', 'Prunus avium', { evergreen: false, shape: 'oval', leaf: 'broad', heightM: 15, spreadM: 8, inLeaf: 0.7, bare: 0.15 }),
  t('ash', 'Ash', 'Fraxinus excelsior', { evergreen: false, shape: 'round', leaf: 'feathery', heightM: 15, spreadM: 10, inLeaf: 0.65, bare: 0.15 }),
  t('horse-chestnut', 'Horse chestnut', 'Aesculus hippocastanum', { evergreen: false, shape: 'round', leaf: 'lobed', heightM: 15, spreadM: 10, inLeaf: 0.9, bare: 0.25 }),
  t('sycamore', 'Sycamore', 'Acer pseudoplatanus', { evergreen: false, shape: 'round', leaf: 'lobed', heightM: 15, spreadM: 10, inLeaf: 0.85, bare: 0.2 }),
  t('norway-maple', 'Norway maple', 'Acer platanoides', { evergreen: false, shape: 'round', leaf: 'lobed', heightM: 12, spreadM: 9, inLeaf: 0.85, bare: 0.2 }),
  t('lime', 'Lime', 'Tilia × europaea', { evergreen: false, shape: 'oval', leaf: 'broad', heightM: 15, spreadM: 8, inLeaf: 0.85, bare: 0.2 }),
  t('london-plane', 'London plane', 'Platanus × hispanica', { evergreen: false, shape: 'round', leaf: 'lobed', heightM: 18, spreadM: 12, inLeaf: 0.85, bare: 0.25 }),
  t('walnut', 'Walnut', 'Juglans regia', { evergreen: false, shape: 'spreading', leaf: 'feathery', heightM: 12, spreadM: 10, inLeaf: 0.75, bare: 0.2 }),
  t('sweet-chestnut', 'Sweet chestnut', 'Castanea sativa', { evergreen: false, shape: 'round', leaf: 'broad', heightM: 15, spreadM: 10, inLeaf: 0.85, bare: 0.25 }),
  t('tulip-tree', 'Tulip tree', 'Liriodendron tulipifera', { evergreen: false, shape: 'oval', leaf: 'lobed', heightM: 15, spreadM: 8, inLeaf: 0.85, bare: 0.2 }),
];

/** Fruit trees are plants, kept in the library: listed with the trees so they're found there too. */
export const FRUIT_TREE_PLANTS = ['apple', 'pear', 'plum', 'cherry', 'fig'];

/** How a size scales the tree's typical height and spread. */
export const TREE_SIZE_FACTOR: Record<PlantSize, number> = { small: 0.6, medium: 1, large: 1.5 };

export const treeType = (id: string | undefined) => (id ? TREE_TYPES.find((x) => x.id === id) : undefined);

/** Its height and spread at a size, in mm, to the nearest 10 cm. */
export function treeSize(type: TreeType, size: PlantSize): { heightMm: number; spreadMm: number } {
  const k = TREE_SIZE_FACTOR[size];
  const round = (m: number) => Math.round(m * k * 10) * 100;
  return { heightMm: round(type.heightM), spreadMm: round(type.spreadM) };
}

/** "8 m tall, 4 m across" at a size. */
export function treeSizeText(type: TreeType, size: PlantSize): string {
  const { heightMm, spreadMm } = treeSize(type, size);
  const m = (mm: number) => `${+(mm / 1000).toFixed(1)} m`;
  return `${m(heightMm)} tall, ${m(spreadMm)} across`;
}

/** A tree feature made, or changed, to be this type at this size: its name, canopy, height and shade. The centre stays put. */
export function asTree(f: Feature, type: TreeType, size: PlantSize): Feature {
  const { heightMm, spreadMm } = treeSize(type, size);
  const centre: Point = f.circle?.centre ?? [0, 0];
  return withFootprint({
    ...f,
    name: type.name,
    treeType: type.id,
    size,
    heightMm,
    circle: { centre, radiusMm: Math.round(spreadMm / 2) },
    deciduous: !type.evergreen,
    opacityInLeaf: type.inLeaf,
    opacityBare: type.evergreen ? type.inLeaf : (type.bare ?? 0.2),
  });
}

/** A new tree of a type, centred on a point. */
export const makeTree = (type: TreeType, size: PlantSize, at: Point): Feature => asTree(makeFeature('tree', { circle: { centre: at, radiusMm: 1000 } }), type, size);

/** Trees whose name or Latin name has the words in it, favourites first. */
export function findTrees(query: string): TreeType[] {
  const q = query.trim().toLowerCase();
  const all = q ? TREE_TYPES.filter((x) => `${x.name} ${x.latinName}`.toLowerCase().includes(q)) : TREE_TYPES;
  return [...all.filter((x) => x.popular), ...all.filter((x) => !x.popular)];
}
