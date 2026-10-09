// Straightening a photo taken at an angle (from an upstairs window, say), so it
// can be traced: four corners of something rectangular in the photo, and its
// real width and depth, give the projective transform between the photo and the
// ground. Pure, for tests; src/ui/Straighten.tsx draws the picture with it.

import type { Point } from '../model/types';

/** A 3 × 3 projective transform, row by row, with the last entry 1. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Solves A x = b by Gaussian elimination with partial pivoting. Null if it has no single answer. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    if (Math.abs(m[p]![c]!) < 1e-12) return null;
    [m[c], m[p]] = [m[p]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = m[r]![c]! / m[c]![c]!;
      for (let j = c; j <= n; j++) m[r]![j]! -= k * m[c]![j]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** The transform taking each of four points to its partner. Null if three of them are in a line. */
export function homography(from: Point[], to: Point[]): Homography | null {
  if (from.length !== 4 || to.length !== 4) return null;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]!;
    const [u, v] = to[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return h ? ([...h, 1] as Homography) : null;
}

/** Where a point goes under a transform. */
export function project(h: Homography, [x, y]: Point): Point {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/** Twice the signed area of a quadrilateral: its sign says which way round the corners go. */
const turn = (q: Point[]) => q.reduce((s, p, i) => s + p[0] * q[(i + 1) % 4]![1] - q[(i + 1) % 4]![0] * p[1], 0);

/** Four corners that make a real quadrilateral: none too close, and no three in a line, without crossing over. */
export function goodCorners(q: Point[]): boolean {
  if (q.length !== 4) return false;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (Math.hypot(q[i]![0] - q[j]![0], q[i]![1] - q[j]![1]) < 10) return false;
  // Each corner turns the same way: a convex outline, not a bow tie.
  const cross = (i: number) => {
    const [a, b, c] = [q[i]!, q[(i + 1) % 4]!, q[(i + 2) % 4]!];
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  };
  const signs = [0, 1, 2, 3].map(cross);
  return Math.abs(turn(q)) > 100 && (signs.every((s) => s > 0) || signs.every((s) => s < 0));
}

/** What straightening makes: the ground it covers in mm (y up, as on the plan), and its size in pixels. */
export interface StraightPlan {
  /** From the straightened picture's pixels (y down) to the photo's pixels. */
  toPhoto: Homography;
  /** The ground the picture covers, mm, with the rectangle's first corner at (0, 0). */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Pixels across and down. */
  width: number;
  height: number;
}

/**
 * How to straighten a photo: `corners` are four corners of a rectangle in the photo's pixels, tapped in turn from the
 * one nearest the bottom left of the plan, going round; `w` and `d` its real width (first to second corner) and depth
 * (second to third), mm. The picture covers the rectangle and as much round it as the photo shows, out to the
 * rectangle's own size on each side, at about the photo's own sharpness and no more than `maxPx` across.
 */
export function straightenPlan(corners: Point[], w: number, d: number, photo: { width: number; height: number }, maxPx = 2400): StraightPlan | null {
  if (!goodCorners(corners) || w <= 0 || d <= 0) return null;
  // Ground (mm, y up) to photo: the rectangle's corners in order, bottom left, bottom right, top right, top left.
  const groundToPhoto = homography(
    [
      [0, 0],
      [w, 0],
      [w, d],
      [0, d],
    ],
    corners,
  );
  const photoToGround = homography(corners, [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ]);
  if (!groundToPhoto || !photoToGround) return null;
  // The photo's own corners on the ground, where they land in front of the camera; kept to a rectangle's size out.
  let [minX, minY, maxX, maxY] = [0, 0, w, d];
  const den = (p: Point) => photoToGround[6] * p[0] + photoToGround[7] * p[1] + photoToGround[8];
  // A tapped corner is on the ground in front of the camera; a photo corner on the other side is above the horizon.
  const front = Math.sign(den(corners[0]!));
  for (const p of [
    [0, 0],
    [photo.width, 0],
    [photo.width, photo.height],
    [0, photo.height],
  ] as Point[]) {
    if (Math.sign(den(p)) !== front) continue;
    const [x, y] = project(photoToGround, p);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  minX = Math.max(minX, -w);
  maxX = Math.min(maxX, 2 * w);
  minY = Math.max(minY, -d);
  maxY = Math.min(maxY, 2 * d);
  // About as many pixels across the rectangle as the photo has along its first side.
  const side = Math.hypot(corners[1]![0] - corners[0]![0], corners[1]![1] - corners[0]![1]);
  let scale = side / w;
  scale = Math.min(scale, maxPx / (maxX - minX), maxPx / (maxY - minY));
  const width = Math.max(1, Math.round((maxX - minX) * scale));
  const height = Math.max(1, Math.round((maxY - minY) * scale));
  // A picture pixel (i, j) is ground (minX + i / scale, maxY - j / scale).
  const pixelToGround: Homography = [1 / scale, 0, minX, 0, -1 / scale, maxY, 0, 0, 1];
  return { toPhoto: compose(groundToPhoto, pixelToGround), minX, minY, maxX, maxY, width, height };
}

/** a after b: apply b, then a. */
function compose(a: Homography, b: Homography): Homography {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
  const k = r[8]!;
  return r.map((x) => x / k) as Homography;
}
