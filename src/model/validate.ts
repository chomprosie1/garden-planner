// Checks data coming in from files or storage before it replaces anything.
// Each function returns a list of problems; an empty list means valid.

import {
  FEATURE_KINDS,
  LIGHT_LEVELS,
  PLANT_CATEGORIES,
  SOWING_METHODS,
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
    });

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
      need(p.status === undefined || p.status === 'growing', `${at}.status can only be "growing".`);
    });

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
