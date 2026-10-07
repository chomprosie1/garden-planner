# Twenty UX changes for Garden Planner

## Context

The app now does a lot: a to-scale plan, life stages, the Potting Shed, the year scrubber, lenses, greenhouses, degree days, weather, batches and What's new. Each was added as its own stage, so the app has grown screen by screen rather than being designed as one product. The target users are Gen Z, millennials and tech-confident older gardeners ("technograns"). They're comfortable with apps like Canva, Strava and Spotify, and they expect:

- one obvious thing to do next;
- progressive disclosure rather than forms;
- photos and sharing;
- plain words;
- an app that feels installed, not like a website.

**What's in the way today** (from reading the code):

- **Overlap and buried pages:**
  - Home and Month both list the month's jobs.
  - The Potting Shed sits under Month, the sowing list at the bottom of Month, and the journal under Home.
- **Settings mixes two worlds:** device appearance (five looks, photos, photo month, text size, shadows) and garden science (latitude and longitude numbers, a north angle, frost dates, degree days, spacing).
- **A busy plan toolbar:**
  - The header holds search, lock, fit, undo, redo, details and the photos button.
  - Six lens chips sit on top of that.
  - There's a separate SunBar with its own date, beside the year scrubber.
  - The details panel is a long stack of collapsible sections.
- **A maintainer's workflow shown to everyone:** "Check the plants", "Checked plants only" and "the starter plants are drafts" are your data-maintenance workflow.
- **Onboarding asks for taste before value:** it picks a look before you've grown anything, and location means typing coordinates.

**Goal:** fewer places to look, one clear next action everywhere, rich features one tap deeper, and more delight (photos, progress, sharing), without losing precision.

**Assumptions:** the app stays free, serverless and private by default. Accounts and sync are noted at the end as a bigger bet, not one of the 20.

Sizes: **S** an evening or two · **M** about a week · **L** two weeks or more.

---

## A. Find your way: navigation and structure

