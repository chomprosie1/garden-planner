// Brings saved gardens and plants from older versions up to the current shape.
// Bump SCHEMA_VERSION whenever the saved shape changes, and add a step here.

export const SCHEMA_VERSION = 7;

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
  if (version === 1) {
    g = gardenV1toV2(g);
    version = 2;
  }
  if (version === 2) {
    // v3 added an optional status to plantings ("growing" for plants already in the ground). Nothing to convert.
    g = { ...g, schemaVersion: 3 };
    version = 3;
  }
  if (version === 3) {
    g = gardenV3toV4(g);
    version = 4;
  }
  if (version === 4) {
    // v5 added surfaces, materials, curved edges and sketches, all optional. Nothing to convert.
    g = { ...g, schemaVersion: 5 };
    version = 5;
  }
  if (version === 5) {
    // v6 added the Potting Shed (places and trays) and frost dates, all optional. Nothing to convert.
    g = { ...g, schemaVersion: 6 };
    version = 6;
  }
  if (version === 6) {
    // v7 added pots and planters, which older versions wouldn't know how to draw. Nothing to convert.
    g = { ...g, schemaVersion: 7 };
    version = 7;
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

// v2: a tree's `canopy` became the general `circle` used by any round feature.
function gardenV1toV2(g: Raw): Raw {
  const features = Array.isArray(g.features) ? g.features : [];
  return {
    ...g,
    schemaVersion: 2,
    features: features.map((f) => {
      if (!isObject(f) || !('canopy' in f)) return f;
      const { canopy, ...rest } = f;
      return canopy === undefined ? rest : { ...rest, circle: canopy };
    }),
  };
}

// v4: life stages. "status: growing" (plants already in the ground) became the planted-out stage.
function gardenV3toV4(g: Raw): Raw {
  const plantings = Array.isArray(g.plantings) ? g.plantings : [];
  return {
    ...g,
    schemaVersion: 4,
    plantings: plantings.map((p) => {
      if (!isObject(p) || !('status' in p)) return p;
      const { status, ...rest } = p;
      return status === 'growing' ? { ...rest, stage: 'transplanted' } : rest;
    }),
  };
}
