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

Tests: rule fixtures (e.g. carrots too close; onions next to peas → avoid).
**Done when:** a real bed is filled, and the app flags real spacing and clash problems with no false alarms you can't explain.

## Stage 5 — Garden calendar (week 6) → Gate 2
- `src/calendar/jobs.ts`: `jobsFor(garden, plants, month) → Job[]`.
  - It covers active plantings (not removed) and plants you mean to sow (from a simple "wishlist" of plant ids kept in the garden).
  - Job kinds: sow indoors, sow direct, plant out, harvest, protect for winter, lift and store, autumn tidy.
  - Each job has a stable key such as `sow-direct:carrot:2026-11`, so ticking it off writes to `jobsDone`.
- "This month" view plus a "next month" preview, grouped by job kind, readable on a phone. Show "Dates are UK averages; adjust for your area" on screen.

Tests: job fixtures for a month for 5 known plants.
**Gate 2 (end of week 6):** spacing and clash warnings are right for a real bed, and the month list matches what you'd actually do. If it fails, fix the plant data and rules before adding layers.

## Stage 6 — Sun and shade (weeks 7–8, hard cap of 2 weeks)
- **6a** `src/sun/position.ts`: wrap SunCalc and convert to garden coordinates using `northRotationDeg`. All times are in Europe/London via `Intl`. Unit-test against NOAA values for your latitude, including midwinter noon at 53°N ≈ 13.6°, and test both sides of the clock change (last Sunday of October and of March).
- **6b** `src/sun/shadow.ts`: the shadow vector = height / tan(altitude), along the anti-azimuth. For a feature, shadow = convex hull of its footprint plus the projected footprint (the footprints are convex or split into convex parts). Tree shadow = the canopy circle projected from canopy height. Opacity is in-leaf or bare depending on the month.
- **6c** Render shadows at the time on a date and time slider, with a play button and "today" and "midwinter / equinox / midsummer" presets.
- **6d** `src/sun/hours.ts`: a 250 mm grid over the boundary, sampled every 15 min from sunrise to sunset on a chosen day (the 15th of the selected month). Each sample adds (1 − blocking opacity) × 0.25 h. Run it in a Web Worker if it takes over about 300 ms, and cache it until a feature or the date changes.
- **6e** Heat map overlay (sequential palette with a legend), plus light suitability. Light thresholds: full sun ≥ 6 h, part shade 3–6 h, shade < 3 h, measured for the month the plant is in the ground (default June). These feed the `light` rule in Stage 4.
- Stopping point: shadows match a photo at one time, and the heat map agrees for the main patches. Polish (soft edges, terrain, Clipper2 unions) waits until after gate 3.

**Done when:** one fence's shadow matches a photo, which needs a clear day, so take it whenever one comes. The heat map agrees for the main patches.

## Stage 7 — Real use and hardening (week 9 → 31 Mar 2027) → Gate 3
- Use it to plan the 2027 sowing. Keep a `docs/mismatch-log.md` of every time the app was wrong or awkward, and fix the worst each fortnight.
- Export a backup monthly. Keep each export so an old garden can be checked against the migrations.
- Small quality work only: speed on a phone, an empty-state help screen, and keyboard shortcuts.

**Gate 3 (31 Mar 2027):** did it change at least one real placement, planting or timing decision? If yes, continue with the "After the MVP" list, starting with the progressive web app. If no, stop or narrow the idea before spending anything.

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
