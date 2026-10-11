// Plants in the order a beginner wants them: the ones most people start with
// first, then everything else A to Z. And which crops are easy to start with,
// each from a named source. Pure, for tests.

import type { Plant } from '../model/types';

/**
 * The plants most UK beginners grow, most-grown first: the first-run favourites, then the starter kits' plants, then
 * common veg, herbs, fruit and flowers. A judgement for ordering lists, not a fact shown on screen.
 */
export const POPULAR = [
  // The first-run favourites.
  'tomato', 'lettuce', 'strawberry', 'basil', 'potato', 'courgette', 'carrot', 'radish', 'french-bean', 'pea', 'chilli', 'mint',
  'sweet-pea', 'sunflower', 'cosmos', 'lavender',
  // Easy crops and the starter kits.
  'beetroot', 'spring-onion', 'garlic', 'onion', 'broad-bean', 'runner-bean', 'chard', 'spinach', 'rocket', 'kale', 'parsley',
  'chives', 'thyme', 'rosemary', 'coriander',
  // More common veg.
  'leek', 'cucumber', 'sweet-pepper', 'sweetcorn', 'cabbage', 'sprouting-broccoli', 'calabrese', 'parsnip', 'winter-squash',
  'pumpkin',
  // Fruit.
  'raspberry', 'blueberry', 'rhubarb', 'apple', 'blackcurrant', 'gooseberry',
  // Flowers.
  'nasturtium', 'calendula', 'french-marigold', 'cornflower', 'dahlia', 'tulip', 'daffodil', 'crocus', 'snowdrop', 'foxglove', 'zinnia',
];

/**
 * Crops and herbs the RHS calls easy to grow, each in its own words on its grow-your-own page (checked 9 Oct 2026).
 * Flowers aren't listed: no RHS page found said so of a particular flower.
 */
export const EASY: Record<string, string> = {
  beetroot: 'RHS, "How to grow beetroot": "a popular and easy-to-grow crop, ideal for beginners"',
  pea: 'RHS, "How to grow peas": "an easy crop to grow"',
  courgette: 'RHS, "How to grow courgettes": "easy to grow and fruit abundantly"',
  lettuce: 'RHS, "How to grow lettuce": "Lettuces are easy to grow"',
  radish: 'RHS, "How to grow radishes": "quick and easy to grow from seed"',
  potato: 'RHS, "How to grow potatoes": "easy and fun to grow"',
  'french-bean': 'RHS, "How to grow French beans": "an easy-to-grow crop, ideal for every size of garden"',
  'runner-bean': 'RHS, "How to grow runner beans": "one of the easiest vegetables to grow"',
  'broad-bean': 'RHS, "How to grow broad beans": "an easy and productive crop"',
  garlic: 'RHS, "How to grow garlic": "simple to grow in a warm sunny site"',
  tomato: 'RHS, "How to grow tomatoes": bush and small-fruited kinds "the easiest type to grow"',
  strawberry: 'RHS, "How to grow strawberries": "easy and rewarding to grow"',
  onion: 'RHS, "How to grow onions": sets "very easy to grow, ideal for both novice and experienced gardeners"',
  chard: 'RHS, "How to grow chard": "a versatile, easy and productive leaf crop"',
  mint: 'RHS, "How to grow mint": "Extremely easy to grow"',
  chives: 'RHS, "How to grow chives": "A popular and easy-to-grow herb"',
};

const RANK = new Map(POPULAR.map((id, i) => [id, i]));

/** Easy to start with: the plant, or the plant it's a variety of, is on the RHS's easy list. */
export const isEasy = (p: Pick<Plant, 'id' | 'varietyOf'>) => p.id in EASY || (!!p.varietyOf && p.varietyOf in EASY);

/**
 * The most-grown plants first, in that order; then the rest of the core 150 A to Z (with their varieties), then
 * everything else A to Z. A new list; the one given is left alone.
 */
export function beginnerOrder<T extends Pick<Plant, 'id' | 'commonName'> & Partial<Pick<Plant, 'varietyOf'>>>(plants: T[]): T[] {
  const tier = (p: T) => (CORE_SET.has(p.varietyOf ?? p.id) ? 0 : 1);
  return [...plants].sort((a, b) => {
    const ra = RANK.get(a.id);
    const rb = RANK.get(b.id);
    if (ra !== undefined || rb !== undefined) return (ra ?? Infinity) - (rb ?? Infinity);
    return tier(a) - tier(b) || a.commonName.localeCompare(b.commonName);
  });
}

/**
 * The rest of the core 150, after POPULAR: more common veg, herbs, fruit, flowers and shrubs. With POPULAR, the plants
 * the data track checks first. A judgement for which plants lead the lists, not a fact shown on screen.
 */
const MORE_CORE = [
  // Veg.
  'shallot', 'turnip', 'cauliflower', 'brussels-sprout', 'pak-choi', 'kohlrabi', 'swede', 'celeriac', 'celery', 'aubergine',
  'asparagus', 'globe-artichoke', 'florence-fennel', 'marrow', 'mangetout', 'cavolo-nero', 'savoy-cabbage', 'red-cabbage',
  'perpetual-spinach', 'summer-squash', 'corn-salad', 'jerusalem-artichoke',
  // Herbs.
  'sage', 'dill', 'oregano', 'fennel', 'bay', 'tarragon', 'lemon-balm', 'sorrel', 'borage', 'chamomile',
  // Fruit.
  'blackberry', 'redcurrant', 'plum', 'pear', 'cherry', 'fig', 'grape-vine', 'damson', 'greengage', 'tayberry', 'alpine-strawberry',
  'whitecurrant', 'quince', 'loganberry',
  // Flowers.
  'rose', 'hollyhock', 'lupin', 'delphinium', 'hardy-geranium', 'hellebore', 'peony', 'echinacea', 'rudbeckia', 'verbena-bonariensis',
  'nigella', 'sweet-william', 'snapdragon', 'ornamental-allium', 'wallflower', 'forget-me-not', 'viola', 'primrose', 'hyacinth',
  'grape-hyacinth', 'bluebell', 'lily', 'salvia-nemorosa', 'catmint', 'penstemon', 'aquilegia', 'hosta', 'sedum',
  // Shrubs and climbers.
  'buddleja', 'hydrangea', 'hardy-fuchsia', 'hebe', 'camellia', 'forsythia', 'lilac', 'clematis', 'honeysuckle', 'wisteria',
  'star-jasmine', 'climbing-rose', 'box', 'pyracantha', 'ceanothus', 'japanese-maple', 'mock-orange', 'choisya',
];

/** The core 150: the most-grown plants, first in every list and checked first. */
export const CORE = [...POPULAR, ...MORE_CORE];
const CORE_SET = new Set(CORE);

/** What the plants beyond the core are listed under, until they're checked. */
export const MORE_PLANTS = 'More plants (still being checked)';

/**
 * In the main lists: a core plant or a variety of one, anything checked, your own plants, and weeds (which have their
 * own lists). The rest wait under "More plants (still being checked)" until the data track reaches them.
 */
export const isCore = (p: Pick<Plant, 'id' | 'varietyOf' | 'verified' | 'userAdded' | 'category'>) =>
  p.userAdded || p.verified || p.category === 'weed' || CORE_SET.has(p.varietyOf ?? p.id);

/** A list split into the core plants and the rest, each keeping its order. */
export function splitCore<T extends Pick<Plant, 'id' | 'varietyOf' | 'verified' | 'userAdded' | 'category'>>(plants: T[]): { core: T[]; more: T[] } {
  return { core: plants.filter(isCore), more: plants.filter((p) => !isCore(p)) };
}
