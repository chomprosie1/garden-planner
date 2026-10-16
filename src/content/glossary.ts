// Garden words, explained: about fifty words gardeners use without thinking,
// each in two plain lines, for someone growing for the first time. In jobs,
// how-tos and plant pages, a word here is underlined and opens its lines; the
// whole list is in Help, and search finds them. Content and a pure function to
// find the words in a piece of text.

export interface GardenWord {
  id: string;
  /** As it's listed: "Hardening off". */
  term: string;
  /** Two plain lines. */
  text: string;
  /** How it's found in text, as regular expressions over whole words, most specific first. */
  forms: string[];
}

export const GLOSSARY: GardenWord[] = [
  { id: 'hardening-off', term: 'Hardening off', text: 'Getting plants raised indoors used to the cold, wind and sun outside. Put them out by day and bring them in at night for a week or two before they’re planted out.', forms: ['hardening (them )?off', 'harden(ed)? (them |it )?off'] },
  { id: 'under-cover', term: 'Under cover', text: 'Somewhere sheltered from the weather: a windowsill indoors, a greenhouse, a cold frame or a porch. Seeds sown under cover get a head start on the season.', forms: ['under cover', 'under glass'] },
  { id: 'module-tray', term: 'Module tray', text: 'A seed tray divided into small cells, one or two seeds to each. Each seedling grows its own block of roots, so it goes out with little upset.', forms: ['module trays?', 'modules?'] },
  { id: 'root-trainer', term: 'Root trainer', text: 'A deep, narrow pot that opens like a book, for plants with long roots, such as sweet peas and broad beans. Grooves inside keep the roots growing down, not round.', forms: ['root ?trainers?'] },
  { id: 'propagator', term: 'Propagator', text: 'A seed tray with a clear lid, sometimes heated, that keeps seeds warm and moist. Take the lid off once the seedlings are up, so they don’t rot.', forms: ['propagators?'] },
  { id: 'pinch-out', term: 'Pinching out', text: 'Nipping off a growing tip between finger and thumb. It makes a plant bush out, or, on tomatoes, stops side-shoots taking energy from the fruit.', forms: ['pinch(ing|ed)? (them |it )?out', 'pinch(ing)? off'] },
  { id: 'side-shoot', term: 'Side-shoot', text: 'A shoot that grows from where a leaf joins the main stem. On cordon tomatoes they’re pinched out while small; on most other plants they’re left.', forms: ['side-?shoots?'] },
  { id: 'truss', term: 'Truss', text: 'A cluster of flowers, and then fruit, on one stalk, as on a tomato. Tomato feeding starts once the first truss has set fruit.', forms: ['truss(es)?'] },
  { id: 'cordon', term: 'Cordon', text: 'A plant grown up a single stem, tied to a cane or string, with its side-shoots taken off. Most tall tomatoes are grown this way; apples can be too.', forms: ['cordons?'] },
  { id: 'plant-out', term: 'Planting out', text: 'Moving young plants from their pots or trays into the bed where they’ll grow. Tender ones wait until the frosts are over, after hardening off.', forms: ['plant(ing|ed)? (them |it )?out'] },
  { id: 'sets', term: 'Sets', text: 'Small onions or shallots grown the year before, planted instead of seed. They’re quicker and easier than seed: push them in with the tip just showing.', forms: ['(onion|shallot|autumn|spring) sets', 'planting sets', 'sets (of|with) (the|overwintering|hardy)'] },
  { id: 'cloves', term: 'Cloves', text: 'The segments a garlic bulb breaks into. Each one planted grows into a whole new bulb.', forms: ['garlic cloves?', 'single cloves?', 'cloves'] },
  { id: 'overwintering', term: 'Overwintering', text: 'Sown or planted in autumn to stand through the winter outside, for an early crop. Hardy kinds of broad bean, onion and garlic are grown like this.', forms: ['overwinter(ing|ed|s)?', 'stand the winter'] },
  { id: 'mulch', term: 'Mulch', text: 'A layer laid on the soil’s surface, such as compost, bark or well-rotted manure. It holds in moisture, keeps weeds down and, as it rots, feeds the soil.', forms: ['mulch(es|ing|ed)?'] },
  { id: 'well-rotted-manure', term: 'Well-rotted manure', text: 'Animal manure left in a heap for a year or so, until it’s dark and crumbly with no smell. Fresh manure is too strong and can burn plants.', forms: ['well-rotted manure', 'well-rotted'] },
  { id: 'green-manure', term: 'Green manure', text: 'A quick crop sown on bare soil, such as clover, rye or phacelia, and dug in or cut down before it flowers. It stops the soil washing away and feeds it.', forms: ['green manures?'] },
  { id: 'leaf-mould', term: 'Leaf mould', text: 'Fallen autumn leaves left in a bag or pen for a year or two until they rot to a crumbly brown. A free mulch and soil improver.', forms: ['leaf mould'] },
  { id: 'lift', term: 'Lifting', text: 'Digging a crop or plant up, out of the ground: potatoes, onions, or dahlia tubers to keep for next year. Use a fork from the side, so you don’t spear them.', forms: ['lift(ing|ed)?'] },
  { id: 'bare-root', term: 'Bare-root', text: 'Trees, roses, hedging and fruit bushes sold dormant in winter with no pot or soil. They’re cheaper, and planted between November and March.', forms: ['bare-?root'] },
  { id: 'fleece', term: 'Fleece', text: 'A thin, light white fabric laid over plants or pinned round them. It keeps off a few degrees of frost, and some pests, while letting light and rain through.', forms: ['horticultural fleece', 'fleece(d|s)?'] },
  { id: 'cold-frame', term: 'Cold frame', text: 'A low box with a clear lid, outside, unheated. It’s halfway between indoors and out: good for hardening off, and for sowing early.', forms: ['cold frames?'] },
  { id: 'blanch', term: 'Blanching', text: 'Keeping light off part of a plant so it grows pale, sweet and tender, such as the stems of leeks or celery, or chicory leaves. Earthing up is one way.', forms: ['blanch(ing|ed|es)?'] },
  { id: 'germinate', term: 'Germinating', text: 'A seed waking up and sending out its first root and shoot. Most need warmth and moisture; a few need light, or cold first.', forms: ['germinat(e|es|ed|ing|ion)'] },
  { id: 'staking', term: 'Staking', text: 'Giving a tall or top-heavy plant a cane or stake to be tied to, so wind and rain don’t knock it over. Put it in early, before the roots spread.', forms: ['stak(e|es|ed|ing)'] },
  { id: 'crop-family', term: 'Crop family', text: 'Vegetables related to one another, which share pests and diseases: peas and beans, the cabbage family, potatoes and tomatoes, onions, and roots. They move bed together each year.', forms: ['crop famil(y|ies)', 'brassicas?', 'legumes?'] },
  { id: 'rotation', term: 'Rotation', text: 'Growing each crop family in a different bed each year, round in turn. Pests and diseases in the soil don’t build up, and the soil isn’t worn out.', forms: ['crop rotation', 'rotation'] },
  { id: 'succession-sowing', term: 'Sowing in batches', text: 'Sowing a little every few weeks, rather than all at once, so there’s a steady supply instead of a glut. Good for salads, radishes and peas.', forms: ['succession sow(ing|n)?', 'sown in batches', 'in batches'] },
  { id: 'earthing-up', term: 'Earthing up', text: 'Drawing soil up round the stems of a plant into a ridge. It keeps light off potatoes, so they don’t go green, and steadies tall plants.', forms: ['earth(ing|ed)? (them |it )?up'] },
  { id: 'pricking-out', term: 'Pricking out', text: 'Moving seedlings from where they were sown thickly into pots or modules of their own, once they’re big enough to handle. Hold them by a leaf, never the stem.', forms: ['prick(ing|ed)? (them )?out'] },
  { id: 'potting-on', term: 'Potting on', text: 'Moving a young plant into a bigger pot when its roots fill the one it’s in. Water it first, and set it at the same depth.', forms: ['potting (them |it )?on', 'potted on', 'pot (them|it) on'] },
  { id: 'chit', term: 'Chitting', text: 'Standing seed potatoes in a cool, light place for a few weeks before planting, so they grow short, sturdy shoots. Egg boxes are ideal.', forms: ['chit(s|ted|ting)?'] },
  { id: 'thin-out', term: 'Thinning out', text: 'Pulling out some seedlings where they’ve come up too close, so the rest have room to grow. Do it when the soil’s moist, and firm round the ones left.', forms: ['thin(ning|ned)? (them )?(out|to)'] },
  { id: 'bolting', term: 'Bolting', text: 'A plant running to flower and seed too soon, often in heat or dry soil, which spoils leaves and roots. Lettuce, spinach and beetroot are prone to it.', forms: ['bolt(s|ing|ed)?'] },
  { id: 'blood-fish-bone', term: 'Blood, fish and bone', text: 'A general feed made from animal by-products, sprinkled on the soil and raked in before planting. It feeds slowly, over a few weeks.', forms: ['blood,? fish,? and bone'] },
  { id: 'bonemeal', term: 'Bonemeal', text: 'Ground bones: a slow feed rich in phosphorus, which helps roots grow. A small handful goes in the hole when planting bulbs, trees and shrubs.', forms: ['bone ?meal'] },
  { id: 'variety', term: 'Variety', text: 'A named kind of a plant, bred for something: earliness, flavour, size or hardiness. Aquadulce is a variety of broad bean, hardy enough to sow in autumn.', forms: ['variet(y|ies)', 'cultivars?'] },
  { id: 'hardy', term: 'Hardy', text: 'Able to stay outside through a UK winter, frost and all. Half-hardy plants take a little cold; tender ones are killed by frost.', forms: ['fully hardy', 'hardy'] },
  { id: 'tender', term: 'Tender', text: 'Killed or badly hurt by frost, such as tomatoes, courgettes, runner and French beans, and dahlias (broad beans are hardy). They go out after the last frost and come in, or are lifted, before the first.', forms: ['half-hardy', 'frost-tender', 'tender (plants?|crops?|ones|kinds?|annuals?|perennials?|seedlings)'] },
  { id: 'drill', term: 'Drill', text: 'A shallow, straight groove drawn in the soil to sow seeds in, with a cane, a hoe or the edge of a trowel. Its depth is the sowing depth.', forms: ['drills?'] },
  { id: 'tilth', term: 'Fine tilth', text: 'Soil raked until the top is fine and crumbly, with no big lumps or stones. Small seeds sown outside need it to come up well.', forms: ['fine tilth', 'tilth'] },
  { id: 'deadhead', term: 'Deadheading', text: 'Snipping off flowers as they fade. The plant puts its energy into more flowers instead of seed, so it flowers for longer.', forms: ['dead-?head(ing|ed|s)?'] },
  { id: 'seedbed', term: 'Seedbed', text: 'A patch of fine soil where seeds are sown close together, to be moved to their final places once they’re big enough. Leeks and cabbages are often started this way.', forms: ['seed ?beds?'] },
  { id: 'seed-compost', term: 'Seed compost', text: 'A fine, low-feed compost for sowing in trays and pots, light enough for small roots. Seeds have their own food, and rich compost can scorch them.', forms: ['seed compost'] },
  { id: 'multi-purpose', term: 'Multi-purpose compost', text: 'The everyday compost sold in bags at garden centres, for pots, potting on and most sowing. Peat-free kinds are the better choice now.', forms: ['multi-?purpose( compost)?'] },
  { id: 'rose', term: 'Rose (on a watering can)', text: 'The sprinkler head on a watering can’s spout, which breaks the water into a gentle shower. A fine rose won’t wash seeds or seedlings out of the soil.', forms: ['(with a|fine) rose'] },
  { id: 'dibber', term: 'Dibber', text: 'A short, pointed stick for making holes to sow big seeds, or to drop in cloves and leeks. A pencil or the handle of a trowel does as well.', forms: ['dibbers?'] },
  { id: 'hoe', term: 'Hoe', text: 'A long-handled tool with a flat blade, pushed just under the surface to cut off young weeds. Done on a dry day, the weeds wither where they lie.', forms: ['hoe(s|ing|d)?'] },
  { id: 'hand-fork', term: 'Hand fork', text: 'A small fork with three or four prongs, held in one hand, for loosening soil and digging out weeds with deep roots. It goes where a hoe can’t, close round plants.', forms: ['hand forks?'] },
  { id: 'free-draining', term: 'Free-draining', text: 'Soil that water soaks through quickly, rather than standing in puddles, such as sandy or gritty soil. Herbs like rosemary and thyme need it, and many bulbs rot without it.', forms: ['free-?draining', 'well-?drained'] },
  { id: 'fertile', term: 'Fertile', text: 'Soil rich in food and life, usually from years of compost and manure, dark and crumbly. Hungry crops such as squash and potatoes do best in it.', forms: ['fertile'] },
  { id: 'crowns', term: 'Crowns', text: 'The point where a plant’s stems meet its roots, at soil level, where new growth comes from. Strawberries, rhubarb and asparagus are planted with the crown just at the surface.', forms: ['crowns?'] },
  { id: 'cloche', term: 'Cloche', text: 'A small, low cover of glass or clear plastic set over plants in the ground, to keep off cold, wind and pests. It’s a cold frame you can move about.', forms: ['cloches?'] },
  { id: 'chicken-manure', term: 'Chicken manure pellets', text: 'Dried chicken manure pressed into pellets, a strong, quick feed rich in nitrogen. Scatter a handful a square metre in spring, and keep it off leaves.', forms: ['(chicken|poultry) manure( pellets)?'] },
  { id: 'ornamental-allium', term: 'Ornamental allium', text: 'An onion relative grown for its round heads of purple or white flowers in early summer, not to eat. Bees love them, and the bulbs go in in autumn.', forms: ['ornamental alliums?'] },
];

const compiled = GLOSSARY.map((w) => ({ word: w, re: new RegExp(`\\b(?:${w.forms.join('|')})\\b`, 'gi') }));

/** A piece of text, with the garden words in it picked out. */
export type Glossed = { text: string; word?: GardenWord }[];

/**
 * Text split into plain runs and garden words. Each word is picked out the first time it comes, and a longer match wins
 * where two overlap ("onion sets" over "sets").
 */
export function glossed(text: string): Glossed {
  const found: { from: number; to: number; word: GardenWord }[] = [];
  for (const { word, re } of compiled) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) found.push({ from: m.index, to: m.index + m[0].length, word });
  }
  found.sort((a, b) => a.from - b.from || b.to - a.to);
  const out: Glossed = [];
  let at = 0;
  for (const f of found) {
    if (f.from < at) continue;
    if (f.from > at) out.push({ text: text.slice(at, f.from) });
    out.push({ text: text.slice(f.from, f.to), word: f.word });
    at = f.to;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

export const gardenWord = (id: string): GardenWord | undefined => GLOSSARY.find((w) => w.id === id);