### 1. Four tabs: Today · Garden · Seedlings · Plants (M)
- **Change:**
  - Home and Month merge into **Today**.
  - **Plan** becomes **Garden**.
  - The Potting Shed is promoted to its own tab, **Seedlings**.
  - **Plants** stays.
  - Settings moves behind a gear (or the garden's name) at the top of Today.
- **Why:** every important place is one tap away and named for what you do there. "Month" and "Home" overlap, and the shed is where people go most in spring but it's buried.
- **Where:**
  - `src/ui/App.tsx`: `NAV` and `PARENT`.
  - `src/theme/prefs.ts`: `VIEWS`. Keep the old hashes (`#/home`, `#/month`, `#/plan`, `#/shed`) as aliases so links still work.

### 2. Today: a weekly feed, not a monthly list (M)
- **Change:** Today shows, in order:
  1. Alerts: frost, and seedlings ready.
  2. **This week**: up to five jobs, tickable.
  3. A quick "Add a note or photo".
  4. Coming up next week.

  The full month and next month move behind a "Calendar" switch on the same tab.
- **How:** this week's jobs combine `jobsFor` (`src/calendar/jobs.ts`) with dated steps from `timeline` (`src/lifecycle/projection.ts`) that land in the next 7 days, such as "Tomatoes probably ready from Thu" or "Batch 2 of lettuce due". This also delivers the wishlist item "jobs by the week".
- **Where:**
  - `src/ui/views/Home.tsx` and `src/ui/views/Month.tsx` merge.
  - The cards in `src/ui/HomeCards.tsx`, `src/ui/WeatherCards.tsx` and `src/ui/ShedCards.tsx` are reused.

### 3. A "Your garden" profile, separate from Settings (S)
- **Change:** location, north, frost dates, Your climate, weather, spacing style, the garden's name and backups move to a **Your garden** sheet, opened by tapping the garden's name on Today or Garden. Settings keeps only this device's preferences, What's new, credits and help.
- **Why:** facts about a garden and taste in colours are different jobs. People look for "my garden's location" on the garden, not in Settings.
- **Where:** split `src/ui/GardenSettings.tsx` out of `src/ui/views/Settings.tsx`.

### 4. "Want to grow": a heart on every plant (S)
- **Change:** the sowing list becomes **Want to grow**:
  - a heart on plant cards, search results and the dock's plant drawer;
  - its own filter chip in Plants.

  It keeps feeding sowing jobs, empty-bed ideas (`fillersFor`) and batches.
- **Why:** "save for later" is a pattern every target user knows. Today the list is a form at the bottom of Month.
- **Where:**
  - `garden.wishlist` and `toggleWishlist` in `src/calendar/jobs.ts`;
  - `src/ui/PlantCard.tsx`, `src/ui/views/Plants.tsx`, `src/ui/Dock.tsx`.

### 5. Hide the plant-checking tools behind an editor switch (S)
- **Change:**
  - "Check the plants", the "Checked plants only" filter, "drafts" wording and source lines move behind a **Plant editor** switch, off by default.
  - Users see a quiet "Report a mistake" link on plant cards instead.
- **Why:** the checking workflow is how you maintain the data, and to everyone else it reads as "this app's facts might be wrong".
- **Where:** `src/ui/views/Settings.tsx` (the Plant notes card), `src/ui/views/Plants.tsx` filters, `src/ui/views/CheckPlants.tsx`, `src/ui/PlantCard.tsx`.

---

## B. Get started in a minute

### 6. Postcode or place search, not latitude and longitude (S)
- **Change:** "Where's your garden?" takes a postcode or town, with suggestions, plus "Use my location". The coordinates still drive sun, frost and climate but are never shown (they stay under "Advanced" in Your garden).
- **How:** the Open-Meteo geocoding API is free, keyless and from the provider already in use, so it adds no new privacy party. postcodes.io can handle UK postcodes.
- **Where:** `UseLocationButton` and the location fields in `src/ui/GardenSettings.tsx`; `src/ui/Onboarding.tsx`.

### 7. Onboarding that starts with your plants, not your look (S)
- **Change:** the steps become:
  1. Where's your garden?
  2. What space? (the existing `SpacePicker`)
  3. What do you want to grow? Tap 3–8 from a visual grid of popular, easy plants, which fills Want to grow (change 4).
  4. Done, landing on Today with real jobs.

  The look picker moves to Settings, and the default follows light or dark mode.
- **Why:** value in the first minute. The current flow asks for a theme before you've grown anything.
- **Where:** `src/ui/Onboarding.tsx`, `src/ui/SpacePicker.tsx`, `src/model/spaces.ts`.

### 8. Starter kits: plans you can drop in (M)
- **Change:** ready-made kits:
  - Salad balcony
  - Herb window box
  - First veg bed
  - Pollinator patch
  - Half allotment

  Each lays out beds or pots with planned plantings (salads already in batches), adds them to Want to grow, and opens the year scrubber on harvest time.
- **Why:** templates are how this audience starts in Canva and Notion. A blank to-scale plan is intimidating.
- **Where:**
  - `src/model/spaces.ts` (`makeSpace`) and `src/model/stickers.ts` for layouts;
  - `splitIntoBatches` in `src/planting/batches.ts`;
  - the onboarding and empty-plan buttons in `src/ui/views/Plan.tsx`.

### 9. Set north with your phone's compass (S)
- **Change:** on a phone, "Point your phone along the top of your plan" reads the compass (`DeviceOrientationEvent`, with an iOS permission prompt), corrected to true north.
- **Why:** "degrees clockwise from the top of the plan" is the most abstract field in the app, and sun and shade depend on it.
- **Where:** the north fields in `src/ui/GardenSettings.tsx` and the north step in `src/ui/setup.ts`.

---

## C. A calmer Garden (plan) screen

### 10. A lighter toolbar and one "Show" switcher (S)
- **Change:**
  - The header keeps only search, undo and the lock.
  - Redo, fit, photos and details move to a "⋯" menu, with their keyboard shortcuts kept on desktop.
  - The six lens chips become one **Show: Plan ▾** switcher on phones (Plan, Sun, Shade, Flowers, Harvest, Water), showing which is on. Desktop keeps chips but drops "Plan" as a chip, so tapping the active lens again turns it off.
- **Where:** the toolbar in `src/ui/views/Plan.tsx`; `LensBar` in `src/ui/Lenses.tsx`.

### 11. One timeline for everything (M)
- **Change:** the year scrubber sets the day for every lens, including Sun and Shade. Shade adds only a time-of-day slider. The SunBar's own date picker goes.
- **Why:** two controls for "when" is confusing, and "this garden in July at 6 pm" should be one gesture.
- **Where:** `src/ui/SunBar.tsx` folds into `src/ui/YearScrubber.tsx`; `sunDate` in `src/ui/views/Plan.tsx` follows `when`.

### 12. Planting panel: headline first, detail one tap deeper (M)
- **Change:**
  - The top of the panel shows the plant, its stage chip, the next milestone ("Ready to harvest from about 2 Aug"), and one big primary button (change 13).
  - Below that are three tabs: **Care** (advice, checks, batches, spacing details), **Timeline** (the stage rail with dates and photos) and **Notes**.
  - The collapsible sections go.
- **Where:** `PlantingPanel` and `Section` in `src/ui/Inspector.tsx`; `src/ui/StageStrip.tsx`.

### 13. "What's happened?" in one tap (M)
- **Change:** one button opens quick chips that fit the plant's path: It's up · Planted out · Flowering · First pick · Finished · Didn't come up. Each takes an optional photo and note in the same sheet. This replaces the stage button, the "Change stage…" menu and the separate notes form.
- **Why:** logging should feel like posting a story, not filling in a form. It's also the habit that keeps projections accurate.
- **Where:**
  - `setStage`, `markFailed` and `pathFor` in `src/lifecycle/stages.ts`;
  - `addNote` in `src/model/notes.ts`;
  - photos via change 15.

### 14. First-visit tips on the plan (S)
- **Change:** three dismissible coach marks the first time the plan is opened:
  1. Tap to pick and drag to move.
  2. The lock.
  3. Drag the timeline to see the year.

  They replace the long hint line under the plan on desktop. The plan-refresh doc already asked for a "What's new" showing these gestures.
- **Where:** `hintFor` in `src/ui/views/Plan.tsx`; a new `seenTips` field in `src/theme/prefs.ts`.

---

## D. Delight: photos, progress and sharing

### 15. A photo diary (M)
- **Change:** add photos (the camera on a phone) to notes and plantings. A planting's Timeline tab shows them by date, and the journal becomes a photo grid with notes.
- **Why:** this audience documents and shares what it grows. It also makes the journal worth opening.
- **How:**
  - Images are stored in IndexedDB like the trace photo (`src/storage/idb.ts`), resized on the device, and kept out of the saved garden JSON by id.
  - Backups get an optional "with photos" file.

### 16. A harvest log (S)
- **Change:** "First pick" and later picks take a quick amount (a handful, a bowl, a basket, or grams). Totals show per crop and per season, with a "This season: 6.2 kg picked" stat on Today.
- **Where:** a new optional `Planting.picks` (schema 10); the harvest job tick in `toggleJob` (`src/calendar/jobs.ts`).

### 17. "Your season, wrapped" (M)
- **Change:** in late autumn (or on demand), a set of story-sized cards: what you grew, first and last harvest, kilos picked, your busiest month, best photo, and what to try next year. Each card can be shared.
- **Why:** made for this audience, and it brings people back each year.
- **Where:** reuse `src/share/poster.ts` (framing and the share sheet) and `src/ui/ShareDialog.tsx`; data from `timeline`, the harvest log and photos.

### 18. Install it, use it offline, get reminders (M)
- **Change:**
  - Add a web app manifest and a service worker so it installs to the home screen with an icon, opens full-screen and works offline.
  - Add an "Install the app" prompt on Today.
  - While installed, offer reminders for frost (from `frostWarning`, `src/lifecycle/frostWatch.ts`) and a weekly "3 jobs this week" nudge.
- **Limits:** true push while the app is closed needs a server. Without one, reminders fire when the app is opened or on platforms that support periodic background sync. Say so on screen.
- **Where:** `index.html`, `vite.config.ts` (a plugin or a hand-written service worker), `src/main.tsx`.

---

## E. Simpler words and settings

### 19. Fewer appearance knobs (S)
- **Change:** Settings shows the look (one scrolling row of five) and Light/Dark/Auto. Seasonal photos, photo month, soft shadows and text size go under "More display options". Follow the device's text size and reduced-motion settings by default.
- **Where:** `src/ui/views/Settings.tsx`, `src/ui/LookPicker.tsx`, `src/theme/prefs.ts`.

### 20. A plain-words pass, with a test to keep it (S)
- **Change:**
  - Never show "degree days", "latitude", "lens", "vegetative" or "transplanted". "Warmth for growing: 2,147 degree days" becomes "A typical growing season for England: about 300 days".
  - Explain "hardening off" in a line the first time it appears.
  - Add short "?" explainers where a term can't be avoided.
  - Run a scan over UI strings, like the existing What's new jargon test in `tests/weather.test.ts`, so it stays that way.
- **Where:** `STAGE_LABEL` in `src/lifecycle/stages.ts`; `Warmth` in `src/ui/GardenSettings.tsx`; `src/ui/Lenses.tsx` legends; a new `tests/words.test.ts`.

---

## Bigger bets, not in the 20

- **Accounts and sync across devices**, plus **sharing a garden with a housemate or family**. Losing a garden to cleared browser data is the biggest risk for this audience. Both need a backend (the MVP plan priced Supabase at £0–20 a month) and a privacy policy, so they deserve their own decision.
- **A small "Report a mistake" inbox** for plant data (change 5), which needs somewhere to send reports.

## Suggested order

1. **Release 1, foundations (about 2 weeks):** changes 1, 3, 5, 10, 19 and 20. Structure and calm, no new features. Do these first, as everything else lands in the new places.
2. **Release 2, first minute (about 2 weeks):** changes 6, 7, 8 and 9.
3. **Release 3, daily use (about 3 weeks):** changes 2, 4, 11, 12, 13 and 14.
4. **Release 4, delight (about 3–4 weeks):** changes 15, 16, 17 and 18.

Each release gets a What's new entry, per the definition of done in `docs/build-plan.md`.

**How to work through it (agreed):** build the releases in this order. At the end of each one: tests and build pass, the build plan gets an "as built" section and the What's new entry is added, then **commit and push** (which deploys), check the deploy run, and move on to the next release.

## Testing

- **Before building:** a clickable mock-up of the four tabs, Today and the new planting panel, as was done for the looks. Then the plan-refresh test with five people aged 20–35 plus one or two technograns, on their own phones. Measures:
  - the first plant placed and its first job seen within 2 minutes;
  - this week's jobs found without help;
  - a stage logged with a photo in under 10 seconds;
  - the Potting Shed found without being told.
- **After each release:**
  - `npm test` and `npm run build`;
  - headless Edge screenshots at 390 and 420 px wide, which also catch the right-edge clipping already on the wishlist;
  - one check on your phone;
  - old `#/` links still work;
  - a schema migration test for any model change (change 16).
