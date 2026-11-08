// Christmas inside the house, from the first of December to Twelfth Night:
//
// - The great hall: a tree beside the left-hand stairs, hung with red and gold baubles, warm lights
//   and a gold bead garland, a star on top; garland wound with lights along both staircases' banisters
//   and across the landing between them, and swagged along the gallery's balustrade, with red bows;
//   holly tucked behind the pictures; mistletoe in the arch to the ballroom's corridor.
// - The ballroom: a second tree at its west end.
// - Wreaths on the painted doors.
// - The kitchen: a gingerbread house and a plate of mince pies on the island, and a Christmas pudding.
// - Lara's bedroom: a small tree in the corner and a stocking on the bedpost.
// - From the week before Christmas, presents under the trees; from Christmas Eve to Boxing Day, the
//   table in the dining room upstairs laid for Christmas dinner: plates, crackers, a centrepiece of
//   greenery with three candles.
//
// All made here, nothing loaded: the greenery is thousands of little sprigs, berries, baubles and bows,
// each kind one instanced mesh, and every light one draw call (festive.js's bulbs). One warm light
// in the scene all year (dark out of season: adding a light later would recompile every shader),
// moved to whichever tree or table you are nearest.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bulbs } from './festive.js';

const SEASON = [334, 5]; // 1 December .. 6 January (days of the year, from 0)
const PRESENTS = [351, 359]; // 18 .. 26 December
const DINNER = [357, 359]; // Christmas Eve .. Boxing Day
const ALL_DAY = [357, 0]; // Christmas Eve .. New Year's Day: the tree lights stay on all day
const inRange = (day, [a, b]) => (a <= b ? day >= a && day <= b : day >= a || day <= b);

// where things stand (found from the house: see the notes by each)
const HALL_TREE = { x: -4.65, z: -16.3, h: 3.2, r: 0.8 }; // beside the foot of the left-hand stairs, clear of the flybys over the hall
const BALL_TREE = { x: -6.0, z: -30.0, h: 2.95, r: 1.0 }; // the ballroom's west end, under its beams (3.35 m)
const BED_TREE = { x: -13.45, z: -19.0, h: 1.45, r: 0.42 }; // the bedroom's north-west corner
const TABLE = { x: 5.6, y: 4.45, z: -29.4, a: 1.3, b: 0.68 }; // the dining table upstairs: its middle, top and half-lengths
const ISLAND = { ginger: [-9.5, -23.95], pies: [-9.5, -21.75], pudding: [-9.25, -24.15] }; // on the kitchen island's marble

/** A canvas of needles for the trees (dark strokes on dark green). */
function needleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1b4426';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const a = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const l = 5 + Math.random() * 9;
    const v = Math.random();
    g.strokeStyle = v < 0.5 ? `rgba(12,40,20,0.7)` : v < 0.85 ? `rgba(40,92,52,0.55)` : `rgba(90,140,90,0.35)`;
    g.lineWidth = 1 + Math.random();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Wrapping paper: stripes or dots in two colours. */
