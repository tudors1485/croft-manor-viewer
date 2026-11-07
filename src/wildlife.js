// The estate's wildlife, beyond the deer and the bats (park.js): each at its own time of year and
// day, not every day, and never many at once, with their own calls (real recordings, public/sounds):
//
// - crows in autumn: flocks crossing the sky or wheeling over the trees, bigger towards evening
//   as they go to roost, cawing
// - a red kite circling high over the estate on most days, now and then its whistling call
// - wood pigeons on the roof ridge, cooing on spring and summer mornings; a collared dove now and then
// - a robin that comes down near you while you are in the garden, hopping, and sings
// - a magpie or two on the lawns, chattering off when you get close
// - rabbits at the edges of the lawns and in the fields at dawn and dusk, spring and summer,
//   bolting when you come near
// - a fox at night, trotting across the lawn, stopping to sniff; and foxes screaming and barking
//   far off in the fields (screams mostly in winter)
// - a black cat about the front of the house some mornings and evenings, sitting, walking on, and
//   a miaow if you come close
// - mallards on the fountain's basin or the water by the assault course, spring to autumn, dabbling and quacking
//
// The models: Quaternius (fox, cat, the eagle recoloured as a red kite: CC0), Sherkiz (rabbit), the
// Poly by Google mallard drake, magpie and pigeon, jeremy (robin, recoloured as a European one),
// weirdybeardyman (the duck: CC0). The flocks (crows) are drawn here. Credits in
// public/animals/LICENSE.txt and public/sounds/LICENSE.txt.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const ss = THREE.MathUtils.smoothstep;
const UP = new THREE.Vector3(0, 1, 0);
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
/** Is `day` within [a, b] (which may run over the new year)? */
const season = (day, a, b) => (a <= b ? day >= a && day <= b : day >= a || day <= b);

export const WILD_SOUNDS = ['crow-1', 'crow-2', 'crow-3', 'crows', 'robin-1', 'robin-2', 'woodpigeon', 'dove', 'magpie-1', 'magpie-2', 'kite', 'mallard', 'fox-scream-1', 'fox-scream-2', 'fox-bark', 'cat'];

/** A loaded model, sized: its holder (to move and turn), and its mixer and actions if it is animated. */
function animal(gltf, size, { axis = 'y', tint = null, yaw = 0 } = {}) {
  const model = gltf.animations.length ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const ext = box.getSize(new THREE.Vector3());
  const along = axis === 'y' ? ext.y : Math.max(ext.x, ext.z);
  model.scale.setScalar(size / Math.max(1e-4, along));
  // its feet on the holder's floor, its head towards the holder's +z
  model.position.y = -box.min.y * model.scale.y;
  model.rotation.y = yaw;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // (skinned: the bounds don't follow the animation)
    if (tint) {
      o.material = o.material.clone();
      o.material.color.multiply(tint);
    }
  });
  const holder = new THREE.Group();
  holder.add(model);
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
  const actions = {};
  for (const clip of gltf.animations) actions[clip.name.replace(/^.*\|/, '')] = mixer.clipAction(clip);
  return { holder, model, mixer, actions, current: null };
}

function play(a, name, fade = 0.3, rate = 1) {
  const next = a.actions[name];
  if (!next) return;
  next.timeScale = rate;
  if (a.current === next) return;
  next.reset().setEffectiveWeight(1).play();
  if (a.current) a.current.crossFadeTo(next, fade, false);
  a.current = next;
}

/** Instanced birds (a body and two wings, beating): for the flocks. */
class Flock {
  constructor(scene, max, { colour = 0x0a0909, length = 0.46, span = 0.98 } = {}) {
    const body = new THREE.SphereGeometry(0.5, 7, 5).scale(0.13, 0.12, 1).scale(length, length, length);
    const tail = new THREE.ConeGeometry(0.05, 0.16, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.24);
    const wing = new THREE.BufferGeometry();
    const half = span / 2;
    // a broad wing, fingered at the tip
    const pts = [
      [0, 0, 0.08],
      [half * 0.45, 0.01, 0.09],
      [half * 0.85, 0, 0.04],
      [half, 0, -0.02],
      [half * 0.8, 0, -0.08],
      [half * 0.4, 0, -0.1],
      [0, 0, -0.08],
    ];
    const pos = [];
    for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
    wing.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wing.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, fog: true });
    this.bodies = new THREE.InstancedMesh(body, mat, max);
    this.tails = new THREE.InstancedMesh(tail, mat, max);
    this.wingsL = new THREE.InstancedMesh(wing, mat, max);
    this.wingsR = new THREE.InstancedMesh(wing.clone().scale(-1, 1, 1), mat, max);
    this.group = new THREE.Group();
    this.group.name = 'Birds';
    this.group.visible = false;
    for (const m of this.meshes) {
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    scene.add(this.group);
    this._m = new THREE.Matrix4();
    this._w = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._one = new THREE.Vector3(1, 1, 1);
  }

  get meshes() {
    return [this.bodies, this.tails, this.wingsL, this.wingsR];
  }

  /** Draws bird `i` at `p` flying along `v`, its wings at `beat` (radians, 0 level). */
  set(i, p, v, beat, roll = 0) {
    const heading = Math.atan2(v.x, v.z);
    this._e.set(-Math.atan2(v.y, Math.hypot(v.x, v.z)), heading, roll, 'YXZ');
    this._q.setFromEuler(this._e);
    this._m.compose(p, this._q, this._one);
    this.bodies.setMatrixAt(i, this._m);
    this.tails.setMatrixAt(i, this._m);
    this._w.makeRotationZ(beat).premultiply(this._m);
    this.wingsL.setMatrixAt(i, this._w);
    this._w.makeRotationZ(-beat).premultiply(this._m);
    this.wingsR.setMatrixAt(i, this._w);
  }

  show(n) {
    for (const m of this.meshes) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    this.group.visible = n > 0;
  }
}

