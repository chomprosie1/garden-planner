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
