# Garden Planner: Mini MVP Plan

Oct 5, 2026 · @Tom

## Goal

The mini MVP has one job: prove that a to-scale model of your garden can support gardening as a whole. That means the layout, what you grow and where, what each plant needs, and what to do next. If it does, the bigger plan is worth building. If it doesn't, you find out in weeks, not months, and for £0.

It is a free pet project, hosted on GitHub and used by you on your own garden. Sun and shade is one layer of the garden model, built on the same footing as the others, and no single layer should absorb the build. It leaves out accounts, payments, weather feeds, app stores and the full crop engine from the master plan.

**Success looks like:** a to-scale plan of your garden with its beds, paths, buildings and trees; a searchable plant library you can add to; plants placed in beds with spacing and companion checks; a list of what to do this month for the plants you have; and a sun and shade view alongside. You use it to decide what goes where and when, and it turns out right.

## The full product, for context

The full product is a garden planner that tells you what to put where, what each plant needs, and what to do and when. It is a model of the whole garden with several layers on top, and sun and shade is only one of them. The MVP builds the core layers; the rest sits here so early decisions don't block it later.

| Layer | What it does | MVP status |
| --- | --- | --- |
| 1. Garden layout | To-scale garden with beds, paths, fences, walls, buildings, trees, greenhouse, compost and water | In, on flat ground |
| 2. Plant library | Wide library of growing conditions, sowing, cropping, pests and controls, companions and wintering, with your own plants added | In, as a starter library |
| 3. Planting | Plants placed in beds with spacing checks and warnings for clashes and good neighbours | In |
| 4. Garden calendar | Jobs by month for the plants you have: sow, plant out, protect, harvest | In, month-based; weather-driven later |
| 5. Environment layers | How the site behaves: sun and shade first, then wind, frost pockets, soil and drainage | Sun and shade in; the rest later |
| 6. Problem guide | Pests and diseases to watch for, with controls, tied to your plants | Library data in; alerts later |
| 7. Garden record | Notes, photos and harvest logs, so you remember what worked | Simple notes in; harvest tracking later |
| 8. Planning over years | Crop rotation, succession planting, perennial and winter planning | Later |
| 9. Containers and balconies | Pots as movable objects with their own heating and drying behaviour | Later |
| 10. Accounts and sharing | Gardens on every device, shared plans, a shared community plant library | Parked |
| 11. Paid tier and global | Freemium subscription, app stores and other hemispheres | Parked |

Every layer reads from the same garden model and plant library, so adding a layer later never means rebuilding the core. The garden model in real millimetres and the plant record are the two choices that matter most.

## MVP scope

The MVP is a small whole-garden planner: lay out the garden, fill it with plants, and see what to do and when. Anything needing a server, a licence or a subscription is out.

**In**

- Draw the garden to scale in millimetres, with a north arrow and your location
- Add beds, paths, fences, walls, buildings, trees and other features, each with a size
- A starter plant library of about 150 common UK plants with growing notes, plus a form to add your own
- Place plants in beds, with spacing checks and warnings for plants that clash or suit each other
- A this-month job list built from the sowing, cropping and wintering notes of the plants you have placed
- Plant cards showing what to look out for, pests, and how to control them
- Simple dated notes on any bed or plant
- Sun and shade as the first environment layer: shadows by date and time, and sun hours per patch
- Save in the browser, plus export and import as a JSON file

**Out, parked for later**

- User accounts, cloud sync and payments
- Weather feeds, frost alerts and Growing Degree Days
- Other environment layers: wind, frost pockets, soil and drainage
- Crop rotation and planning across years
- Native iOS or Android apps
- Containers and balconies
- A shared community plant library
- Global expansion and the investor material

**Build rules, so no single feature takes over**

- Every phase ends with something a gardener can use without the sun layer.
- Sun and shade is capped at two weeks, and the stopping point is a working heat map, not perfect realism.
- Every feature reads from the shared garden model and plant library, and none adds its own data store.
- Anything outside the In list waits for a gate.

## Where it stops being free

The project costs £0 until one of three things happens: you charge money, you need accounts or sync across devices, or you want it in an app store. A domain name (about £10/yr) is optional at any stage.

