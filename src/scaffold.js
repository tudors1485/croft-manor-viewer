// The roofers in (Scenes › Sights): scaffolding up the front of the house, east of the porch, from
// the ground to the battlements, four lifts of boards on tube-and-coupler steel, ladders between
// them, debris netting over its face, a rubbish chute down into a skip, a gin wheel and bucket at
// the top; behind the battlements a stretch of roof stripped to the battens under a blue tarpaulin,
// with the new slates stacked on the top lift. On the forecourt the site compound: temporary
// fencing with a site sign, a cement mixer, a heap of sand, pallets under tarpaulins, a site cabin,
// cones. And from the scaffold, in working hours, hammering and the odd power saw (sound.js).
//
// Everything is built here from boxes, tubes and canvases (no models to download). The scaffold is
// fitted to the measured wall: the front wall at z -12.19 from the porch's east side (x 1.18) to the
// gabled bay (x 9.9), the chimney breast standing 0.44 m proud between x 4.95 and 6.05, the parapet
// topping out at 8.07, the roof behind it rising at 54° from the gutter to its ridge at z -15.
// Another scene, a place or Reset takes it all down again.

import * as THREE from 'three';
import { weatherShader } from './materials.js';

const R = 0.024; // scaffold tube: 48 mm
const BOARD = { w: 0.225, t: 0.038 }; // a scaffold board's width and thickness
const WALL_Z = -12.19; // the front wall
const BREAST = { x0: 4.95, x1: 6.05, z: -11.75 }; // the chimney breast
const X0 = 1.55; // first standards (the porch's east wall is at 1.18)
const X1 = 9.65; // last standards (the gabled bay starts at 9.9)
const BAYS = 4;
const BAY = (X1 - X0) / BAYS;
const Z_IN = -11.4; // inner standards, 0.35 m off the chimney breast
const Z_OUT = -10.3; // outer standards
const LIFTS = [1.95, 3.95, 5.95, 7.95]; // the boards' top faces
const TOP = 9.0; // the standards' top (the parapet is 8.07)
const LADDER_BAY = BAYS - 1; // the ladders go up through the east bay
const HATCH = 0.75; // the hatch for them, at the east end of that bay
const FENCE_Z = -4.4; // the compound's fence along the front
const FENCE_X0 = 0.9;
const FENCE_X1 = 14.9;
const PANEL = 3.5;

const Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Many copies of one shape in one draw: collect their matrices, then build the InstancedMesh. */
class Batch {
  constructor(geometry, material, { shadow = true, receive = true } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.shadow = shadow;
    this.receive = receive;
    this.matrices = [];
    this.colors = [];
  }

  add(matrix, color = null) {
    this.matrices.push(matrix.clone());
    this.colors.push(color ? color.clone() : null);
  }

  build(name) {
    const n = this.matrices.length;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, Math.max(1, n));
    mesh.name = name;
    mesh.count = n;
    const tinted = this.colors.some((c) => c);
    for (let i = 0; i < n; i++) {
      mesh.setMatrixAt(i, this.matrices[i]);
      if (tinted) mesh.setColorAt(i, this.colors[i] ?? new THREE.Color(1, 1, 1));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); // (culled by where the copies are, not the unit shape at the origin)
    mesh.castShadow = this.shadow;
    mesh.receiveShadow = this.receive;
    mesh.frustumCulled = n > 0;
    return mesh;
  }
}

/** The matrix of a unit cylinder (along y, height 1) stretched from `a` to `b`, `r` thick. */
function tubeMatrix(a, b, r = R) {
  _a.set(...a);
  _b.set(...b);
  _d.subVectors(_b, _a);
  const len = _d.length();
  _q.setFromUnitVectors(Y, _d.normalize());
  _s.set(r / R, len, r / R);
  return _m.compose(_a.add(_b).multiplyScalar(0.5), _q, _s);
}

/** The matrix of a unit box, `size` big, centred at `c`, turned `rotY` about y (and `rotZ` about z). */
function boxMatrix(c, size, rotY = 0, rotZ = 0, rotX = 0) {
  _a.set(...c);
  _q.setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
  _s.set(...size);
  return _m.compose(_a, _q, _s);
}

// --- pictures --------------------------------------------------------------------------------

function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 4;
  return t;
}

/** Sawn softwood, weathered grey-brown, the grain along x. */
function woodPicture() {
  return canvasTexture(512, 64, (g, w, h) => {
    const R = rng(31);
    g.fillStyle = '#9b7d57';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const y = R() * h;
      g.strokeStyle = `rgba(${60 + R() * 40 | 0}, ${40 + R() * 30 | 0}, ${20 + R() * 20 | 0}, ${0.12 + R() * 0.25})`;
      g.lineWidth = 0.5 + R() * 1.6;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 1.5);
      g.stroke();
    }
    // weathered: a grey wash, and a few darker patches
    g.fillStyle = 'rgba(120, 118, 110, 0.28)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(50, 40, 30, ${0.05 + R() * 0.12})`;
      g.fillRect(R() * w, 0, 20 + R() * 60, h);
    }
  });
}

/** Debris netting: a fine mesh, see-through between its threads. */
function nettingPicture() {
  return canvasTexture(
    128,
    128,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255, 255, 255, 1)';
      g.lineWidth = 1.4;
      for (let i = 0; i <= w; i += 8) {
        g.beginPath();
        g.moveTo(i + 0.5, 0);
        g.lineTo(i + 0.5, h);
        g.stroke();
        g.beginPath();
        g.moveTo(0, i + 0.5);
        g.lineTo(w, i + 0.5);
        g.stroke();
      }
    },
    { repeat: [1, 1], srgb: false },
  );
}

