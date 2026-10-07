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
  /** Pen marks, arrows and words drawn over the plan: ideas, not measurements. */
  sketches?: Sketch[];
  /** Where seedlings are raised before they go in the garden: shelves, windowsills, a propagator, a cold frame. */
  shedPlaces?: ShedPlace[];
  /** Seeds sown in trays and pots, not yet planted out. They have no place on the plan until they are. */
  trays?: Tray[];
  /** Average last spring frost and first autumn frost, "MM-DD". Absent: estimated from the latitude. */
  lastFrost?: string;
  firstFrost?: string;
}

export const SHED_PLACE_KINDS = ['shelves', 'windowsill', 'propagator', 'greenhouse-bench', 'cold-frame'] as const;
export type ShedPlaceKind = (typeof SHED_PLACE_KINDS)[number];

export interface ShedPlace {
  id: string;
  kind: ShedPlaceKind;
  name: string;
  shelves: number;
  /** Trays or pots each shelf holds. */
  slots: number;
  /** The greenhouse or cold frame on the plan this place is in, which it shares its climate with. */
  featureId?: string;
}

export const CONTAINERS = ['module-tray', 'seed-tray', 'pot-9cm', 'pot-1l', 'root-trainer'] as const;
export type Container = (typeof CONTAINERS)[number];

/** Stages a tray goes through before it's planted out. */
export type TrayStage = 'sown' | 'germinated' | 'hardening';

export interface Tray {
  id: string;
  plantId: string;
  container: Container;
  /** Seedlings (or seeds sown) in it. */
  count: number;
  sownOn: string; // ISO date
  /** Absent: just sown. */
  stage?: Exclude<TrayStage, 'sown'>;
  stageDates?: Partial<Record<Exclude<TrayStage, 'sown'>, string>>;
  placeId: string;
  /** Shelf and slot, from 0, top shelf first. */
  shelf: number;
  slot: number;
}

export const SKETCH_KINDS = ['pen', 'highlighter', 'arrow', 'text'] as const;
export type SketchKind = (typeof SKETCH_KINDS)[number];
export const SKETCH_COLOURS = ['ink', 'red', 'blue', 'green', 'yellow'] as const;
export type SketchColour = (typeof SKETCH_COLOURS)[number];

export interface Sketch {
  id: string;
  kind: SketchKind;
  /** A pen or highlighter stroke; an arrow's tail and head; where words start. In mm. */
  points: Point[];
  /** A named colour, so it suits every look in light and dark. */
  colour: SketchColour;
  widthMm: number;
  text?: string;
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
  'cold-frame',
  'tree',
  'hedge',
  'compost',
  'water',
  'surface',
  'pot',
  'planter',
  'other',
] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

/** What a surface or path is made of. */
export const MATERIALS = ['lawn', 'gravel', 'paving', 'decking', 'bark', 'meadow', 'soil'] as const;
export type Material = (typeof MATERIALS)[number];

export const EDGINGS = ['timber', 'brick', 'stone'] as const;

export interface Feature {
  id: string;
  kind: FeatureKind;
  name?: string;
  /**
   * The outline on the ground. For lines and circles it is derived from `line` or `circle`, and for a
   * curved area from `controls`: a dense polygon along the curve.
   */
  footprint: Point[];
  /** What a surface or path is made of. */
  material?: Material;
  /** Curved edges: an area's outline, or a line's centre line, runs as a smooth curve through its corners. */
  smooth?: boolean;
  /** The corners a curved area's outline passes through. Present only when `smooth` is set on an area. */
  controls?: Point[];
  /** A bed's rim: timber boards, brick or stone. */
  edging?: (typeof EDGINGS)[number];
  heightMm?: number; // used by the sun layer; absent for flat features
  /** Centre line of a fence, wall, hedge or path, with its width. */
  line?: Point[];
  widthMm?: number;
  /** Round features: a tree's canopy, a water butt. */
  circle?: { centre: Point; radiusMm: number };
  deciduous?: boolean;
  opacityInLeaf?: number; // 0 to 1, share of light blocked in leaf
  opacityBare?: number; // 0 to 1, share of light blocked when bare
  /** How much warmer it is under a greenhouse or cold frame. Absent: the usual for its kind. */
  climate?: Climate;
}

/** Under glass: degrees warmer than outside by day and at night, and whether it's heated (kept frost-free). */
export interface Climate {
  heated: boolean;
  dayGainC: number;
  nightGainC: number;
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
  /** How it was sown, which decides its life path. Absent: worked out from the plant's sowing methods. */
  sowing?: 'indoors' | 'direct';
  /** The furthest stage you've confirmed. Absent: "sown" if there's a sowing date, otherwise planned. */
  stage?: Stage;
  /** When each stage after sowing was reached. The sowing date itself stays in sownOn. */
  stageDates?: Partial<Record<Stage, string>>;
  removedOn?: string; // ISO date; kept for history
}

/** Where a plant is in its life, in order. Not every plant goes through every stage: see src/lifecycle/stages.ts. */
export const STAGES = ['sown', 'germinated', 'hardening', 'transplanted', 'vegetative', 'flowering', 'harvesting'] as const;
export type Stage = (typeof STAGES)[number];

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
  /**
   * How its life runs, where the defaults are wrong. flowering: it has a flowering stage worth marking (fruiting
   * crops, flowers); defaults to true for flowers and fruit. perennial: it comes back each year rather than being cleared.
   */
  lifePath?: { flowering?: boolean; perennial?: boolean };
  /** Advice for each stage, shown when a planting reaches it. Falls back to general advice. */
  stageTips?: Partial<Record<Stage, string[]>>;
  /** How it's drawn from above on the plan and on its card. Falls back to a drawing for its category. */
  art?: PlantArt;
  /** Days from sowing until seedlings usually show, fewest and most. Falls back to one to three weeks. */
  germinationDays?: [number, number];
  image?: { url: string; credit: string; licence: string; sourceUrl: string }; // PD, CC0, CC BY or CC BY-SA only
  source?: string;
  lastChecked?: string; // ISO date
  verified: boolean;
  userAdded: boolean;
}

/** The shape of a plant seen from above. */
export const PLANT_FORMS = ['rosette', 'clump', 'mound', 'upright', 'climber', 'sprawl', 'grass', 'bulb', 'shrub', 'tree'] as const;
export const LEAF_SHAPES = ['broad', 'lobed', 'feathery', 'strap', 'needle', 'round'] as const;
/** How its flowers look from above: small daisies, one big bloom, cups, spikes, or round heads of tiny flowers. */
export const BLOOMS = ['daisy', 'big', 'cup', 'spike', 'umbel'] as const;
/** What you harvest, as seen from above when it's ready. */
export const CROP_KINDS = ['fruit', 'head', 'pod', 'root', 'stem'] as const;

export interface PlantArt {
  form: (typeof PLANT_FORMS)[number];
  leaf: (typeof LEAF_SHAPES)[number];
  /** Leaf colour, #rrggbb. */
  foliage: string;
  /** Flower colour, #rrggbb, drawn when it's flowering. */
  flower?: string;
  bloom?: (typeof BLOOMS)[number];
  /** The crop, drawn when it's ready to harvest. */
  crop?: { kind: (typeof CROP_KINDS)[number]; colour: string };
}

/** Everything the app holds and saves. */
export interface AppState {
  garden: Garden;
  userPlants: Plant[];
}
