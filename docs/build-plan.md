# Garden Planner: staged development plan

## Context
`Garden_Planner/Garden Planner Mini MVP Plan.md` sets out what the MVP is for and how its success is judged. This plan says how to build it, stage by stage, with tasks, files, tests and a done-when for each stage. It folds in the fixes from my review of the MVP plan: contradictions in the timeline and gates, model gaps, and the SunCalc licence (it's BSD‑2‑Clause, not MIT).

Decisions settled:
- **Own repo** (`chomprosie1/garden-planner`) with its own GitHub Pages site.
- **Draw on desktop, use on phone.** Drawing and editing are built for mouse and keyboard. Viewing, plant cards, notes and the job list must work at phone width with touch pan and zoom.
- **Plant data: I draft, you verify.** Entries ship marked `verified: false` until you check them.

Pace assumed: part-time evenings, about 6–8 h a week. Start Tue 6 Oct 2026, build done around week 10–11 (mid-December), gate 3 on **31 Mar 2027**.

> **Since 6 Oct 2026:** Stage 1.5 (look and feel) was added after Stage 1, so Stages 2 to 6 run about 1.5 weeks later than the week numbers below. Gate 3 is unchanged.

---

## Stage 0 — Fix the MVP doc and set up the repo (1 evening)
- Apply the review fixes to the MVP doc:
  - Data entry starts in week 2.
  - Gate 1 = "draw your garden, find, read and add plants". Filling beds moves to gate 2.
  - Correct the stale "later" labels in the library table.
  - Add a week column to the phase table.
  - Remove the broken `embedded content` placeholder.
  - SunCalc → BSD‑2.
  - Add the model changes from Stage 1.
  - Gate 3 dated 31 Mar 2027.
  - On-screen notes for the UK-average calendar and flat ground.
- `Garden_Planner/` sits inside the family-games working tree. Make it its own git repo in place, and add `Garden_Planner/` to family-games' `.gitignore` so the two repos never mix. (This is a one-line change to family-games; I'll show it before committing.)
- Move the MVP doc to `docs/mvp-plan.md` in the new repo.

## Stage 1 — Foundations (week 1)
**Goal:** an empty app deployed to your phone, with the data model, saving and tests in place before any feature exists.

Tasks
1. Scaffold Vite + TypeScript (strict) + Vitest. Use plain TS for the canvas and **Preact** (about 4 KB) for side panels and forms. There are a lot of forms, and hand-written DOM updates get painful fast.
2. GitHub Actions workflow: on every push to `main` → `npm ci && npm test && npm run build` → `actions/deploy-pages`. Set Vite `base: '/garden-planner/'`.
3. Data model in `src/model/types.ts`. These are the MVP doc types plus the review fixes:
   - `Garden.schemaVersion`, `Garden.jobsDone: { key: string; date: string }[]`
   - `type Point = [x: number, y: number]`, integer mm, origin at the canvas's bottom-left corner, y up. North comes only from `northRotationDeg`.
   - `Feature`: `name?`, `deciduous?`, `opacityInLeaf?`, `opacityBare?` (in place of the single `opacity`), and `canopy?: { centre: Point; radiusMm: number }` for trees.
   - `Planting`: `count?`, `layout?: 'single' | 'row' | 'block'`, `endPoint?` (for rows), `removedOn?`
   - `Plant`: `sowing` becomes an array, plus `plantOutMonths?`, `verified: boolean` and `image?: { url; credit; licence; sourceUrl }` (open licences only). Companion lists hold **plant ids**. User plant ids start with `user-`.
4. `src/model/store.ts`: one store holding `Garden` and user plants. It has `subscribe`, and every change goes through `apply(change)`. Undo and redo keep up to 100 earlier states; state is never mutated, so unchanged parts are shared and history is cheap.
5. `src/storage/`:
   - `local.ts`: autosave the garden and user plants to localStorage, debounced.
   - `idb.ts`: IndexedDB for the background image only.
   - `file.ts`: export and import JSON. Import goes through `migrate.ts`, a switch on `schemaVersion`, and validates before replacing anything.
6. `src/geometry/`: point-in-polygon, polygon area, distance, snap to grid, convex hull, and line → thick polygon (for fences and walls). These are pure functions with unit tests.
7. App shell: canvas area plus a side panel on desktop. At phone width (< 700 px) the panel becomes a bottom sheet. Include a "Garden / Plants / This month / Notes" tab bar.

Tests: geometry unit tests; the export → import round trip is lossless; migrating a v0 fixture works.
**Done when:** the Pages URL loads on your phone, an edited garden name survives a reload, and CI is green.

## Stage 1.5 — Look and feel (capped at 1.5 weeks)
**Goal:** the app feels like a garden book, not a form, before more screens are built on top of it. Full design: [look-and-feel-plan.md](look-and-feel-plan.md). Mock-ups: https://claude.ai/artifact/HZ2596eLZtiqVTwoUtrX3B

- **Five looks** (Cottage, Heritage, Allotment, Modern, Minimal), each with light and dark, as tokens in `src/theme/looks.ts`. That file also holds a plan palette and plan style per look, for Stage 2's renderer.
- **Fonts:** self-hosted (`@fontsource`, all Open Font License), loaded only for the look in use (`src/theme/fonts.ts`).
- **Preferences** per device (`src/theme/prefs.ts`): look, light/dark/auto, photos full/subtle/off, photo month, text size, Focus. Applied by `src/theme/apply.ts`. An inline script in `index.html` paints the right background before load.
- **Navigation:** Home, Plan, Plants, Month, Notes, plus Settings. A rail on desktop, a tab bar on phones, kept in the URL hash.
- **Home** in five layouts (hero, framed print, seed packet, sheet, band), with the month's line and general UK jobs (`src/content/seasons.ts`). Ticks are saved in `garden.jobsDone`.
- **Plan workspace:** the photo in the margins, a Focus toggle (F key), and an empty sheet ready for Stage 2.
- **Appearance settings** with live preview cards; a **first-run** flow (welcome, choose a look, name and locate the garden); a "Welcome to November" note when the month changes.
- **Photos:** `tools/add-photo.ts` reads the licence and author from Wikimedia Commons, refuses anything outside PD, CC0, CC BY and CC BY-SA, and writes AVIF and WebP at 640, 1280 and 1920 px plus a manifest entry. A Credits section lists every photo and font.
- **Tests:** WCAG AA contrast for every look in both modes (`tests/contrast.test.ts`), plus licence, credit and size budget for every photo (`tests/photos.test.ts`).

**Done when:** all five looks work on your phone in light and dark, every month has a chosen and credited photo, and all tests pass.

## Stage 2 — Garden canvas and layout (weeks 2–3)
**Goal:** your real garden drawn to scale, within about 5% of tape measurements.

- **2a Viewport** (`src/canvas/viewport.ts`): world mm ↔ screen transform, wheel zoom around the cursor, drag pan, pinch zoom and pan on touch, a grid that adapts to zoom (100 mm / 1 m / 5 m), a scale bar, and canvas sharpness on high-DPI screens.
- **2b Boundary tool**: click vertices with snapping (to the grid, to existing vertices, and to 0/45/90°). **Type exact lengths** while drawing ("3450 Enter"), since this is what makes 5% achievable. Drag vertices to edit, double-click to add one, Delete to remove one.
- **2c Feature tools**: rectangle (beds, buildings, greenhouse, compost), polygon (anything), line with thickness (fence, wall, hedge, path), and circle (tree canopy, water butt). A properties panel holds kind, name, height and opacity, with sensible defaults per kind, e.g. a fence of 1800 mm at opacity 1, and a deciduous tree with opacity 0.7 in leaf and 0.2 bare.
- **2d Orientation**: a draggable north arrow (sets `northRotationDeg`), latitude and longitude typed in or taken from the browser's location, and a hint to check true north against a map.
- **2e Trace image** (optional): load a photo, calibrate the scale by clicking two points and typing the real distance, and set its opacity. The image is stored in IndexedDB and never goes into the JSON export.
- **2f Selection**: select, move, duplicate, delete, undo and redo (Ctrl+Z / Ctrl+Y), and a layers list in the side panel.
- Do the "smallest test" here: one bed to scale, checked against a tape, before polishing anything else.

Tests: viewport transform round trips; snapping; command undo and redo. Then compare tape and app on 5 real measurements.
**Done when:** your boundary, beds and main features are within 5% of the tape and survive a reload. On a phone you can view, pan and zoom.

## Data track — plant library content (weeks 2–9 and after, running in parallel)
- Files: `data/plants/<category>.json`. They are checked by `tests/plants.test.ts` (a `tools/validate-plants.ts` script was planned but the test does the job). It uses `validatePlant` plus checks for months 1–12, companion ids that resolve, a unique id per plant, and source present. It runs in CI with the rest of the tests.
- Batches:
  - **B1**: 30 common vegetables, by week 3 (needed for gate 1)
  - **B2**: 30 more vegetables, by week 5
  - **B3**: 30 herbs and fruit, by week 7
  - **B4**: 30 flowers, by week 9
  - **B5**: 30 shrubs, trees and gaps, after the build: done in release 9 (25 shrubs and 10 climbers; ornamental trees are structures)
  - **Done so far (6 Oct 2026):**
    - B1: the 30 vegetables.
    - A combined B2–B4 batch of 70 more plants:
      - 12 vegetables;
      - 14 herbs (`herb.json`);
      - 14 fruit (`fruit.json`), including the main fruit trees;
      - 30 flowers (`flower.json`): annuals, bulbs and perennials.
    - That's 100 plants in all.
    - Flowers use a new optional `flowerMonths`, shown as "In flower" on the card.
    - Every entry is unchecked, with a suggested source. Poison warnings are marked "(check)".
  - **Close spacing (6 Oct 2026):**
    - 58 vegetables, herbs, strawberries and annual flowers have a `closeSpacingMm`: the even spacing each way that home gardeners use in beds, from square-foot and deep-bed guidance.
    - Gardens default to close spacing; Settings → "How you space plants" switches to traditional rows (`garden.spacing`).
    - With close spacing, rows and blocks use the close figure each way, warnings use it, and plants are drawn no wider than it.
    - Fruit trees, canes and shrubs keep their usual spacing.
    - Plant cards show both: "In a bed" and "In rows".
- Workflow per batch: I draft the entries in my own words, each with a suggested source and `verified: false`. You check them against RHS, seed packets or books and fix anything wrong. Then you flip `verified` to true and set `lastChecked`.
- Pest controls are cultural and organic only, with no chemical product names. Mark toxicity notes "check".
- Plant the things you actually grow first, so gate 2 tests real beds.

## Stage 3 — Plant library UI (weeks 3–4) → Gate 1
- `src/library/`: load the JSON files and merge in your own plants. Search by common or Latin name, with filters for category, light, "sow this month" and "verified only".
- Plant card: every field in grouped sections (conditions, size, sowing, plant out, harvest, look out for, pests, companions, wintering, provenance). Unverified entries show a badge. Cards are readable on a phone.
- Add/edit plant form: four required fields (name, category, light, spacing), with the rest in collapsible optional sections. Duplicate a library plant to make your own variety.
- Your own plants travel in the export.

**Gate 1 (end of week 4):** your real garden is drawn within 5%, and you can find, read and add plants without help. If it fails, fix the drawing and library screens before anything else.

## Stage 3.5 — Drawing on a phone (added 6 Oct 2026)
**Goal:** everything you can draw on a computer, you can draw on a phone, accurately. Gardens get measured standing in them, phone in hand.

- **Crosshair drawing:** a fixed crosshair at the centre of the plan. One finger drags the plan under it and two fingers zoom; **Add corner** places a corner exactly under the crosshair. It snaps to corners, 45° and the grid as on desktop, and shows the length from the last corner live.
- **Type length:** the number pad places the next corner that far along the crosshair's direction, then the plan re-centres on the new corner.
- **By size:** beds, buildings and other areas can be placed from a width and depth, centred on the crosshair. Trees are placed from their spread.
- **Selecting and editing by touch:** tap to select. Once something is selected, drag it to move it, so panning never moves things by accident. Corners get bigger touch handles; double-tap an edge to add a corner.
- **Bottom sheet:** the same details panel as desktop, which expands or collapses; the tool tray stays below it while collapsed. A **Garden** button opens the feature list, north and the trace photo.
- **Canvas resizes** keep the same spot in the middle, so the crosshair never drifts when the drawing bar changes height.

