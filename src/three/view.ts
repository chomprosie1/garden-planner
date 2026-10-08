// The garden in 3D, drawn with three.js. Loaded only when the 3D view opens
// (a dynamic import), so the plan never pays for it.
//
// It turns a scene from src/three/scene.ts into meshes: ground and surfaces
// with the plan's own textures, beds and pots with their edging and soil,
// walls, fences, hedges and buildings at their heights with pitched roofs,
// trees in their shapes, and each plant as crossed pictures drawn from the
// side (one instanced mesh for every plant drawn the same way). The sun is a
// light with real shadows. Read-only: drag to turn, pinch or scroll to zoom,
// tap for a name.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawPlant, hashString, mixHex, type Paint } from '../art/plants';
import { drawPlantSide } from '../art/side';
import { drawEdgingTile, drawHedgeTile, drawMaterialTile, EDGING_TILE_MM, MATERIAL_TILE_MM, materialColour } from '../canvas/materials';
import type { Material, Point } from '../model/types';
import { LOOKS, type LookId, type Mode, type PlanPalette } from '../theme/looks';
import { TRUNK_SHARE, type PlantGroup, type Scene3, type Solid, type Tree3 } from './scene';

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

const SIDE_PX = 128;

/** A plant's side and top pictures, as textures. */
function plantTextures(grp: PlantGroup): { side: THREE.CanvasTexture; top: THREE.CanvasTexture } {
  const ratio = Math.max(0.25, Math.min(4, grp.heightMm / Math.max(1, grp.spreadMm)));
  const side = document.createElement('canvas');
  side.width = SIDE_PX;
  side.height = Math.round(Math.max(32, Math.min(512, SIDE_PX * ratio)));
  const sc = side.getContext('2d')!;
  sc.translate(SIDE_PX / 2, side.height);
  drawPlantSide(sc, { art: grp.art, look: grp.look, w: SIDE_PX * 0.94, h: side.height * 0.97, seed: hashString(grp.plantId) });
  const top = document.createElement('canvas');
  top.width = top.height = 128;
  const tc = top.getContext('2d')!;
  tc.translate(64, 64);
  const paint: Paint = { style: 'wash', mode: 'light', ink: '#3a3a30', paper: '#f6f1e7', soil: '#7a5a3c' };
  drawPlant(tc, { art: grp.art, look: { ...grp.look, ghost: false }, r: 56, paint, seed: hashString(grp.plantId) });
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

interface Pickable {
  name?: string;
  /** For instanced plants: the planting each instance belongs to. */
  plantingIds?: string[];
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
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.addEventListener('change', () => (this.dirty = true));
    this.sun.castShadow = true;
    const map = opts.phone ? 1024 : 2048;
    this.sun.shadow.mapSize.set(map, map);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sky, this.sun, this.sun.target, this.world);
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      if (this.controls.update() || this.dirty) {
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
    ].join('|');
    const first = !this.contentKey;
    if (key !== this.contentKey || gardenKey !== this.lastGarden) {
      this.contentKey = key;
      this.lastGarden = gardenKey;
      this.build(s, style);
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
    const ground = new THREE.Mesh(flatGeometry(s.ground, 0), std({ color: mixHex(P.paper.startsWith('#') ? P.paper : '#f0ead8', '#8a7a5a', 0.3) }));
    ground.receiveShadow = true;
    add(ground);

    // Flat things, each a little above the one before. A few millimetres isn't enough for the depth buffer from far off or
    // low down (paving over a lawn let the lawn flicker through), so each layer is also drawn in order and pulled towards
    // the camera by its layer: the one on top always wins.
    s.flats.forEach((f, i) => {
      const lift = 0.002 + i * 0.0015;
      let mat: THREE.Material;
      if (f.material === 'water') mat = std({ color: P.water, roughness: 0.12, metalness: 0.15 });
      else if (f.material === 'path') mat = std({ color: P.path });
      else {
        const m = f.material as Material;
        mat = std({ map: this.texture(`${tk}:${m}`, () => tileTexture((c) => drawMaterialTile(c, m, P, mode), MATERIAL_TILE_MM[m] * M)) });
      }
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -(i + 1);
      mat.polygonOffsetUnits = -(i + 1) * 4;
      const mesh = new THREE.Mesh(flatGeometry(f.polygon, lift), mat);
      mesh.renderOrder = i + 1;
      mesh.receiveShadow = true;
      add(mesh, { name: f.name });
    });

    const soil = this.texture(`${tk}:soil`, () => tileTexture((c) => drawMaterialTile(c, 'soil', P, mode), MATERIAL_TILE_MM.soil * M));
    const soilMat = () => std({ map: soil });
    const glass = () => std({ color: P.glass.startsWith('#') ? P.glass : '#cfe6ee', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });

    for (const x of s.solids) this.solid(x, P, mode, tk, std, soilMat, glass, add);
    for (const t of s.trees) this.tree(t, std, add);
    for (const g of s.groups) this.plants(g);
  }

  private solid(
    x: Solid,
    P: PlanPalette,
    mode: Mode,
    tk: string,
    std: (o: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial,
    soilMat: () => THREE.Material,
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
    switch (x.kind) {
      case 'bed': {
        const side = x.edging ? std({ map: this.texture(`${tk}:${x.edging}`, () => tileTexture((c) => drawEdgingTile(c, x.edging!, P, mode), EDGING_TILE_MM[x.edging!] * M)) }) : soilMat();
        solidMesh(prismGeometry(x.polygon, x.heightMm), [soilMat(), side], !!x.edging);
        return;
      }
      case 'pot': {
        const c = x.circle!;
        const r = c.radiusMm * M;
        const h = x.heightMm * M;
        const pot = solidMesh(new THREE.CylinderGeometry(r, r * 0.8, h, 28, 1, true).translate(0, h / 2, 0), std({ color: mode === 'dark' ? '#8a4a2c' : '#b5653a', side: THREE.DoubleSide }));
        pot.position.copy(v3(c.centre[0], c.centre[1]));
        const top = solidMesh(new THREE.CircleGeometry(r * 0.94, 28).rotateX(-Math.PI / 2).translate(0, h - 0.03, 0), soilMat(), false);
        top.position.copy(pot.position);
        return;
      }
      case 'planter':
        solidMesh(prismGeometry(x.polygon, x.heightMm), [soilMat(), std({ color: mode === 'dark' ? '#4a443c' : '#5a5048' })]);
        return;
      case 'cold-frame':
        solidMesh(prismGeometry(x.polygon, Math.min(250, x.heightMm)), [soilMat(), timber()]);
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

  private tree(t: Tree3, std: (o: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial, add: (o: THREE.Object3D, pick?: Pickable) => THREE.Object3D): void {
    const pick = { name: t.plantingId ? (this.names[t.plantingId] ?? t.name) : t.name };
    const group = new THREE.Group();
    group.position.copy(v3(t.centre[0], t.centre[1]));
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
      const colour = t.blossom ? mixHex(t.foliage, t.blossom, 0.5) : t.foliage;
      const leaves = std({ color: colour, ...fade });
      const canopy =
        t.shape === 'conical'
          ? new THREE.Mesh(new THREE.ConeGeometry(rx, h - low, 18, 3).translate(0, low + (h - low) / 2, 0), leaves)
          : new THREE.Mesh(canopyGeometry(hashString(t.id)), leaves);
      if (t.shape !== 'conical') {
        const flat = t.shape === 'spreading' ? 0.75 : 1;
        canopy.scale.set(rx, ry * flat, rx);
        canopy.position.y = cy - (1 - flat) * ry * 0.5;
      }
      canopy.castShadow = !t.ghost;
      canopy.receiveShadow = true;
      group.add(canopy);
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

  private plants(g: PlantGroup): void {
    const textures = this.texture(`plant:${g.key}:side`, () => {
      const t = plantTextures(g);
      this.textures.set(`plant:${g.key}:top`, t.top);
      return t.side;
    });
    const top = this.textures.get(`plant:${g.key}:top`)!;
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

  /** Looking down over the garden from the bottom of the plan, or standing at its bottom edge. */
  preset(p: Preset): void {
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