Figures marked (plan) come from your master plan. The rest are approximate and from memory, so check each provider's current terms before relying on them.

| Stage | What you are doing | Monthly / yearly cost | What triggers the spend |
| --- | --- | --- | --- |
| 0. Pet project | Public GitHub repo, GitHub Pages, data in your browser | £0 | Nothing. You are here. |
| 1. Show friends | Share the link, no sign-up, no charging | £0 | Still free. Keep it non-commercial. |
| 2. Accounts and sync | Log in, save gardens across devices, share plants you add | £0 on a free database tier, about £20/mo on a Pro tier (plan) | More users than the free tier allows, or you need backups |
| 3. Weather and growth data | Frost and temperature data for GDD | £0 for personal use, about £25/mo commercial (plan) | Open-Meteo's free tier is, as far as I know, non-commercial only |
| 4. Charging money | Subscription or paid tier | 15% store commission (plan), plus payment tooling | The moment anyone pays you |
| 5. App stores | iOS and Android apps | About £79/yr Apple, about £20 one-off Google (plan), build service about £23/mo (plan) | Wanting a store listing instead of a web link |
| 6. Running it as a business | Support, crash monitoring, marketing, tax | Sentry about £20/mo (plan), plus marketing and your time | Real users who expect it to work |

**The sharpest line is stage 4.** GitHub's terms, as far as I know, don't allow Pages to host a site mainly for commercial transactions or paid software, and free hosting tiers from other providers often restrict commercial use too. Moving anything you charge for off GitHub Pages is a real step, so check the current terms at that point.

**Free for as long as you want:** stages 0 and 1 cover the whole MVP. Everything below stage 1 is a decision for after the validation gates in this plan, not before.

## Tech stack and hosting

The stack is plain web technology with no server, so it hosts free on GitHub Pages and works on your phone. The code is split into modules around one shared garden model, so no single feature owns the app. Anything heavier from the master plan waits until the MVP earns it.

| Need | MVP choice | Why |
| --- | --- | --- |
| Hosting | GitHub Pages, public repo | Free, deploys on every push |
| App | One web app in TypeScript, built with Vite | Small, fast, no app store |
| Structure | One garden model and plant library that every feature reads from; layout, planting, calendar and sun are separate modules | Stops any one feature taking over |
| Drawing | HTML canvas first, PixiJS only if it gets slow | Fewer moving parts |
| Plant data | A JSON file of about 150 plants, plus your own additions in browser storage | A static file hosts free, and you can check every entry |
| Calendar | Month-based rules read from each plant's sowing, cropping and wintering fields | No weather data needed |
| Sun and shade | SunCalc (BSD 2-Clause licence; keep its notice) for sun position; shadows cast from each feature's footprint and height; Clipper2 only if combining shadows gets slow | Runs in the browser; one module among several |
| Storage | Browser localStorage, plus JSON export and import with a schema version | No backend, you own the data |
| Background image | Optional: load a photo or screenshot from your device and trace over it; kept in IndexedDB, not localStorage or the export | Avoids map-tile licensing and localStorage's ~5 MB limit |
| UI panels | Preact for side panels and forms; plain TypeScript for the canvas | Many forms, tiny library |
| Tests | Vitest unit tests, run on every push | Catches sun-maths and time-zone bugs before you go outside with a camera |
| Devices | Draw and edit on desktop; view, plant cards, notes and jobs on a phone | Accurate touch drawing is a project of its own |

**Why skip the master plan's stack for now:** React Native, Supabase, Mapbox, RevenueCat and EAS all solve problems you don't have yet. Each adds an account, a licence or a bill. A web page can later be installed to a phone's home screen as a progressive web app, which is free and gets you most of what a native app would.

## Data model

The MVP keeps the master plan's best idea: store everything in real-world integer millimetres, anchored to a latitude, longitude and true north. Screen pixels never appear in saved data.

