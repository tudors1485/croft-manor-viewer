// Two hundred years empty (Scenes › Sights): the manor two centuries after the last of the family
// left. A close, grey-bright afternoon in late July. The roof is long gone, and with it the floors
// and the ceilings: what stands is a shell of brick and stone, a gable or a chimney stack still
// nearly to its full height here, the walls fallen to stumps a man could step over there, ragged
// along their tops brick by brick (the cut is in the house's own shaders, shell.js and materials.js:
// the model is untouched). Every window and door is an empty hole, a ledge of floor left high up
// by a standing wall now and then, a few charred rafters still across a gable. Inside, the ground
// floor has gone to earth, moss and nettles; heaps of fallen brick and stone lie at the foot of
// every wall, in and out; rotten beams lie where they came down. Ivy over everything, up to the
// broken tops. The lawns are a wood of birch and sycamore twelve metres high in rank grass and
// bramble, and trees grow inside the rooms. The fountain is dry and full of leaves. No lamps, no
// clock, no house to creak: the wind in the trees, the birds, and the crows.
//
// It grows on Fifty years empty (abandoned.js): the same grime, ivy, grass and brambles, built for
// a ruin instead of a house.

import * as THREE from 'three';
import { seasonUniforms } from './season.js';
import { Abandoned, rng, instanced, litterPicture, ivyPicture, barkPicture, rankGrassPicture } from './abandoned.js';
import { leavesPicture, cardsGeometry, ballPlace } from './garden.js';
import { HOUSE, inHouse, ruinTop } from './shell.js';

const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
void rankGrassPicture;
const DOWN = new THREE.Vector3(0, -1, 0);

/** A crown of several lobes (balls), so it is ragged, not a ball: [rx, ry, rz, x, y0, z] each. */
function lobes(parts, depth = 0.55) {
  const places = parts.map(([rx, ry, rz, x, y0, z]) => {
    const pl = ballPlace(rx, ry, rz, y0, depth);
    return (R) => {
      const c = pl(R);
      c.p.x += x;
      c.p.z += z;
      return c;
    };
  });
  const w = parts.map(([rx, ry, rz]) => rx * ry * rz);
  const sum = w.reduce((a, b) => a + b, 0);
  return (R) => {
    let r = R() * sum;
    for (let i = 0; i < places.length; i++) if ((r -= w[i]) <= 0) return places[i](R);
    return places[places.length - 1](R);
  };
}

export class Ruin extends Abandoned {
  /** As Abandoned, with `shell` (shell.js's HouseShell). */
  constructor(scene, opts) {
    super(scene, opts);
    this.shell = opts.shell;
    this.group.name = 'Two hundred years empty';
    this.next = { crow: 3 };
  }

  /** The ground's height, or inside the house the floor's (the earth where there is none). */
  get ground() {
    return (x, z) => {
      if (inHouse(x, z)) {
        const h = this._hit(new THREE.Vector3(x, 2.2, z), DOWN, 4);
        return h ? h.point.y : -0.06;
      }
      return this.landscape.groundHeight(x, z) ?? 0.04;
    };
  }

  set(on) {
    if (on === this.on) return;
    this.on = on;
    if (on && !this.built) this._build();
    this.group.visible = on;
    seasonUniforms.uDecay.value = on ? 1 : 0;
    this.shell?.setMode(on ? 1 : 0);
    if (this.pond) this.pond.mesh.visible = !on;
    this.garden?.group.traverse((o) => o.userData.tidy && (o.visible = !on));
    if (on) this.next = { crow: 2 + Math.random() * 3 };
  }

  /** Rays meet only what is left of the house. */
  _hit(origin, dir, far) {
    return this.shell.hit(origin, dir, far, 1);
  }

