# Garden Planner

A to-scale planner for one real garden: the layout, what grows where, what each plant needs, what to do this month, and sun and shade. It runs entirely in the browser, installs to a phone's home screen and works offline, and is hosted free on GitHub Pages.

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

Your garden is saved in your browser, never on a server. If you turn on this year's weather (Settings → Your climate), the garden's location, rounded to about a kilometre, is sent to Open-Meteo for the forecast; the weather is kept on your device. Photos on notes are shrunk on the device and kept in this browser, never in the garden file; **Download a backup** (Your garden, or the reminder on Today) makes a backup file, **With photos** one that carries them too, and **Restore from a backup** gets it back or moves it to another device. Frost warnings and the weekly jobs reminder are off until you turn them on (Your garden → Reminders); frost warnings send the rounded location to Open-Meteo now and then, from the installed app. Plant checks are kept per device.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/model/` | The garden and plant types, the store with undo, migrations and validation |
| `src/storage/` | Browser autosave, backups (with photos if you like), IndexedDB for images and photos, and what the reminders watch |
| `src/geometry/` | Pure maths in millimetres: areas, snapping, hulls, fence outlines |
| `src/theme/` | The five looks (light and dark), fonts, and per-device preferences |
| `src/content/` | Seasonal lines and jobs for each month, the photo manifest, and What's new |
| `src/ui/` | Preact screens. Four tabs: Today (with the journal and the month's jobs), Garden (the plan: one canvas with a dock, an action pill and ways to show sun, shade and more), Seedlings (the Potting Shed) and Plants. Plus Your garden, Settings, plant checks, first run and What’s new |
| `src/planting/` | Plantings, their positions and status, filling a bed, sowing in batches, starter kits, the harvest log, and the spacing, neighbour and light rules |
| `src/climate/` | Greenhouses and cold frames as microclimates, and your garden's usual warmth from UK climate averages |
| `src/weather/` | This year's weather and the forecast from Open-Meteo (opt-in), and finding a place by postcode or name |
| `src/lifecycle/` | Life stages, the Potting Shed, growing degree days, and each planting's stage on any day of the year |
| `src/share/` | A picture of the plan, a timelapse of the year, and your season wrapped, made on the device |
| `src/calendar/` | Each month's jobs for your own plants, and what's coming up this week |
| `src/sun/` | Sun position (UK time), shadows and sun hours |
| `src/library/` | Loading the plant library, your own plants and your plant checks |
| `public/seasons/` | Seasonal photos, added only with `npm run add-photo` |
| `public/sw.js`, `public/manifest.webmanifest` | The service worker (offline, and reminders where the browser allows) and the install details |
| `tools/` | `add-photo.ts`: fetches a Commons photo, checks its licence, makes the sizes; `make-icons.ts`: the app's icons (`npm run icons`) |
| `data/plants/` | The starter plant library, one JSON file per category |
| `data/climate/` | Monthly day and night temperatures for 16 UK weather stations, 1991–2020 |
| `tests/` | Vitest unit tests and fixtures |

Features read from `model/` and the plant library only; they never import each other and none keeps its own storage.
