// A hundred years empty (Scenes › Sights): between Fifty and Two hundred years empty. An afternoon in
// early September. The house still stands, roofed and glazed for the most part, but it is going: in
// three places the roof has fallen in, down through the floors under it to the ground floor, the
// rafters broken off round the holes and the wreck (slates, joists, plaster) in heaps below; and at
// the east end of the front a corner of the wing has come down, its brick in a heap at its foot. A
// few of the windows are broken, some boarded, most only filthy. Ivy up to the parapets, the lawns
// gone to rank grass with young sycamores and birch five to eight metres high in it, brambles, a
// tree down, the fountain dry with its rim cracked and the tip of the dolphin's tail gone, gaps in
// the estate's walls. Inside, in the hall, everything someone meant to take away and never came back
// for: the paintings off the walls, stacked against the walls under dust sheets (a few uncovered,
// their gilt frames showing), and the furniture brought down to the hall under sheets (a sofa,
// armchairs, a sideboard, a table with the chairs upturned on it, a wardrobe, a piano), packing
// cases and rolled carpets. Someone has come in to explore it (trespass.js). Crows, the wind, the
// house creaking and a shutter banging.
//
// It grows on Fifty years empty (abandoned.js); the house is cut in its own shaders (shell.js mode 3:
// the holes and the fallen corner are uniforms, uHoles and uBreach).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { seasonUniforms } from './season.js';
import { Abandoned, rng, instanced, ivyPicture, boardPicture, litterPicture, barkPicture, deadLeafPicture } from './abandoned.js';
import { HOUSE, inHouse, inHole, breachTop } from './shell.js';

const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
// the corner that has come down: the east end of the front (x, z, radius, how high it stands at its middle)
const BREACH = new THREE.Vector4(21.3, -13.9, 4.2, 2.4);

