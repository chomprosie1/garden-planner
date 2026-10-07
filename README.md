# Garden Planner

A to-scale planner for one real garden: the layout, what grows where, what each plant needs, what to do this month, and sun and shade. It runs entirely in the browser and is hosted free on GitHub Pages.

- **Live site:** https://chomprosie1.github.io/garden-planner/
- **What and why:** [docs/mvp-plan.md](docs/mvp-plan.md)
- **How it's being built, stage by stage:** [docs/build-plan.md](docs/build-plan.md)

## Run it locally

```sh
npm install
npm run dev      # http://localhost:5173/garden-planner/
npm test         # unit tests
npm run build    # type-check and build to dist/
```

Every push to `main` runs the tests and deploys to Pages.

## Your data

Your garden is saved in your browser, never on a server. Use **Download a backup** (Settings, or the reminder on Home) for a backup file, and **Restore from a backup** to get it back or move it to another device. Plant checks are kept per device.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/model/` | The garden and plant types, the store with undo, migrations and validation |
| `src/storage/` | Browser autosave, export and import, IndexedDB for images |
| `src/geometry/` | Pure maths in millimetres: areas, snapping, hulls, fence outlines |
| `src/theme/` | The five looks (light and dark), fonts, and per-device preferences |
| `src/content/` | Seasonal lines and jobs for each month, and the photo manifest |
| `src/ui/` | Preact screens: Home (with the journal), Plan (one canvas with a dock, an action pill, and sun and shade lenses), Plants, Month, Settings, plant checks, first run |
| `src/planting/` | Plantings, their positions and status, filling a bed, and the spacing, neighbour and light rules |
| `src/lifecycle/` | Life stages, the Potting Shed, and each planting's stage on any day of the year |
| `src/share/` | A picture of the plan, and a timelapse of the year, made on the device |
| `src/calendar/` | Each month's jobs for your own plants |
| `src/sun/` | Sun position (UK time), shadows and sun hours |
| `src/library/` | Loading the plant library, your own plants and your plant checks |
| `public/seasons/` | Seasonal photos, added only with `npm run add-photo` |
| `tools/` | `add-photo.ts`: fetches a Commons photo, checks its licence, makes the sizes |
| `data/plants/` | The starter plant library, one JSON file per category |
| `tests/` | Vitest unit tests and fixtures |

Features read from `model/` and the plant library only; they never import each other and none keeps its own storage.
