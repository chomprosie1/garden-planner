// How to do a job: what you need, three or four steps, and about how long it
// takes, for someone who has never done it. By the kind of job and what goes
// in (seed, cloves, sets, seed potatoes, bulbs or plants), and given the
// plant, by how it's actually sown (big seeds one at a time, a cold frame with
// no heat) and what's picked (roots lifted, pods picked, heads cut, herbs
// snipped). The plant's own advice (depth, feed) comes with the job,
// underneath, and its spacing with the steps. Content and a pure function.

import type { Job } from '../calendar/jobs';
import type { Plant, SpacingStyle } from '../model/types';
import { sowingFor, spacingText, type StartsAs } from '../planting/windows';

export interface HowTo {
  need: string[];
  steps: string[];
  /** "About 15 minutes a row". */
  time: string;
  /** "20 cm apart, in rows 60 cm apart": for sowing and planting, given the plant. */
  spacing?: string;
}

/** The plant and garden a job is for, when known: the how-to fits them. */
export interface HowToFor {
  plant: Plant;
  month: number;
  style: SpacingStyle;
}

/** Seeds this deep or deeper are big ones (beans, peas, sweet peas, squash): sown one at a time, not thinly. */
const BIG_SEED_MM = 25;

const SOW_ONE_BY_ONE: HowTo = {
  need: ['The seed', 'A rake', 'A dibber or trowel', 'A watering can with a rose (the sprinkler head)'],
  steps: [
    'Pull out any weeds, then rake the soil level and crumbly.',
    'Make a hole for each seed with a dibber, as deep as it says below and at the spacing below.',
    'Drop one seed in each hole, fill it with soil and firm it gently.',
    'Water them in and label the row. Mice and birds like big seeds: a net or a few holly leaves over them helps.',
  ],
  time: 'About 15 minutes a row',
};

const SOW_IN_COLD_FRAME: HowTo = {
  need: ['The seed', 'Root trainers, deep pots or a module tray', 'Seed or multi-purpose compost', 'A label', 'Your cold frame'],
  steps: [
    'Fill the root trainers or pots with compost, and firm it down gently.',
    'Sow one seed to each cell or pot, as deep as it says below, and cover it.',
    'Water them, label them, and set them in the cold frame. No heat: they want it cold, not warm.',
    'Keep the lid open by day, and closed only when a hard frost is due. Keep mice out: they dig up big seeds.',
  ],
  time: 'About 15 minutes a tray',
};

const LIFT_ROOTS: HowTo = {
  need: ['A garden fork', 'A bucket or trug'],
  steps: [
    'Push the fork in beside the row, well away from the roots, and lever the soil to loosen it.',
    'Ease out what you need by the leaves; leave the rest in the ground, where they keep.',
    'Shake off the soil. Lift a few on a mild day if the ground might freeze.',
    'Tap Picked some? to note how much, for your harvest.',
  ],
  time: 'About 10 minutes',
};

const PICK_PODS: HowTo = {
  need: ['A basket', 'Two hands: one to hold the stem'],
  steps: [
    'Pick the pods while they’re young and plump, before the beans or peas inside get tough.',
    'Hold the stem with one hand and snap or pinch the pod off with the other, so the plant isn’t torn.',
    'Pick every few days: the more you pick, the more come.',
    'Tap Picked some? to note how much, for your harvest.',
  ],
  time: 'About 10 minutes',
};

const CUT_HEADS: HowTo = {
  need: ['A sharp knife', 'A basket'],
  steps: [
    'Cut the head when it’s firm and full, before it opens out or splits.',
    'Cut through the stem just below the head, leaving the stalk and lower leaves.',
    'Some, such as broccoli and cabbage, send up smaller heads or shoots afterwards: leave the stalk for them.',
    'Tap Picked some? to note how much, for your harvest.',
  ],
  time: 'About 5 minutes',
};

const SNIP_HERBS: HowTo = {
  need: ['Scissors or snips'],
  steps: [
    'Snip sprigs from the tips, never more than a third of the plant at once.',
    'Cut just above a pair of leaves, and new shoots grow from there.',
    'Pick little and often; it keeps the plant bushy.',
  ],
  time: 'A minute or two',
};

const PICK_FRUIT: HowTo = {
  need: ['A shallow basket or tray, so the fruit isn’t squashed'],
  steps: [
    'Pick fruit when it’s fully coloured and comes away with a gentle pull.',
    'Pick in the dry, every few days while it’s ripening, before the birds do.',
    'Handle it gently and keep it cool: soft fruit keeps a day or two.',
    'Tap Picked some? to note how much, for your harvest.',
  ],
  time: 'About 10 minutes',
};