function paperTexture(base, ink, kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = ink;
  if (kind === 'stripes') {
    g.translate(32, 32);
    g.rotate(Math.PI / 4);
    for (let x = -64; x < 64; x += 16) g.fillRect(x, -64, 6, 128);
  } else {
    for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 64; x += 16) {
      g.beginPath();
      g.arc(x + 4, y + 4, 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A holly leaf: an oval with spines along its edge, about 6 cm long, lying in x-y. */
function hollyGeometry() {
  const s = new THREE.Shape();
  const n = 7;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const y = -0.03 + t * 0.06;
    const w = Math.sin(t * Math.PI) * 0.016;
    pts.push([w + (k % 2 ? 0.006 : 0), y]);
  }
  s.moveTo(0, -0.032);
  for (const [x, y] of pts) s.lineTo(x, y);
  s.lineTo(0, 0.034);
  for (const [x, y] of pts.slice().reverse()) s.lineTo(-x, y);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** A group's meshes merged, one mesh for each material (fewer things to draw). */
function bake(group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (geo.index) geo = geo.toNonIndexed();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    (byMat.get(o.material) ?? byMat.set(o.material, []).get(o.material)).push(geo);
  });
  group.clear();
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

export class ChristmasInside {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree
   * @param {(faceIndex: number) => string} o.materialAt the material at a face of the collision tree
   * @param {THREE.Object3D} o.model the house (for its pictures and doors)
   * @param {THREE.Box3} o.houseBox
   */
  constructor(scene, { bvh, materialAt, model, houseBox , light = null }) {
    this.scene = scene;
    this.bvh = bvh;
    this.materialAt = materialAt;
    this.model = model;
    this.houseBox = houseBox;
    this.group = new THREE.Group();
    this.group.name = 'Christmas inside';
    this.group.visible = false;
    scene.add(this.group);
    // the one light, moved to the nearest of these: borrowed (the haunted rooms' one, dark but on
    // Halloween night: every light in the scene costs every frame, all year) or, without one, its own
    this.borrowed = !!light;
    this.light = light ?? new THREE.PointLight(0xffb066, 0, 8, 1.5);
    if (!light) scene.add(this.light);
    this.glows = [];
    this.lights = []; // the bulbs (points), each with how they're lit: 'tree' or 'candle'
    this.t = 0;
    this.built = false;
  }

  /** Is it the season (1 December to Twelfth Night)? */
  static isOn(day) {
    return inRange(Math.floor(day), SEASON);
  }

  _down(x, z, from, far = 6) {
    const h = this.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, from, z), new THREE.Vector3(0, -1, 0)), THREE.DoubleSide, 0, far);
    return h ? h.point.y : null;
  }

  /** The top of the hall's railing below (x, z), looking a few centimetres either side for it. */
  _railTop(x, z, from, across) {
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    for (const o of [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09]) {
      ray.origin.set(x + across.x * o, from, z + across.z * o);
      const hits = this.bvh.raycast(ray, THREE.DoubleSide);
      hits.sort((a, b) => a.distance - b.distance);
      for (const h of hits) {
        if (h.distance > 2.5) break;
        if (this.materialAt(h.faceIndex) === 'cm_obj_mainhallrailing') return h.point.y;
      }
    }
    return null;
  }

  build() {
    this.built = true;
    const t0 = performance.now();
    const g = this.group;
    // --- the pools: every sprig, berry, bauble, bow and present, each kind drawn at once ---
    const pools = {
      sprig: [], // [matrix, colour]
      berry: [],
      bauble: [],
      bow: [],
      knot: [],
      holly: [],
      leaf: [],
      plate: [],
      cracker: [],
      candle: [],
      brass: [],
      bead: [],
    };
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s3 = new THREE.Vector3();
    const put = (pool, pos, quat, scale, colour = null) => pools[pool].push([new THREE.Matrix4().compose(pos, quat, typeof scale === 'number' ? s3.setScalar(scale).clone() : scale), colour]);
    const up = new THREE.Vector3(0, 1, 0);
    const greens = [0x1f4d2b, 0x24572f, 0x183f24, 0x2b6236];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    // a sprig pointing along `dir` from `pos`
    const sprig = (pos, dir, size = 1) => {
      q.setFromUnitVectors(up, dir.clone().normalize());
      put('sprig', pos.clone().addScaledVector(dir, 0.055 * size), q, size * (0.8 + Math.random() * 0.4), pick(greens));
    };
    const berries = (pos, n, spread, colour = 0xb3130f) => {
      for (let k = 0; k < n; k++) put('berry', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)), q.identity(), 0.011 + Math.random() * 0.005, colour);
    };
    // a red bow facing `out` at `pos`: two loops, a knot and two tails
    const bow = (pos, out, size = 1) => {
      const side = new THREE.Vector3().crossVectors(up, out).normalize();
      for (const s of [-1, 1]) {
        const loopAt = pos.clone().addScaledVector(side, s * 0.055 * size).addScaledVector(up, 0.012 * size);
        q.setFromUnitVectors(up, side.clone().multiplyScalar(-s).addScaledVector(up, 0.25).normalize());
        put('bow', loopAt, q, new THREE.Vector3(1, 1, 0.45).multiplyScalar(size));
        const tailAt = pos.clone().addScaledVector(side, s * 0.03 * size).addScaledVector(up, -0.07 * size);
        q.setFromUnitVectors(up, up.clone().multiplyScalar(-1).addScaledVector(side, s * 0.35).normalize());
        put('bow', tailAt, q, new THREE.Vector3(0.55, 1.1, 0.3).multiplyScalar(size));
      }
      put('knot', pos.clone().addScaledVector(out, 0.01), q.identity(), 0.022 * size);
    };
    const lights = { tree: [], candle: [] };
    const warm = () => (Math.random() < 0.85 ? [1, 0.8, 0.5] : [1, 0.62, 0.25]);

    // --- a garland along a rail: anchored at the rail's top every `every` metres, drooping between,
    // hung out on the side `out`, with lights along it and a bow at every other anchor ---
    const garland = (rail, out, { every = 1.1, dip = 0.16, lit = true, bows = true } = {}) => {
      // the rail's length, and a point a distance along it
      const seg = [];
      let len = 0;
      for (let i = 1; i < rail.length; i++) {
        const l = rail[i].distanceTo(rail[i - 1]);
        seg.push([len, l]);
        len += l;
      }
      const at = (d) => {
        for (let i = 0; i < seg.length; i++) {
          const [a, l] = seg[i];
          if (d <= a + l || i === seg.length - 1) return rail[i].clone().lerp(rail[i + 1], Math.min(1, Math.max(0, (d - a) / l)));
        }
        return rail[rail.length - 1].clone();
      };
      const n = Math.max(1, Math.round(len / every));
      const span = len / n;
      const step = 0.022;
      let lightAt = 0;
      for (let d = 0; d <= len; d += step) {
        const u = (d % span) / span;
        const p = at(d).addScaledVector(out, 0.06).add(new THREE.Vector3(0, -dip * 4 * u * (1 - u) - 0.03, 0));
        const tangent = at(Math.min(len, d + 0.05)).sub(at(Math.max(0, d - 0.05))).normalize();
        // three sprigs round the rope, pointing out from it every way
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2;
          const n1 = new THREE.Vector3().crossVectors(tangent, up).normalize();
          if (n1.lengthSq() < 0.1) n1.set(1, 0, 0);
          const n2 = new THREE.Vector3().crossVectors(tangent, n1).normalize();
          const dir = n1.multiplyScalar(Math.cos(a)).addScaledVector(n2, Math.sin(a)).addScaledVector(tangent, (Math.random() - 0.5) * 0.8).normalize();
          sprig(p.clone().addScaledVector(dir, 0.01), dir, 0.9);
        }
        if (Math.random() < 0.05) berries(p.clone().addScaledVector(out, 0.04), 3, 0.03);
        if (lit && d >= lightAt) {
          lightAt = d + 0.13;
          lights.tree.push({ pos: p.clone().addScaledVector(out, 0.045).toArray(), colour: warm(), phase: Math.random() });
        }
      }
      if (bows) for (let k = 0; k <= n; k += 2) bow(at(k * span).addScaledVector(out, 0.1).add(new THREE.Vector3(0, -0.02, 0)), out, 1);
    };

    // --- a tree: tiers of ragged cones, sprigs breaking its outline, baubles, lights, a bead garland
    // and a star ---
    const needles = new THREE.MeshStandardMaterial({ map: needleTexture(), color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    const bark = new THREE.MeshStandardMaterial({ color: 0x3b2a1b, roughness: 0.95 });
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffb830, emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.3 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x6b1a17, roughness: 0.55, metalness: 0.15 });
    const glows = this.glows;
    const tree = ({ x, z, h, r }, y0, { baubles = 60, bulbsN = 260, star = true, pot = false, gold = true } = {}) => {
      const tg = new THREE.Group();
      tg.position.set(x, y0, z);
      g.add(tg);
      const base = pot ? 0.32 : 0.18;
      if (pot) {
        const tub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.36, 0.3, 18).translate(0, 0.15, 0), potMat);
        tub.castShadow = tub.receiveShadow = true;
        tg.add(tub);
      } else {
        // a stand under a skirt of red cloth
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.95, 0.12, 24).translate(0, 0.06, 0), potMat);
        skirt.receiveShadow = true;
        tg.add(skirt);
      }
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.02, h * 0.03, base + 0.2, 8).translate(0, (base + 0.2) / 2, 0), bark);
      tg.add(trunk);
      const tiers = Math.max(5, Math.round(h * 2.6));
      const coneTop = h - 0.12;
      const tierGeos = [];
      for (let k = 0; k < tiers; k++) {
        const f = k / tiers;
        const yb = base + f * (coneTop - base) * 0.92;
        const rr = r * (1 - f) * 0.98 + 0.05;
        const tall = Math.min(coneTop - yb, (coneTop - base) * 0.3 + 0.1);
        const geo = new THREE.ConeGeometry(rr, tall, 22, 2, true);
        // a ragged rim: the lowest ring of vertices pushed in and out and drooping
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          if (p.getY(i) < -tall / 2 + 1e-4) {
            const j = 0.82 + Math.random() * 0.3;
            p.setX(i, p.getX(i) * j);
            p.setZ(i, p.getZ(i) * j);
            p.setY(i, p.getY(i) - Math.random() * 0.05);
          }
        }
        geo.computeVertexNormals();
        // (repeat the needles round the cone)
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rr * 6, uv.getY(i) * tall * 3);
        geo.rotateY(k * 1.3).translate(0, yb + tall / 2, 0);
        tierGeos.push(geo);
      }
      // (one mesh for all the tiers)
      const crown = new THREE.Mesh(mergeGeometries(tierGeos), needles);
      crown.castShadow = true;
      crown.receiveShadow = true;
      tg.add(crown);
      // the surface of the tree at height y (its outside radius there), from the tiers' envelope
      const radiusAt = (y) => {
        const f = THREE.MathUtils.clamp((y - base) / (coneTop - base), 0, 1);
        const local = (f * tiers) % 1; // (each tier is widest at its bottom)
        return (r * (1 - f) * 0.98 + 0.05) * (0.78 + 0.22 * (1 - local));
      };
      const surface = (y, a, inset = 0) => new THREE.Vector3(x + Math.cos(a) * (radiusAt(y) - inset), y0 + y, z + Math.sin(a) * (radiusAt(y) - inset));
      // sprigs all over, pointing out and a little down
      const nSprig = Math.round(h * r * 260);
      for (let i = 0; i < nSprig; i++) {
        const y = base + Math.random() * (coneTop - base) * 0.97;
        const a = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(a), -0.25 - Math.random() * 0.3, Math.sin(a)).normalize();
        sprig(surface(y, a, 0.06), dir, 1.25);
      }
      // baubles: red, gold, a few deep green and silver
      const cols = gold ? [0xb3120e, 0xb3120e, 0xd8a23a, 0xd8a23a, 0x1d5a34, 0xc9c9c9] : [0xb3120e, 0xd8a23a, 0xc9c9c9];
      for (let i = 0; i < baubles; i++) {
        const y = base + 0.15 + Math.random() * (coneTop - base) * 0.82;
        const a = Math.random() * Math.PI * 2;
        const size = (0.035 + Math.random() * 0.03) * Math.min(1.2, 0.6 + h * 0.15);
        put('bauble', surface(y, a, -0.01), q.identity(), size, pick(cols));
      }
      // the lights, wound round from the bottom up
      for (let i = 0; i < bulbsN; i++) {
        const f = i / bulbsN;
        const y = base + 0.08 + f * (coneTop - base) * 0.93;
        const a = f * Math.PI * 2 * (h * 3.2) + Math.random() * 0.3;
        lights.tree.push({ pos: surface(y, a, -0.015).toArray(), colour: warm(), phase: Math.random() });
      }
      // a gold bead garland, swagged round it the other way
      if (gold) {
        const turns = Math.max(3, Math.round(h * 1.3));
        for (let i = 0; i < turns * 140; i++) {
          const f = i / (turns * 140);
          const a = -f * Math.PI * 2 * turns;
          const y = base + 0.25 + f * (coneTop - base) * 0.8 - 0.06 * Math.abs(Math.sin(a * 2.5));
          put('bead', surface(y, a, -0.005), q.identity(), 0.009, 0xe0b04a);
        }
      }
      if (star) {
        const st = new THREE.Mesh(starGeometry(h * 0.045 + 0.04, h * 0.018 + 0.016, 0.03), starMat);
        st.position.set(0, h + 0.03, 0);
        tg.add(st);
        lights.tree.push({ pos: [x, y0 + h + 0.03, z], colour: [1, 0.85, 0.45], phase: 0, big: true });
        this.stars = (this.stars ?? []).concat(st);
      }
      glows.push(new THREE.Vector3(x, y0 + h * 0.5, z));
      return { radiusAt, base };
    };

    // --- presents round a spot: boxes in wrapping paper, ribbons and bows ---
    const papers = [
      [0x9e1712, 0xe8c66a, 'stripes'],
      [0x1d5a34, 0xf3efe2, 'dots'],
      [0xf3efe2, 0xb3120e, 'stripes'],
      [0x24356f, 0xe8c66a, 'dots'],
      [0xc79a2e, 0x9e1712, 'dots'],
    ];
    const presentList = [];
    const presents = (cx, cy, cz, n, rMin, rMax) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const rr = rMin + Math.random() * (rMax - rMin);
        const w = 0.18 + Math.random() * 0.2;
        const d = 0.16 + Math.random() * 0.18;
        const hh = 0.1 + Math.random() * 0.2;
        presentList.push({ x: cx + Math.cos(a) * rr, y: cy, z: cz + Math.sin(a) * rr, w, d, h: hh, yaw: Math.random() * Math.PI, paper: i % papers.length });
      }
    };

    // ===== the great hall =====
    const hallFloor = this._down(HALL_TREE.x, HALL_TREE.z, 2) ?? 0.04;
    tree(HALL_TREE, hallFloor, { baubles: 80, bulbsN: 300 });
    presents(HALL_TREE.x, hallFloor, HALL_TREE.z, 9, HALL_TREE.r * 0.55, HALL_TREE.r * 1.05);
    // the garland up the stairs and across the landing (the railing's top, found point by point)
    {
      const railPath = (pts, across, from) => {
        const out = [];
        for (let i = 1; i < pts.length; i++) {
          const [ax, az] = pts[i - 1];
          const [bx, bz] = pts[i];
          const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.25));
          for (let k = i === 1 ? 0 : 1; k <= n; k++) {
            const x = ax + ((bx - ax) * k) / n;
            const z = az + ((bz - az) * k) / n;
            const y = this._railTop(x, z, from, across);
            if (y !== null) out.push(new THREE.Vector3(x, y, z));
          }
        }
        return out;
      };
      const X = new THREE.Vector3(1, 0, 0);
      const Z = new THREE.Vector3(0, 0, 1);
      // up the left stairs (the rail at x -5.55, rising to the back), the landing's front, down the right
      const left = railPath([[-5.55, -15.9], [-5.55, -20.1]], X, 5);
      const across = railPath([[-5.3, -20.35], [1.5, -20.35]], Z, 5.2);
      const right = railPath([[1.85, -20.1], [1.85, -15.9]], X, 5);
      if (left.length > 4) garland(left, new THREE.Vector3(1, 0, 0), { every: 1.05, dip: 0.15 });
      if (across.length > 4) garland(across, new THREE.Vector3(0, 0, 1), { every: 1.15, dip: 0.17 });
      if (right.length > 4) garland(right, new THREE.Vector3(-1, 0, 0), { every: 1.05, dip: 0.15 });
      // the gallery's balustrade, all round the hall, hung out over it
      const galL = railPath([[-7.55, -12.9], [-7.55, -22.15]], X, 5.4);
      const galBackL = railPath([[-7.45, -22.25], [-4.0, -22.25]], Z, 5.4);
      const galBackR = railPath([[0.1, -22.25], [3.75, -22.25]], Z, 5.4);
      const galR = railPath([[3.85, -22.15], [3.85, -12.9]], X, 5.4);
      for (const [path, out] of [
        [galL, new THREE.Vector3(1, 0, 0)],
        [galBackL, new THREE.Vector3(0, 0, 1)],
        [galBackR, new THREE.Vector3(0, 0, 1)],
        [galR, new THREE.Vector3(-1, 0, 0)],
      ]) {
        if (path.length > 4) garland(path, out, { every: 1.3, dip: 0.24 });
      }
      this.railPoints = left.length + across.length + right.length + galL.length + galBackL.length + galBackR.length + galR.length;
    }
    // mistletoe in the arch to the ballroom's corridor (the left-hand one: no flyby goes through it)
    {
      const x = -4.4;
      const z = -20.3;
      const top = (() => {
        const h = this.bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 1.2, z), up), THREE.DoubleSide, 0, 3);
        return h ? h.point.y : 2.15;
      })();
      // (the arch is low, 2.15 m: a short ribbon and a small bunch, clear of your head)
      const ballY = top - 0.08;
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.012, top - ballY, 0.012).translate(0, (top - ballY) / 2, 0), new THREE.MeshStandardMaterial({ color: 0xa3120f, roughness: 0.5 }));
      ribbon.position.set(x, ballY, z);
      g.add(ribbon);
      for (let i = 0; i < 70; i++) {
        const dir = new THREE.Vector3().randomDirection();
        const p = new THREE.Vector3(x, ballY - 0.05, z).addScaledVector(dir, 0.045 + Math.random() * 0.025);
        q.setFromUnitVectors(up, dir);
        put('leaf', p, q, new THREE.Vector3(0.012, 0.035, 0.006), Math.random() < 0.5 ? 0x7d9a45 : 0x93ad55);
      }
      berries(new THREE.Vector3(x, ballY - 0.05, z), 14, 0.1, 0xf2f2e6);
      bow(new THREE.Vector3(x, ballY + 0.02, z + 0.03), new THREE.Vector3(0, 0, 1), 0.8);
    }

    // ===== the ballroom =====
    const ballFloor = this._down(BALL_TREE.x, BALL_TREE.z, 2) ?? 0.04;
    tree(BALL_TREE, ballFloor, { baubles: 70, bulbsN: 260 });
    presents(BALL_TREE.x, ballFloor, BALL_TREE.z, 8, BALL_TREE.r * 0.6, BALL_TREE.r * 1.15);

    // ===== Lara's bedroom: a small tree in a red pot, a stocking on the bedpost =====
    const bedFloor = this._down(BED_TREE.x, BED_TREE.z, 7.2, 3) ?? 5.54;
    tree(BED_TREE, bedFloor, { baubles: 24, bulbsN: 90, pot: true, gold: false });
    presents(BED_TREE.x, bedFloor, BED_TREE.z, 3, 0.45, 0.6);
    this._stocking(g, new THREE.Vector3(-11.25, bedFloor + 1.0, -20.98), new THREE.Vector3(-1, 0, 0));

    // ===== holly behind the pictures =====
    {
      const hollyAt = (centre, top, normal, width, height) => {
        const side = new THREE.Vector3().crossVectors(up, normal).normalize();
        // (interior.js frames each picture: bars t wide, 0.6 t deep, standing 0.75 t above it)
        const t = THREE.MathUtils.clamp(Math.min(width, height) * 0.07, 0.04, 0.13);
        const at = centre.clone().setY(top + 0.75 * t - 0.015).addScaledVector(side, -width / 2 - 0.25 * t + 0.07).addScaledVector(normal, 0.6 * t + 0.015);
        // (bigger on bigger pictures, so it reads from across the room)
        const big = THREE.MathUtils.clamp(width / 1.1, 0.85, 1.7);
        for (let k = 0; k < 6; k++) {
          const a = -1.0 + k * 0.4 + (Math.random() - 0.5) * 0.2;
          // leaves fanning up and out from the corner, flat to the wall
          e.set(0, 0, a);
          const leafQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), normal.clone().negate(), up)).multiply(new THREE.Quaternion().setFromEuler(e));
          const dir = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), normal.clone().negate(), up)));
          put('holly', at.clone().addScaledVector(dir, 0.055 * big).addScaledVector(normal, k * 0.003), leafQ, (1.7 + Math.random() * 0.4) * big, 0x1d5c2e);
        }
        for (let k = 0; k < 6; k++) put('berry', at.clone().addScaledVector(normal, 0.025).add(new THREE.Vector3((Math.random() - 0.5) * 0.05 * big, (Math.random() - 0.3) * 0.04 * big, 0)), q.identity(), 0.015 * big, 0xc0160f);
      };
      let n = 0;
      // (a picture can be two pieces, its canvas and its border: one sprig for both, on the bigger)
      const pictures = this._pieces(/^cm_obj_painting_|^cm_obj_tapestry/).sort((a, b) => b.width * b.size.y - a.width * a.size.y);
      const kept = [];
      for (const pc of pictures) if (!kept.some((k) => k.centre.distanceTo(pc.centre) < 0.25)) kept.push(pc);
      for (const piece of kept) {
        if (piece.size.y < 0.45) continue;
        hollyAt(piece.centre, piece.box.max.y, piece.normal, piece.width, piece.size.y);
        n++;
      }
      this.hollyCount = n;
    }
    // ===== wreaths on the painted doors (on the ground floor and the gallery) =====
    {
      let n = 0;
      for (const piece of this._pieces(/^cm_obj_int_door$/)) {
        if (piece.size.y < 1.7 || piece.width < 0.6 || piece.box.min.y > 4.5) continue;
        this._wreath(put, sprig, berries, bow, piece.centre.clone().setY(piece.box.min.y + Math.min(1.7, piece.size.y * 0.78)).addScaledVector(piece.normal, 0.06), piece.normal, 0.2);
        n++;
      }
      this.wreathCount = n;
    }

    // ===== the kitchen: a gingerbread house, mince pies, a pudding =====
    {
      const on = ([x, z]) => new THREE.Vector3(x, this._down(x, z, 1.6, 1.2) ?? 0.9, z);
      this._gingerbread(g, put, on(ISLAND.ginger));
      this._pies(g, put, on(ISLAND.pies), on(ISLAND.pudding));
    }

    // ===== the dining room upstairs: Christmas dinner (from Christmas Eve to Boxing Day) =====
    this.dinner = new THREE.Group();
    this.dinner.name = 'Christmas dinner';
    g.add(this.dinner);
    {
      const T = TABLE;
      const top = this._down(T.x, T.z, T.y + 0.8, 1.2) ?? T.y;
      const dinnerPools = { plate: [], cracker: [] };
      const seats = [];
      for (const s of [-1, 1]) for (const k of [-0.72, 0, 0.72]) seats.push([T.x + k, T.z + s * (T.b - 0.2), s > 0 ? Math.PI / 2 : -Math.PI / 2]);
      for (const s of [-1, 1]) seats.push([T.x + s * (T.a - 0.22), T.z, s > 0 ? 0 : Math.PI]);
      for (const [px, pz, a] of seats) {
        dinnerPools.plate.push(new THREE.Vector3(px, top + 0.008, pz));
        // a cracker across each plate
        q.setFromEuler(e.set(0, -a + Math.PI / 2 + (Math.random() - 0.5) * 0.5, Math.PI / 2));
        dinnerPools.cracker.push([new THREE.Vector3(px, top + 0.035, pz), q.clone(), pick([0xb3120e, 0xd8a23a, 0x1d5a34, 0xf3efe2])]);
      }
      for (const p of dinnerPools.plate) put('plate', p, q.identity(), 1);
      for (const [p, qq, c] of dinnerPools.cracker) put('cracker', p, qq, 1, c);
      // the centrepiece: a low garland along the table's middle, three candles in brass, berries
      const line = [];
      for (let k = 0; k <= 16; k++) line.push(new THREE.Vector3(T.x - T.a * 0.55 + (k / 16) * T.a * 1.1, top + 0.02, T.z));
      const before = pools.sprig.length;
      garland(line, new THREE.Vector3(0, 1, 0), { every: 10, dip: 0, lit: false, bows: false });
      // (those sprigs belong to the dinner: they come and go with it)
      this._dinnerSprigs = pools.sprig.splice(before);
      for (let k = -1; k <= 1; k++) {
        const cx = T.x + k * T.a * 0.32;
        put('brass', new THREE.Vector3(cx, top, T.z), q.identity(), 1);
        put('candle', new THREE.Vector3(cx, top + 0.06, T.z), q.identity(), new THREE.Vector3(1, k === 0 ? 1.25 : 1, 1));
        lights.candle.push({ pos: [cx, top + 0.06 + (k === 0 ? 0.3 : 0.24) + 0.025, T.z], colour: [1, 0.62, 0.22], phase: Math.random() });
      }
      glows.push(new THREE.Vector3(T.x, top + 0.5, T.z));
      this.dinnerGlow = glows.length - 1;
      berries(new THREE.Vector3(T.x, top + 0.06, T.z), 24, 0.5);
    }

    // ===== the pools into instanced meshes =====
    const material = {
      sprig: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }),
      berry: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.05 }),
      bauble: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.75 }),
      bow: new THREE.MeshStandardMaterial({ color: 0xa3120f, roughness: 0.55, side: THREE.DoubleSide }),
      knot: new THREE.MeshStandardMaterial({ color: 0x8e0f0c, roughness: 0.5 }),
      holly: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.05, side: THREE.DoubleSide }),
      leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      plate: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.25 }),
      cracker: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.45 }),
      candle: new THREE.MeshStandardMaterial({ color: 0xf6f0de, roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.4 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.3, metalness: 0.9 }),
      bead: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.85 }),
    };
    const geometry = {
      sprig: new THREE.ConeGeometry(0.022, 0.12, 5, 1, true),
      berry: new THREE.SphereGeometry(1, 6, 4),
      bauble: new THREE.SphereGeometry(1, 12, 8),
      bow: new THREE.ConeGeometry(0.035, 0.09, 6, 1).translate(0, 0.045, 0),
      knot: new THREE.SphereGeometry(1, 8, 6),
      holly: hollyGeometry(),
      leaf: new THREE.SphereGeometry(1, 6, 4),
      plate: new THREE.CylinderGeometry(0.13, 0.1, 0.016, 24),
      cracker: (() => {
        // a cracker: a tube with two pinched ends
        const pts = [];
        for (const [r, y] of [
          [0.0, -0.15],
          [0.024, -0.15],
          [0.024, -0.12],
          [0.012, -0.095],
          [0.026, -0.075],
          [0.026, 0.075],
          [0.012, 0.095],
          [0.024, 0.12],
          [0.024, 0.15],
          [0.0, 0.15],
        ])
          pts.push(new THREE.Vector2(r, y));
        return new THREE.LatheGeometry(pts, 12);
      })(),
      candle: new THREE.CylinderGeometry(0.022, 0.024, 0.24, 12).translate(0, 0.12, 0),
      brass: new THREE.LatheGeometry(
        [
          [0.0, 0],
          [0.07, 0],
          [0.07, 0.012],
          [0.02, 0.03],
          [0.018, 0.045],
          [0.035, 0.055],
          [0.035, 0.065],
          [0.0, 0.065],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        14,
      ),
      bead: new THREE.SphereGeometry(1, 6, 4),
    };
    const shadows = { box: true, bauble: false };
    this.counts = {};
    for (const [name, list] of Object.entries(pools)) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geometry[name], material[name], list.length);
      const c = new THREE.Color();
      list.forEach(([mat, colour], i) => {
        mesh.setMatrixAt(i, mat);
        if (colour !== null && colour !== undefined) mesh.setColorAt(i, c.set(colour));
        else if (mesh.instanceColor || list.some((l) => l[1] != null)) mesh.setColorAt(i, c.set(0xffffff));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = !!shadows[name];
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      // (the dinner's things come and go with it)
      (name === 'plate' || name === 'cracker' || name === 'candle' || name === 'brass' ? this.dinner : g).add(mesh);
      this.counts[name] = list.length;
    }
    // the dinner's sprigs, their own mesh
    if (this._dinnerSprigs.length) {
      const mesh = new THREE.InstancedMesh(geometry.sprig, material.sprig, this._dinnerSprigs.length);
      const c = new THREE.Color();
      this._dinnerSprigs.forEach(([mat, colour], i) => {
        mesh.setMatrixAt(i, mat);
        mesh.setColorAt(i, c.set(colour ?? 0x24572f));
      });
      mesh.computeBoundingSphere();
      this.dinner.add(mesh);
    }

    // ===== the presents (from the week before Christmas): boxes, ribbons, bows =====
    this.presents = new THREE.Group();
    this.presents.name = 'Presents';
    g.add(this.presents);
    {
      const byPaper = papers.map(([base, ink, kind]) => {
        const map = paperTexture(`#${base.toString(16).padStart(6, '0')}`, `#${ink.toString(16).padStart(6, '0')}`, kind);
        return { mat: new THREE.MeshStandardMaterial({ map, roughness: 0.55 }), list: [] };
      });
      for (const p of presentList) byPaper[p.paper].list.push(p);
      const box = new THREE.BoxGeometry(1, 1, 1);
      // (the paper's pattern at the same size on every box: each face's UVs scaled by its size)
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xe8c66a, roughness: 0.3, metalness: 0.6 });
      const ribbons = [];
      for (const { mat, list } of byPaper) {
        if (!list.length) continue;
        const mesh = new THREE.InstancedMesh(box, mat, list.length);
        list.forEach((p, i) => {
          q.setFromAxisAngle(up, p.yaw);
          mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y + p.h / 2, p.z), q, new THREE.Vector3(p.w, p.h, p.d)));
          // two ribbons across, and a bow on top
          ribbons.push(m4.clone().compose(new THREE.Vector3(p.x, p.y + p.h / 2, p.z), q, new THREE.Vector3(p.w + 0.004, p.h + 0.004, 0.025)));
          ribbons.push(m4.clone().compose(new THREE.Vector3(p.x, p.y + p.h / 2, p.z), q, new THREE.Vector3(0.025, p.h + 0.004, p.d + 0.004)));
          ribbons.bows = (ribbons.bows ?? []).concat([[new THREE.Vector3(p.x, p.y + p.h + 0.01, p.z), p.yaw]]);
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.presents.add(mesh);
      }
      if (ribbons.length) {
        const rm = new THREE.InstancedMesh(box, ribbonMat, ribbons.length);
        ribbons.forEach((mm, i) => rm.setMatrixAt(i, mm));
        rm.computeBoundingSphere();
        this.presents.add(rm);
        const loops = ribbons.bows ?? [];
        const bm = new THREE.InstancedMesh(new THREE.TorusGeometry(0.03, 0.009, 6, 12), ribbonMat, loops.length * 2);
        loops.forEach(([p, yaw], i) => {
          for (const s of [0, 1]) {
            q.setFromEuler(e.set(0, yaw + s * Math.PI / 2, 0));
            bm.setMatrixAt(i * 2 + s, m4.compose(p.clone().add(new THREE.Vector3(0, 0.02, 0)), q, new THREE.Vector3(1, 1, 1)));
          }
        });
        bm.computeBoundingSphere();
        this.presents.add(bm);
      }
      this.presentCount = presentList.length;
    }

    // ===== the lights =====
    {
      // (the stars' glow is a bigger bulb of its own)
      const small = lights.tree.filter((b) => !b.big);
      const big = lights.tree.filter((b) => b.big);
      const tl = bulbs(small, 0.045);
      tl.userData.kind = 'tree';
      g.add(tl);
      this.lights.push(tl);
      if (big.length) {
        const sl = bulbs(big, 0.6);
        sl.userData.kind = 'tree';
        g.add(sl);
        this.lights.push(sl);
      }
      if (lights.candle.length) {
        const cl = bulbs(lights.candle, 0.09);
        cl.userData.kind = 'candle';
        this.dinner.add(cl);
        this.lights.push(cl);
      }
      this.bulbCount = lights.tree.length + lights.candle.length;
    }
    this.buildMs = Math.round(performance.now() - t0);
  }

  /** The connected pieces of the model's meshes whose material matches: flat things on walls. */
  _pieces(re) {
    const out = [];
    const v = new THREE.Vector3();
    this.model.traverse((o) => {
      if (!o.isMesh || !re.test(o.material?.name || '')) return;
      const geo = o.geometry;
      const pos = geo.attributes.position;
      const idx = geo.index;
      const n = pos.count;
      const parent = new Int32Array(n).map((_, i) => i);
      const find = (i) => {
        while (parent[i] !== i) i = parent[i] = parent[parent[i]];
        return i;
      };
      const tri = (idx ? idx.count : n) / 3;
      const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
      for (let t = 0; t < tri; t++) {
        const a = find(vi(t, 0));
        parent[find(vi(t, 1))] = a;
        parent[find(vi(t, 2))] = a;
      }
      const seen = new Map();
      for (let i = 0; i < n; i++) {
        const k = `${Math.round(pos.getX(i) * 100)},${Math.round(pos.getY(i) * 100)},${Math.round(pos.getZ(i) * 100)}`;
        if (seen.has(k)) parent[find(i)] = find(seen.get(k));
        else seen.set(k, i);
      }
      o.updateWorldMatrix(true, false);
      const boxes = new Map();
      for (let i = 0; i < n; i++) {
        const r = find(i);
        const b = boxes.get(r) ?? boxes.set(r, new THREE.Box3()).get(r);
        b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
      }
      for (const box of boxes.values()) {
        const size = box.getSize(new THREE.Vector3());
        // flat across x or z: its normal is that axis, pointing to the open side
        const axis = size.x < size.z ? 'x' : 'z';
        if (size[axis] > 0.12) continue;
        const centre = box.getCenter(new THREE.Vector3());
        const free = (s) => {
          const dir = new THREE.Vector3();
          dir[axis] = s;
          const h = this.bvh.raycastFirst(new THREE.Ray(centre.clone().addScaledVector(dir, 0.06), dir), THREE.DoubleSide, 0, 3);
          return h ? h.distance : 3;
        };
        const fp = free(1);
        const fm = free(-1);
        if (Math.max(fp, fm) < 0.6) continue;
        const normal = new THREE.Vector3();
        normal[axis] = fp >= fm ? 1 : -1;
        out.push({ box, size, centre, normal, width: axis === 'x' ? size.z : size.x });
      }
    });
    return out;
  }

  _wreath(put, sprig, berries, bow, at, normal, radius) {
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, normal).normalize();
    for (let k = 0; k < 90; k++) {
      const a = (k / 90) * Math.PI * 2;
      const ring = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
      const p = at.clone().addScaledVector(ring, radius * (0.9 + Math.random() * 0.2));
      const dir = ring.clone().multiplyScalar(0.4 + Math.random() * 0.4).addScaledVector(normal, 0.6).add(new THREE.Vector3().randomDirection().multiplyScalar(0.5)).normalize();
      sprig(p, dir, 0.95);
    }
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2;
      berries(at.clone().addScaledVector(side, Math.cos(a) * radius).addScaledVector(up, Math.sin(a) * radius).addScaledVector(normal, 0.05), 3, 0.03);
    }
    bow(at.clone().addScaledVector(up, -radius).addScaledVector(normal, 0.07), normal, 1.1);
  }

  /** A red stocking with a white cuff, hanging from `at`, its toe pointing `toe`. */
  _stocking(g, at, toe) {
    const red = new THREE.MeshStandardMaterial({ color: 0xa3120f, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.95 });
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.22, 0), new THREE.Vector3(0.02, -0.34, 0), new THREE.Vector3(0.12, -0.38, 0)]);
    const leg = new THREE.Mesh(new THREE.TubeGeometry(path, 16, 0.065, 10, false), red);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 12).translate(0, 0.02, 0), white);
    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.066, 10, 8), red);
    toeCap.position.set(0.12, -0.38, 0);
    const s = new THREE.Group();
    s.add(leg, cuff, toeCap);
    s.position.copy(at);
    s.rotation.y = Math.atan2(-toe.z, toe.x);
    s.updateMatrix();
    // (baked in its own frame, then placed)
    const pos = s.position.clone();
    const rot = s.rotation.y;
    s.position.set(0, 0, 0);
    s.rotation.y = 0;
    bake(s);
    s.position.copy(pos);
    s.rotation.y = rot;
    g.add(s);
  }

  /** A gingerbread house on a board, iced, with sweets on its roof. */
  _gingerbread(g, put, at) {
    const ginger = new THREE.MeshStandardMaterial({ color: 0x9a5a26, roughness: 0.8 });
    const icing = new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.6 });
    const board = new THREE.MeshStandardMaterial({ color: 0xe9e2d0, roughness: 0.4 });
    const h = new THREE.Group();
    h.position.copy(at);
    h.rotation.y = Math.PI / 2;
    const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = m.receiveShadow = true;
      h.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24), board, 0, 0.006, 0);
    // walls, a gable each end (a prism), the roof's two slabs
    add(new THREE.BoxGeometry(0.2, 0.12, 0.15), ginger, 0, 0.072, 0);
    const gable = new THREE.Shape();
    gable.moveTo(-0.075, 0);
    gable.lineTo(0.075, 0);
    gable.lineTo(0, 0.07);
    gable.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.012, bevelEnabled: false });
    for (const s of [-1, 1]) {
      const m = add(gGeo, ginger, s * 0.094, 0.132, 0);
      m.rotation.y = Math.PI / 2;
      m.position.x = s * 0.094 - (s < 0 ? 0 : 0.012);
    }
    for (const s of [-1, 1]) {
      // (each slab from the eaves up to the ridge: 0.106 long at 0.72 rad)
      add(new THREE.BoxGeometry(0.235, 0.012, 0.122), ginger, 0, 0.168, s * 0.041, s * 0.72);
      // snow-white icing over the slab
      add(new THREE.BoxGeometry(0.24, 0.005, 0.116), icing, 0, 0.176, s * 0.045, s * 0.72);
    }
    add(new THREE.BoxGeometry(0.24, 0.014, 0.016), icing, 0, 0.208, 0);
    // a door and windows in icing
    add(new THREE.BoxGeometry(0.04, 0.06, 0.004), icing, 0, 0.042, 0.077);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.035, 0.03, 0.004), icing, s * 0.06, 0.085, 0.077);
    // sweets along the roof (with the berries: one instanced mesh)
    h.updateMatrixWorld(true);
    const cols = [0xd8262a, 0x2a9d4a, 0xf2c230, 0x3a6fd8, 0xf3efe6];
    for (let k = 0; k < 18; k++) {
      const s = k % 2 ? 1 : -1;
      const u = (Math.floor(k / 2) / 9) * 0.2 - 0.1;
      put('berry', h.localToWorld(new THREE.Vector3(u, 0.18, s * 0.05)), new THREE.Quaternion(), 0.008, cols[k % cols.length]);
    }
    g.add(bake(h));
  }

  /** A plate of mince pies, and a Christmas pudding with holly beside it. */
  _pies(g, put, at, pudAt) {
    const pastry = new THREE.MeshStandardMaterial({ color: 0xc98a45, roughness: 0.75 });
    const sugar = new THREE.MeshStandardMaterial({ color: 0xf8f4ea, roughness: 0.9 });
    const plateM = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.25 });
    const pud = new THREE.MeshStandardMaterial({ color: 0x3a2014, roughness: 0.85 });
    const p = new THREE.Group();
    p.position.copy(at);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.014, 24).translate(0, 0.007, 0), plateM);
    p.add(plate);
    const pie = new THREE.CylinderGeometry(0.035, 0.03, 0.022, 14).translate(0, 0.025, 0);
    const lid = new THREE.CylinderGeometry(0.03, 0.033, 0.006, 14).translate(0, 0.038, 0);
    for (let k = 0; k < 7; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = k === 6 ? 0 : 0.085;
      const m = new THREE.Mesh(pie, pastry);
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const l = new THREE.Mesh(lid, sugar);
      l.position.copy(m.position);
      p.add(m, l);
    }
    // the pudding, on its own plate to one side, white icing poured over and a sprig of holly
    const pp = new THREE.Group();
    pp.position.copy(pudAt).sub(at);
    pp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.014, 24).translate(0, 0.007, 0), plateM));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.014, 0), pud);
    const icingTop = new THREE.Mesh(new THREE.SphereGeometry(0.087, 18, 6, 0, Math.PI * 2, 0, 0.6).translate(0, 0.014, 0), sugar);
    pp.add(dome, icingTop);
    const leafGeo = hollyGeometry();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x123d1f, roughness: 0.3, side: THREE.DoubleSide });
    for (let k = 0; k < 3; k++) {
      const l = new THREE.Mesh(leafGeo, leafMat);
      l.position.set(0, 0.1, 0);
      l.rotation.set(-Math.PI / 2 + 0.4, 0, (k / 3) * Math.PI * 2);
      l.translateY(0.03);
      pp.add(l);
    }
    const berry = new THREE.MeshStandardMaterial({ color: 0xb3130f, roughness: 0.3 });
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), berry);
      b.position.set((k - 1) * 0.014, 0.106, 0.004 * k);
      pp.add(b);
    }
    p.add(pp);
    g.add(bake(p));
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day day of the year
   * @param {number} o.hours the clock
   * @param {THREE.Camera} o.camera
   * @param {boolean} [o.houseOn] the panel's switch for the house's lights
   * @param {number} [o.scale] the bulbs' size on screen (the lamps' uScale)
   */
  update(dt, { day, hours, camera, houseOn = true, scale = null }) {
    const d = Math.floor(day);
    const on = inRange(d, SEASON);
    this.group.visible = on;
    if (!on) {
      if (!this.borrowed) this.light.intensity = 0; // (a borrowed light is its owner's out of season)
      return;
    }
    if (!this.built) this.build();
    this.t += dt;
    const t = this.t;
    this.presents.visible = inRange(d, PRESENTS);
    this.dinner.visible = inRange(d, DINNER);
    // the tree lights: on while the house is up (and all day from Christmas Eve to New Year's Day);
    // the candles on the table lit for the evening
    const treesLit = houseOn && (inRange(d, ALL_DAY) || (hours >= 7.5 && hours < 23.75)) ? 1 : 0;
    const candlesLit = houseOn && this.dinner.visible && (hours >= 15.5 || hours < 0.75) ? 1 : 0;
    const flick = 0.85 + 0.1 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 23 + 1);
    for (const p of this.lights) {
      const u = p.material.uniforms;
      const lit = p.userData.kind === 'candle' ? candlesLit * flick : treesLit;
      u.uOn.value = lit;
      u.uTime.value = t;
      if (scale !== null && u.uScale) u.uScale.value = scale;
      p.visible = lit > 0.01;
    }
    for (const s of this.stars ?? []) s.material.emissiveIntensity = 0.25 + 0.9 * treesLit;
    // the one light: at the nearest tree or table, inside the house only
    const cam = camera.position;
    let best = null;
    let bestD = Infinity;
    this.glows.forEach((p, i) => {
      if (i === this.dinnerGlow && !candlesLit) return;
      const dd = p.distanceTo(cam);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    const inside = this.houseBox?.containsPoint(cam) ?? true;
    if (best !== null && inside && bestD < 14 && (treesLit || (best === this.dinnerGlow && candlesLit))) {
      this.light.position.copy(this.glows[best]);
      const candle = best === this.dinnerGlow;
      this.light.color.setHex(candle ? 0xff9a48 : 0xffb066);
      this.light.intensity = (candle ? 2.2 * flick : 2.6 + 0.2 * Math.sin(t * 1.7)) * THREE.MathUtils.smoothstep(14 - bestD, 0, 3);
      this.light.distance = candle ? 5 : 7;
    } else this.light.intensity = 0;
  }
}

/** A five-pointed star, `outer` and `inner` radii, `depth` thick, facing +z. */
function starGeometry(outer, inner, depth) {
  const shape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 ? inner : outer;
    if (k === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}
