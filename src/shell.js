// The house's shell for the two scenes that change the building itself: Two hundred years empty
// (ruin.js: a roofless ruin) and The house going up (building.js: half built). The cutting is done
// in the house's own shaders (materials.js: shellCut, shellLook), so the model is never touched;
// this switches them, gives the house's meshes shadows cut the same way, hides what has no place in
// either (the glass, the gilt picture frames, the hall clock's hands, the pool's water), and has the
// same sums in JavaScript, so what is built round the house (ivy, rubble, scaffolding, joists) is
// placed only on what is still there.

import * as THREE from 'three';
import { setShellMode, getShellMode, shellDepthMaterial, shellKind } from './materials.js';
import { seasonUniforms } from './season.js';

export const HOUSE = { x0: -15.8, x1: 29.8, z0: -33.3, z1: -8.7 };

export function inHouse(x, z) {
  return x > HOUSE.x0 && x < HOUSE.x1 && z > HOUSE.z0 && z < HOUSE.z1;
}

// (float32 at each step, as the GPU does it, so the two agree)
const f = Math.fround;
const fract = (x) => f(x - Math.floor(x));

export function sHash(x, y) {
  let a = fract(f(x * 0.1031));
  let b = fract(f(y * 0.1031));
  let c = fract(f(x * 0.1031));
  const d = f(f(a * f(b + 33.33)) + f(b * f(c + 33.33)) + f(c * f(a + 33.33)));
  a = f(a + d);
  b = f(b + d);
  c = f(c + d);
  return fract(f(f(a + b) * c));
}

export function sNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = sHash(ix, iy) * (1 - ux) + sHash(ix + 1, iy) * ux;
  const b = sHash(ix, iy + 1) * (1 - ux) + sHash(ix + 1, iy + 1) * ux;
  return a * (1 - uy) + b * uy;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How high the ruin's walls still stand at (x, z) (materials.js's ruinTop). */
export function ruinTop(x, z) {
  const a = smooth(0.2, 0.8, sNoise(x * 0.085 + 3.1, z * 0.085 + 1.7));
  const b = sNoise(x * 0.29 + 7.7, z * 0.29 + 2.3);
  const breach = smooth(0.6, 0.78, sNoise(x * 0.21 + 11.3, z * 0.21 + 4.1));
  return Math.max(0.6, 1.3 + Math.pow(a, 1.5) * 12.5 + (b - 0.5) * 2.4 - breach * 7);
}

/** How far the walls are up at (x, z) while the house is going up (materials.js's buildTop). */
export function buildTop(x) {
  if (x < 9.5) return 40;
  return Math.max(4.2, Math.floor((9.6 - (x - 9.5) * 1.25) / 0.3) * 0.3);
}

/** Is this point of the model still there in the ruin? (`ny` the surface normal's |y|) */
export function ruinKeeps(p, name, ny) {
  if (/^cm_(glass|water)/.test(name)) return false;
  const k = shellKind(name);
  if (k === 5) return false;
  if (!inHouse(p.x, p.z)) return !groundsGone(p, k, 1);
  const top = ruinTop(p.x, p.z);
  if (k === 2 || k === 4 || k === 6 || k === 8 || k === 10 || k === 12 || k === 13) return false;
  if (k === 11 && p.y > 1) return false;
  if (k === 3 && ny > 0.3 && ny < 0.97 && p.y > 1.2) return false;
  if ((k === 1 || k === 9 || k === 0) && p.y > top) return false;
  if (k === 3) return ny > 0.7 ? p.y <= 1.2 : p.y <= Math.min(top - 0.05, 3.1);
  return true;
}

/** Is this point of the model built yet while the house is going up? */
export function buildKeeps(p, name, ny) {
  if (/^cm_(glass|water)/.test(name)) return false;
  const k = shellKind(name);
  if (k === 5 || k === 9 || k === 7) return false;
  if (!inHouse(p.x, p.z)) return true;
  if (p.y > buildTop(p.x)) return false;
  if (k === 4 || k === 10 || k === 12 || k === 13 || (k === 3 && ny > 0.3 && ny < 0.97)) return false;
  if (k === 6 && p.x > -2) return false;
  if ((k === 2 || (k === 11 && p.y > 1)) && p.x > -2) return false;
  if (k === 3 && ny > 0.7 && p.y > 2.2) return false;
  if (k === 3 && ny <= 0.3 && p.y > 3.1) return false;
  return true;
}

/** A hundred years: inside one of the places where the roof has fallen in? (materials.js's inHole) */
export function inHole(x, z, scale = 1) {
  const H = seasonUniforms.uHoles.value;
  for (let i = 0; i < H.length; i++) {
    const h = H[i];
    if (h.z <= 0) continue;
    const d = Math.hypot(x - h.x, z - h.y) / (h.z * scale);
    if (d + (sNoise(x * 1.6 + i * 7, z * 1.6 + i * 7) - 0.5) * 0.45 < 1) return true;
  }
  return false;
}

