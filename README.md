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

Your garden is saved in your browser, never on a server. Use **Export garden** for a backup file, and **Import** to restore it or move it to another device.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/model/` | The garden and plant types, the store with undo, migrations and validation |
| `src/storage/` | Browser autosave, export and import, IndexedDB for images |
| `src/geometry/` | Pure maths in millimetres: areas, snapping, hulls, fence outlines |
| `src/ui/` | Preact panels and forms |
| `data/plants/` | The starter plant library, one JSON file per category |
| `tests/` | Vitest unit tests and fixtures |

Features read from `model/` and the plant library only; they never import each other and none keeps its own storage.
