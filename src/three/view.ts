// The garden in 3D, drawn with three.js. Loaded only when the 3D view opens
// (a dynamic import), so the plan never pays for it.
//
// It turns a scene from src/three/scene.ts into meshes: ground and surfaces
// with the plan's own textures, beds and pots with their edging and soil,
// walls, fences, hedges and buildings at their heights with pitched roofs,
// trees in their shapes with canopies of leaf clusters, and each plant as
// crossed pictures drawn from the side (one instanced mesh for every plant
// drawn the same way). The lawn follows the season, frost lies on a frosty
// morning, and sketches lie on the ground. The sun is a light with real
// shadows. Read-only: drag to turn, two fingers (or a right-drag) to move,
// pinch or scroll to zoom, double-tap to go somewhere, and tap for a name. Or
// walk through it at eye height, never through a wall or a bed (walk.ts).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawPlant, hashString, mixHex, seeded, shadeHex, type Paint } from '../art/plants';
import { drawPlantSide } from '../art/side';
import { drawEdgingTile, drawHedgeTile, drawMaterialTile, EDGING_TILE_MM, MATERIAL_TILE_MM, materialColour } from '../canvas/materials';
import { SKETCH_INK } from '../canvas/render';
import type { TreeLeaf } from '../model/trees';
import type { Material, Point } from '../model/types';
import { LOOKS, type LookId, type Mode, type PlanPalette } from '../theme/looks';
import { TRUNK_SHARE, type PlantGroup, type Scene3, type Solid, type Tree3 } from './scene';
import { BODY_MM, EYE_MM, obstaclesOf, PACE_MM, step, walkStart, walkTowards, type Obstacle, type WalkSpot } from './walk';

export type Preset = 'above' | 'standing';

export interface ViewStyle {
  look: LookId;
  mode: Mode;
}

/** Whether this browser can draw in 3D at all. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const M = 1 / 1000;
/** Garden mm (x along the plan, y up it, z up from the ground) to three.js metres (y up, z towards you). */
const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x * M, z * M, -y * M);

/** A flat shape on the ground from a garden outline, in metres; UVs are metres, for tiles tied to real sizes. */
function shapeOf(poly: Point[]): THREE.Shape {
  return new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * M, y * M)));
}

function flatGeometry(poly: Point[], lift: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapeOf(poly));
  g.rotateX(-Math.PI / 2);
  g.translate(0, lift, 0);
  return g;
}

/** An outline stood up to a height: its top and its sides. */
function prismGeometry(poly: Point[], heightMm: number, from = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shapeOf(poly), { depth: Math.max(1, heightMm - from) * M, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, from * M, 0);
  return g;
}

/** Two sloping roof panels and the gables under them, from a scene's roof. */
function roofGeometry(s: Solid): THREE.BufferGeometry {
  const r = s.roof!;
  const [a, b] = r.ridge;
  const span = r.halfSpan * 1.06;
  const off = (p: Point, k: number): Point => [p[0] + r.across[0] * span * k, p[1] + r.across[1] * span * k];
  const e = r.eavesMm;
  const h = s.heightMm;
  const A1 = v3(...off(a, 1), e);
  const B1 = v3(...off(b, 1), e);
  const A2 = v3(...off(a, -1), e);
  const B2 = v3(...off(b, -1), e);
  const RA = v3(a[0], a[1], h);
  const RB = v3(b[0], b[1], h);
  const tris = [A1, B1, RB, A1, RB, RA, B2, A2, RA, B2, RA, RB, A2, A1, RA, B1, B2, RB];
  const g = new THREE.BufferGeometry().setFromPoints(tris);
  g.computeVertexNormals();
  return g;
}

/** Tile textures, drawn once per look. */
function tileTexture(draw: (c: CanvasRenderingContext2D) => void, metresPerTile: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metresPerTile, 1 / metresPerTile);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * A tile with the season over it: a greener or paler lawn (tone above or below 0, as on the plan), and frost (0 to 1)
 * as a white rime with a sparkle of crystals.
 */
function seasonTile(draw: (c: CanvasRenderingContext2D) => void, tone: number, frost: number): (c: CanvasRenderingContext2D) => void {
  return (c) => {
    draw(c);
    if (tone) {
      c.fillStyle = tone > 0 ? `rgba(70, 150, 50, ${Math.min(0.3, tone * 0.22)})` : `rgba(196, 176, 112, ${Math.min(0.35, -tone * 0.3)})`;
      c.fillRect(0, 0, 64, 64);
    }
    if (frost > 0) {
      c.fillStyle = `rgba(236, 242, 246, ${0.6 * frost})`;
      c.fillRect(0, 0, 64, 64);
      const rnd = seeded(7);
      c.fillStyle = `rgba(255, 255, 255, ${0.9 * frost})`;
      for (let i = 0; i < 70; i++) c.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 1);
    }
  };
}

/** A flat ribbon along a line on the ground, `width` mm wide, for a pen mark or an arrow. */
function ribbonGeometry(pts: Point[], width: number, lift: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const half = width / 2;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / len) * half;
    const ny = ((b[0] - a[0]) / len) * half;
    for (const k of [1, -1]) {
      const v = v3(p[0] + nx * k, p[1] + ny * k);
      pos.push(v.x, lift, v.z);
    }
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const SIDE_PX = 128;

