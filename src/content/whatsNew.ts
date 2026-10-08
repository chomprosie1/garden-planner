// What's new, in plain English, for people using the app. Newest first. Add an
// entry whenever the app changes in a way someone would notice: say what they
// can now do and where to find it, not how it was built.

import type { View } from '../theme/prefs';

export interface NewsEntry {
  /** Stable, so the app knows which you've seen. Never reuse one. */
  id: string;
  /** ISO date. */
  date: string;
  title: string;
  items: string[];
  /** Where to try it. */
  tryIt?: { label: string; view: View };
}

export const WHATS_NEW: NewsEntry[] = [
  {
    id: '2026-10-09-500-plants',
    date: '2026-10-09',
    title: '500 plants, kinds to grow, and a seed tin',
    items: [
      'Twice as many plants: 250 more, from kai lan and oca to cobnuts, hawthorn hedges, ferns and fifty more herbs.',
      'Kinds to grow for 25 favourite crops: cherry, bush and beefsteak tomatoes, first early and maincrop potatoes, sugar snap peas, butternut squash and more. Each has its own months and size, and is on its plant’s card under Kinds to grow.',
      'A seed tin in Seedlings: keep your packets there, with how many seeds are left, when to sow them by, what they cost and a photo of the packet. It tells you when a packet is getting old.',
      'Plants you have seed for are marked in Plants, and the plan’s plant tray has an In the seed tin list. Sowing in the shed takes the seeds out of the packet.',
      'Every plant’s card now says which family it’s in, for rotating crops, and how good its flowers are for bees and other pollinators.',
    ],
    tryIt: { label: 'Open the seed tin', view: 'shed' },
  },
  {
    id: '2026-10-09-feeding',
    date: '2026-10-09',
    title: 'Feeding',
    items: [
      'Every plant’s card in Plants now says how hungry it is, what to feed it and when, and what to keep away from it, like fresh manure for carrots or lime for blueberries.',
      'Feed jobs in your month: tomatoes every week from the first flowers, raspberries in spring, leeks every two weeks while they grow. Planting jobs say what to dig in first.',
      'A feed shelf in Seedlings: tick the feeds you have, and see what this season’s plants call for, roughly how much, and roughly what it costs. If you have something that does the same job, it says so.',
      'Fifteen everyday feeds, organic and mineral, by their plain names: blood, fish and bone, tomato feed, comfrey tea and the rest, with how to make the home-made ones.',
      'Rather not have feed jobs? Turn them off in Your garden, under Reminders.',
    ],
    tryIt: { label: 'Open the feed shelf', view: 'shed' },
  },
  {
    id: '2026-10-09-3d-move',
    date: '2026-10-09',
    title: 'Move about in 3D',
    items: [
      'The 3D view no longer turns round one fixed point in the middle. Drag with two fingers to move along the garden (on a computer, drag with the right button).',
      'Double-tap anywhere, behind the shed or by the far bed, and the view goes there and turns round that spot.',
    ],
    tryIt: { label: 'Open your garden', view: 'plan' },
  },
  {
    id: '2026-10-08-kitchen',
    date: '2026-10-08',
    title: 'From plot to plate',
    items: [
      'In the kitchen this week, on Today: what’s ready to pick, and a few recipes that use it. Tap one for what goes in and what to do.',
      'Over 120 short recipes of our own, from slow-roasted tomatoes to rhubarb and ginger crumble, each in season.',
      'Every crop’s card in Plants now says how to store it, how to keep it for later (freezing, drying, jam or chutney), how to use it, and its recipes.',
      'Log a pick and you’ll see what to do with it, straight away.',
      'What your garden grew, in pounds: Today shows roughly what this year’s picks would have cost in the shops, and so does your season, wrapped.',
    ],
    tryIt: { label: 'Open Today', view: 'home' },
  },
  {
    id: '2026-10-08-new-look',
    date: '2026-10-08',
    title: 'A new look, and a warmer word or two',
    items: [
      'Today reads like a page from a garden notebook now, not a pile of boxes. Only what needs you now, like a frost or seedlings ready to go out, sits in its own panel.',
      'This week is a row of cards at the top of Today, each with a picture of the plant and when. Swipe through them, and tap one to see it on the plan.',
      'Swipe a job to the right to tick it off. Phones that can will give a little buzz.',
      'A small moment now and then: the first frost of autumn, your first tomatoes of the year, the longest day.',
      'New pictures on the tabs, quieter buttons, and fewer, warmer words, starting with Today, the jobs and the advice for each stage.',
      'On a phone, pull the details on the plan up to open them and down to put them away.',
    ],
    tryIt: { label: 'Open Today', view: 'home' },
  },
  {
    id: '2026-10-08-gardens',
    date: '2026-10-08',
    title: 'More than one garden, and starting again',
    items: [
      'Keep more than one garden: the back garden, the allotment, a balcony. Your gardens are at the top of Settings, with a small picture of each. Open, rename or delete one there, or start a new one, in the same place as this one if you like.',
      'Your own plants and your look are shared by all your gardens. Today, the jobs and reminders follow the garden that’s open.',
      'Restoring a backup now asks whether to add it as another garden or replace the one that’s open.',
      'Start again, at the bottom of Settings, takes you through it carefully. It first offers to clear the beds or start a new garden instead, then says what goes and asks what to keep, offers a copy to save, and asks you to hold the button to be sure.',
      'A garden you start again or delete is kept, hidden, for 30 days. Bring it back from Settings if you change your mind.',
      'Delete everything, also at the bottom of Settings, removes every garden and photo from this browser, for when you’re handing a phone on. There’s no way back from that one, and it says so.',
    ],
    tryIt: { label: 'Open Settings', view: 'settings' },
  },
  {
    id: '2026-10-08-room-to-see',
    date: '2026-10-08',
    title: 'Room to see, sun cream and sunny windowsills',
    items: [
      'Sun hours and Shade now use the whole screen. The tools tuck into a handle along the bottom: tap it or pull it up to bring them back. Undo, the lock and Simple are in the ⋯ menu while they’re on.',
      'Midsummer, Midwinter and Today are now one “Day” drop-down above the sun.',
      'Adding a photo to a note or a plant: “Take a photo” opens the camera on a phone, and “Choose a photo” picks one you’ve already taken.',
      'From April to September, Today shows the UV when it’s moderate or higher, with what to wear. With this year’s weather on it’s the forecast’s; otherwise it’s a sunny day’s at this time of year. Turn on sun cream reminders in Your garden.',
      'Say which way a windowsill or shelf faces (or use your phone’s compass) and Seedlings shows its hours of sun. Tomatoes, peppers and basil go in your sunniest place, and a north-facing sill warns of leggy seedlings.',
      'Clear beds from the ⋯ menu on the plan: tick one, several or all of your beds and pots, and clear everything in them, or only what’s finished this season.',
      'Copy a plant (Ctrl+C, or Copy in its details) and paste it into another bed: pick the bed and tap “Paste here”, or press Ctrl+V over it. The duplicate button (Ctrl+D) puts another one beside it. Both find the nearest spot with room.',
      'Fixed: on a phone, the looks in Settings now wrap into two columns instead of running off the edge. In 3D, paving or a path over a lawn no longer lets the lawn show through.',
    ],
    tryIt: { label: 'Open Seedlings', view: 'shed' },
  },
  {
    id: '2026-10-07-3d',
    date: '2026-10-07',
    title: 'Your garden in 3D',
    items: [
      'See your garden in 3D: tap 3D above the plan (on a phone, choose “Show: in 3D”), or find it in the ⋯ menu.',
      'Raised beds stand to their edging, and fences, walls, hedges, sheds and greenhouses to their heights. Trees take their own shape, and every plant is drawn at its stage that week.',
      'Drag to look round and pinch or scroll to zoom. Choose From above or Standing in it, and tap anything for its name.',
      'The shadows come from the real sun over your garden. Move the time of day, or drag the year slider to watch it grow through the seasons.',
      'Share a picture of it with the share button by the year slider.',
      'Leaves drop in winter, on the plan as well as in 3D. Fruit trees, roses and other shrubs stand bare from November to April, while evergreens like rosemary and box keep theirs. Mint, peonies and the like die back to their crowns, and bulbs only show around when they flower.',
    ],
    tryIt: { label: 'Open your garden', view: 'plan' },
  },
  {
    id: '2026-10-07-library',
    date: '2026-10-07',
    title: '150 more plants',
    items: [
      'The plant library has grown from 100 to 250. There are 40 more vegetables and salads, from cavolo nero to cucamelons, and 15 more herbs.',
      'Also 15 more fruit, including quince, damson, apricot and honeyberries, plus 47 more flowers and bulbs, from snapdragons to camassia.',
      'And now 25 shrubs and 10 climbers: hydrangea, lilac, camellia, clematis, wisteria, honeysuckle and more.',
      'The new fruit trees are in the tree list under Trees and structures too.',
      'Most plants grown from seed now say how long they usually take to come up, so the Seedlings page and “Running behind” know when to expect them.',
      'Every new plant is marked “not yet checked”: if you spot something wrong, report it from the plant’s page.',
    ],
    tryIt: { label: 'Browse the plants', view: 'plants' },
  },
  {
    id: '2026-10-07-on-track',
    date: '2026-10-07',
    title: 'Running behind, and weeds',
    items: [
      'Today tells you when something’s late to come up, flower or crop, with the usual reasons why: cold soil, old seed, too much feed and the like. Say it’s moved on, that you’re still waiting (it’ll check again in two weeks), or that the sowing failed. It’s on the planting too.',
      'Weeds: about twenty common ones, from dandelions to bindweed. Mark where they grow, from the Weeds filter in Plants below the plan, then keep them for the wildlife or be rid of them.',
      'Weeds you want gone get a job at the right time: pull it before it seeds, or dig out the roots in spring and autumn. Tick it and it’s gone from the plan.',
      'A “Weed the beds” job each month from March to October, with what to do that month. Turn it off in Your garden, under Reminders.',
      'On a phone, the year slider steps aside while a plant’s details are open, or while you’re planting.',
    ],
    tryIt: { label: 'See Today', view: 'home' },
  },
  {
    id: '2026-10-07-simple',
    date: '2026-10-07',
    title: 'A simpler plan, with Advanced when you want it',
    items: [
      'The plan starts in Simple: drop beds, pots, plants and trees from below, drag them about, and pull a corner to resize. Fewer buttons, more room for your garden.',
      'Tap Advanced at the top for everything else: drawing by corners or by hand, reshaping and turning, exact sizes, sketching, tracing a photo, the lock, and sun and shade. It remembers which you chose.',
      'Nothing on your plan changes when you switch, and asking for a drawing tool or the shade from search switches to Advanced for you.',
      'Bigger buttons on a phone, and the year slider steps aside while the drawer below the plan is open.',
      'Structures is now “Trees and structures”.',
      'Fixed: a bed you’ve just planned something for no longer says it’s empty, and ideas for an empty bed never include something that’s usually kept apart from what’s planned there. Before a crop planned months ahead, it only suggests something that’ll be done in time.',
    ],
    tryIt: { label: 'Open your garden', view: 'plan' },
  },
  {
    id: '2026-10-07-anywhere',
    date: '2026-10-07',
    title: 'Plant in the lawn, and trees by name',
    items: [
      'Plants can go anywhere that isn’t paved: bulbs in the lawn edge, wildflowers in gravel, a fruit tree in the grass. Drop them on, just as you would a bed. Patios, decking and paths stay clear.',
      'Fruit trees, shrubs and other big plants can be small, medium or large: tap one, then tap Size. Exact sizes are under “Change the details”.',
      'About fifty trees to choose from, from a Japanese maple to an oak, at small, medium or large. They’re under Structures, with a search. Each one casts the shade it should, and evergreens keep it all winter.',
      'Trees and tall plants are drawn over the smaller plants beneath them.',
      'The slider for the year no longer disappears behind the photo round the plan.',
    ],
    tryIt: { label: 'Open your garden', view: 'plan' },
  },
  {
    id: '2026-10-07-delight',
    date: '2026-10-07',
    title: 'Photos, pickings and your season, wrapped',
    items: [
      'Add a photo to any note, or when you log what’s happened to a planting. Its photos show in its Timeline, and the journal has a Photos view.',
      'Log what you pick: a handful, a bowl, a basket or the weight, from “What’s happened?” or “Picked some?” on a harvest job. Today adds up what you’ve picked this year.',
      'Your season, wrapped: your year in the garden as cards to flip through and share. On Today from September, or search for it.',
      'Put the app on your home screen: it opens like an app and works without a signal.',
      'Reminders, if you’d like them: a warning when a frost could hurt your plants, and this week’s jobs on Mondays. Turn them on in Your garden.',
      'Backups can carry your photos too.',
    ],
    tryIt: { label: 'See Today', view: 'home' },
  },
  {
    id: '2026-10-07-daily',
    date: '2026-10-07',
    title: 'Your week on Today, and logging in a tap',
    items: [
      'Today shows this week in your garden: what to sow, harden off or plant out, and what’s likely to come up, flower or be ready to pick. Next week is folded underneath.',
      'Tap a planting and press “What’s happened?” to log that it’s up, planted out, flowering or giving its first pick, with a note if you like, all in one go.',
      'A planting’s details are in three tabs: Care, Timeline (with what’s likely next, and when) and Notes.',
      'Tap the heart on any plant you’d like to grow. Find them under Want to grow in Plants.',
      'Sun and shade follow the timeline under the plan, with quick jumps to midsummer and midwinter.',
      'Three quick tips the first time you open your garden.',
    ],
    tryIt: { label: 'See your week', view: 'home' },
  },
  {
    id: '2026-10-07-first-minute',
    date: '2026-10-07',
    title: 'Get started in a minute',
    items: [
      'Find your garden by its postcode or town, instead of typing numbers. Tap your garden’s name to change it.',
      'Starter kits: salad and tomatoes for a balcony, a first veg bed, a pollinator garden, an allotment starter and more. Each is planted for you, with salads sown in batches. Choose one when you lay out a new space.',
      'New gardens start by asking what you’d like to grow. Your picks go on your list, with sowing jobs when it’s time.',
      'On a phone, set which way is north with the compass: lay your phone along the top of your plan.',
    ],
    tryIt: { label: 'Find your garden', view: 'profile' },
  },
  {
    id: '2026-10-07-simpler',
    date: '2026-10-07',
    title: 'A simpler app: four tabs and a calmer garden plan',
    items: [
      'Four tabs along the bottom: Today, Garden, Seedlings and Plants. Seedlings is the Potting Shed, now one tap away.',
      'Tap your garden’s name to see where it is, its frosts and climate, this year’s weather and your backups. Settings is now just how the app looks on this device.',
      'The Garden screen is calmer: search, undo and the lock at the top, and the rest under ⋯. On a phone, choose what to show on the plan from one menu.',
      'Plant cards are simpler, with a link to tell us if something’s wrong.',
      'Text follows your device’s text size, and “hardening off” is explained when it’s next.',
    ],
    tryIt: { label: 'Open your garden', view: 'plan' },
  },
  {
    id: '2026-10-07-weather',
    date: '2026-10-07',
    title: 'This week’s weather, frost warnings and sowing in batches',
    items: [
      'Turn on this week’s weather from your garden’s page (tap its name), under Seasons and weather. It uses free forecasts from Open-Meteo, and only your garden’s rough location is sent.',
      'With the weather on, Today warns you when a frost could hurt your tender plants or seedlings in the next week, and says what to do.',
      'Harvest dates now use the real weather so far this year and the next fortnight’s forecast, not just the usual for your area.',
      'Show: water on the plan knows when it’s rained, so it won’t tell you to water beds after a downpour.',
      'Sow little and often: split a row or block of lettuce, radishes or carrots into batches sown a few weeks apart. Tap the row, then More, then Sow in batches. Each batch gets its own sowing job.',
      'Ideas for an empty bed now start with plants you want to grow.',
      'And this page: what’s new in the app, whenever it changes.',
    ],
    tryIt: { label: 'Turn on the weather', view: 'profile' },
  },
  {
    id: '2026-10-07-warmth',
    date: '2026-10-07',
    title: 'Crops timed by the warmth where you live',
    items: [
      'The plan’s year now knows how warm your area usually is, from 16 weather stations around the UK.',
      'Crops come on sooner in the south, in high summer and under glass, and later further north. Tender crops like tomatoes stop at the first frost.',
      'Tap a planting to see when it’s likely to be ready, such as “Ready to harvest from about 2 Aug”.',
      'Plant cards say how long each crop usually takes, and your garden’s page shows its climate.',
    ],
    tryIt: { label: 'See your climate', view: 'profile' },
  },
  {
    id: '2026-10-07-greenhouses',
    date: '2026-10-07',
    title: 'Greenhouses and cold frames',
    items: [
      'Add a cold frame from Beds and pots at the bottom of the plan, or draw one.',
      'Plants under glass can go in sooner, skip hardening off and need no winter protection. Mark a greenhouse as heated if you keep it frost-free.',
      'Raise seedlings in your greenhouse or cold frame: link it to the Potting Shed from its panel.',
    ],
    tryIt: { label: 'Open the plan', view: 'plan' },
  },
  {
    id: '2026-10-07-year',
    date: '2026-10-07',
    title: 'Your garden through the year',
    items: [
      'Drag the slider under the plan, or press play, to watch your garden change through the seasons.',
      'Beds that will stand empty glow, with an idea of what to sow. This month’s jobs sit on their beds: tap one to tick it off.',
      'New ways to look at the plan show what’s in flower for bees, what’s ready to pick and what’s thirsty.',
      'Share a picture of your plan, or make a timelapse video of the year ahead.',
    ],
    tryIt: { label: 'Open the plan', view: 'plan' },
  },
  {
    id: '2026-10-07-quick-start',
    date: '2026-10-07',
    title: 'Drag, drop and search',
    items: [
      'Tap anything on the plan to pick it, and drag to move it. Lock the layout so beds don’t move by accident.',
      'Drag beds, pots and plants onto the plan from the bar along the bottom. Drop a plant on a bed to fill it.',
      'New gardens start with “Where are you growing?”: a balcony, patio, garden, allotment or just a bed.',
      'Press Ctrl+K, or the search button on the plan, to find anything. Try “add tomato”.',
    ],
  },
  {
    id: '2026-10-06-potting-shed',
    date: '2026-10-06',
    title: 'The Potting Shed',
    items: [
      'Keep track of seed trays on shelves, windowsills and propagators, from sowing to planting out.',
      'It tells you when seedlings are due, when to harden them off and when they’re ready, from your frost dates.',
    ],
    tryIt: { label: 'Open Seedlings', view: 'shed' },
  },
];

/** The newest entry's id: what "seen it all" means. */
export const latestNews = (): NewsEntry => WHATS_NEW[0]!;

/** Entries newer than the last one you saw, newest first. All of them if you've never looked. */
export function unseenNews(seen: string | null): NewsEntry[] {
  const at = seen ? WHATS_NEW.findIndex((e) => e.id === seen) : -1;
  return at === -1 ? (seen ? [] : WHATS_NEW) : WHATS_NEW.slice(0, at);
}
