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

/** The most-grown plants first, in that order; then the rest A to Z. A new list; the one given is left alone. */
export function beginnerOrder<T extends Pick<Plant, 'id' | 'commonName'>>(plants: T[]): T[] {
  return [...plants].sort((a, b) => {
    const ra = RANK.get(a.id);
    const rb = RANK.get(b.id);
    if (ra !== undefined || rb !== undefined) return (ra ?? Infinity) - (rb ?? Infinity);
    return a.commonName.localeCompare(b.commonName);
  });
}
