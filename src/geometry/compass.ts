// North from a phone's compass. Lay the phone flat with its top edge pointing
// the way the top of your plan does; its heading is how far clockwise from north
// that is, so north is the same amount anticlockwise from the top of the plan.
// In the UK a compass is within a couple of degrees of true north, close enough
// for sun and shade.

/** Degrees clockwise from the top of the plan to north, from the heading the top of the plan points (clockwise from north). */
export const northFromHeading = (heading: number): number => Math.round((((360 - heading) % 360) + 360) % 360) % 360;

/**
 * The heading a phone's top edge points, from a device orientation event, or null if it can't tell. iPhones give a
 * compass heading; others give alpha (anticlockwise from north) on the "absolute" event.
 */
export function headingOf(e: { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number }): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) return ((e.webkitCompassHeading % 360) + 360) % 360;
  if (e.absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) return (((360 - e.alpha) % 360) + 360) % 360;
  return null;
}

/** The average of headings, the right way round the circle: 350° and 10° average to 0°, not 180°. */
export function meanHeading(hs: number[]): number | null {
  if (!hs.length) return null;
  const k = Math.PI / 180;
  const x = hs.reduce((a, h) => a + Math.cos(h * k), 0);
  const y = hs.reduce((a, h) => a + Math.sin(h * k), 0);
  if (Math.hypot(x, y) < 1e-9) return null;
  return ((Math.atan2(y, x) / k) % 360 + 360) % 360;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** "east", "south-west". */
export const compassPoint = (heading: number) => POINTS[Math.round((((heading % 360) + 360) % 360) / 45) % 8]!;
