// A line and a handful of general jobs for each month in an English garden.
// These are UK averages, shown alongside the jobs for your own plants (src/calendar/jobs.ts).

import type { Garden, Plant } from '../model/types';

export interface Season {
  month: number; // 1 to 12
  name: string;
  /** The month's line for any garden: nothing it tells you to do with a plant you may not have. */
  line: string;
  /** Lines about one plant, for a garden growing it (or meaning to): the first that fits is used. */
  lines: { about: string; text: string }[];
  jobs: string[];
}

export const SEASONS: Season[] = [
  {
    month: 1,
    name: 'January',
    line: 'Seed catalogues on the table, and the year ahead to plan.',
    lines: [
      { about: 'kale', text: 'Frost on the kale, and seed catalogues on the table.' },
      { about: 'garlic', text: 'Garlic shoots in the cold soil, and the year ahead to plan.' },
      { about: 'apple', text: 'Bare apple trees to prune, and seed catalogues on the table.' },
    ],
    jobs: [
      'Order seeds and seed potatoes',
      'Prune apple and pear trees while they are dormant',
      'Check stored crops and remove any that are rotting',
      'Clean pots and seed trays ready for spring',
    ],
  },
  {
    month: 2,
    name: 'February',
    line: 'Snowdrops out, and the first sowings on the windowsill.',
    lines: [
      { about: 'potato', text: 'Snowdrops out, and potatoes chitting on the windowsill.' },
      { about: 'chilli', text: 'Snowdrops out, and chillies sown on a warm windowsill.' },
      { about: 'sweet-pepper', text: 'Snowdrops out, and peppers sown on a warm windowsill.' },
    ],
    jobs: [
      'Chit seed potatoes in a cool, light place',
      'Sow chillies and sweet peppers indoors',
      'Cover beds with fleece or sheeting to warm the soil',
      'Cut autumn-fruiting raspberry canes down to the ground',
    ],
  },
  {
    month: 3,
    name: 'March',
    line: 'Daffodils out, and the soil starting to warm.',
    lines: [
      { about: 'onion', text: 'The soil starting to warm, and onion sets going in.' },
      { about: 'tomato', text: 'Daffodils out, and tomatoes sown on the windowsill.' },
      { about: 'potato', text: 'The soil starting to warm, and first early potatoes going in.' },
    ],
    jobs: [
      'Sow tomatoes indoors',
      'Plant onion sets and shallots',
      'Sow parsnips and broad beans outdoors in milder spells',
      'Plant first early potatoes at the end of the month',
    ],
  },
  {
    month: 4,
    name: 'April',
    line: 'Blossom on the trees and seedlings everywhere.',
    lines: [
      { about: 'potato', text: 'Blossom on the trees, and the last potatoes going in.' },
      { about: 'courgette', text: 'Blossom on the trees, and courgettes sown in pots indoors.' },
      { about: 'carrot', text: 'Blossom on the trees, and carrots sown in fine soil.' },
    ],
    jobs: [
      'Plant second early and maincrop potatoes',
      'Sow carrots, beetroot and lettuce outdoors',
      'Sow courgettes and squash indoors',
      'Cover blossom with fleece on frosty nights',
    ],
  },
  {
    month: 5,
    name: 'May',
    line: 'Everything growing fast, and one eye on late frost.',
    lines: [
      { about: 'tulip', text: 'Tulips out, and one eye on late frost.' },
      { about: 'tomato', text: 'Tomatoes waiting to go out, and one eye on late frost.' },
      { about: 'lettuce', text: 'The first salads, and one eye on late frost.' },
    ],
    jobs: [
      'Harden off tender plants before they go outside',
      'Plant out tomatoes and courgettes once frosts have passed',
      'Earth up potatoes as the shoots appear',
      'Sow French and runner beans outdoors late in the month',
    ],
  },
  {
    month: 6,
    name: 'June',
    line: 'Long light evenings, and the borders at their best.',
    lines: [
      { about: 'rose', text: 'Roses on the wall and the borders at their best.' },
      { about: 'strawberry', text: 'The first strawberries, and long light evenings.' },
      { about: 'broad-bean', text: 'Broad beans to pick, and long light evenings.' },
    ],
    jobs: [
      'Water in the morning or evening, and deeply',
      'Pinch out side shoots on cordon tomatoes',
      'Harvest early potatoes, broad beans and salads',
      'Net cabbages and kale against cabbage white butterflies',
    ],
  },
  {
    month: 7,
    name: 'July',
    line: 'Full beds and long light evenings.',
    lines: [
      { about: 'sweet-pea', text: 'Sweet peas, full beds and long light evenings.' },
      { about: 'courgette', text: 'Courgettes by the handful, and long light evenings.' },
      { about: 'strawberry', text: 'The last strawberries, and long light evenings.' },
    ],
    jobs: [
      'Pick courgettes and beans often to keep them cropping',
      'Feed tomatoes every week once they flower',
      'Deadhead flowers to keep them coming',
      'Water containers every day in hot spells',
    ],
  },
  {
    month: 8,
    name: 'August',
    line: 'Harvest time, and watering in the cool of the evening.',
    lines: [
      { about: 'runner-bean', text: 'Harvest time: runner beans by the handful.' },
      { about: 'french-bean', text: 'Harvest time: French beans by the handful.' },
      { about: 'tomato', text: 'Tomatoes ripening on the vine, and harvest in full swing.' },
      { about: 'sunflower', text: 'Sunflowers at their tallest, and harvest in full swing.' },
    ],
    jobs: [
      'Harvest little and often, and share the glut',
      'Sow spring cabbage and winter salads',
      'Summer-prune trained apples and pears',
      'Trim lavender lightly after it flowers',
    ],
  },
  {
    month: 9,
    name: 'September',
    line: 'Mellow light, and the last of the summer’s harvest.',
    lines: [
      { about: 'apple', text: 'Apples ripening, and the last of the summer’s harvest.' },
      { about: 'pumpkin', text: 'Pumpkins turning orange in the last of the sun.' },
      { about: 'winter-squash', text: 'Squashes ripening in the last of the sun.' },
    ],
    jobs: [
      'Pick apples and pears as they ripen',
      'Plant spring bulbs such as daffodils and crocuses',
      'Lift maincrop potatoes and store them in paper sacks',
      'Sow green manure on empty beds',
    ],
  },
  {
    month: 10,
    name: 'October',
    line: 'Leaves turning, and the garden winding down for winter.',
    lines: [
      { about: 'garlic', text: 'Leaves turning, and garlic cloves going in.' },
      { about: 'dahlia', text: 'Lift the dahlias once the first frost blackens them.' },
      { about: 'apple', text: 'Leaves turning, and the last of the apples to gather.' },
      { about: 'broad-bean', text: 'Leaves turning, and broad beans sown to stand the winter.' },
    ],
    jobs: [
      'Plant garlic cloves',
      'Sow overwintering broad beans outdoors',
      'Lift and store dahlia tubers after the first frost',
      'Gather fallen leaves to make leaf mould',
    ],
  },
  {
    month: 11,
    name: 'November',
    line: 'Bare branches, fallen leaves and a robin on the fork.',
    lines: [
      { about: 'tulip', text: 'Bare branches, and tulip bulbs going in for spring.' },
      { about: 'leek', text: 'Leeks standing in the cold, and a robin on the fork.' },
      { about: 'garlic', text: 'Bare branches, and garlic settling in for the winter.' },
    ],
    jobs: [
      'Plant bare-root trees, shrubs and roses',
      'Plant tulip bulbs',
      'Protect tender plants with fleece',
      'Clean and oil your tools',
    ],
  },
  {
    month: 12,
    name: 'December',
    line: 'Frosted seedheads, holly, and low winter sun.',
    lines: [
      { about: 'brussels-sprout', text: 'Sprouts sweetened by the frost, and low winter sun.' },
      { about: 'parsnip', text: 'Parsnips sweetened by the frost, and low winter sun.' },
      { about: 'leek', text: 'Leeks to lift, and low winter sun.' },
    ],
    jobs: [
      'Prune apples and pears, but not plums or cherries',
      'Harvest leeks, parsnips and Brussels sprouts',
      'Check stored fruit and vegetables',
      'Plan next year’s crops and where they will go',
    ],
  },
];

export function seasonFor(month: number): Season {
  return SEASONS[(((month - 1) % 12) + 12) % 12]!;
}

/**
 * The month's line for this garden: the first of the month's lines about a plant it's growing or has on its Want to
 * grow list (a kind of it counts), otherwise the line for any garden. Nobody's told to lift dahlias they don't have.
 */
export function monthLine(month: number, g: Garden, plantOf: (id: string) => Plant | null): string {
  const season = seasonFor(month);
  const grown = new Set<string>();
  for (const id of [...g.plantings.filter((p) => !p.removedOn).map((p) => p.plantId), ...g.wishlist]) {
    grown.add(id);
    const of = plantOf(id)?.varietyOf;
    if (of) grown.add(of);
  }
  return season.lines.find((l) => grown.has(l.about))?.text ?? season.line;
}