```typescript
type Point = [x: number, y: number]; // integer mm; origin at the canvas's bottom-left, y up

interface Garden {
  schemaVersion: number;     // bumped on every shape change; import migrates old files
  name: string;
  latitude: number;          // WGS84 decimal degrees
  longitude: number;
  northRotationDeg: number;  // 0 = top of canvas is true north
  boundary: Point[];
  features: Feature[];       // everything physical in the garden
  plantings: Planting[];     // what is growing where, including past plantings
  wishlist: string[];        // plant ids you mean to sow, for the calendar
  jobsDone: { key: string; date: string }[];
  notes: Note[];
}

interface Feature {
  id: string;
  kind: 'bed' | 'path' | 'fence' | 'wall' | 'building' | 'greenhouse' | 'tree' | 'hedge' | 'compost' | 'water' | 'other';
  name?: string;
  footprint: Point[];        // mm
  heightMm?: number;         // used by the sun layer; optional for flat features
  canopy?: { centre: Point; radiusMm: number }; // trees
  deciduous?: boolean;
  opacityInLeaf?: number;    // 0 to 1, share of light blocked in leaf
  opacityBare?: number;      // 0 to 1, share of light blocked when bare
}

interface Planting {
  id: string;
  plantId: string;           // a library plant or one you added
  featureId: string;         // the bed it sits in
  x: number;                 // mm within the garden
  y: number;
  layout?: 'single' | 'row' | 'block';
  endPoint?: Point;          // far end of a row, or opposite corner of a block
  count?: number;
  sownOn?: string;           // ISO date, optional
  removedOn?: string;        // ISO date; kept for history and later rotation planning
}

interface Note {
  id: string;
  date: string;              // ISO date
  text: string;
  featureId?: string;
  plantingId?: string;
}
```

The starter library and plants you add yourself share one record shape, so later features can read both.

```typescript
interface Plant {
  id: string;
  commonName: string;
  latinName?: string;
  category: 'vegetable' | 'herb' | 'fruit' | 'flower' | 'shrub' | 'tree';
  conditions: {
    light: 'full-sun' | 'part-shade' | 'shade';
    minSunHours?: number;       // links to the sun-hours map
    soil?: string;
    moisture?: 'dry' | 'moderate' | 'moist';
    hardiness?: string;
  };
  size: { heightMm?: number; spreadMm?: number; spacingMm: number; rowSpacingMm?: number };
  sowing?: { method: 'indoors' | 'direct' | 'cold-frame'; months: number[]; depthMm?: number; notes?: string }[];
  plantOutMonths?: number[];
  cropping?: { harvestMonths: number[]; notes?: string };
  lookOutFor?: string[];
  pests?: { name: string; signs: string; control: string }[];
  companions?: { good: string[]; avoid: string[] };   // plant ids
  wintering?: { type: 'hardy' | 'protect' | 'lift-and-store' | 'annual'; notes?: string };
  image?: { url: string; credit: string; licence: string; sourceUrl: string }; // PD, CC0, CC BY or CC BY-SA only
  source?: string;              // where the facts came from
  lastChecked?: string;         // ISO date
  verified: boolean;            // checked against a reliable source
  userAdded: boolean;
}
```

Only the name, category, light, and spacing are required, so adding your own plant takes a minute. Everything else is optional and can be filled in later. Your own plants get ids starting `user-`, so they never collide with library ids.

**Suited or not.** A plant's light need maps to sun hours in the month it is in the ground: full sun 6 hours or more, part shade 3 to 6, shade under 3.

Three simplifications from the master plan: no user ID or database fields, no container or pot types, and no crop lifecycle stages. Those return when the features that need them do.

**Settled early.** Trees and hedges carry separate in-leaf and bare light-blocking values, since a deciduous tree in winter is mostly open; defaults are 0.7 in leaf and 0.2 bare. The MVP assumes flat ground and UK-average sowing dates, and says both on screen.

## Plant library

The library ships with the app as a static data file, and you can add to it from day one. The biggest time cost in this whole plan is writing and checking that data, not the code.

