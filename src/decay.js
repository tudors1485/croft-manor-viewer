// The rooms of the empty house, in Fifty and A hundred years empty (abandoned.js, century.js): not
// only the hall but every room the model fits out, gone the way rooms go when nobody comes.
//
// - Dust sheets over what furniture was left (rooms-data.js has where it is; each sheet is laid over
//   it with rays, so it falls over the real shapes), and in the empty ballroom the piano, a settee and
//   the little gilt chairs along the walls under sheets of their own.
// - Plaster down from the ceilings, in patches on the floors, the bare laths showing above; the
//   paper coming off the walls, damp-stained, strips of it curling down from the ceiling.
// - The middle chandelier of the ballroom down: lying on its side on the floor in a mess of its
//   crystal drops and plaster, the broken chain hanging from the torn ceiling rose.
// - Birds in: pigeons' nests on the wall tops round the holes in the roof, droppings and feathers
//   under them, pigeons perched and flying in and out (and in the attic under Fifty's holes).
// - The rain coming in: puddles under the holes and in the hall where the ceiling leaks; when it
//   rains, drips falling into them (rings spreading), a curtain of drops through each hole, the drips'
//   plinks and the rain louder near the holes.
//
// Everything is made the first time its scene is chosen, in the scene's own group.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BLOBS, FLOORS, WALLS } from './rooms-data.js';
import { animal, Flock } from './wildlife.js';

const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();

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

function picture(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** A ragged blob path (for torn edges): centre, radii, roughness. */
function blob(g, cx, cy, rx, ry, R, rough = 0.35, n = 22) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - rough / 2 + R() * rough;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Linen: an old dust sheet, off-white, its weave and grey dust lying in it. */
export function linenPicture() {
  return picture(
    128,
    128,
    (g) => {
      g.fillStyle = '#d8d3c5';
      g.fillRect(0, 0, 128, 128);
      const R = rng(5);
      for (let i = 0; i < 128; i += 2) {
        g.fillStyle = `rgba(150, 140, 120, ${0.05 + R() * 0.08})`;
        g.fillRect(0, i, 128, 1);
        g.fillRect(i, 0, 1, 128);
      }
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(110, 100, 85, ${0.04 + R() * 0.1})`;
        g.beginPath();
        g.ellipse(R() * 128, R() * 128, 4 + R() * 14, 3 + R() * 10, R() * 3, 0, Math.PI * 2);
        g.fill();
      }
    },
    { repeat: true },
  );
}

// four of each in a 2x2 atlas: each decal takes one quarter
const ATLAS = 512;
function atlas(draw, seed) {
  return picture(ATLAS, ATLAS, (g) => {
    const R = rng(seed);
    for (let k = 0; k < 4; k++) {
      g.save();
      g.translate((k % 2) * 256, Math.floor(k / 2) * 256);
      g.beginPath();
      g.rect(0, 0, 256, 256);
      g.clip();
      draw(g, R, k);
      g.restore();
    }
  });
}

/** Plaster fallen on a floor: a spread of white flakes and lumps, dust round them. */
const plasterPicture = () =>
  atlas((g, R) => {
    const dust = g.createRadialGradient(128, 128, 10, 128, 128, 120);
    dust.addColorStop(0, 'rgba(150, 142, 128, 0.75)');
    dust.addColorStop(0.6, 'rgba(140, 132, 118, 0.4)');
    dust.addColorStop(1, 'rgba(130, 122, 108, 0)');
    g.fillStyle = dust;
    blob(g, 128, 128, 112, 100, R, 0.5);
    g.fill();
    for (let i = 0; i < 110; i++) {
      const a = R() * 6.28;
      const r = Math.pow(R(), 0.9) * 100;
      const s = 2 + R() * (r < 40 ? 14 : 7);
      const shade = 150 + Math.floor(R() * 45);
      g.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 14})`;
      blob(g, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, s, s * (0.5 + R() * 0.5), R, 0.6, 7);
      g.fill();
      g.fillStyle = 'rgba(90, 80, 70, 0.5)';
      g.fillRect(128 + Math.cos(a) * r + s * 0.4, 128 + Math.sin(a) * r + s * 0.3, s * 0.6, 1.5);
    }
  }, 41);

/** A ceiling where the plaster has come away: the laths showing, the broken edge round them. */
const lathPicture = () =>
  atlas((g, R) => {
    g.fillStyle = 'rgba(120, 112, 100, 1)';
    blob(g, 128, 128, 108, 96, R, 0.4);
    g.fill();
    g.save();
    blob(g, 128, 128, 100, 86, R, 0.45);
    g.clip();
    g.fillStyle = '#1e1812';
    g.fillRect(0, 0, 256, 256);
    for (let y = 4; y < 256; y += 13) {
      g.fillStyle = `rgb(${110 + R() * 30}, ${82 + R() * 20}, ${54 + R() * 16})`;
      g.fillRect(0, y + (R() - 0.5) * 2, 256, 8);
      // (a few broken off)
      if (R() < 0.25) {
        g.fillStyle = '#1e1812';
        g.fillRect(R() * 256, y - 1, 30 + R() * 60, 10);
      }
    }
    // plaster still in some of the gaps, keyed through
    for (let i = 0; i < 30; i++) {
      g.fillStyle = 'rgba(200, 192, 176, 0.8)';
      g.fillRect(R() * 256, R() * 256, 4 + R() * 14, 3);
    }
    g.restore();
  }, 43);

/** Damp on a wall: brown tide-marks spreading from the top. */
const stainPicture = () =>
  atlas((g, R) => {
    for (let ring = 0; ring < 4; ring++) {
      const k = 1 - ring * 0.2;
      g.fillStyle = `rgba(${96 - ring * 6}, ${74 - ring * 4}, ${44}, ${0.16 + ring * 0.07})`;
      blob(g, 128, 40, 118 * k, 210 * k, R, 0.45, 26);
      g.fill();
      g.strokeStyle = `rgba(70, 50, 30, ${0.25 + ring * 0.05})`;
      g.lineWidth = 2;
      g.stroke();
    }
    // black mould spotting
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(30, 32, 24, ${0.2 + R() * 0.4})`;
      g.beginPath();
      g.arc(40 + R() * 176, R() * 170, 1 + R() * 3, 0, 6.28);
      g.fill();
    }
  }, 47);

/** Bare plaster where the paper has come off, its torn edge (with scraps still on). */
const bareWallPicture = () =>
  atlas((g, R) => {
    g.fillStyle = 'rgb(146, 136, 116)';
    blob(g, 128, 128, 110, 118, R, 0.5, 28);
    g.fill();
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(150, 136, 110, ${0.2 + R() * 0.3})`;
      g.fillRect(R() * 256, R() * 256, 10 + R() * 30, 2 + R() * 4);
    }
  }, 53);

