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
- Files: `data/plants/<category>.json`. They are checked by `tools/validate-plants.ts`, which uses the same types plus checks for months 1–12, companion ids that resolve, a unique id per plant, and source present. The validator runs in CI.
- Batches:
  - **B1**: 30 common vegetables, by week 3 (needed for gate 1)
  - **B2**: 30 more vegetables, by week 5
  - **B3**: 30 herbs and fruit, by week 7
  - **B4**: 30 flowers, by week 9
  - **B5**: 30 shrubs, trees and gaps, after the build
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

## Stages 8–17 — Life stages, Potting Shed, a visual overhaul, microclimates and GDD (added 6 Oct 2026)
Brought forward from "parked": the plant life cycle, frost and Growing Degree Days, plus a graphical overhaul. Stage 7 (real use) runs alongside them. The visual stages come first, so the shed, cards and dates built later use the new art. The shed should be ready before February sowing.

| Stage | What | Status |
| --- | --- | --- |
| 8 | Life stages, without weather | Built |
| 9 | Drawing upgrade: surfaces, curved edges, freehand shapes, sketch layer | Built |
| 10 | Illustrated plants, drawn by code, changing with the stage | Built |
| 11 | Depth and texture: material textures, raised-bed edging, soft shadows, cached static layer | |
| 12 | The Potting Shed, with shelves: trays, places, frost dates, plant out from a tray | |
| 13 | Screens and cards polish | |
| 14 | Greenhouses and cold frames as microclimates | |
| 15 | Growing Degree Days from UK climate averages (capped at 2 weeks) | |
| 16 | Live weather (opt-in Open-Meteo) and succession sowing | |
| 17 | 3D garden view (three.js, loaded only when opened) | |

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
- **Still to come:** a sharper guess from growing degree days (Stage 15), and seedlings off the plan in the Potting Shed (Stage 12).

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
  tools/validate-plants.ts
  tests/fixtures/
```
**Rule:** features talk only to `model/` and `library/`. They never import each other, and none adds its own storage.

## Definition of done for every stage
- `npm test` passes, the plant validator passes, and the site is deployed to Pages.
- The app is usable without the sun layer.
- It is checked once on your phone.
- The MVP doc and this plan are updated if anything changed.

## Verification overall
- Unit tests: geometry, store and undo, migrations, rules, jobs, sun position against NOAA, and shadow length.
- Real-world checks at each gate: tape against the app (Stage 2), real bed warnings (Stage 4), this month's jobs against what you'd actually do (Stage 5), and the shadow photo plus a walk around the heat map (Stage 6).
- I'll run the dev server and drive it in a browser to check each stage before calling it done.
