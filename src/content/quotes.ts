// Short lines for the loading screen: our own words, not anyone's, in the voice
// of docs/voice.md. Generic and hopeful, by season, with some for any time of
// year. They're about real things (string, frost, a wheelbarrow of compost)
// rather than big ideas, and they avoid the shapes that read as machine-written:
// no "it's not X, it's Y", no lists of three, no exclamation marks, no
// questions. tests/welcome.test.ts checks the rules a test can; whether they
// sound like a person is for a person to judge.

export type QuoteSeason = 'winter' | 'spring' | 'summer' | 'autumn' | 'any';

export interface Quote {
  text: string;
  season: QuoteSeason;
}

const q = (season: QuoteSeason, ...texts: string[]): Quote[] => texts.map((text) => ({ text, season }));

export const QUOTES: Quote[] = [
  ...q(
    'winter',
    'The seed catalogues arrive just when the garden looks its worst. That’s no accident.',
    'A frosty morning is the best time to see the shape of a garden. Nothing hides.',
    'Bare branches show you where next summer’s light will fall.',
    'Winter is when a garden is planned. Summer only finds out how it went.',
    'Clean pots, sharp secateurs and a bag of compost by the door. Spring will be glad of you.',
    'Frost breaks up the clods better than any spade.',
    'The robin knows you’re about to dig before you do.',
    'After the shortest day the light comes back, a minute or two at a time.',
    'Rhubarb under a bucket in February is the first harvest of the year, if you can wait.',
    'A cold greenhouse with a tray of onion seed in it is still a greenhouse with something growing.',
    'Hellebores flower in the worst of the weather and look as if they don’t mind at all.',
    'A list of what to grow, written by the fire, is the start of every good summer.',
  ),
  ...q(
    'spring',
    'Sow a little less than you think. Then sow again in three weeks.',
    'On the first warm afternoon everyone’s out with a fork. The soil wants another week.',
    'Seedlings on the windowsill lean towards the light. Turn the tray and they stand up straight.',
    'Nobody has ever regretted a row of sweet peas.',
    'Hardening off is a week of carrying trays out in the morning and back at night. Every trip is worth it.',
    'Wait until the soil feels warm to your hand before the beans go in.',
    'Blossom on the apple tree in April, apples in October. It still feels like a trick.',
    'A cold frame is a coat for the plants that came out too early.',
    'The weeds come up first because they’ve had more practice.',
    'Keep the fleece handy in May. The last frost likes a surprise.',
    'Label everything. In a month, every seedling looks like a tomato.',
    'A ball of string and a dibber in your pocket, and the morning’s gone.',
  ),
  ...q(
    'summer',
    'Water in the evening and the plants have all night to drink.',
    'Pick courgettes small and often, or turn your back and find a marrow.',
    'The best tomato is the one eaten warm, standing in the greenhouse.',
    'Sweet peas give more the more you pick them.',
    'A hoe on a dry morning does more than a weekend of weeding later.',
    'The bees know which plants you should have grown more of.',
    'Peas eaten straight from the pod never make it to the kitchen.',
    'Let a few herbs flower. The hoverflies they bring will see to the aphids.',
    'A full water butt in August is a kind of wealth.',
    'Long evenings are for walking round the garden with a cup of tea, doing nothing much.',
    'Strawberries picked first thing still taste of the morning.',
    'Some years it’s the beans. Some years it’s the slugs. Most years it’s both.',
  ),
  ...q(
    'autumn',
    'Leaves on the lawn are next year’s leaf mould. Bag them up and leave them be for a year.',
    'Bring the squash in before the frost and let them sit in the sun to harden their skins.',
    'Garlic goes in as the year winds down and comes up as if it’s already spring.',
    'A barrow of compost on an empty bed is the best thanks a garden gets.',
    'Write down what did well while you still remember. You won’t in March.',
    'Apples keep longest when nobody keeps checking on them.',
    'Plant bulbs on a grey afternoon and you’ve given April something to do.',
    'The garden goes quiet in autumn and gets on with things underground.',
    'Seed heads left standing feed the birds and look fine in a frost.',
    'Onions drying in the last of the sun smell of every stew to come.',
    'Sow green manure on a cleared bed and the soil does the work all winter.',
    'The first frost blackens the dahlias overnight. That’s your cue to lift them.',
  ),
  ...q(
    'any',
    'A garden is never finished, which is most of the point.',
    'Most of gardening is noticing.',
    'Grow what you like to eat. It sounds obvious until you’ve grown a row of kohlrabi.',
    'The soil remembers how it’s been treated.',
    'Ten minutes in the garden before work still counts.',
    'A crop that failed is a line in next year’s notebook.',
    'The plants are in no hurry. You needn’t be either.',
    'A small bed you look after beats a big one you don’t.',
    'Gardens are made by the people who keep turning up.',
    'That seed packet at the back of the drawer still has a summer in it.',
    'Grow one thing you’ve never tried. Someone has to find out.',
    'The best time to sow is usually a week later than you wanted to.',
  ),
];

const SEASON_OF_MONTH: QuoteSeason[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];

export const seasonOfMonth = (month: number): QuoteSeason => SEASON_OF_MONTH[(month - 1 + 12) % 12]!;

/** The lines that suit a month: its season's, and those for any time. */
export const quotesFor = (month: number): Quote[] => QUOTES.filter((x) => x.season === seasonOfMonth(month) || x.season === 'any');

/** A line for the loading screen, never the one shown last time. `random` is 0 to 1, for tests. */
export function pickQuote(month: number, last: string | null, random = Math.random()): Quote {
  const list = quotesFor(month);
  const fresh = list.filter((x) => x.text !== last);
  const from = fresh.length ? fresh : list;
  return from[Math.min(from.length - 1, Math.floor(random * from.length))]!;
}
