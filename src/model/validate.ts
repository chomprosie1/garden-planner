// Checks data coming in from files or storage before it replaces anything.
// Each function returns a list of problems; an empty list means valid.

import {
  FEATURE_KINDS,
  BLOOMS,
  CONTAINERS,
  CROP_KINDS,
  EDGINGS,
  LEAF_SHAPES,
  LIGHT_LEVELS,
  MATERIALS,
  PLANT_CATEGORIES,
  PLANT_FORMS,
  SHED_PLACE_KINDS,
  SKETCH_COLOURS,
  SKETCH_KINDS,
  SOWING_METHODS,
  STAGES,
  WINTERING_TYPES,
  type Garden,
  type Plant,
} from './types';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isPoint = (v: unknown): boolean => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const isMonths = (v: unknown): boolean =>
  Array.isArray(v) && v.every((m) => Number.isInteger(m) && m >= 1 && m <= 12);
const oneOf = (list: readonly string[], v: unknown): boolean => isStr(v) && list.includes(v);

export function validateGarden(g: unknown): string[] {
  if (!isObject(g)) return ['The garden is missing or not an object.'];
  const errors: string[] = [];
  const need = (ok: boolean, msg: string) => {
    if (!ok) errors.push(msg);
  };

  need(isNum(g.schemaVersion), 'schemaVersion must be a number.');
  need(isStr(g.name), 'name must be text.');
  need(isNum(g.latitude) && g.latitude >= -90 && g.latitude <= 90, 'latitude must be between -90 and 90.');
  need(isNum(g.longitude) && g.longitude >= -180 && g.longitude <= 180, 'longitude must be between -180 and 180.');
  need(isNum(g.northRotationDeg), 'northRotationDeg must be a number.');
  need(g.placeName === undefined || (isStr(g.placeName) && g.placeName.length <= 120), 'placeName must be text.');
  need(Array.isArray(g.boundary) && g.boundary.every(isPoint), 'boundary must be a list of [x, y] points.');
  need(Array.isArray(g.wishlist) && g.wishlist.every(isStr), 'wishlist must be a list of plant ids.');
  need(
    Array.isArray(g.jobsDone) && g.jobsDone.every((j) => isObject(j) && isStr(j.key) && isStr(j.date)),
    'jobsDone entries need a key and a date.',
  );

  if (!Array.isArray(g.features)) errors.push('features must be a list.');
  else
    g.features.forEach((f, i) => {
      const at = `features[${i}]`;
      if (!isObject(f)) return errors.push(`${at} is not an object.`);
      need(isStr(f.id), `${at} needs an id.`);
      need(oneOf(FEATURE_KINDS, f.kind), `${at} has an unknown kind.`);
      need(Array.isArray(f.footprint) && f.footprint.every(isPoint), `${at}.footprint must be a list of points.`);
      need(f.heightMm === undefined || (isNum(f.heightMm) && f.heightMm >= 0), `${at}.heightMm must be 0 or more.`);
      for (const key of ['opacityInLeaf', 'opacityBare'] as const) {
        const o = f[key];
        need(o === undefined || (isNum(o) && o >= 0 && o <= 1), `${at}.${key} must be between 0 and 1.`);
      }
      need(f.line === undefined || (Array.isArray(f.line) && f.line.length >= 2 && f.line.every(isPoint)), `${at}.line needs two or more points.`);
      need(f.widthMm === undefined || (isNum(f.widthMm) && f.widthMm > 0), `${at}.widthMm must be above 0.`);
      need(
        f.circle === undefined || (isObject(f.circle) && isPoint(f.circle.centre) && isNum(f.circle.radiusMm) && f.circle.radiusMm > 0),
        `${at}.circle needs a centre and a radius above 0.`,
      );
      need(f.material === undefined || oneOf(MATERIALS, f.material), `${at}.material is not a known material.`);
      need(f.edging === undefined || oneOf(EDGINGS, f.edging), `${at}.edging must be timber, brick or stone.`);
      need(f.smooth === undefined || typeof f.smooth === 'boolean', `${at}.smooth must be true or false.`);
      need(f.controls === undefined || (Array.isArray(f.controls) && f.controls.length >= 3 && f.controls.every(isPoint)), `${at}.controls needs three or more points.`);
      need(
        f.climate === undefined ||
          (isObject(f.climate) && typeof f.climate.heated === 'boolean' && isNum(f.climate.dayGainC) && isNum(f.climate.nightGainC) && f.climate.dayGainC >= 0 && f.climate.nightGainC >= 0 && f.climate.dayGainC <= 30 && f.climate.nightGainC <= 30),
        `${at}.climate needs heated, and day and night gains from 0 to 30 °C.`,
      );
    });

  need(g.spacing === undefined || g.spacing === 'close' || g.spacing === 'rows', 'spacing must be close or rows.');

  if (g.trace !== undefined) {
    const t = g.trace;
    need(
      isObject(t) && isNum(t.x) && isNum(t.y) && isNum(t.widthMm) && t.widthMm > 0 && isNum(t.opacity) && typeof t.calibrated === 'boolean',
      'trace needs a position, a width above 0, an opacity and a calibrated flag.',
    );
  }

  if (!Array.isArray(g.plantings)) errors.push('plantings must be a list.');
  else
    g.plantings.forEach((p, i) => {
      const at = `plantings[${i}]`;
      if (!isObject(p)) return errors.push(`${at} is not an object.`);
      need(isStr(p.id) && isStr(p.plantId) && isStr(p.featureId), `${at} needs id, plantId and featureId.`);
      need(isNum(p.x) && isNum(p.y), `${at} needs x and y.`);
      need(p.layout === undefined || oneOf(['single', 'row', 'block'], p.layout), `${at}.layout must be single, row or block.`);
      need(p.endPoint === undefined || isPoint(p.endPoint), `${at}.endPoint must be an [x, y] point.`);
      need(p.count === undefined || (Number.isInteger(p.count) && (p.count as number) >= 1), `${at}.count must be a whole number, 1 or more.`);
      need(p.sownOn === undefined || isStr(p.sownOn), `${at}.sownOn must be a date.`);
      need(p.removedOn === undefined || isStr(p.removedOn), `${at}.removedOn must be a date.`);
      need(p.sowing === undefined || p.sowing === 'indoors' || p.sowing === 'direct', `${at}.sowing must be indoors or direct.`);
      need(p.stage === undefined || oneOf(STAGES, p.stage), `${at}.stage is not a stage.`);
      need(
        p.stageDates === undefined || (isObject(p.stageDates) && Object.entries(p.stageDates).every(([k, v]) => oneOf(STAGES, k) && isStr(v))),
        `${at}.stageDates must give a date for each stage.`,
      );
      need(p.sowBy === undefined || (isStr(p.sowBy) && /^\d{4}-\d{2}-\d{2}$/.test(p.sowBy)), `${at}.sowBy must be a date.`);
      need(
        p.batch === undefined ||
          (isObject(p.batch) && isStr(p.batch.group) && Number.isInteger(p.batch.n) && Number.isInteger(p.batch.of) && (p.batch.n as number) >= 1 && (p.batch.n as number) <= (p.batch.of as number)),
        `${at}.batch needs a group and which batch it is, of how many.`,
      );
    });

  if (g.sketches !== undefined) {
    if (!Array.isArray(g.sketches)) errors.push('sketches must be a list.');
    else
      g.sketches.forEach((k, i) => {
        const at = `sketches[${i}]`;
        if (!isObject(k)) return errors.push(`${at} is not an object.`);
        need(isStr(k.id) && oneOf(SKETCH_KINDS, k.kind) && oneOf(SKETCH_COLOURS, k.colour), `${at} needs an id, a kind and a colour.`);
        need(Array.isArray(k.points) && k.points.length >= 1 && k.points.every(isPoint), `${at}.points must be a list of points.`);
        need(isNum(k.widthMm) && k.widthMm > 0, `${at}.widthMm must be above 0.`);
        need(k.text === undefined || isStr(k.text), `${at}.text must be text.`);
      });
  }

  const monthDay = (v: unknown) => v === undefined || (isStr(v) && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v));
  need(monthDay(g.lastFrost) && monthDay(g.firstFrost), 'frost dates must be MM-DD.');
  const placeIds = new Set<string>();
  if (g.shedPlaces !== undefined) {
    if (!Array.isArray(g.shedPlaces)) errors.push('shedPlaces must be a list.');
    else
      g.shedPlaces.forEach((pl, i) => {
        const ok = isObject(pl) && isStr(pl.id) && oneOf(SHED_PLACE_KINDS, pl.kind) && isStr(pl.name) && Number.isInteger(pl.shelves) && (pl.shelves as number) >= 1 && Number.isInteger(pl.slots) && (pl.slots as number) >= 1;
        need(ok, `shedPlaces[${i}] needs an id, a kind, a name, and shelves and slots of 1 or more.`);
        need(!isObject(pl) || pl.featureId === undefined || isStr(pl.featureId), `shedPlaces[${i}].featureId must be text.`);
        if (ok) placeIds.add(pl.id as string);
      });
  }
  if (g.trays !== undefined) {
    if (!Array.isArray(g.trays)) errors.push('trays must be a list.');
    else
      g.trays.forEach((t, i) => {
        const at = `trays[${i}]`;
        if (!isObject(t)) return errors.push(`${at} is not an object.`);
        need(isStr(t.id) && isStr(t.plantId) && oneOf(CONTAINERS, t.container) && Number.isInteger(t.count) && (t.count as number) >= 1 && isStr(t.sownOn), `${at} needs an id, a plant, a container, a count and a sowing date.`);
        need(t.stage === undefined || t.stage === 'germinated' || t.stage === 'hardening', `${at}.stage must be germinated or hardening.`);
        need(t.stageDates === undefined || (isObject(t.stageDates) && Object.entries(t.stageDates).every(([k, v]) => (k === 'germinated' || k === 'hardening') && isStr(v))), `${at}.stageDates must give a date for each stage.`);
        need(isStr(t.placeId) && placeIds.has(t.placeId) && Number.isInteger(t.shelf) && Number.isInteger(t.slot) && (t.shelf as number) >= 0 && (t.slot as number) >= 0, `${at} must be on a shelf of a place in the shed.`);
      });
  }

  if (!Array.isArray(g.notes)) errors.push('notes must be a list.');
  else
    g.notes.forEach((n, i) => {
      if (!isObject(n) || !isStr(n.id) || !isStr(n.date) || !isStr(n.text))
        errors.push(`notes[${i}] needs an id, a date and text.`);
      else if ((n.featureId !== undefined && !isStr(n.featureId)) || (n.plantingId !== undefined && !isStr(n.plantingId)))
        errors.push(`notes[${i}] can only be attached by id.`);
    });

  return errors;
}