const SOW_OUTSIDE: HowTo = {
  need: ['The seed', 'A rake', 'A cane or the edge of a trowel', 'A watering can with a rose (the sprinkler head)'],
  steps: [
    'Pull out any weeds, then rake the soil until the top is fine and crumbly, with no big lumps.',
    'Draw a drill along the row with a cane, as deep as it says below.',
    'Sow the seeds thinly along it, cover them with soil, and pat it down with the back of the rake.',
    'Water gently, put a label at the end of the row, and keep the soil moist until they come up.',
  ],
  time: 'About 15 minutes a row',
};

const SOW_UNDER_COVER: HowTo = {
  need: ['The seed', 'A seed tray, small pots or a module tray', 'Seed compost', 'A label', 'A light windowsill, or a propagator'],
  steps: [
    'Fill the tray or pots with seed compost, level it, and firm it down gently.',
    'Sow thinly, or two seeds to each module, and cover them as deep as it says below with more compost.',
    'Water from below, by standing the tray in water for a few minutes, or with a fine rose. Label it.',
    'Keep it warm and in good light, and the compost just moist. Mark it as sown in the Shed, so you’re told when to expect seedlings.',
  ],
  time: 'About 10 minutes a tray',
};

const CLOVES: HowTo = {
  need: ['Garlic bulbs from a garden centre, not the supermarket', 'A trowel or a dibber'],
  steps: [
    'Weed the bed and loosen the soil with a fork.',
    'Break the bulbs into single cloves, keeping the papery skins on.',
    'Push each clove in, pointed end up, so its tip is about 2.5 cm below the surface, at the spacing below.',
    'Firm the soil over them. Pull out weeds as they come; garlic hates competing.',
  ],
  time: 'About 15 minutes a row',
};

const SETS: HowTo = {
  need: ['Onion or shallot sets', 'A trowel, or just your fingers'],
  steps: [
    'Weed the bed and rake the soil level.',
    'Push each set gently into the soil, at the spacing below, so just its tip shows.',
    'Firm the soil round them so birds can’t pull them out. A net or fleece over them for a few weeks helps.',
    'Weed by hand as they grow: their roots are shallow.',
  ],
  time: 'About 10 minutes a row',
};

const SEED_POTATOES: HowTo = {
  need: ['Seed potatoes, chitted if you can', 'A spade or trowel'],
  steps: [
    'Dig a trench or holes about 12 cm deep, at the spacing below.',
    'Set each potato in with its shoots pointing up.',
    'Cover them with soil and rake it level.',
    'As the shoots come up, earth them up: draw soil over them to keep off frost and light.',
  ],
  time: 'About 20 minutes a row',
};

const BULBS: HowTo = {
  need: ['The bulbs', 'A trowel or a bulb planter'],
  steps: [
    'Dig a hole about three times as deep as the bulb is tall.',
    'Set the bulb in, pointed end up, with a little bonemeal in the hole if you have some.',
    'Fill the hole and firm the soil. In a pot, set them close but not touching.',
    'Water them in, then leave them be: they come up in spring.',
  ],
  time: 'About 15 minutes for twenty bulbs',
};

const PLANT_OUT: HowTo = {
  need: ['The young plants', 'A trowel', 'A watering can'],
  steps: [
    'Water the plants an hour before, so they slide out of their pots without tearing the roots.',
    'Dig a hole a little bigger than the roots, at the spacing below.',
    'Ease each plant out, holding it by a leaf, not the stem, and set it in at the depth it was growing. Firm the soil round it.',
    'Water them in well, and look out for slugs for the first few nights.',
  ],
  time: 'About 15 minutes a row',
};

const PLANTS: HowTo = {
  need: ['The plant', 'A spade or trowel', 'A watering can'],
  steps: [
    'Water the plant in its pot first.',
    'Dig a hole as deep as the pot and about twice as wide, and loosen the soil at the bottom.',
    'Set the plant in at the depth it was in its pot, fill round it, and firm the soil with your hands.',
    'Water it in well, and keep it watered in dry spells while it settles.',
  ],
  time: 'About 10 minutes a plant',
};

