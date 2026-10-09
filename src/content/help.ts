// Help, in the app's own voice: short steps for the things people most often
// get stuck on, written for a phone and for a computer where they differ.
// Ranked by the risk of someone giving up: the first session (tier 1), then the
// first week (tier 2), then everything else (tier 3). See the build plan,
// release 19. Content only: the Help page and search show it.

import type { View } from '../theme/prefs';

/** One step: the same on every screen, or worded for a phone and for a computer. */
export type HelpStep = string | { phone: string; computer: string };

export interface HelpTopic {
  id: string;
  title: string;
  /** One line under the title: what it's for. */
  summary: string;
  /** The screen it's about, for "Take me there". */
  view: View;
  /** 1: the first session; 2: the first week; 3: going further. */
  tier: 1 | 2 | 3;
  steps: HelpStep[];
  /** A tip or two after the steps. */
  notes?: string[];
  related: string[];
  /** More words it can be found by in search. */
  words: string;
}

export const TIER_LABEL: Record<HelpTopic['tier'], string> = { 1: 'Getting started', 2: 'Week to week', 3: 'Going further' };

export const HELP: HelpTopic[] = [
  {
    id: 'setting-up',
    title: 'Setting up your garden',
    summary: 'Where it is, what you’re growing in, and a start on what to grow.',
    view: 'plan',
    tier: 1,
    steps: [
      'Type a postcode or town under “Where’s your garden?”. It times the sun, the frosts and the seasons, and nothing more exact is needed.',
      'Pick what you’re growing in: a balcony, a patio, a garden, an allotment or one bed. Give its rough size and it’s laid out for you.',
      'Choose a starter kit if one appeals, and tap a few favourites. They go on your list to grow, with sowing jobs when it’s time.',
      'Skipped it? On an empty plan, tap “Where are you growing?” to lay out a space at any time.',
    ],
    notes: ['Everything it lays out can be moved, resized or deleted afterwards. Change the place or the frost dates later under Your garden.'],
    related: ['drawing-the-plan', 'adding-plants'],
    words: 'start begin new first postcode location town where balcony patio allotment kit onboarding',
  },
  {
    id: 'drawing-the-plan',
    title: 'Drawing your garden',
    summary: 'Beds, pots, lawns, paths and the boundary, roughly or to the centimetre.',
    view: 'plan',
    tier: 1,
    steps: [
      {
        phone: 'Open the Garden tab. Along the bottom are Plants, Beds and pots, Ground, and Trees and structures.',
        computer: 'Open the Garden tab. Along the bottom of the plan are Plants, Beds and pots, Ground, and Trees and structures.',
      },
      {
        phone: 'Tap Beds and pots, then tap a raised bed or a pot. It appears in the middle of the plan.',
        computer: 'Open Beds and pots and drag a raised bed or a pot onto the plan, or click it to add it in the middle.',
      },
      'Do the same with Ground for a lawn, paving or a path, and with Trees and structures for a shed, a fence or a tree.',
      {
        phone: 'For exact shapes, switch to Advanced at the top and open Draw: tap Bed or Boundary, move the plan so the crosshair sits on each corner, and tap Add corner. Type length gives an exact edge.',
        computer: 'For exact shapes, switch to Advanced at the top and open Draw: pick Bed or Boundary, then drag a rectangle or click each corner. Type a length, such as 3.45m, and press Enter for an exact edge.',
      },
    ],
    notes: ['It needn’t be perfect. A rough plan still gives the right jobs and the right sun; you can tidy it any time.'],
    related: ['moving-and-resizing', 'tracing-a-photo', 'adding-plants'],
    words: 'draw add bed pot raised lawn path paving shed fence boundary edge outline shape corners exact measure size advanced simple',
  },
  {
    id: 'moving-and-resizing',
    title: 'Moving, resizing and deleting',
    summary: 'Picking things on the plan, and changing them.',
    view: 'plan',
    tier: 1,
    steps: [
      { phone: 'Tap a bed, pot or plant to pick it. A bar of actions appears beside it.', computer: 'Click a bed, pot or plant to pick it. A bar of actions appears beside it.' },
      'Drag it to move it. Plants in a bed move with the bed.',
      'Pull a corner (or the edge of something round) to resize it.',
      'The bin in its bar deletes it. Change your mind with Undo at the top.',
      {
        phone: 'Pinch to zoom, and drag an empty part of the plan to move around it.',
        computer: 'Scroll to zoom, drag an empty part of the plan to move around it, and press 0 to fit the whole garden.',
      },
    ],
    notes: ['If beds won’t move, the layout may be locked: tap the padlock at the top (Advanced) to unlock it. Plants can always be moved.'],
    related: ['drawing-the-plan', 'adding-plants'],
    words: 'move drag pick select resize bigger smaller delete remove bin rotate zoom pinch pan lock padlock stuck',
  },
  {
    id: 'tracing-a-photo',
    title: 'Tracing a photo of your garden',
    summary: 'Draw over a picture from above, such as an aerial photo or a drawing of your plot.',
    view: 'plan',
    tier: 1,
    steps: [
      {
        phone: 'With nothing picked, open the garden’s details from the ⋯ menu and find Trace a photo.',
        computer: 'With nothing picked, find Trace a photo in the panel beside the plan.',
      },
      'Choose a photo or screenshot taken from above. It stays on this device.',
      {
        phone: 'Tap Set scale, then tap two points on the photo you know the distance between, such as the ends of a fence, and type that distance.',
        computer: 'Click Set scale, then click two points on the photo you know the distance between, such as the ends of a fence, and type that distance.',
      },
      'Use Move photo to line it up, and the See-through slider so you can see your lines over it.',
      'Draw your beds, paths and boundary over the top.',
    ],
    notes: ['A photo from an upstairs window or a drone is never quite straight down, so treat it as a guide and check the main lengths with a tape.'],
    related: ['drawing-the-plan'],
    words: 'trace photo picture aerial satellite map screenshot scale calibrate background image',
  },
  {
    id: 'adding-plants',
    title: 'Adding plants',
    summary: 'Putting plants in beds, pots and the lawn.',
    view: 'plan',
    tier: 1,
    steps: [
      { phone: 'Open Plants along the bottom of the plan. “Sow or plant now” shows what suits this month; Find a plant searches them all.', computer: 'Open Plants along the bottom of the plan. “Sow or plant now” shows what suits this month; Find a plant searches them all.' },
      {
        phone: 'Tap a plant, then tap the bed, pot or patch of lawn it goes in.',
        computer: 'Drag a plant onto a bed, pot or patch of lawn. Or click it, then click where it goes.',
      },
      'It’s planted the usual way for that plant: carrots in a row, a courgette on its own, lettuce filling the bed. The other ways are offered beside it: One, A row, or Fill the bed.',
      'Tick “Already in the ground” for plants that are growing now rather than planned, so their jobs start from today.',
    ],
    notes: [
      'A plant can’t go on paving, decking or a path. If it won’t go in, drop it inside a bed’s outline, zoomed in a little for small pots.',
      'Pick a planting for its jobs, its stages and when it should be ready.',
    ],
    related: ['rows-and-blocks', 'plants-in-pots', 'moving-and-resizing'],
    words: 'add plant put grow drop tray library vegetables flowers fill row missing nowhere go goes won’t isn’t paving',
  },
  {
    id: 'rows-and-blocks',
    title: 'Rows and blocks',
    summary: 'Planting a row of carrots or a block of onions exactly where you want them.',
    view: 'plan',
    tier: 1,
    steps: [
      'Tap a plant in Plants. A bar appears with One, Row and Block, and Fill for me.',
      {
        phone: 'For a row, choose Row, tap where it starts, then tap the other end.',
        computer: 'For a row, choose Row, then click where it starts and click the other end, or drag along it.',
      },
      {
        phone: 'For a block, choose Block, tap one corner, then the opposite one.',
        computer: 'For a block, choose Block, then click one corner and the opposite one, or drag across it.',
      },
      'The plants are spaced for you. Pick the row afterwards to add or take away a plant, or to sow it in batches a few weeks apart.',
    ],
    notes: ['Spacing follows your choice under Your garden: close planting in beds, or traditional rows as on seed packets.'],
    related: ['adding-plants'],
    words: 'row block spacing line sow batches succession grid layout',
  },
  {
    id: 'plants-in-pots',
    title: 'Plants in pots',
    summary: 'Putting a plant in a pot, a window box or a planter.',
    view: 'plan',
    tier: 1,
    steps: [
      'Add a pot from Beds and pots, and drag it where it stands.',
      {
        phone: 'Zoom in until the pot is easy to see, tap a plant in Plants, then tap the pot.',
        computer: 'Drag a plant onto the pot. Zooming in a little makes small pots easier to hit.',
      },
      'More than one plant can share a pot: drop the next one in and it goes beside the first.',
      'Pick the pot to see how big it is and how much compost it holds. If it’s too small or too crowded for what’s in it, the plan says so.',
      'To move a plant to a bigger pot, pick the plant and open Pot on. Choose a new pot beside it, a bigger pot already on the plan, or a bed.',
    ],
    notes: [
      'A tomato or a chilli wants a pot about 30 cm across, and a fruit tree or bush about 45 cm. Small pots dry out fast.',
      'Trees such as an olive, a Japanese maple or a holly go in a pot as plants when you drop them on one. Trees that only grow in the ground, such as a birch, can’t go in a pot.',
    ],
    related: ['adding-plants', 'moving-and-resizing'],
    words: 'pot pots container planter window box trough balcony fig tree small missed go goes won’t isn’t stay bigger pot on potting repot crowded size litres',
  },
  {
    id: 'sowing',
    title: 'Sowing in Seedlings',
    summary: 'Seeds started indoors or under cover, before they go in the garden.',
    view: 'shed',
    tier: 2,
    steps: [
      'Open Seedlings and tap Sow seeds.',
      'Pick the plant. What to sow under cover this month comes first, then Later and Everything else. Narrow it with Vegetables, Herbs, Fruit and the rest, or search; seed in your tin is at the top. Weeds show only if you tick Show weeds.',
      'Pick the tray or pot, how many, and where it sits: a windowsill, a propagator or shelves.',
      'Each tray says when the seedlings should show, when to harden them off, and when they’re ready for the garden.',
      'When they’re ready, tap Plant out and then the bed they go in.',
    ],
    notes: ['Seeds sown straight into the ground outside don’t need Seedlings: add them to a bed on the plan instead.'],
    related: ['adding-plants'],
    words: 'sow seeds seedlings shed tray module propagator windowsill indoors under cover germinate harden off plant out',
  },
  {
    id: 'cardboard',
    title: 'Cardboard over weeds',
    summary: 'Clearing a weedy patch or a bit of lawn for a new bed, without digging.',
    view: 'plan',
    tier: 2,
    steps: [
      {
        phone: 'Open Ground along the bottom of the plan and tap Cardboard over weeds. Drag it where it goes and pull its corners to size.',
        computer: 'Open Ground along the bottom of the plan and drag Cardboard over weeds onto the patch. Pull its corners to size.',
      },
      'Outside, take off any tape and staples, lay the card two layers thick with the sheets overlapping, and wet it well.',
      'Cover it with a thick mulch of compost or well-rotted manure. You can plant into the mulch straight away.',
      'Once it’s down, pick the cardboard on the plan and tap Laid it today, or set the day you laid it. About six months on, a job reminds you to check it’s rotted down.',
    ],
    notes: ['Cardboard rots away and feeds the soil. Plastic weed membrane isn’t organic, and as it ages it breaks into tiny plastic fibres in the soil, so it isn’t offered here.'],
    related: ['drawing-the-plan', 'adding-plants'],
    words: 'cardboard weeds weed suppressant membrane fabric mulch no dig smother clear lawn new bed sheet',
  },
];

export const helpTopic = (id: string): HelpTopic | undefined => HELP.find((t) => t.id === id);

/** A step as worded for this screen. */
export const stepText = (s: HelpStep, phone: boolean): string => (typeof s === 'string' ? s : phone ? s.phone : s.computer);

/** Topics to show on the Help page, grouped by tier, in order. */
export function helpByTier(): { tier: HelpTopic['tier']; label: string; topics: HelpTopic[] }[] {
  return ([1, 2, 3] as const).map((tier) => ({ tier, label: TIER_LABEL[tier], topics: HELP.filter((t) => t.tier === tier) })).filter((g) => g.topics.length);
}