/** Temporary fencing's welded mesh: tall narrow rectangles of wire. */
function fenceMeshPicture() {
  return canvasTexture(
    64,
    128,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255, 255, 255, 1)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w / 2, h);
      g.stroke();
    },
    { repeat: [1, 1], srgb: false },
  );
}

/** The site sign: white board, red band, black lettering. */
function signPicture() {
  return canvasTexture(768, 512, (g, w, h) => {
    g.fillStyle = '#f4f2ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8102e';
    g.fillRect(0, 0, w, 112);
    g.fillStyle = '#fff';
    g.font = 'bold 72px system-ui, Helvetica, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SITE SAFETY', w / 2, 58);
    g.fillStyle = '#111';
    g.font = 'bold 44px system-ui, Helvetica, Arial, sans-serif';
    const lines = ['Roof repairs in progress', 'No unauthorised entry', 'Hard hats and hi-vis', 'beyond this point', 'Report to the site office'];
    lines.forEach((l, i) => g.fillText(l, w / 2, 170 + i * 66));
    g.strokeStyle = '#999';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
  });
}

/** A small yellow warning board for the scaffold. */
function warningPicture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#f6c71e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#111';
    for (let i = -h; i < w + h; i += 48) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 24, 0);
      g.lineTo(i + 24 - h * 0.18, 24);
      g.lineTo(i - h * 0.18, 24);
      g.closePath();
      g.fill();
    }
    g.font = 'bold 64px system-ui, Helvetica, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DANGER', w / 2, 92);
    g.font = 'bold 40px system-ui, Helvetica, Arial, sans-serif';
    g.fillText('Work overhead', w / 2, 158);
    g.fillText('Keep out', w / 2, 206);
  });
}

/** Roofing felt with battens across it, where the slates are off. */
function strippedRoofPicture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const R = rng(7);
    g.fillStyle = '#3a3733';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(${20 + R() * 40 | 0}, ${20 + R() * 35 | 0}, ${18 + R() * 30 | 0}, 0.5)`;
      g.fillRect(R() * w, R() * h, 2, 2);
    }
    // battens (the picture tiles 1 m: battens every 0.33 m up the slope)
    for (let k = 0; k < 3; k++) {
      const y = 12 + k * 85;
      g.fillStyle = '#a88b5c';
      g.fillRect(0, y, w, 11);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, y + 9, w, 3);
    }
  });
}

/** A heavy-duty tarpaulin: blue, with its eyelet hem. */
function tarpPicture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#2458a8';
    g.fillRect(0, 0, w, h);
    const R = rng(3);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.03 + R() * 0.06})`;
      g.lineWidth = 1 + R() * 3;
      g.beginPath();
      g.moveTo(R() * w, R() * h);
      g.lineTo(R() * w, R() * h);
      g.stroke();
    }
  });
}

// --- the scene -------------------------------------------------------------------------------

export class Scaffold {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {(x: number, z: number) => number|null} o.ground the ground's height (landscape.groundHeight)
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the house, to find the roof's surface
   * @param {object[]} o.obstacles walking's obstacles (the poles, the skip, the fence join them while it is up)
   * @param {import('./sound.js').Soundscape|null} o.sound
   */
  constructor(scene, { ground, bvh, obstacles, sound = null }) {
    this.scene = scene;
    this.ground = (x, z) => ground(x, z) ?? 0.04;
    this.bvh = bvh;
    this.obstacles = obstacles;
    this.sound = sound;
    this.on = false;
    this.built = false;
    this.group = new THREE.Group();
    this.group.name = 'The roofers in';
    this.group.visible = false;
    scene.add(this.group);
    this.nextSound = 0;
    this.soundAt = [new THREE.Vector3(7.6, 8.4, -11.0), new THREE.Vector3(3.2, 6.3, -10.9), new THREE.Vector3(8.2, 9.0, -14.3)];
  }

  set(on) {
    this.on = on;
    if (on && !this.built) this._build();
    this.group.visible = on;
    if (on) this.nextSound = 3 + Math.random() * 6;
  }

  /** Builders at work: hammering, the odd saw, in working hours (the scaffold's own clock is the viewer's). */
  update(dt, { hours = 12 } = {}) {
    if (!this.on || !this.sound) return;
    if (hours < 7.8 || hours > 17.2) return;
    this.nextSound -= dt;
    if (this.nextSound > 0) return;
    const at = this.soundAt[Math.floor(Math.random() * this.soundAt.length)];
    if (Math.random() < 0.72) this.sound.hammering?.(at, 3 + Math.floor(Math.random() * 5));
    else this.sound.powerSaw?.(at, 0.9 + Math.random() * 1.4);
    this.nextSound = 5 + Math.random() * 14;
  }