  _build() {
    const t0 = performance.now();
    this.built = true;
    this.R = rng(18260601);
    this.light = !!window.matchMedia?.('(pointer: coarse)').matches;
    this.pictures = { ivy: ivyPicture(), litter: litterPicture(), bark: barkPicture() };
    this.stats = {};
    this.windows = []; // (no glass, no frames: nothing for the ivy to keep clear of)
    this._insideSpots();
    this._rafters();
    this._ivy();
    this._ivyInside();
    this._rubble();
    this._beams();
    this._grass();
    this._brambles();
    this._trees();
    this._fallenTree();
    this._branches();
    this._fountain();
    this.stats.ms = Math.round(performance.now() - t0);
    console.info('two hundred years empty', JSON.stringify(this.stats));
  }

  // --- inside the shell ------------------------------------------------------------------------

  /** Points on the ground floor inside the walls (rays down through where the roof and floors were). */
  _insideSpots() {
    const R = rng(1826);
    const out = [];
    for (let i = 0; i < 2600; i++) {
      const x = THREE.MathUtils.lerp(HOUSE.x0 + 0.5, HOUSE.x1 - 0.5, R());
      const z = THREE.MathUtils.lerp(HOUSE.z0 + 0.5, HOUSE.z1 - 0.5, R());
      // (nothing under it: one of the spaces the model never fitted out, its floor the new earth)
      const h = this._hit(new THREE.Vector3(x, 18, z), DOWN, 22) ?? { point: new THREE.Vector3(x, -0.06, z), normal: Y, name: '' };
      if (h.point.y > 2.2 || h.normal.y < 0.7 || /water/.test(h.name)) continue;
      // (inside the walls: something stands on two sides of it at least)
      out.push({ x, y: h.point.y, z, gravel: false, inside: true });
    }
    this.inside = out;
    this.stats.inside = out.length;
  }

  /** The grounds' points, and a share inside the shell, where the rooms have gone to earth. */
  _groundSpots(count, opts = {}) {
    const out = super._groundSpots(count, opts);
    const R = rng(77 + (opts.seed ?? 0));
    const n = Math.round(count * (opts.insideShare ?? 0.12));
    const pool = this.inside ?? [];
    for (let i = 0; i < n && pool.length; i++) out.push(pool[Math.floor(R() * pool.length)]);
    return out;
  }

  // --- what is left of the roof ----------------------------------------------------------------

