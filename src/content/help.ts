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
    id: 'list',
    title: 'Keeping it as a list',
    summary: 'Your beds and pots, with the plants in each, and no plan to draw.',
    view: 'plan',
    tier: 1,
    steps: [
      'When you set up, choose Just a list of my beds. To change later, open Settings and choose under How you keep track.',
      'On the Garden tab, choose Add a bed: say what it is (a bed, a pot, a greenhouse, a patch of ground), give it a name, and if you like its rough size and how sunny it is.',
      'Choose Add a plant on a bed, pick the plant, and say how many: one, a row, fill the bed, or a number.',
      'Pick a plant to say what’s happened, see its stages, feeding and notes, or move it to another bed. Choose a bed’s picture for its history and soil.',
    ],
    notes: [
      'Each bed shows how full it is. Its picture shows its plants as they look this week, and each plant’s bar shows its year: seed, leaf, flowers and picking, with today marked.',
      'Everything else is the same as with a plan: the month’s jobs, reminders, the seed tin, the harvest and next year’s draft. Switch to a plan whenever you like: your beds are set out neatly, ready to arrange.',
    ],
    related: ['setting-up', 'adding-plants'],
    words: 'list simple simpler no plan without drawing beds pots easy plain basic just track keep',
  },
  {
    id: 'setting-up',
    title: 'Setting up your garden',
    summary: 'Where it is, what you’re growing in, and a start on what to grow.',
    view: 'plan',
    tier: 1,
    steps: [
      'Type a postcode or town under “Where’s your garden?”. It times the sun, the frosts and the seasons, and nothing more exact is needed.',
      'Pick what you’re growing in: a balcony, a patio, a garden, an allotment or one bed. Give its rough size and it’s laid out for you.',
      'The kit that can go in soonest is chosen for you; pick another, or Just the space. Choose a few favourites too: they go on your list to grow, with sowing jobs when it’s time.',
      'Choose Start growing, and the plan opens with your first job’s plants picked out.',
      'Skipped it? On an empty plan, choose “Where are you growing?” to lay out a space at any time.',
    ],
    notes: [
      'Everything it lays out can be moved, resized or deleted afterwards. Change the place or the frost dates later in Settings.',
      'The kits that can go in soonest come first: in autumn, garlic, broad beans, onion sets and spring bulbs.',
      'Your garden is kept in this browser. Keep a copy under Settings → Backups; on a phone, Save or share a copy puts it in Files or sends it to you.',
    ],
    related: ['drawing-the-plan', 'adding-plants', 'backups'],
    words: 'start begin new first postcode location town where balcony patio allotment kit onboarding autumn',
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
        phone: 'For exact shapes, choose Advanced tools in the ··· menu and open Draw: tap Bed or Boundary, move the plan so the crosshair sits on each corner, and tap Add corner. Type length gives an exact edge.',
        computer: 'For exact shapes, choose Advanced tools in the ··· menu and open Draw: pick Bed or Boundary, then drag a rectangle or click each corner. Type a length, such as 3.45m, and press Enter for an exact edge.',
      },
    ],
    notes: [
      'It needn’t be perfect. A rough plan still gives the right jobs and the right sun; you can tidy it any time.',
      'Trees and structures has the house and the everyday things: a water butt, a gate, a bench, a table, bins, a washing line, a bird bath and more. Steps are under Ground.',
      'Garden not a rectangle? Pick the boundary and drag its corners, in Simple too. A garden or patio set up with a side return starts as an L.',
      'A tall tree or house next door shading your garden? Add Next door’s tree or Next door’s house from Trees and structures and drag it to where it stands, over the boundary. It’s drawn faintly and casts its shade into your garden.',
    ],
    related: ['moving-and-resizing', 'tracing-a-photo', 'adding-plants', 'climbers'],
    words: 'draw add bed pot raised lawn path paving shed fence boundary edge outline shape corners exact measure size advanced simple house water butt bench bins washing line gate side return L-shaped next door neighbour neighbours tree shade overhanging',
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
    notes: [
      'If beds won’t move, the layout may be locked: use the padlock at the top (Advanced) to unlock it. Plants can always be moved.',
      'Ground (a lawn, patio, gravel and the like) is set once it’s placed, so the beds and plants on it are easy to pick. To move or reshape it, pick it where nothing’s on top and choose Unlock, then Set this ground when you’re done.',
      'For an exact size, pick it and choose a length shown along its side, then type the length, such as 2.4 m. Measure, in the ⋯ menu, gives the distance between any two points.',
    ],
    related: ['drawing-the-plan', 'adding-plants'],
    words: 'move drag pick select resize bigger smaller delete remove bin rotate zoom pinch pan lock padlock unlock stuck ground lawn patio gravel set length exact type measure tape distance how far',
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
    notes: [
      'A photo from an upstairs window or a drone is never quite straight down. Straighten it… (under Trace a photo) fixes that: mark the four corners of something rectangular you can measure, such as the patio, give its width and depth, and it’s redrawn as if from above, to scale.',
      'Check the main lengths with a tape all the same.',
    ],
    related: ['drawing-the-plan'],
    words: 'trace photo picture aerial satellite map screenshot scale calibrate background image straighten angle window squeezed',
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
      'Tick “Already in the ground” for plants that are growing now rather than planned, say which month they went in, and how far on they are now (sown, up, growing, flowering or harvesting), so their jobs and next year’s plan go from there. Fruit and shrubs planted years ago follow their usual year.',
    ],
    notes: [
      'A plant can’t go on paving, decking or a path. If it won’t go in, drop it inside a bed’s outline, zoomed in a little for small pots.',
      'Pick a planting for its jobs, its stages and when it should be ready.',
      'New to it? “Easy to start” shows the crops and herbs the RHS calls easy, such as radishes, peas, potatoes and courgettes. The plants most people grow come first in the plant lists.',
      'About 150 of the most-grown plants are in the lists. The rest are under More plants (still being checked), at the foot: their details are checked after these. A search finds them all.',
    ],
    related: ['rows-and-blocks', 'plants-in-pots', 'moving-and-resizing'],
    words: 'add plant put grow drop tray library vegetables flowers fill row missing nowhere go goes won’t isn’t paving easy beginner first more plants checked checking unusual rare',
  },
  {
    id: 'rows-and-blocks',
    title: 'Rows and blocks',
    summary: 'Planting a row of carrots or a block of onions exactly where you want them.',
    view: 'plan',
    tier: 1,
    steps: [
      'Pick a plant in Plants. A bar appears with One, Row and Block, and Fill for me.',
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
    notes: ['Spacing follows your choice in Settings: close planting in beds, or traditional rows as on seed packets.'],
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
    title: 'Sowing in the Shed',
    summary: 'Seeds started indoors or under cover, before they go in the garden.',
    view: 'shed',
    tier: 2,
    steps: [
      'Open the Shed and choose Sow seeds.',
      'Pick the plant. What to sow under cover this month comes first, then Later and Everything else. Narrow it with Vegetables, Herbs, Fruit and the rest, or search; seed in your tin is at the top. Weeds show only if you tick Show weeds.',
      'If it’s already planned for a bed, For picks that bed: the planting is marked as sown and its sowing job ticked, and it waits under Sown for the plan. Choose Just a tray for a tray of its own.',
      'Pick the tray or pot, how many, and where it sits: a windowsill, a propagator, shelves, or a greenhouse or cold frame on your plan. Beans and sweet peas start in root trainers.',
      'Each tray says when the seedlings should show, when to harden them off, and when they’re ready for the garden.',
      'When they’re ready, choose Plant out and then the bed they go in.',
    ],
    notes: ['Seeds sown straight into the ground outside don’t need the Shed: add them to a bed on the plan instead.'],
    related: ['adding-plants'],
    words: 'sow seeds seedlings shed tray module propagator windowsill indoors under cover germinate harden off plant out',
  },
  {
    id: 'this-week',
    title: 'This week’s jobs',
    summary: 'What Today asks you to do, how to do it, and ticking it off.',
    view: 'home',
    tier: 2,
    steps: [
      'Today starts with your jobs. Now is what’s due, or due this week. Later this month can wait. To look out for is what’s likely to happen anyway, such as seedlings coming up.',
      'Choose a job to see how to do it: what you need, the steps, and about how long it takes. Choose Done when you have. Something that can be sown two ways, such as broad beans outside or in a cold frame, is one job: choose the way you did it.',
      'Or tick its box, or swipe it to the right. Ticking a sowing or planting job dates the plants, so the jobs that follow are timed from then.',
      'A word with a dotted line under it, such as hardening off, opens what it means.',
    ],
    notes: ['Every job for the month, and the general ones for your garden, are under All … jobs at the foot of the list. Ticked something by mistake? Tick it again, or Undo.'],
    related: ['harvest', 'feeding', 'words'],
    words: 'jobs today this week tasks to do tick done how to now later month what does it mean',
  },
  {
    id: 'harvest',
    title: 'Recording a harvest',
    summary: 'Noting what you pick, for your season’s totals and next year’s draft.',
    view: 'home',
    tier: 2,
    steps: [
      'When a crop is ready, Today has a Ready to pick job for it.',
      'Choose Picked some? under the job, then A handful, A bowl or A basket. That’s it.',
      'To weigh it instead, or to note a picking another day, pick the plant in your garden, open What’s happened?, choose the picking and type the grams.',
      'Your totals show on Today as Picked this year, and crops you picked from are marked Did well in next year’s draft.',
    ],
    notes: ['Rough is fine: a handful of beans or a bowl of tomatoes is enough to see what did well.'],
    related: ['this-week', 'next-year'],
    words: 'harvest pick picked picking record log weigh weight grams crop yield total how much',
  },
  {
    id: 'feeding',
    title: 'Feeding',
    summary: 'When plants want feeding, with what, and your feed shelf.',
    view: 'shed',
    tier: 2,
    steps: [
      'A Feed job comes when a plant wants feeding, from its own notes: which feed, and about how much.',
      'Before planting, a job says what to dig in first, such as a handful of blood, fish and bone a square metre.',
      'In the Shed, open Feed shelf and tick the feeds you have. Jobs then say when one of yours will do instead, and when you’re out of one.',
      'Feeding reminders can be turned off in Settings, under Reminders.',
    ],
    notes: ['Most vegetables in good soil need little more than compost dug in each year. Hungry crops, such as tomatoes and anything in a pot, need feeding most.'],
    related: ['this-week', 'shopping'],
    words: 'feed feeding fertiliser fertilizer tomato feed liquid granular blood fish bone bonemeal seaweed manure compost hungry shelf',
  },
  {
    id: 'cardboard-list',
    title: 'Cardboard over weeds, in a list',
    summary: 'Clearing a weedy patch for a new bed, without digging, when you keep a list.',
    view: 'plan',
    tier: 2,
    steps: [
      'On the Garden tab, choose Add a bed, then Cardboard over weeds. Give it a name, such as New bed, and its rough size.',
      'Outside, take off any tape and staples, lay the card two layers thick with the sheets overlapping, and wet it well.',
      'Cover it with a thick mulch of compost or well-rotted manure. You can plant into the mulch straight away: choose Add a plant on its card.',
      'Choose its picture, then Laid it today, or set the day you laid it. About six months on, a job reminds you to check it’s rotted down.',
    ],
    notes: ['Cardboard rots away and feeds the soil. Plastic weed membrane breaks into tiny fibres in the soil as it ages, so it isn’t offered here.'],
    related: ['cardboard', 'list'],
    words: 'cardboard weeds list no dig smother clear lawn new bed mulch',
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
      'Once it’s down, pick the cardboard on the plan and choose Laid it today, or set the day you laid it. About six months on, a job reminds you to check it’s rotted down.',
    ],
    notes: ['Cardboard rots away and feeds the soil. Plastic weed membrane isn’t organic, and as it ages it breaks into tiny plastic fibres in the soil, so it isn’t offered here.'],
    related: ['drawing-the-plan', 'adding-plants'],
    words: 'cardboard weeds weed suppressant membrane fabric mulch no dig smother clear lawn new bed sheet',
  },
  {
    id: 'climbers',
    title: 'Climbers along a fence',
    summary: 'Clematis, roses, sweet peas or trained fruit along a fence, wall or hedge, or up an arch or obelisk.',
    view: 'plan',
    tier: 2,
    steps: [
      'Pick a fence, wall or hedge on the plan and choose Plant. The plants open on Climbers: ones that come back each year first, then fruit you can train flat, then sweet peas and beans.',
      {
        phone: 'Tap a climber, then tap just beside the fence, on the side it should grow.',
        computer: 'Drag a climber to just beside the fence, on the side it should grow. Or click it, then click there.',
      },
      'It’s planted just off the fence and drawn trained along it. For a row along that stretch, such as sweet peas or beans, choose A row in the choices beside it.',
      'No fence drawn yet? Drop a climber just inside the boundary and a fence goes up along that side for it. Pick the fence to make it a wall or hedge, or change its height.',
      'For an arch, an obelisk or a trellis panel, add one from Trees and structures, then drop a climber on it. Each holds one climber.',
    ],
    notes: [
      'A clematis, a rose or fruit to train, dropped in a bed right by a fence, goes up the fence. Sweet peas, beans and cucumbers stay in the bed; to grow them along a fence, drop them by it where there’s no bed, such as on the lawn.',
      'Anything in a pot, or in a greenhouse or cold frame, stays where it’s dropped.',
    ],
    related: ['adding-plants', 'drawing-the-plan', 'soil'],
    words: 'climber climbers climbing fence wall hedge trellis arch obelisk clematis rose honeysuckle wisteria jasmine sweet pea runner bean cordon espalier fan trained apple pear wall fruit',
  },
  {
    id: 'whats-happened',
    title: 'Saying what’s happened',
    summary: 'Telling the app a plant is up, planted out or cropping, so its jobs keep to time.',
    view: 'plan',
    tier: 2,
    steps: [
      { phone: 'Tap the plant in your garden, or under its bed in your list. Its details open.', computer: 'Click the plant on the plan, or under its bed in your list. Its details open beside it.' },
      'Under What’s happened?, choose what you’ve seen: It’s up, Planted out, Flowering, First pick, Picked some or Finished. The likely next one is marked.',
      'Change the date if it wasn’t today, add a photo if you like, and save. The jobs that follow are timed from that day.',
      'If seedlings are slow to come up, or something hasn’t been hardened off or planted out when it usually would be, Today lists it under Running behind, with likely reasons. Choose It’s moved on, Still waiting (it asks again in two weeks) or, for a sowing, Sowing failed.',
    ],
    notes: [
      'Ticking a sowing, planting or picking job on Today does the same, so most of the time there’s no need to open the plant.',
      'Sowing failed notes it in the journal, so you can sow again and remember why there was a gap.',
    ],
    related: ['this-week', 'harvest', 'journal'],
    words: 'what happened seedlings seeds stage stages up come up germinated planted out flowering picking finished failed didn’t come up behind late slow running behind still waiting moved on snooze date mark record progress growing',
  },
  {
    id: 'seed-tin',
    title: 'Your seed tin',
    summary: 'The packets of seed you have, how many are left, and when to sow them by.',
    view: 'shed',
    tier: 2,
    steps: [
      'Open the Shed, choose Seed tin, then Add a packet.',
      'Say what’s in the packet, the name on it if it has one, roughly how many seeds are left, and its sow-by date. A photo of the packet helps you find it in the drawer.',
      'Plants you have seed for are marked in Plants and on the plan. Sowing them in the Shed takes the seeds you use from the tin.',
      'Seed in the tin is left off the shopping list, unless it’s past its sow-by date.',
    ],
    notes: ['Most seed keeps two or three years in a cool, dry tin. Parsnip seed is best bought fresh each year.'],
    related: ['sowing', 'shopping'],
    words: 'seed seeds packet packets tin box drawer stock left how many sow by date expiry old saved spare',
  },
  {
    id: 'journal',
    title: 'The garden journal',
    summary: 'Notes and photos: what you sowed, what worked, and what didn’t.',
    view: 'notes',
    tier: 2,
    steps: [
      'On Today, Garden journal has Add a note or photo. All notes opens the whole journal.',
      'Write what happened, change the date if it was another day, and add a photo if you like: take one, or choose one.',
      'For a note about one bed or plant, choose it under About, or add the note from that bed or plant in your garden.',
      'The journal keeps everything newest first, with the bed or plant each note is about.',
    ],
    notes: ['Photos stay on this device. A backup has them only if you make it With photos, in Settings.'],
    related: ['whats-happened', 'backups'],
    words: 'journal notes note diary log photo photos picture camera record write remember',
  },
  {
    id: 'reminders',
    title: 'Reminders and frost warnings',
    summary: 'A note on Mondays of the week’s jobs, and a warning when a frost could hurt your plants.',
    view: 'settings',
    tier: 2,
    steps: [
      'Open Settings and find Reminders.',
      'Tick Frost warnings to be told when a frost could hurt your tender plants or seedlings. It checks the forecast for your garden’s rough location.',
      'Tick This week’s jobs, on Mondays, for what there is to sow, harden off or plant out that week.',
      'The first time, your phone or computer asks whether the app may show notifications. Say Allow.',
      'Weeding reminders and Feeding reminders add their jobs to Today. Untick either if you’d rather not have them.',
    ],
    notes: ['With the app closed, reminders need it installed on an Android phone. Elsewhere, Today shows frost and this week’s jobs whenever you open it.'],
    related: ['climate', 'this-week'],
    words: 'reminder reminders notification notifications alert alerts frost warning warnings monday weekly nudge remind tell me weeding feeding turn off stop',
  },
  {
    id: 'backups',
    title: 'Keeping your garden safe',
    summary: 'Backups, and moving your garden to a new phone or computer.',
    view: 'settings',
    tier: 2,
    steps: [
      'Your garden is saved as you go, but only in this browser on this device. To keep a copy, open Settings and find Backups.',
      { phone: 'Tap Save or share a copy, then save it to Files or send it to yourself.', computer: 'Click Download a backup. It goes in your Downloads folder.' },
      'On a new phone or computer, open the app, go to Settings, Backups, and choose Restore from a backup…. Add it as another garden, or put it in place of the one there.',
      'Photos make a backup much bigger, so they’re only in one made With photos.',
    ],
    notes: [
      'Today shows Keep a copy when your last copy is getting old.',
      'On an iPhone, Safari can clear what a website keeps after a few weeks without a visit. Put the app on your home screen (Share, then Add to Home Screen) to keep it, and keep a copy too.',
    ],
    related: ['gardens', 'journal'],
    words: 'backup back up save copy export download restore import new phone move transfer another device computer lost safe deleted clear browser data file keep',
  },
  {
    id: 'soil',
    title: 'Your soil',
    summary: 'Setting your soil, so plants that wouldn’t like it are flagged.',
    view: 'settings',
    tier: 3,
    steps: [
      'Open Settings and choose your soil under Your garden: clay, loam, sandy, chalky or peaty. Not sure is fine.',
      'If you’ve tested it, type its pH.',
      'A bed can have its own: pick it on the plan and open Soil, such as ericaceous compost for blueberries. Pots and planters are compost unless you say otherwise.',
      'In the plant checks, a plant whose card says the soil won’t suit it is flagged, such as a blueberry on chalk or lavender in clay.',
    ],
    notes: ['To tell your soil, squeeze a damp handful: clay makes a sticky ball, and sandy soil feels gritty and falls apart. Very chalky soil can have lumps of white stone in it.'],
    related: ['climbers', 'adding-plants'],
    words: 'soil clay loam sand sandy chalk chalky peat peaty ph acid alkaline lime ericaceous compost drainage heavy light',
  },
  {
    id: 'next-year',
    title: 'Next year, with the crops rotated',
    summary: 'Planning next year from this one, so each crop family moves to a fresh bed.',
    view: 'month',
    tier: 3,
    steps: [
      'From September to February, Today has Planning ahead: choose Draft it beside Next year. Any time, it’s under All … jobs at the foot of Today’s list, and Draft next year is in the plan’s ⋯ menu.',
      'Each bed’s crops move on a step, as the RHS’s four-year rotation has it: peas and beans, then the cabbage family, then potatoes and tomatoes, then onions and roots. Salads, squashes, sweetcorn and peppers can go anywhere, so they move with the bed they’re in.',
      'Change which bed takes which crops with Takes the crops from. Untick anything you won’t grow again.',
      'Crops that didn’t come up or ran behind are left out; tick one to put it back. Ones you picked from are marked Did well.',
      'Choose Use this. Next year’s crops go on the plan as planned, to sow or plant on the same day as this year, and their jobs come in their months.',
      'Changed your mind? Draft it again and choose Use this: it replaces the last draft’s plantings that aren’t sown yet, rather than adding to them.',
    ],
    notes: [
      'It’s drafted from what you marked as sown or planted this year, so ticking sowing and planting jobs as you go makes next year’s draft better. A bed with nothing marked asks what grew there, so a first year still counts.',
      'A crop counts in the year it’s picked: garlic planted in October is next year’s, and its bed is taken until it’s lifted, so nothing new goes in there.',
      'Every bed and patch of ground is listed, with anything that stays put and why. Pots and planters get fresh compost, so they keep what they have, as do greenhouses and plants that come back each year.',
    ],
    related: ['shopping', 'adding-plants'],
    words: 'next year rotation crop rotation rotate families brassicas legumes potatoes onions roots plan ahead draft season',
  },
  {
    id: 'shopping',
    title: 'The shopping list, and watering',
    summary: 'What to buy for what you’ve planned, and when to water in a dry spell.',
    view: 'month',
    tier: 3,
    steps: [
      'From September to February, Today has Planning ahead: choose Open beside Shopping list. Any time, it’s under All … jobs at the foot of Today’s list, and in the plan’s ⋯ menu.',
      'It lists seed, plants, compost and feed for what’s planned on the plan and on your Want to grow list. Seed already in your tin, and feeds on your shelf, are left off.',
      'Tick things as you buy them. A tick lasts the season.',
      'Share the list sends what’s left to buy to a message or a note.',
      'With this year’s weather turned on in Settings, a Water job appears after a few dry, warm days: for pots, and for anything planted out or sown in the last six weeks. After rain it goes.',
    ],
    notes: ['A packet past its sow-by date stays on the list, as fresh seed comes up better.'],
    related: ['next-year', 'seed-tin'],
    words: 'shopping list buy seeds seed packets compost feed bags garden centre order water watering dry spell drought hot weather pots',
  },
  {
    id: 'climate',
    title: 'Frosts and your climate',
    summary: 'The frost dates and warmth that time your jobs, and changing them.',
    view: 'settings',
    tier: 3,
    steps: [
      'Open Settings and find Seasons and weather.',
      'The last frost is a 50:50 date: a frost is as likely after it as before. Tender plants are safest out two weeks later, and the Shed says when that is.',
      'Know your own frost dates, in a frost pocket or a sheltered town garden? Set the day and month under Frosts. Use the estimate puts them back.',
      'Your climate shows the usual warmth where you are, from the three nearest weather stations, and how it compares with the middle of England. It times how fast crops grow.',
      'Tick Use this year’s weather and the forecast to time crops by the real weather so far. Only your garden’s rough location is sent.',
    ],
    notes: ['A city garden, a sunny wall or a hillside can be a degree or two off the averages. Your own frost dates are the best way to say so.'],
    related: ['reminders', 'sun-and-shade'],
    words: 'frost frosts last frost first frost dates climate weather forecast warm warmth cold temperature station growing season 50:50 play safe tender late spring when plant out',
  },
  {
    id: 'sun-and-shade',
    title: 'Sun and shade',
    summary: 'How much sun each part of the garden gets, through the year.',
    view: 'plan',
    tier: 3,
    steps: [
      'Set which way is north first: in Settings, under Which way is north. On a phone, Use your phone’s compass works it out.',
      'In the plan’s ⋯ menu, choose Advanced tools. Then choose Sun hours or Shade under Show on the plan.',
      'Sun hours colours each spot by its hours of direct sun in a day. Shade shows the shadows at a time of day.',
      'Move the year slider under the plan to see another week: the sun is low in winter and high in June.',
      'Plants that want more sun than their spot gets are flagged in the plant checks.',
    ],
    notes: ['Trees, the house, fences and next door’s trees all cast shade, so draw the tall things. Sun hours count direct sun only, on flat ground.'],
    related: ['drawing-the-plan', 'year-and-3d'],
    words: 'sun sunny shade shady shadow shadows light hours direct aspect south facing north compass where to plant position bright dark corner spot',
  },
  {
    id: 'greenhouse',
    title: 'Greenhouses and cold frames',
    summary: 'Growing under glass, and how it changes the timings.',
    view: 'plan',
    tier: 3,
    steps: [
      { phone: 'Open Beds and pots along the bottom of the plan and tap Greenhouse or Cold frame.', computer: 'Open Beds and pots along the bottom of the plan and drag a greenhouse or a cold frame onto it.' },
      'Keeping a list? Choose Add a bed, then A greenhouse or A cold frame.',
      'Plants in it are under glass: they can go in sooner in spring and later in autumn, need no hardening off, and crop sooner in the warmth.',
      'Pick the greenhouse to set how much warmer it is by day and at night, or tick Heated, kept frost-free.',
      'Raise seedlings in here, in its details, adds it to the Shed, so trays you sow there are timed by its warmth.',
    ],
    notes: ['Nothing under glass gets rain, so water everything in it, even in a wet week.', 'What grows under glass stays put in next year’s draft.'],
    related: ['sowing', 'climate'],
    words: 'greenhouse cold frame glass polytunnel under cover heated frost free warm warmer microclimate cloche bench',
  },
  {
    id: 'year-and-3d',
    title: 'The year ahead, and 3D',
    summary: 'Seeing the garden in another month, and standing in it.',
    view: 'plan',
    tier: 3,
    steps: [
      { phone: 'Tap the year slider under the plan to open it, then drag along it to another week.', computer: 'Drag along the year slider under the plan to another week.' },
      'Play the year runs through it: plants grow, flower, crop and are cleared, and trees come into leaf and drop it.',
      'Show: in flower, Show: harvest and Show: water pick out what’s flowering, ready to pick or likely to be thirsty that week.',
      'Show: in 3D, or See it in 3D in the ⋯ menu, opens the garden in 3D.',
      { phone: 'In 3D, walk with the pad, drag to look round, and tap the ground to walk there.', computer: 'In 3D, walk with W A S D or the arrow keys, drag to look round, and click the ground to walk there.' },
    ],
    notes: ['3D needs a signal the first time it opens, and a browser with 3D graphics turned on.'],
    related: ['sun-and-shade', 'sharing'],
    words: 'year slider scrubber timeline month week future later summer winter play animate 3d three dimensional walk around look round view flower harvest water',
  },
  {
    id: 'sharing',
    title: 'Sharing a picture of your garden',
    summary: 'A picture of this week, a timelapse of the year, and your season wrapped.',
    view: 'plan',
    tier: 3,
    steps: [
      'On the plan, choose Share a picture of this week beside the year slider, or Share a picture of the plan in the ⋯ menu.',
      'Choose Post, 4:5 or Story, 9:16, then Share… or Save the picture.',
      'Make a timelapse plays the year as a short film, to save or share.',
      'Your season, wrapped, on Today, puts the year in a few cards to flip through and share.',
    ],
    notes: ['Pictures are made on this device. Nothing is uploaded unless you share it.'],
    related: ['year-and-3d', 'harvest'],
    words: 'share sharing picture image photo post instagram story facebook whatsapp send timelapse video film wrapped season poster save',
  },
  {
    id: 'gardens',
    title: 'More than one garden',
    summary: 'An allotment as well as the garden at home, or a plan for someone else.',
    view: 'settings',
    tier: 3,
    steps: [
      'Open Settings and find Your gardens.',
      'Choose New garden, and set it up as you did the first.',
      'Open now switches to another garden. Each has its own beds, jobs, seed tin and journal.',
      'Rename changes a garden’s name. Delete… puts it away, and Bring back a garden returns it within 30 days.',
    ],
    notes: ['A backup is of the garden that’s open. Restoring one can add it as another garden.'],
    related: ['backups', 'setting-up'],
    words: 'garden gardens another second two allotment new switch change open rename delete bring back multiple several plot',
  },
  {
    id: 'your-own-plant',
    title: 'Plants that aren’t listed, and kinds to grow',
    summary: 'Choosing a kind, adding your own plant, and your list of plants to grow.',
    view: 'plants',
    tier: 3,
    steps: [
      'In Plants, search first: there are over 600, with kinds such as cordon tomatoes and autumn-sown broad beans. A plant’s page lists its kinds under Kinds to grow.',
      'Not there? Choose Add your own plant. Only the first four things are needed; add the rest whenever you like.',
      'Give it its sowing and harvest months and it gets jobs, like any other plant.',
      'Choose the heart on any plant to put it on your Want to grow list. Those plants get sowing jobs when it’s time, and go on the shopping list.',
    ],
    notes: ['Plants you add go in your backups, with your garden.'],
    related: ['adding-plants', 'shopping'],
    words: 'own plant custom add new missing not listed can’t find isn’t there variety varieties kind kinds cultivar want to grow wishlist favourites list heart',
  },
  {
    id: 'inspire',
    title: 'Ideas for an empty bed',
    summary: 'Three ideas that suit a bed, pot or lawn, its sun, your budget and your time.',
    view: 'home',
    tier: 3,
    steps: [
      'On Today, Room to grow lists the beds and pots standing empty, and the lawn. Choose one.',
      { phone: 'Or tap an empty bed on the plan and choose Inspire me.', computer: 'Or click an empty bed on the plan and choose Inspire me.' },
      'Say what you’d spend, when you want something from it, and how much time you have each week.',
      'Three ideas come up, each with a picture, a rough cost, the work it takes and when it’s ready. Pick one and it’s planted.',
    ],
    notes: ['Costs are rough guides from UK shops, and prices change. The ideas change as you answer.'],
    related: ['adding-plants', 'your-own-plant'],
    words: 'ideas inspire inspiration suggest suggestions what to grow empty bed pot lawn bare nothing budget cost time',
  },
];

export const helpTopic = (id: string): HelpTopic | undefined => HELP.find((t) => t.id === id) ?? (id === 'words' ? WORDS_TOPIC : undefined);

/** Garden words: the glossary, as a page of Help (src/ui/views/Help.tsx draws it). */
export const WORDS_TOPIC: HelpTopic = {
  id: 'words',
  title: 'Garden words',
  summary: 'What the words gardeners use mean, in two plain lines each.',
  view: 'home',
  tier: 1,
  steps: [],
  related: ['this-week'],
  words: 'glossary words meaning what does it mean explain jargon terms dictionary',
};

/** A step as worded for this screen. */
export const stepText = (s: HelpStep, phone: boolean): string => (typeof s === 'string' ? s : phone ? s.phone : s.computer);

/** Topics to show on the Help page, grouped by tier, in order. */
export function helpByTier(): { tier: HelpTopic['tier']; label: string; topics: HelpTopic[] }[] {
  return ([1, 2, 3] as const).map((tier) => ({ tier, label: TIER_LABEL[tier], topics: HELP.filter((t) => t.tier === tier) })).filter((g) => g.topics.length);
}