| Information | What it holds | What it feeds |
| --- | --- | --- |
| Preferred conditions | Light level, minimum sun hours, soil, moisture, hardiness | Suited or unsuited per patch (sun first, soil and wind later) |
| Size and spacing | Mature height and spread, gaps between plants and rows | Bed layout, and shadows from tall crops |
| Sowing | Indoors, direct or cold frame, months, depth, plant-out months | Garden calendar (phase 5) |
| Cropping | Harvest months, how to pick, succession sowing | Harvest jobs (phase 5); succession planning later |
| Things to look out for | Typical problems and their signs, such as bolting | Plant cards; problem alerts later |
| Pests and diseases | Name, signs, and control | Plant cards; problem alerts later |
| Companions | Good neighbours and plants to keep apart | Clash and companion warnings (phase 4) |
| Wintering | Hardy, protect, lift and store, or annual, with autumn jobs | This-month jobs (phase 5) |
| Provenance | Source, last-checked date, user-added flag | Trust, and spotting stale entries |

**Adding your own plants.** A short form asks only for name, category, light and spacing, with every other field optional. Your plants live in your browser, travel with the garden's JSON export, and carry a marker so they aren't mistaken for checked library entries. Sharing them between users needs accounts and moderation, which is stage 2 of the cost ladder.

**How big and how long.** About 150 plants is the starting target, covering common UK vegetables first, then herbs, fruit and flowers. At roughly 15 to 20 minutes to draft and verify each (my estimate), that is about 40 to 50 hours of data work. Start in week 2 and add it in batches of about 30 by category, with the first 30 common vegetables in place by gate 1. Claude drafts each batch marked unverified; you check and mark each entry verified.

**Where the facts come from.** Write entries in your own words from trusted sources such as RHS pages, seed packets and reputable books, and record the source on each. Check the licence before copying any dataset. I can draft entries in the schema for you to verify, but pest, toxicity and hardiness advice needs checking against a reliable source before it goes in. Give cultural and organic controls only at first, and avoid naming chemical products, because UK approvals change.

## Project plan

The build is seven phases over roughly nine weeks of part-time evenings, with three go or no-go gates, and it costs £0 throughout.

Each gate tests the garden as a whole: first that you can build it, then that it tells you what to do, then that it changes a real decision. The sun layer comes late and is capped, so the core planner works without it. The detailed, stage-by-stage build plan is in `docs/build-plan.md`.

| Phase | Weeks | Main tasks | Done when |
| --- | --- | --- | --- |
| 1. Setup | 1 | Create the GitHub repo, set up Vite, TypeScript and Vitest, deploy to GitHub Pages, set up the module structure, the Garden and Plant types, saving and export | A blank app loads at your github.io address on your phone |
| 2. Garden canvas | 2–3 | Pan and zoom, draw the boundary with typed lengths, snap to a millimetre grid, add beds, paths, fences, buildings and trees, north arrow and location, undo, save in the browser. Start with one bed checked against a tape | Your garden is drawn within about 5% of tape measurements and survives a reload |
| 3. Plant library | 3–4 | Load the starter library, search and filter it, full plant cards, add and edit your own plants; data entry runs alongside from week 2 | You can find a plant, read everything about it, and add one of your own (gate 1) |
| 4. Planting | 5 | Place plants in beds singly, in rows or blocks, spacing checks, companion and clash warnings, notes on beds and plants | You can fill a real bed and the app flags real spacing or clash problems |
| 5. Garden calendar | 6 | A this-month job list built from placed and wished-for plants' sowing, plant-out, cropping and wintering fields | The list matches what you would actually do this month (gate 2) |
| 6. Sun and shade layer | 7–8 | Connect SunCalc, cast shadows from features, date and time slider, sun-hours map, mark plants suited or unsuited per patch; capped at two weeks | One fence's shadow matches a photo at one time, and the heat map agrees for the main patches |
| 7. Real use | 9 to 31 Mar 2027 | Plan the 2027 sowing with it, log every mismatch, fix the worst, export a backup monthly | You can answer gate 3 honestly |

## Testing against the real garden

Three gates decide whether to carry on, and each tests the planner against your real garden as a whole, not one feature.

**Layout check (phase 2).** Measure your boundary, beds and main features with a tape, draw them in the app, and compare. Within about 5% is good enough for planning.

