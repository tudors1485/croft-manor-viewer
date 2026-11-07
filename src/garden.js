// The garden, as TRJTA planted it in his renders: clipped hedges along the low wall at the back
// and round the path into the assault course; shrub borders inside the walls; long grass in the
// course and at the foot of the walls; small leafy plants outside the front wall by the gate;
// clipped evergreens (cones by the front door, tiered balls by the kitchen door, a column at the
// corner); chairs, a clipped bay and a potted plant on the terrace; the trolley on the zip line;
// and smoke from the chimneys on cold days.
//
// Everything leafy here is cards: small pictures of leaves, each a pair of crossed quads, set over a
// shape (a ball, a cone, a hedge) with their light leaning out from the shape's middle and darker
// deep inside it (as the trees' crowns: landscape.js). A clipped shape also has a solid core in
// the same leaves, so it never shows daylight through it.

import * as THREE from 'three';
import { addTreeShader } from './landscape.js';
import { Particles } from './bonfire.js';
import { seasonUniforms } from './season.js';

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

// --- pictures ---------------------------------------------------------------------------------

const GREENS = ['#1f3a14', '#28481a', '#2f5520', '#3a6326', '#46722c', '#557f33', '#668f3c', '#7a9e48'];

/** Small leaves, densely: a clipped hedge's face (tiling), or a clump with a ragged edge (alpha). */
function leavesPicture({ size = 512, count = 3200, len = [9, 15], tile = true, clump = false, seed = 7, palette = GREENS, bg = '#17300f' } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = rng(seed);
  if (!clump) {
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
  }
  const leaf = (x, y, l, w, a, col, light) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(0, 0, l / 2, w / 2, 0, 0, Math.PI * 2);
    g.fill();
    // a lit edge and a midrib
    g.strokeStyle = light;
    g.lineWidth = Math.max(1, w * 0.18);
    g.beginPath();
    g.moveTo(-l * 0.4, 0);
    g.lineTo(l * 0.4, 0);
    g.stroke();
    g.restore();
  };
  for (let i = 0; i < count; i++) {
    let x = R() * size;
    let y = R() * size;
    if (clump) {
      // a ragged round clump, thinning to its edge
      const a = R() * Math.PI * 2;
      const r = Math.pow(R(), 0.7) * size * 0.46;
      x = size / 2 + Math.cos(a) * r;
      y = size / 2 + Math.sin(a) * r;
    }
    const l = len[0] + R() * (len[1] - len[0]);
    const k = Math.min(palette.length - 1, Math.floor(Math.pow(R(), 0.8) * palette.length));
    // (later leaves sit on top: the lighter, outer ones last)
    const col = palette[Math.min(palette.length - 1, Math.floor((k + (i / count) * palette.length) / 2))];
    const light = palette[Math.min(palette.length - 1, k + 2)];
    const a = R() * Math.PI;
    const w = l * (0.45 + R() * 0.2);
    for (const dx of tile ? [-size, 0, size] : [0]) for (const dy of tile ? [-size, 0, size] : [0]) leaf(x + dx, y + dy, l, w, a, col, light);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (tile) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A tuft of long grass: blades fanning up from the ground, straw at the tips. */
function grassPicture(seed = 3) {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d');
  const R = rng(seed);
  for (let i = 0; i < 150; i++) {
    const x0 = W * (0.22 + R() * 0.56);
    const h = W * (0.35 + R() * 0.62);
    const lean = (R() - 0.5) * W * 0.6;
    const w = 0.8 + R() * 1.6;
    const shade = R();
    const grd = g.createLinearGradient(0, W, 0, W - h);
    grd.addColorStop(0, `rgb(${58 + shade * 20}, ${84 + shade * 22}, ${30 + shade * 10})`);
    grd.addColorStop(0.55, `rgb(${108 + shade * 34}, ${138 + shade * 30}, ${52 + shade * 14})`);
    grd.addColorStop(1, `rgb(${176 + shade * 40}, ${178 + shade * 28}, ${104 + shade * 20})`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x0 - w, W);
    g.quadraticCurveTo(x0 + lean * 0.3, W - h * 0.6, x0 + lean, W - h);
    g.quadraticCurveTo(x0 + lean * 0.3 + w * 0.6, W - h * 0.6, x0 + w, W);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A low leafy plant (hosta, hellebore): broad leaves in a rosette, seen from the side. */
function rosettePicture(seed = 5) {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d');
  const R = rng(seed);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.92 + (i / (n - 1)) * Math.PI * 0.84 + (R() - 0.5) * 0.25;
    const l = W * (0.3 + R() * 0.17);
    const tone = R();
    g.save();
    g.translate(W / 2, W * 0.98);
    g.rotate(a + Math.PI / 2);
    g.fillStyle = `rgb(${70 + tone * 50}, ${120 + tone * 50}, ${40 + tone * 25})`;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(l * 0.32, -l * 0.55, 0, -l);
    g.quadraticCurveTo(-l * 0.32, -l * 0.55, 0, 0);
    g.fill();
    g.strokeStyle = `rgba(200, 230, 150, 0.6)`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -l * 0.05);
    g.lineTo(0, -l * 0.9);
    g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A long paddle leaf (a bird of paradise, a banana), for the terrace's pot. */
function paddlePicture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 128, 0);
  grd.addColorStop(0, '#2c5a22');
  grd.addColorStop(0.5, '#5f9a3e');
  grd.addColorStop(1, '#2c5a22');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(64, 0);
  g.bezierCurveTo(128, 120, 124, 380, 64, 512);
  g.bezierCurveTo(4, 380, 0, 120, 64, 0);
  g.fill();
  g.strokeStyle = '#b9d98a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 10);
  g.lineTo(64, 505);
  g.stroke();
  g.strokeStyle = 'rgba(30, 60, 20, 0.35)';
  g.lineWidth = 1;
  for (let y = 30; y < 500; y += 9) {
    g.beginPath();
    g.moveTo(64, y);
    g.lineTo(10, y - 22);
    g.moveTo(64, y);
    g.lineTo(118, y - 22);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A puff of smoke: dense in the middle, fading away to nothing with no edge, a little lumpy. */
function puffPicture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const R = rng(9);
  const lumps = Array.from({ length: 7 }, () => [S / 2 + (R() - 0.5) * S * 0.35, S / 2 + (R() - 0.5) * S * 0.35, S * (0.16 + R() * 0.12)]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let a = 0;
      for (const [lx, ly, lr] of lumps) a += Math.exp(-((x - lx) ** 2 + (y - ly) ** 2) / (2 * lr * lr));
      const r = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      a = Math.min(1, a * 0.45) * Math.max(0, 1 - r * r);
      const k = (y * S + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- shapes made of cards ---------------------------------------------------------------------

/**
 * Cards over a shape. `place(R)` returns { p, out, occ } for one card: where it is, which way is
 * out (its light), and how deep in the shape it is (1 outside, darker inside). Each card is two
 * crossed quads, randomly turned.
 */
function cardsGeometry(count, size, place, seed, { tall = 1, upright = false } = {}) {
  const R = rng(seed);
  const pos = [];
  const nor = [];
  const uv = [];
  const occ = [];
  const leafSeed = [];
  const idx = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const { p, out, occ: o } = place(R);
    const s = size * (0.75 + R() * 0.5);
    e.set(upright ? (R() - 0.5) * 0.3 : R() * Math.PI, R() * Math.PI * 2, upright ? (R() - 0.5) * 0.3 : R() * Math.PI);
    q.setFromEuler(e);
    const seedValue = R();
    for (const turn of [0, Math.PI / 2]) {
      const base = pos.length / 3;
      for (const [cx, cy] of corners) {
        v.set(cx * s * Math.cos(turn), (cy + (upright ? 0.5 : 0)) * s * tall, cx * s * Math.sin(turn)).applyQuaternion(q).add(p);
        pos.push(v.x, v.y, v.z);
        nor.push(out.x, out.y, out.z);
        uv.push(cx + 0.5, cy + 0.5);
        occ.push(o);
        leafSeed.push(seedValue);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aOcc', new THREE.Float32BufferAttribute(occ, 1));
  g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(leafSeed, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** A point on (or just in) a ball of radii rx, ry, rz sitting on the ground. */
function ballPlace(rx, ry, rz, y0 = 0, depth = 0.35) {
  const d = new THREE.Vector3();
  return (R) => {
    d.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1);
    while (d.lengthSq() > 1 || d.lengthSq() < 1e-4) d.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1);
    d.normalize();
    const r = 1 - Math.pow(R(), 2.2) * depth; // mostly near the surface
    const p = new THREE.Vector3(d.x * rx * r, y0 + ry + d.y * ry * r, d.z * rz * r);
    const out = new THREE.Vector3(d.x / rx, d.y / ry, d.z / rz).normalize();
    const h = (p.y - y0) / (2 * ry);
    return { p, out, occ: THREE.MathUtils.lerp(0.45, 1, (r - (1 - depth)) / depth) * THREE.MathUtils.lerp(0.7, 1.05, h) };
  };
}

/** A point on a clipped cone, base radius rb, height h. */
function conePlace(rb, h, y0 = 0) {
  return (R) => {
    // (more cards low down, where the cone is wider)
    const t = 1 - Math.sqrt(R());
    const a = R() * Math.PI * 2;
    const r = rb * (1 - t) * (0.92 + R() * 0.1);
    const p = new THREE.Vector3(Math.cos(a) * r, y0 + t * h, Math.sin(a) * r);
    const out = new THREE.Vector3(Math.cos(a), rb / h, Math.sin(a)).normalize();
    return { p, out, occ: THREE.MathUtils.lerp(0.7, 1.05, t) };
  };
}

// --- the garden -------------------------------------------------------------------------------

export class Garden {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('./landscape.js').Landscape} o.landscape
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree (to find walls)
   * @param {{x:number,z:number}} o.gate
   */
  constructor(scene, { landscape, bvh, gate }) {
    this.scene = scene;
    this.landscape = landscape;
    this.bvh = bvh;
    this.gate = gate;
    this.group = new THREE.Group();
    this.group.name = 'Garden';
    scene.add(this.group);
    this.wind = landscape.wind;
    this.obstacles = landscape.obstacles;
    this.stats = { hedge: 0, shrubs: 0, tufts: 0, plants: 0, topiary: 0 };
    this.R = rng(20261107);
    this.time = { value: 0 };
  }

  _ground(x, z) {
    return this.landscape.groundHeight(x, z);
  }

  _lawn(x, z) {
    const y = this._ground(x, z);
    return y !== null && y > -0.25 && y < 0.3 && this.landscape._grassAt(x, z);
  }

  /** Open ground outside the estate (the fields), or null. */
  _field(x, z) {
    const L = this.landscape.lawn;
    if (x > L.min.x - 0.3 && x < L.max.x + 0.3 && z > L.min.z - 0.3 && z < L.max.z + 0.3) return null;
    return this.landscape.hillHeight(x, z);
  }

  /** A leafy material for cards (shared shading with the trees' crowns). */
  _leafMaterial(map, { tint = 0xffffff, height = 2, stiff = 3, alphaTest = 0.45 } = {}) {
    const m = new THREE.MeshStandardMaterial({ map, color: tint, alphaTest, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, envMapIntensity: 0.35 });
    addTreeShader(m, this.wind, { stiff, snow: 'cap', height, crown: true });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest, side: THREE.DoubleSide });
    addTreeShader(depth, this.wind, { stiff });
    return { m, depth };
  }

  _instanced(geo, mats, spots, { cast = true } = {}) {
    const im = new THREE.InstancedMesh(geo, mats.m, spots.length);
    if (mats.depth) im.customDepthMaterial = mats.depth;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach(({ x, y = 0, z, s = 1, sy = s, rot = 0 }, i) => {
      q.setFromAxisAngle(up, rot);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, sy, s));
      im.setMatrixAt(i, m);
    });
    im.castShadow = cast;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.group.add(im);
    return im;
  }

  build() {
    const t0 = performance.now();
    this.pictures = {
      hedge: leavesPicture({ seed: 11 }),
      box: leavesPicture({ size: 256, count: 1100, len: [6, 10], tile: false, clump: true, seed: 13, palette: ['#1b3412', '#22401a', '#2b4f1f', '#355d25', '#41692b', '#4f7833'] }),
      grass: grassPicture(),
      rosette: rosettePicture(),
    };
    this._hedges();
    this._borders();
    this._grass();
    this._smallPlants();
    this._topiary();
    this._trolley();
    this._smoke();
    this.stats.ms = Math.round(performance.now() - t0);
    return this.stats;
  }

  // --- clipped hedges -------------------------------------------------------------------------

  /** A clipped hedge along a line of [x, z] points: a solid core in the leaf picture, and leaf cards over it. */
  _hedge(points, { h = 1.15, w = 0.85 } = {}) {
    const R = this.R;
    const core = [];
    const cards = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i];
      const [x1, z1] = points[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.05) continue;
      const dir = new THREE.Vector3((x1 - x0) / len, 0, (z1 - z0) / len);
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const mid = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const y = this._ground(mid.x, mid.z) ?? 0;
      // (a little overlap, so the joints of a curve don't open)
      const box = new THREE.BoxGeometry(len + 0.12, h - 0.12, w - 0.2);
      // the picture in metres, on every face
      const uvs = box.attributes.uv;
      const p = box.attributes.position;
      const n = box.attributes.normal;
      for (let k = 0; k < p.count; k++) {
        const ax = Math.abs(n.getX(k)) > 0.5 ? [p.getZ(k), p.getY(k)] : Math.abs(n.getY(k)) > 0.5 ? [p.getX(k), p.getZ(k)] : [p.getX(k), p.getY(k)];
        uvs.setXY(k, ax[0] / 0.7 + i * 0.37, ax[1] / 0.7);
      }
      box.rotateY(-Math.atan2(dir.z, dir.x));
      box.translate(mid.x, y + (h - 0.12) / 2, mid.z);
      core.push(box);
      // leaf cards over the faces and the top, breaking its hard edges
      const count = Math.round(len * 46);
      for (let k = 0; k < count; k++) {
        const a = R() * len - len / 2;
        const face = R();
        const at = mid.clone().addScaledVector(dir, a);
        let out;
        let py;
        if (face < 0.36) {
          out = side.clone();
          at.addScaledVector(side, w / 2 - 0.08 + R() * 0.1);
          py = y + 0.15 + R() * (h - 0.25);
        } else if (face < 0.72) {
          out = side.clone().negate();
          at.addScaledVector(side, -(w / 2 - 0.08 + R() * 0.1));
          py = y + 0.15 + R() * (h - 0.25);
        } else {
          out = new THREE.Vector3(0, 1, 0);
          at.addScaledVector(side, (R() - 0.5) * (w - 0.1));
          py = y + h - 0.1 + R() * 0.08;
        }
        cards.push({ p: new THREE.Vector3(at.x, py, at.z), out, occ: 0.85 + R() * 0.2 });
      }
      // you can't walk through it
      for (let a = 0; a <= len; a += 0.6) {
        const o = new THREE.Vector3(x0, 0, z0).addScaledVector(dir, a);
        this.obstacles.push({ x: o.x, z: o.z, r: w / 2 + 0.05 });
      }
      this.stats.hedge += len;
    }
    return { core, cards };
  }

  _hedges() {
    const lines = [];
    // along the back of the low wall that closes the garden from the assault course (z -52.1, the
    // path through it at x -16), with its ends turning in beside the path, as in TRJTA's views
    const wz = -52.1 - 1.15;
    const gap = [-17.4, -13.6];
    const arc = (cx, cz, r, a0, a1) => {
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const a = a0 + ((a1 - a0) * k) / 6;
        pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      return pts;
    };
    // west part: from the west wall to the path, turning north along it
    lines.push([[-40, wz], [gap[0] - 3, wz], ...arc(gap[0] - 3, wz - 3, 3, Math.PI / 2, 0).slice(1), [gap[0], wz - 6.5]]);
    // east part: from the path to the east wall
    lines.push([[gap[1], wz - 6.5], ...arc(gap[1] + 3, wz - 3, 3, Math.PI, Math.PI / 2), [gap[1] + 3, wz], [50.8, wz]]);
    const cores = [];
    const cards = [];
    for (const l of lines) {
      const { core, cards: c } = this._hedge(l);
      cores.push(...core);
      cards.push(...c);
    }
    if (!cores.length) return;
    const merged = mergeBoxes(cores);
    const coreMat = new THREE.MeshStandardMaterial({ map: this.pictures.hedge, color: 0xa6b890, roughness: 0.95, envMapIntensity: 0.3 });
    const coreMesh = new THREE.Mesh(merged, coreMat);
    coreMesh.castShadow = coreMesh.receiveShadow = true;
    this.group.add(coreMesh);
    let ci = 0;
    const geo = cardsGeometry(cards.length, 0.27, () => cards[ci++], 31);
    const mats = this._leafMaterial(this.pictures.box, { tint: 0xb4c49c, height: 1.2, stiff: 6 });
    const mesh = new THREE.Mesh(geo, mats.m);
    mesh.customDepthMaterial = mats.depth;
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  // --- shrub borders --------------------------------------------------------------------------

  /** Shrubs along a wall: from (x0, z0) to (x1, z1), the wall found towards `toward` (a unit [x, z]). */
  _along(x0, z0, x1, z1, toward, { step = 1.7, gapChance = 0.12, from = 0.9 } = {}) {
    const R = this.R;
    const out = [];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ray = new THREE.Ray();
    for (let a = 0; a <= len; a += step * (0.7 + R() * 0.6)) {
      if (R() < gapChance) continue;
      const x = x0 + ((x1 - x0) * a) / len;
      const z = z0 + ((z1 - z0) * a) / len;
      ray.origin.set(x, 0.8, z);
      ray.direction.set(toward[0], 0, toward[1]);
      const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 12);
      if (!hit) continue;
      const d = from + R() * 0.6;
      const bx = hit.point.x - toward[0] * d;
      const bz = hit.point.z - toward[1] * d;
      if (!this._lawn(bx, bz)) continue;
      out.push({ x: bx, z: bz });
    }
    return out;
  }

  _borders() {
    const L = this.landscape.lawn;
    const R = this.R;
    const spots = [];
    // inside the side walls, front to back (TRJTA's fountain view: a full border along the east wall)
    spots.push(...this._along(L.max.x - 3, L.max.z - 32, L.max.x - 3, -50, [1, 0]));
    spots.push(...this._along(L.min.x + 3, L.max.z - 32, L.min.x + 3, -50, [-1, 0]));
    // the assault course: in clumps along its walls
    spots.push(...this._along(L.max.x - 3, -56, L.max.x - 3, L.min.z + 2, [1, 0], { gapChance: 0.3 }));
    spots.push(...this._along(L.min.x + 3, -56, L.min.x + 3, L.min.z + 2, [-1, 0], { gapChance: 0.35 }));
    spots.push(...this._along(L.min.x + 2, L.min.z + 3, L.max.x - 2, L.min.z + 3, [0, -1], { gapChance: 0.4 }));
    // and round the course itself, among the crates
    for (let k = 0, tries = 0; k < 26 && tries < 600; tries++) {
      const x = THREE.MathUtils.lerp(L.min.x + 4, L.max.x - 4, R());
      const z = THREE.MathUtils.lerp(L.min.z + 4, -58, R());
      if (!this._lawn(x, z)) continue;
      // close to something (a crate, the sand) but not on it
      const near = [1.6, 2.4].some((r) => [0, 1, 2, 3].some((q) => {
        const a = (q / 4) * Math.PI * 2;
        const y = this._ground(x + Math.cos(a) * r, z + Math.sin(a) * r);
        return y === null || Math.abs(y) > 0.35;
      }));
      if (!near || !this._lawn(x + 0.8, z) || !this._lawn(x - 0.8, z) || !this._lawn(x, z + 0.8) || !this._lawn(x, z - 0.8)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.5)) continue;
      spots.push({ x, z });
      k++;
    }
    // under the balcony at the north-west corner
    for (const [x, z] of [[-11.2, -30.9], [-12.4, -31.3], [-10.1, -33]]) if (this._lawn(x, z)) spots.push({ x, z });
    // three kinds of shrub, from the trees' own leaf pictures
    const maps = this.landscape.leafMaps;
    const kinds = [
      { map: maps.bush, geo: cardsGeometry(130, 0.62, ballPlace(0.85, 0.7, 0.8, 0), 41), tint: 0xd8e6c0 },
      { map: maps.oak, geo: cardsGeometry(150, 0.7, ballPlace(1.05, 0.95, 0.95, 0), 42), tint: 0xc0d2a8 },
      { map: maps.ash, geo: cardsGeometry(120, 0.66, ballPlace(0.75, 1.05, 0.75, 0), 43), tint: 0xd0dcb4 },
    ];
    const byKind = kinds.map(() => []);
    for (const s of spots) {
      const k = Math.floor(R() * kinds.length);
      const sc = 0.8 + R() * 0.55;
      byKind[k].push({ x: s.x, y: (this._ground(s.x, s.z) ?? 0) - 0.05, z: s.z, s: sc, sy: sc * (0.85 + R() * 0.35), rot: R() * Math.PI * 2 });
      this.obstacles.push({ x: s.x, z: s.z, r: 0.75 * sc });
    }
    kinds.forEach((k, i) => {
      if (!byKind[i].length) return;
      this._instanced(k.geo, this._leafMaterial(k.map, { tint: k.tint, height: 2 }), byKind[i]);
    });
    this.stats.shrubs = spots.length;
  }

  // --- long grass -----------------------------------------------------------------------------

  _grass() {
    const R = this.R;
    const L = this.landscape.lawn;
    const spots = [];
    const noise = (x, z) => Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) * 0.5 + Math.sin(z * 0.17 - x * 0.07 + 1.3) * 0.5;
    // the assault course: meadow in drifts, between the crates and along the walls
    for (let tries = 0; spots.length < 4200 && tries < 20000; tries++) {
      const x = THREE.MathUtils.lerp(L.min.x + 1, L.max.x - 1, R());
      const z = THREE.MathUtils.lerp(L.min.z + 1, -53.2, R());
      const near = Math.min(x - L.min.x, L.max.x - x, z - L.min.z, -53 - z);
      // (mown in front of the hedge, as in his views of the back of the house)
      if (z > -60 && near > 1.5) continue;
      if (noise(x, z) < 0.15 && near > 4 && R() > 0.15) continue;
      if (!this._lawn(x, z)) continue;
      spots.push({ x, z, s: 0.55 + R() * 0.5 });
    }
    // outside the walls: a strip along their foot (the fields' edge) on the sides and the back
    for (let tries = 0, n = 0; n < 1400 && tries < 5000; tries++) {
      const side = R();
      const d = 0.4 + Math.pow(R(), 1.5) * 3.5;
      let x;
      let z;
      if (side < 0.33) [x, z] = [L.min.x - d, THREE.MathUtils.lerp(L.min.z, L.max.z - 25, R())];
      else if (side < 0.66) [x, z] = [L.max.x + d, THREE.MathUtils.lerp(L.min.z, L.max.z - 25, R())];
      else [x, z] = [THREE.MathUtils.lerp(L.min.x, L.max.x, R()), L.min.z - d];
      const y = this._field(x, z);
      if (y === null) continue;
      spots.push({ x, y, z, s: 0.8 + R() * 0.6 });
      n++;
    }
    for (const s of spots) {
      s.y ??= this._ground(s.x, s.z) ?? 0;
      s.y -= 0.03;
      s.rot = R() * Math.PI * 2;
      s.sy = s.s * (0.8 + R() * 0.5);
    }
    // a tuft: three crossed upright cards
    const tuft = new THREE.BufferGeometry();
    {
      const pos = [];
      const uv = [];
      const nor = [];
      const idx = [];
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        const c = Math.cos(a) * 0.5;
        const s = Math.sin(a) * 0.5;
        const b = pos.length / 3;
        pos.push(-c, 0, -s, c, 0, s, c, 0.8, s, -c, 0.8, -s);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        for (let j = 0; j < 4; j++) nor.push(0, 1, 0);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      tuft.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      tuft.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      tuft.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      tuft.setIndex(idx);
    }
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.grass, color: 0xccd4a4, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9, envMapIntensity: 0.2 });
    const time = this.wind.time;
    const amp = this.wind.amp;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = time;
      shader.uniforms.uWindAmp = amp;
      shader.uniforms.uDay = seasonUniforms.uDay;
      shader.uniforms.uSnow = seasonUniforms.uSnow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindAmp;\nuniform float uDay;\nvarying float vDry;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec2 ip = instanceMatrix[3].xz;
           float bend = uv.y * uv.y;
           transformed.x += sin(uWindTime * 1.7 + ip.x * 0.4 + ip.y * 0.3) * 0.07 * bend * (0.4 + uWindAmp);
           transformed.z += sin(uWindTime * 2.3 + ip.y * 0.5) * 0.05 * bend * (0.4 + uWindAmp);
           // straw in late summer and autumn, low and grey-brown in winter, fresh in spring
           vDry = smoothstep(200.0, 260.0, uDay) * (1.0 - smoothstep(330.0, 364.0, uDay)) + (1.0 - smoothstep(40.0, 110.0, uDay)) * 0.8;
           transformed.y *= mix(1.0, 0.65, (1.0 - smoothstep(40.0, 110.0, uDay)));`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vDry;\nuniform float uSnow;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.5, 0.4, 0.1))) * vec3(1.25, 1.0, 0.6), vDry * 0.75);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), uSnow * smoothstep(0.35, 0.9, vMapUv.y) * 0.85);`,
        );
    };
    mat.customProgramCacheKey = () => 'long-grass';
    this._instanced(tuft, { m: mat }, spots, { cast: false });
    this.stats.tufts = spots.length;
  }

  // --- small plants outside the front wall --------------------------------------------------

  _smallPlants() {
    const g = this.gate;
    if (!g) return;
    const R = this.R;
    const spots = [];
    const ray = new THREE.Ray();
    for (let tries = 0; spots.length < 520 && tries < 4000; tries++) {
      const side = R() < 0.5 ? -1 : 1;
      const x = g.x + side * (3.2 + Math.pow(R(), 1.3) * 16);
      // the foot of the wall here (it angles back from the gate)
      ray.origin.set(x, 0.5, g.z + 10);
      ray.direction.set(0, 0, -1);
      const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 20);
      if (!hit) continue;
      const z = hit.point.z + 0.35 + Math.pow(R(), 1.6) * 3.2;
      const y = this._ground(x, z);
      if (y === null || y > 0.3 || !this.landscape._grassAt(x, z)) continue;
      // in drifts: thickest by the gate, thinner along the wall
      if (R() < Math.abs(x - g.x) / 22) continue;
      spots.push({ x, y: y - 0.02, z, s: 0.9 + R() * 0.7, rot: R() * Math.PI * 2 });
    }
    // a plant: two crossed cards and one slanted, of the rosette
    const geo = new THREE.BufferGeometry();
    {
      const pos = [];
      const uv = [];
      const nor = [];
      const idx = [];
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        const c = Math.cos(a) * 0.32;
        const s = Math.sin(a) * 0.32;
        const b = pos.length / 3;
        pos.push(-c, 0, -s, c, 0, s, c, 0.5, s, -c, 0.5, -s);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        for (let j = 0; j < 4; j++) nor.push(0, 1, 0);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setIndex(idx);
    }
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.rosette, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.3 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDay = seasonUniforms.uDay;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uDay;').replace(
        '#include <begin_vertex>',
        // (they die back in winter, and come up again in spring)
        '#include <begin_vertex>\ntransformed *= mix(0.35, 1.0, smoothstep(70.0, 120.0, uDay) * (1.0 - smoothstep(300.0, 340.0, uDay)));',
      );
    };
    mat.customProgramCacheKey = () => 'rosette';
    this._instanced(geo, { m: mat }, spots, { cast: false });
    this.stats.plants = spots.length;
  }

  // --- clipped evergreens, and the terrace --------------------------------------------------

  _topiary() {
    const box = this._leafMaterial(this.pictures.box, { tint: 0xd0e0b8, height: 1.5, stiff: 9 });
    const coreMat = new THREE.MeshStandardMaterial({ map: this.pictures.hedge, color: 0x8fa080, roughness: 0.95, envMapIntensity: 0.3 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0xb4643c, roughness: 0.85 });
    const add = (geo, mat, x, y, z, { cast = true } = {}) => {
      const m = new THREE.Mesh(geo, mat.m ?? mat);
      if (mat.depth) m.customDepthMaterial = mat.depth;
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // a clipped cone: cards over a solid core
    const cone = (x, y, z, h, rb) => {
      add(cardsGeometry(Math.round(h * rb * 260), 0.2, conePlace(rb, h, 0), Math.round(x * 13 + z * 7)), box, x, y, z);
      add(new THREE.ConeGeometry(rb * 0.86, h * 0.95, 14).translate(0, h * 0.475, 0), coreMat, x, y, z);
      this.obstacles.push({ x, z, r: rb + 0.05 });
      this.stats.topiary++;
    };
    // a clipped ball on a stem (or a stack of them)
    const ball = (x, y, z, r, seed) => {
      add(cardsGeometry(Math.round(r * r * 520), 0.18, ballPlace(r, r, r, -r, 0.2), seed), box, x, y, z);
      add(new THREE.SphereGeometry(r * 0.85, 14, 10), coreMat, x, y, z);
    };
    const stem = (x, y, z, h) => add(new THREE.CylinderGeometry(0.025, 0.035, h, 6).translate(0, h / 2, 0), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }), x, y, z);
    const pot = (x, y, z, r, h) => add(new THREE.CylinderGeometry(r, r * 0.78, h, 18).translate(0, h / 2, 0), potMat, x, y, z);

    // cones in the two pots by the front door (TRJTA's view through the gate)
    for (const [x, z] of [[-4.1, -8.9], [0.3, -8.9]]) cone(x, 0.55, z, 1.25, 0.3);
    // tiered balls in the pots by the kitchen door (his view of the south-west corner)
    for (const [x, z] of [[-14.5, -26.0], [-14.5, -24.1]]) {
      stem(x, 0.35, z, 1.15);
      ball(x, 0.35 + 0.42, z, 0.24, 61);
      ball(x, 0.35 + 0.86, z, 0.19, 62);
      ball(x, 0.35 + 1.18, z, 0.13, 63);
      this.stats.topiary++;
    }
    // tall columns, and cones, in the planting strip along the front, by its corners
    const ray = new THREE.Ray();
    for (const [x, h, r] of [[-12.6, 2.7, 0.42], [-7.2, 1.7, 0.4], [3.8, 1.7, 0.4], [7.6, 2.3, 0.4]]) {
      ray.origin.set(x, 0.6, 5);
      ray.direction.set(0, 0, -1);
      const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 30);
      if (!hit) continue;
      const z = hit.point.z + 0.7;
      if (!this._lawn(x, z)) continue;
      cone(x, (this._ground(x, z) ?? 0) - 0.03, z, h, r);
    }

    // the balcony at the north-west corner (TRJTA's picture of it: the iron chairs are the model's
    // own): a clipped bay on a stem in a pot, and a bird of paradise in a white pot
    const fy = 5.8;
    pot(-9.95, fy, -27.35, 0.2, 0.34);
    stem(-9.95, fy + 0.3, -27.35, 1.0);
    ball(-9.95, fy + 1.45, -27.35, 0.3, 64);
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.35 });
    add(new THREE.CylinderGeometry(0.22, 0.17, 0.34, 20).translate(0, 0.17, 0), white, -10.75, fy, -28.15);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20).translate(0, 0.32, 0), new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 1 }), -10.75, fy, -28.15);
    const leafMat = new THREE.MeshStandardMaterial({ map: paddlePicture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, envMapIntensity: 0.4 });
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.7 });
    const plant = new THREE.Group();
    const R = rng(77);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + R() * 0.5;
      const tilt = 0.18 + R() * 0.45;
      const L = 0.45 + R() * 0.45;
      const arm = new THREE.Group();
      arm.rotation.set(0, a, 0);
      const lean = new THREE.Group();
      lean.rotation.z = -tilt;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, L, 5).translate(0, L / 2, 0), stalkMat);
      // the leaf: a long blade, bent a little along its length, carrying on from the stalk
      const blade = new THREE.PlaneGeometry(0.16, 0.62, 1, 6);
      const bp = blade.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const y = bp.getY(i) + 0.31;
        bp.setY(i, y + L);
        bp.setZ(i, -0.25 * (y / 0.62) * (y / 0.62) * (0.6 + tilt));
      }
      blade.computeVertexNormals();
      const leaf = new THREE.Mesh(blade, leafMat);
      leaf.rotation.y = Math.PI / 2;
      lean.add(stalk, leaf);
      arm.add(lean);
      plant.add(arm);
    }
    plant.position.set(-10.75, fy + 0.3, -28.15);
    plant.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    this.group.add(plant);
  }

  // --- the zip line's trolley ---------------------------------------------------------------

  _trolley() {
    // (the line runs from the top of the tall crate tower down to the far end: a third of the way)
    const hi = new THREE.Vector3(-5.1, 9.7, -85.2);
    const lo = new THREE.Vector3(-16.8, 2.8, -64.0);
    const at = hi.clone().lerp(lo, 0.32);
    const dir = lo.clone().sub(hi).normalize();
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.45, metalness: 0.8 });
    const g = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.26), metal);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6), metal);
    rod.position.y = -0.36;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), metal);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = -0.68;
    const grips = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    for (const s of [-1, 1]) {
      const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 8), grips);
      gr.rotation.z = Math.PI / 2;
      gr.position.set(s * 0.22, -0.68, 0);
      g.add(gr);
    }
    g.add(wheel, rod, bar);
    g.position.copy(at);
    // the bar across the line, the wheel along it
    g.rotation.y = Math.atan2(dir.x, dir.z);
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    this.group.add(g);
    this.trolley = g;
  }

  // --- chimney smoke --------------------------------------------------------------------------

  _smoke() {
    // the stacks with a fire under them: the tall triple stack, the one by the porch, one at the back
    this.chimneys = [new THREE.Vector3(15.4, 14.6, -17.7), new THREE.Vector3(-4.0, 10.7, -13.4), new THREE.Vector3(7.6, 11.1, -29.5)];
    this.smoke = new Particles(1100, { additive: false, map: puffPicture(), max: 140, near: 7 });
    this.smoke.points.renderOrder = 7;
    this.group.add(this.smoke.points);
    this._puff = this.chimneys.map(() => 0);
  }

  /** A jump in the date or the time: the smoke of before is gone. */
  clearSmoke() {
    const sm = this.smoke;
    if (!sm) return;
    sm.life.fill(0);
    sm.alpha.fill(0);
    sm.flush();
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.cold 0 a warm day .. 1 a cold one (fires lit)
   * @param {number} o.wind 0..1
   * @param {number} o.night 0 day .. 1 night
   * @param {THREE.Color} [o.sky] the light, to tint the smoke
   */
  update(dt, { cold = 0, wind = 0.3, night = 0, scale } = {}) {
    if (scale) this.smoke.material.uniforms.uScale.value = scale;
    const sm = this.smoke;
    const fire = THREE.MathUtils.smoothstep(cold, 0.15, 0.6);
    this.chimneys.forEach((c, k) => {
      if (fire <= 0.01 || (k === 2 && fire < 0.6)) return;
      this._puff[k] -= dt;
      if (this._puff[k] > 0) return;
      // (thick on a cold day: a puff every fraction of a second)
      // (many small, faint puffs, overlapping into a column)
      this._puff[k] = THREE.MathUtils.lerp(0.2, 0.045, fire) * (0.7 + Math.random() * 0.6);
      const i = sm.spawn();
      sm.pos.set([c.x + (Math.random() - 0.5) * 0.3, c.y, c.z + (Math.random() - 0.5) * 0.3], i * 3);
      sm.vel.set([(Math.random() - 0.5) * 0.3, 1.1 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3], i * 3);
      sm.life[i] = sm.data[i * 4] = 9 + Math.random() * 6;
      sm.data[i * 4 + 1] = fire;
    });
    // downwind (from the south-west, as English winds mostly are), rising and spreading
    const drift = 0.4 + wind * 3.2;
    for (let i = 0; i < sm.count; i++) {
      if (sm.life[i] <= 0) {
        sm.alpha[i] = 0;
        continue;
      }
      sm.life[i] -= dt;
      const u = 1 - Math.max(0, sm.life[i]) / sm.data[i * 4];
      sm.vel[i * 3] += (drift * 0.8 - sm.vel[i * 3]) * dt * 0.4;
      sm.vel[i * 3 + 2] += (-drift * 0.5 - sm.vel[i * 3 + 2]) * dt * 0.4;
      sm.vel[i * 3 + 1] *= 1 - dt * 0.12;
      for (let k = 0; k < 3; k++) sm.pos[i * 3 + k] += sm.vel[i * 3 + k] * dt;
      // pale grey by day; at night a faint veil, a little darker than the sky (seen against the stars)
      const v = THREE.MathUtils.lerp(0.86, 0.09, night);
      sm.col.set([v, v * 1.03, v * 1.12], i * 3);
      sm.size[i] = 0.7 + u * 6.5;
      sm.alpha[i] = Math.min(1, u * 8) * (1 - u) * (1 - u) * THREE.MathUtils.lerp(0.3, 0.12, night) * sm.data[i * 4 + 1];
    }
    sm.flush();
  }
}

/** One geometry from many boxes (each already placed). */
function mergeBoxes(boxes) {
  let vCount = 0;
  let iCount = 0;
  for (const b of boxes) {
    vCount += b.attributes.position.count;
    iCount += b.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const b of boxes) {
    pos.set(b.attributes.position.array, vo * 3);
    nor.set(b.attributes.normal.array, vo * 3);
    uv.set(b.attributes.uv.array, vo * 2);
    for (let k = 0; k < b.index.count; k++) idx[io + k] = b.index.array[k] + vo;
    vo += b.attributes.position.count;
    io += b.index.count;
    b.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
