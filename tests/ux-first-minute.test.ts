// UX release 2, the first minute: starter kits, finding your garden by a
// postcode or a place, and north from the phone's compass.

import { describe, expect, it } from 'vitest';
import flowers from '../data/plants/flower.json';
import fruit from '../data/plants/fruit.json';
import herbs from '../data/plants/herb.json';
import vegetables from '../data/plants/vegetable.json';
import { compassPoint, headingOf, meanHeading, northFromHeading } from '../src/geometry/compass';
import { pointInPolygon } from '../src/geometry/polygon';
import { newGarden } from '../src/model/defaults';
import { migrateGarden, SCHEMA_VERSION } from '../src/model/migrate';
import { makeSpace, SPACES, spaceInfo } from '../src/model/spaces';
import type { Garden, Plant } from '../src/model/types';
import { validateGarden } from '../src/model/validate';
import { batchesOf } from '../src/planting/batches';
import { applyKit, kitPlants, KITS, kitsFor } from '../src/planting/kits';
import { asGrown, isContainer, plantPositions } from '../src/planting/place';
import { placeText } from '../src/ui/GardenSettings';
import { FAVOURITES } from '../src/ui/Onboarding';
import { parseGeocoding, parseOutcode, parsePostcode, placeLabel, placeUrl, searchPlaces } from '../src/weather/places';

const library = [...vegetables, ...herbs, ...fruit, ...flowers] as Plant[];
const byId = new Map(library.map((p) => [p.id, asGrown(p, 'close')]));
const known = (id: string) => byId.get(id) ?? null;

describe('starter kits', () => {
  it('has kits for every space, using plants in the library', () => {
    for (const s of SPACES) expect(kitsFor(s.id).length).toBeGreaterThan(0);
    for (const k of KITS) for (const id of kitPlants(k)) expect(byId.has(id), `${k.id}: ${id}`).toBe(true);
    expect(new Set(KITS.map((k) => k.id)).size).toBe(KITS.length);
  });

  for (const kit of KITS) {
    it(`plants ${kit.id} inside the beds and pots of its space, and lists its plants to grow`, () => {
      const [w, d] = spaceInfo(kit.space).size;
      const g = applyKit(makeSpace(newGarden(), kit.space, w, d), kit, known, '2027-02-10');
      expect(validateGarden(JSON.parse(JSON.stringify(g)))).toEqual([]);
      expect(g.plantings.length).toBeGreaterThan(0);
      const beds = new Map(g.features.filter(isContainer).map((f) => [f.id, f]));
      for (const pl of g.plantings) {
        const bed = beds.get(pl.featureId)!;
        expect(bed).toBeTruthy();
        for (const p of plantPositions(pl, byId.get(pl.plantId)!)) {
          if (bed.circle) expect(Math.hypot(p[0] - bed.circle.centre[0], p[1] - bed.circle.centre[1])).toBeLessThanOrEqual(bed.circle.radiusMm);
          else expect(pointInPolygon(p, bed.footprint), `${pl.plantId} at ${p} in ${kit.id}`).toBe(true);
        }
      }
      for (const id of kitPlants(kit)) expect(g.wishlist).toContain(id);
    });
  }

  it('sows salads in batches from their next sowing time', () => {
    const kit = KITS.find((k) => k.id === 'salad-bed')!;
    const g = applyKit(makeSpace(newGarden(), 'bed', 2400, 1200), kit, known, '2027-02-10');
    const lettuce = g.plantings.filter((p) => p.plantId === 'lettuce');
    expect(lettuce).toHaveLength(3);
    expect(batchesOf(g, lettuce[0]!).map((p) => p.sowBy)).toEqual(['2027-02-11', '2027-03-04', '2027-03-25']);
  });

  it('leaves out plants it doesn’t know', () => {
    const kit = KITS.find((k) => k.id === 'veg-and-flowers')!;
    const g = applyKit(makeSpace(newGarden(), 'garden', 10000, 14000), kit, (id) => (id === 'cosmos' ? null : known(id)), '2027-02-10');
    expect(g.plantings.some((p) => p.plantId === 'cosmos')).toBe(false);
    expect(g.wishlist).not.toContain('cosmos');
    expect(g.plantings.some((p) => p.plantId === 'lavender')).toBe(true);
  });

  it('offers favourites that are all in the library', () => {
    for (const id of FAVOURITES) expect(byId.has(id), id).toBe(true);
  });
});

