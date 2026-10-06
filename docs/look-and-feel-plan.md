# Look and feel: seasonal photos and five looks

Oct 6, 2026 · plan, not yet built

## Why

The app works, but it looks like a form. Gardeners come back to things that make them feel something, and an English garden changes every month. Two ideas:

1. **Seasonal photos:** one aspirational, photo-realistic English garden scene for each month, which changes as the year turns.
2. **Five looks:** a choice of style, from traditional to modern, so the app feels like *their* garden book.

The rule that keeps this honest: **the photos make people want to open the app; the plan itself stays clear enough to measure from.** A photo never sits behind lines you have to read accurately.

## The UX problem to solve first

The app has two jobs that pull in opposite directions:

| Job | Needs |
| --- | --- |
| Inspire: "what's happening in the garden this month?" | Big photos, warm words, very little to read |
| Plan: draw to the millimetre, read warnings, fill forms | High contrast, calm backgrounds, nothing moving |

So the app needs **places for each**, not one screen trying to do both. That means a new screen, **Home**, where the photos live, and a Plan workspace where they step back.

## Navigation (changes the Stage 1 shell)

Five places in place of four tabs:

| Place | What it's for | Photos |
| --- | --- | --- |
| **Home** | This month at a glance: the season, your next jobs, your garden, recent notes | Full hero photo |
| **Plan** | The to-scale garden: drawing and planting | Only in the margins around the plan sheet, or off |
| **Plants** | Library and plant cards | None behind content (plant photos on cards come later, same licence rules) |
| **Month** | The job list | A slim photo band at the top |
| **Notes** | Diary | None |

- **Phone:** a bottom tab bar with five icons and labels, opening on Home.
- **Desktop:** a slim left rail, reopening wherever you left off. Plan keeps its side panel for properties and warnings.
- **Settings** (location, north, backup, Appearance, Credits) moves out of the Garden tab to a gear icon in the top bar, because it isn't part of daily use.

### Home, on a phone

```
┌──────────────────────────────┐
│ [ full-bleed October photo ] │
│                              │
│  October                     │
│  Lift the dahlias, plant     │
│  garlic, gather the apples.  │
│                      ⓘ photo │
├──────────────────────────────┤
│ This month in your garden    │
│  ○ Sow broad beans (direct)  │
│  ○ Plant garlic              │
│  ○ Net the brassicas    All →│
├──────────────────────────────┤
│ Your garden   [mini plan]  → │
├──────────────────────────────┤
│ Latest note · 2 Oct          │
│ "Carrot fly netting off."    │
├──────────────────────────────┤
│ ⌂ Home  ▦ Plan  ✿ Plants  ☐ Month  ✎ Notes │
└──────────────────────────────┘
```

- The month line comes from 12 short seasonal blurbs written once. Until Stage 5 builds your own job list, Home shows general jobs for the month instead, which helps from day one.
- ⓘ opens the credit: title, author, licence and source link. Attribution is required for CC BY and CC BY-SA, so it's one tap from the photo and also on the Credits page.
- Text on the photo sits on a dark gradient (a scrim) so it always meets contrast, whatever the photo.

### Plan workspace

```
┌ rail ┬───── photo, dimmed, at the edges ─────┬ panel ┐
│  ⌂   │   ┌──────────────────────────────┐    │ Bed 2 │
│  ▦   │   │  plan "sheet" in the look's  │    │ 3.2m  │
│  ✿   │   │  paper colour, exact lines   │    │ ...   │
│  ☐   │   └──────────────────────────────┘    │       │
└──────┴───────────────── [Focus ⤢] ────────────┴───────┘
```

- The plan is drawn on a "sheet" in the look's paper colour, with the photo dimmed and blurred around it, like a drawing on a garden table.
- **Focus** (button or the F key) hides the photo and the chrome while you draw. It is on by default in the Minimal look.

## The five looks

Each look comes in light and dark and follows your device's setting unless you choose one. A look sets colours, fonts, corners, how photos are treated, and how the plan is drawn. The photos are the same in every look: only their treatment changes. That keeps the number of photos at 12, not 60.