/** Linen: an old dust sheet, off-white, its weave and grey dust lying in it. */
function linenPicture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Rubble: broken brick and lumps of mortar and plaster, dusty. */
function rubblePicture(seed, plaster = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const R = rng(seed);
  g.fillStyle = plaster ? '#8a8274' : '#6a4a3a';
  g.fillRect(0, 0, 256, 256);
  const cols = plaster ? ['#c8c0b0', '#b0a898', '#9a8e7c', '#6a5a4a', '#d8d0c0'] : ['#8a4a36', '#7a3e2c', '#a05a42', '#5a3428', '#b8ae9a', '#9a8a78'];
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = cols[Math.floor(R() * cols.length)];
    const x = R() * 256;
    const y = R() * 256;
    g.save();
    g.translate(x, y);
    g.rotate(R() * 3);
    g.fillRect(-3 - R() * 6, -2 - R() * 3, 6 + R() * 10, 4 + R() * 5);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

/** A rolled carpet's outside: a border of reds and blues. */
function carpetPicture(seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  const R = rng(seed);
  const cols = ['#7a2a22', '#2c3a5a', '#8a6a3a', '#5a1e1a', '#3a4a3a'];
  g.fillStyle = cols[Math.floor(R() * cols.length)];
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = cols[Math.floor(R() * cols.length)];
    g.fillRect(R() * 256, 0, 3 + R() * 10, 64);
  }
  g.fillStyle = 'rgba(200, 180, 140, 0.35)';
  for (let x = 0; x < 256; x += 16) g.fillRect(x, 28, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A dust sheet thrown over boxes (the shapes of a piece of furniture): a height field in the frame
 * `basis` (u along, v across, n up from the floor or out from the wall), each point as high as what
 * is under it, softened so it falls over the edges in folds to the floor round it.
 */
function drape(parts, { margin = 0.3, step = 0.045, basis = null, origin = new THREE.Vector3(), seed = 1 } = {}) {
  // parts: { u0, u1, v0, v1, h } in the frame's own coordinates
  const u0 = Math.min(...parts.map((p) => p.u0)) - margin;
  const u1 = Math.max(...parts.map((p) => p.u1)) + margin;
  const v0 = Math.min(...parts.map((p) => p.v0)) - margin;
  const v1 = Math.max(...parts.map((p) => p.v1)) + margin;
  const nu = Math.max(2, Math.ceil((u1 - u0) / step));
  const nv = Math.max(2, Math.ceil((v1 - v0) / step));
  let H = new Float32Array((nu + 1) * (nv + 1));
  const at = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (i / nu) * (u1 - u0);
      const v = v0 + (j / nv) * (v1 - v0);
      let h = 0;
      for (const p of parts) if (u >= p.u0 && u <= p.u1 && v >= p.v0 && v <= p.v1) h = Math.max(h, p.h);
      H[at(i, j)] = h;
    }
  const base = H.slice();
  // (softened: the sheet falls over each edge and spreads at the foot, never below what it covers)
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
  const pos = [];
  const uv = [];
  const idx = [];
  const bu = basis?.u ?? new THREE.Vector3(1, 0, 0);
  const bv = basis?.v ?? new THREE.Vector3(0, 0, 1);
  const bn = basis?.n ?? new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (i / nu) * (u1 - u0);
      const v = v0 + (j / nv) * (v1 - v0);
      let h = H[at(i, j)];
      // folds where it hangs, the hem lying on the floor
      const slope = Math.abs(H[at(Math.min(nu, i + 1), j)] - H[at(Math.max(0, i - 1), j)]) + Math.abs(H[at(i, Math.min(nv, j + 1))] - H[at(i, Math.max(0, j - 1))]);
      h += Math.min(1, slope * 6) * 0.025 * Math.sin(u * 23 + ph[0] + Math.sin(v * 7 + ph[1]) * 2) + 0.012 * Math.sin(v * 31 + ph[2]);
      h = Math.max(0.008, h);
      p.copy(origin).addScaledVector(bu, u).addScaledVector(bv, v).addScaledVector(bn, h);
      pos.push(p.x, p.y, p.z);
      uv.push(u * 1.3, v * 1.3);
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i, j + 1);
      const d = at(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Century extends Abandoned {
  /** As Abandoned, with `shell` (shell.js's HouseShell) and `model` (for its paintings). */
  constructor(scene, opts) {
    super(scene, opts);
    this.shell = opts.shell;
    this.group.name = 'A hundred years empty';
    Object.assign(this.k, {
      boardLow: 0.22, boardHigh: 0.05, brokenLow: 0.3, brokenHigh: 0.2, roofHoles: 3, ivyReach: 1.45,
      saplings: 80, saplingSize: 2.4,
      saplingLeaves: ['#22381a', '#2d4a1c', '#375a20', '#3e6424', '#4a6e2a', '#5a6a26', '#6a6a22'],
    });
    this.holes = [];
  }

  /** Rays meet only what is left of the house a hundred years on. */
  _hit(origin, dir, far) {
    return this.shell.hit(origin, dir, far, 3);
  }

  set(on) {
    if (on === this.on) return;
    this.on = on;
    if (on && !this.built) this._build();
    this._uniforms(on);
    this.group.visible = on;
    seasonUniforms.uDecay.value = on ? 1 : 0;
    this.shell?.setMode(on ? 3 : 0);
    if (this.glass) this.glass.visible = !on;
    if (this.pond) this.pond.mesh.visible = !on;
    if (this.sound) this.sound.abandoned = on;
    this.garden?.group.traverse((o) => o.userData.tidy && (o.visible = !on));
    if (on) this.next = { crow: 2 + Math.random() * 3, creak: 5 + Math.random() * 6, bang: 15 + Math.random() * 20 };
    this._trespass(on, 3, true);
  }

  /** The holes in the roof and the fallen corner, for the house's shaders (and shell.js's rays). */
  _uniforms(on) {
    const H = seasonUniforms.uHoles.value;
    H.forEach((h, i) => {
      const o = on ? this.holes[i] : null;
      h.set(o ? o.x : 0, o ? o.z : 0, o ? o.r : 0, 0);
    });
    seasonUniforms.uBreach.value.copy(on ? BREACH : new THREE.Vector4(0, 0, 0, 0));
  }

  _build() {
    const t0 = performance.now();
    this.built = true;
    this.R = rng(19260905);
    this.light = !!window.matchMedia?.('(pointer: coarse)').matches;
    this.pictures = { ivy: ivyPicture(), board: boardPicture(), litter: litterPicture(), bark: barkPicture(), leaf: deadLeafPicture() };
    this.stats = {};
    this._chooseHoles();
    this._uniforms(true); // (the rays below must already see the holes)
    this._findWindows();
    // (no pane, no board where the wall has come down)
    this.windows = this.windows.filter((w) => w.box.max.y < breachTop(w.centre.x, w.centre.z) - 0.2);
    this._windows();
    this._roof();
    this._ivy();
    this._grass();
    this._brambles();
    this._saplings();
    this._fallenTree();
    this._branches();
    this._fountain();
    this._gate();
    this._driftingLeaves();
    this._wreck();
    this._hall();
    this._uniforms(this.on);
    this.stats.ms = Math.round(performance.now() - t0);
    console.info('a hundred years empty', JSON.stringify(this.stats));
  }

  // --- where the roof has fallen in ------------------------------------------------------------

  /** Three places on the roof, well apart, two on the front slopes where you see them from the lawn. */
  _chooseHoles() {
    const R = this.R;
    const ray = new THREE.Ray();
    const cands = [];
    for (let i = 0; i < 1500; i++) {
      const x = THREE.MathUtils.lerp(-9, 16.5, R());
      const z = THREE.MathUtils.lerp(-30.5, -11, R());
      ray.origin.set(x, 40, z);
      ray.direction.copy(DOWN);
      const h = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
      if (!h || this.materialAt(h.faceIndex) !== 'cm_roof') continue;
      const n = h.face.normal.clone();
      if (n.y < 0) n.negate();
      if (n.y < 0.3 || n.y > 0.92) continue;
      cands.push({ x, z, front: n.z > 0.2, y: h.point.y });
    }
    const radii = [3.2, 2.6, 2.2];
    const picked = [];
    // (the front slopes nearest the lawn first, then the rest)
    const order = [...cands.filter((c) => c.front && c.z > -19).sort((p, q) => q.z - p.z + (R() - 0.5) * 3), ...cands.filter((c) => c.front && c.z <= -19), ...cands.filter((c) => !c.front)];
    for (const c of order) {
      if (picked.length >= 3) break;
      const r = radii[picked.length];
      if (picked.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > p.r + r + 4)) picked.push({ ...c, r });
    }
    this.holes = picked;
    this.stats.holes = picked.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, p.r]);
  }

  /**
   * The wreck: under each hole a heap of what came down (slates, broken joists and rafters, plaster)
   * on the ground floor, and round its rim the rafters broken off, still fixed in the roof that is
   * left; at the fallen corner its brick in a heap, inside and out.
   */
  _wreck() {
    const R = this.R;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const timber = [];
    const slates = [];
    const lumps = [];
    const lumpCols = [];
    const heaps = [];
    const mound = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    {
      const p = mound.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (0.8 + 0.35 * Math.sin(p.getX(i) * 5.1 + p.getZ(i) * 3.7) * Math.cos(p.getZ(i) * 4.3)));
      mound.computeVertexNormals();
    }
    const floorAt = (x, z) => this._hit(new THREE.Vector3(x, 2.1, z), DOWN, 3)?.point.y ?? (inHouse(x, z) ? -0.06 : this.ground(x, z));
    const scatter = (x, z, r, n, colours, size) => {
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2;
        const rr = Math.sqrt(R()) * r;
        const px = x + Math.cos(a) * rr;
        const pz = z + Math.sin(a) * rr;
        _q.setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
        const s = size * (0.5 + R());
        lumps.push(new THREE.Matrix4().compose(new THREE.Vector3(px, floorAt(px, pz) + s * 0.3, pz), _q, _s.set(s, s * 0.6, s * 0.8)));
        lumpCols.push(colours[Math.floor(R() * colours.length)]);
      }
    };
    for (const h of this.holes) {
      const y0 = floorAt(h.x, h.z);
      // the heap: a mound, slates over it, broken timbers sticking out of it at all angles
      _q.setFromAxisAngle(Y, R() * 6);
      heaps.push(new THREE.Matrix4().compose(new THREE.Vector3(h.x, y0 - 0.05, h.z), _q, _s.set(h.r * 0.75, 0.7 + R() * 0.4, h.r * 0.6)));
      for (let i = 0; i < 26; i++) {
        const a = R() * Math.PI * 2;
        const rr = Math.sqrt(R()) * h.r * 0.8;
        const len = 1.2 + R() * 2.8;
        const lean = 0.15 + R() * 0.7;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.28, Math.PI / 2 - lean, 'YXZ'));
        const c = new THREE.Vector3(h.x + Math.cos(a) * rr, y0 + 0.25 + Math.sin(lean) * len * 0.35, h.z + Math.sin(a) * rr);
        timber.push(new THREE.Matrix4().compose(c, q, R() < 0.5 ? _s.set(0.07, len, 0.18) : _s.set(0.06, len, 0.14)));
      }
      for (let i = 0; i < 70; i++) {
        const a = R() * Math.PI * 2;
        const rr = Math.sqrt(R()) * h.r * 1.0;
        const px = h.x + Math.cos(a) * rr;
        const pz = h.z + Math.sin(a) * rr;
        const t = Math.max(0, 1 - (rr / (h.r * 0.75)) ** 2);
        _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.9, R() * 6.28, (R() - 0.5) * 0.9));
        slates.push(new THREE.Matrix4().compose(new THREE.Vector3(px, y0 + 0.75 * Math.sqrt(t) + 0.03, pz), _q, _s.set(0.25 + R() * 0.12, 0.012, 0.4 + R() * 0.12)));
      }
      scatter(h.x, h.z, h.r, 30, [0xd8d0c0, 0xc8bfae, 0xb8ae9a], 0.18); // (lumps of ceiling plaster)
      // round the rim: the rafters snapped off, each still in the roof, its broken end over the hole
      const ray = new THREE.Ray();
      const steps = Math.round((h.r * 2 * Math.PI) / 0.5);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const px = h.x + Math.cos(a) * h.r * 1.12;
        const pz = h.z + Math.sin(a) * h.r * 1.12;
        if (inHole(px, pz)) continue;
        ray.origin.set(px, 40, pz);
        ray.direction.copy(DOWN);
        const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
        if (!hit || this.materialAt(hit.faceIndex) !== 'cm_roof') continue;
        const n = hit.face.normal.clone();
        if (n.y < 0) n.negate();
        // down the slope, or up it, whichever way the hole lies; along the roof's plane
        const d = DOWN.clone().addScaledVector(n, -DOWN.dot(n)).normalize();
        const toHole = new THREE.Vector3(h.x - px, 0, h.z - pz);
        if (d.dot(toHole) < 0) d.negate();
        if (Math.abs(d.dot(toHole.normalize())) < 0.35) continue; // (the rafters run down the slope: none points across)
        const len = 0.5 + R() * 1.1;
        const start = hit.point.clone().addScaledVector(n, -0.12).addScaledVector(d, -0.25);
        const end = start.clone().addScaledVector(d, len).addScaledVector(n, -R() * 0.15); // (sagging a little)
        const q = new THREE.Quaternion().setFromUnitVectors(Y, end.clone().sub(start).normalize());
        timber.push(new THREE.Matrix4().compose(start.clone().lerp(end, 0.5), q, _s.set(0.06, start.distanceTo(end), 0.14)));
      }
    }
    // the fallen corner: its brick in a heap at the foot of the wall, outside and in
    {
      const out = new THREE.Vector3(BREACH.x, 0, BREACH.y + 2.2);
      const inn = new THREE.Vector3(BREACH.x - 0.5, 0, BREACH.y - 2.0);
      for (const [p, r, h] of [
        [out, 2.6, 1.0],
        [inn, 2.0, 0.8],
      ]) {
        _q.setFromAxisAngle(Y, R() * 6);
        heaps.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, floorAt(p.x, p.z) - 0.05, p.z), _q, _s.set(r, h, r * 0.8)));
        scatter(p.x, p.z, r * 1.2, Math.round(r * r * 22), [0x6a3a28, 0x7a4632, 0x5a3426, 0x8a5a44], 0.2);
      }
      this.landscape.obstacles?.push({ x: out.x, z: out.z, r: 2.2, when: () => this.on });
    }
    // (the heaps under the holes are slate, timber and plaster; the corner's, brick)
    const nHoles = this.holes.length;
    this.group.add(instanced(mound, new THREE.MeshStandardMaterial({ map: rubblePicture(77, true), roughness: 1 }), heaps.slice(0, nHoles)));
    this.group.add(instanced(mound, new THREE.MeshStandardMaterial({ map: rubblePicture(78), roughness: 1 }), heaps.slice(nHoles)));
    this.group.add(instanced(box, new THREE.MeshStandardMaterial({ color: 0x4e4234, roughness: 0.95 }), timber));
    this.group.add(instanced(box, new THREE.MeshStandardMaterial({ color: 0x45403a, roughness: 0.8 }), slates));
    const lm = instanced(box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), lumps);
    lumpCols.forEach((c, i) => lm.setColorAt(i, new THREE.Color(c)));
    if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
    this.group.add(lm);
    Object.assign(this.stats, { wreckTimbers: timber.length, slatesDown: slates.length });
  }

  // --- the hall ------------------------------------------------------------------------------------

  /**
   * The hall, as it was left: the paintings off the walls, stacked against them under dust sheets
   * (some uncovered), and the furniture brought down under sheets, packing cases, rolled carpets. A
   * way left clear down the middle to the stairs.
   */
  _hall() {
    const R = this.R;
    const linen = new THREE.MeshStandardMaterial({ map: linenPicture(), color: 0xe8e4d8, roughness: 1, side: THREE.DoubleSide });
    const gilt = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.85, roughness: 0.38 });
    // the house's own paintings, for the frames that show
    const pictures = [];
    this.model.traverse((o) => {
      if (o.isMesh && /^cm_obj_painting_/.test(o.material.name || '') && o.material.map && !pictures.includes(o.material.map)) pictures.push(o.material.map);
    });
    const floorAt = (x, z) => this._hit(new THREE.Vector3(x, 1.5, z), DOWN, 2.5)?.point.y ?? 0;
    // the hall's side walls (rays out from its middle)
    const wallX = (z, dir) => this._hit(new THREE.Vector3(-1.85, 1.0, z), new THREE.Vector3(dir, 0, 0), 8)?.point.x ?? -1.85 + dir * 3.3;
    const add = (m) => {
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // paintings: stacks leaning back against the side walls, the biggest at the back
    let pi = 0;
    const stack = (z, dir, covered, w0) => {
      const wx = wallX(z, dir);
      const y0 = floorAt(wx - dir * 0.4, z);
      const lean = 0.2; // (radians back from upright)
      // the frame: u along the wall (z), v up the leaning plane, n out from it
      const n = new THREE.Vector3(-dir * Math.cos(lean), Math.sin(lean), 0).normalize();
      const v = new THREE.Vector3(dir * Math.sin(lean), Math.cos(lean), 0).normalize();
      const u = new THREE.Vector3(0, 0, 1);
      const foot = new THREE.Vector3(wx - dir * (0.06 + Math.sin(lean) * 1.5), y0, z);
      const count = 3 + Math.floor(R() * 3);
      const parts = [];
      for (let i = 0; i < count; i++) {
        const w = w0 * (1 - i * 0.12) * (0.9 + R() * 0.2);
        const h = w * (0.65 + R() * 0.5);
        const off = 0.05 + i * 0.07;
        const centre = foot.clone().addScaledVector(v, h / 2 + 0.01).addScaledVector(n, off);
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
        const frame = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), gilt));
        frame.position.copy(centre);
        frame.quaternion.copy(q);
        if (!covered && pictures.length) {
          const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, h - 0.14), new THREE.MeshStandardMaterial({ map: pictures[pi++ % pictures.length], roughness: 0.5 }));
          canvas.position.copy(centre).addScaledVector(n, 0.032);
          canvas.quaternion.copy(q);
          add(canvas);
        }
        parts.push({ u0: -w / 2, u1: w / 2, v0: 0, v1: h + 0.01, h: off + 0.04 });
      }
      if (covered) {
        const g = drape(parts, { margin: 0.18, step: 0.04, basis: { u, v, n }, origin: foot.clone().addScaledVector(n, 0.01), seed: Math.floor(R() * 1000) });
        add(new THREE.Mesh(g, linen));
      }
      this.landscape.obstacles?.push({ x: wx - dir * 0.5, z, r: w0 * 0.55, when: () => this.on });
    };
    stack(-13.6, -1, true, 1.5);
    stack(-15.3, -1, false, 1.2);
    stack(-15.4, 1, true, 1.6);
    // furniture under sheets: each a set of boxes (its shape), the sheet thrown over
    const sheeted = (x, z, rot, parts, seed) => {
      const y0 = floorAt(x, z);
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const g = drape(parts, { margin: 0.22, basis: { u: new THREE.Vector3(c, 0, -s), v: new THREE.Vector3(s, 0, c), n: Y }, origin: new THREE.Vector3(x, y0, z), seed });
      add(new THREE.Mesh(g, linen));
      const r = Math.max(...parts.map((p) => Math.max(Math.abs(p.u0), Math.abs(p.u1), Math.abs(p.v0), Math.abs(p.v1))));
      this.landscape.obstacles?.push({ x, z, r: r * 0.8, when: () => this.on });
    };
    const sofa = [
      { u0: -0.95, u1: 0.95, v0: -0.42, v1: 0.42, h: 0.45 },
      { u0: -0.95, u1: 0.95, v0: -0.42, v1: -0.22, h: 0.88 },
      { u0: -0.95, u1: -0.75, v0: -0.42, v1: 0.42, h: 0.65 },
      { u0: 0.75, u1: 0.95, v0: -0.42, v1: 0.42, h: 0.65 },
    ];
    const chair = [
      { u0: -0.42, u1: 0.42, v0: -0.42, v1: 0.42, h: 0.46 },
      { u0: -0.42, u1: 0.42, v0: -0.42, v1: -0.24, h: 1.0 },
      { u0: -0.42, u1: -0.3, v0: -0.42, v1: 0.42, h: 0.66 },
      { u0: 0.3, u1: 0.42, v0: -0.42, v1: 0.42, h: 0.66 },
    ];
    const sideboard = [{ u0: -0.8, u1: 0.8, v0: -0.26, v1: 0.26, h: 0.92 }];
    const table = [
      { u0: -0.8, u1: 0.8, v0: -0.45, v1: 0.45, h: 0.76 },
      // (the chairs upturned on it, their legs in the air)
      { u0: -0.7, u1: -0.25, v0: -0.38, v1: 0.05, h: 1.22 },
      { u0: 0.2, u1: 0.68, v0: -0.05, v1: 0.38, h: 1.22 },
      { u0: -0.6, u1: -0.5, v0: -0.35, v1: -0.25, h: 1.62 },
      { u0: 0.55, u1: 0.65, v0: 0.25, v1: 0.35, h: 1.62 },
    ];
    const wardrobe = [{ u0: -0.55, u1: 0.55, v0: -0.3, v1: 0.3, h: 2.0 }];
    const piano = [
      { u0: -0.75, u1: 0.75, v0: -0.3, v1: 0.3, h: 1.25 },
      { u0: -0.75, u1: 0.75, v0: 0.0, v1: 0.45, h: 0.75 },
    ];
    // (a way kept clear down the middle, x -2.6 to -1.1, and round to the foot of each stair)
    sheeted(-4.4, -16.45, 0.05, sofa, 11);
    sheeted(-3.9, -14.4, Math.PI / 2 - 0.08, table, 14);
    sheeted(-4.4, -19.0, 0.05, wardrobe, 15);
    sheeted(0.95, -14.6, Math.PI / 2, sideboard, 13);
    sheeted(0.9, -16.6, -0.2, chair, 12);
    sheeted(1.1, -19.0, Math.PI + 0.1, piano, 16);
    // rolled carpets stood on end in the corner by the door
    for (let i = 0; i < 3; i++) {
      const len = 1.7 + R() * 0.6;
      const r = 0.12 + R() * 0.05;
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), new THREE.MeshStandardMaterial({ map: carpetPicture(31 + i), roughness: 0.95 })));
      const x = 1.85 - i * 0.24;
      const z = -13.35 - (i % 2) * 0.22;
      m.position.set(x, floorAt(x, z) + len / 2 - 0.02, z);
      m.rotation.set(0.06 * (i - 1), 0, -0.1 - 0.05 * i);
    }
    new GLTFLoader()
      .loadAsync('models/moving/crate-big.glb')
      .then((g) => {
        for (const [x, z, rot, scale] of [
          [-4.9, -17.9, 0.2, 1.3],
          [1.6, -17.9, -0.1, 1.3],
        ]) {
          const o = g.scene.clone(true);
          o.scale.setScalar(scale);
          o.rotation.y = rot;
          o.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(o);
          o.position.set(x - (b.min.x + b.max.x) / 2, floorAt(x, z) - b.min.y, z - (b.min.z + b.max.z) / 2);
          o.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
          this.group.add(o);
        }
      })
      .catch(() => {});
    this.stats.hall = pi;
  }
}
