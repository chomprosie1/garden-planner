# Garden Planner

A UK garden planner: Preact, Vite and TypeScript, drawn on a Canvas 2D, and kept on the device (no server). The plan of record is [docs/build-plan.md](docs/build-plan.md); ideas waiting are in [docs/wishlist.md](docs/wishlist.md).

**Rule:** features talk only to `src/model/` and `src/library/`. They never import each other, and none adds its own storage.

## Testing by risk
This is still a proof of concept. Test what a change could break, not everything every time. The suite takes about 10 seconds; the real cost is reading its output and taking screenshots, so keep both small.

1. **While working:** run only the tests for the areas you touched (the table below), quietly, and read only the failures:
   `npx vitest run tests/jobs.test.ts tests/stages.test.ts --reporter=dot`
2. **Typecheck** after any `.ts` or `.tsx` change: `npx tsc -p tsconfig.json --noEmit`. The tests aren't typechecked, and `npm run build` is otherwise the only check.
3. **Full suite straight away** (`npx vitest run --reporter=dot`) when you change a file many tests lean on:
   - `src/model/*`, especially `migrate.ts`, `validate.ts` and `types.ts`
   - `src/storage/file.ts`
   - `src/planting/place.ts`
   - `src/calendar/jobs.ts`
   - `src/lifecycle/stages.ts` and `src/lifecycle/projection.ts`
4. **Always:**
   - words on screen changed: run `tests/words.test.ts`;
   - `data/plants/*.json` or `data/varieties.json` changed: run `tests/plants.test.ts`, `tests/art.test.ts`, `tests/varieties.test.ts` and `tests/feeding.test.ts`;
   - a schema change: add a migration test;
   - colours changed: run `tests/contrast.test.ts`.
5. **End of a release:** one full `npm test` and `npm run build` (CI runs both again on push). Take screenshots in a 390 px frame only of the screens the release changed. Skip the browser for logic-only changes.
6. **New tests:** cover behaviour that would hurt if wrong: lost data, wrong dates, plants in the wrong place, bad migrations. Don't test pure styling or wording.
7. **No tests at all here,** so check by hand when touched: `src/ui/views/*` and most `src/ui/*.tsx`, `public/sw.js`, `src/storage/idb.ts` and `local.ts`, `src/storage/photos.ts`, `src/canvas/materials.ts`, `src/share/timelapse.ts`.

### Which tests cover what
| Area | Tests |
| --- | --- |
| `geometry/*` | geometry, drawing |
| `model/store`, undo | store, plan |
| `model/migrate`, `model/validate`, `storage/file` | file, drawing, shed, stages, ux-delight, plus any test using a fixture |
| `model/features`, `model/stickers`, `model/spaces` | depth, arrange, start, ux-first-minute |
| `canvas/*` (hit, snap, viewport, render) | plan, sun, usability |
| `planting/place`, `planting/fill`, `planting/rules` | planting, arrange, start, jobs, drawing |
| `planting/kits`, `planting/batches`, `planting/harvest` | ux-first-minute, weather, ux-daily, ux-delight, good-start |
| `library/*`, `data/plants/*.json`, `data/varieties.json` | plants, art, three, varieties, feeding, kitchen, usability, good-start |
| `art/*` | art |
| `calendar/jobs` | jobs, stages, shed, microclimate, weather, feeding |
| `feeding/*`, `data/feeds.json` | feeding, stages, on-track |
| `planting/seeds` | varieties |
| `calendar/week` | ux-daily, ux-delight |
| `lifecycle/stages`, `lifecycle/happened` | stages, art, warmth, ux-daily |
| `lifecycle/shed` | shed, microclimate, warmth |
| `lifecycle/projection`, `lifecycle/growth` | year, warmth, microclimate |
| `lifecycle/frostWatch` | weather, ux-delight |
| `climate/*` | microclimate, warmth, weather |
| `weather/*`, `storage/weatherCache` | weather, ux-first-minute |
| `storage/persist`, `lifecycle/sowList` | good-start, sowing-cardboard |
| `sun/*` | sun, planting, drawing |
| `theme/*`, `content/seasons` | prefs, contrast, depth, ux, usability |
| `content/photos` | photos |
| `share/poster`, `share/wrapped` | year, ux-delight |
| `ui/yearScene`, `ui/search`, `ui/setup`, `ui/Onboarding`, `ui/GardenSettings`, `ui/PlantCard`, `ui/PlanCanvas` | year, start, usability, ux-first-minute, ux |
| Any words on screen in `src/` | words |

Test files are `tests/<name>.test.ts`.

## Finishing a release
1. Tests and build pass.
2. The build plan gets an "as built" section.
3. A What's new entry goes in `src/content/whatsNew.ts`: plain English, no stage numbers or code.
4. Commit and push, which deploys to Pages.
5. Check the deploy run.