| Look | Feel | Type | Colours | Photos | Plan drawing |
| --- | --- | --- | --- | --- | --- |
| **Cottage** (traditional) | Soft, homely, a well-thumbed garden book | Serif headings (Libre Baskerville), friendly sans body | Cream, sage, dusty rose, terracotta | Warm tint, soft vignette | Soft textured fills, rounded bed corners, handwritten-style labels |
| **Heritage** (traditional, formal) | Victorian walled kitchen garden, estate survey plan | Engraved-style serif (Playfair Display), small caps | Bottle green, brick, brass, parchment | Slightly faded, framed like a print | Ink lines, hatched beds, compass-rose north, title block with name and scale |
| **Allotment** (practical, vintage) | An old seed packet and allotment enamel signs. Grown-up, not cartoonish: no thick black outlines, hard shadows or tilted cards | Slab serif (Zilla Slab), stencil for plot signs (Stardos Stencil), Work Sans body | Kraft paper, deep teal-green, faded brick red, soil browns | Slightly faded, sepia-warmed | Soil beds with dashed planting rows, enamel "PLOT 2" signs, italic hand-written crop notes, fence posts |
| **Modern** | Clean, contemporary, app-like | Geometric sans (Manrope) | White, charcoal, vivid leaf green | Full-bleed, glassy panels over them | Flat fills, crisp thin lines, subtle shadows |
| **Minimal** | Calm and focused, for planners | System font, fastest to load | Greys with one green accent | Home only; Focus on by default | Technical, CAD-like linework |

- **Fonts:** all on the Open Font License, served from the app itself (no Google request on every visit), with only the active look's fonts loaded.
- **Plan textures** (grass, gravel, hatching, stripes) are drawn by code, so there are no texture images to license.
- **Default for new users:** Cottage. It's the warmest first impression and suits a UK gardening audience. The welcome screen offers the others straight away.

## Appearance settings

```
Appearance
  Look          [Cottage] [Heritage] [Allotment] [Modern] [Minimal]   ← live preview cards
  Mode          ( Auto ) ( Light ) ( Dark )
  Seasonal photos  ( Full ) ( Subtle ) ( Off )
  Photo month   ( Follow the calendar ) ( Choose: [ May ▾ ] )
  Text size     ( Standard ) ( Large )
```

- Each look is a card showing a mini Home and a mini plan in that look. Tapping one applies it at once, and you can tap again to change your mind. No "save" button.
- These settings belong to the device, not the garden: they are stored in browser storage, not in the export. Two people sharing a garden file can each have their own look.
- **Large text** is included because many keen gardeners are older, and it costs little once the type scale is built from tokens.
- **Off / Subtle photos** is for slow connections and people who just want to plan. On a "save data" connection the app defaults to Subtle.

## First run

1. **Welcome:** this month's photo, full-bleed. "Plan your garden, month by month." [Get started]
2. **Choose a look:** the five preview cards, with "You can change this any time" below.
3. **Your garden:** name and location ("Use this device's location"), explaining in one line why location matters (sun and shade).
4. **Into Plan,** with one coach mark: "Start by drawing your boundary."

Every step has Skip. Returning users never see this again, and Settings → Appearance repeats step 2.

## Small moments of delight (cheap, all optional)

- **A new month:** the first time you open the app in a new month, the photo cross-fades to the new one and a note says "Welcome to November: 4 jobs this month."
- **Seasonal accent:** each photo carries a colour picked from it at build time. It tints the month heading and works as the loading placeholder, so the page never flashes white, and it is checked for contrast.
- **Reduced motion:** if the device asks for reduced motion, there are no fades or slow pans.

## The photos

### What each month shows (English, aspirational, real)

| Month | Scene |
| --- | --- |
| January | Frosted kitchen garden, kale and leeks under hoar frost |
| February | Snowdrops under bare trees |
| March | Daffodils, freshly dug beds ready for sowing |
| April | Apple or cherry blossom; seedlings on a greenhouse bench |
| May | Tulips and neat allotment rows; bluebells |
| June | Roses on a cottage wall, a border at its peak |
| July | Sweet peas and a vegetable bed in full abundance |
| August | Harvest basket, sunflowers, runner beans |
| September | Apples on the tree, ripening pumpkins |
| October | Autumn colour, squash curing, a misty morning |
| November | Fallen leaves, bare structure, a robin on a fork handle |
| December | Frosted seedheads and holly, low winter sun |

**Later, if wanted:** 2–3 photos per month, rotating, so it stays fresh across a second year.

### Where they can come from (licence rule)

Only public domain, CC0, CC BY or CC BY‑SA, read from the source's own metadata and credited.

| Source | Use? | Why |
| --- | --- | --- |
| **Wikimedia Commons** | Yes, first choice | The API returns licence and author per file. Its "Quality images" and "Featured pictures" collections are high-quality. |
| **Geograph Britain and Ireland** | Yes | Every photo is CC BY‑SA 2.0, and all are British. Quality varies, so curate carefully. |
| **Flickr** | Only with the licence filter | Only CC BY, CC BY‑SA, CC0 or Public Domain Mark, checked through the API |
| Unsplash, Pexels, Pixabay | **No** | Their own licences, not on the allowed list |
| AI-generated | No | Not "real" for an aspirational garden photo, and their licence position is unsettled |

Also avoid recognisable people, and signs or logos (National Trust, RHS, brand names).

### How they're chosen and added