/** And how high the walls stand in the corner that came down. */
export function breachTop(x, z) {
  const b = seasonUniforms.uBreach.value;
  if (b.z <= 0) return 99;
  const d = Math.hypot(x - b.x, z - b.y) / b.z;
  if (d >= 1) return 99;
  return b.w + d * d * 9 + (sNoise(x * 2.3, z * 2.3) - 0.5) * 0.8;
}

/** The broken fountain and the fallen estate walls (materials.js's groundsGone; without the brick-sized jag). */
function groundsGone(p, k, how) {
  const fx = p.x - 4.59;
  const fz = p.z - 8.28;
  const fd = Math.hypot(fx, fz);
  if (fd < 4.3 && p.y < 5) {
    if (k === 7 && p.y > 4.3 + (3.1 - 4.3) * (how - 0.5) * 2) return true;
    if (k === 1 && p.y > 0.22) return sNoise(Math.atan2(fz, fx) * 2.6 + 3, p.y * 1.7 + fd * 0.6) > 0.8 + (0.6 - 0.8) * (how - 0.5) * 2;
    return false;
  }
  if (k !== 1) return false;
  if (how > 0.75) return p.y > 0.35 + 2.8 * smooth(0.28, 0.72, sNoise(p.x * 0.11 + 1.3, p.z * 0.11 + 8.2));
  return sNoise(p.x * 0.15 + 6.1, p.z * 0.15 + 2.2) > 0.76 && p.y > 0.6;
}

/** Is this point of the model there a hundred years on? */
export function centuryKeeps(p, name, ny, onRoof = false) {
  if (/^cm_(glass|water)/.test(name)) return false;
  const k = shellKind(name);
  if (k === 5) return false;
  if (!inHouse(p.x, p.z)) return !groundsGone(p, k, 0.5);
  if (k === 13) return false;
  if (inHole(p.x, p.z) && (k === 2 || onRoof || (k === 3 && ny > 0.3 && ny < 0.97) || (k === 11 && p.y > 1))) return false;
  if (inHole(p.x, p.z, 0.85) && p.y > 2.2 && (k === 12 || k === 4 || k === 8 || (k === 3 && ny > 0.7))) return false;
  if (p.y > breachTop(p.x, p.z) && k !== 0 && k !== 7) return false;
  return true;
}

/** Earth: brown, with darker clods and paler sand, tiling every few metres. */
function earthPicture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a4630';
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2200; i++) {
    const x = R() * 256;
    const y = R() * 256;
    const r = 1 + R() * 5;
    const t = R();
    g.fillStyle = t < 0.5 ? `rgba(40, 30, 18, ${0.2 + R() * 0.4})` : `rgba(${130 + R() * 40}, ${110 + R() * 30}, ${80 + R() * 20}, ${0.15 + R() * 0.3})`;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((HOUSE.x1 - HOUSE.x0) / 3, (HOUSE.z1 - HOUSE.z0) / 3);
  t.anisotropy = 4;
  return t;
}