/** A plant's side and top pictures, as textures; at twice the size (finer leaves) when you're walking among them. */
function plantTextures(grp: PlantGroup, detail: boolean): { side: THREE.CanvasTexture; top: THREE.CanvasTexture } {
  const px = SIDE_PX * (detail ? 2 : 1);
  const ratio = Math.max(0.25, Math.min(4, grp.heightMm / Math.max(1, grp.spreadMm)));
  const side = document.createElement('canvas');
  side.width = px;
  side.height = Math.round(Math.max(32, Math.min(512 * (detail ? 2 : 1), px * ratio)));
  const sc = side.getContext('2d')!;
  sc.translate(px / 2, side.height);
  drawPlantSide(sc, { art: grp.art, look: grp.look, w: px * 0.94, h: side.height * 0.97, seed: hashString(grp.plantId) });
  const top = document.createElement('canvas');
  top.width = top.height = px;
  const tc = top.getContext('2d')!;
  tc.translate(px / 2, px / 2);
  const paint: Paint = { style: 'wash', mode: 'light', ink: '#3a3a30', paper: '#f6f1e7', soil: '#7a5a3c' };
  drawPlant(tc, { art: grp.art, look: { ...grp.look, ghost: false }, r: px * 0.44, paint, seed: hashString(grp.plantId) });
  const out = { side: new THREE.CanvasTexture(side), top: new THREE.CanvasTexture(top) };
  out.side.colorSpace = out.top.colorSpace = THREE.SRGBColorSpace;
  return out;
}

/**
 * Three crossed cards for a plant, base at the origin, 1 wide and 1 tall. Each is drawn front and back as its own
 * face, with normals facing up, so leaves are lit softly from the sky on both sides (a two-sided material would light
 * the backs as if they faced the ground).
 */
function cardsGeometry(): THREE.BufferGeometry {
  const card = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const faces: THREE.BufferGeometry[] = [];
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    faces.push(card.clone().rotateY(a), card.clone().rotateY(a + Math.PI));
  }
  const g = mergeGeometries(faces)!;
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function topGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.35, 0);
}

/** Low, wide plants that look right with their picture from above as well: a lettuce, a courgette. */
const HAS_TOP = new Set(['rosette', 'sprawl']);

/** A softly lumpy ball, for a tree's canopy: a few broad bumps, the same for the same tree. */
function canopyGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 32, 20);
  const p = g.getAttribute('position');
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const lumps = Array.from({ length: 16 }, () => {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    return { v, k: 0.08 + rnd() * 0.1 };
  });
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let k = 1;
    for (const l of lumps) k += l.k * Math.max(0, v.dot(l.v)) ** 8;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A cluster of leaves of one shape, drawn by code on a clear background, for the cards a canopy is built from: broad
 * (a birch, an apple), lobed (a maple, an oak), feathery (a rowan, an elder), needles (a pine, a yew) or straps (an
 * olive, a willow). Blossom, in season, as small flowers among them.
 */