export function validatePlant(p: unknown): string[] {
  if (!isObject(p)) return ['The plant is not an object.'];
  const name = isStr(p.commonName) ? p.commonName : isStr(p.id) ? p.id : 'plant';
  const errors: string[] = [];
  const need = (ok: boolean, msg: string) => {
    if (!ok) errors.push(`${name}: ${msg}`);
  };

  need(isStr(p.id) && p.id.length > 0, 'needs an id.');
  need(isStr(p.commonName) && p.commonName.trim().length > 0, 'needs a common name.');
  need(oneOf(PLANT_CATEGORIES, p.category), 'has an unknown category.');
  need(isObject(p.conditions) && oneOf(LIGHT_LEVELS, p.conditions.light), 'needs a light level.');
  need(isObject(p.size) && isNum(p.size.spacingMm) && p.size.spacingMm > 0, 'needs a spacing above 0 mm.');
  if (isObject(p.size) && p.size.closeSpacingMm !== undefined) need(isNum(p.size.closeSpacingMm) && p.size.closeSpacingMm > 0, 'close spacing must be above 0 mm.');
  need(typeof p.verified === 'boolean', 'needs verified true or false.');
  need(typeof p.userAdded === 'boolean', 'needs userAdded true or false.');

  if (p.sowing !== undefined)
    need(
      Array.isArray(p.sowing) &&
        p.sowing.every((s) => isObject(s) && oneOf(SOWING_METHODS, s.method) && isMonths(s.months)),
      'sowing entries need a method and months 1 to 12.',
    );
  if (p.plantOutMonths !== undefined) need(isMonths(p.plantOutMonths), 'plantOutMonths must be months 1 to 12.');
  if (p.flowerMonths !== undefined) need(isMonths(p.flowerMonths), 'flowerMonths must be months 1 to 12.');
  if (p.cropping !== undefined)
    need(isObject(p.cropping) && isMonths(p.cropping.harvestMonths), 'harvestMonths must be months 1 to 12.');
  if (p.companions !== undefined)
    need(
      isObject(p.companions) &&
        Array.isArray(p.companions.good) &&
        Array.isArray(p.companions.avoid) &&
        [...p.companions.good, ...p.companions.avoid].every(isStr),
      'companions need good and avoid lists of plant ids.',
    );
  if (p.wintering !== undefined)
    need(isObject(p.wintering) && oneOf(WINTERING_TYPES, p.wintering.type), 'has an unknown wintering type.');
  if (p.lifePath !== undefined)
    need(
      isObject(p.lifePath) && Object.entries(p.lifePath).every(([k, v]) => (k === 'flowering' || k === 'perennial') && typeof v === 'boolean'),
      'lifePath can only hold flowering and perennial, true or false.',
    );
  if (p.stageTips !== undefined)
    need(
      isObject(p.stageTips) && Object.entries(p.stageTips).every(([k, v]) => oneOf(STAGES, k) && Array.isArray(v) && v.every(isStr)),
      'stageTips must be lists of advice for each stage.',
    );
  if (p.art !== undefined) {
    const a = p.art;
    const colour = (c: unknown) => isStr(c) && /^#[0-9a-f]{6}$/i.test(c);
    need(
      isObject(a) &&
        oneOf(PLANT_FORMS, a.form) &&
        oneOf(LEAF_SHAPES, a.leaf) &&
        colour(a.foliage) &&
        (a.flower === undefined || colour(a.flower)) &&
        (a.bloom === undefined || oneOf(BLOOMS, a.bloom)) &&
        (a.crop === undefined || (isObject(a.crop) && oneOf(CROP_KINDS, a.crop.kind) && colour(a.crop.colour))),
      'art needs a form, a leaf shape and #rrggbb colours.',
    );
  }
  if (p.germinationDays !== undefined)
    need(
      Array.isArray(p.germinationDays) && p.germinationDays.length === 2 && p.germinationDays.every((d) => Number.isInteger(d) && d >= 1) && (p.germinationDays[0] as number) <= (p.germinationDays[1] as number),
      'germinationDays must be [fewest, most] days.',
    );
  if (p.growth !== undefined) {
    const gr = p.growth;
    need(
      isObject(gr) &&
        Object.keys(gr).every((k) => k === 'days' || k === 'from' || k === 'baseC') &&
        (gr.days === undefined ||
          (Array.isArray(gr.days) && gr.days.length === 2 && gr.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 400) && (gr.days[0] as number) <= (gr.days[1] as number))) &&
        (gr.from === undefined || gr.from === 'sowing' || gr.from === 'planting') &&
        (gr.baseC === undefined || (isNum(gr.baseC) && gr.baseC >= 0 && gr.baseC <= 20)),
      'growth can hold days ([fewest, most], up to 400), from ("sowing" or "planting") and baseC (0 to 20 °C).',
    );
  }
  if (p.image !== undefined)
    need(
      isObject(p.image) && isStr(p.image.url) && isStr(p.image.credit) && isStr(p.image.licence) && isStr(p.image.sourceUrl),
      'image needs url, credit, licence and sourceUrl.',
    );

  return errors;
}

// Type guards for callers that have just validated.
export const isValidGarden = (g: unknown): g is Garden => validateGarden(g).length === 0;
export const isValidPlant = (p: unknown): p is Plant => validatePlant(p).length === 0;