export class Wildlife {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {(x: number, z: number) => number|null} o.ground the ground's height
   * @param {(x: number, z: number) => boolean} o.isLawn grass inside the estate
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree
   * @param {THREE.Box3} o.houseBox
   * @param {THREE.Mesh[]} o.waters the outdoor water surfaces (the ducks swim only where there is water)
   * @param {{ sample: (name: string, position: THREE.Vector3|null, opts?: object) => void }} o.sound
   */
  constructor(scene, { ground, isLawn, bvh, houseBox, waters = [], sound }) {
    this.scene = scene;
    this.ground = (x, z) => ground(x, z) ?? 0;
    this.isLawn = isLawn;
    this.bvh = bvh;
    this.houseBox = houseBox;
    // where there is open water: a grid of points on each outdoor surface (the fountain's basin,
    // the channel by the assault course); the ducks keep to it
    this.water = [];
    const caster = new THREE.Raycaster();
    for (const mesh of waters) {
      const box = new THREE.Box3().setFromObject(mesh);
      const pts = [];
      for (let x = box.min.x + 0.4; x < box.max.x; x += 0.6) {
        for (let z = box.min.z + 0.4; z < box.max.z; z += 0.6) {
          caster.set(new THREE.Vector3(x, box.max.y + 3, z), new THREE.Vector3(0, -1, 0));
          const hit = caster.intersectObject(mesh, false)[0];
          if (hit) pts.push(hit.point);
        }
      }
      // (only well inside the water: a point with water all round it)
      const inner = pts.filter((p) => pts.filter((q) => Math.abs(q.x - p.x) < 0.95 && Math.abs(q.z - p.z) < 0.95).length >= 9);
      if (inner.length > 20) this.water.push(inner);
    }
    this.water.sort((a, b) => b.length - a.length);
    this.sound = sound;
    this.t = 0;
    this.ready = false;
    this.crows = new Flock(scene, 80);
    this.flock = null;
    this.nextFlock = rnd(15, 60);
    this.flockCall = 0;
    // where the wood pigeons sit: the main ridge of the roof
    this.perches = [];
    const ray = new THREE.Ray();
    for (const x of [-6.5, -2.5, 2.2]) {
      ray.set(new THREE.Vector3(x, 40, -20), new THREE.Vector3(0, -1, 0));
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 50);
      if (hit && hit.point.y > 9) this.perches.push(hit.point.clone());
    }
    this.nextCoo = rnd(5, 30);
    this.nextFoxCall = rnd(30, 120);
    this.nextKiteCall = rnd(20, 80);
    this.nextRobin = rnd(20, 70);
    this.nextMagpieCall = rnd(30, 90);
    this.nextFox = rnd(10, 60);
    this.nextQuack = rnd(10, 40);
    this.always = {}; // (for testing: { cat: true, … } brings one out whatever the day's luck)
  }

  /** Is today one of the days for this animal (`p` of them), or is it always out (testing)? */
  _luck(day, seed, p, name) {
    return !!this.always[name] || this._today(day, seed) < p;
  }

  /** Loads the models and the sounds (the estate works without them if they don't load). */
  async load(base = '') {
    const loader = new GLTFLoader();
    const names = ['fox', 'rabbit', 'cat', 'duck', 'kite', 'robin', 'magpie', 'pigeon', 'drake'];
    const got = await Promise.all(names.map((n) => loader.loadAsync(`${base}animals/${n}.glb`).catch(() => null)));
    const g = Object.fromEntries(names.map((n, i) => [n, got[i]]));
    const add = (a) => {
      a.holder.visible = false;
      this.scene.add(a.holder);
      return a;
    };
    if (g.kite) this.kite = add(animal(g.kite, 1.75, { axis: 'xz' }));
    // (yaw: which way each model faces, turned so its head is towards +z)
    if (g.pigeon) this.pigeons = this.perches.map(() => add(animal(g.pigeon, 0.36, { axis: 'xz', tint: new THREE.Color(0.4, 0.42, 0.48) })));
    if (g.robin) this.robin = add(animal(g.robin, 0.14, { axis: 'xz', yaw: -Math.PI / 2 }));
    if (g.magpie) this.magpies = [0, 1].map(() => add(animal(g.magpie, 0.46, { axis: 'xz', yaw: -Math.PI / 2 })));
    if (g.rabbit) this.rabbits = [0, 1, 2, 3, 4].map(() => add(animal(g.rabbit, 0.42, { axis: 'xz', yaw: Math.PI })));
    if (g.fox) this.fox = add(animal(g.fox, 0.5));
    if (g.cat) this.cat = add(animal(g.cat, 0.5, { axis: 'xz', yaw: -Math.PI / 2 }));
    this.ducks = [];
    if (g.duck) for (let k = 0; k < 2; k++) this.ducks.push(add(animal(g.duck, 0.55, { axis: 'xz', yaw: -Math.PI / 2 })));
    if (g.drake) this.ducks.push(add(animal(g.drake, 0.58, { axis: 'xz' })));
    if (this.kite) {
      play(this.kite, 'Flying', 0, 0.3);
      this.kiteState = { a: Math.random() * 6.28, r: rnd(50, 85), h: rnd(55, 95), c: new THREE.Vector3(rnd(-40, 50), 0, rnd(-60, 30)), flap: 0 };
    }
    this.ready = true;
  }

  /** Today's luck for one kind of animal (the same all day). */
  _today(day, seed) {
    return hash(Math.floor(day) * 13.7 + seed);
  }

  /** Calls `name` at `pos` (muffled indoors). */
  _call(name, pos, opts = {}) {
    this.sound?.sample(name, pos, { ...opts, gain: (opts.gain ?? 1) * (1 - 0.75 * this.inside) });
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {number} o.hours
   * @param {number} o.sunDeg the sun's height in degrees
   * @param {THREE.Camera} o.camera
   * @param {THREE.Vector3|null} o.feet where you stand while walking (null otherwise)
   * @param {object} o.weather (weather.js)
   * @param {number} o.inside 0..1
   * @param {number} o.frozen the ponds frozen 0..1
   */
  update(dt, { day, hours, sunDeg, camera, feet, weather, inside, frozen }) {
    this.t += dt;
    this.inside = inside;
    const cam = camera.position;
    const daylight = sunDeg > 1;
    const dark = sunDeg < -8;
    const wet = weather.rain > 0.2 || weather.snowing > 0.3 || weather.storm > 0.2;
    const foggy = weather.fog > 0.5;
    this._crows(dt, cam, day, hours, sunDeg, daylight && !wet);
    if (!this.ready) return;
    this._kite(dt, cam, day, hours, daylight && !wet && !foggy);
    this._pigeons(dt, day, hours, daylight && weather.storm < 0.2);
    this._robin(dt, cam, day, daylight && !wet, feet);
    this._magpies(dt, cam, day, daylight && !wet, feet);
    this._rabbits(dt, cam, day, sunDeg, hours, !wet && !foggy, feet);
    this._fox(dt, cam, day, dark, feet);
    this._cat(dt, cam, day, hours, !wet, feet);
    this._ducks(dt, day, daylight && frozen < 0.5);
  }

  // --- crows: autumn flocks ---

  /** A flock of crows now (for the Sights menu): big, wheeling over the estate. */
  crowsNow() {
    this.flock = null;
    this.nextFlock = 0;
    this._forceBig = true;
  }

  _crows(dt, cam, day, hours, sunDeg, ok) {
    const autumn = season(day, 258, 335);
    if (!this.flock && autumn && ok) {
      this.nextFlock -= dt;
      if (this.nextFlock <= 0) {
        // towards evening they gather to go to roost: more of them, more often
        const roost = hours > 14.5 && sunDeg > -2 && sunDeg < 18;
        const big = this._forceBig || roost;
        const n = Math.floor(big ? rnd(45, 80) : rnd(12, 30));
        const wheel = this._forceBig || Math.random() < (big ? 0.55 : 0.35);
        const sight = this._forceBig;
        const from = new THREE.Vector3(Math.cos(rnd(0, 6.28)), 0, Math.sin(rnd(0, 6.28))).normalize();
        const alt = rnd(30, 55);
        // (for the Sights menu: wheeling over the house, in front of you, from not far off)
        const c = sight ? new THREE.Vector3(6, 38, -24) : new THREE.Vector3(rnd(-30, 40), alt, rnd(-50, 30));
        this.flock = {
          n,
          wheel,
          radius: sight ? 30 : 60,
          t: 0,
          life: wheel ? rnd(45, 80) : 1e9,
          centre: c.clone().addScaledVector(from, sight ? 160 : wheel ? 380 : 420),
          dir: from.clone().negate(),
          aim: c,
          speed: rnd(9, 12),
          birds: Array.from({ length: n }, () => ({ off: new THREE.Vector3(rnd(-1, 1) * 22, rnd(-1, 1) * 7, rnd(-1, 1) * 22), phase: rnd(0, 6.28), rate: rnd(4.2, 5.4), glide: 0, p: new THREE.Vector3(), v: new THREE.Vector3() })),
          bed: false,
        };
        this.nextFlock = roost ? rnd(30, 80) : rnd(80, 220);
        this._forceBig = false;
      }
    }
    // (out of season, or the weather turned, or night came, or the date jumped: they are gone)
    if (this.flock && !(autumn && ok)) this.flock = null;
    const f = this.flock;
    if (!f) {
      this.crows.show(0);
      return;
    }
    f.t += dt;
    // the flock's middle: straight across the sky, or in to wheel round over the trees, then off
    if (f.wheel && f.t < f.life) {
      const toAim = (this._toAim ??= new THREE.Vector3()).copy(f.aim).sub(f.centre);
      const d = toAim.length();
      if (d > f.radius) f.dir.lerp(toAim.normalize(), 1 - Math.exp(-dt * (f.radius < 40 ? 2 : 0.8))).normalize();
      else f.dir.applyAxisAngle(UP, (dt * f.speed) / f.radius).normalize();
    }
    f.centre.addScaledVector(f.dir, f.speed * dt);
    f.centre.y += (f.aim.y + 6 * Math.sin(f.t * 0.2) - f.centre.y) * (1 - Math.exp(-dt * 0.5));
    // (gone: out of sight, or sent off by a jump in the date or the weather)
    if (f.centre.distanceTo(cam) > 700 && f.t > 20) {
      this.flock = null;
      this.crows.show(0);
      return;
    }
    // each bird about the middle, drifting in and out of place (scratch vectors: no garbage each frame)
    const want = (this._want ??= new THREE.Vector3());
    f.birds.forEach((b, i) => {
      want.set(Math.sin(this.t * 0.5 + b.phase) * 5, Math.sin(this.t * 0.7 + b.phase * 2) * 2, Math.cos(this.t * 0.4 + b.phase) * 5).add(f.centre).add(b.off);
      b.v.copy(want).sub(b.p).multiplyScalar(b.p.lengthSq() ? 1.2 : 0);
      if (!b.p.lengthSq()) b.p.copy(want);
      b.v.addScaledVector(f.dir, f.speed);
      b.p.addScaledVector(b.v, dt * 0.25).addScaledVector(f.dir, f.speed * dt * 0.75);
      // flapping, with a glide now and then
      b.glide -= dt;
      if (b.glide < -rnd(2, 6)) b.glide = rnd(0.6, 1.8);
      const beat = b.glide > 0 ? 0.08 : Math.sin(this.t * b.rate * 2 * Math.PI * 0.5 + b.phase) * 0.75;
      this.crows.set(i, b.p, b.v, beat, Math.sin(this.t + b.phase) * 0.15);
    });
    this.crows.show(f.n);
    // cawing: one bird then another; and the whole flock's din as it comes over
    const near = f.centre.distanceTo(cam);
    this.flockCall -= dt;
    if (this.flockCall <= 0 && near < 300) {
      const b = pick(f.birds);
      this._call(pick(['crow-1', 'crow-2', 'crow-3']), b.p, { ref: 30, rolloff: 1, max: 600, gain: 0.7, rate: rnd(0.9, 1.1) });
      this.flockCall = rnd(0.4, 2.2) * (f.n > 40 ? 0.6 : 1);
    }
    if (!f.bed && near < 160 && f.n > 30) {
      f.bed = true;
      this._call('crows', f.centre, { ref: 50, rolloff: 0.9, max: 800, gain: 0.55 });
    }
  }

  // --- the red kite ---

  _kite(dt, cam, day, hours, ok) {
    const k = this.kite;
    const today = this._luck(day, 1, season(day, 80, 260) ? 0.75 : 0.5, 'kite');
    const up = ok && today && hours > 9.5 && hours < 17.5;
    k.holder.visible = up;
    if (!up) return;
    const s = this.kiteState;
    // soaring in wide circles, rising and falling a little, banked into the turn
    s.a += (dt * 9) / s.r;
    const p = new THREE.Vector3(s.c.x + Math.cos(s.a) * s.r, s.h + 5 * Math.sin(this.t * 0.13), s.c.z + Math.sin(s.a) * s.r);
    k.holder.position.copy(p);
    k.holder.rotation.set(0, -s.a, 0, 'YXZ');
    k.holder.rotateZ(-0.35);
    // (it drifts slowly over the country)
    s.c.x += dt * 0.6 * Math.sin(this.t * 0.01);
    s.c.z += dt * 0.6 * Math.cos(this.t * 0.013);
    // mostly gliding, a few lazy wingbeats now and then
    s.flap -= dt;
    if (s.flap < -rnd(8, 20)) s.flap = rnd(1.5, 3);
    play(k, 'Flying', 0.4, s.flap > 0 ? 0.7 : 0.12);
    k.mixer.update(dt);
    this.nextKiteCall -= dt;
    if (this.nextKiteCall <= 0) {
      this._call('kite', p, { ref: 60, rolloff: 0.8, max: 900, gain: 0.9 });
      this.nextKiteCall = rnd(45, 150);
    }
  }

  // --- wood pigeons on the ridge, and a collared dove ---

  _pigeons(dt, day, hours, ok) {
    if (!this.pigeons) return;
    const n = this._luck(day, 2, 0.7, 'pigeons') ? this.pigeons.length : 1;
    this.pigeons.forEach((pg, i) => {
      pg.holder.visible = ok && i < n;
      if (!pg.holder.visible) return;
      const at = this.perches[i];
      pg.holder.position.copy(at);
      // a turn of the head every so often, a shuffle along the ridge
      pg.holder.rotation.y = Math.PI / 2 + (i % 2 ? Math.PI : 0) + 0.35 * Math.sin(this.t * 0.31 + i * 2) + (Math.sin(this.t * 0.07 + i) > 0.9 ? 0.6 : 0);
    });
    // cooing: on spring and summer mornings and evenings most, hardly in winter
    const busy = season(day, 60, 260) ? (hours < 11 || (hours > 16 && hours < 20.5) ? 1 : 0.35) : 0.12;
    this.nextCoo -= dt * busy;
    if (ok && this.nextCoo <= 0) {
      const dove = Math.random() < 0.25;
      this._call(dove ? 'dove' : 'woodpigeon', dove ? new THREE.Vector3(rnd(-30, 40), 9, rnd(15, 40)) : this.perches[Math.floor(Math.random() * this.perches.length)] ?? null, { ref: 20, rolloff: 1, max: 300, gain: 0.7 });
      this.nextCoo = rnd(25, 70);
    }
  }

  // --- the robin: down near you in the garden ---

  _robin(dt, cam, day, ok, feet) {
    const r = this.robin;
    if (!r) return;
    const likely = season(day, 270, 120) ? 1 : 0.5; // autumn to spring most
    const s = (this.robinState ??= { on: false });
    if (!s.on) {
      r.holder.visible = false;
      this.nextRobin -= dt * likely;
      // (only while you are on foot in the garden, inside the walls)
      if (ok && feet && this.nextRobin <= 0) {
        this.nextRobin = rnd(40, 120);
        for (let k = 0; k < 12; k++) {
          const a = rnd(0, 6.28);
          const d = rnd(4, 7);
          const x = feet.x + Math.cos(a) * d;
          const z = feet.z + Math.sin(a) * d;
          if (!this.isLawn(x, z)) continue;
          Object.assign(s, { on: true, p: new THREE.Vector3(x, this.ground(x, z), z), heading: rnd(0, 6.28), hop: 0, next: rnd(1, 3), sing: rnd(3, 10), life: rnd(40, 90), leaving: 0 });
          break;
        }
      }
      return;
    }
    r.holder.visible = true;
    s.life -= dt;
    const near = feet ? Math.hypot(feet.x - s.p.x, feet.z - s.p.z) : 99;
    if (!s.leaving && (near < 2.2 || s.life <= 0 || !ok)) s.leaving = 0.001;
    if (s.leaving) {
      // off, low and fast, away
      s.leaving += dt;
      s.p.x += Math.sin(s.heading) * 7 * dt;
      s.p.z += Math.cos(s.heading) * 7 * dt;
      s.p.y += dt * 2.5;
      if (s.leaving > 2) s.on = false;
    } else {
      // hop, hop, look about; now and then a phrase of song
      s.next -= dt;
      if (s.next <= 0 && s.hop <= 0) {
        s.heading += rnd(-1.2, 1.2);
        s.hop = 0.16;
        s.next = rnd(0.6, 3);
      }
      if (s.hop > 0) {
        s.hop -= dt;
        const nx = s.p.x + Math.sin(s.heading) * 1.3 * dt;
        const nz = s.p.z + Math.cos(s.heading) * 1.3 * dt;
        if (this.isLawn(nx, nz)) {
          s.p.x = nx;
          s.p.z = nz;
        } else s.heading += Math.PI;
      }
      s.p.y = this.ground(s.p.x, s.p.z) + (s.hop > 0 ? Math.sin((1 - s.hop / 0.16) * Math.PI) * 0.06 : 0);
      s.sing -= dt;
      if (s.sing <= 0) {
        this._call(pick(['robin-1', 'robin-2']), s.p, { ref: 10, rolloff: 1.2, max: 120, gain: 0.8 });
        s.sing = rnd(10, 28);
      }
    }
    r.holder.position.copy(s.p);
    r.holder.rotation.y = s.heading;
  }

  // --- magpies on the lawns ---

  _magpies(dt, cam, day, ok, feet) {
    if (!this.magpies) return;
    const n = this.always.magpies ? 2 : this._today(day, 3) < 0.35 ? 0 : this._today(day, 4) < 0.5 ? 1 : 2;
    this.magpies.forEach((m, i) => {
      const s = (m.state ??= { spot: null });
      m.holder.visible = ok && i < n && !!s.spot;
      if (!(ok && i < n)) return;
      if (!s.spot) {
        // somewhere on the lawns, not too near you
        for (let k = 0; k < 20; k++) {
          const x = rnd(-35, 45);
          const z = rnd(-5, 45);
          if (!this.isLawn(x, z) || Math.hypot(x - cam.x, z - cam.z) < 15) continue;
          s.spot = new THREE.Vector3(x, this.ground(x, z), z);
          s.heading = rnd(0, 6.28);
          s.next = rnd(1, 3);
          s.flee = 0;
          break;
        }
        return;
      }
      const near = feet ? Math.hypot(feet.x - s.spot.x, feet.z - s.spot.z) : 99;
      if (!s.flee && near < 9) {
        s.flee = 0.001;
        s.heading = Math.atan2(s.spot.x - feet.x, s.spot.z - feet.z);
        this._call(pick(['magpie-1', 'magpie-2']), s.spot, { ref: 18, rolloff: 1, max: 250, gain: 0.8 });
      }
      if (s.flee) {
        s.flee += dt;
        s.spot.x += Math.sin(s.heading) * 9 * dt;
        s.spot.z += Math.cos(s.heading) * 9 * dt;
        s.spot.y += dt * (s.flee < 1.5 ? 3 : -2);
        if (s.flee > 3.5) s.spot = null; // (landed somewhere else, out of sight)
      } else {
        // walking, with a hop now and then, pecking
        s.next -= dt;
        if (s.next <= 0) {
          s.heading += rnd(-1, 1);
          s.walk = rnd(0.5, 1.5);
          s.next = rnd(1.5, 4);
        }
        if (s.walk > 0) {
          s.walk -= dt;
          const nx = s.spot.x + Math.sin(s.heading) * 0.6 * dt;
          const nz = s.spot.z + Math.cos(s.heading) * 0.6 * dt;
          if (this.isLawn(nx, nz)) {
            s.spot.x = nx;
            s.spot.z = nz;
          } else s.heading += Math.PI;
        }
        s.spot.y = this.ground(s.spot.x, s.spot.z);
      }
      m.holder.position.copy(s.spot);
      m.holder.rotation.set(!s.flee && !(s.walk > 0) && Math.sin(this.t * 3 + i) > 0.6 ? 0.45 : 0, s.heading, 0, 'YXZ');
    });
    this.nextMagpieCall -= dt;
    if (n && ok && this.nextMagpieCall <= 0) {
      const m = this.magpies[0].state?.spot;
      if (m) this._call(pick(['magpie-1', 'magpie-2']), m, { ref: 18, rolloff: 1, max: 250, gain: 0.6 });
      this.nextMagpieCall = rnd(40, 110);
    }
  }

  // --- rabbits at dawn and dusk ---

  _rabbits(dt, cam, day, sunDeg, hours, ok, feet) {
    if (!this.rabbits) return;
    const time = (hours < 12 ? sunDeg > -5 && sunDeg < 14 : sunDeg < 12 && sunDeg > -5) ? 1 : 0;
    const out = ok && season(day, 80, 262) && time && this._luck(day, 5, 0.8, 'rabbits');
    // their places: the edges of the side lawns, and the fields outside the gate
    const SPOTS = [
      [-30, 6],
      [-27, 26],
      [36, 8],
      [33, 30],
      [18, 46],
      [-6, 50],
      [26, 52],
    ];
    this.rabbits.forEach((rb, i) => {
      const s = (rb.state ??= { home: SPOTS[i % SPOTS.length], p: null });
      if (!out) {
        rb.holder.visible = false;
        s.p = null;
        return;
      }
      if (!s.p) {
        const [hx, hz] = s.home;
        const x = hx + rnd(-3, 3);
        const z = hz + rnd(-3, 3);
        s.p = new THREE.Vector3(x, this.ground(x, z), z);
        Object.assign(s, { heading: rnd(0, 6.28), next: rnd(1, 5), move: 0, flee: 0, gone: false });
        rb.mixer?.update(Math.random() * 2);
      }
      if (s.gone) {
        rb.holder.visible = false;
        return;
      }
      rb.holder.visible = true;
      const near = feet ? Math.hypot(feet.x - s.p.x, feet.z - s.p.z) : 99;
      if (!s.flee && near < 12) {
        s.flee = 0.001;
        s.heading = Math.atan2(s.p.x - feet.x, s.p.z - feet.z) + rnd(-0.4, 0.4);
      }
      let speed = 0;
      if (s.flee) {
        s.flee += dt;
        speed = 6.5;
        // (into the hedge or the long grass: gone)
        if (s.flee > 2.2) s.gone = true;
      } else {
        s.next -= dt;
        if (s.next <= 0) {
          s.heading += rnd(-1.5, 1.5);
          s.move = rnd(0.4, 1.2);
          s.next = rnd(2, 7);
        }
        if (s.move > 0) {
          s.move -= dt;
          speed = 1.4;
        }
        // (back towards its place if it strays)
        if (Math.hypot(s.p.x - s.home[0], s.p.z - s.home[1]) > 7) s.heading = Math.atan2(s.home[0] - s.p.x, s.home[1] - s.p.z);
      }
      s.p.x += Math.sin(s.heading) * speed * dt;
      s.p.z += Math.cos(s.heading) * speed * dt;
      s.p.y = this.ground(s.p.x, s.p.z) + (speed > 0 ? Math.abs(Math.sin(this.t * (speed > 3 ? 14 : 9))) * 0.08 : 0);
      rb.holder.position.copy(s.p);
      rb.holder.rotation.y = s.heading;
      play(rb, speed > 0 ? 'Bunny_walk' : 'Bunny_idle', 0.15, speed > 3 ? 2 : 1);
      rb.mixer?.update(dt);
    });
  }

  // --- the fox at night, and foxes calling in the fields ---

  _fox(dt, cam, day, dark, feet) {
    const f = this.fox;
    const s = (this.foxState ??= { on: false });
    const tonight = this._luck(day + 0.5, 6, 0.65, 'fox');
    if (!s.on) {
      f.holder.visible = false;
      this.nextFox -= dt;
      if (dark && tonight && this.nextFox <= 0) {
        // across the lawns, from one side to the other, in front of the house or behind it
        const front = Math.random() < 0.6;
        const z = front ? rnd(2, 18) : rnd(-50, -38);
        const west = Math.random() < 0.5;
        const from = new THREE.Vector3(west ? -36 : 44, 0, z);
        const to = new THREE.Vector3(west ? 44 : -36, 0, z + rnd(-6, 6));
        Object.assign(s, { on: true, p: from, to, heading: Math.atan2(to.x - from.x, to.z - from.z), stop: rnd(4, 10), pause: 0, flee: 0 });
        this.nextFox = rnd(120, 360);
      }
    } else {
      f.holder.visible = true;
      const near = feet ? Math.hypot(feet.x - s.p.x, feet.z - s.p.z) : 99;
      if (!s.flee && near < 14) {
        s.flee = 0.001;
        s.heading = Math.atan2(s.p.x - feet.x, s.p.z - feet.z);
      }
      let speed = 0;
      if (s.flee) {
        s.flee += dt;
        speed = 9;
        play(f, 'Gallop', 0.2);
        if (s.flee > 4) s.on = false;
      } else if (s.pause > 0) {
        // stopped, sniffing the ground
        s.pause -= dt;
        play(f, s.pause > 2 ? 'Eating' : 'Idle', 0.4);
      } else {
        s.stop -= dt;
        if (s.stop <= 0) {
          s.pause = rnd(3, 6);
          s.stop = rnd(6, 14);
        }
        speed = 1.6;
        play(f, 'Walk', 0.4);
        const want = Math.atan2(s.to.x - s.p.x, s.to.z - s.p.z);
        let turn = want - s.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        s.heading += THREE.MathUtils.clamp(turn, -dt, dt) + Math.sin(this.t * 0.7) * 0.15 * dt;
        if (Math.hypot(s.to.x - s.p.x, s.to.z - s.p.z) < 2) s.on = false;
      }
      s.p.x += Math.sin(s.heading) * speed * dt;
      s.p.z += Math.cos(s.heading) * speed * dt;
      s.p.y = this.ground(s.p.x, s.p.z);
      f.holder.position.copy(s.p);
      f.holder.rotation.y = s.heading;
      f.mixer.update(dt);
      if (!dark) s.on = false;
    }
    // calls from the fields: screams in the winter (their mating season), barks the rest of the year
    this.nextFoxCall -= dt;
    if (dark && this.nextFoxCall <= 0) {
      const winter = season(day, 335, 59);
      const a = rnd(0, 6.28);
      const d = rnd(90, 260);
      const at = new THREE.Vector3(cam.x + Math.cos(a) * d, 2, cam.z + Math.sin(a) * d);
      this._call(winter || Math.random() < 0.25 ? pick(['fox-scream-1', 'fox-scream-2']) : 'fox-bark', at, { ref: 60, rolloff: 0.7, max: 900, gain: 0.9 });
      this.nextFoxCall = rnd(90, 320);
    }
  }

  // --- the cat about the front of the house ---

  _cat(dt, cam, day, hours, ok, feet) {
    const c = this.cat;
    if (!c) return;
    const time = (hours > 7 && hours < 9.5) || (hours > 17 && hours < 22.5);
    const out = ok && time && this._luck(day, 7, 0.5, 'cat');
    const s = (this.catState ??= { p: null });
    c.holder.visible = out;
    if (!out) {
      s.p = null;
      return;
    }
    if (!s.p) {
      const x = rnd(-12, 24);
      s.p = new THREE.Vector3(x, this.ground(x, -8.2), -8.2);
      Object.assign(s, { dir: Math.random() < 0.5 ? 1 : -1, sit: rnd(2, 8), walking: false, mewed: false });
    }
    const near = feet ? Math.hypot(feet.x - s.p.x, feet.z - s.p.z) : 99;
    if (near < 3.5 && !s.mewed) {
      s.mewed = true;
      s.sit = rnd(3, 5);
      s.walking = false;
      this._call('cat', s.p.clone().setY(s.p.y + 0.3), { ref: 5, rolloff: 1.3, max: 60, gain: 0.8 });
    }
    if (near > 10) s.mewed = false;
    s.sit -= dt;
    if (s.sit <= 0) {
      s.walking = !s.walking;
      s.sit = s.walking ? rnd(4, 12) : rnd(5, 15);
      if (s.walking && Math.random() < 0.3) s.dir *= -1;
    }
    if (s.walking) {
      // along the front of the house, on the path below the windows
      s.p.x += s.dir * 0.75 * dt;
      if (s.p.x > 26 || s.p.x < -13) s.dir *= -1;
      s.p.y = this.ground(s.p.x, s.p.z);
    }
    c.holder.position.copy(s.p);
    c.holder.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    play(c, s.walking ? 'Walking' : 'Idle', 0.3);
    c.mixer.update(dt);
  }

  // --- mallards on the big pond ---

  _ducks(dt, day, ok) {
    // (some days on the fountain's basin, some on the water by the assault course)
    const pts = this.water[Math.floor(day) % Math.max(1, this.water.length)];
    if (!pts || !this.ducks.length) return;
    const out = ok && season(day, 60, 280) && this._luck(day, 8, 0.7, 'ducks');
    this.ducks.forEach((d, i) => {
      d.holder.visible = out;
      if (!out) return;
      const s = (d.state ??= {});
      if (s.pts !== pts) s.p = null; // (another day, another pond)
      if (!s.p) {
        s.p = pick(pts).clone();
        s.pts = pts;
        s.to = s.p.clone();
        s.heading = rnd(0, 6.28);
        s.dabble = 0;
      }
      // paddling slowly from one place on the water to the next near it, dabbling now and then, bobbing
      if (s.p.distanceTo(s.to) < 0.5) {
        const near = pts.filter((q) => q.distanceTo(s.p) < 9 && q.distanceTo(s.p) > 2);
        s.to.copy(near.length ? pick(near) : pick(pts));
      }
      const want = Math.atan2(s.to.x - s.p.x, s.to.z - s.p.z);
      let turn = want - s.heading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      s.heading += THREE.MathUtils.clamp(turn, -dt * 0.8, dt * 0.8);
      s.dabble -= dt;
      const moving = s.dabble < -3;
      if (s.dabble < -rnd(6, 14)) s.dabble = rnd(1.5, 3);
      const speed = s.dabble > 0 ? 0 : 0.35;
      s.p.x += Math.sin(s.heading) * speed * dt;
      s.p.z += Math.cos(s.heading) * speed * dt;
      d.holder.position.set(s.p.x, s.to.y - 0.11 + 0.012 * Math.sin(this.t * 2 + i), s.p.z);
      d.holder.rotation.set(s.dabble > 0 ? 0.5 : 0, s.heading, 0, 'YXZ');
      if (d.mixer) {
        play(d, s.dabble > 0 ? 'Peck' : 'Waddle', 0.3, moving ? 0.4 : 0.6);
        d.mixer.update(dt);
      }
    });
    this.nextQuack -= dt;
    if (out && this.nextQuack <= 0) {
      const d = pick(this.ducks).state?.p;
      if (d) this._call('mallard', d, { ref: 14, rolloff: 1, max: 250, gain: 0.8, rate: rnd(0.95, 1.05) });
      this.nextQuack = rnd(18, 60);
    }
  }
}