describe('finding your garden', () => {
  it('sends postcodes to postcodes.io and places to Open-Meteo', () => {
    expect(placeUrl('ls6 3ab')).toEqual({ url: 'https://api.postcodes.io/postcodes/LS6%203AB', kind: 'postcode' });
    expect(placeUrl(' LS6 ')).toEqual({ url: 'https://api.postcodes.io/outcodes/LS6', kind: 'outcode' });
    expect(placeUrl('SW1A1AA').kind).toBe('postcode');
    expect(placeUrl('Headingley').kind).toBe('name');
    expect(placeUrl('Headingley').url).toContain('geocoding-api.open-meteo.com/v1/search?name=Headingley');
  });

  it('reads each service’s reply', () => {
    expect(parsePostcode({ result: { postcode: 'LS1 4AP', latitude: 53.79, longitude: -1.55, admin_district: 'Leeds', country: 'England' } })).toEqual([
      { name: 'LS1 4AP', detail: 'Leeds, England', lat: 53.79, lon: -1.55 },
    ]);
    expect(parseOutcode({ result: { outcode: 'LS6', latitude: 53.82, longitude: -1.57, admin_district: ['Leeds'], country: ['England'] } })[0]).toMatchObject({ name: 'LS6', detail: 'Leeds, England' });
    const found = parseGeocoding({ results: [{ name: 'Headingley', latitude: 53.82, longitude: -1.58, admin2: 'Leeds', admin1: 'England', country: 'United Kingdom' }, { name: 'Nowhere' }] });
    expect(found).toEqual([{ name: 'Headingley', detail: 'Leeds, England, United Kingdom', lat: 53.82, lon: -1.58 }]);
    expect(placeLabel(found[0]!)).toBe('Headingley, Leeds');
    expect(parseGeocoding({})).toEqual([]);
    expect(parsePostcode({ status: 404 })).toEqual([]);
  });

  it('treats an unknown postcode as no match, and a failed search as a failure', async () => {
    const notFound: typeof fetch = () => Promise.resolve(new Response('{"status":404}', { status: 404 }));
    expect(await searchPlaces('ZZ1 1ZZ', notFound)).toEqual([]);
    const down: typeof fetch = () => Promise.resolve(new Response('', { status: 500 }));
    await expect(searchPlaces('Leeds', down)).rejects.toThrow();
    expect(await searchPlaces('L', down)).toEqual([]);
  });

  it('says where the garden is by the place you chose, and keeps it in the file (schema 10)', () => {
    const g: Garden = { ...newGarden(), latitude: 53.82, longitude: -1.58, placeName: 'Headingley, Leeds' };
    expect(placeText(g)).toBe('Headingley, Leeds.');
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(10);
    expect(validateGarden(g)).toEqual([]);
    expect(validateGarden({ ...g, placeName: 42 as unknown as string })).toHaveLength(1);
    expect((migrateGarden({ ...newGarden(), schemaVersion: 9 }) as Garden).schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('north from the compass', () => {
  it('turns where the top of the plan points into how far round north is', () => {
    expect(northFromHeading(0)).toBe(0);
    // The top faces east, so north is a quarter-turn anticlockwise: 270° clockwise.
    expect(northFromHeading(90)).toBe(270);
    expect(northFromHeading(180)).toBe(180);
    expect(northFromHeading(359.6)).toBe(0);
  });

  it('reads an iPhone’s compass or another phone’s absolute alpha, and nothing else', () => {
    expect(headingOf({ alpha: 10, webkitCompassHeading: 95 })).toBe(95);
    expect(headingOf({ alpha: 90, absolute: true })).toBe(270);
    expect(headingOf({ alpha: 90, absolute: false })).toBeNull();
    expect(headingOf({ alpha: null })).toBeNull();
  });

  it('averages readings round the circle, and names the direction', () => {
    expect(meanHeading([350, 10])!).toBeCloseTo(0, 5);
    expect(meanHeading([80, 100])!).toBeCloseTo(90, 5);
    expect(meanHeading([])).toBeNull();
    expect(compassPoint(92)).toBe('east');
    expect(compassPoint(225)).toBe('south-west');
  });
});