1. For each month, I search the allowed sources, check each candidate's licence and size, and make a **contact sheet** showing 3–4 candidates per month with credit lines. **You pick.**
2. `tools/add-photo.ts <source URL>` reads the licence and author from the source's API and refuses anything outside the four allowed licences. It then downloads the original and makes AVIF and WebP versions at 640, 1280 and 1920 px wide. It also records a **focal point**, so phone and desktop crops keep the subject, and picks the accent colour.
3. Everything goes in `src/assets/seasons/manifest.json`: file, month, title, alt text, author, licence, licence URL, source URL, focal point, colour, and "resized and cropped from original" (needed for CC BY‑SA).
4. A **CI check fails the build** if any image lacks an allowed licence, an author or a source, or goes over its size budget.
5. **Credits page** (Settings → Credits): every photo with author, licence and source link, plus fonts and SunCalc.

### Speed budget

- Load only the current month's photo, at the size the screen needs: about 60 KB on a phone, 250 KB at most on a big screen.
- The accent colour shows instantly, then the photo fades in.
- Nothing else is preloaded. Photos never delay the plan opening.

## How it's built

- **Tokens:** the existing CSS colour tokens grow into a full set per look: colours (light and dark), fonts, type scale, corners, shadows, borders and photo treatment (`--photo-filter`, `--photo-scrim`, `--photo-margin-opacity`). Each look is one block in `src/theme/looks.css`, selected with `<html data-look="cottage" data-mode="auto">`.
- **Plan styles:** the canvas can't read CSS directly, so each look also has a `PlanStyle` in `src/theme/plan-styles.ts` (fills, patterns, line weights, label font). The renderer redraws when the look changes. This lands with Stage 2's renderer, so the plan is themed from the start rather than retrofitted.
- **No flash:** a tiny inline script in `index.html` reads the saved look before the page draws.
- **Preferences:** `src/theme/prefs.ts` holds look, mode, photos, photo month and text size. They are stored per device, outside the garden model and the export.
- **Content:** `src/content/seasons.ts` holds the 12 month blurbs and general jobs.

## Tests

- **Contrast test (automatic):** for every look in light and dark, check text, muted text, accent text and warning colours against their backgrounds at WCAG AA (4.5:1 for text). Text on photos is checked against the scrim's darkest-to-lightest range. CI fails on any miss.
- **Licence check:** the manifest validator runs on every push.
- **Screenshots:** 5 looks × light and dark × phone (390 px) and desktop, captured headless for a quick visual check on each change.
- **Real-world:** open it on your phone on mobile data, and time Home to first photo.

## Where it fits in the build

A new **Stage 1.5 — Look and feel**, before Stage 2. Doing it now is cheaper than retrofitting, because Stage 2's canvas renderer and every screen after it will read these tokens.

**Capped at 1.5 weeks**, like the sun layer, because it's the kind of thing that can absorb a month.

| Part | In Stage 1.5 | Later |
| --- | --- | --- |
| New navigation: Home, Plan, Plants, Month, Notes, Settings | Yes | |
| Token system, 5 looks (colours, type, photo treatment), light and dark | Yes | |
| Appearance settings and first-run flow | Yes | |
| 12 photos, pipeline, manifest check, Credits | Yes | Rotating 2–3 per month |
| Home with month blurb and general jobs | Yes | Your own jobs (Stage 5) |
| Plan styles per look | Defined here | Drawn in Stage 2 |
| Month-change cross-fade, accent colour | Yes, if time allows | |

**Effect on dates:** Stages 2–6 move back about 1.5 weeks, so the build finishes mid-December rather than early December. Gate 3 stays at **31 March 2027**, still in time for spring decisions.

**Done when:** you can switch between all five looks on your phone and each feels finished. Every month has a chosen, credited photo. All looks pass the contrast test. Home loads its photo in under about 2 seconds on mobile data.

## Decisions

- **All five looks stay as options** (decided 6 Oct 2026): the choice itself is a key feature.
- **Allotment reworked** (6 Oct 2026): the first mock-up read as a children's site, so it is now a vintage seed packet with enamel plot signs.
- **Dark mode is required for every look** (6 Oct 2026). Each look has its own dark version, not an inverted copy: Cottage becomes an evening garden, Heritage a night survey in parchment ink on bottle green, Allotment a potting shed at dusk, Modern near-black with bright leaf green, Minimal light linework on charcoal. In dark mode the plan sheet is dark too, photos are dimmed to about 80% brightness, and accent colours are lightened so they keep 4.5:1 contrast.
- Mock-ups of all five, light and dark: https://claude.ai/artifact/HZ2596eLZtiqVTwoUtrX3B

Still open:

1. **Default look:** I suggest Cottage.
2. **One photo per month to start,** with rotation later: agreed?
3. **Picking photos:** I make the contact sheet and you choose. It's about 30 minutes of your time for all 12 months.