export class HouseShell {
  /**
   * @param {THREE.Object3D} model
   * @param {object} o
   * @param {THREE.Object3D|null} o.clock  the hall clock's hands
   * @param {object|null} o.water  the water system (its surfaces)
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh
   * @param {(faceIndex:number)=>string} o.materialAt
   * @param {THREE.Scene|null} o.scene
   * @param {object|null} o.doors  the doors (doors.js: their swinging leaves are not part of the model)
   */
  constructor(model, { clock = null, water = null, bvh = null, materialAt = null, scene = null, doors = null } = {}) {
    this.doors = doors;
    this.model = model;
    this.clock = clock;
    this.water = water;
    this.bvh = bvh;
    this.materialAt = materialAt;
    this.meshes = [];
    this.hide = []; // what neither scene has: glass, the gilt frames, things see-through
    this.ivy = [];
    model.updateMatrixWorld(true);
    const c = new THREE.Vector3();
    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name || '';
      const kind = shellKind(name);
      if (kind) this.meshes.push({ mesh: o, kind });
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      o.geometry.boundingBox.getCenter(c).applyMatrix4(o.matrixWorld);
      const inside = inHouse(c.x, c.z);
      if ((/^cm_(glass|water_pool)/.test(name) || o.material.transparent) && inside) this.hide.push(o);
      if (/^Ivy/i.test(name)) this.ivy.push(o); // (the model's own ivy: none on a new house)
      for (const fr of o.userData.frames ?? []) this.hide.push(fr);
    });
    this.mode = 0;
    this.ray = new THREE.Ray();
    // the ground under the house: the model has no floor under the spaces that were never fitted out
    // (closed in under the roof, they were never seen), and the estate's ground stops at the walls;
    // with the roof off, earth all over the footprint, just under the rooms' own floors
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.x1 - HOUSE.x0, HOUSE.z1 - HOUSE.z0), new THREE.MeshStandardMaterial({ map: earthPicture(), roughness: 1, envMapIntensity: 0.2 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set((HOUSE.x0 + HOUSE.x1) / 2, -0.06, (HOUSE.z0 + HOUSE.z1) / 2);
    this.floor.receiveShadow = true;
    this.floor.visible = false;
    this.floor.name = 'the ground under the house';
    scene?.add(this.floor);
  }

  /**
   * The stones that sit on the roof (the ridge's cresting, the copings it runs up under): they go
   * where the roof goes, so none is left in the air. A vertex attribute, aOnRoof, on the stone meshes:
   * 1 for each triangle with the roof straight under it (found with rays), 0 elsewhere.
   */
  _tagOnRoof() {
    if (this.tagged) return;
    this.tagged = true;
    const t0 = performance.now();
    const ray = new THREE.Ray();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    let n = 0;
    for (const { mesh } of this.meshes) {
      if (!/^cm_whitestone/.test(mesh.material.name || '')) continue;
      const g = mesh.geometry;
      const pos = g.attributes.position;
      const idx = g.index;
      const tris = idx ? idx.count / 3 : pos.count / 3;
      const tag = new Float32Array(pos.count);
      const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
      for (let t = 0; t < tris; t++) {
        a.fromBufferAttribute(pos, vi(t, 0)).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, vi(t, 1)).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(pos, vi(t, 2)).applyMatrix4(mesh.matrixWorld);
        const cx = (a.x + b.x + c.x) / 3;
        const cy = (a.y + b.y + c.y) / 3;
        const cz = (a.z + b.z + c.z) / 3;
        if (cy < 5.5 || !inHouse(cx, cz)) continue;
        ray.origin.set(cx, cy + 0.01, cz);
        ray.direction.set(0, -1, 0);
        const hits = this.bvh.raycast(ray, THREE.DoubleSide, 0, 1.2).sort((p, q) => p.distance - q.distance);
        const first = hits.find((h) => !/^cm_whitestone/.test(this.materialAt(h.faceIndex) || ''));
        if (!first || !/^cm_roof$/.test(this.materialAt(first.faceIndex) || '')) continue;
        for (let k = 0; k < 3; k++) tag[vi(t, k)] = 1;
        n++;
      }
      g.setAttribute('aOnRoof', new THREE.BufferAttribute(tag, 1));
    }
    console.info('stones on the roof', n, 'triangles,', Math.round(performance.now() - t0), 'ms');
  }

  /** 0 the house as it is, 1 a ruin, 2 going up, 3 a hundred years empty. */
  setMode(mode) {
    if (mode === this.mode) return;
    if (mode) this._tagOnRoof();
    this.mode = mode;
    setShellMode(mode);
    seasonUniforms.uRuin.value = mode === 1 ? 1 : 0;
    seasonUniforms.uBuild.value = mode === 2 ? 1 : 0;
    for (const { mesh, kind } of this.meshes) mesh.customDepthMaterial = shellDepthMaterial(kind);
    for (const o of this.hide) o.visible = !mode;
    this.floor.visible = !!mode;
    this.floor.material.color.set(mode === 1 ? 0x6f7e4c : mode === 3 ? 0x8a7a62 : 0xe6d6b4); // (moss and nettles; dust and debris; trodden earth and sand)
    // the doors' swinging leaves (doors.js): gone in the ruin, not hung yet going up
    for (const d of this.doors?.usable ?? []) for (const leaf of d.leaves ?? []) leaf.pivot.visible = mode !== 1 && mode !== 2;
    for (const o of this.ivy) o.visible = mode !== 2;
    if (this.clock) this.clock.visible = !mode;
    const indoor = this.water?.surfaces?.find((s) => !s.outdoor);
    if (indoor) indoor.mesh.visible = !mode;
  }

  /** Is a point of the model there in this mode? */
  keeps(p, name, ny, mode = this.mode) {
    if (mode === 1) return ruinKeeps(p, name, ny);
    if (mode === 2) return buildKeeps(p, name, ny);
    if (mode === 3) return centuryKeeps(p, name, ny);
    return true;
  }

  /**
   * The first surface a ray meets that is still there in a mode (the BVH has the whole house in it,
   * so the ray goes on through what the shader cuts away).
   */
  hit(origin, dir, far, mode = this.mode) {
    this.ray.origin.copy(origin);
    this.ray.direction.copy(dir);
    const hits = this.bvh.raycast(this.ray, THREE.DoubleSide, 0, far);
    hits.sort((a, b) => a.distance - b.distance);
    for (const h of hits) {
      const name = this.materialAt(h.faceIndex) || '';
      const n = h.face.normal.clone();
      if (!this.keeps(h.point, name, Math.abs(n.y), mode)) continue;
      if (n.dot(dir) > 0) n.negate();
      return { point: h.point.clone(), normal: n, name, distance: h.distance };
    }
    return null;
  }
}

export { getShellMode };
