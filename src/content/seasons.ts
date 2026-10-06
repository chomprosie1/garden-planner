// A line and a handful of general jobs for each month in an English garden.
// These are UK averages; Stage 5 replaces the jobs with ones for your own plants.

export interface Season {
  month: number; // 1 to 12
  name: string;
  line: string;
  jobs: string[];
}

export const SEASONS: Season[] = [
  {
    month: 1,
    name: 'January',
    line: 'Frost on the kale and seed catalogues on the table.',
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
    line: 'Snowdrops out, and potatoes chitting on the windowsill.',
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
    line: 'Blossom on the fruit trees and seedlings everywhere.',
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
    line: 'Tulips, the first salads, and one eye on late frost.',
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
    line: 'Roses on the wall and the borders at their best.',
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
    line: 'Sweet peas, full beds and long light evenings.',
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
    line: 'Harvest time: beans, sunflowers and the first apples.',
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
    line: 'Apples ripening and pumpkins turning orange.',
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
    line: 'Lift the dahlias, plant garlic, and gather the last of the apples.',
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