const BY_KIND: Record<Exclude<Job['kind'], 'sow-direct' | 'sow-indoors' | 'plant-out'>, HowTo> = {
  water: {
    need: ['A watering can or hose'],
    steps: [
      'Water in the early morning or the evening, when less is lost to the sun.',
      'Water the soil round the base, not the leaves.',
      'Give each plant a good soak, rather than a little often: the water should go deep.',
      'Water pots until it runs out of the bottom.',
    ],
    time: 'About 10 minutes',
  },
  check: {
    need: ['Nothing but a look'],
    steps: ['Go and look at the plants.', 'If they’ve reached the stage it says, tick it.', 'If not yet, leave it: it stays on the list.'],
    time: 'A minute or two',
  },
  feed: {
    need: ['The feed it says below', 'A watering can for a liquid feed, or gloves for a granular one'],
    steps: [
      'If the soil is dry, water first: feed on dry roots can scorch them.',
      'A liquid feed: dilute it as the bottle says, and pour it round the base.',
      'A granular feed: sprinkle the amount it says below round the plants, and rake or water it in.',
      'Wash your hands afterwards.',
    ],
    time: 'About 10 minutes',
  },
  harvest: {
    need: ['A basket', 'Scissors or a sharp knife'],
    steps: [
      'Pick in the morning, while it’s cool, when crops are crispest.',
      'Take what’s ready, the biggest or ripest first.',
      'With most crops, picking often keeps more coming.',
      'Tap Picked some? to note how much, for your harvest.',
    ],
    time: 'About 10 minutes',
  },
  protect: {
    need: ['Fleece and pegs or stones, or a cloche', 'Or somewhere frost-free to move pots to'],
    steps: [
      'On an afternoon before a frost, cover the plants with fleece, pinned down at the edges.',
      'Move pots of tender plants into a greenhouse, porch or shed, or against the house wall.',
      'Take the fleece off on mild days, so the plants get light and air.',
    ],
    time: 'About 15 minutes',
  },
  lift: {
    need: ['A garden fork', 'A box, tray or paper sack'],
    steps: [
      'Choose a dry day.',
      'Push the fork in well away from the plant, from the side, and lever it up gently so you don’t spear the crop.',
      'Shake off the soil and let them dry for a few hours, or a week or two for onions.',
      'Store them somewhere cool, dark and frost-free.',
    ],
    time: 'About 20 minutes',
  },
  tidy: {
    need: ['Secateurs', 'A compost bin or heap'],
    steps: [
      'Pull up the finished plants, roots and all.',
      'Chop them up and put them on the compost, unless they were diseased.',
      'Weed and rake the bed.',
      'Cover the bare soil with a mulch, or sow a green manure, until the next crop.',
    ],
    time: 'About 20 minutes a bed',
  },
  weed: {
    need: ['A hoe', 'A hand fork', 'A bucket'],
    steps: [
      'On a dry day, run the hoe just under the surface between plants: small weeds wither in the sun.',
      'Dig out weeds with deep roots with the hand fork, getting all of the root.',
      'Weeds in flower or seed, and spreading roots, go in the bin, not the compost.',
    ],
    time: 'About 20 minutes a bed',
  },
};

/**
 * What a job takes, and how: by its kind, and for sowing and planting, what goes in (from startsAs) and whether it's a
 * bulb. Given the plant: by how this sowing is done and what's picked, with its spacing.
 */
export function howTo(job: Job, from: StartsAs, bulb = false, at?: HowToFor): HowTo {
  const how = chosen(job, from, bulb, at);
  const spaced = at && (job.kind === 'sow-direct' || job.kind === 'plant-out') && !bulb;
  return spaced ? { ...how, spacing: spacingText(at.plant, at.style) } : how;
}

function chosen(job: Job, from: StartsAs, bulb: boolean, at?: HowToFor): HowTo {
  const plant = at?.plant;
  switch (job.kind) {
    case 'sow-direct': {
      if (from === 'cloves') return CLOVES;
      if (from === 'sets') return SETS;
      if (from === 'tubers') return SEED_POTATOES;
      const sowing = plant ? sowingFor(plant, true, at!.month) : null;
      return (sowing?.depthMm ?? 0) >= BIG_SEED_MM ? SOW_ONE_BY_ONE : SOW_OUTSIDE;
    }
    case 'sow-indoors': {
      const sowing = plant ? sowingFor(plant, false, at!.month) : null;
      if (sowing?.method === 'cold-frame') return SOW_IN_COLD_FRAME;
      // Big seeds one to a pot or cell, not sown thinly.
      if ((sowing?.depthMm ?? 0) >= BIG_SEED_MM) return { ...SOW_UNDER_COVER, steps: SOW_UNDER_COVER.steps.map((x, i) => (i === 1 ? 'Sow one seed to each pot or module, as deep as it says below, and cover it with more compost.' : x)) };
      return SOW_UNDER_COVER;
    }
    case 'plant-out':
      // Planted, not planted out: bulbs, and plants bought in pots.
      if (job.verb === 'Plant') return bulb ? BULBS : PLANTS;
      return PLANT_OUT;
    case 'harvest': {
      if (!plant) return BY_KIND.harvest;
      const kind = plant.art?.crop?.kind;
      if (kind === 'root') return LIFT_ROOTS;
      if (plant.category === 'herb') return SNIP_HERBS;
      if (kind === 'pod') return PICK_PODS;
      if (kind === 'head') return CUT_HEADS;
      if (kind === 'fruit' || plant.category === 'fruit') return PICK_FRUIT;
      return BY_KIND.harvest;
    }
    default:
      return BY_KIND[job.kind];
  }
}