**Done when:** you can draw your real boundary and beds on your phone, standing in the garden, as accurately as on a computer.

## Stage 4 — Planting (week 5)
- Placement: drag a plant from the library onto a bed. The plant must land inside the bed's polygon. Choose single, row (click start and end, then the count is worked out from spacing) or block (fill a rectangle at the plant's spacing). Each plant is drawn as a circle of its spread.
- `src/planting/rules.ts`, pure functions returning `Warning[]`:
  - spacing: plants closer than their spacing
  - outside bed
  - companions: an "avoid" pair within the same bed or within 1 m flags a warning, a "good" pair shows a tick
  - light: a placeholder until Stage 6
- Warnings panel, with each warning highlighted on the canvas.
- Notes: dated notes on any bed or planting, with a notes tab listing them newest first.
- "Clear bed / harvested": sets `removedOn`, and history stays in the model.

As built:
- **Placing.** The Plant tool (G) works three ways: click in a bed; drag a plant from the list onto a bed; or, on a phone, use the crosshair with "Plant here", "Start row here" and "End row here". A row's length can be typed. The Plants tab has "Plant in a bed". A planting belongs to the bed under its middle, and moving it into another bed hands it over.
- **Positions.** These are worked out from spacing, never stored one by one:
  - A row has a plant at each end, and its count can be changed.
  - A block is a grid, half a spacing in from its edges.
  - One planting holds at most 5,000 plants.
- **Rules** (`src/planting/rules.ts`, with all the numbers in each message):
  - **Spacing:** half of each plant's need. Across a row, that is its row spacing; along a row, for single plants and for blocks, its plant spacing. A squeeze of up to 10% is allowed.
  - **Outside the bed:** a plant on the bed's edge still counts as in it.
  - **Bed deleted:** a planting whose bed has gone is flagged.
  - **Neighbours:** an "avoid" or "good" listed by either plant counts. Each pair of plants is reported once per bed, however many rows there are.
  - **Light:** still an empty placeholder.
- **Beds.** Moving or duplicating a bed takes its plants with it. Deleting a bed removes its plants and notes, and undo brings them back. The bed panel shows "Growing here", "Cleared / harvested", "Grown here before" (with "Put back") and the bed's notes.
- **Warnings.** A "! n" button in the toolbar, a "Plant checks" list on the garden panel, and checks on each bed and planting. Picking a warning outlines the plants involved on the plan and zooms to them.
- **Notes tab.** All notes, newest first, filterable by bed, with general garden notes as well.

Tests: rule fixtures (e.g. carrots too close; onions next to peas → avoid).
**Done when:** a real bed is filled, and the app flags real spacing and clash problems with no false alarms you can't explain.

## Stage 5 — Garden calendar (week 6) → Gate 2
- `src/calendar/jobs.ts`: `jobsFor(garden, plants, month) → Job[]`.
  - It covers active plantings (not removed) and plants you mean to sow (from a simple "wishlist" of plant ids kept in the garden).
  - Job kinds: sow indoors, sow direct, plant out, harvest, protect for winter, lift and store, autumn tidy.
  - Each job has a stable key such as `sow-direct:carrot:2026-11`, so ticking it off writes to `jobsDone`.
- "This month" view plus a "next month" preview, grouped by job kind, readable on a phone. Show "Dates are UK averages; adjust for your area" on screen.

As built:
- **Plants on the plan** are grouped by plant and bed, so three carrot rows make one job.
  - **Not yet sown:** they get sow jobs (indoors, or outside) and plant-out jobs.
  - **Ticking a sow or plant-out job** dates the plantings.
  - **Once dated:** they get harvest; "protect for winter" in October for plants that need it; "lift and store" when the harvest ends; and "clear and tidy" the month after the harvest ends, for annuals.
- **Repeats:** a sowing or plant-out job you've ticked doesn't come back for the next 11 months.
- **Sowing list** (`garden.wishlist`): sow and plant-out jobs for plants not yet on the plan. Add plants on the Month screen or with the plant card's "Add to sowing list".
- **Month screen:**
  - Your jobs grouped by kind, with ticks.
  - The general UK jobs under "Around the garden".
  - "Coming up next month", for both.
  - The sowing list.
- **Home** shows your own jobs when you have any, and the general UK jobs otherwise.

Tests: job fixtures for a month for 5 known plants.
**Gate 2 (end of week 6):** spacing and clash warnings are right for a real bed, and the month list matches what you'd actually do. If it fails, fix the plant data and rules before adding layers.

