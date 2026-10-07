# The plan, refreshed: two changes

6 Oct 2026 · Stages 13a and 13b built 7 Oct 2026; 13c and 14 to come

## Why

The plan works like a CAD program: pick a mode, pick a tool, click corners, fill in a side panel. It's accurate (the 5% tape test passes), but it asks a lot before anything grows, and once drawn it's a still picture. Gardeners in their twenties and thirties will mostly meet it on a phone. They expect to drag things in, watch them change, and show someone the result.

Two changes, both to the plan itself:

1. **Drop, drag, done:** build the plan by dragging things onto it, not by drawing like a draughtsman.
2. **The garden through the year:** a plan that moves through the seasons, instead of a still picture of today.

## Who this is for (assumptions to check)

- **Small or borrowed spaces:** a balcony, a patio, a rented garden, a couple of raised beds, a half allotment plot. Pots and planters matter as much as beds.
- **Phone first,** in short sessions, often standing in the space.
- **Used to direct manipulation:** Canva, Procreate and Figma, and cosy games like Stardew Valley and Animal Crossing, where things grow on a calendar.
- **Learn from video and share what they grow;** care about wildlife, water and cost.
- **Precision for some, not all:** you measure with a tape. Precision stays; it just stops being the front door.

These come from general trends, not research. Test them with five people before building (see Testing).

## What's stale today

| Today | Why it jars |
| --- | --- |
| Three modes: Layout, Planting, Sun | Whether a drag moves a bed or a plant depends on the mode you're in. That's a classic cause of mistakes. |
| Boundary first | An empty plan says "Start with your boundary". On a phone that means the crosshair, Add corner four times, and typing lengths. |
| Forms beside the plan | Width and depth are number fields, kind is a dropdown, and there are sections to open. On a phone, the sheet covers the plan you're editing. |
| Plants from a list | Pick a plant in a side list, choose Single, Row or Block, then place it. |
| A still picture | The plan shows today's stages only. The year lives on the Month page, and sun is a separate mode with its own bar. |
| Nothing to show anyone | There's no way to share the plan as a picture. |
| No pots | Plants only go in beds and greenhouses. |

**On a phone today, the first plant takes about 15 taps across three modes. The target is 5.**

## Change 1: Drop, drag, done

The plan becomes a canvas you arrange, not a drawing you construct.

1. **One canvas, no modes.**
   - Tap anything to select it: a plant, a bed, the lawn. Drag to move it.
   - A **padlock** ("Lock layout") stops beds moving by accident. It replaces the Layout/Planting split.
   - Sun becomes a lens (Change 2).
2. **The dock.** A bar along the bottom, on phone and desktop, with four drawers:
   - **Plants:** search, Sow now, Your plants, Sowing list, In the shed.
   - **Beds and pots:** raised bed 2.4 × 1.2 m, pot Ø30 cm, window box 80 cm, trough, grow bag.
   - **Ground:** lawn, gravel, paving, path.
   - **Structures:** shed, greenhouse, fence, tree.

   Everything is a "sticker" drawn in the plan's own art at a real preset size. Drag one onto the plan, or tap it to drop it in the middle of the view.
3. **Drop a plant into a bed and it fills it sensibly.**
   - A small pop-over offers **One · A row · Fill the bed**.
   - The default suits the plant: carrots in rows, a courgette on its own, lettuce filling the bed.
   - A tray from the Potting Shed drops in the same way.
4. **A floating action pill** sits by whatever's selected, with only what fits it:
   - **A bed:** Size, Curve, Edging, Plant, Duplicate, Delete.
   - **A planting:** Stage, Count, About, Delete.
   - **A lawn:** Material.

   "More" opens today's details panel, which is kept for depth.
5. **Handles, not forms.**
   - Corner and edge handles, with live dimensions while you drag.
   - Tap a dimension to type an exact length.
   - New: a **rotate handle**, so beds and planters can sit at any angle.
6. **Smart guides.** Alignment and equal-spacing lines appear as you drag, as in Figma or Keynote.
   - Things snap to edges, other beds and path widths.
   - A light haptic tick on snap, where the phone supports it.
7. **Pots and planters hold plants.**
   - New kinds: **pot** (round) and **planter** (window box, trough, grow bag).
   - Plants go in them as they do in beds.
   - This brings forward "containers and balcony mode" from the After the MVP list.
8. **Start in a minute.**
   - First run asks "Where are you growing?": Balcony · Patio or yard · Garden · Allotment (full or half plot, about 250 or 125 m²) · Just a bed. Then a size.
   - It makes the space for you. A boundary is optional for a balcony.
   - Tracing a photo and drawing corners stay for people who want them.
9. **Search everything.**
   - Ctrl+K on desktop, or the dock's search on a phone.
   - It finds plants and things on the plan, and actions: "add tomato", "go to the shed", "show sun".

**Kept:** typed lengths, undo, keyboard shortcuts, and the phone's crosshair drawing, which moves into a "Precise" option for boundaries and shapes.

## Change 2: The garden through the year

The plan stops being a snapshot of today and becomes a calendar you can scrub through.