function leafCluster(leaf: TreeLeaf, foliage: string, blossom: string | undefined, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const rnd = seeded(seed);
  ctx.translate(64, 64);
  const count = leaf === 'needle' ? 34 : leaf === 'feathery' ? 14 : leaf === 'strap' ? 26 : 30;
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * 40;
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(rnd() * Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle = shadeHex(foliage, (rnd() - 0.55) * 0.45);
    ctx.lineCap = 'round';
    switch (leaf) {
      case 'broad':
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(9, -10, 0, -24);
        ctx.quadraticCurveTo(-9, -10, 0, 0);
        ctx.fill();
        break;
      case 'lobed':
        // Five pointed lobes from one point, like a maple's.
        for (let k = -2; k <= 2; k++) {
          ctx.save();
          ctx.rotate(k * 0.55);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(6, -9, 0, -(k === 0 ? 22 : 16));
          ctx.quadraticCurveTo(-6, -9, 0, 0);
          ctx.fill();
          ctx.restore();
        }
        break;
      case 'feathery': {
        // A stalk with pairs of small leaflets along it.
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -34);
        ctx.stroke();
        for (let k = 1; k <= 6; k++)
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(side * 5, -k * 5.2, 5, 2.2, side * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        break;
      }
      case 'needle':
        // A tuft of fine needles.
        ctx.lineWidth = 1.4;
        for (let k = -4; k <= 4; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.sin(k * 0.22) * 18, -Math.cos(k * 0.22) * 18);
          ctx.stroke();
        }
        break;
      case 'strap':
        ctx.beginPath();
        ctx.ellipse(0, -14, 3, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }
  if (blossom) {
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * 46;
      ctx.fillStyle = shadeHex(blossom, (rnd() - 0.5) * 0.2);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** How many leaf cards make a canopy: enough to read as leaves, more on a big tree, never so many it's slow. */
export const leafCards = (rx: number, ry: number) => Math.round(Math.max(40, Math.min(420, rx * ry * 34)));

interface Pickable {
  name?: string;
  /** For instanced plants: the planting each instance belongs to. */
  plantingIds?: string[];
  /** Open ground: a tap while walking walks you there. */
  ground?: boolean;
}

export class GardenView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private sun = new THREE.DirectionalLight(0xffffff, 2.4);
  private sky = new THREE.HemisphereLight(0xdfeaf5, 0x5a5040, 1.3);
  private world = new THREE.Group();
  private textures = new Map<string, THREE.Texture>();
  private names: Record<string, string> = {};
  private contentKey = '';
  private lastGarden: unknown = null;
  private dirty = true;
  private frame = 0;
  private centre = new THREE.Vector3();
  private extent = 10;
  private bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  /** Gliding to a spot you double-tapped: where the camera and the point it turns round go, from where, and when. */
  private glide: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; start: number } | null = null;
  /** The scene shown, for walking round it and for redrawing it in finer detail. */
  private last: { s: Scene3; style: ViewStyle } | null = null;
  private obstacles: Obstacle[] = [];
  /** Plants drawn at twice the detail, once you've walked in among them. */
  private detail = false;
  /** Walking at eye height: where you are (garden mm), which way you face (radians, 0 along the plan, anticlockwise), and looking up or down. */
  private walking: { at: Point; heading: number; pitch: number; target: Point | null } | null = null;
  /** Keys or the thumb pad: forward, sideways (right) and turning (right), each -1 to 1. */
  private move = { forward: 0, strafe: 0, turn: 0 };
  private lastTime = performance.now();
  /** The frost shown (0 to 1, in tenths), and how to change what it lies on. */
  private frost = -1;
  private frostables: ((frost: number) => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opts: { phone: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // A near plane no closer than it needs to be keeps the depth buffer sharp for the flat layers on the ground.
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 2000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    // Move about as well as turn: two fingers (or a right-drag) slide along the ground, so the point you turn round
    // isn't stuck in the middle of the garden behind the shed.
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener('change', () => {
      this.keepInGarden();
      this.dirty = true;
    });
    this.sun.castShadow = true;
    const map = opts.phone ? 1024 : 2048;
    this.sun.shadow.mapSize.set(map, map);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sky, this.sun, this.sun.target, this.world);
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.stepGlide();
      this.stepWalk(dt);
      const turned = this.walking ? false : this.controls.update();
      if (turned || this.dirty) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // A wider view on a tall, narrow screen, so standing in the garden still shows its width.
    this.camera.fov = this.camera.aspect < 1 ? 55 : 40;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private texture(key: string, make: () => THREE.Texture): THREE.Texture {
    let t = this.textures.get(key);
    if (!t) this.textures.set(key, (t = make()));
    return t;
  }

  /** Shows a scene. Only the light moves if nothing else has changed. */
  show(s: Scene3, style: ViewStyle, gardenKey: unknown): void {
    const key = [
      style.look,
      style.mode,
      s.month,
      s.groups.map((g) => `${g.key}:${g.spots.length}`).join(','),
      s.trees.map((t) => `${t.bare ? 'b' : ''}${t.blossom ?? ''}${t.fruit ?? ''}${t.ghost ? 'g' : ''}${Math.round(t.heightMm)}`).join(','),
      s.solids.map((x) => (x.bare ? 'b' : '')).join(''),
      this.detail,
    ].join('|');
    const first = !this.contentKey;
    this.last = { s, style };
    this.obstacles = obstaclesOf(s);
    if (key !== this.contentKey || gardenKey !== this.lastGarden) {
      this.contentKey = key;
      this.lastGarden = gardenKey;
      this.build(s, style);
    }
    // Frost thins through the day: new textures on what it touches, nothing rebuilt.
    const frost = Math.round(s.frost * 10) / 10;
    if (frost !== this.frost) {
      this.frost = frost;
      for (const f of this.frostables) f(frost);
    }
    this.names = s.names;
    this.light(s);
    if (first) this.preset('above');
    this.dirty = true;
  }

  private clear(): void {
    this.world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mat of mats) mat.dispose();
    });
    this.world.clear();
  }

  private build(s: Scene3, style: ViewStyle): void {
    this.clear();
    const P: PlanPalette = LOOKS[style.look][style.mode].plan;
    const mode = style.mode;
    const tk = `${style.look}-${mode}`;
    this.scene.background = new THREE.Color(P.paper);
    this.sky.color.set(mode === 'dark' ? 0x8090a8 : 0xdfeaf5);

    // Where everything sits, for the camera and the shadows.
    const b = s.bounds;
    this.bounds = { minX: b.min[0] * M, maxX: b.max[0] * M, minZ: -b.max[1] * M, maxZ: -b.min[1] * M };
    this.centre.set((this.bounds.minX + this.bounds.maxX) / 2, 0, (this.bounds.minZ + this.bounds.maxZ) / 2);
    this.extent = Math.max(4, this.bounds.maxX - this.bounds.minX, this.bounds.maxZ - this.bounds.minZ);
    this.scene.fog = new THREE.Fog(P.paper, this.extent * 2.5, this.extent * 6);
    this.controls.maxDistance = this.extent * 3;
    this.controls.minDistance = 1.2;

    const add = (o: THREE.Object3D, pick?: Pickable) => {
      if (pick) o.userData.pick = pick;
      this.world.add(o);
      return o;
    };
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o });

    // The world beyond the garden, and the garden's own ground.
    const beyond = new THREE.Mesh(new THREE.CircleGeometry(this.extent * 6, 48).rotateX(-Math.PI / 2).translate(this.centre.x, -0.02, this.centre.z), std({ color: mixHex(P.paper, P.lawnAlt.startsWith('#') ? P.lawnAlt : '#9aa880', 0.35) }));
    beyond.receiveShadow = true;
    add(beyond);
    // Frost comes and goes with the time of day, so what it touches is changed in place (see setFrost), not rebuilt.
    this.frostables = [];
    const frosty = (mat: THREE.MeshStandardMaterial, colour: string | null, tile: ((frost: number) => THREE.Texture) | null) =>
      this.frostables.push((fr) => {
        if (colour) mat.color.set(fr ? mixHex(colour, '#eef3f6', 0.5 * fr) : colour);
        if (tile) mat.map = tile(fr);
      });
    const earth = mixHex(P.paper.startsWith('#') ? P.paper : '#f0ead8', '#8a7a5a', 0.3);
    const groundMat = std({ color: earth });
    frosty(groundMat, earth, null);
    const ground = new THREE.Mesh(flatGeometry(s.ground, 0), groundMat);
    ground.receiveShadow = true;
    add(ground, { ground: true });

    // Flat things, each a little above the one before. A few millimetres isn't enough for the depth buffer from far off or
    // low down (paving over a lawn let the lawn flicker through), so each layer is also drawn in order and pulled towards
    // the camera by its layer: the one on top always wins. The lawn takes its season, and frost goes on a tenth at a time,
    // so a few textures serve.
    const tone = Math.round(s.lawn * 10) / 10;
    const seasonal = (m: Material, t: number) => (fr: number) => this.texture(`${tk}:${m}:${t}:${fr}`, () => tileTexture(seasonTile((c) => drawMaterialTile(c, m, P, mode), t, fr), MATERIAL_TILE_MM[m] * M));
    s.flats.forEach((f, i) => {
      const lift = 0.002 + i * 0.0015;
      let mat: THREE.MeshStandardMaterial;
      if (f.material === 'water') mat = std({ color: P.water, roughness: 0.12, metalness: 0.15 });
      else if (f.material === 'path') frosty((mat = std({ color: P.path })), P.path, null);
      else {
        const tile = seasonal(f.material as Material, f.material === 'lawn' ? tone : 0);
        frosty((mat = std({ map: tile(0) })), null, tile);
      }
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -(i + 1);
      mat.polygonOffsetUnits = -(i + 1) * 4;
      const mesh = new THREE.Mesh(flatGeometry(f.polygon, lift), mat);
      mesh.renderOrder = i + 1;
      mesh.receiveShadow = true;
      add(mesh, { name: f.name, ground: f.material !== 'water' });
    });
    this.sketches(s, P, mode, 0.004 + s.flats.length * 0.0015, add);

    const soil = seasonal('soil', 0);
    // Under glass, no frost.
    const soilMat = (covered?: boolean) => {
      const mat = std({ map: soil(0) });
      if (!covered) frosty(mat, null, soil);
      return mat;
    };
    const glass = () => std({ color: P.glass.startsWith('#') ? P.glass : '#cfe6ee', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });

    for (const x of s.solids) this.solid(x, P, mode, tk, std, soilMat, glass, add);
    for (const t of s.trees) this.tree(t, std, add);
    for (const g of s.groups) this.plants(g);
    this.frost = -1;
  }

  private solid(
    x: Solid,
    P: PlanPalette,
    mode: Mode,
    tk: string,
    std: (o: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial,
    soilMat: (covered?: boolean) => THREE.Material,
    glass: () => THREE.Material,
    add: (o: THREE.Object3D, pick?: Pickable) => THREE.Object3D,
  ): void {
    const pick = { name: x.name };
    const solidMesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      add(m, pick);
      return m;
    };
    const timber = () => std({ map: this.texture(`${tk}:timber`, () => tileTexture((c) => drawEdgingTile(c, 'timber', P, mode), EDGING_TILE_MM.timber * M)) });
    if (x.support) return this.supportFrame(x, std({ color: mode === 'dark' ? '#8a6e4c' : '#7a5a3a' }), add, pick);
    switch (x.kind) {
      case 'bed': {
        const side = x.edging ? std({ map: this.texture(`${tk}:${x.edging}`, () => tileTexture((c) => drawEdgingTile(c, x.edging!, P, mode), EDGING_TILE_MM[x.edging!] * M)) }) : soilMat(x.covered);
        solidMesh(prismGeometry(x.polygon, x.heightMm), [soilMat(x.covered), side], !!x.edging);
        return;
      }
      case 'pot': {
        const c = x.circle!;
        const r = c.radiusMm * M;
        const h = x.heightMm * M;
        const pot = solidMesh(new THREE.CylinderGeometry(r, r * 0.8, h, 28, 1, true).translate(0, h / 2, 0), std({ color: mode === 'dark' ? '#8a4a2c' : '#b5653a', side: THREE.DoubleSide }));
        pot.position.copy(v3(c.centre[0], c.centre[1]));
        const top = solidMesh(new THREE.CircleGeometry(r * 0.94, 28).rotateX(-Math.PI / 2).translate(0, h - 0.03, 0), soilMat(x.covered), false);
        top.position.copy(pot.position);
        return;
      }
      case 'planter':
        solidMesh(prismGeometry(x.polygon, x.heightMm), [soilMat(x.covered), std({ color: mode === 'dark' ? '#4a443c' : '#5a5048' })]);
        return;
      case 'cold-frame':
        solidMesh(prismGeometry(x.polygon, Math.min(250, x.heightMm)), [soilMat(x.covered), timber()]);
        solidMesh(prismGeometry(x.polygon, x.heightMm, Math.min(250, x.heightMm)), glass(), false);
        return;
      case 'greenhouse':
      case 'building': {
        const glassy = x.kind === 'greenhouse';
        const wallMat = glassy ? glass() : std({ color: P.building });
        const walls = solidMesh(prismGeometry(x.polygon, x.roof ? x.roof.eavesMm : x.heightMm), wallMat, !glassy);
        if (x.roof) solidMesh(roofGeometry(x), glassy ? glass() : std({ color: mode === 'dark' ? '#4a4a52' : '#5e5e66', side: THREE.DoubleSide }), !glassy);
        if (glassy) {
          // The frame, so the glass reads as a greenhouse.
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(walls.geometry, 20), new THREE.LineBasicMaterial({ color: mode === 'dark' ? 0xc8ccd0 : 0xf4f4f0 }));
          add(edges);
          if (x.roof) add(new THREE.LineSegments(new THREE.EdgesGeometry(roofGeometry(x), 20), new THREE.LineBasicMaterial({ color: mode === 'dark' ? 0xc8ccd0 : 0xf4f4f0 })));
        }
        return;
      }
      case 'compost':
        solidMesh(prismGeometry(x.polygon, x.heightMm), [std({ color: '#5a4030' }), timber()]);
        return;
      case 'fence':
        solidMesh(prismGeometry(x.polygon, x.heightMm), [std({ color: P.fence }), timber()]);
        return;
      case 'wall': {
        const brick = std({ map: this.texture(`${tk}:brick`, () => tileTexture((c) => drawEdgingTile(c, 'brick', P, mode), EDGING_TILE_MM.brick * M)) });
        solidMesh(prismGeometry(x.polygon, x.heightMm), [brick, brick]);
        return;
      }
      case 'hedge': {
        const colour = x.bare ? '#7a6a4a' : mode === 'dark' ? '#4f6e42' : '#5e8a4a';
        const leafy = std({ map: this.texture(`${tk}:hedge:${colour}`, () => tileTexture((c) => drawHedgeTile(c, colour, mode), 0.6)) });
        solidMesh(prismGeometry(x.polygon, x.heightMm), [leafy, leafy]);
        return;
      }
      default:
        solidMesh(prismGeometry(x.polygon, x.heightMm), std({ color: materialColour('paving', P, mode) }));
    }
  }

  /** A trellis, arch or obelisk: thin timber posts and rails, so the climber on it shows. */
  private supportFrame(x: Solid, wood: THREE.Material, add: (o: THREE.Object3D, pick?: { name: string }) => THREE.Object3D, pick: { name: string }): void {
    const h = x.heightMm;
    const bar = (a: [number, number, number], b: [number, number, number], r = 18) => {
      const A = v3(a[0], a[1], a[2]);
      const B = v3(b[0], b[1], b[2]);
      const len = A.distanceTo(B);
      if (len <= 0) return;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * M, r * M, len, 6), wood);
      m.position.copy(A.clone().add(B).multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      m.castShadow = true;
      add(m, pick);
    };
    if (x.support === 'obelisk' && x.circle) {
      const [cx, cy] = x.circle.centre;
      const r = x.circle.radiusMm;
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        bar([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0], [cx, cy, h]);
      }
      for (const z of [h * 0.3, h * 0.6]) {
        const k = 1 - z / h;
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          const b = a + Math.PI / 2;
          bar([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k, z], [cx + Math.cos(b) * r * k, cy + Math.sin(b) * r * k, z], 10);
        }
      }
      return;
    }
    if (x.support === 'trellis' && x.line) {
      // Posts at each end and corner, and a lattice of rails between them.
      for (let i = 0; i + 1 < x.line.length; i++) {
        const [a, b] = [x.line[i]!, x.line[i + 1]!];
        bar([a[0], a[1], 0], [a[0], a[1], h], 30);
        bar([b[0], b[1], 0], [b[0], b[1], h], 30);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(2, Math.round(len / 300));
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          bar([p[0], p[1], 0], [p[0], p[1], h], 8);
        }
        for (let z = 300; z < h; z += 300) bar([a[0], a[1], z], [b[0], b[1], z], 8);
      }
      return;
    }
    // An arch: legs at the four corners, an arched top, and rails along the long sides.
    const pts = x.polygon;
    if (pts.length !== 4) return;
    const [a, b, c, d] = pts as [Point, Point, Point, Point];
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]) >= Math.hypot(d[0] - a[0], d[1] - a[1]);
    const [p0, p1, q0, q1] = long ? [a, b, d, c] : [a, d, b, c];
    const span = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const leg = Math.max(h - span / 2, h * 0.6);
    for (const [s0, s1] of [
      [p0, p1],
      [q0, q1],
    ] as [Point, Point][]) {
      bar([s0[0], s0[1], 0], [s0[0], s0[1], leg], 25);
      bar([s1[0], s1[1], 0], [s1[0], s1[1], leg], 25);
      // The curve over the top, in a few straight pieces.
      const n = 8;
      let prev: [number, number, number] = [s0[0], s0[1], leg];
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const z = leg + Math.sin(t * Math.PI) * (h - leg);
        const next: [number, number, number] = [s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t, z];
        bar(prev, next, 20);
        prev = next;
      }
    }
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const z = t === 0 || t === 1 ? leg : leg + Math.sin(t * Math.PI) * (h - leg);
      bar([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, z], [q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t, z], 10);
    }
  }

  private tree(t: Tree3, std: (o: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial, add: (o: THREE.Object3D, pick?: Pickable) => THREE.Object3D): void {
    const pick = { name: t.plantingId ? (this.names[t.plantingId] ?? t.name) : t.name };
    const group = new THREE.Group();
    group.position.copy(v3(t.centre[0], t.centre[1], t.baseMm ?? 0));
    const h = t.heightMm * M;
    const r = (t.spreadMm / 2) * M;
    const fade = t.ghost ? { transparent: true, opacity: 0.35, depthWrite: false } : {};
    const bark = std({ color: '#6a5038', ...fade });
    const trunkTop = h * (t.shape === 'weeping' ? 0.75 : TRUNK_SHARE + 0.1);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.03, Math.min(0.18, r * 0.035)), Math.max(0.05, Math.min(0.28, r * 0.06)), trunkTop, 10).translate(0, trunkTop / 2, 0), bark);
    trunk.castShadow = !t.ghost;
    group.add(trunk);
    // The canopy's box: from where the leaves start to the top.
    const low = h * (t.shape === 'weeping' ? 0.15 : t.shape === 'conical' ? 0.15 : TRUNK_SHARE);
    const ry = (h - low) / 2;
    const cy = low + ry;
    const rx = r * (t.shape === 'columnar' ? 0.8 : 1);
    if (t.bare) {
      // Branches from the top of the trunk out to the canopy's edge, and a faint haze of twigs.
      let s = hashString(t.id);
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rnd() * 0.5;
        const reach = 0.45 + rnd() * 0.45;
        const end = new THREE.Vector3(Math.cos(a) * rx * reach, cy + ry * (rnd() * 0.8 - 0.2), Math.sin(a) * rx * reach);
        const start = new THREE.Vector3(0, trunkTop * (0.75 + rnd() * 0.2), 0);
        const len = start.distanceTo(end);
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, Math.max(0.015, Math.min(0.06, r * 0.012)), len, 5).translate(0, len / 2, 0), bark);
        branch.position.copy(start);
        branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
        branch.castShadow = !t.ghost;
        group.add(branch);
      }
      const haze = new THREE.Mesh(canopyGeometry(hashString(t.id)), std({ color: '#8a7a68', transparent: true, opacity: 0.07, depthWrite: false }));
      haze.scale.set(rx, ry, rx);
      haze.position.y = cy;
      group.add(haze);
    } else {
      // A solid core, darker, so the gaps between the leaves show shade rather than sky; then a shell of leaf clusters
      // round it, in the tree's own leaf shape, so a birch, a pine and a copper beech look different. A ghost (only
      // planned) is the plain shape.
      const colour = t.blossom ? mixHex(t.foliage, t.blossom, 0.5) : t.foliage;
      const leaves = std({ color: t.ghost ? colour : shadeHex(t.foliage, -0.18), ...fade });
      const flat = t.shape === 'spreading' ? 0.75 : 1;
      const core = t.ghost ? 1 : 0.72;
      const canopy =
        t.shape === 'conical'
          ? new THREE.Mesh(new THREE.ConeGeometry(rx * core, (h - low) * core, 18, 3).translate(0, low + ((h - low) * core) / 2, 0), leaves)
          : new THREE.Mesh(canopyGeometry(hashString(t.id)), leaves);
      if (t.shape !== 'conical') {
        canopy.scale.set(rx * core, ry * flat * core, rx * core);
        canopy.position.y = cy - (1 - flat) * ry * 0.5;
      }
      canopy.castShadow = !t.ghost;
      canopy.receiveShadow = true;
      group.add(canopy);
      if (!t.ghost) group.add(this.leafShell(t, rx, ry * flat, t.shape === 'conical' ? null : cy - (1 - flat) * ry * 0.5, low, h));
      if (t.fruit) {
        // A dozen fruit round the outside of the canopy.
        const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(Math.max(0.035, r * 0.05), 8, 6), std({ color: t.fruit }), 14);
        let s = hashString(t.id) ^ 0x51;
        const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
        const m = new THREE.Matrix4();
        for (let i = 0; i < 14; i++) {
          const a = rnd() * Math.PI * 2;
          const e = (rnd() - 0.6) * 1.2;
          m.makeTranslation(Math.cos(a) * Math.cos(e) * rx * 0.95, cy + Math.sin(e) * ry * 0.95, Math.sin(a) * Math.cos(e) * rx * 0.95);
          fruit.setMatrixAt(i, m);
        }
        group.add(fruit);
      }
    }
    add(group, pick);
  }

  /**
   * Leaf cards spread over a canopy's surface and a little inside it, each facing outwards with a random twist: a
   * round or oval canopy centred at `cy`, or for a conifer (cy null) a cone from `low` to `h`.
   */
  private leafShell(t: Tree3, rx: number, ry: number, cy: number | null, low: number, h: number): THREE.InstancedMesh {
    const key = `leaf:${t.leaf}:${t.foliage}:${t.blossom ?? ''}`;
    const map = this.texture(key, () => {
      const tex = new THREE.CanvasTexture(leafCluster(t.leaf, t.foliage, t.blossom, hashString(key)));
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    });
    const n = leafCards(rx, cy === null ? (h - low) / 2 : ry);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.9, alphaTest: 0.4, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
    let s = hashString(t.id) ^ 0x2f;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const size = Math.max(0.35, Math.min(1.1, Math.max(rx, ry) * 0.5));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const out = new THREE.Vector3();
    const z = new THREE.Vector3(0, 0, 1);
    const roll = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      // Evenly round the canopy (a spiral), a little in or out of its surface.
      const u = (i + 0.5) / n;
      const a = i * 2.39996 + rnd() * 0.4;
      const depth = 0.78 + rnd() * 0.3;
      let pos: THREE.Vector3;
      if (cy === null) {
        const y = low + (h - low) * Math.pow(u, 0.8);
        const r = rx * (1 - (y - low) / (h - low)) * depth;
        pos = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        out.set(Math.cos(a), 0.45, Math.sin(a)).normalize();
      } else {
        const yy = 1 - 2 * u;
        const ring = Math.sqrt(1 - yy * yy);
        out.set(Math.cos(a) * ring, yy, Math.sin(a) * ring);
        pos = new THREE.Vector3(out.x * rx * depth, cy + out.y * ry * depth, out.z * rx * depth);
      }
      q.setFromUnitVectors(z, out);
      roll.setFromAxisAngle(z, rnd() * Math.PI * 2);
      q.multiply(roll);
      const k = size * (0.75 + rnd() * 0.5);
      m.compose(pos, q, new THREE.Vector3(k, k, k));
      mesh.setMatrixAt(i, m);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.4 });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  /** Pen marks, highlighter and arrows lying on the ground, and words standing just above it, as on the plan. */
  private sketches(s: Scene3, P: PlanPalette, mode: Mode, lift: number, add: (o: THREE.Object3D, pick?: Pickable) => THREE.Object3D): void {
    for (const k of s.sketches) {
      const colour = k.colour === 'ink' ? P.label : SKETCH_INK[mode][k.colour];
      if (k.kind === 'text') {
        const text = k.text;
        if (!text || !k.points[0]) continue;
        const px = 48;
        // Kept with the other textures, so a rebuild reuses it rather than making another.
        const tex = this.texture(`sketch:${colour}:${text}`, () => {
          const c = document.createElement('canvas');
          const ctx = c.getContext('2d')!;
          ctx.font = `600 ${px}px system-ui, sans-serif`;
          c.width = Math.ceil(ctx.measureText(text).width) + 16;
          c.height = px + 16;
          ctx.font = `600 ${px}px system-ui, sans-serif`;
          ctx.fillStyle = colour;
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 8, c.height / 2);
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        });
        const img = tex.image as HTMLCanvasElement;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
        // Letters as tall as they're drawn on the plan (its text size is the sketch's width), at least a hand's height.
        const h = Math.max(0.12, (k.widthMm / 1000) * (img.height / px));
        sprite.scale.set((h * img.width) / img.height, h, 1);
        sprite.position.copy(v3(k.points[0][0], k.points[0][1], 300));
        add(sprite);
        continue;
      }
      if (k.points.length < 2) continue;
      const highlighter = k.kind === 'highlighter';
      const mat = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, transparent: highlighter, opacity: highlighter ? 0.4 : 1, depthWrite: !highlighter, polygonOffset: true, polygonOffsetFactor: -40, polygonOffsetUnits: -160 });
      const width = Math.max(30, k.widthMm);
      add(new THREE.Mesh(ribbonGeometry(k.points, width, lift), mat));
      if (k.kind === 'arrow') {
        // The head: a triangle at the last point, pointing along the last stretch.
        const [a, b] = [k.points[k.points.length - 2]!, k.points[k.points.length - 1]!];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        const size = Math.max(250, width * 5);
        const back: Point = [b[0] - ux * size, b[1] - uy * size];
        const tri = [b, [back[0] - uy * size * 0.5, back[1] + ux * size * 0.5] as Point, [back[0] + uy * size * 0.5, back[1] - ux * size * 0.5] as Point];
        add(new THREE.Mesh(flatGeometry(tri, lift + 0.0005), mat));
      }
    }
  }

  private plants(g: PlantGroup): void {
    const k = `plant:${g.key}:${this.detail ? 2 : 1}`;
    const textures = this.texture(`${k}:side`, () => {
      const t = plantTextures(g, this.detail);
      this.textures.set(`${k}:top`, t.top);
      return t.side;
    });
    const top = this.textures.get(`${k}:top`)!;
    const ghost = g.look.ghost;
    const mat = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ map, roughness: 0.95, alphaTest: ghost ? 0.05 : 0.45, ...(ghost ? { transparent: true, opacity: 0.4, depthWrite: false } : {}) });
    const n = g.spots.length;
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const meshes: THREE.InstancedMesh[] = [new THREE.InstancedMesh(cardsGeometry(), mat(textures), n)];
    const seedlingOrDormant = g.look.seedling || g.look.dormant || g.look.bare;
    if (HAS_TOP.has(g.art.form) && !seedlingOrDormant) meshes.push(new THREE.InstancedMesh(topGeometry(), mat(top), n));
    g.spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.turn);
      const w = Math.max(0.03, s.spreadMm * M * (g.look.seedling ? 0.35 : 1));
      const h = Math.max(0.03, s.heightMm * M * (g.look.seedling ? 0.35 : g.look.dormant ? 0.4 : 1));
      // The pictures already show the plant at its stage's size, so the cards are its full size.
      matrix.compose(v3(s.x, s.y, s.baseMm), q, new THREE.Vector3(w, h, w));
      for (const m of meshes) m.setMatrixAt(i, matrix);
    });
    for (const m of meshes) {
      m.castShadow = !ghost;
      m.receiveShadow = true;
      if (!ghost) m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: (m.material as THREE.MeshStandardMaterial).map, alphaTest: 0.45 });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.userData.pick = { plantingIds: g.spots.map((s) => s.plantingId) } satisfies Pickable;
      this.world.add(m);
    }
  }

  /** The sun: where the light comes from, and its shadows over the whole garden. */
  private light(s: Scene3): void {
    const c = this.centre;
    if (!s.sun) {
      this.sun.visible = false;
      this.sky.intensity = 1.6;
      return;
    }
    this.sun.visible = true;
    const [x, y, z] = s.sun.dir;
    const d = this.extent * 2;
    this.sun.position.set(c.x + x * d, z * d, c.z - y * d);
    this.sun.target.position.copy(c);
    this.sun.target.updateMatrixWorld();
    // A low sun lights the ground glancingly, so the sky does more of the work: winter is a little dimmer than
    // summer, not gloomy. A low sun is warmer too.
    const up = Math.sin((s.sun.altitude * Math.PI) / 180);
    const sky = 2.2 - 0.9 * up;
    // The same light on open ground all year, so winter has soft shadows rather than a grey garden.
    const even = 3.4 / (sky + 2.4 * up);
    this.sun.intensity = 2.4 * even;
    this.sun.color.set(new THREE.Color('#ffe2b8').lerp(new THREE.Color('#ffffff'), Math.min(1, up * 1.6)));
    this.sky.intensity = sky * even;
    const cam = this.sun.shadow.camera as THREE.OrthographicCamera;
    const half = this.extent * 0.9 + 4;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 0.5;
    cam.far = d * 2.5;
    cam.updateProjectionMatrix();
    this.dirty = true;
  }

  get isWalking(): boolean {
    return !!this.walking;
  }

  /** Where you're standing and which way you face, while walking. */
  get walkSpot(): WalkSpot | null {
    const w = this.walking;
    const turn = 2 * Math.PI;
    return w ? { at: [Math.round(w.at[0]), Math.round(w.at[1])], heading: ((w.heading % turn) + turn) % turn } : null;
  }

  /** Walks into the garden at eye height: where you chose to start, or the middle looking up the plan. Plants are redrawn finer. */
  startWalk(saved?: WalkSpot | null): void {
    if (!this.last) return;
    this.glide = null;
    const { at, heading } = walkStart(this.last.s, this.obstacles, saved);
    this.walking = { at, heading, pitch: -0.12, target: null };
    this.controls.enabled = false;
    if (!this.detail) {
      this.detail = true;
      this.show(this.last.s, this.last.style, this.lastGarden);
    }
    this.placeEye();
  }

  private stopWalk(): void {
    if (!this.walking) return;
    this.walking = null;
    this.move = { forward: 0, strafe: 0, turn: 0 };
    this.controls.enabled = true;
  }

  /** Walking from the keys or the thumb pad, each -1 to 1. Any of it stops a walk to a tapped spot. */
  setMove(forward: number, strafe: number, turn: number): void {
    this.move = { forward, strafe, turn };
    if (this.walking && (forward || strafe || turn)) this.walking.target = null;
  }

  /** Looking round by dragging, in screen pixels: the view follows your finger, as when turning round the garden. */
  look(dx: number, dy: number): void {
    const w = this.walking;
    if (!w) return;
    w.heading += dx * 0.004;
    w.pitch = Math.max(-1.1, Math.min(0.9, w.pitch + dy * 0.004));
    this.placeEye();
  }

  /**
   * A tap while walking: on open ground (lawn, paths, paving), walk there, as far as you can get; on anything else,
   * its name. Returns the name, or null.
   */
  walkTap(clientX: number, clientY: number): string | null {
    const w = this.walking;
    if (!w || !this.last) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    for (const h of ray.intersectObjects(this.world.children, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.pick) o = o.parent;
      const p = o?.userData.pick as Pickable | undefined;
      if (!p) continue;
      if (p.ground) {
        const end = walkTowards(this.last.s, this.obstacles, w.at, [Math.round(h.point.x / M), Math.round(-h.point.z / M)]);
        w.target = end;
        return null;
      }
      if (p.plantingIds && h.instanceId !== undefined) {
        const id = p.plantingIds[h.instanceId];
        if (id && this.names[id]) return this.names[id]!;
        continue;
      }
      if (p.name) return p.name;
    }
    return null;
  }

  /** The camera at eye height where you stand, looking the way you face. */
  private placeEye(): void {
    const w = this.walking;
    if (!w) return;
    const eye = v3(w.at[0], w.at[1], EYE_MM);
    this.camera.position.copy(eye);
    const look = new THREE.Vector3(Math.cos(w.heading) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.sin(w.heading) * Math.cos(w.pitch));
    this.camera.lookAt(eye.add(look));
    this.dirty = true;
  }

  /** One frame of walking: from the keys or thumb pad, or on towards a tapped spot, never through anything. */
  private stepWalk(dt: number): void {
    const w = this.walking;
    if (!w || !this.last || !dt) return;
    const { forward, strafe, turn } = this.move;
    if (turn) w.heading -= turn * 1.6 * dt;
    let to: Point | null = null;
    const [fx, fy] = [Math.cos(w.heading), Math.sin(w.heading)];
    if (forward || strafe) {
      const d = PACE_MM * dt;
      // Right of where you face is a quarter turn clockwise.
      to = [w.at[0] + (fx * forward + fy * strafe) * d, w.at[1] + (fy * forward - fx * strafe) * d];
    } else if (w.target) {
      const [dx, dy] = [w.target[0] - w.at[0], w.target[1] - w.at[1]];
      const dist = Math.hypot(dx, dy);
      if (dist < BODY_MM / 5) w.target = null;
      else {
        const k = Math.min(1, (PACE_MM * 1.5 * dt) / dist);
        to = [w.at[0] + dx * k, w.at[1] + dy * k];
        // Turn to face the way you're going, gently.
        let diff = Math.atan2(dy, dx) - w.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        w.heading += diff * Math.min(1, dt * 5);
      }
    }
    if (to) {
      const next = step(this.last.s, this.obstacles, w.at, to);
      if (next[0] === w.at[0] && next[1] === w.at[1]) w.target = null;
      w.at = next;
    }
    if (turn || to) this.placeEye();
  }

  /** Looking down over the garden from the bottom of the plan, or standing at its bottom edge. */
  preset(p: Preset): void {
    this.stopWalk();
    this.glide = null;
    const c = this.centre;
    // A tall, narrow screen (a phone) needs to stand further back to see the whole garden.
    const D = this.extent / Math.min(1, this.camera.aspect) ** 0.4;
    if (p === 'above') {
      this.camera.position.set(c.x, D * 1.05, c.z + D * 1.0);
      this.controls.target.copy(c);
    } else {
      this.camera.position.set(c.x, 1.6, this.bounds.maxZ + 0.6);
      this.controls.target.set(c.x, 0.9, c.z);
    }
    this.controls.update();
    this.dirty = true;
  }

  /** How far past the garden's edge you can move, metres. */
  private static readonly EDGE = 3;

  /** The point you turn round stays over the garden (and a little beyond), at about head height or below. */
  private keepInGarden(): void {
    const t = this.controls.target;
    const e = GardenView.EDGE;
    const x = Math.min(this.bounds.maxX + e, Math.max(this.bounds.minX - e, t.x));
    const z = Math.min(this.bounds.maxZ + e, Math.max(this.bounds.minZ - e, t.z));
    const y = Math.min(2, Math.max(0, t.y));
    if (x === t.x && y === t.y && z === t.z) return;
    // Move the camera with it, so the view doesn't swing.
    const d = new THREE.Vector3(x - t.x, y - t.y, z - t.z);
    t.add(d);
    this.camera.position.add(d);
  }

  /**
   * Goes to the spot under a point on the screen: the view glides there and turns round it, a little closer if it was
   * far off. True if there was something there to go to.
   */
  goTo(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.world.children, true)[0];
    if (!hit) return false;
    const e = GardenView.EDGE;
    const to = new THREE.Vector3(
      Math.min(this.bounds.maxX + e, Math.max(this.bounds.minX - e, hit.point.x)),
      Math.min(1.5, Math.max(0, hit.point.y)),
      Math.min(this.bounds.maxZ + e, Math.max(this.bounds.minZ - e, hit.point.z)),
    );
    const offset = this.camera.position.clone().sub(this.controls.target);
    const near = Math.max(3, Math.min(8, this.extent * 0.5));
    if (offset.length() > near) offset.setLength(near);
    const cam = to.clone().add(offset);
    cam.y = Math.max(cam.y, 0.4);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.controls.target.copy(to);
      this.camera.position.copy(cam);
      this.controls.update();
      this.dirty = true;
      return true;
    }
    this.glide = { from: [this.camera.position.clone(), this.controls.target.clone()], to: [cam, to], start: performance.now() };
    return true;
  }

  private stepGlide(): void {
    const g = this.glide;
    if (!g) return;
    const k = Math.min(1, (performance.now() - g.start) / 450);
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    this.camera.position.lerpVectors(g.from[0], g.to[0], ease);
    this.controls.target.lerpVectors(g.from[1], g.to[1], ease);
    this.dirty = true;
    if (k >= 1) this.glide = null;
  }

  /** What's under a point on the screen, in words. */
  pick(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    const hits = ray.intersectObjects(this.world.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.pick) o = o.parent;
      const p = o?.userData.pick as Pickable | undefined;
      if (!p) continue;
      if (p.plantingIds && h.instanceId !== undefined) {
        const id = p.plantingIds[h.instanceId];
        if (id && this.names[id]) return this.names[id]!;
        continue;
      }
      if (p.name) return p.name;
    }
    return null;
  }

  /** The view as a picture. */
  picture(): Promise<Blob | null> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((done) => this.renderer.domElement.toBlob(done, 'image/png'));
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.controls.dispose();
    this.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.renderer.dispose();
  }
}