## Stage 6 — Sun and shade (weeks 7–8, hard cap of 2 weeks)
- **6a** `src/sun/position.ts`: wrap SunCalc and convert to garden coordinates using `northRotationDeg`. All times are in Europe/London via `Intl`. Unit-test against NOAA values for your latitude, including midwinter noon at 53°N ≈ 13.6°, and test both sides of the clock change (last Sunday of October and of March).
- **6b** `src/sun/shadow.ts`: the shadow vector = height / tan(altitude), along the anti-azimuth. For a feature, shadow = convex hull of its footprint plus the projected footprint (the footprints are convex or split into convex parts). Tree shadow = the canopy circle projected from canopy height. Opacity is in-leaf or bare depending on the month.
- **6c** Render shadows at the time on a date and time slider, with a play button and "today" and "midwinter / equinox / midsummer" presets.
- **6d** `src/sun/hours.ts`: a 250 mm grid over the boundary, sampled every 15 min from sunrise to sunset on a chosen day (the 15th of the selected month). Each sample adds (1 − blocking opacity) × 0.25 h. Run it in a Web Worker if it takes over about 300 ms, and cache it until a feature or the date changes.
- **6e** Heat map overlay (sequential palette with a legend), plus light suitability. Light thresholds: full sun ≥ 6 h, part shade 3–6 h, shade < 3 h, measured for the month the plant is in the ground (default June). These feed the `light` rule in Stage 4.
- As built:
  - **Shadows:** a shape's shadow is its footprint plus the band each edge sweeps along the shadow direction. This is exact for any outline, so no convex split is needed.
  - **Trees:** the canopy is treated as a disc from 35% of the tree's height up to its top.
  - **Leaves:** deciduous trees and hedges are in leaf from May to October.
  - **On top of things:** anything on top of a feature (a bed's plants, a shed roof) isn't in that feature's own shadow.
  - **Sun hours:** these use a scanline fill on the 250 mm grid. See-through shade multiplies, so two 50% hedges let a quarter of the light through. A 10 × 14 m garden with 12 features takes about 80 ms, so no Web Worker is needed. The result is cached until something that casts shade, or the location, changes, and it's worked out just after the screen has drawn.
  - **Screen:**
    - A Sun button (S) on the plan.
    - The sun bar: Shadows or Sun hours; today and the solstice and equinox presets, or any date; a time slider and play.
    - The sun marked on the compass, and a hover readout of hours at any spot.
    - Sun hours in June shown on beds and plantings.
  - **The light rule** uses 15 June. A plant is flagged when it gets a quarter of an hour or more below its own `minSunHours` (or 6 h for full sun, 3 h for part shade). A shade plant is flagged above 6 h.
  - **SunCalc** 2.1.1 (BSD 2-Clause): its licence text is in Settings → Credits.
- Stopping point: shadows match a photo at one time, and the heat map agrees for the main patches. Polish (soft edges, terrain, Clipper2 unions) waits until after gate 3.

**Done when:** one fence's shadow matches a photo, which needs a clear day, so take it whenever one comes. The heat map agrees for the main patches.

## Usability round (U1–U6), after Stage 6
The full review, against Nielsen's heuristics and aimed at members of the public, is in the approved plan. What changed:
- **U1, quick wins:**
  - Deleting a bed, a planting or a note, or clearing a bed, shows a message with **Undo**. Deleting a bed says what goes with it.
  - One set of words across the app: "Mark as cleared", "Clear this bed", "things on the plan", "Checked plants only", "Hide photos" (H) in place of Focus, and "Single · Row · Block".
  - Links between screens:
    - **Jobs → plan:** each job's "Show" opens its planting on the plan; sowing-list jobs get "About", which opens the plant card.
    - **Planting → plant card:** "About this plant".
    - **Plant card → plan:** "Growing in …".
  - Plant cards have their buttons at the top.
  - On a phone, tap the sun-hours map to read a spot.
- **U2, Plan modes:**
  - The plan is split into **Layout · Planting · Sun**, remembered per device. A new garden starts in Layout until it has a boundary.
  - Each mode shows only its own tools and panels. In Planting, beds can't be moved and plants can; in Layout it's the other way round. Sun is for looking only.
  - Phones get one bar per mode, with nothing scrolling sideways. A selection's sheet replaces the bar, so there are never more than two bars.
  - Shapes drawn on a phone report "Bed added" rather than opening their details over the tools.
  - Double-tap a bed in Planting, or use "Zoom to bed", to zoom in on it.
- **U3, planting status:**
  - **Planned · Sown · Growing · Cleared** (schema v3 adds `status: 'growing'`).
  - "Already in the ground" when placing plants; a status chip with the next step.
  - Growing plants skip sowing jobs. Ticking "plant out" marks plants growing.
- **U4, Home:**
  - Four tabs. Notes became the **Garden journal**, on Home and as a page of its own.
  - A **getting-started** list worked out from the garden (boundary, bed, location, north, plants, backup).
  - A live mini plan with the warnings count.
  - A backup reminder when there's something worth keeping and no backup in 30 days.
  - "Saved on this device", or a warning if the browser won't save.
- **U5, checking the plants:**
  - A one-at-a-time **Check the plants** page (Settings, or a plant card's draft notice): Looks right / Needs a change / Skip.
  - Checks are kept per device (`garden-planner:checks`) and count as verified everywhere.
- **U6, accessibility:**
  - "?" shows the keyboard shortcuts.
  - Plantings are reachable from the keyboard in the Planting overview's "Beds and plants" list.
  - The plan canvas can take keyboard focus and shows it.
  - Play and animations respect reduced motion.
  - Sun hours have contour lines at 3 h (dashed) and 6 h (solid), so the bands don't rely on colour alone.
  - Panels are split into collapsible sections that are remembered.
  - The warning colour was darkened to pass 3:1 on every look's paper and lawn; this is tested.

## Stage 7 — Real use and hardening (week 9 → 31 Mar 2027) → Gate 3
- Use it to plan the 2027 sowing. Keep a `docs/mismatch-log.md` of every time the app was wrong or awkward, and fix the worst each fortnight.
- Export a backup monthly. Keep each export so an old garden can be checked against the migrations.
- Small quality work only: speed on a phone, an empty-state help screen, and keyboard shortcuts.

**Gate 3 (31 Mar 2027):** did it change at least one real placement, planting or timing decision? If yes, continue with the "After the MVP" list, starting with the progressive web app. If no, stop or narrow the idea before spending anything.

## Stages 8–18 — Life stages, Potting Shed, a visual overhaul, a fresh plan, microclimates and GDD (added 6 Oct 2026)
Brought forward from "parked": the plant life cycle, frost and Growing Degree Days, plus a graphical overhaul. Stage 7 (real use) runs alongside them. The visual stages come first, so the shed, cards and dates built later use the new art. The shed should be ready before February sowing.

| Stage | What | Status |
| --- | --- | --- |
| 8 | Life stages, without weather | Built |
| 9 | Drawing upgrade: surfaces, curved edges, freehand shapes, sketch layer | Built |
| 10 | Illustrated plants, drawn by code, changing with the stage | Built |
| 11 | Depth and texture: material textures, raised-bed edging, soft shadows, cached static layer | Built |
| 12 | The Potting Shed, with shelves: trays, places, frost dates, plant out from a tray | Built |
| 13a | No modes: the padlock, the floating action pill, handles with typed sizes, rotate, smart guides | Built |
| 13b | The dock and stickers, the fill pop-over, pots and planters, dropping trays from the shed | Built |
| 13c | First run ("Where are you growing?") and search everything | Built |
| 14 | The garden through the year: scrubber, projected stages, gaps, job chips, lenses, share and timelapse | Built |
| 15 | Greenhouses and cold frames as microclimates | Built |
| 16 | Growing Degree Days from UK climate averages (capped at 2 weeks) | Built |
| 17 | Live weather (opt-in Open-Meteo) and succession sowing, plus What's new | Built |
| 18 | 3D garden view (three.js, loaded only when opened) | Moved to release 10 |

Stages 13a to 14 replace "Screens and cards polish" (the old Stage 13), from the proposal in [plan-refresh.md](plan-refresh.md). The stages after them moved up by one.

### Stage 8 — Life stages (as built)
- **Stages:** Sown · Up · Hardening off · Planted out · Growing · Flowering · Harvesting, then Cleared. "Planned" comes before sowing.
- **Each plant has its own path** (`src/lifecycle/stages.ts`, `pathFor`):
  - Sown indoors: every stage. Sown outside: no hardening off or planting out. Bought plants, bulbs and fruit start at planting.
  - A flowering stage only for plants where it matters: flowers, fruit, and fruiting vegetables (`lifePath.flowering` in the data). Lettuce flowering means it has bolted, so it has none.
  - Perennials (`lifePath.perennial`, and all fruit) start a new season after their last stage instead of ending.
  - Plants with both indoor and outdoor sowings ask which you did ("Sown indoors" / "Sown outside"), saved as `planting.sowing`.
- **Model:** schema 4. `Planting.stage` and `stageDates` replace `status: 'growing'`, which migrates to "planted out". The sowing date stays in `sownOn` and clearing in `removedOn`. Planned · Sown · Growing · Cleared is now worked out from the stage.
- **Moving on:** the planting panel shows a rail of stages with their dates, advice for the current stage, and one button to move on. "Change stage…" corrects a mistake (keeping the date each stage was first reached), and "Sowing failed" sets it back to planned with a note in the journal.
- **Advice:** `stageTips` in the plant data for 18 common crops (side shoots on tomatoes, earthing up potatoes, high-potash feed when fruiting crops flower), with general advice for the rest. No brand names.
- **Jobs:**
  - Ticking a sowing job records indoors or outside.
  - Ticking plant out marks plants planted out, and ticking the first harvest marks them harvesting. Jobs only ever move plants forward.
  - A new **Check progress** job asks you to confirm flowering in the month it's likely (its flower months, or the month before a fruiting crop's harvest starts).
- **Still to come:** a sharper guess from growing degree days (Stage 16), and seedlings off the plan in the Potting Shed (Stage 12).

Tests: `tests/stages.test.ts` covers paths, moving on and back, failed sowings, guesses, advice, jobs and the v3 → v4 migration (fixture `garden-v3.json`).

### Stage 9 — Drawing upgrade (as built)
- **Surfaces:** a new **Surface** tool (U) for lawn, gravel, paving, decking, bark chips, wildflower meadow or bare soil, picked from swatches under "Made of". Paths can be made of the same materials, or stay plain. Surfaces are drawn under everything else and picked last, cast no shade, and plants don't go in them. A surface is named after its material until you name it.
- **Textures:** drawn by code (`src/canvas/materials.ts`) on tiles tied to real sizes (600 mm slabs, 150 mm boards), so they stay to scale as you zoom. Colours come from each look's plan palette, nudged towards its paper, so they suit all five looks in light and dark. Minimal gets them too, as faint marks like the hatching on a technical drawing.
- **Curved edges:** a "Curved edges" tick on any area or line. The curve runs through the corners (centripetal Catmull-Rom, `src/geometry/curve.ts`), so dragging a corner reshapes it. A curved area keeps its corners in `controls`, and its `footprint` is the curve itself, so area, plant checks, shadows and sun hours all follow the curve. Turning curves off gives the corners back exactly.
- **By hand:** a "By hand" toggle on the drawing bar. Hold and drag round an area or along a line; the stroke is thinned to the corners that keep its shape (`src/geometry/simplify.ts`) and saved as a curve you can reshape. The boundary stays exact and is never drawn by hand. On a phone, "By hand" on the drawing bar switches to one finger drawing and two fingers moving the plan.
- **Sketch layer:** a **Sketch** tool (K) in Layout and Planting, with pen, highlighter, arrow, words and eraser, in ink, red, blue, green or yellow. Sketches are saved in the garden (`garden.sketches`), drawn above the plants, and never measured or checked. "Hide sketches" (per device) and "Clear all" (with undo). The eraser rubs out with one drag, as one undo step.
- **Model:** schema 5 adds the `surface` kind, `material`, `smooth`, `controls` and `sketches`, all optional.
- **Fixed on the way:** label halos had spiky mitred joins on sharp letters in some looks.
- **Not done:** the mock-up for you to choose from before building was skipped, as you asked for Stages 8 and 9 to be built straight away. Textures and colours are easy to tune if any look wrong on your phone.

Tests: `tests/drawing.test.ts` covers curves, simplifying strokes, curved features, surfaces, sketches and the schema 5 round trip.

### Stage 10 — Illustrated plants (as built)
- **Drawn by code** (`src/art/plants.ts`) from a few traits in each plant's `art`: its shape from above (rosette, clump, mound, upright, climber, sprawl, grassy, bulb, bush or tree), its leaves (broad, lobed, feathery, long and thin, needles or round), and the colours of its leaves, flowers and crop. Flowers can be small flowers, one big bloom, cups, spikes or round heads; crops can be fruit, a head, pods, a root or stems. No images, so nothing to license.
- **All 100 library plants** have a drawing (`art` in `data/plants/*.json`, unchecked like the rest of the data). Your own plants get one for their category until you choose, under "How it's drawn on the plan" on the plant form, with a live preview.
- **Stages show:** planned plants, and seedlings still indoors, are drawn faintly at full size, so a plan still reads as a plan. Sowings outside show seeds, then seed leaves. Plants are planted out small (bought plants and bulbs bigger) and grow to full size; flowers show when flowering, and fruit, heads, pods or roots when harvesting.
- **Every plant is a little different:** three variations per plant, each turned at random, fixed by its position so nothing changes between frames.
- **Each look draws in its own way:** a soft wash in Cottage and Allotment, ink lines in Heritage, flat colour in Modern and fine outlines in Minimal, in light and dark.
- **Detail by zoom:** a band of colour for a row or block too small to see apart, then a dot per plant, then the full drawing.
- **Speed:** drawings are cached as small images (`src/art/sprites.ts`) at a few sizes, per stage, look and variation, so zooming reuses them. With about 2,000 plants on screen, drawing takes a few milliseconds more than the old circles; the cached static layer in Stage 11 is where the frame budget is met.
- **Everywhere else too:** the same drawings on plant cards (a large one in a patch of soil), in the plant list, the plant picker, the planting panel and the list of beds and plants. They replace the old coloured dots, and `cropColour` is gone.

Tests: `tests/art.test.ts` checks every plant has a valid drawing, how each stage is drawn, that drawings repeat exactly for the same plant, and that every plant draws without error at every stage in every style.

### Stage 11 — Depth and texture (as built)
- **Soil in beds:** beds are filled with a soil texture in every look but Heritage, which keeps its survey hatching.
- **Bed edging:** timber boards, brick or stone (`feature.edging`), drawn as a rim just inside the bed's edge at its real width (50, 110 and 160 mm). New beds start with timber; existing beds are left as they were. "Edging" on the bed's panel changes it.
- **Hedges** have a leafy, clipped texture. **Trees** are drawn from above like the plants, with their spread still shown faintly so it can be measured; deciduous trees show bare branches from November to April. **Greenhouses** have a sheen across the glass.
- **Soft shadows:** everything with height casts a soft shadow, lit from the top left like a drawn plan: a little way, never more than half a metre, and fainter while you're drawing. Plants that stand up from the bed have a soft shadow under them too; seeds, seedlings and planned plants don't. They're off in Minimal and in the Sun view (which shows the real shadows), and "Soft shadows on the plan" in Settings turns them on or off.
- **Speed:** the plan is now drawn in two layers. What's on the ground (`renderStatic`) is drawn once into an image with a margin round the screen; panning moves the image, and wheel or pinch zooming stretches it until you stop, then it's redrawn sharp. Only the selection, drafts, crosshair, scale bar and compass (`renderLive`) are drawn every frame. In a garden of about 2,000 plants, zooming went from about 37 ms a frame to the screen's own 16.7 ms.

Tests: `tests/depth.test.ts` covers edging and the shadows setting.

### Stage 12 — The Potting Shed (as built)
- **Where:** a page under Month (`#shed`), reached from a Potting Shed card on Month, from "Sow in the shed" on plant cards and on sowing-list jobs, and from a "Ready for the garden" card on Home.
- **Places:** a windowsill, a propagator and shed shelves are set up when you first sow; you can add more shelves, windowsills, propagators, greenhouse benches and cold frames, rename them, change how many shelves and trays they hold, and remove empty ones. Each is drawn: planks behind the shelves, sky through the window behind the sill, a clear domed lid on the propagator, a glazed wooden frame for the cold frame. On a phone they're tabs, one at a time.
- **Trays:** sow a plant in a module tray, seed tray, 9 cm or 1 litre pots, or root trainers, with how many and where. Each tray is drawn from above with its seedlings at their stage: bare compost, seed leaves, then young plants. Drag a tray to another space (dropping on a tray swaps them), or pick it and tap an empty space; "Move to" in its details does the same from the keyboard.
- **Stages and what's next:** Sown → Up → Hardening off → Planted out. Each tray says what's next: when seedlings are due (from `germinationDays`, or one to three weeks), when it's late enough to worry, when to start hardening off, and when it's ready. "Sowing failed" removes the tray with a note in the journal.
- **Frost dates:** the last spring frost and first autumn frost (`garden.lastFrost`, `firstFrost`, "MM-DD") are estimated from the latitude, from about 20 April on the south coast to the end of May in the far north, and can be set in Settings. Tender and half-hardy plants start hardening off two weeks before the last frost and are ready after a week of it, and not before the last frost; hardy plants are ready after a week of hardening off. The "protect for winter" job now comes in the month before your first frost, not always October.
- **Planting out:** "Plant out" opens the plan with the Plant tool ready for that plant; placing it (a row by default) turns the tray into a planting in the bed with its sowing date and stages, marked planted out today, and the tray leaves the shed. One undo puts it back.
- **Sown for the plan:** plantings already on the plan that were sown indoors and aren't out yet are listed in the shed too, with the same "what's next" and buttons to move them on.
- **Model:** schema 6 adds `shedPlaces`, `trays`, `lastFrost` and `firstFrost` to the garden and `germinationDays` to plants, all optional.

Tests: `tests/shed.test.ts` covers dates and frost estimates, places and trays (filling, swapping, resizing), stages and what's next, planting out, the frost-timed winter job, and the schema 6 round trip.

### Stages 13a and 13b — Drop, drag, done (as built)
- **No modes:** Layout, Planting and Sun are gone. Tap or click anything to pick it, and drag to move it: a plant, a bed, the lawn. Plants sit on top of beds and are picked first, unless the bed is already picked, so a pot dropped on a row of lettuce can still be dragged off it.
- **The padlock** ("Lock the layout", saved per device as `layoutLocked`) stops beds, paths and the boundary moving or reshaping by accident; plants can still be moved. Trying to drag a locked bed says how to unlock it, and the pill offers "Unlock".
- **The action pill** sits beside whatever's picked and follows it as the plan moves, with only what fits:
  - **A planting:** move it on a stage, more or fewer plants in a row, About, Delete.
  - **A bed, pot or planter:** Plant, its size (tap to type an exact width and depth, or a pot's width), curved edges, edging, Duplicate, Delete.
  - **A surface or path:** what it's made of.
  - **More (···)** opens the details panel, or a sheet on a phone. On a narrow screen the pill shows the plant's icon instead of its name.
- **Handles:** dragging a rectangle's corner resizes it from the opposite corner and keeps it a rectangle, at any angle (Alt frees the corner). Edge lengths show while you drag.
- **Rotate:** a handle above any picked shape turns it in 15° steps (Alt for any angle). Plants turn with their bed; blocks keep their corners but stay square to the page. Width and depth can still be typed for a turned rectangle.
- **Smart guides:** moving something lines its edges and middle up with other things and the boundary, with a dashed line to show it and a light haptic tick on phones that have one.
- **The dock,** along the bottom on phone and desktop, with five drawers:
  - **Plants:** search, Sow or plant now, In the shed, Sowing list, Your plants, All plants.
  - **Beds and pots:** raised bed, small bed, border, pot, big pot, window box, trough, grow bag, greenhouse.
  - **Ground:** lawn, wildflower meadow, gravel, patio, decking, bark chips, path, pond.
  - **Structures:** shed, compost bin, fence, wall, hedge, tree, small tree.
  - **Draw:** the old precise tools (click corners, type lengths, the phone's crosshair), by hand, and sketching.

  Each sticker (`src/model/stickers.ts`) is drawn by the plan's own renderer at a real size. Drag it onto the plan, or tap it to drop it in the middle of the view; the first thing in an empty garden is zoomed to.
- **Dropping a plant into a bed** fills it the usual way for the plant (`src/planting/fill.ts`): carrots, onions, garlic and beans in a row along the bed through the drop point; a courgette, a fruit tree or anything with room for only one on its own; a window box or narrow trough gets one row; lettuce and the rest fill the bed at their spacing, shrunk until every plant is inside, so round pots and beds at an angle work too. A pop-over offers **One · A row · Fill the bed** for a few seconds. Tapping a plant then a bed works the same, and the planting bar still offers One, Row and Block for doing it by hand. Trays from the shed drop in the same way.
- **Pots and planters:** new kinds `pot` (round, drawn as a terracotta rim round compost) and `planter` (window box, trough, grow bag, with a dark rim). Plants go in them as they do in beds.
- **Lenses:** Plan · Sun hours · Shade chips above the plan (S still toggles shade). They replace the Sun mode; the warnings count sits on the Plan chip. The garden's details panel shows the sun overview first when a sun lens is on.
- **Empty plan:** "Start your plan" offers Beds and pots, or Draw the boundary. The boundary is optional, so a balcony can be a few pots; the Home setup step is now "Set up your space".
- **Model:** schema 7 adds the `pot` and `planter` kinds. Rotation turns the outline itself, so no angle is saved.
- **Not done:** equal-spacing guides, snapping to path widths, and tapping a length on the plan to type it (the pill's size does this). Rotating doesn't apply to round things.

Tests: `tests/arrange.test.ts` covers stickers, pots and planters as containers, the default fill for each kind of plant and bed, rows, fills in round pots and beds at an angle, rectangles at any angle, and turning beds with their plants.

### Stage 13c — Start in a minute, and search everything (as built)
- **Where are you growing?** The first run's first step, and a button on an empty plan: Balcony · Patio or yard · Garden · Allotment · Just a bed, each shown as a small picture of what it makes, then a width and depth in metres (an allotment offers a full plot, 10 × 25 m, or a half plot, 5 × 25 m). It lays the space out (`src/model/spaces.ts`):
  - **Balcony:** decking, a trough along the railing, and two pots.
  - **Patio or yard:** paving, a small raised bed, and pots.
  - **Garden:** a border along the top, one or two raised beds, and a lawn.
  - **Allotment:** beds across the plot with paths between, in its top 60%, and a compost bin; the rest is left open.
  - **Just a bed:** one raised bed and no boundary.

  Everything fits inside the space down to the smallest sizes offered. A garden still called "My garden" is named after the space. It's only offered for an empty plan, and the first run skips it for a garden restored from a backup. Going back and choosing again replaces what was made.
- **The first plant:** from a new balcony, Plants, a plant, and a tap on the trough plants a row: 3 taps on the plan, 8 from opening the app.
- **Search everything:** Ctrl+K anywhere, or the search button on the plan's header (on a phone too). One box finds:
  - **Actions:** go to any page, show sun hours or shade, lock or unlock the layout, fit the garden, draw the boundary, sketch, add any sticker, keyboard shortcuts, and "Set up your space" for an empty plan;
  - **On your plan:** beds, surfaces, plantings (with the bed they're in) and the boundary, which it selects and shows;
  - **Plants:** "add tomato" puts it on the plan ready to drop into a bed, "sow basil" sows it in the Potting Shed, "about basil" opens its card.

  Every word must start a word in the result, little words ("the", "to") are ignored, and the result's own name counts most (`src/ui/search.ts`). Arrow keys and Enter work; results are grouped, a few of each.
- **Not done:** recent searches, and searching jobs and journal notes.

Tests: `tests/start.test.ts` covers each space at its usual and smallest sizes, allotment plots, naming, and search: verbs, things on the plan, stickers, the lock, suggestions and empty results.

### Stage 14 — The garden through the year (as built)
- **The year scrubber** under the plan: weeks from a year ago to a year ahead, months labelled (January shows its year), today marked. Drag it, or press play for a ten-second year (with reduced motion, four weeks at a time, more slowly). "Back to today" returns. The Sun and Shade lenses use the same day.
- **Each planting at its stage that week** (`src/lifecycle/projection.ts`):
  - Up to today, it's what you've marked: sowing, each stage's date, and clearing. A planting cleared since comes back when you scrub to before it was cleared.
  - After today, it carries on from its latest stage with the plant's usual months: germination days, hardening off and planting out (after the last frost for tender plants, as in the shed), then flowering or harvest, whichever comes first. An annual is cleared after its harvest months, or after about six weeks for one sowing of a quick leafy crop; a perennial goes round again. A planned planting starts at its next sowing (or planting) month.
  - Steps that are overdue all land tomorrow, so a planting not updated since spring shows where it probably is now.
  - Guessed stages have a dotted edge, and lens legends say "Based on usual months". Stages you've marked always win.
- **The plan changes with the season:** deciduous trees in leaf or bare, the lawn greener in spring and paler in a dry August, frost sparkle between your first and last frost dates, and soft shadows that fall away from the sun at 1 pm that day (short at midsummer, long in winter), replacing the fixed light from the top left.
- **Gaps show up:** a bed, pot or planter standing empty, having grown something before or with something planned, glows faintly with a dashed edge and a chip: "Empty from 1 Nov: sow lettuce or radish?". Tap a plant's name to plant it there. Ideas are quick crops that can be sown outside or planted out that month.
- **Jobs on the plan:** the month's jobs sit as chips on their beds ("Harvest carrot", "Sow lettuce", two per bed and a count of the rest). In this month, tap one to tick it off (with Undo); later months' chips are shown, dashed, to tick off then. Chips hide on beds too small on screen and wrap to the bed's width. The Month page stays the list of the same jobs.
- **Lenses,** one at a time: Plan · Sun hours · Shade · **In flower** (for bees) · **Harvest** · **Water** (pots and planters first, then young plants and those that like it moist; sharper once live weather arrives). The three new ones dim the plan and ring what they pick out, each with its own colour and dash, with a legend and a count. On a phone the chips scroll sideways.
- **Share:** the share button on the scrubber makes a picture of the plan in the chosen week, in your look, with the garden's name and month, framed for a post (4:5) or a story (9:16). Share it with the phone's share sheet where it takes files, or save it. **Make a timelapse** records the year ahead from that week as a short video (MP4 where the browser can, otherwise WebM), with the month changing as it plays. Both are made on the device; nothing is uploaded.
- **Speed:** scrubbing redraws the ground only when something visible changes (stages, the month, frost, gaps, or the light, which moves twice a month); while scrubbing it's drawn the size of the screen, and filled out for panning when you stop. Each feature's blurred shadow is drawn once per zoom and moved with the light. Scrubbing a week of the 2,000-plant test garden takes about 36 ms in headless Edge with no GPU (it was 550 ms before this work); panning stays at 60 frames a second.
- **Search** gains the three new lenses and "Share a picture of the plan".
- **Not done:** jobs for the week rather than the month, gap ideas from your own sowing list, and sharper projections from growing degree days (Stage 16).

Tests: `tests/year.test.ts` covers months and runs, stages up to and after today, planned plantings, quick crops, perennials, cleared plantings, what's in the ground, gaps and ideas, the three lenses, the light by season, frost, and the picture's name.

### Stage 15 — Greenhouses and cold frames as microclimates (as built)
- **Cold frames:** a new kind, from **Beds and pots** in the dock (1.2 × 0.6 m) or drawn with the Cold frame tool. It holds plants like a bed, and is drawn as a timber box with soil seen through a glass lid in two halves.
- **A climate for each:** `Feature.climate` (`heated`, `dayGainC`, `nightGainC`), defaulting by kind: an unheated greenhouse about +8 °C by day and +2 °C at night, a cold frame +4 °C and +1 °C. A greenhouse can be marked heated (kept frost-free).
- **What's under cover** (`src/climate/microclimate.ts`): `microclimateAt` finds the warmest greenhouse or cold frame over a point; `microclimateOf` gives a planting's, so a planting in a greenhouse, or in a bed drawn inside one, counts.
- **Frost under cover:** the last spring frost comes sooner and the first autumn frost later, by about a week for each degree warmer at night (how fast nights warm in a UK spring): two weeks in a greenhouse, one in a cold frame, six in a heated greenhouse, which never frosts. On the year scrubber, frost stays off a greenhouse early and late in the frosts, and never settles in a heated one.
- **Growing under cover:**
  - No hardening off: indoor sowings go Sown → Up → Planted out. Seedlings go in after about four weeks to grow on, and tender ones not before the last frost under the glass. The stage strip, the action pill and the Potting Shed's "Sown for the plan" list all skip hardening off ("Ready to go into the Greenhouse. No need to harden off.").
  - Plant-out jobs start sooner: a month counts once there's at least a week of it, so a greenhouse adds the month before (tomatoes in April as well as May and June), a heated one two months, and a cold frame's week doesn't change the month. The job says there's no need to harden off. The planting panel's "Next: plant out" uses the same months.
  - No "Protect for winter" job.
  - The **Water** lens picks out everything under glass, which gets no rain (March to October).
  - Projected stages on the year scrubber follow all of this.
- **On screen:** a greenhouse or cold frame's panel has an **Under cover** section: how much warmer it is, what that changes, a Heated tick (greenhouses), the day and night gains to type, and "Back to the usual". Plantings and beds under cover say "Under cover in Greenhouse: about +8 °C by day and +2 °C at night."
- **The Potting Shed:** "Raise seedlings in here" on a greenhouse or cold frame adds a matching place to the shed, linked to it (`ShedPlace.featureId`); a greenhouse bench or cold frame in the shed can be linked from its Change menu. A linked place shares its climate, and an unlinked bench or cold frame has the usual one. Tender seedlings on an unheated bench are told to come indoors on cold nights until the last frost under the glass, and hardening off in a cold frame is "open it by day, close it at night". Deleting the feature unlinks the place, which stays.
- **Model:** schema 8: the `cold-frame` kind, `Feature.climate` and `ShedPlace.featureId`, all optional.
- **Not done:** faster growth under glass, and earlier harvests and later crops in autumn: built in Stage 16.

Tests: `tests/microclimate.test.ts` covers climates by kind, the cover over a point and a planting (overlapping, heated, a bed inside a greenhouse), the dock sticker, frost dates under cover, frost on the plan, the path without hardening off, planting-in dates, planting-out months, the year's projection, jobs, the water lens, shed places and their advice, unlinking, and schema 8.

### Stage 16 — Growing degree days from UK climate averages (as built)
- **Climate averages** (`data/climate/uk-stations.json`): each month's average day (max) and night (min) temperature for 16 UK stations, 1991–2020, from Camborne to Lerwick. I drafted them; they're marked `verified: false` with the Met Office averages to check against, like the plant data.
- **Your garden's warmth** (`src/climate/warmth.ts`): its three nearest stations, weighted by distance (one on its own within 2 km), drawn smoothly through the year between the middles of months. Degree days use the "modified" method: the day capped at 30 °C, the night counted at the base when it's colder. Under glass, half the sunny-day gain by day (over sunny and dull days, with the vents open) and the night gain at night; a heated greenhouse is never below 7 °C. Each place's day-by-day table is worked out once.
- **How much warmth a crop needs** (`src/lifecycle/growth.ts`): the plant data's months and days describe a usual year in the middle of England (52.5° N, 1.5° W, where a new garden starts). The warmth a crop gets there in its usual days, from the middle of its sowing or planting months, is what it needs anywhere. Tender plants grow above 10 °C, the rest above 5 °C, unless the plant says otherwise.
  - The change from the usual days is damped (degree days saying twice as long means about 1.5 times), since light and day length matter too, and stays between half and twice the usual days.
  - A planting started the other way from the days (sown outside when they count from planting out, or the reverse) is about four weeks behind or ahead.
  - An autumn sowing (a run of months starting from August) is left to its months: it grows on through the winter.
- **New plant data:** an optional `growth` (`days`, `from`, `baseC`): days to the first harvest, or the first flowers for flowers, as on seed packets. Drafted for 50 annual crops, herbs and flowers, unchecked; potato and celery have their own base. Plant cards show "Time to crop: about 60 to 80 days from planting out…". Your own plants and perennials go by their months.
- **The year's projections** (`src/lifecycle/projection.ts`):
  - **Seeds sown outside** come up sooner in warm soil and slower in cold (their germination days, by the warmth). Indoors it's always warm.
  - **First harvest or flowers** come when the crop's had the warmth, counted from when it went in the ground. A fruiting crop flowers about 60% of the way there. A late sowing still crops before its season's out: no later than two weeks before the end of its months.
  - **Seasons move with the warmth:** for plants without days, and all perennials, their months come sooner or later by how soon the warmth since 1 January matches the middle of England's: about three weeks later in Aberdeen, a week sooner in Surrey, three weeks sooner in a cold frame and five in an unheated greenhouse (measured above 5 °C, at most six weeks). A month or two of flowers or fruit slides; a longer season stretches or shrinks at both ends. Nothing moves in midwinter.
  - **Tender annuals end at the first frost** (later under glass, never in a heated greenhouse), whether they've cropped or not: sweetcorn in Aberdeen doesn't ripen. A crop ready before its months (sprouts in September) stands until the end of them.
- **On screen:**
  - A growing planting's panel says what's next: "Ready to harvest from about 2 Aug, by the usual warmth here." Its "Probably flowering by now" comes from the warmth it's had, not the month.
  - Settings → **Your climate**: July days, January nights, the growing season above 5 °C, and degree days a year against the middle of England, naming the stations (and saying so when the nearest is over 150 km away).
  - Lens legends say "Based on the usual warmth here."; the Under cover section says crops come on faster in the warmth.
- **Speed:** dates are added with plain arithmetic instead of `Date` objects, and tables, seasons, frost dates and averages are kept per place and garden: projecting 2,000 plantings takes about 65 ms, as before.
- **Model:** no schema change. `Plant.growth` is optional.
- **Not done:** the month's jobs still guess flowering from the months; days for your own plants (the plant form has no field yet); a correction for a warm city or a cold hillside; this year's weather (Stage 17).

Tests: `tests/warmth.test.ts` covers the stations, blending and distance, the year drawn smoothly, dates through leap years, degree days and the gains under glass, warmth by region, runs and middles, bases, the usual days in the middle of England, north and south and under glass, early and late sowings, head starts, autumn sowings, seasons moved and stretched, tomatoes outside and under glass, sweetcorn lost to frost, late lettuce, standing sprouts, strawberries by region, seeds in cold soil, what it's probably at, what's next, the plant data's days and their checks, and the plant card.

### Stage 17 — This year's weather, sowing in batches, and What's new (as built)
- **This year's weather, opt-in** (Settings → Your climate → "Use this year's weather and the forecast"; `prefs.weather`, off by default):
  - `src/weather/openMeteo.ts` asks Open-Meteo (free for personal, non-commercial use, no key) for the garden's place rounded to two decimals (about a kilometre): the archive for the past 400 days (to six days ago) and the forecast API for the last ten days and the next 16. The forecast wins where both have a day; if the archive fails, the forecast is enough. Both allow requests from the browser (CORS checked).
  - `src/storage/weatherCache.ts` keeps it in this browser (`garden-planner:weather`), like preferences: never in a backup, forgotten when you turn it off. `src/ui/useWeather.ts` uses the kept copy at once and fetches again when it's more than six hours old, for another place, or when you come back to the app; it shares it through a context.
  - `src/weather/weather.ts` (pure): days as one run (missing days empty), the weather on a day, rain over the last few days, cold nights in the forecast, fresh and usable checks.
  - Settings says when it was updated, how far the forecast runs, and how this year compares with the usual since 1 January ("about 12% warmer than usual"), with Update now and the Open-Meteo credit (CC BY 4.0).
- **Degree days from the real weather:** `actualTable` and `daysUntil` in `src/climate/warmth.ts` count the days the weather covers (what's happened and the forecast, with greenhouse and cold frame gains added) as they were, and the usual for the rest. Seeds coming up outside, the first harvest and flowers all use it; seasons still move by the averages. Guesses say "by this year's weather and the forecast" instead of "by the usual warmth here".
- **Frost warnings** (`src/lifecycle/frostWatch.ts`, a card at the top of Home): the first night this week down to 3 °C or below (a ground frost possible; 1 °C or below, a frost likely) that puts something at risk: tender plants in the ground outside, tender plants and trays hardening off, and tender seedlings or plants under unheated glass when the night gain doesn't lift it above 1 °C. Never under a heated greenhouse. It says when ("tonight, into tomorrow morning", "early on Saturday"), how cold, what to do, and what's at risk.
- **The Water lens, with real rain,** for the days the weather covers: after 10 mm or more in three days, only what's under glass; after 4 mm, pots in warm weather (18 °C or more); otherwise young plants and those that like it moist, and everything in the ground in a dry (under 5 mm in a week), warm spell. Its legend says how much rain fell in the three days. Outside the weather's days it goes by the months, as before.
- **Sowing in batches** (`src/planting/batches.ts`, the planting panel's **Sow in batches** section): a planned row or block of a plant raised from seed (not perennials) splits into 2 to 6 batches, 1 to 4 weeks apart, from a first sowing date (the next sowing month by default). A row becomes shorter rows with the same plants in the same places (to the millimetre, give or take rounding); a block becomes strips across its longer side. Each batch is its own planting with `sowBy` and `batch` (`group`, `n`, `of`); the first keeps the original id and notes. One undo puts it back.
  - The year's projections start each batch on its own date.
  - Each batch gets its own sowing job in its month ("in Veg bed (batch 2 of 3)", "Sow about 26 Apr."), and stays as "Running late" in the month after if it isn't sown. Ticking it sows only that batch. Planting-out jobs wait until after a batch's month.
  - A batch's panel shows when to sow it (and lets you change it) and the rest of its set, to jump between them.
- **Empty-bed ideas** now start with plants from your sowing list that can go in that month, then the quick crops.
- **What's new** (`src/content/whatsNew.ts`, `#/new`): changes in plain English for people using the app, newest first, each with a stable id, a date and a "try it" button. A **What's new** card on Home shows the newest unseen entry until you open the page or choose Not now (`prefs.seenNews`); new gardens start with everything seen. It's linked from Settings and search ("what's new"). Entries go back to the Potting Shed.
- **Dates** moved to `src/model/dates.ts` (the shed still exports them).
- **Model:** schema 9 adds `Planting.sowBy` and `Planting.batch`, both optional. Preferences gain `weather` and `seenNews`.
- **Not done:** jobs by the week; frost warnings as notifications when the app's closed; this year's warmth moving the seasons of perennials; rain in the month's watering jobs; joining batches back together (undo works straight after).

Tests: `tests/weather.test.ts` covers reading a real Open-Meteo reply, joining the archive and forecast, the request (rounded place, dates), fetching with either failing, freshness and place, rain totals, keeping and forgetting it, off by default, degree days from real days, hot and cold spells, the year's projections, the year so far, cold nights and gains, who's at risk outside, under glass, hardening off and on a bench, the words for when, the Water lens after soaking, light rain and a dry spell, splitting rows and blocks, batch dates and ids, projections and jobs per batch (late, ticked), ideas from your sowing list, schema 9, and What's new (order, ids, plain words, what's unseen).

## The UX plan: twenty changes in four releases (added 7 Oct 2026)
A product designer's pass for the people this is for: Gen Z, millennials and tech-confident older gardeners. Fewer places to look, one clear next thing to do, more one tap deeper, and more delight. The twenty changes and why are in [ux-plan.md](ux-plan.md).

| Release | Changes | Status |
| --- | --- | --- |
| 1. Foundations | Four tabs (1), Your garden page (3), plant editor switch (5), calmer plan toolbar (10), fewer display settings (19), plain words (20) | Built |
| 2. The first minute | Place search (6), onboarding from your plants (7), starter kits (8), north from the compass (9) | Built |
| 3. Daily use | Today as a weekly feed (2), Want to grow (4), one timeline (11), planting panel (12), "What's happened?" (13), first-visit tips (14) | Built |
| 4. Delight | Photo diary (15), harvest log (16), season wrapped (17), install, offline and reminders (18) | Built |

### UX release 1 — Foundations (as built)
- **Four tabs: Today · Garden · Seedlings · Plants.** Today is Home; Garden is the plan; Seedlings is the Potting Shed, promoted from under Month (its page is now "Seedlings", with no back button); Month is a page under Today ("All October jobs"). Addresses use the new names (`#/today`, `#/garden`, `#/seedlings`, `#/journal`, `#/your-garden`), and the old ones (`#/home`, `#/plan`, `#/shed`, `#/notes`) still work (`VIEW_HASH` and `viewForHash` in `src/theme/prefs.ts`). Search says "Go to Today", "Go to your garden", "Go to Seedlings", "This month's jobs" and "Your garden: location, frosts and backups".
- **Your garden** (`#/your-garden`, `src/ui/views/Profile.tsx`): opened by tapping the garden's name on Today or Garden (`GardenName` in `src/ui/HomeCards.tsx`), from Settings, the plan's ⋯ menu and search. It holds what's about the garden, not the device:
  - **About it:** its name; where it is in words ("Near Leeds.", from the nearest weather station; `placeText`), Use this device's location, and the numbers under "Exact location"; which way is north; how you space plants.
  - **Seasons and weather:** frosts, your climate (the degree days figure became "About as warm as the middle of England"), and this year's weather.
  - **Backups.**
  Settings keeps the look, light or dark, More display options, What's new, keyboard, Credits (folded away) and Advanced.
- **Plant editor** (Settings → Advanced, `prefs.plantEditor`, off): the Checked and Not yet checked badges, the draft warning, the plant's source, the "Checked plants only" filter, the dots in the plant list and "Check the plants" only show when it's on. Everyone else sees "Spotted something wrong? Report a mistake", which opens a new issue on the app's GitHub page about that plant (`reportUrl`).
- **A calmer plan toolbar:** the garden's name, then what to show, then a plant checks chip (when there's something to check), search, the lock, undo and ⋯ (`src/ui/MoreMenu.tsx`): redo, fit, photos around the plan, the whole garden's details (phone), share a picture, and Your garden. On a phone, the six lens chips are one "Show: …" picker in the toolbar, so the plan gets the row back; on a wide screen, five chips, and tapping the one that's on goes back to the plan.
- **Fewer display settings:** the look as one row you scroll sideways, and light or dark; photos, photo month, text size and shadows under "More display options". Text follows the browser's text size (`font-size: 100%` rather than 16 px).
- **Plain words:**
  - "Sow to transplant" became "Sow to plant out later"; "the shade lens" in the shortcuts became "Show shade"; What's new no longer says "lens".
  - When hardening off is next, a line explains it (`STAGE_EXPLAIN` in `src/lifecycle/stages.ts`).
  - `tests/words.test.ts` scans the words on screen in `src/` (JSX text, and quoted text with a space in it, leaving out comments, class names and search's hidden keywords) for "degree days", "lens", "vegetative", "transplanted", "sticker", "footprint", "schema", "latitude" and "longitude" (allowed only for the exact location's two fields).
- **Screenshots:** headless Edge on Windows won't make a window narrower than 492 px, so earlier phone screenshots were cut off on the right. That was the screenshot, not the app (now off the wishlist). Phone screenshots now load the app in a 390 px frame.
- **Not done in this release:** the rest of the plan, in releases 2 to 4.

Tests: `tests/ux.test.ts` covers the addresses (new and old), the place in words, the plant editor setting and the report link; `tests/words.test.ts` covers plain words in every source file.

### UX release 2 — The first minute (as built)
- **Find your garden by postcode or town** (`src/weather/places.ts`, `src/ui/PlaceSearch.tsx`): a whole UK postcode or its first half goes to postcodes.io, anything else to Open-Meteo's place search (free and keyless, the weather's provider). Pick from what matches; the garden gets its place in words (`garden.placeName`, "LS6, Leeds") and the numbers behind it, rounded to about 10 m. It's in onboarding, Your garden and the Getting started card. Typing exact numbers, or using the device's location, clears the place name. Only what you type is sent, when you search, and the screen says so.
- **Onboarding starts with your plants** (`src/ui/Onboarding.tsx`):
  1. Where's your garden? (place search, the device's location, the name).
  2. What are you growing in? (the space and its size; new gardens only).
  3. What would you like to grow? Starter kits for that space with a picture of each planted up, or "Just the space"; and 16 favourites to tap (`FAVOURITES`), which go on your sowing list.

  "Start growing" lays out the space, plants the kit and lands on Today. Skip on the welcome goes straight to the plan; Skip on a later step keeps what you've chosen. The look picker is only in Settings now; the look defaults to Cottage, in light or dark to match the device.
- **Starter kits** (`src/planting/kits.ts`, `src/ui/KitPicker.tsx`): eight, at least one for each space:
  - Salad and tomatoes, Kitchen herbs (balcony);
  - Patio crops;
  - First veg bed, Salad bed (a single bed);
  - Veg and flowers, Pollinator garden (garden);
  - Allotment starter.

  Each lists what goes in each bed or pot the space makes, in order: rows across a bed (strips), blocks side by side along a border, one plant to a pot, half a spacing in from the edges. Salads are split into batches three weeks apart from their next sowing time. The kit's plants go on your sowing list, and plants not in the library are left out. Offered in onboarding and in "Where are you growing?" from an empty plan ("Plant it up?"). `MiniPlan` can now draw plants, for the kits' pictures.
- **North from the compass** (`src/geometry/compass.ts`, `src/ui/CompassNorth.tsx`): on a phone or tablet, "Use your phone's compass" asks for permission where needed (iPhone), reads the heading (`webkitCompassHeading`, or alpha on the "absolute" event), averages the last ten readings round the circle, says which way the top of the plan faces, and sets north (360° less the heading). In the UK a compass is within a couple of degrees of true north. In Your garden and the Getting started card; no compass reading after 3 s says so.
- **Model:** schema 10 adds the optional `garden.placeName`.
- **Screenshots:** a small script drives headless Edge over the DevTools protocol at a true 390 × 844 phone size, clicking through onboarding and a place search.

Tests: `tests/ux-first-minute.test.ts` covers kits for every space, each kit planted inside its beds and pots and listed to grow, salads in batches, unknown plants left out, the favourites, postcode and place requests, each service's reply, no match and failure, the place name and schema 10, north from a heading, reading a heading, and averaging round the circle.

### UX release 3 — Daily use (as built)
- **This week on Today** (`src/calendar/week.ts`, `src/ui/WeekCard.tsx`): from each planting's projected timeline (the plant's months and the warmth it gets, or this year's weather), the steps likely in the next seven days, with next week folded underneath. Things to do come first (sow, harden off, plant out, clear), then things to look out for (seedlings up, flowering, ready to pick). Rows of a plant in the same bed are one line; batches stay apart ("Lettuce (batch 2 of 3) in Veg bed: sow outside on Thursday"). Each line has Show, to see it on the plan. The card sits after the month's jobs, with the journal after it, then What's new and the garden.
- **Want to grow** (`src/ui/Heart.tsx`): the sowing list is now a heart, on plant cards ("Want to grow it?" / "Want to grow") and on each row in Plants, with a "Want to grow (n)" filter there, and a Want to grow drawer in the dock. Jobs say "on your Want to grow list". The list's card on the Month page went (Plants and the hearts do its job). `Icon` can be drawn filled.
- **One timeline:** the sun bar's own date picker and its presets went; sun and shade follow the timeline under the plan, as the other views do. The bar says the day and offers Midsummer, Midwinter and Today, which move the timeline.
- **The planting panel, headline first** (`src/ui/PlantingStages.tsx`, `src/ui/PanelTabs.tsx`): the plant, its stage, what's next by the months, "Ready to harvest from about …" in bold, and "What's happened?". Then three tabs (the last chosen is remembered):
  - **Care:** advice for its stage, a line on hardening off when that's next, the checks, sowing in batches, the facts, "Change the details", and About.
  - **Timeline:** the rail of stages with their dates, "Likely next" with dates, and "Correct a mistake" (the old "Change stage…").
  - **Notes.**

  Show the bed stays as a button; Mark as cleared (or Put back) and Delete are in the panel's ⋯ menu. `StageStrip.tsx` was split up and removed.
- **"What's happened?"** (`src/lifecycle/happened.ts`): one button ("Sown or planted it?" before sowing), then chips for what could come next on the plant's path: Sown (or Sown indoors and Sown outside, when it could be either), Planted, It's up, Hardening off, Planted out, Growing well, Flowering, First pick, Growing again (a perennial's new season), Didn't come up, and Finished. The likely one is marked and chosen to start with (from the warmth it's had, or simply the next stage). A date (today unless you change it) and an optional note, saved as one change: the stage, the sowing method, clearing or a failed sowing, and the note in the journal against the planting.
- **First-visit tips** (`src/ui/PlanTips.tsx`, `prefs.seenTips`): three tips over the plan the first time it's opened with something on it: pick and move, the lock, and the timeline. Each lights up what it's about (a pulsing outline, still with reduced motion). The long hint under the plan on a wide screen became "Scroll to zoom, and 0 fits the garden. Pull a corner to resize. Press ? for all the shortcuts."
- **Not done:** a heart in the dock's plant drawer itself (it has the Want to grow filter); photos in the Timeline tab (release 4).

Tests: `tests/ux-daily.test.ts` covers this week and next (batches, to do first, what to look out for), rows on one line, days in words, Want to grow in the jobs, what could happen next (by path, under glass, cleared), recording a step with a note, sowing outside, finishing, a failed sowing, and the tips setting.

### UX release 4 — Delight (as built)
- **Photos** (`src/storage/photos.ts`, `src/ui/Photo.tsx`): any note can have a photo (the camera or the photo library on a phone), from the journal, a bed's or planting's notes, or "What's happened?". A note can be just a photo. Photos are shrunk on the device (1600 px at most, JPEG) and kept in IndexedDB by id (`Note.photo`), never in the garden's JSON; tap one to see it big. A planting's Timeline tab shows its photos by date; the journal has Notes and Photos views (a grid). Photos no note uses any more are cleared when the app next opens, so undo still works while it's open. A photo that isn't on this device says so.
- **Backups with photos:** Your garden → Backups has "With photos (n)" beside Download a backup; the file carries them as data URLs (`GardenFile.photos`), and restoring puts them back. Only JPEG and PNG data, under ids that look like ids, are read back.
- **The harvest log** (`src/planting/harvest.ts`, `Planting.picks`): "What's happened?" offers "Picked some" once a planting is cropping (and it's the likely one), and both it and "First pick" ask how much: a handful (150 g), a bowl (500 g), a basket (2 kg), or grams. A harvest job has "Picked some?" with the three sizes, which logs a picking on the job's first planting and ticks the job (`logPick` in `src/calendar/jobs.ts`). The Timeline tab lists a planting's pickings and its total; Today shows "Picked this year: 6.2 kg" with the top three crops.
- **Your season, wrapped** (`src/share/wrapped.ts`, `src/ui/Wrapped.tsx`): story-sized cards (1080 × 1920, in the look you're using): the year's plantings and crops, the first pick, how much was picked and of what most, the busiest month, the newest photo, and two easy crops to try next year. Only cards with something to say; none for an empty year. Flip through them, and share or save each. The season is this year from September, last year before; the card on Today offers it from September to January, and search finds it any time.
- **Install and offline** (`public/manifest.webmanifest`, `public/sw.js`, `src/ui/Install.tsx`): a manifest and icons (a sprout on garden green, made by `tools/make-icons.ts`; `npm run icons`), so it installs to a home screen and opens full screen. The service worker serves the page fresh when online and the last copy when not, and everything else from what it's kept, refreshed behind (at most 150 files). On the first visit the page hands it the files already loaded, so it works offline from then on. Weather and place searches always go to the network. "Put it on your home screen" on Today uses the browser's own prompt (Chrome, Edge, Samsung Internet), or explains Share → Add to Home Screen on an iPhone; Not now puts it away (`prefs.installHidden`).
- **Reminders** (Your garden → Seasons and weather → Reminders; `src/storage/reminders.ts`, `src/ui/ReminderKeeper.tsx`): two switches, both off. **Frost warnings**: the app keeps a note of what a frost could hurt and how much warmer it is at night where each is (`frostWatchList`), and the service worker checks the 3-day forecast twice a day at most and says what's at risk. **This week's jobs, on Mondays**: the app works out the next five weeks' things to do (`weekNudges` in `src/calendar/week.ts`) and the service worker shows this week's, once, in the daytime. Each is told once. Background checks need periodic background sync (Chrome and Edge on Android, installed); elsewhere the switch says the app can only check while open, where Today already shows both.
- **Model:** schema 11 adds `Note.photo` and `Planting.picks`, both optional. Preferences gain `reminders`, `weeklyNudge` and `installHidden`.
- **Not done:** true push with the app closed on an iPhone or a computer (it needs a server); a "best photo" chosen by anything cleverer than the newest; picks on trays in the shed.

Tests: `tests/ux-delight.test.ts` covers notes with only a photo, photos newest first and by planting, a bad photo id, backups with photos (and leaving out anything that isn't a picture), picks by size and weight, totals by crop and year, weights in words, "Picked some" from "What's happened?" with a photo, schema 11, the season's stats and cards (and none for an empty year), which season, what frost reminders watch (outside, under glass, on a bench, hardening off), Mondays, the weekly reminder's weeks, what the service worker is given, the reminder and install settings, and picking from a harvest job.

## The second round: releases 5 to 10 (added 7 Oct 2026)
Everything planned up to UX release 4 is built. This round comes from your notes of 7 Oct 2026:
- a 3D view;
- a simpler planner on a phone;
- planting on lawn;
- resizable fruit trees and a list of tree types;
- 150 more plants;
- alerts when something's running behind;
- weeds;
- the year slider over photos;
- an aerial-photo spike;
- leaner testing.

Each idea was checked against the code and against everything still open. Stage 7 (real use) and Gate 3 run alongside. Anything in [mismatch-log.md](mismatch-log.md) that's worse than the next release's items goes first.

| Release | What | Size | Status |
| --- | --- | --- | --- |
| 5. Housekeeping | Testing by risk (`CLAUDE.md`), doc fixes, the mismatch log | 1 evening | Built |
| 6. Plant anywhere, right size | Plants on soft ground, resizing big plants, 50 tree types, the year slider over photos | ~1.5 wk | Built |
| 7. A simple planner | A Simple / Advanced switch on the plan, and a phone pass | ~2 wk | Built |
| 8. Keeping on track | "Running behind" alerts with common causes, weeds and weeding | ~1.5 wk | Built |
| 9. A bigger library | 150 more plants in three batches of 50 (can run alongside 7 and 8) | ~3 wk of data | Built |
| Spike | The garden from an aerial photo: research and a prototype, go or no-go | 2–3 evenings | Done: no-go |
| 10. The garden in 3D | An angled view to look at, three.js loaded only when opened, with the sun and the year | ~2–3 wk | Built |

### Release 5 — Housekeeping (as built)
- **Testing by risk:** `CLAUDE.md` at the repo root.
  - While working, run only the tests for the areas touched, and typecheck any TypeScript change.
  - Changes to the files many tests depend on (the model, file storage, placing, jobs, stages and the timeline) run the full suite.
  - At the end of a release, one full `npm test` and `npm run build`.
  - Screenshots only of the screens that changed.
  - It also has the table of which tests cover which source.
- **Doc fixes:**
  - The plant data is checked by `tests/plants.test.ts`; `tools/validate-plants.ts` was never made.
  - Stage 18 has moved to release 10.
  - The wishlist says where each idea now goes.
- **The mismatch log:** [mismatch-log.md](mismatch-log.md) is started, for Stage 7.

### Release 6 — Plant anywhere, right size (as built, schema 12)
- **Plants on soft ground** (`src/planting/place.ts`).
  - `isSoftGround(f)` is a lawn, meadow, bare soil, bark or gravel surface; `canHold(f)` is that or a bed, greenhouse, cold frame, pot or planter (`isContainer`, unchanged, still means "a bed", for gaps, kits, "Clear this bed" and the sun in each bed).
  - `containerAt` finds a bed, pot or planter under the point first, wherever it is in the list (beds are drawn over the ground), then the topmost soft ground. A patio, decking, a path, a building or a pond laid over the lawn covers it; trees, hedges and fences don't, so bulbs go under a tree.
  - Elsewhere it says "Plants can't go on paving, decking or paths. Drop it in a bed, a pot or on the lawn." (`NOWHERE_TO_PLANT`).
  - On a lawn, a dropped plant is always one plant (`defaultFill`, `fillsFor`); rows and blocks can still be drawn by hand.
  - Messages, jobs and the planting's heading say "the lawn" (`placeLabel` in `src/model/features.ts`): "Plant crocus in the lawn".
  - A lawn's details list what's growing on it; the garden's "Beds and plants" and the journal's places include a lawn once something's planted in it.
  - A bulb in a lawn gets "leave the grass long round them until their leaves die back, about six weeks after flowering".
  - A planting left on ground since changed to paving gets a warning.
- **Small, medium and large** (`Planting.size`, `spreadMm`, `heightMm`; `sizedPlant`, `setPlantingSize`, `setPlantingMm`).
  - Small is half the library's spread and height (a dwarf apple, 1.5 m), large 1.6 times (a standard, 4.8 m). Typed sizes win.
  - Only single plants: rows and blocks keep the plant's spacing.
  - Offered for trees, shrubs and anything a metre or more across (`canResize`): one "Size" button on the action pill steps through small, medium and large. Any single plant has Size and exact spread and height under "Change the details".
  - Drawing, picking, the selection box and the spacing check use the size. Bulbs under a tree or shrub aren't flagged as too close.
  - Plants are drawn shortest first (`byHeight`), so trees and tall plants sit over what's beneath them, and a tap picks the one on top (from the wishlist).
- **Tree types** (`src/model/trees.ts`): 52 UK garden trees, favourites first (birches, Japanese maple, rowan, amelanchier, crab apple, cherries, magnolia, olive, holly, hawthorn), then other garden trees, conifers and big trees.
  - Each has its Latin name, evergreen or not, its shape from the side (for the 3D view), its leaf, a typical garden size (about twenty years' growth, from RHS and nursery figures) and the light it blocks in leaf and bare. Small is 0.6 times, large 1.5 times.
  - Structures lists them under the buildings, with a search and Small / Medium / Large. A dropped tree is named, sized, and casts its shade (`asTree`, `makeTree`; sticker ids `tree:<type>:<size>`). Evergreens block the same light all year.
  - Fruit trees (apple, pear, plum, cherry, fig) are at the end of the list, and drop the fruit plant, so its jobs and harvests work.
  - A tree's details have "Kind of tree" and size; its action pill has the Size button. `drawTree` uses the type's leaf and colour (a copper beech is purple).
  - Search finds them: "Add a tree: Silver birch". The two plain tree stickers are gone; "Not chosen" keeps an old tree as it was.
- **The year slider over full photos:** the photo round the plan is positioned, so it was painted over the slider's panel, which wasn't. The slider is now positioned above it, as the dock already was, with the dock's shadow.
- **Model:** schema 12 adds `Planting.size`, `spreadMm` and `heightMm`, and `Feature.treeType` and `size`, all optional.
- **Not done:** plants on the plan, a fruit tree included, still cast no shade in the sun views (only features do); sizes for rows and blocks; trees' shapes from the side wait for the 3D view.

Tests: `tests/anywhere.test.ts` covers what can hold a plant, a bed on a lawn (either order), a patio or path over a lawn, a tree over a lawn, one plant on a lawn, moving onto a lawn, no gaps on a lawn, "the lawn" in jobs, the paved-over warning, which plants can be resized, sizes and typed sizes, rows keeping their spacing, the spacing check by size, bulbs under a tree, drawing by height, every tree type at every size, search, changing type, bad tree stickers, and schema 12. Three older tests that said plants never go on a lawn now say they do.

### Release 7 — A simple planner (as built)
- **Simple | Advanced** in the plan's toolbar (`prefs.planMode`, starting on Simple and remembered). What each offers is in `src/ui/planMode.ts`.
- **Simple:**
  - The dock has four drawers: Plants · Beds and pots · Ground · Trees and structures (renamed from Structures in both modes). Each has the usual things (`SIMPLE_STICKERS`): beds, pots, a window box and a greenhouse; lawn, patio, decking, gravel, a path and a pond; the shed, compost, fences, walls and hedges, and all the trees.
  - Show offers the plan, In flower, Harvest and Water.
  - The action pill keeps the plant's next step, Size, the row's −/+, About, Delete, Duplicate, a surface's material, and More. Typed sizes, curved edges and edging are Advanced (`pillHasExtras`).
  - On the plan, things move and resize but don't reshape or turn: a rectangle's corners resize it (it stays a rectangle) and a round thing's edge handle resizes it (`resizesByHandles` in `src/model/features.ts`). Other shapes, curves, lines and the boundary show no corner handles, and a drag there moves the shape. No rotate knob, no double-tap to add a corner, and the north arrow stays put (the canvas's `simple` prop, and `reshape: false` in the scene).
  - No padlock, and the layout's never locked in Simple (`isLocked`), so nothing's stuck with no way to unlock it.
  - The empty plan offers "Where are you growing?" and "Beds and pots", not "Draw the boundary".
- **Advanced** is everything there was before, plus the switch.
- **No dead ends:** asking for a drawing tool (from search, a keyboard shortcut, or "Redraw the boundary") or for sun or shade in Simple switches to Advanced and says so. Going back to Simple puts away the Advanced tools, views and the Draw drawer. Nothing on the plan changes either way: sketches and drawn shapes stay on it.
- **Phone pass:**
  - On touch screens, toolbar buttons, chips and the action pill's buttons are 44 px.
  - The year slider steps aside while a drawer is open, so there's one bar under the plan at a time.
  - First plant on a garden with a bed: Plants, the plant, the bed: three taps.
- **Not done:**
  - The details panel (More) is the same in both modes, including exact sizes and curved edges: it's one tap deeper.
  - Keyboard shortcuts for drawing tools still work in Simple, switching to Advanced.
  - In Advanced on a phone, a bed's action pill can wrap to two rows at 44 px.
- **Fixed on the way:** the canvas didn't redraw when the mode changed (the rotate knob only showed after the next change).

Tests: `tests/planmode.test.ts` covers the setting and its fallback, the lock only in Advanced, the drawers, the short lists (every one real, something in each drawer), the lenses, which tools ask for Advanced, the pill's extras, and what resizes in Simple (rectangles at any angle and round things; not drawn shapes, curves or lines).

### Release 8 — Keeping on track (as built, schema 13)
- **Running behind** (`src/lifecycle/behind.ts`).
  - `expectedNext` in `src/lifecycle/projection.ts` gives the step after the latest one you've marked, and when it was due: by the warmth where the plant has days, otherwise its months, not moved to tomorrow as the timeline does.
  - A planting is running behind once it's past that date plus some slack (`slackDays`): a week for seedlings to come up, otherwise two weeks or a quarter of the wait.
  - Left out: weeds, anything planned or cleared, a latest stage with no date, the step to clearing, and anything you're still waiting on (`Planting.snoozeUntil`).
  - **On Today**, a "Running behind" card shows up to three, the latest first: "Carrot in Veg bed. Expected to be up by 31 Aug." It has "Why might it be slow?" folded away, and three buttons:
    - "It's moved on" opens the planting on the plan, where "What's happened?" records it.
    - "Still waiting" gives two weeks' quiet.
    - "Sowing failed" (sowings only) uses `markFailed`, with a journal note.
  - **On the planting**, the same line and buttons appear under its expected date.
  - The usual reasons are listed for each stage (`causesFor`): not up, not ready to harden off, not planted out, not growing away, not flowering, not cropping. Once it's up, the plant's own pests are added.
  - The Monday reminder adds "Running behind: carrot" to this week's.
- **Weeds** (`data/plants/weed.json`, category `weed`, `Plant.weed`).
  - 21 common UK weeds: dandelion, bindweed, ground elder, couch grass, creeping buttercup, nettle, bramble, dock, hairy bittercress, groundsel, chickweed, horsetail, white clover, lawn daisy, herb Robert, rosebay willowherb, shepherd's purse, fat hen, oxalis, annual meadow grass and lesser celandine.
  - Each says how it spreads (seed, roots or both), what it's good for (bees, butterflies, birds), and how to be rid of it by hand. Never a weedkiller: the tests check.
  - They're left out of the plant lists unless asked for: the Weeds filter in the dock, Weed in the Plants page, or by name. They have no Want to grow heart. A weed is marked as already growing when placed, and it isn't checked for spacing, neighbours or light.
  - **Keep or be rid of it** (`Planting.keep`): "Remove" / "Keeping it" on the action pill. A weed's details show how it spreads, what it's good for, how to remove it, and "It's gone".
  - **Jobs** (`weed` kind, `weedJob`): for a weed you want gone, "Get it out before it seeds" in the month before it flowers and while it does, and "Dig out the roots" in April and September for those that spread by their roots. Ticking clears the weed from the plan; unticking brings it back.
  - **Weed the beds:** one job a month from March to October, for the beds with something growing, with a word for the month. `jobsFor`'s `weeding` option, on unless "Weeding reminders" is off in Your garden → Reminders (`prefs.weeding`).
  - Weeds don't fill a bed (it can still be a gap), aren't looked forward to on Today, aren't watered or picked in the lenses (a kept one shows in flower), and aren't counted as grown in Your season, wrapped.
- **Phone:** the year slider also steps aside while a plant's details or the planting bar are open.
- **Model:** schema 13 adds `Planting.keep` and `Planting.snoozeUntil`, both optional.
- **Not done:**
  - Check-progress jobs still guess flowering from the months; running behind uses the warmth, so it does that job's work for plants you date.
  - A direct sowing that's running behind still gets its harvest job in its harvest months.
  - Weeds can't be marked across a whole lawn as a patch.

Tests: `tests/on-track.test.ts` covers:
- running behind (late, within its time, moved on, what's left out, still waiting, slack, the plant's pests);
- weeds (valid with no weedkillers, left out of lists, already growing and not checked, jobs by seed and by roots, keeping, ticking and unticking);
- weeding the beds (months, beds, the setting);
- schema 13.

**Fixed before this release (reported 7 Oct 2026):** putting broad beans into an empty bed left it marked empty, with "sow foxglove or garlic?", and garlic was then warned against beside the beans.
- A bed with a crop going in within eight weeks is now waiting, not empty (`GAP_MIN_DAYS`).
- Ideas for a gap leave out anything usually kept apart from what's growing or planned there.
- Before a crop planned months ahead, only something done in time is offered, to sow first ("Empty until 1 May: sow radish first?"; `daysToCrop`).
- Tests in `tests/year.test.ts`; logged in [mismatch-log.md](mismatch-log.md).

### Release 9 — A bigger library (as built, data track)
150 plants in three batches of 50, all `verified: false` with a suggested source. The library is now 250 plants, plus 21 weeds.

**Batch 1: 40 vegetables and salads, 10 herbs.**
- Vegetables and salads:
  - Squashes and melons: pumpkin, marrow, summer squash, melon, cucamelon.
  - Roots and tubers: Jerusalem artichoke, sweet potato, salsify, scorzonera, daikon, Hamburg parsley.
  - Beans and peas: edamame, mangetout, asparagus pea, borlotti bean.
  - Leaves: watercress, land cress, endive, chicory, winter purslane, oriental greens, mibuna, perpetual spinach, New Zealand spinach, garden cress, orache, shungiku.
  - Cabbage family: Chinese cabbage, cima di rapa, cavolo nero, savoy cabbage, romanesco.
  - Onion family: elephant garlic, Welsh onion.
  - Others: Florence fennel, tomatillo, cardoon, sea kale, okra, green manure.
- Herbs: sorrel, lovage, horseradish, salad burnet, chervil, garlic chives, borage, chamomile, marjoram, summer savory.

**Batch 2: 5 herbs, 15 fruit, 30 flowers and bulbs.**
- Herbs: winter savory, hyssop, lemon verbena, lemongrass, shiso.
- Fruit:
  - Trees: quince, medlar, damson, greengage, apricot, peach, black mulberry, Morello cherry.
  - Bushes and canes: tayberry, jostaberry, whitecurrant, honeyberry.
  - Others: hardy kiwi, cape gooseberry, alpine strawberry.
- Annuals and biennials: snapdragon, sweet alyssum, bishop's flower, larkspur, poached egg plant, petunia, California poppy, tobacco plant, honeywort, sweet scabious, stocks, wallflower, forget-me-not, pansy and viola, honesty, clarkia, strawflower, spider flower, pelargonium, lobelia.
- Bulbs: hyacinth, grape hyacinth, English bluebell, lily, gladiolus, snake's head fritillary, dwarf iris, winter aconite, hardy cyclamen, camassia.

**Batch 3: 15 perennials, 25 shrubs, 10 climbers.**
- Perennials: woodland sage, catmint, penstemon, astrantia, geum, heuchera, hosta, ice plant, crocosmia, agapanthus, Japanese anemone, aquilegia, phlox, oriental poppy, yarrow.
- Shrubs (new `shrub.json`, finishing data batch B5): butterfly bush, hydrangea, hardy fuchsia, hebe, camellia, rhododendron, forsythia, mock orange, lilac, laurustinus, red-barked dogwood, pittosporum, Mexican orange blossom, skimmia, mahonia, spiraea, weigela, Californian lilac, box, firethorn, photinia, Christmas box, daphne, flowering currant, St John's wort.
- Climbers:
  - Perennial, as shrubs: clematis, honeysuckle, wisteria, star jasmine, climbing hydrangea, passion flower, climbing rose, ivy.
  - Annual, as flowers: morning glory, black-eyed Susan vine.

**Also:**
- New plants have `germinationDays` and `growth.days` where they're grown from seed and it's known. 68 existing seed-grown plants have been given `germinationDays` too, finishing that wishlist item.
- The other 32 existing plants are grown from sets, tubers, crowns, bulbs or cuttings, or bought as plants.
- The new fruit trees are in the tree list's fruit trees (`FRUIT_TREE_PLANTS`).
- Ornamental trees stay as structures (release 6), so there's no `tree.json`.
- The scratch generator wrote compact entries in the same layout as the existing files.
- Pest controls are cultural only, and poisonous plants are marked "(check)".

Tests: the plant and art tests cover every new plant. The "bean" search test now also finds borlotti beans and green manure (field beans).

### Spike — the garden from an aerial photo (as done)
The full write-up is in [aerial-spike.md](aerial-spike.md).
- **Tried:**
  - colour and texture in plain code;
  - SegFormer, an image model that runs in the browser (15 MB and 110 MB versions), via transformers.js.
- **Photos:** five openly licensed ones (two back gardens, three allotment sites), each as taken and straightened from four corners.
- **No-go** for drawing a garden automatically:
  - not one bed was found;
  - about a quarter of the main things (shed, patio, lawn, fence) came out, as blobs of 15 to 160 corners that would need redrawing and scaling;
  - dropping them in from the dock is quicker.
- **Found on the way:** real photos are never straight down. "Straighten a photo before tracing" goes on the wishlist (S).
- **Not tried:** a vision model on a server (servers are off the table until beta testing).

### Release 10 — The garden in 3D (as built)
- **Opening it:**
  - **3D** on the plan's Show chips (on a phone, "Show: in 3D");
  - "See it in 3D" in the ⋯ menu;
  - "See the garden in 3D" in search.

  It needs something on the plan.
- **The view** (`src/ui/Garden3D.tsx`): full screen, with From above and Standing in it, the time of day (sunrise to sunset), and the year slider under it.
  - Drag to turn, pinch or scroll to zoom; tap or click anything for its name ("Carrot in Salad bed: growing").
  - The year slider's share button shares a picture of the view.
  - Esc or × closes it.
- **Loading:** three.js (0.186) is loaded only when the view opens (`import('../three/view')`), as its own 157 KB chunk (gzipped).
  - With no WebGL, the view says so without loading it.
  - If it can't load (offline the first time), it says so too.
- **What's worked out** (`src/three/scene.ts`, pure, no WebGL):
  - **Flat things:** surfaces, paths and ponds, in the order they're drawn.
  - **Beds:** stand to their edging (300 mm), or are a 60 mm mound without it.
  - **Containers:** pots, planters and cold frames at their heights.
  - **Standing things:** fences, walls, hedges, compost and the rest at theirs.
  - **Roofs:** buildings and greenhouses that are rectangles get a pitched roof along the longer side, with the walls three quarters of the way up.
  - **Trees** take their type's shape (round, oval, columnar, conical, spreading or weeping) and are bare in winter if deciduous. Fruit trees planted as plants are trees too, with blossom when flowering and fruit when cropping.
  - **Plants:** each planting's plants sit on the soil of their bed or pot (40 mm under a raised bed's rim), at their stage that week from the year's timeline. Seeds and anything cleared are left out; planned plants are faint.
  - **Groups:** plants drawn the same way are one group, so each picture is made once. Past 20,000 plants a huge block is thinned.
  - **The sun:** from the real sky at the chosen time and day.
- **Drawing** (`src/three/view.ts`):
  - **Textures:** the plan's own tile textures (`materials.ts`) for surfaces, soil, edging, brick and hedges, tied to real sizes.
  - **Greenhouses:** glass with a white frame.
  - **Plants:** three crossed cards each, from a new **side-on drawing** (`src/art/side.ts`, from the same traits as the drawings from above). Lettuces and courgettes also get their picture from above.
    - One instanced mesh for each group.
    - Each card is drawn front and back, with its normals facing up, so leaves are lit softly on both sides.
  - **Shadows:** real ones from the sun, plants included.
  - **Light:** in winter the sky does more of the work, so the garden stays as bright as in summer, with softer shadows.
  - **Speed:** it renders only when something changes. Its shadow map is 2,048 px (1,024 on a phone).
  - **Phones:** the camera stands further back and looks wider on a tall screen.
- **Leaves drop in winter, on the plan too** (from the wishlist; `src/lifecycle/seasons.ts`):
  - Plants have an optional `lifePath.winter`: evergreen, deciduous or dies-back.
    - The default is deciduous for fruit, shrubs, trees and climbers, and dies-back for other perennials.
    - 30 evergreens are marked, from rosemary and box to hellebores and strawberries, plus 3 that die back (rhubarb, dahlia, peony).
  - **Deciduous plants** are bare from November to April, the trees' months, drawn as twigs over a faint outline.
  - **Plants that die back** are cut back to their crowns from December to February, and small in March and November.
  - **Bulbs** show from two months before they flower to the month after.
  - **What doesn't change:** anything flowering, cropping, or not yet in the ground.
  - On the plan, `seasonal()` in `src/art/plants.ts` changes the look, and the sprite cache key includes it. Bare and cut-back plants cast no soft shadow.
- **Model:** no schema change. The plant data gains the optional `lifePath.winter`.
- **Checked:** screenshots in a 390 px phone frame and on a desktop, in May, July, August and January, from above and standing in the garden, in headless Edge (SwiftShader).
- **Not done:**
  - Your own plants have no winter field on the plant form (they go by the defaults).
  - No frost or a greener lawn by season in 3D.
  - Sketches aren't shown in 3D.
  - No walking round inside it.
  - The canopies are smooth lumps rather than leafy.
  - Plants on the plan still cast no sun-view shade.
  - Already there before this release: on a phone, the year slider's month letters overlap where the year changes.

Tests: `tests/three.test.ts` covers:
- winter habits (data and defaults), runs of months round the new year, bare, cut back and small, bulbs' months, and what the season changes;
- drawing every plant from above (bare and cut back) and from the side (every stage, every winter look), repeatably;
- heights, edging and soil levels, flat things in order, roofs, bare trees and hedges, evergreens;
- plants on their bed, pot or lawn, stages that day, what's left out, groups and turns, fruit trees, thinning;
- the ground with and without a boundary, the sun by season and with north turned;
- 500 plantings worked out in under 400 ms.

### Still open, not in this round
- 3D extras: walking round inside it, frost and a greener lawn by season, sketches, leafier canopies.
- Advanced-only polish: equal-spacing guides, tap a length to type it, sketch text size, move a sketch, recompute footprints on load.
- Small extras: recent searches, searching jobs and notes, weekly jobs on the plan, joining batches, days to crop for your own plants, a warm or cold correction, perennials moved by this year's warmth, potting on, picks on shed trays, a better "best photo".
- Push with the app closed on an iPhone or a computer (it needs a server).
- Parked: accounts and sync, crop rotation, more environment layers, a paid tier.

---

## Repo layout
```
garden-planner/
  .github/workflows/deploy.yml
  data/plants/{vegetable,herb,fruit,flower,shrub,tree}.json
  docs/mvp-plan.md, docs/mismatch-log.md
  src/model/       types, store, commands, migrate, ids
  src/storage/     local, idb, file
  src/geometry/    polygon, snap, hull, thicken
  src/canvas/      viewport, render, tools/*
  src/library/     load, search, user-plants
  src/planting/    place, rules
  src/calendar/    jobs
  src/sun/         position, shadow, hours, hours.worker
  src/ui/          Preact panels, plant card, forms, notes, tabs
  tests/            plants.test.ts validates the plant data
  tests/fixtures/
```
**Rule:** features talk only to `model/` and `library/`. They never import each other, and none adds its own storage.

## Definition of done for every stage
- `npm test` passes (it includes the plant data checks) and the site is deployed to Pages. While working, test by risk as `CLAUDE.md` says; the full suite runs once at the end.
- The app is usable without the sun layer.
- It is checked once on your phone.
- The MVP doc and this plan are updated if anything changed.
- Anything someone using the app would notice gets a **What's new** entry in `src/content/whatsNew.ts`, newest first with a new id: what they can now do and where to find it, in plain English, with no stage numbers or code.

## Verification overall
- Unit tests: geometry, store and undo, migrations, rules, jobs, sun position against NOAA, and shadow length.
- Real-world checks at each gate: tape against the app (Stage 2), real bed warnings (Stage 4), this month's jobs against what you'd actually do (Stage 5), and the shadow photo plus a walk around the heat map (Stage 6).
- I'll run the dev server and drive it in a browser to check each stage before calling it done.
