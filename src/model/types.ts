// The garden model and plant record. Every feature reads from these, and
// saved data is always in real-world integer millimetres, never pixels.

/** [x, y] in integer mm. Origin at the canvas's bottom-left, y pointing up the canvas. */
export type Point = [x: number, y: number];

export interface Garden {
  schemaVersion: number;
  name: string;
  latitude: number; // WGS84 decimal degrees
  longitude: number;
  northRotationDeg: number; // 0 = top of canvas is true north, clockwise positive
  boundary: Point[];
  features: Feature[];
  plantings: Planting[];
  wishlist: string[]; // plant ids you mean to sow, for the calendar
  jobsDone: JobDone[];
  notes: Note[];
  /** How plants are spaced: close, each way in beds (the default), or in traditional rows. */
  spacing?: SpacingStyle;
  /** A photo or screenshot to trace over. The image itself stays in this browser (IndexedDB). */
  trace?: Trace;
}

export type SpacingStyle = 'close' | 'rows';

export interface Trace {
  /** Bottom-left corner of the image, mm. */
  x: number;
  y: number;
  /** Real-world width of the whole image, mm; height follows the image's proportions. */
  widthMm: number;
  opacity: number; // 0 to 1
  calibrated: boolean;
}

export const FEATURE_KINDS = [
  'bed',
  'path',
  'fence',
  'wall',
  'building',
  'greenhouse',
  'tree',
  'hedge',
  'compost',
  'water',
  'other',
] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export interface Feature {
  id: string;
  kind: FeatureKind;
  name?: string;
  /** The outline on the ground. For lines and circles it is derived from `line` or `circle`. */
  footprint: Point[];
  heightMm?: number; // used by the sun layer; absent for flat features
  /** Centre line of a fence, wall, hedge or path, with its width. */
  line?: Point[];
  widthMm?: number;
  /** Round features: a tree's canopy, a water butt. */
  circle?: { centre: Point; radiusMm: number };
  deciduous?: boolean;
  opacityInLeaf?: number; // 0 to 1, share of light blocked in leaf
  opacityBare?: number; // 0 to 1, share of light blocked when bare
}

export interface Planting {
  id: string;
  plantId: string;
  featureId: string; // the bed it sits in
  x: number; // mm
  y: number;
  layout?: 'single' | 'row' | 'block';
  endPoint?: Point; // far end of a row, or opposite corner of a block
  count?: number;
  sownOn?: string; // ISO date
  /** "growing": already in the ground, e.g. bought as plants. Otherwise the status follows the dates. */
  status?: 'growing';
  removedOn?: string; // ISO date; kept for history
}

export interface Note {
  id: string;
  date: string; // ISO date
  text: string;
  featureId?: string;
  plantingId?: string;
}

export interface JobDone {
  key: string; // e.g. "sow-direct:carrot:2026-11"
  date: string; // ISO date it was ticked off
}

export const PLANT_CATEGORIES = ['vegetable', 'herb', 'fruit', 'flower', 'shrub', 'tree'] as const;
export type PlantCategory = (typeof PLANT_CATEGORIES)[number];

export const LIGHT_LEVELS = ['full-sun', 'part-shade', 'shade'] as const;
export type Light = (typeof LIGHT_LEVELS)[number];

export const SOWING_METHODS = ['indoors', 'direct', 'cold-frame'] as const;
export const WINTERING_TYPES = ['hardy', 'protect', 'lift-and-store', 'annual'] as const;

export interface Sowing {
  method: (typeof SOWING_METHODS)[number];
  months: number[]; // 1 to 12
  depthMm?: number;
  notes?: string;
}

export interface Plant {
  id: string; // library ids are plain slugs; your own plants start "user-"
  commonName: string;
  latinName?: string;
  category: PlantCategory;
  conditions: {
    light: Light;
    minSunHours?: number;
    soil?: string;
    moisture?: 'dry' | 'moderate' | 'moist';
    hardiness?: string;
  };
  /**
   * spacingMm and rowSpacingMm are the traditional row spacings, as on seed packets. closeSpacingMm is the
   * spacing each way for close planting in a bed, as most home gardeners grow.
   */
  size: { heightMm?: number; spreadMm?: number; spacingMm: number; rowSpacingMm?: number; closeSpacingMm?: number };
  sowing?: Sowing[];
  plantOutMonths?: number[];
  cropping?: { harvestMonths: number[]; notes?: string };
  /** Months it's in flower, for flowers and anything grown for its flowers. */
  flowerMonths?: number[];
  lookOutFor?: string[];
  pests?: { name: string; signs: string; control: string }[];
  companions?: { good: string[]; avoid: string[] }; // plant ids
  wintering?: { type: (typeof WINTERING_TYPES)[number]; notes?: string };
  image?: { url: string; credit: string; licence: string; sourceUrl: string }; // PD, CC0, CC BY or CC BY-SA only
  source?: string;
  lastChecked?: string; // ISO date
  verified: boolean;
  userAdded: boolean;
}

/** Everything the app holds and saves. */
export interface AppState {
  garden: Garden;
  userPlants: Plant[];
}