  _materials() {
    const steel = new THREE.MeshStandardMaterial({ color: 0xaeb3b7, metalness: 0.82, roughness: 0.42 });
    const alu = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 0.9, roughness: 0.32 });
    // (no snow on the boards: weatherShader reads the world position before instancing)
    const wood = new THREE.MeshStandardMaterial({ map: woodPicture(), roughness: 0.92, metalness: 0 });
    const fitting = new THREE.MeshStandardMaterial({ color: 0x6c7074, metalness: 0.7, roughness: 0.55 });
    const net = nettingPicture();
    const netting = new THREE.MeshStandardMaterial({ map: net, alphaMap: net, color: 0x3f9a63, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9, alphaTest: 0.02 });
    const fenceMesh = fenceMeshPicture();
    const wire = new THREE.MeshStandardMaterial({ map: fenceMesh, alphaMap: fenceMesh, color: 0xb9bdc0, metalness: 0.6, roughness: 0.5, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.95 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe8661a, roughness: 0.55 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe9b514, roughness: 0.5, metalness: 0.15 });
    const tarp = new THREE.MeshStandardMaterial({ map: tarpPicture(), roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide });
    weatherShader(tarp);
    const rubble = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 1 });
    const sand = new THREE.MeshStandardMaterial({ color: 0xc8a66a, roughness: 1 });
    weatherShader(sand);
    const slate = new THREE.MeshStandardMaterial({ color: 0x3b4047, roughness: 0.75 });
    const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const felt = new THREE.MeshStandardMaterial({ map: strippedRoofPicture(), roughness: 0.95, side: THREE.DoubleSide });
    const cabin = new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.6 });
    const cabinRoof = new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.7 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xcbb690, roughness: 1 });
    const sign = new THREE.MeshStandardMaterial({ map: signPicture(), roughness: 0.6 });
    const warning = new THREE.MeshStandardMaterial({ map: warningPicture(), roughness: 0.6 });
    return { steel, alu, wood, fitting, netting, wire, concrete, orange, yellow, tarp, rubble, sand, slate, black, felt, cabin, cabinRoof, paper, sign, warning };
  }

  _build() {
    this.built = true;
    const M = (this.M = this._materials());
    const R0 = rng(11);
    const g = this.group;
    const groundAt = this.ground;

    const tubes = new Batch(new THREE.CylinderGeometry(R, R, 1, 10), M.steel);
    const rungs = new Batch(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), M.alu);
    const boards = new Batch(new THREE.BoxGeometry(1, 1, 1), M.wood);
    const fittings = new Batch(new THREE.BoxGeometry(1, 1, 1), M.fitting);
    const stiles = new Batch(new THREE.BoxGeometry(1, 1, 1), M.alu);
    const concrete = new Batch(new THREE.BoxGeometry(1, 1, 1), M.concrete);
    const steelTint = () => new THREE.Color().setHSL(0.08, 0.1 + R0() * 0.2, 0.52 + R0() * 0.22);
    const rustTint = () => new THREE.Color().setHSL(0.06, 0.45, 0.33 + R0() * 0.12);
    const tint = () => (R0() < 0.18 ? rustTint() : steelTint());
    const tube = (a, b, r = R) => tubes.add(tubeMatrix(a, b, r), tint());
    const board = (c, size, rotY = 0, rotZ = 0, rotX = 0) => boards.add(boxMatrix(c, size, rotY, rotZ, rotX));
    const coupler = (c, along = 'x') => fittings.add(boxMatrix(c, along === 'x' ? [0.1, 0.07, 0.075] : [0.075, 0.07, 0.1]));

    const xs = Array.from({ length: BAYS + 1 }, (_, i) => X0 + i * BAY);
    const feet = xs.flatMap((x) => [Z_IN, Z_OUT].map((z) => ({ x, z, y: groundAt(x, z) })));

    // standards, on base plates on sole boards
    for (const f of feet) {
      board([f.x, f.y + BOARD.t / 2, f.z], [0.5, BOARD.t, BOARD.w]);
      fittings.add(boxMatrix([f.x, f.y + BOARD.t + 0.004, f.z], [0.15, 0.008, 0.15]));
      tube([f.x, f.y + BOARD.t + 0.008, f.z], [f.x, TOP, f.z]);
      // a sleeve coupler where two tubes join
      tubes.add(tubeMatrix([f.x, 6.25, f.z], [f.x, 6.4, f.z], R * 1.35), new THREE.Color(0.35, 0.35, 0.36));
      this.obstacles.push({ x: f.x, z: f.z, r: 0.14, when: () => this.on });
    }

    for (const L of LIFTS) {
      const yLedger = L - BOARD.t - 2 * R - R; // under the transoms
      const yTransom = L - BOARD.t - R;
      // ledgers along the rows, guard rails along the outer row and the ends
      for (const z of [Z_IN, Z_OUT]) {
        tube([X0 - 0.15, yLedger, z], [X1 + 0.15, yLedger, z]);
        for (const x of xs) coupler([x, yLedger, z + (z === Z_OUT ? 0.045 : -0.045)]);
      }
      for (const yRail of [L + 0.5, L + 1.0]) {
        tube([X0 - 0.15, yRail, Z_OUT], [X1 + 0.15, yRail, Z_OUT]);
        for (const x of xs) coupler([x, yRail, Z_OUT + 0.045]);
        for (const x of [X0, X1]) {
          tube([x, yRail, Z_IN - 0.1], [x, yRail, Z_OUT + 0.1]);
          coupler([x + (x === X0 ? -0.045 : 0.045), yRail, Z_IN], 'z');
          coupler([x + (x === X0 ? -0.045 : 0.045), yRail, Z_OUT], 'z');
        }
        if (L === LIFTS[LIFTS.length - 1]) {
          // the top lift: a rail on the inner side too, the wall being a stride away
          tube([X0 - 0.15, yRail, Z_IN], [X1 + 0.15, yRail, Z_IN]);
          for (const x of xs) coupler([x, yRail, Z_IN - 0.045]);
        }
      }
      // transoms, with an inside board's worth of hop-up (except where the chimney breast is)
      for (let k = 0; k <= BAYS * 2; k++) {
        const x = X0 + (k * BAY) / 2;
        const inBreast = x > BREAST.x0 - 0.15 && x < BREAST.x1 + 0.15;
        tube([x, yTransom, inBreast ? BREAST.z + 0.06 : Z_IN - 0.46], [x, yTransom, Z_OUT + 0.12]);
      }
      // the boards: four across each bay, and one inside board on the hop-ups
      for (let b = 0; b < BAYS; b++) {
        const xa = xs[b] + 0.03;
        const xb = xs[b + 1] - 0.03;
        for (let i = 0; i < 4; i++) {
          const z = Z_IN + 0.075 + BOARD.w / 2 + i * (BOARD.w + 0.0025);
          let xEnd = xb;
          if (b === LADDER_BAY && i >= 2) xEnd = xb - HATCH; // the ladder's hatch
          board([(xa + xEnd) / 2, L - BOARD.t / 2, z], [xEnd - xa, BOARD.t, BOARD.w]);
        }
        // the inside board, in two parts round the chimney breast
        const zi = Z_IN - 0.06 - BOARD.w / 2;
        const cut = [BREAST.x0 - 0.1, BREAST.x1 + 0.1];
        const parts = [];
        if (xb <= cut[0] || xa >= cut[1]) parts.push([xa, xb]);
        else {
          if (cut[0] - xa > 0.3) parts.push([xa, cut[0]]);
          if (xb - cut[1] > 0.3) parts.push([cut[1], xb]);
        }
        for (const [p, q] of parts) board([(p + q) / 2, L - BOARD.t / 2, zi], [q - p, BOARD.t, BOARD.w]);
        // toe boards along the outer edge, on edge
        board([(xa + xb) / 2, L + BOARD.w / 2, Z_OUT - 0.06], [xb - xa, BOARD.w, BOARD.t]);
      }
      // toe boards across the ends
      for (const x of [X0 + 0.06, X1 - 0.06]) board([x, L + BOARD.w / 2, (Z_IN + Z_OUT) / 2], [BOARD.t, BOARD.w, Z_OUT - Z_IN - 0.1]);
    }

    // façade bracing on the outer face: a zig-zag up the two end bays; ledger bracing at the ends
    const brace = (bay) => {
      let x = xs[bay];
      let y = groundAt(x, Z_OUT) + 0.35;
      for (const L of LIFTS) {
        const xTo = x === xs[bay] ? xs[bay + 1] : xs[bay];
        tube([x, y, Z_OUT + 0.055], [xTo, L - 0.13, Z_OUT + 0.055]);
        coupler([x, y, Z_OUT + 0.055]);
        x = xTo;
        y = L - 0.13;
      }
    };
    brace(0);
    brace(BAYS - 1);
    for (const x of [X0, X1]) {
      let z = Z_OUT;
      let y = groundAt(x, z) + 0.35;
      for (const L of LIFTS) {
        const zTo = z === Z_OUT ? Z_IN : Z_OUT;
        const dx = x === X0 ? -0.055 : 0.055;
        tube([x + dx, y, z], [x + dx, L - 0.13, zTo]);
        z = zTo;
        y = L - 0.13;
      }
    }

    // ladders: one from the ground, then one between each pair of lifts, through the hatch
    const ladder = (yFoot, yTop, xTop, z) => {
      const rise = yTop - yFoot;
      const run = rise * Math.tan(THREE.MathUtils.degToRad(15));
      const len = Math.hypot(rise, run) + 1.05;
      const dir = new THREE.Vector3(run, rise, 0).normalize();
      const foot = new THREE.Vector3(xTop - run, yFoot, z);
      const mid = foot.clone().addScaledVector(dir, len / 2);
      const angle = Math.atan2(run, rise); // lean, about z
      for (const dz of [-0.17, 0.17]) stiles.add(boxMatrix([mid.x, mid.y, mid.z + dz], [0.035, len, 0.08], 0, -angle));
      const n = Math.floor(len / 0.28);
      for (let i = 1; i < n; i++) {
        const p = foot.clone().addScaledVector(dir, i * 0.28);
        rungs.add(tubeMatrix([p.x, p.y, p.z - 0.17], [p.x, p.y, p.z + 0.17], 0.014));
      }
    };
    {
      const xTop = xs[LADDER_BAY + 1] - 0.3;
      const z = Z_IN + 0.075 + BOARD.w / 2 + 2.5 * (BOARD.w + 0.0025); // the hatch's middle
      let yFoot = groundAt(xTop, Z_OUT + 1.5);
      for (const L of LIFTS) {
        ladder(yFoot, L, xTop, z);
        yFoot = L;
      }
    }

    // debris netting over the outer face and the ends, from the first lift to the top
    {
      const h = TOP - (LIFTS[0] - 0.25);
      const yMid = (TOP + LIFTS[0] - 0.25) / 2;
      const w = X1 - X0 + 0.3;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.netting);
      face.material.map.repeat.set(w * 2.2, h * 2.2);
      face.position.set((X0 + X1) / 2, yMid, Z_OUT + 0.07);
      face.castShadow = false;
      face.receiveShadow = true;
      g.add(face);
      for (const x of [X0 - 0.07, X1 + 0.07]) {
        const end = new THREE.Mesh(new THREE.PlaneGeometry(Z_OUT - Z_IN + 0.3, h), M.netting);
        end.rotation.y = Math.PI / 2;
        end.position.set(x, yMid, (Z_IN + Z_OUT) / 2);
        end.castShadow = false;
        g.add(end);
      }
      // the warning board tied to the netting at the first lift
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), M.warning);
      sign.position.set(X0 + 1.2, LIFTS[0] + 0.72, Z_OUT + 0.085);
      g.add(sign);
    }

    // the gin wheel at the west end of the top lift, its rope and bucket
    {
      const yArm = TOP - 0.05;
      tube([X0, yArm, Z_OUT - 0.3], [X0, yArm, Z_OUT + 0.95]);
      coupler([X0, yArm, Z_OUT - 0.045], 'z');
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), M.fitting);
      wheel.position.set(X0, yArm - 0.16, Z_OUT + 0.9);
      wheel.castShadow = true;
      g.add(wheel);
      fittings.add(boxMatrix([X0, yArm - 0.08, Z_OUT + 0.9], [0.03, 0.16, 0.03]));
      const rope = new THREE.MeshStandardMaterial({ color: 0xcfc3a3, roughness: 1 });
      const ropes = new Batch(new THREE.CylinderGeometry(R, R, 1, 6), rope, { shadow: false });
      const gY = groundAt(X0, Z_OUT + 1.0);
      ropes.add(tubeMatrix([X0 - 0.09, yArm - 0.16, Z_OUT + 0.9], [X0 - 0.09, gY + 1.35, Z_OUT + 0.95], 0.006));
      ropes.add(tubeMatrix([X0 + 0.09, yArm - 0.16, Z_OUT + 0.9], [X0 + 0.1, LIFTS[3] + 0.52, Z_OUT + 0.12], 0.006));
      g.add(ropes.build('ropes'));
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 14, 1, true), M.black);
      bucket.position.set(X0 - 0.09, gY + 1.05, Z_OUT + 0.95);
      bucket.castShadow = true;
      g.add(bucket);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 16, Math.PI), M.fitting);
      handle.position.copy(bucket.position).y += 0.15;
      g.add(handle);
    }

    // the rubbish chute from the east end of the top lift down into the skip, and the skip
    // (the skip stands under the scaffold's east end, so the chute hangs nearly straight)
    const skipAt = new THREE.Vector3(8.9, groundAt(8.9, -8.6), -8.6);
    {
      const cx = X1 - 1.4; // (west of the ladders)
      const top = new THREE.Vector3(cx, LIFTS[3] + 0.25, Z_OUT + 0.42);
      const bottom = new THREE.Vector3(skipAt.x + 0.2, skipAt.y + 1.65, skipAt.z - 0.15);
      // its frame: two tubes from the top lift's rails
      tube([cx, LIFTS[3] + 1.0, Z_OUT], [cx, LIFTS[3] + 0.9, Z_OUT + 0.5]);
      tube([cx, LIFTS[3] + 0.5, Z_OUT], [cx, LIFTS[3] + 0.6, Z_OUT + 0.5]);
      const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.23, 0.5, 14, 1, true), M.orange);
      hopper.position.copy(top).y += 0.3;
      g.add(hopper);
      const dir = bottom.clone().sub(top);
      const len = dir.length();
      dir.normalize();
      const sections = new Batch(new THREE.CylinderGeometry(0.18, 0.23, 1.1, 14, 1, true), M.orange);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      const n = Math.ceil(len / 1.0);
      for (let i = 0; i < n; i++) {
        const p = top.clone().addScaledVector(dir, 0.5 + i * 1.0);
        sections.add(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
      }
      const chute = sections.build('chute');
      g.add(chute);
      // the chain it hangs from
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 5), M.fitting);
      chain.position.copy(top).add(bottom).multiplyScalar(0.5);
      chain.quaternion.setFromUnitVectors(Y, dir.clone().negate());
      g.add(chain);
      for (const m of [hopper, chute]) m.castShadow = true;
    }
    this._skip(skipAt, M);

    // the site compound on the forecourt
    this._fence(M, tubes, fittings, concrete);
    this._yard(M, skipAt);

    // the roof: a stretch stripped to the battens behind the battlements, under a tarpaulin, and
    // the new slates stacked on the top lift
    this._roof(M);
    {
      for (const [x, z] of [
        [8.1, Z_IN + 0.35],
        [8.5, Z_IN + 0.35],
        [8.3, Z_IN + 0.78],
      ]) {
        const stack = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.13, 0.42), M.slate);
        stack.position.set(x, LIFTS[3] + 0.065, z);
        stack.rotation.y = (R0() - 0.5) * 0.2;
        stack.castShadow = true;
        g.add(stack);
      }
      const felt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 12), M.black);
      felt.rotation.z = Math.PI / 2;
      felt.position.set(3.0, LIFTS[3] + 0.1, Z_IN + 0.4);
      felt.castShadow = true;
      g.add(felt);
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 14, 1, true), M.black);
      pail.position.set(4.3, LIFTS[1] + 0.15, Z_OUT - 0.35);
      g.add(pail);
      // a few loose boards left on the second lift
      board([2.9, LIFTS[1] + BOARD.t / 2, Z_IN + 0.5], [2.3, BOARD.t, BOARD.w], 0.06);
      board([2.95, LIFTS[1] + BOARD.t * 1.5, Z_IN + 0.52], [2.1, BOARD.t, BOARD.w], -0.03);
    }

    g.add(tubes.build('tubes'), rungs.build('rungs'), boards.build('boards'), fittings.build('fittings'), stiles.build('stiles'), concrete.build('blocks'));
  }

  /** The skip: yellow, its ends sloping out, rubble in it. */
  _skip(at, M) {
    const g = this.group;
    const shape = new THREE.Shape();
    shape.moveTo(-1.35, 0);
    shape.lineTo(1.35, 0);
    shape.lineTo(1.8, 1.25);
    shape.lineTo(-1.8, 1.25);
    shape.closePath();
    // open at the top: two trapezoid sides, two sloping ends, a floor
    const side = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    for (const dz of [-0.85, 0.8]) {
      const wall = new THREE.Mesh(side, M.yellow);
      wall.position.set(at.x, at.y, at.z + dz);
      wall.castShadow = wall.receiveShadow = true;
      g.add(wall);
    }
    const slope = Math.hypot(0.45, 1.25);
    for (const sgn of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.05, slope, 1.7), M.yellow);
      end.position.set(at.x + sgn * 1.575, at.y + 0.625, at.z);
      end.rotation.z = -sgn * Math.atan2(0.45, 1.25);
      end.castShadow = end.receiveShadow = true;
      g.add(end);
    }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 1.7), M.yellow);
    floor.position.set(at.x, at.y + 0.03, at.z);
    g.add(floor);
    // rubble heaped in it, a few broken slates and ends of timber
    const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.rubble);
    heap.scale.set(1.5, 0.55, 0.7);
    heap.position.copy(at).y += 0.9;
    heap.castShadow = true;
    g.add(heap);
    const bits = new Batch(new THREE.BoxGeometry(1, 1, 1), M.slate);
    const R1 = rng(5);
    for (let i = 0; i < 14; i++) bits.add(boxMatrix([at.x + (R1() - 0.5) * 2.6, at.y + 1.0 + R1() * 0.5, at.z + (R1() - 0.5) * 1.2], [0.3, 0.015, 0.25 + R1() * 0.2], R1() * 3, (R1() - 0.5) * 1.2, (R1() - 0.5) * 1.0));
    g.add(bits.build('broken slates'));
    const timbers = new Batch(new THREE.BoxGeometry(1, 1, 1), M.wood);
    timbers.add(boxMatrix([at.x - 0.6, at.y + 1.4, at.z + 0.2], [2.4, 0.05, 0.1], 0.3, 0.35));
    timbers.add(boxMatrix([at.x + 0.4, at.y + 1.35, at.z - 0.3], [1.9, 0.05, 0.1], -0.4, 0.5));
    g.add(timbers.build('timber ends'));
    // lifting lugs and the skip's chains
    const lugs = new Batch(new THREE.BoxGeometry(1, 1, 1), M.fitting);
    for (const [dx, dz] of [
      [-1.3, -0.9],
      [1.3, -0.9],
      [-1.3, 0.9],
      [1.3, 0.9],
    ])
      lugs.add(boxMatrix([at.x + dx, at.y + 1.05, at.z + dz], [0.16, 0.25, 0.04]));
    g.add(lugs.build('lugs'));
    for (const dx of [-1.0, 1.0]) this.obstacles.push({ x: at.x + dx, z: at.z, r: 1.0, when: () => this.on });
    this.obstacles.push({ x: at.x, z: at.z, r: 1.0, when: () => this.on });
  }

  /** Temporary fencing round the compound: panels on concrete feet, the site sign on one. */
  _fence(M, tubes, fittings, concrete) {
    const g = this.group;
    const groundAt = this.ground;
    const panels = [];
    for (let x = FENCE_X0; x + PANEL <= FENCE_X1 + 0.01; x += PANEL) panels.push([[x, FENCE_Z], [x + PANEL, FENCE_Z]]);
    const endX = FENCE_X0 + panels.length * PANEL;
    panels.push([[endX, FENCE_Z], [endX, FENCE_Z - PANEL]]); // the return towards the house
    const wireGeo = new THREE.PlaneGeometry(PANEL - 0.1, 1.9);
    for (const [[xa, za], [xb, zb]] of panels) {
      const y0 = Math.max(groundAt(xa, za), groundAt(xb, zb)) + 0.18;
      const dir = new THREE.Vector3(xb - xa, 0, zb - za);
      const len = dir.length();
      dir.normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      // the frame
      tubes.add(tubeMatrix([xa, y0, za], [xa, y0 + 2.0, za], 0.021));
      tubes.add(tubeMatrix([xb, y0, zb], [xb, y0 + 2.0, zb], 0.021));
      tubes.add(tubeMatrix([xa, y0 + 2.0, za], [xb, y0 + 2.0, zb], 0.021));
      tubes.add(tubeMatrix([xa, y0 + 0.02, za], [xb, y0 + 0.02, zb], 0.021));
      const mx = (xa + xb) / 2;
      const mz = (za + zb) / 2;
      tubes.add(tubeMatrix([mx, y0, mz], [mx, y0 + 2.0, mz], 0.016));
      // the mesh
      const wire = new THREE.Mesh(wireGeo, M.wire);
      wire.material.map.repeat.set(PANEL / 0.3, 1.9 / 0.1);
      wire.position.set(mx, y0 + 1.0, mz);
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), side);
      wire.castShadow = false;
      g.add(wire);
      // feet at each end (shared where panels meet) and a clamp joining them
      for (const [x, z] of [
        [xa, za],
        [xb, zb],
      ]) {
        const gy = groundAt(x, z);
        concrete.add(boxMatrix([x, gy + 0.08, z], [0.7, 0.16, 0.22], Math.atan2(dir.x, dir.z))); // (the foot across the line of the panels)
        fittings.add(boxMatrix([x, y0 + 1.6, z], [0.08, 0.1, 0.08]));
        fittings.add(boxMatrix([x, y0 + 0.5, z], [0.08, 0.1, 0.08]));
      }
      // walking: a few posts' worth of obstacle along the panel
      for (let s = 0; s <= len; s += 0.45) this.obstacles.push({ x: xa + dir.x * s, z: za + dir.z * s, r: 0.22, when: () => this.on });
    }
    // the site sign on the second panel, facing the drive
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), M.sign);
    sign.position.set(FENCE_X0 + PANEL * 1.5, groundAt(FENCE_X0 + PANEL * 1.5, FENCE_Z) + 1.25, FENCE_Z + 0.04);
    sign.castShadow = true;
    g.add(sign);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), M.paper);
    back.position.copy(sign.position).z -= 0.03;
    back.rotation.y = Math.PI;
    g.add(back);
  }

  /** What stands about the yard: the mixer, the sand, the pallets, the site cabin, the cones. */
  _yard(M, skipAt) {
    const g = this.group;
    const groundAt = this.ground;
    const obstacle = (x, z, r) => this.obstacles.push({ x, z, r, when: () => this.on });

    // the cement mixer: an orange drum tilted on its stand, two wheels, a tow bar
    {
      const at = new THREE.Vector3(13.3, groundAt(13.3, -6.3), -6.3);
      const mixer = new THREE.Group();
      mixer.position.copy(at);
      mixer.rotation.y = -0.6;
      // the drum: a bell, its mouth at the top
      const pts = [
        [0.0, 0],
        [0.14, 0],
        [0.36, 0.1],
        [0.45, 0.34],
        [0.43, 0.55],
        [0.33, 0.7],
        [0.27, 0.8],
      ].map(([r, y]) => new THREE.Vector2(r, y));
      const drum = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), new THREE.MeshStandardMaterial({ color: 0xe8661a, roughness: 0.55, side: THREE.DoubleSide }));
      drum.rotation.z = -0.65;
      drum.position.set(0.1, 0.78, 0);
      drum.castShadow = true;
      mixer.add(drum);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.5), M.orange);
      frame.position.set(0, 0.45, 0);
      frame.castShadow = true;
      mixer.add(frame);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), M.fitting);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(0, 0.22, 0);
      mixer.add(axle);
      for (const dz of [-0.42, 0.42]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), M.black);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(0, 0.22, dz);
        wheel.castShadow = true;
        mixer.add(wheel);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), M.orange);
      bar.rotation.z = 1.25;
      bar.position.set(0.45, 0.2, 0);
      mixer.add(bar);
      g.add(mixer);
      obstacle(at.x, at.z, 0.6);
    }
    // the sand heap, with a shovel stuck in it
    {
      const at = new THREE.Vector3(11.4, groundAt(11.4, -6.7), -6.7);
      const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.sand);
      heap.scale.set(1.1, 0.55, 0.95);
      heap.position.copy(at);
      heap.castShadow = heap.receiveShadow = true;
      g.add(heap);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), M.wood);
      shaft.position.set(at.x + 0.3, at.y + 0.85, at.z - 0.1);
      shaft.rotation.set(0.25, 0, -0.35);
      g.add(shaft);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.01), M.fitting);
      blade.position.set(at.x + 0.12, at.y + 0.42, at.z - 0.14);
      blade.rotation.set(0.25, 0.5, -0.35);
      g.add(blade);
      obstacle(at.x, at.z, 0.9);
    }
    // two pallets by the gable: one of slates under a tarpaulin, one of bagged cement
    const pallet = (x, z, load) => {
      const y = groundAt(x, z);
      const p = new THREE.Group();
      p.position.set(x, y, z);
      p.rotation.y = (Math.random() - 0.5) * 0.3;
      const slats = new Batch(new THREE.BoxGeometry(1, 1, 1), M.wood);
      for (let i = 0; i < 5; i++) slats.add(boxMatrix([0, 0.13, -0.45 + i * 0.225], [1.2, 0.02, 0.1]));
      for (const dx of [-0.5, 0, 0.5]) slats.add(boxMatrix([dx, 0.06, 0], [0.1, 0.1, 1.0]));
      for (const dx of [-0.5, 0, 0.5]) slats.add(boxMatrix([dx, 0.005, 0], [0.1, 0.01, 1.0]));
      p.add(slats.build('pallet'));
      if (load === 'slates') {
        const stack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.9), M.slate);
        stack.position.y = 0.14 + 0.375;
        stack.castShadow = true;
        p.add(stack);
        const tarp = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.5, 1.06), M.tarp);
        tarp.position.y = 0.14 + 0.75 - 0.22;
        tarp.castShadow = true;
        p.add(tarp);
        const tarpTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 1.1), M.tarp);
        tarpTop.position.y = 0.14 + 0.75 + 0.02;
        p.add(tarpTop);
      } else {
        const bags = new Batch(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), M.paper);
        for (let layer = 0; layer < 4; layer++)
          for (let i = 0; i < 4; i++) {
            const along = layer % 2 === 0;
            const c = along ? [-0.36 + i * 0.24, 0.14 + 0.11 + layer * 0.2, 0] : [0, 0.14 + 0.11 + layer * 0.2, -0.36 + i * 0.24];
            bags.add(boxMatrix(c, [1, 1, 1], 0, along ? Math.PI / 2 : 0, along ? 0 : Math.PI / 2));
          }
        p.add(bags.build('cement'));
      }
      p.traverse((o) => o.isMesh && (o.castShadow = true));
      g.add(p);
      obstacle(x, z, 0.8);
    };
    pallet(12.6, -9.4, 'slates');
    pallet(14.0, -9.4, 'cement');
    // the site cabin by the porch end of the compound, its door to the yard
    {
      const at = new THREE.Vector3(2.0, groundAt(2.0, -5.6), -5.6);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.3, 1.2), M.cabin);
      cabin.position.copy(at).y += 1.15;
      cabin.castShadow = cabin.receiveShadow = true;
      g.add(cabin);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 1.3), M.cabinRoof);
      roof.position.copy(at).y += 2.33;
      roof.castShadow = true;
      g.add(roof);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.9), new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.6 }));
      door.position.set(at.x + 0.58, at.y + 1.05, at.z);
      door.rotation.y = Math.PI / 2;
      g.add(door);
      const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), M.black);
      vent.position.set(at.x + 0.58, at.y + 2.05, at.z + 0.3);
      vent.rotation.y = Math.PI / 2;
      g.add(vent);
      obstacle(at.x, at.z, 0.85);
    }
    // cones at the compound's entrance by the gable
    for (const [x, z] of [
      [15.4, -8.4],
      [15.4, -10.0],
      [7.0, FENCE_Z + 0.5],
    ]) {
      const y = groundAt(x, z);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.17, 0.7, 12), M.orange);
      cone.position.set(x, y + 0.36, z);
      cone.castShadow = true;
      g.add(cone);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), M.black);
      base.position.set(x, y + 0.015, z);
      g.add(base);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.125, 0.16, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
      band.position.set(x, y + 0.42, z);
      g.add(band);
      obstacle(x, z, 0.25);
    }
    // a wheelbarrow by the skip, tipped up against it
    {
      const at = new THREE.Vector3(skipAt.x - 2.4, groundAt(skipAt.x - 2.4, skipAt.z + 1.0), skipAt.z + 1.0);
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.3, 8, 1, false), M.orange);
      tray.scale.set(1, 1, 0.65);
      tray.rotation.set(-0.5, 0.3, 0);
      tray.position.copy(at).y += 0.46;
      tray.castShadow = true;
      g.add(tray);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14), M.black);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(at.x - 0.35, at.y + 0.17, at.z);
      g.add(wheel);
      for (const dz of [-0.22, 0.22]) {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 6), M.fitting);
        handle.rotation.z = 1.05;
        handle.position.set(at.x + 0.25, at.y + 0.45, at.z + dz);
        g.add(handle);
      }
      obstacle(at.x, at.z, 0.5);
    }
  }

  /** The roof behind the battlements: a stretch stripped to the battens, half of it under a tarpaulin. */
  _roof(M) {
    const g = this.group;
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    const roofAt = (x, z) => {
      ray.origin.set(x, 30, z);
      const h = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
      return h && h.point.y > 6 ? h.point.y : null;
    };
    const sheet = (x0, x1, z0, z1, lift, material, { nx = 8, nz = 10, wave = 0 } = {}) => {
      const geo = new THREE.PlaneGeometry(1, 1, nx, nz);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const x = x0 + (x1 - x0) * u;
        const z = z0 + (z1 - z0) * v;
        let y = roofAt(x, z);
        if (y === null) y = roofAt(x, z - 0.05) ?? roofAt(x, z + 0.05) ?? 8.5;
        y += lift + (wave ? Math.sin(u * 19 + v * 7) * wave + Math.cos(v * 23) * wave * 0.6 : 0);
        pos.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = mesh.receiveShadow = true;
      return mesh;
    };
    // the stripped stretch: felt and battens, from near the gutter up to the ridge
    const stripped = sheet(6.6, 8.95, -13.35, -14.9, 0.03, M.felt);
    stripped.material.map.repeat.set(2.35, 1.55);
    stripped.material.map.wrapS = stripped.material.map.wrapT = THREE.RepeatWrapping;
    stripped.material.map.needsUpdate = true;
    g.add(stripped);
    // the tarpaulin over its west half, from the gutter to the ridge, weighted down with slates
    const tarp = sheet(6.45, 7.95, -13.3, -14.95, 0.09, M.tarp, { wave: 0.025 });
    g.add(tarp);
    const weights = new Batch(new THREE.BoxGeometry(1, 1, 1), M.slate);
    for (const [x, z] of [
      [6.6, -13.45],
      [7.8, -13.45],
      [6.6, -14.8],
      [7.8, -14.8],
      [7.2, -14.85],
      [7.85, -14.1],
    ]) {
      const y = roofAt(x, z);
      if (y !== null) weights.add(boxMatrix([x, y + 0.17, z], [0.3, 0.03, 0.36], 0.1, 0, 0.94));
    }
    g.add(weights.build('weights'));
    // the roofers' ladder up the slope beside it, hooked over the ridge
    {
      const lx = 9.3;
      const z0 = -13.3;
      const z1 = -15.05;
      const y0 = (roofAt(lx, z0) ?? 7.6) + 0.12;
      const y1 = (roofAt(lx, z1) ?? 10.1) + 0.12;
      const len = Math.hypot(z1 - z0, y1 - y0);
      const dir = new THREE.Vector3(0, y1 - y0, z1 - z0).normalize();
      const mid = new THREE.Vector3(lx, (y0 + y1) / 2, (z0 + z1) / 2);
      const angle = Math.atan2(z1 - z0, y1 - y0); // its lean, about x (towards -z, up the slope)
      const stiles = new Batch(new THREE.BoxGeometry(1, 1, 1), M.alu);
      for (const dx of [-0.17, 0.17]) stiles.add(boxMatrix([mid.x + dx, mid.y, mid.z], [0.035, len, 0.08], 0, 0, angle));
      g.add(stiles.build('roof ladder'));
      const rungs = new Batch(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), M.alu);
      const foot = new THREE.Vector3(lx, y0, z0);
      for (let s = 0.2; s < len; s += 0.28) {
        const p = foot.clone().addScaledVector(dir, s);
        rungs.add(tubeMatrix([p.x - 0.17, p.y, p.z], [p.x + 0.17, p.y, p.z], 0.014));
      }
      g.add(rungs.build('roof ladder rungs'));
    }
  }
}