1. **A year scrubber under the plan.**
   - Weeks from a year ago to a year ahead, with Today marked and months labelled.
   - Drag it, or press play for a ten-second year. The plan redraws for that week:
     - each planting at its stage then, from what you've marked plus the plant's months, and later growing degree days (Stage 16);
     - deciduous trees in leaf or bare, the lawn greener in spring and paler in a dry August, and frost sparkle around your frost dates;
     - soft shadows from the sun's real angle that week, replacing today's fixed top-left light.
2. **Gaps show up.** A bed that will stand empty glows faintly: "Empty from 12 Aug: sow winter salads?" This feeds the succession ideas planned for Stage 17.
3. **Jobs on the plan.**
   - The week's jobs sit as small chips on their beds ("Sow carrots", "Harvest"); tap one to tick it.
   - The Month page stays as the list view of the same jobs.
4. **Lenses instead of a Sun mode.** Chips above the plan, one on at a time:
   - **Sun hours**
   - **Shade**, with a time-of-day dial
   - **In flower**, for bees: what's flowering that week
   - **Harvest**: what's ready
   - **Water**: thirsty plants, sharper once live weather arrives

   Each lens recolours the plan with a legend, and uses patterns as well as colour.
5. **Share it.**
   - **Share** makes a picture of the plan at the chosen week, in your look, with the garden's name and month. It's framed for a story (9:16) or a post (4:5).
   - **Make a timelapse** records the year scrub as a short video. It's made on the phone; nothing is uploaded.

## How it fits the build plan

These replace Stage 13 ("Screens and cards polish") and come before microclimates.

| Stage | What | Size |
| --- | --- | --- |
| 13a | No modes, the padlock, the floating pill, handles with typed sizes, rotate, smart guides | ≈1.5 weeks |
| 13b | The dock and stickers, the fill pop-over, pots and planters, dropping trays from the shed | ≈1.5 weeks |
| 13c | First run ("Where are you growing?") and search everything | ≈1 week |
| 14 | The garden through the year: scrubber, projected stages, gaps, job chips, lenses, share and timelapse | ≈2–3 weeks |
| 15–18 | Microclimates, growing degree days, live weather, 3D (renumbered) | as planned |

Growing degree days then sharpen the timeline. The 3D view gets the scrubber for free.

**Files, Change 1:**
- `src/ui/views/Plan.tsx`: modes become the padlock and lenses.
- `src/ui/PlanCanvas.tsx`: one set of selection rules, rotate, guides.
- New:
  - `src/ui/Dock.tsx`
  - `src/ui/ActionPill.tsx`
  - `src/canvas/guides.ts`
  - `src/ui/CommandSearch.tsx`
- `src/model/features.ts`: pot and planter kinds, `rotationDeg`.
- `src/planting/place.ts`: `isContainer` accepts round containers, and `plantPositions` fill circles.
- `src/ui/Onboarding.tsx`.
- `src/ui/Inspector.tsx` stays, as the "More" sheet.

**Files, Change 2:**
- New `src/lifecycle/projection.ts`: a planting's stage on a given date. Pure and tested.
- `src/canvas/render.ts`: `Scene.date` (it already takes a month).
- New `src/ui/YearScrubber.tsx`.
- New `src/ui/Lenses.tsx`: `SunBar` folds into it.
- `src/calendar/jobs.ts`: jobs for a week.
- New `src/share/`: a picture from the canvas; a timelapse with `captureStream` and `MediaRecorder`.

**Model:** schema 7 adds `rotationDeg` and the pot and planter kinds. The plant data doesn't change.

## Risks

- **Losing precision:**
  - Every handle can still take a typed length.
  - The crosshair stays as Precise.
  - Re-run the 5% tape test.
- **Too much on a small screen:** one dock, one pill and one lens at a time. The plan is always in view.
- **Projected stages are guesses:**
  - Drawn with a dotted edge and "Based on usual months" until growing degree days arrive.
  - Stages you've marked always win.
- **Speed while scrubbing:**
  - The cached ground layer redraws once per week, and drawings are cached per stage, so a year is about 52 distinct frames.
  - Budget: 16 ms a frame on a mid-range phone, tested with the 2,000-plant garden.
- **People used to the modes:** a one-time "What's new" showing the three gestures (tap, drag, tap the number).

## Testing with real people

1. **Mock-up first:** a clickable mock-up for you to choose from before any code, as with the five looks.
2. **Five people aged 20 to 35** who grow something (balcony herbs count), on their own phones. Three tasks:
   - plan a 3 × 1 m balcony with salad and herbs;
   - find when a bed will be empty;
   - share your plan for July.
3. **Measures:**
   - first plant placed within 2 minutes and 6 taps;
   - nobody needs help telling "move a bed" from "move a plant";
   - 4 of 5 spot the empty-bed gap without being told;
   - at least 2 of 5 say they'd share the picture.
4. **After building:** the same tasks with three of the same people, plus you, on your real garden.

## Decisions (7 Oct 2026)

1. **Modes:** removed entirely, with no "Classic" switch.
2. **Timeline:** a year either side of today.
3. **Sharing:** both the picture and the video timelapse.