  /** Charred rafters still across the gables that stand high, some broken short, some hanging. */
  _rafters() {
    const R = this.R;
    const bvh = this.bvh;
    const ray = new THREE.Ray();
    const cands = [];
    for (let i = 0; i < 1400; i++) {
      const x = THREE.MathUtils.lerp(HOUSE.x0, HOUSE.x1, R());
      const z = THREE.MathUtils.lerp(HOUSE.z0, HOUSE.z1, R());
      ray.origin.set(x, 40, z);
      ray.direction.copy(DOWN);
      const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
      if (!h || this.materialAt(h.faceIndex) !== 'cm_roof') continue;
      const n = h.face.normal.clone();
      if (n.y < 0) n.negate();
      if (n.y < 0.3 || n.y > 0.92) continue;
      if (ruinTop(x, z) < h.point.y - 1.5) continue; // (only where the walls below still stand near it)
      cands.push({ point: h.point.clone(), normal: n });
    }
    const picked = [];
    for (const c of cands) {
      if (picked.length >= 7) break;
      if (picked.every((p) => p.point.distanceTo(c.point) > 5)) picked.push(c);
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 1, envMapIntensity: 0.2 });
    const timbers = [];
    for (const c of picked) {
      const n = c.normal;
      const d = DOWN.clone().addScaledVector(n, -DOWN.dot(n)).normalize();
      const a = new THREE.Vector3().crossVectors(n, d).normalize();
      const qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, d, n));
      for (let u = -2.2; u <= 2.2; u += 0.45) {
        if (R() < 0.35) continue;
        const len = 1.2 + R() * 3.2;
        const centre = c.point.clone().addScaledVector(a, u).addScaledVector(d, (R() - 0.3) * 1.5).addScaledVector(n, -0.12);
        // (some sagging or hanging off where they have broken)
        const q = qb.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(R() < 0.25 ? (R() - 0.5) * 0.9 : (R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.08)));
        timbers.push(new THREE.Matrix4().compose(centre, q, _s.set(0.07, len, 0.16)));
      }
      // a purlin across them
      if (R() < 0.7) timbers.push(new THREE.Matrix4().compose(c.point.clone().addScaledVector(n, -0.25), qb, _s.set(3 + R() * 2, 0.2, 0.18)));
    }
    this.group.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat, timbers));
    this.stats.rafters = timbers.length;
  }

  // --- ivy ---------------------------------------------------------------------------------------

  /** Ivy over the outside of the walls, thick, right up to their broken tops. */
  _ivy() {
    const R = this.R;
    const spots = [];
    const sides = [
      { dir: new THREE.Vector3(0, 0, -1), from: (s) => [s, HOUSE.z1 + 1.5], range: [HOUSE.x0, HOUSE.x1] },
      { dir: new THREE.Vector3(0, 0, 1), from: (s) => [s, HOUSE.z0 - 2.5], range: [HOUSE.x0, HOUSE.x1] },
      { dir: new THREE.Vector3(-1, 0, 0), from: (s) => [HOUSE.x1 + 2.5, s], range: [HOUSE.z0, HOUSE.z1] },
      { dir: new THREE.Vector3(1, 0, 0), from: (s) => [HOUSE.x0 - 2, s], range: [HOUSE.z0, HOUSE.z1] },
    ];
    const step = 0.26;
    sides.forEach((side) => {
      for (let s = side.range[0]; s <= side.range[1]; s += step) {
        for (let y = 0.1; y < 14; y += step) {
          const [x, z] = side.from(s + (R() - 0.5) * step);
          const h = this._hit(new THREE.Vector3(x, y + (R() - 0.5) * step, z), side.dir, 14);
          if (!h || Math.abs(h.normal.y) > 0.4 || !/brick|whitestone/.test(h.name)) continue;
          const top = ruinTop(h.point.x, h.point.z);
          if (h.point.y > top) continue;
          // all over, a little thinner up the tallest stacks
          if (R() > 0.62 - 0.3 * Math.max(0, (h.point.y - 6) / 8)) continue;
          spots.push(h);
        }
      }
    });
    this._ivyCards(spots, this.light ? 7000 : 13000, 0x8a9a6a);
    this.ivySpots = spots;
    this.stats.ivy = Math.min(spots.length, this.light ? 7000 : 13000);
  }

  /** And on the inside of the walls, out of the rooms. */
  _ivyInside() {
    const R = this.R;
    const spots = [];
    const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
    for (const p of (this.inside ?? []).slice(0, 500)) {
      for (const dir of dirs) {
        for (let y = 0.2; y < 8; y += 0.3) {
          const h = this._hit(new THREE.Vector3(p.x, p.y + y, p.z), dir, 8);
          if (!h || Math.abs(h.normal.y) > 0.4) continue;
          if (h.point.y > ruinTop(h.point.x, h.point.z) - 0.1) continue;
          if (R() > 0.55 - y * 0.04) continue;
          spots.push(h);
        }
      }
    }
    this._ivyCards(spots, this.light ? 2500 : 4500, 0x8a9a6a);
    this.stats.ivyInside = Math.min(spots.length, this.light ? 2500 : 4500);
  }

  _ivyCards(spots, MAX, tint) {
    const R = this.R;
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.ivy, color: 0xd6dcc0, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, metalness: 0, envMapIntensity: 0.2 });
    mat.color.multiply(new THREE.Color(tint).lerp(new THREE.Color(0xffffff), 0.6));
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.pictures.ivy, alphaTest: 0.4, side: THREE.DoubleSide });
    if (spots.length > MAX)
      for (let i = spots.length - 1; i > 0; i--) {
        const j = Math.floor(R() * (i + 1));
        [spots[i], spots[j]] = [spots[j], spots[i]];
      }
    const mats = [];
    for (const h of spots.slice(0, MAX)) {
      const s = 0.5 + R() * 0.45;
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), h.normal);
      _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), R() * Math.PI * 2));
      _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.8, (R() - 0.5) * 0.8, 0)));
      mats.push(new THREE.Matrix4().compose(h.point.clone().addScaledVector(h.normal, 0.05 + R() * 0.16), _q, _s.set(s, s, s)));
    }
    const im = instanced(new THREE.PlaneGeometry(1, 1), mat, mats, { shadow: true });
    im.customDepthMaterial = depth;
    this.group.add(im);
  }

  // --- what has fallen ---------------------------------------------------------------------------

  /** Heaps of fallen brick and stone, grassed over, at the foot of the walls that have come down most. */
  _rubble() {
    const R = this.R;
    const soilPic = litterPicture(57);
    const mound = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    {
      // (lumpy)
      const p = mound.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 0.8 + 0.35 * Math.sin(p.getX(i) * 5.1 + p.getZ(i) * 3.7) * Math.cos(p.getZ(i) * 4.3);
        p.setY(i, p.getY(i) * k);
      }
      mound.computeVertexNormals();
    }
    const moundMat = new THREE.MeshStandardMaterial({ map: soilPic, color: 0x7d8a5a, roughness: 1, envMapIntensity: 0.2 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, envMapIntensity: 0.25 });
    const heaps = [];
    const bricks = [];
    const colours = [];
    const brickCols = [0x6a3a28, 0x7a4632, 0x5a3426, 0x8a5a44, 0x4e3a30];
    const stoneCols = [0x6e6a58, 0x625e4c, 0x575a46];
    const heap = (x, z, r, h) => {
      const y = this.ground(x, z);
      _q.setFromAxisAngle(Y, R() * 6.28);
      heaps.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.05, z), _q, _s.set(r * (0.8 + R() * 0.4), h, r)));
      // loose bricks and blocks over it and round its foot
      const n = Math.round(r * r * 7);
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2;
        const rr = Math.sqrt(R()) * r * 1.15;
        const bx = x + Math.cos(a) * rr;
        const bz = z + Math.sin(a) * rr;
        const t = Math.max(0, 1 - (rr / r) ** 2);
        const by = y + h * Math.sqrt(t) * 0.85 + 0.03;
        const stone = R() < 0.18;
        _q.setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
        bricks.push(new THREE.Matrix4().compose(new THREE.Vector3(bx, by, bz), _q, stone ? _s.set(0.25 + R() * 0.3, 0.14 + R() * 0.12, 0.2 + R() * 0.2) : _s.set(0.225, 0.075, 0.11)));
        colours.push(stone ? stoneCols[Math.floor(R() * stoneCols.length)] : brickCols[Math.floor(R() * brickCols.length)]);
      }
    };
    // at the foot of the walls, where most has fallen (both faces)
    let n = 0;
    for (const h of this.ivySpots ?? []) {
      if (h.point.y > 0.6) continue;
      const fallen = THREE.MathUtils.clamp((10 - ruinTop(h.point.x, h.point.z)) / 9, 0, 1);
      if (R() > fallen * 0.09) continue;
      const out = 0.6 + R() * 1.2;
      heap(h.point.x + h.normal.x * out, h.point.z + h.normal.z * out, 0.9 + fallen * 1.8 * R(), 0.35 + fallen * 0.8 * R());
      n++;
    }
    // and inside, where the floors and the inner walls came down
    for (let i = 0; i < 46 && this.inside?.length; i++) {
      const p = this.inside[Math.floor(R() * this.inside.length)];
      heap(p.x, p.z, 0.8 + R() * 1.6, 0.3 + R() * 0.8);
    }
    const hm = instanced(mound, moundMat, heaps);
    this.group.add(hm);
    const bm = instanced(new THREE.BoxGeometry(1, 1, 1), brickMat, bricks);
    colours.forEach((c, i) => bm.setColorAt(i, new THREE.Color(c)));
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    this.group.add(bm);
    this.stats.heaps = heaps.length;
    this.stats.bricks = bricks.length;
  }

  /** Beams that came down with the floors, rotten and green, lying and leaning in the rooms. */
  _beams() {
    const R = this.R;
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.bark, color: 0x5a5444, roughness: 1, envMapIntensity: 0.2 });
    const beams = [];
    for (let i = 0; i < 30 && this.inside?.length; i++) {
      const p = this.inside[Math.floor(R() * this.inside.length)];
      const len = 2.5 + R() * 3.5;
      const lean = R() < 0.4 ? 0.25 + R() * 0.45 : R() * 0.06; // (some still propped on the heaps)
      const yaw = R() * Math.PI * 2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2 - lean, 'YXZ'));
      const c = new THREE.Vector3(p.x, p.y + Math.sin(lean) * len * 0.5 + 0.12, p.z);
      beams.push(new THREE.Matrix4().compose(c, q, _s.set(0.2, len, 0.24)));
    }
    this.group.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat, beams));
    this.stats.beams = beams.length;
  }

  // --- the wood that was the lawns ----------------------------------------------------------------

  /** Birch, sycamore and ash, ten to fifteen metres high, over the lawns and inside the walls. */
  _trees() {
    const R = this.R;
    const kinds = [
      // sycamore: dense, dark, a broad crown
      { pic: leavesPicture({ size: 256, count: 1100, len: [12, 20], tile: false, clump: true, seed: 101, palette: ['#1f3612', '#2a4416', '#33501b', '#3d5c20', '#284018', '#456626'] }), place: lobes([[2.6, 2.2, 2.4, 0, 6.6, 0], [2.0, 1.8, 2.0, 1.9, 5.4, 0.8], [1.8, 1.7, 1.9, -1.6, 6.0, -1.1], [1.5, 1.4, 1.5, 0.4, 9.2, -0.4]]), trunk: 0.26, h: 7.2, bark: 0x6c665a },
      // birch: light, airy, a narrow crown, a pale trunk
      { pic: leavesPicture({ size: 256, count: 900, len: [8, 13], tile: false, clump: true, seed: 103, palette: ['#3f5c1c', '#4d6a22', '#5c7826', '#6a842c', '#46601e'] }), place: lobes([[1.5, 2.2, 1.5, 0, 6.6, 0], [1.2, 1.6, 1.1, 0.9, 5.0, 0.5], [1.1, 1.5, 1.2, -0.7, 8.6, -0.3], [0.9, 1.2, 0.9, 0.3, 10.6, 0.2]]), trunk: 0.15, h: 7.8, bark: 0xd0ccc0 },
      // ash: open, feathery
      { pic: leavesPicture({ size: 256, count: 800, len: [10, 16], tile: false, clump: true, seed: 107, palette: ['#2e4a16', '#3a5a1c', '#466a22', '#365218'] }), place: lobes([[2.2, 1.5, 2.0, 0.6, 7.6, 0], [1.8, 1.3, 1.9, -1.8, 6.6, 1.0], [1.7, 1.4, 1.6, 1.4, 9.4, -1.3], [1.4, 1.2, 1.5, -0.6, 10.0, 0.9]], 0.75), trunk: 0.2, h: 8, bark: 0x8a8678 },
    ];
    // (a clearing in front of the house, where the forecourt and the fountain were, so the ruin is seen)
    const spots = this._groundSpots(this.light ? 40 : 64, { gravel: 0.15, avoidHouse: 5, seed: 9, insideShare: 0.08 }).filter((p) => p.inside || !(p.z > -9 && p.z < 18 && p.x > -14 && p.x < 26) || R() < 0.1);
    let total = 0;
    kinds.forEach((k, ki) => {
      const { m, depth } = this._leaves(k.pic, 0xffffff, { stiff: 1.5, height: 12 });
      const crown = cardsGeometry(this.light ? 260 : 420, 1.3, k.place, 109 + ki);
      const trunk = new THREE.CylinderGeometry(k.trunk * 0.35, k.trunk, k.h + 2, 8, 3);
      trunk.translate(0, (k.h + 2) / 2, 0);
      // (a lean and a kink in it)
      const p = trunk.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 0.35) * 0.25);
      trunk.computeVertexNormals();
      const bark = new THREE.MeshStandardMaterial({ color: k.bark, roughness: 0.9, envMapIntensity: 0.3 });
      const mats = [];
      spots.forEach((s, i) => {
        if (i % kinds.length !== ki) return;
        if (s.gravel && R() < 0.5) return;
        const sc = 0.75 + R() * 0.55;
        _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.1, R() * 6.28, (R() - 0.5) * 0.1));
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y - 0.1, s.z), _q, _s.set(sc, sc * (0.9 + R() * 0.25), sc)));
      });
      const ci = instanced(crown, m, mats);
      ci.customDepthMaterial = depth;
      this.group.add(ci, instanced(trunk, bark, mats));
      // (a trunk to walk round)
      for (const mm of mats) {
        const e = new THREE.Vector3().setFromMatrixPosition(mm);
        this.landscape.obstacles?.push({ x: e.x, z: e.z, r: 0.35, when: () => this.on });
      }
      total += mats.length;
    });
    // and the young ones coming up under them, in leaf
    this._young();
    this.stats.trees = total;
  }

  /** Young sycamore, elder and hawthorn coming up under the trees and in the rooms, in summer leaf. */
  _young() {
    const R = this.R;
    const pic = leavesPicture({ size: 256, count: 1000, len: [10, 18], tile: false, clump: true, seed: 113, palette: ['#22381a', '#2d4a1c', '#375a20', '#3e6424', '#2a4418', '#4a6e2a'] });
    const { m, depth } = this._leaves(pic, 0xffffff, { stiff: 2, height: 4 });
    const crown = cardsGeometry(150, 0.7, ballPlace(1.1, 1.1, 1.1, 1.0, 0.55), 117);
    const trunk = new THREE.CylinderGeometry(0.03, 0.07, 2.4, 6, 1);
    trunk.translate(0, 1.2, 0);
    const bark = new THREE.MeshStandardMaterial({ color: 0x6a6458, roughness: 0.9 });
    const mats = [];
    for (const p of this._groundSpots(this.light ? 45 : 75, { gravel: 0.3, avoidHouse: 0.5, seed: 13, insideShare: 0.3 })) {
      const s = 0.55 + R() * 1.1;
      _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.14, R() * 6.28, (R() - 0.5) * 0.14));
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y - 0.05, p.z), _q, _s.set(s, s, s)));
    }
    const ci = instanced(crown, m, mats);
    ci.customDepthMaterial = depth;
    this.group.add(ci, instanced(trunk, bark, mats));
    this.stats.young = mats.length;
  }

  /** Crows, now and then; no house left to creak. */
  update(dt, { camera = null } = {}) {
    if (!this.on || !camera) return;
    this.time += dt;
    const snd = this.sound;
    if (!snd?.on) return;
    this.next.crow -= dt;
    if (this.next.crow <= 0) {
      const a = Math.random() * Math.PI * 2;
      const cam = camera.position;
      const p = new THREE.Vector3(cam.x + Math.cos(a) * (15 + Math.random() * 30), 8 + Math.random() * 10, cam.z + Math.sin(a) * (15 + Math.random() * 30));
      snd.sample(Math.random() < 0.25 ? 'crows' : `crow-${1 + Math.floor(Math.random() * 3)}`, p, { gain: 0.6, rate: 0.92 + Math.random() * 0.15 });
      this.next.crow = 7 + Math.random() * 14;
    }
  }
}

export { inHouse };