/** The wallpaper: a faded green-and-cream damask in stripes, its bottom edge torn (alpha). */
function paperPicture() {
  return picture(128, 512, (g, W, H) => {
    g.fillStyle = '#9c9476';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(80, 96, 66, 0.5)';
    for (let x = 0; x < W; x += 32) g.fillRect(x + 12, 0, 8, H);
    const R = rng(61);
    for (let y = 20; y < H; y += 46) {
      for (const x of [0, 32, 64, 96]) {
        g.fillStyle = 'rgba(96, 116, 78, 0.6)';
        g.beginPath();
        g.ellipse(x + 16, y + ((x / 32) % 2) * 23, 7, 12, 0, 0, 6.28);
        g.fill();
      }
    }
    // the years: yellowing, stains running down
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(110, 86, 40, ${0.08 + R() * 0.12})`;
      g.fillRect(R() * W, R() * H * 0.4, 6 + R() * 20, 60 + R() * 300);
    }
    // the torn end: cut away to nothing in a ragged line
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H - 30 - R() * 50);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  });
}

/** Birds' droppings: white splashes and grey streaks, a feather or two. */
const droppingsPicture = () =>
  atlas((g, R) => {
    for (let i = 0; i < 130; i++) {
      const a = R() * 6.28;
      const r = Math.pow(R(), 0.6) * 110;
      const s = 2 + R() * 7;
      g.fillStyle = R() < 0.7 ? `rgba(236, 234, 226, ${0.6 + R() * 0.4})` : `rgba(90, 88, 80, ${0.5 + R() * 0.4})`;
      blob(g, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r, s, s * (0.6 + R() * 0.6), R, 0.7, 8);
      g.fill();
    }
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(40 + R() * 176, 40 + R() * 176);
      g.rotate(R() * 6.28);
      g.fillStyle = 'rgba(150, 152, 160, 0.9)';
      g.beginPath();
      g.ellipse(0, 0, 18, 5, 0, 0, 6.28);
      g.fill();
      g.strokeStyle = 'rgba(240, 240, 240, 0.9)';
      g.beginPath();
      g.moveTo(-20, 0);
      g.lineTo(20, 0);
      g.stroke();
      g.restore();
    }
  }, 59);

/** A plane (w by h) laid on a surface at `p` facing `n`, with the atlas quarter `k`, spun `spin`. */
function decal(p, n, w, h, k, spin = 0, lift = 0.006) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const u0 = (k % 2) * 0.5;
  const v0 = 0.5 - Math.floor(k / 2) * 0.5; // (canvas rows go down, uvs up)
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
  const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : Y;
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), n, up);
  g.applyMatrix4(new THREE.Matrix4().makeRotationZ(spin));
  // (PlaneGeometry faces +z; lookAt points -z at the target, so turn it round)
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI));
  g.applyMatrix4(m);
  g.translate(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
  return g;
}

function decalMaterial(map, extra = {}) {
  return new THREE.MeshStandardMaterial({ map, alphaTest: 0.35, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, envMapIntensity: 0.3, ...extra });
}

/**
 * A dust sheet laid over whatever is under it: `heightAt(u, v)` how high the furniture stands there
 * (in the frame: u along, v across, from `origin`, up `Y`), softened so it falls over the edges in
 * folds to the floor.
 */
function drapeField(heightAt, u0, u1, v0, v1, { step = 0.05, origin, rot = 0, seed = 1 }) {
  const nu = Math.max(2, Math.ceil((u1 - u0) / step));
  const nv = Math.max(2, Math.ceil((v1 - v0) / step));
  let H = new Float32Array((nu + 1) * (nv + 1));
  const at = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) H[at(i, j)] = heightAt(u0 + (i / nu) * (u1 - u0), v0 + (j / nv) * (v1 - v0));
  const base = H.slice();
  for (let pass = 0; pass < 4; pass++) {
    const N = new Float32Array(H.length);
    for (let j = 0; j <= nv; j++)
      for (let i = 0; i <= nu; i++) {
        let sum = 0;
        let n = 0;
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii > nu || jj > nv) continue;
            sum += H[at(ii, jj)];
            n++;
          }
        N[at(i, j)] = Math.max(sum / n, base[at(i, j)] * (pass < 3 ? 1 : 0.985));
      }
    H = N;
  }
  const R = rng(seed);
  const ph = [R() * 6, R() * 6, R() * 6];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (i / nu) * (u1 - u0);
      const v = v0 + (j / nv) * (v1 - v0);
      let h = H[at(i, j)];
      const slope = Math.abs(H[at(Math.min(nu, i + 1), j)] - H[at(Math.max(0, i - 1), j)]) + Math.abs(H[at(i, Math.min(nv, j + 1))] - H[at(i, Math.max(0, j - 1))]);
      h += Math.min(1, slope * 6) * 0.025 * Math.sin(u * 23 + ph[0] + Math.sin(v * 7 + ph[1]) * 2) + 0.012 * Math.sin(v * 31 + ph[2]);
      h = Math.max(0.008, h);
      pos.push(origin.x + u * c + v * s, origin.y + h, origin.z - u * s + v * c);
      uv.push(u * 1.3, v * 1.3);
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const cc = at(i, j + 1);
      const d = at(i + 1, j + 1);
      idx.push(a, cc, b, b, cc, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Boxes (a piece of furniture's shape) as a height field for drapeField. */
const boxes = (parts) => (u, v) => {
  let h = 0;
  for (const p of parts) if (u >= p.u0 && u <= p.u1 && v >= p.v0 && v <= p.v1) h = Math.max(h, p.h);
  return h;
};

// --- the ballroom's middle chandelier: taken out of the model's gilt mesh once, so it can come down

const CHANDELIER_BOX = new THREE.Box3(new THREE.Vector3(1.1, 2.1, -28.45), new THREE.Vector3(2.45, 2.95, -27.1));
let chandelier = null;

function splitChandelier(model, shell) {
  if (chandelier !== null) return chandelier;
  chandelier = false;
  let src = null;
  model.traverse((o) => {
    if (o.isMesh && o.material.name === 'cm_obj_sconcegold') src = o;
  });
  if (!src?.geometry.index) return chandelier;
  src.updateMatrixWorld(true);
  const g = src.geometry;
  const idx = g.index.array;
  const pos = g.attributes.position;
  const keep = [];
  const take = [];
  const a = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(a.fromBufferAttribute(pos, idx[t + k]).applyMatrix4(src.matrixWorld));
    c.multiplyScalar(1 / 3);
    (CHANDELIER_BOX.containsPoint(c) ? take : keep).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  if (!take.length) return chandelier;
  // its triangles, in the world's coordinates, as a mesh of their own
  const part = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const arr = new Float32Array(take.length * attr.itemSize);
    for (let i = 0; i < take.length; i++) for (let k = 0; k < attr.itemSize; k++) arr[i * attr.itemSize + k] = attr.getComponent(take[i], k);
    part.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
  }
  part.applyMatrix4(src.matrixWorld);
  part.computeBoundingBox();
  g.setIndex(keep);
  const mesh = new THREE.Mesh(part, src.material);
  mesh.name = 'the ballroom chandelier';
  mesh.castShadow = src.castShadow;
  mesh.receiveShadow = src.receiveShadow;
  mesh.matrixAutoUpdate = false;
  (shell?.floor?.parent ?? model).add(mesh);
  shell?.meshes.push({ mesh, kind: 4 });
  const centre = part.boundingBox.getCenter(new THREE.Vector3());
  chandelier = { mesh, centre, top: part.boundingBox.max.y };
  return chandelier;
}

/** Hang the chandelier where it was, or lay it on the floor below (on its side, sunk in the wreck). */
function dropChandelier(down, floorY = 0.04) {
  if (!chandelier) return;
  const { mesh, centre } = chandelier;
  if (!down) {
    mesh.matrix.identity();
    mesh.matrixWorldNeedsUpdate = true;
    return;
  }
  // turned about a level axis (a little skew of the room's), its centre moved down to lie on the floor
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.94, 0, 0.34).normalize(), 1.15).multiply(new THREE.Quaternion().setFromAxisAngle(Y, 0.6));
  const turned = new THREE.Matrix4().makeRotationFromQuaternion(q).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));
  const box = chandelier.mesh.geometry.boundingBox.clone().applyMatrix4(turned);
  const at = new THREE.Vector3(centre.x - 0.35, floorY - box.min.y - 0.09, centre.z + 0.25);
  mesh.matrix.makeTranslation(at.x, at.y, at.z).multiply(turned);
  mesh.matrixWorldNeedsUpdate = true;
}

export class RoomDecay {
  /**
   * @param {THREE.Group} group  the scene's group
   * @param {object} o
   * @param {THREE.Object3D} o.model
   * @param {object} o.shell  shell.js's HouseShell
   * @param {(origin, dir, far) => ({point, normal, name}|null)} o.hit  rays meeting what is left in this scene
   * @param {object} o.landscape  (its obstacles)
   * @param {{x, z, r, top, floor}[]} [o.holes]  where the roof is open: its centre, radius, the roof's height, the floor under it
   * @param {boolean} [o.leaks]  the hall's ceiling leaking (puddles and drips there)
   * @param {number} [o.amount]  how far gone: 0.5 Fifty years, 1 A hundred
   * @param {number} [o.seed]
   */
  constructor(group, { model, shell, hit, landscape, holes = [], leaks = false, amount = 1, seed = 1, sound = null }) {
    this.group = new THREE.Group();
    this.group.name = 'The rooms';
    group.add(this.group);
    this.model = model;
    this.shell = shell;
    this.hit = hit;
    this.landscape = landscape;
    this.holes = holes;
    this.leaks = leaks;
    this.amount = amount;
    this.sound = sound;
    this.R = rng(seed);
    this.stats = {};
    this.drips = []; // points the rain drips from: { from: Vector3, to: y, puddle, rate, t }
    this.puddles = [];
    this.on = false;
    this.time = 0;
  }

  /** Is there floor at (x, y, z) in this scene? Its height, or null. */
  _floor(x, y, z, tol = 0.25) {
    const h = this.hit(new THREE.Vector3(x, y + 0.9, z), DOWN, 1.5);
    return h && h.normal.y > 0.7 && Math.abs(h.point.y - y) < tol ? h.point.y : null;
  }

  build() {
    const t0 = performance.now();
    this.mats = {
      linen: new THREE.MeshStandardMaterial({ map: linenPicture(), color: 0xe8e4d8, roughness: 1, side: THREE.DoubleSide }),
      plaster: decalMaterial(plasterPicture(), { alphaTest: 0.04, transparent: true, depthWrite: false }),
      lath: decalMaterial(lathPicture()),
      stain: decalMaterial(stainPicture(), { alphaTest: 0.08, transparent: true, depthWrite: false }),
      bare: decalMaterial(bareWallPicture()),
      paper: new THREE.MeshStandardMaterial({ map: paperPicture(), color: 0xc8c2b4, alphaTest: 0.4, roughness: 0.9, side: THREE.DoubleSide }),
      droppings: decalMaterial(droppingsPicture(), { alphaTest: 0.05, transparent: true, depthWrite: false }),
      lump: new THREE.MeshStandardMaterial({ color: 0xd2cabb, roughness: 1 }),
    };
    this.decals = { plaster: [], lath: [], stain: [], bare: [], droppings: [] };
    this.lumps = [];
    this._sheets();
    this._ballroom();
    this._plaster();
    this._paper();
    this._chandelier();
    this._birds();
    this._puddles();
    // each kind of decal in one draw
    for (const [k, list] of Object.entries(this.decals)) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeometries(list), this.mats[k]);
      m.receiveShadow = true;
      m.name = k;
      this.group.add(m);
      this.stats[k] = list.length;
    }
    if (this.lumps.length) {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mats.lump, this.lumps.length);
      this.lumps.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = im.receiveShadow = true;
      this.group.add(im);
    }
    this.stats.ms = Math.round(performance.now() - t0);
  }

  // --- dust sheets -----------------------------------------------------------------------------

  _sheets() {
    let n = 0;
    for (const [y, x0, x1, z0, z1] of BLOBS) {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // (its floor still there: a ray from just above it, under the furniture's top)
      const under = this.hit(new THREE.Vector3(cx, y + 0.12, cz), DOWN, 0.4) ?? this.hit(new THREE.Vector3(x0 - 0.15, y + 0.12, z0 - 0.15), DOWN, 0.4);
      if (!under || under.normal.y < 0.7) continue; // (its floor has gone)
      const fy = Math.min(under.point.y, y + 0.02);
      const origin = new THREE.Vector3(0, fy, 0);
      const ray = new THREE.Vector3();
      const g = drapeField(
        (u, v) => {
          const h = this.hit(ray.set(u, fy + 1.35, v), DOWN, 1.6);
          return h ? Math.max(0, h.point.y - fy) + 0.02 : 0;
        },
        x0 - 0.25,
        x1 + 0.25,
        z0 - 0.25,
        z1 + 0.25,
        { origin, step: 0.05, seed: 100 + n },
      );
      const m = new THREE.Mesh(g, this.mats.linen);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      n++;
    }
    this.stats.sheets = n;
  }

  /** The empty ballroom: what was pushed to the walls when the dancing stopped, under sheets. */
  _ballroom() {
    const R = this.R;
    const put = (x, z, rot, parts, seed) => {
      const fy = this._floor(x, 0.04, z);
      if (fy === null) return;
      const ext = Math.max(...parts.map((p) => Math.max(-p.u0, p.u1, -p.v0, p.v1))) + 0.25;
      const m = new THREE.Mesh(drapeField(boxes(parts), -ext, ext, -ext, ext, { origin: new THREE.Vector3(x, fy, z), rot, seed }), this.mats.linen);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      this.landscape?.obstacles?.push({ x, z, r: ext * 0.7, when: () => this.on });
    };
    // a grand piano at the west end (its lid down, the curve of it under the sheet)
    const piano = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const w = 0.75 * (1 - 0.45 * t * t);
      piano.push({ u0: -0.8 + t * 1.75, u1: -0.8 + (t + 0.1) * 1.75, v0: -w, v1: w * (1 - 0.6 * t), h: 1.0 });
    }
    put(-5.6, -29.6, 0.3, piano, 201);
    // a settee against the north wall, two armchairs by it
    put(-1.5, -30.75, 0, [
      { u0: -0.95, u1: 0.95, v0: -0.4, v1: 0.4, h: 0.45 },
      { u0: -0.95, u1: 0.95, v0: 0.2, v1: 0.4, h: 0.9 },
      { u0: -0.95, u1: -0.78, v0: -0.4, v1: 0.4, h: 0.65 },
      { u0: 0.78, u1: 0.95, v0: -0.4, v1: 0.4, h: 0.65 },
    ], 202);
    const chair = [
      { u0: -0.24, u1: 0.24, v0: -0.24, v1: 0.24, h: 0.46 },
      { u0: -0.24, u1: 0.24, v0: 0.12, v1: 0.24, h: 0.95 },
    ];
    // the little gilt chairs in a row along the south wall, under sheets, some stacked
    for (let x = 2.2; x < 11; x += 0.75 + R() * 0.2) {
      const stacked = R() < 0.3;
      put(x, -24.72, Math.PI + (R() - 0.5) * 0.15, stacked ? [...chair, { u0: -0.22, u1: 0.22, v0: -0.22, v1: 0.22, h: 1.35 }] : chair, 210 + Math.floor(x * 10));
    }
    put(9.6, -30.7, 0.05, [{ u0: -0.8, u1: 0.8, v0: -0.3, v1: 0.3, h: 0.95 }], 220); // (a sideboard)
  }

  // --- plaster and paper -------------------------------------------------------------------------

  _plaster() {
    const R = this.R;
    const want = Math.round(10 + 22 * this.amount);
    let n = 0;
    for (let tries = 0; tries < FLOORS.length && n < want; tries++) {
      const [x, y, z, ch] = FLOORS[Math.floor(R() * FLOORS.length)];
      if (y > 0.5 && R() < 0.35) continue; // (more of it in the big rooms below)
      const fy = this._floor(x, y, z);
      if (fy === null) continue;
      // the ceiling above: still there in this scene, and flat
      const c = this.hit(new THREE.Vector3(x, fy + 0.4, z), Y, ch + 0.5);
      if (!c || Math.abs(c.normal.y) < 0.8 || c.point.y - fy < 2) continue;
      const size = 0.5 + R() * 0.7;
      const k = Math.floor(R() * 4);
      this.decals.plaster.push(decal(new THREE.Vector3(x, fy, z), Y, size * 1.5, size * 1.5, k, R() * 6));
      this.decals.lath.push(decal(new THREE.Vector3(x + (R() - 0.5) * 0.3, c.point.y, z + (R() - 0.5) * 0.3), DOWN, size, size * (0.7 + R() * 0.5), Math.floor(R() * 4), R() * 6, 0.008));
      // lumps of it
      for (let i = 0; i < 6; i++) {
        const a = R() * 6.28;
        const r = R() * size * 0.5;
        const s = 0.04 + R() * 0.09;
        _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, R() * 6, (R() - 0.5) * 0.5));
        this.lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * r, fy + s * 0.18, z + Math.sin(a) * r), _q, new THREE.Vector3(s, s * 0.3, s * (0.6 + R() * 0.6))));
      }
      n++;
    }
    this.stats.plaster = n;
  }

  _paper() {
    const R = this.R;
    const strips = [];
    let n = 0;
    const want = Math.round(WALLS.length * (0.14 + 0.2 * this.amount));
    const order = WALLS.map((w, i) => [R(), i]).sort((a, b) => a[0] - b[0]).map((p) => WALLS[p[1]]);
    // is the wall there, flat, at this height (and not an arch or an opening)? Its point, or null
    const wallAt = (p, nrm, y, d0) => {
      const h = this.hit(new THREE.Vector3(p.x, y, p.z).addScaledVector(nrm, 0.4), nrm.clone().negate(), 0.7);
      if (!h || Math.abs(h.normal.y) > 0.3 || (d0 !== undefined && Math.abs(h.distance - d0) > 0.04)) return null;
      return h;
    };
    for (const [x, fy, z, nx, nz, ch] of order) {
      if (n >= want) break;
      const nrm = new THREE.Vector3(nx, 0, nz);
      const along = new THREE.Vector3(-nz, 0, nx);
      const base = new THREE.Vector3(x, 0, z);
      const h = wallAt(base, nrm, fy + 1.6);
      if (!h) continue;
      // (paper only up to a room's height: a tall wall's top is panelling, not paper)
      const top = fy + Math.min(ch - 0.05, 3.2);
      const w = 0.8 + R() * 0.9;
      // the wall flat all the way up, and either side of the patch
      if (![top - 0.1, top - 1.2, fy + 1.0].every((y) => [-w * 0.4, 0, w * 0.4].every((s) => wallAt(base.clone().addScaledVector(along, s), nrm, y, h.distance)))) continue;
      const p = h.point.clone();
      this.decals.stain.push(decal(p.clone().setY(top - w * 0.8), nrm, w * 1.1, w * 1.6, Math.floor(R() * 4), Math.PI, 0.004));
      const off = p.clone().addScaledVector(along, (R() - 0.5) * 0.4).setY(top - 0.15);
      const count = 1 + (R() < 0.35 * this.amount ? 1 : 0);
      const bh = 0.5 + R() * 0.5;
      this.decals.bare.push(decal(off.clone().setY(off.y - bh / 2), nrm, 0.42 * count + 0.15, bh, Math.floor(R() * 4), 0, 0.008));
      for (let i = 0; i < count; i++) {
        const len = 0.35 + R() * 0.6 * this.amount;
        const sw = 0.3 + R() * 0.12;
        const at = off.clone().addScaledVector(along, (i - (count - 1) / 2) * sw * 1.04);
        strips.push(this._strip(at, nrm, along, sw, len, R));
      }
      n++;
    }
    if (strips.length) {
      const m = new THREE.Mesh(mergeGeometries(strips), this.mats.paper);
      m.castShadow = m.receiveShadow = true;
      m.name = 'wallpaper coming off';
      this.group.add(m);
    }
    this.stats.walls = n;
    this.stats.strips = strips.length;
  }

  /** A strip of paper fixed at its top on the wall, peeling away below and curling over. */
  _strip(top, nrm, along, w, len, R) {
    const seg = 10;
    const g = new THREE.PlaneGeometry(w, len, 2, seg);
    const pos = g.attributes.position;
    const curl = 0.3 + R() * 0.7;
    const twist = (R() - 0.5) * 0.5;
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i); // across
      const t = (len / 2 - pos.getY(i)) / len; // 0 at the top, 1 at the end
      // away from the wall more and more, curling up and back at the end
      const outward = 0.012 + curl * len * 0.45 * t * t + Math.sin(t * Math.PI * 0.9) * 0.04;
      const drop = len * t - curl * len * 0.22 * Math.pow(t, 3);
      p.copy(top).addScaledVector(along, u + twist * t * u * 0.4).addScaledVector(nrm, outward + u * twist * t * 0.3);
      p.y -= drop;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // --- the chandelier ------------------------------------------------------------------------------

  _chandelier() {
    const ch = splitChandelier(this.model, this.shell);
    if (!ch) return;
    const fy = this._floor(ch.centre.x, 0.04, ch.centre.z);
    this.chandelierFloor = fy;
    if (fy === null) return;
    const R = this.R;
    const ceiling = 3.31;
    const gilt = ch.mesh.material;
    // the chain, broken, from the torn rose
    const link = new THREE.TorusGeometry(0.028, 0.008, 5, 10);
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(link, gilt);
      l.position.set(ch.centre.x, ceiling - 0.05 - i * 0.048, ch.centre.z);
      // (a torus stands upright in its own plane: each link turned a quarter from the last)
      l.rotation.set(0, (i % 2) * Math.PI / 2, 0);
      l.scale.set(1, 1.5, 1);
      l.castShadow = true;
      this.group.add(l);
    }
    this.decals.lath.push(decal(new THREE.Vector3(ch.centre.x, ceiling, ch.centre.z), DOWN, 1.3, 1.1, 1, 0.4, 0.009));
    this.decals.plaster.push(decal(new THREE.Vector3(ch.centre.x - 0.2, fy, ch.centre.z + 0.2), Y, 3.0, 3.0, 2, 1.2));
    // its drops, scattered round it
    const drops = [];
    for (let i = 0; i < 110; i++) {
      const a = R() * 6.28;
      const r = Math.pow(R(), 0.8) * 1.9;
      const s = 0.012 + R() * 0.02;
      _q.setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
      drops.push(new THREE.Matrix4().compose(new THREE.Vector3(ch.centre.x - 0.35 + Math.cos(a) * r, fy + s * 0.6, ch.centre.z + 0.25 + Math.sin(a) * r), _q, new THREE.Vector3(s, s * 1.8, s)));
    }
    const glass = new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.05, metalness: 0.2, envMapIntensity: 2.2 });
    const im = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), glass, drops.length);
    drops.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.receiveShadow = true;
    this.group.add(im);
    for (let i = 0; i < 26; i++) {
      const a = R() * 6.28;
      const r = R() * 1.3;
      const s = 0.05 + R() * 0.12;
      _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.6, R() * 6, (R() - 0.5) * 0.6));
      this.lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(ch.centre.x + Math.cos(a) * r, fy + s * 0.15, ch.centre.z + Math.sin(a) * r), _q, new THREE.Vector3(s, s * 0.25, s * 0.8)));
    }
    this.landscape?.obstacles?.push({ x: ch.centre.x - 0.35, z: ch.centre.z + 0.25, r: 0.9, when: () => this.on });
  }

  // --- the birds that have come in -------------------------------------------------------------------

  _birds() {
    const R = this.R;
    this.nests = [];
    const twig = new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 1 });
    const nestGeo = new THREE.TorusGeometry(0.13, 0.055, 6, 14);
    {
      const p = nestGeo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + (R() - 0.5) * 0.25), p.getY(i) * (1 + (R() - 0.5) * 0.3), p.getZ(i) + (R() - 0.5) * 0.03);
      nestGeo.rotateX(Math.PI / 2);
      nestGeo.computeVertexNormals();
    }
    for (const hole of this.holes) {
      // nests on what is level round the rim (wall tops, the ends of joists)
      let made = 0;
      if (hole.open === false) {
        // (under a hole that only lets the weather in, on the attic floor below it)
        for (let k = 0; k < 2; k++) {
          const a = R() * 6.28;
          const r = hole.r * (0.6 + R() * 0.8);
          const fl = this.hit(new THREE.Vector3(hole.x + Math.cos(a) * r, hole.floor + 0.8, hole.z + Math.sin(a) * r), DOWN, 1.6);
          if (!fl || fl.normal.y < 0.8) continue;
          const nest = new THREE.Mesh(nestGeo, twig);
          nest.position.copy(fl.point).add(new THREE.Vector3(0, 0.04, 0));
          nest.castShadow = true;
          this.group.add(nest);
          this.nests.push(nest.position.clone());
        }
      }
      for (let k = 0; k < 24 && made < 2 && hole.open !== false; k++) {
        const a = R() * 6.28;
        const r = hole.r * (1.05 + R() * 0.5);
        const x = hole.x + Math.cos(a) * r;
        const z = hole.z + Math.sin(a) * r;
        const h = this.hit(new THREE.Vector3(x, hole.top - 0.6, z), DOWN, hole.top - hole.floor);
        if (!h || h.normal.y < 0.8 || h.point.y < hole.floor + 1.5) continue;
        const nest = new THREE.Mesh(nestGeo, twig);
        nest.position.copy(h.point).add(new THREE.Vector3(0, 0.04, 0));
        nest.castShadow = true;
        this.group.add(nest);
        this.nests.push(nest.position.clone());
        // the droppings under it, on the floor (or the heap)
        const below = this.hit(h.point.clone().add(new THREE.Vector3(0, -0.2, 0)), DOWN, 12);
        if (below) this.decals.droppings.push(decal(below.point, below.normal, 1.1, 1.1, Math.floor(R() * 4), R() * 6, 0.01));
        made++;
      }
      // and droppings spread on the floor below the hole
      for (let i = 0; i < 3; i++) {
        const a = R() * 6.28;
        const r = hole.r * (0.6 + R() * 0.6);
        const fl = this.hit(new THREE.Vector3(hole.x + Math.cos(a) * r, hole.floor + 1.2, hole.z + Math.sin(a) * r), DOWN, 2.5);
        if (fl) this.decals.droppings.push(decal(fl.point, fl.normal, 0.9, 0.9, Math.floor(R() * 4), R() * 6, 0.01));
      }
    }
    this.stats.nests = this.nests.length;
    // pigeons sitting on them, and a few flying in and out through the holes
    if (this.nests.length) {
      new GLTFLoader()
        .loadAsync('animals/pigeon.glb')
        .then((g) => {
          this.perched = this.nests.slice(0, 3).map((p, i) => {
            const a = animal(g, 0.34, { axis: 'xz', tint: new THREE.Color(0.42, 0.44, 0.5) });
            a.holder.position.copy(p).add(new THREE.Vector3(0, 0.06, 0));
            a.holder.rotation.y = i * 2.1;
            this.group.add(a.holder);
            return { a, yaw: i * 2.1, next: 2 + Math.random() * 4 };
          });
        })
        .catch(() => {});
    }
    const open = this.holes.filter((h) => h.open !== false);
    if (open.length) {
      this.flock = new Flock(this.group, 4, { colour: 0x50545c, length: 0.34, span: 0.66 });
      this.flock.group.removeFromParent();
      this.group.add(this.flock.group);
      this.flyers = [0, 1, 2, 3].map((i) => ({ hole: open[i % open.length], ph: R() * 6.28, speed: 0.35 + R() * 0.2, r: 5 + R() * 4 }));
    }
  }

  // --- the rain coming in ------------------------------------------------------------------------------

  _puddles() {
    const R = this.R;
    const water = new THREE.MeshStandardMaterial({ color: 0x24221e, roughness: 0.1, metalness: 0.05, envMapIntensity: 0.55, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.mats.water = water;
    const puddle = (x, z, fy, r, from) => {
      const shape = new THREE.Shape();
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k = r * (0.7 + 0.45 * Math.sin(a * 2 + x) * 0.5 + R() * 0.25);
        const px = Math.cos(a) * k * 1.3;
        const pz = Math.sin(a) * k;
        if (i === 0) shape.moveTo(px, pz);
        else shape.lineTo(px, pz);
      }
      const g = new THREE.ShapeGeometry(shape, 4);
      g.rotateX(-Math.PI / 2);
      g.rotateY(R() * 6);
      const m = new THREE.Mesh(g, water);
      m.position.set(x, fy + 0.008, z);
      m.receiveShadow = true;
      this.group.add(m);
      const p = { x, z, y: fy + 0.01, r };
      this.puddles.push(p);
      // a drip into it from above
      if (from) this.drips.push({ from: new THREE.Vector3(x + (R() - 0.5) * r * 0.5, from, z + (R() - 0.5) * r * 0.5), to: fy + 0.01, puddle: p, rate: 0.6 + R() * 1.4, t: R() * 2, y: from, falling: false });
    };
    for (const hole of this.holes) {
      // beside the heap, where the water runs off it
      for (let i = 0; i < 3; i++) {
        const a = R() * 6.28;
        const r = hole.r * (0.85 + R() * 0.45);
        const x = hole.x + Math.cos(a) * r;
        const z = hole.z + Math.sin(a) * r;
        const fl = this.hit(new THREE.Vector3(x, hole.floor + 1.2, z), DOWN, 2.5);
        if (!fl || fl.normal.y < 0.9) continue;
        // (from the broken roof's edge above it, if there is any; else straight from the sky)
        const up = this.hit(fl.point.clone().add(new THREE.Vector3(0, 0.3, 0)), Y, 20);
        puddle(x, z, fl.point.y, 0.35 + R() * 0.45, up ? up.point.y - 0.02 : hole.top);
      }
    }
    // the hall: the ceiling leaking in a few places
    if (this.leaks) {
      for (const [x, z] of [
        [-2.2, -16.9],
        [-0.6, -18.6],
        [-3.4, -13.2],
        [0.4, -12.9],
      ]) {
        const fy = this._floor(x, 0.04, z);
        if (fy === null) continue;
        const up = this.hit(new THREE.Vector3(x, fy + 0.5, z), Y, 12);
        puddle(x, z, fy, 0.3 + R() * 0.3, up ? up.point.y - 0.02 : null);
      }
    }
    // the falling drops: a few streaks per drip point, and the curtain of rain through each hole
    const streak = new THREE.BoxGeometry(0.006, 0.16, 0.006);
    const mat = new THREE.MeshBasicMaterial({ color: 0xc8d4dc, transparent: true, opacity: 0.55, depthWrite: false });
    this.rainDrops = [];
    for (const hole of this.holes) for (let i = 0; i < (hole.open === false ? 0 : 70); i++) this.rainDrops.push({ hole, x: 0, z: 0, y: -1, end: 0, v: 0 });
    this.dropMesh = new THREE.InstancedMesh(streak, mat, Math.max(1, this.drips.length + this.rainDrops.length));
    this.dropMesh.frustumCulled = false;
    this.dropMesh.count = 0;
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.dropMesh);
    // rings spreading on the puddles where a drop lands
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xdfe8ee, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      this.group.add(m);
      this.rings.push({ m, t: 1 });
    }
    this.ringAt = 0;
    this.stats.puddles = this.puddles.length;
    this.stats.drips = this.drips.length;
  }

  _ring(x, y, z) {
    const r = this.rings[this.ringAt++ % this.rings.length];
    r.t = 0;
    r.m.position.set(x, y + 0.004, z);
    r.m.visible = true;
  }

  set(on) {
    this.on = on;
    this.group.visible = on;
    if (chandelier) dropChandelier(on && this.chandelierFloor != null, this.chandelierFloor ?? 0.04);
    if (!on && this.sound) this.sound.rainIn = 0;
  }

  /** @param {object} o  rain (0..1), camera */
  update(dt, { rain = 0, camera = null } = {}) {
    if (!this.on || !this.mats) return;
    this.time += dt;
    const t = this.time;
    const cam = camera?.position;
    // the puddles darker and glossier when it rains
    // pigeons: a turn of the head now and then, a coo
    for (const p of this.perched ?? []) {
      p.next -= dt;
      if (p.next <= 0) {
        p.yaw += (Math.random() - 0.5) * 1.6;
        p.next = 1.5 + Math.random() * 5;
        if (Math.random() < 0.18 && cam && cam.distanceTo(p.a.holder.position) < 30) this.sound?.sample(Math.random() < 0.5 ? 'woodpigeon' : 'dove', p.a.holder.position, { ref: 4, gain: 0.5 });
      }
      p.a.holder.rotation.y += (p.yaw - p.a.holder.rotation.y) * Math.min(1, dt * 6);
    }
    // the flyers: wheeling over the roof, now and then down through a hole into the house and up again
    if (this.flock) {
      this.flyers.forEach((f, i) => {
        f.ph += dt * f.speed;
        const a = f.ph;
        const dive = Math.pow(Math.max(0, Math.sin(a * 0.5 + i)), 8); // (one loop in a few goes in)
        const r = THREE.MathUtils.lerp(f.r, f.hole.r * 0.25, dive);
        const y = THREE.MathUtils.lerp(f.hole.top + 2.5 + Math.sin(a * 1.7) * 1.2, f.hole.floor + 2.4, dive);
        const p = _v.set(f.hole.x + Math.cos(a) * r, y, f.hole.z + Math.sin(a) * r);
        const prev = f.last ?? p.clone();
        const vel = p.clone().sub(prev);
        if (vel.lengthSq() < 1e-8) vel.set(-Math.sin(a), 0, Math.cos(a));
        f.last = p.clone();
        this.flock.set(i, p, vel, Math.sin(t * 14 + i * 2) * 0.7);
      });
      this.flock.show(this.flyers.length);
    }
    // the drips and the rain through the holes
    const wet = rain > 0.04;
    let n = 0;
    const m = this.dropMesh;
    if (m) {
      for (const d of this.drips) {
        if (!wet) break;
        if (!d.falling) {
          d.t -= dt * d.rate * (0.4 + rain);
          if (d.t <= 0) {
            d.falling = true;
            d.y = d.from.y;
            d.v = 0;
          }
        } else {
          d.v += 9.8 * dt;
          d.y -= d.v * dt;
          if (d.y <= d.to) {
            d.falling = false;
            d.t = 1;
            this._ring(d.from.x, d.to, d.from.z);
            if (cam && cam.distanceTo(d.from) < 16) this.sound?.drip?.(_v.set(d.from.x, d.to, d.from.z), 0.7);
            continue;
          }
          _m.compose(_s.set(d.from.x, d.y, d.from.z), _q.identity(), new THREE.Vector3(1, 0.6 + Math.min(2, d.v * 0.15), 1));
          m.setMatrixAt(n++, _m);
        }
      }
      for (const d of this.rainDrops) {
        if (!wet) break;
        if (d.y < d.end) {
          if (Math.random() > rain * 0.9) continue;
          const h = d.hole;
          const a = Math.random() * 6.28;
          const r = Math.sqrt(Math.random()) * h.r * 0.85;
          d.x = h.x + Math.cos(a) * r;
          d.z = h.z + Math.sin(a) * r;
          d.y = h.top + Math.random() * 3;
          // (onto the heap of what fell, in the middle)
          const k = Math.max(0, 1 - (r / (h.r * 0.75)) ** 2);
          d.end = h.floor + 0.8 * Math.sqrt(k);
          d.v = 7 + Math.random() * 2;
        }
        d.y -= d.v * dt;
        _m.compose(_s.set(d.x, d.y, d.z), _q.identity(), new THREE.Vector3(1, 3, 1));
        m.setMatrixAt(n++, _m);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    for (const r of this.rings ?? []) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt * 1.4);
      r.m.scale.setScalar(0.02 + r.t * 0.22);
      r.m.material.opacity = 0.5 * (1 - r.t);
      if (r.t >= 1) r.m.visible = false;
    }
    // the rain louder near the holes (heard through them, and on the wreck under them)
    if (this.sound && cam) {
      let near = 0;
      for (const h of this.holes) if (h.open !== false) near = Math.max(near, 1 - THREE.MathUtils.smoothstep(Math.hypot(cam.x - h.x, cam.z - h.z), h.r, h.r + 7));
      this.sound.rainIn = near * (wet ? 1 : 0);
    }
  }
}