**Sun layer check (phase 6).** On a clear day, photograph the shadows at three times with a fixed landmark in frame, then set the app to the same date and time and compare where the shadow edges land. Walk the garden and check the heat map agrees patch by patch. Phase 6 lands in late November, so take the photos on the first clear day rather than waiting for a set date. Winter is a demanding test: at about 53°N the midwinter sun reaches only around 13° above the horizon at noon, so a 1.8m fence throws a shadow roughly 7.5m long.

| Gate | When | Question | Pass looks like | If it fails |
| --- | --- | --- | --- | --- |
| 1. Buildable | End of phase 3 (week 4) | Can you draw your real garden, and find, read and add plants, including one of your own? | Layout within about 5% of measured; you can find, read and add plants without help | Fix the drawing and library screens before anything else |
| 2. Useful | End of phase 5 (week 6) | Can you fill a real bed, and does it tell you what goes where and what to do this month? | Spacing and clash warnings are right for a real bed, and the month list matches what you would actually do | Fix the plant data and rules before adding layers |
| 3. Worth growing | 31 March 2027, once spring sowing decisions are real | Did it change a real decision about your garden? | At least one placement, planting or timing choice you made because of it | Stop here, or narrow the idea, before spending anything |

Only passing gate 3 justifies looking at stage 2 or later of the cost ladder.

## Risks and things to check

The biggest risk is the build drifting into one favourite feature. Sun and shade is interesting and easy to polish forever, while the library, planting and calendar are what make this a gardening tool.

| Risk | Why it matters | What to do |
| --- | --- | --- |
| Scope creep, especially sun | The master plan is huge, and the sun maths is the most absorbing part | Keep the out-of-scope list visible, cap the sun layer at two weeks, and add a feature only after a gate |
| Inaccurate inputs | Heights, north direction and boundary are entered by hand | Measure with a tape, find true north with a map rather than a compass, and show the assumptions on screen |
| Trees and slope | Leaves, growth and uneven ground change shade | Treat trees as partly transparent, assume flat ground, and say so |
| Time zones and daylight saving | Easy source of shadows that are an hour out | Work in Europe/London through the browser's Intl support, and unit-test around the clock change dates |
| Regional sowing dates | UK-average months can be weeks out for Scotland or Cornwall | Say so on screen; regional offsets come with the weather-driven calendar later |
| Plant images | Photos from the web are often not free to reuse | Only public domain, CC0, CC BY or CC BY-SA images, with the licence read from the source and credited |
| Plant data errors | Wrong light, hardiness, toxicity or pest advice damages trust | Record a source and a last-checked date on every plant, flag unverified entries, and give organic and cultural pest controls only |
| Licences and terms | Open-Meteo, mapping tiles and GitHub Pages each restrict commercial use | Re-check the terms before stage 3 or 4 of the cost ladder |
| Motivation | Evening projects stall | Keep phases small, with something visible at the end of each |

Run the smallest test early: at the start of phase 2, draw one bed to scale and check it against a tape before polishing anything else.

## After the MVP

If gate 3 passes, add the master plan's features one at a time, cheapest first. Each row says what it costs, so you decide with the bill in view.

| Order | Feature | From the master plan | New cost |
| --- | --- | --- | --- |
| 1 | Install to phone home screen (progressive web app) | Mobile delivery | £0 |
| 2 | More environment layers: wind, frost pockets, soil and drainage | Spatial model | £0 |
| 3 | Growing Degree Days and a weather-driven calendar | Section 4 | £0 personal, about £25/mo if commercial (plan) |
| 4 | Crop rotation and planning across years | Planting rules | £0 |
| 5 | Containers and balcony mode | Mobile Assets | £0 |
| 6 | Accounts, cloud sync and shared plants | Supabase | £0 to about £20/mo (plan) |
| 7 | Satellite tracing to set up a garden faster | Mapbox | Free tier, then usage-based; check caching terms |
| 8 | Paid tier and app stores | RevenueCat, EAS, store accounts | See stages 4 and 5 above |

**Parked indefinitely until the product works:** the 7-stage state machine, haptics, nightly weather cron, global expansion and the investor figures. Revisit the financials only once you have real usage numbers to put in them.
