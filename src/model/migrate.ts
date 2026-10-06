// Brings saved gardens and plants from older versions up to the current shape.
// Bump SCHEMA_VERSION whenever the saved shape changes, and add a step here.

export const SCHEMA_VERSION = 1;

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function migrateGarden(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  let g: Raw = { ...raw };
  let version = typeof g.schemaVersion === 'number' ? g.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new Error(`This file was made by a newer version of the app (schema ${version}). Update the app and try again.`);
  }
  if (version === 0) {
    g = gardenV0toV1(g);
    version = 1;
  }
  return g;
}

export function migratePlant(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const p: Raw = { ...raw };
  // v0: sowing was a single object; it is now a list.
  if (isObject(p.sowing)) p.sowing = [p.sowing];
  if (typeof p.verified !== 'boolean') p.verified = false;
  if (typeof p.userAdded !== 'boolean') p.userAdded = true;
  return p;
}

// v0 is the shape in the first MVP plan: no version, no wishlist or job log,
// and a single opacity per feature.
function gardenV0toV1(g: Raw): Raw {
  const features = Array.isArray(g.features) ? g.features : [];
  return {
    ...g,
    schemaVersion: 1,
    features: features.map((f) => {
      if (!isObject(f)) return f;
      const { opacity, ...rest } = f;
      if (typeof opacity !== 'number') return rest;
      return { ...rest, opacityInLeaf: opacity, opacityBare: opacity };
    }),
    plantings: Array.isArray(g.plantings) ? g.plantings : [],
    notes: Array.isArray(g.notes) ? g.notes : [],
    wishlist: [],
    jobsDone: [],
  };
}
