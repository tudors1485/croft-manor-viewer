// Wildlife: deer grazing in the park at dawn, and bats over the house and the water at summer dusk.
//
// The deer are red deer, CDmir's stag and hind (CC0 1.0, from OpenGameArt: public/animals/). A
// herd of a dozen grazes in the field south-west of the gate from first light until a couple of
// hours after sunrise: heads down eating, looking round now and then, moving a few steps to fresh
// grass. Come within about twenty metres on foot and they lift their heads and bound away,
// settling again further off. They keep to their field, clear of every camera path; except that
// some mornings in May one hind wanders off to graze on the verge of the drive just outside the
// gate, where you can see her through the gateway.
//
// The hunt (the Deer at dawn sight): a shot from the woods, and the herd bolts away across the
// field and is gone; then the hounds come back, out of the field, through the gate and up the
// drive to the house: two wait at the front door, one drinks from the fountain, one noses about.
// A saddled horse stands at the door, waiting for its rider.
//
// The bats are drawn here (a body and two wings, flapping): a dozen from late May to early
// September, from just after sunset for about an hour, flitting fast and jinking round the front
// of the house, under the eaves and low over the fountain, black against the dusk.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const ss = THREE.MathUtils.smoothstep;
const HERD = { x: -18, z: 68, r: 14 }; // the field south-west of the gate, outside the walls
// the red deer's clips standing in for the ones the herd asks for (they have no walk: a slow run)
const CLIP = { Eating: ['Eat', 1], Idle_Headlow: ['LookAround', 1], Idle: ['Idle', 1], Gallop: ['Run', 1.05], Walk: ['Run', 0.4] };
const SHOT = new THREE.Vector3(-75, 3, 40); // where the gun is, in the woods west of the field
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Some mornings in May one doe wanders off from the herd to graze on the verge just outside the gate. */
export function wanders(day) {
  const d = Math.floor(day);
  return d >= 121 && d <= 151 && hash(d * 3.1 + 5) < 0.5;
}

/** The next May day she does (for the Sights menu). */
export function wanderDay() {
  for (let d = 121; d <= 151; d++) if (wanders(d)) return d;
  return 135;
}

export class Park {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {(x: number, z: number) => number} o.ground the ground's height
   * @param {THREE.Vector3[]} o.avoid points the camera paths pass low over (the deer keep clear)
   */
  constructor(scene, { ground, avoid = [], gate = null, fountain = null, door = null, sound = null }) {
    this.scene = scene;
    this.gate = gate;
    this.fountain = fountain; // (a box: the hounds drink at its rim)
    this.door = door ?? new THREE.Vector3(-1.85, 0, -8.5);
    this.sound = sound;
    this.huntDay = null; // the morning of the hunt (the Deer at dawn sight)
    this.huntT = 0;
    this.hounds = []; // (until they have loaded)
    this.horse = null;
    this.ground = ground;
    this.avoid = avoid.filter((p) => Math.hypot(p.x - HERD.x, p.z - HERD.z) < HERD.r + 30);
    this.deer = [];
    this.group = new THREE.Group();
    this.group.name = 'Deer';
    this.group.visible = false;
    scene.add(this.group);
    this._makeBats();
  }

  /** Loads the deer (the park works without them if they don't load). */
  async load(base = '') {
    const loader = new GLTFLoader();
    const [doe, stag, hound1, hound2, horse] = await Promise.all(['red-hind', 'red-stag', 'hound-1', 'hound-2', 'horse'].map((n) => loader.loadAsync(`${base}animals/${n}.glb`).catch(() => null)));
    if (!doe || !stag) throw new Error('no deer');
    const kinds = [doe, doe, stag, doe, doe, doe, doe, stag, doe, doe, doe, doe];
    kinds.forEach((g, i) => {
      const model = cloneSkinned(g.scene);
      // the models' size: a hind about 1.55 m to the tips of her ears, a stag 2.05 m to his antlers
      // (measured with the skeleton posed: a skinned mesh's quick bounds are far too big)
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model, true);
      const want = g === stag ? 2.05 : 1.55;
      model.scale.setScalar(want / Math.max(0.01, box.max.y - box.min.y));
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // (skinned: the bounds don't follow the animation)
        // (a little browner: their coats read pink in the low morning sun)
        if (!o.material.userData.browned) {
          o.material.color.multiply(new THREE.Color(0.82, 0.74, 0.68));
          o.material.userData.browned = true;
        }
      });
      const holder = new THREE.Group();
      holder.add(model);
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const clip of g.animations) actions[clip.name] = mixer.clipAction(clip);
      const d = { holder, mixer, actions, state: 'graze', timer: Math.random() * 6, heading: Math.random() * Math.PI * 2, target: null, current: null, speed: 0 };
      // a spot in the field, clear of the camera paths
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * HERD.r * 0.8;
        const x = HERD.x + Math.cos(a) * r;
        const z = HERD.z + Math.sin(a) * r;
        if (this._clear(x, z) && this.deer.every((o) => Math.hypot(o.holder.position.x - x, o.holder.position.z - z) > 2.5)) {
          holder.position.set(x, this.ground(x, z), z);
          break;
        }
      }
      if (holder.position.lengthSq() === 0) holder.position.set(HERD.x + i * 2, this.ground(HERD.x + i * 2, HERD.z), HERD.z);
      d.home = holder.position.clone();
      holder.rotation.y = d.heading;
      this._play(d, 'Eating', 0);
      d.mixer.update(Math.random() * 3); // (not all in step)
      this.deer.push(d);
    });
    // the hunt's hounds and the horse (the park works without them)
    this.hounds = [];
    this.huntGroup = new THREE.Group();
    this.huntGroup.name = 'The hunt';
    this.huntGroup.visible = false;
    this.scene.add(this.huntGroup);
    const rig = (g, length) => {
      const model = cloneSkinned(g.scene);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model, true);
      const ext = box.getSize(new THREE.Vector3());
      model.scale.setScalar(length / Math.max(ext.x, ext.z));
      model.position.y = -box.min.y * model.scale.y;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.frustumCulled = false;
      });
      const holder = new THREE.Group();
      holder.add(model);
      this.huntGroup.add(holder);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const clip of g.animations) actions[clip.name.replace(/^.*\|/, '')] = mixer.clipAction(clip);
      return { holder, model, mixer, actions, current: null };
    };
    if (hound1 && hound2) for (const g of [hound1, hound2, hound1, hound2]) this.hounds.push(rig(g, 1.05));
    if (horse) {
      this.horse = rig(horse, 2.5);
      this._saddle(this.horse);
    }
    if (this.huntDay !== null) this._placeHounds(); // (the sight was chosen before they had loaded)
  }

  /** A saddle on the horse's back (leather, a cloth under it, the stirrups hanging), on the bone nearest. */
  _saddle(h) {
    h.holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(h.model, true);
    // (the seat: the top of the back, a little behind the middle; the horse faces +z)
    const seat = new THREE.Vector3(0, box.max.y - (box.max.y - box.min.y) * 0.36, (box.min.z + box.max.z) / 2 - (box.max.z - box.min.z) * 0.04);
    let bone = null;
    let best = Infinity;
    const w = new THREE.Vector3();
    h.model.traverse((o) => {
      if (!o.isBone) return;
      o.getWorldPosition(w);
      const d = w.distanceTo(seat);
      if (d < best) {
        best = d;
        bone = o;
      }
    });
    // (the top of the back there: a ray down from above)
    const top = new THREE.Raycaster(new THREE.Vector3(seat.x, box.max.y + 1, seat.z), new THREE.Vector3(0, -1, 0)).intersectObject(h.model, true)[0];
    const y = top ? top.point.y : seat.y;
    const leather = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.55 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1d3527, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.35, metalness: 0.9 });
    const saddle = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.72), cloth);
    pad.position.y = 0.0;
    const seatMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.5, 0.17, 0.62), leather);
    seatMesh.position.y = 0.015;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6).scale(1.4, 0.8, 0.9), leather);
    pommel.position.set(0, 0.08, 0.24);
    saddle.add(pad, seatMesh, pommel);
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.03), leather);
      strap.position.set(side * 0.27, -0.2, 0.06);
      const stirrup = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 14), metal);
      stirrup.position.set(side * 0.28, -0.43, 0.06);
      saddle.add(strap, stirrup);
    }
    saddle.traverse((o) => o.isMesh && (o.castShadow = true));
    saddle.position.set(seat.x, y - 0.005, seat.z);
    h.holder.add(saddle);
    if (bone) bone.attach(saddle); // (it moves with the horse's back)
  }

  /** The hunt, this morning (the Deer at dawn sight): the shot in a few seconds. */
  hunt(day) {
    this.huntDay = Math.floor(day);
    this.huntT = 0;
    this.shot = false;
    this.houndsOut = false;
    // the herd back in its field, grazing, and the hounds and the horse where they start
    for (const d of this.deer) {
      d.holder.position.copy(d.home);
      d.holder.visible = true;
      d.state = 'graze';
      d.target = null;
      d.gone = false;
      d.timer = Math.random() * 4;
    }
    this._placeHounds();
  }

  /** The hounds where they start, out in the field (again when they load after the hunt began). */
  _placeHounds() {
    this.hounds.forEach((h, i) => {
      h.p = new THREE.Vector3(-36 - i * 1.4, 0, 86 + i * 2);
      h.p.y = this.ground(h.p.x, h.p.z);
      h.route = this._houndRoute(i);
      h.arrived = false;
      h.holder.visible = false;
    });
  }

  /** The way home for hound `i`: out of the field, through the gate, up the drive and round the fountain, to the door. */
  _houndRoute(i) {
    const g = this.gate ?? { x: 4.6, z: 20.7 };
    const door = this.door;
    const jitter = (x, z) => new THREE.Vector3(x + (Math.random() - 0.5) * 1.2, 0, z + (Math.random() - 0.5) * 1.2);
    const route = [jitter(-30, 80), jitter(-8, 52), jitter(g.x - 0.4, g.z + 9), new THREE.Vector3(g.x + (i % 2 ? 0.5 : -0.5), 0, g.z + 1), jitter(g.x + 4.2, g.z - 8), jitter(g.x + 5, g.z - 16), jitter(g.x + 2, g.z - 24)];
    // where each ends: two at the door, one at the fountain's rim (drinking), one nosing about
    const f = this.fountain;
    if (i === 2 && f) {
      const c = f.getCenter(new THREE.Vector3());
      route.push(new THREE.Vector3(c.x + 0.6, 0, f.min.z - 0.45));
      this.drinkAt = new THREE.Vector3(c.x + 0.6, 0, f.min.z);
    } else if (i === 3) route.push(new THREE.Vector3(door.x + 3.4, 0, door.z + 2.6));
    else route.push(new THREE.Vector3(door.x + (i === 0 ? -0.75 : 0.85), 0, door.z + 1.0));
    return route;
  }

  /** Where the camera should look while the hunt plays (the herd, then the hounds). */
  get huntFocus() {
    const out = this.hounds.filter((h) => h.route);
    if (this.houndsOut && out.length) {
      const lead = out.reduce((a, h) => (h.route.length < a.route.length ? h : a), out[0]);
      return lead.p.clone().setY(lead.p.y + 0.5);
    }
    const c = new THREE.Vector3();
    let n = 0;
    for (const d of this.deer) {
      if (d.gone) continue;
      c.add(d.holder.position);
      n++;
    }
    return n ? c.divideScalar(n).setY(c.y + 0.8) : new THREE.Vector3(HERD.x, 1, HERD.z);
  }

  /** In the field and at least 14 m from where a camera path passes low. */
  _clear(x, z) {
    if (Math.hypot(x - HERD.x, z - HERD.z) > HERD.r) return false;
    return this.avoid.every((p) => Math.hypot(p.x - x, p.z - z) > 14);
  }

  _play(d, name, fade = 0.5) {
    // (the red deer's own clips stand in for the herd's names; the walk is their run, slowed)
    const [clip, rate] = Object.hasOwn(CLIP, name) ? CLIP[name] : [name, 1];
    const next = d.actions[clip];
    if (!next) return;
    next.timeScale = rate;
    if (d.current === next) return;
    next.reset().setEffectiveWeight(1).play();
    if (d.current) d.current.crossFadeTo(next, fade, false);
    d.current = next;
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.sunDeg the sun's height in degrees
   * @param {number} o.hours the clock
   * @param {number} o.day day of the year
   * @param {THREE.Camera} o.camera
   * @param {boolean} o.onFoot walking (the deer only take fright at someone on foot nearby)
   */
  update(dt, { sunDeg, hours, day, camera, onFoot }) {
    // dawn: from first light until the sun is about 20° up (or 10 o'clock), in the morning
    const dawn = hours < 12 && sunDeg > -7 && sunDeg < 20 && hours < 10.5;
    this.group.visible = dawn && this.deer.length > 0;
    // a May morning: once it is light, she sets off for the gate
    const w = this.deer[0];
    if (w && this.gate && wanders(day) && dawn && sunDeg > -2 && !w.wandered && w.state === 'graze') {
      w.wandered = true;
      w.target = new THREE.Vector2(this.gate.x + 2.4, this.gate.z + 8);
      w.state = 'walk';
      w.timer = 120;
      // (arriving later in the morning than she sets off, at first light: she is there already)
      if (sunDeg > 4) {
        w.holder.position.set(w.target.x, this.ground(w.target.x, w.target.y), w.target.y);
        w.state = 'graze';
        w.target = null;
      }
    }
    if (w && !dawn) w.wandered = false;
    if (this.group.visible) this._updateDeer(dt, camera, onFoot);
    this._updateHunt(dt, day, hours, camera);
    // bats: late May to early September, from just after sunset for about an hour
    const summer = day > 140 && day < 250;
    const dusk = hours > 12 && sunDeg < -0.5 && sunDeg > -11;
    this.bats.visible = summer && dusk;
    if (this.bats.visible) this._updateBats(dt, camera);
  }

  _updateHunt(dt, day, hours, camera) {
    const on = this.huntDay !== null && Math.floor(day) === this.huntDay && hours > 5 && hours < 11.5;
    if (this.huntGroup) this.huntGroup.visible = on;
    if (!on) return;
    this.huntT += dt;
    // the shot, from the woods; the herd bolts
    if (!this.shot && this.huntT > 9) {
      this.shot = true;
      this.sound?.sample('gunshot', SHOT, { ref: 120, rolloff: 0.6, max: 3000, gain: 1, delay: SHOT.distanceTo(camera.position) / 343 });
      for (const d of this.deer) {
        d.state = 'bolt';
        d.timer = 0.15 + Math.random() * 0.4; // (heads up for a moment, then away)
        const a = Math.atan2(d.holder.position.x - SHOT.x, d.holder.position.z - SHOT.z) + (Math.random() - 0.5) * 0.5;
        d.target = new THREE.Vector2(d.holder.position.x + Math.sin(a) * 90, d.holder.position.z + Math.cos(a) * 90);
      }
    }
    // the hounds, out of the field and home
    if (!this.houndsOut && this.huntT > 11) {
      this.houndsOut = true;
      this.sound?.sample('hounds', new THREE.Vector3(-40, 1, 88), { ref: 40, rolloff: 0.8, max: 900, gain: 0.9, lowpass: 2500 });
      this.barkIn = 4;
    }
    const h0 = this.hounds[0];
    for (const [i, h] of this.hounds.entries()) {
      h.holder.visible = this.houndsOut && !!h.route;
      if (!this.houndsOut || !h.route) continue;
      if (!h.arrived) {
        const to = h.route[0];
        const dx = to.x - h.p.x;
        const dz = to.z - h.p.z;
        const dist = Math.hypot(dx, dz);
        const speed = h.route.length > 2 ? 7 + i * 0.3 : 2.4; // (a trot for the last of it)
        if (dist < 0.4) {
          h.route.shift();
          if (!h.route.length) h.arrived = true;
        } else {
          const step = Math.min(dist, speed * dt);
          h.p.x += (dx / dist) * step;
          h.p.z += (dz / dist) * step;
          h.heading = Math.atan2(dx, dz);
        }
        h.p.y = this.ground(h.p.x, h.p.z);
        this._playH(h, h.route.length > 2 ? 'Gallop' : 'Walk', h.route.length > 2 ? 1 : 1.2);
      } else {
        // at the door: waiting, heads turning, panting; at the fountain: drinking; the other nosing the gravel
        if (i === 2 && this.drinkAt) {
          h.heading = Math.atan2(this.drinkAt.x - h.p.x, this.drinkAt.z - h.p.z);
          this._playH(h, 'Eating', 1);
        } else if (i === 3) this._playH(h, Math.sin(this.huntT * 0.4) > 0 ? 'Eating' : 'Idle', 1);
        else {
          h.heading = Math.atan2(0, 1) + (i === 0 ? 0.25 : -0.3) + 0.25 * Math.sin(this.huntT * 0.3 + i);
          this._playH(h, Math.sin(this.huntT * 0.21 + i * 2) > 0.6 ? 'Idle_2_HeadLow' : 'Idle', 1);
        }
        if (!this.panted && h === h0) {
          this.panted = true;
          this.sound?.sample('panting', h.p.clone().setY(0.5), { ref: 4, rolloff: 1.2, max: 40, gain: 0.7 });
        }
      }
      h.holder.position.copy(h.p);
      h.holder.rotation.y = h.heading ?? 0;
      h.mixer.update(dt);
    }
    // a bark now and then as they come up the drive
    if (this.houndsOut && h0?.route && !h0.arrived) {
      this.barkIn -= dt;
      if (this.barkIn <= 0) {
        this.barkIn = 2.5 + Math.random() * 3;
        const b = this.hounds[Math.floor(Math.random() * this.hounds.length)];
        this.sound?.sample('hound-bark', b.p.clone().setY(0.6), { ref: 12, rolloff: 1, max: 300, gain: 0.8, rate: 0.9 + Math.random() * 0.2 });
      }
    }
    // the horse at the door, waiting: shifting its weight, head down now and then, a snort
    const hr = this.horse;
    if (hr) {
      const at = this.door.clone().add(new THREE.Vector3(3.6, 0, 1.6));
      hr.holder.position.set(at.x, this.ground(at.x, at.z), at.z);
      hr.holder.rotation.y = -Math.PI / 2 + 0.25;
      const phase = Math.sin(this.huntT * 0.13);
      this._playH(hr, phase > 0.55 ? 'Idle_Headlow' : phase < -0.7 ? 'Idle_2' : 'Idle', 1);
      hr.mixer.update(dt);
      this.snortIn = (this.snortIn ?? 6) - dt;
      if (this.snortIn <= 0) {
        this.snortIn = 9 + Math.random() * 14;
        this.sound?.sample(Math.random() < 0.2 ? 'horse-neigh' : 'horse-snort', hr.holder.position.clone().setY(1.6), { ref: 8, rolloff: 1.1, max: 200, gain: 0.8 });
      }
    }
  }

  _playH(a, name, rate = 1) {
    const next = a.actions[name];
    if (!next) return;
    next.timeScale = rate;
    if (a.current === next) return;
    next.reset().setEffectiveWeight(1).play();
    if (a.current) a.current.crossFadeTo(next, 0.3, false);
    a.current = next;
  }

  _updateDeer(dt, camera, onFoot) {
    const cam = camera.position;
    for (const d of this.deer) {
      const p = d.holder.position;
      if (d.gone) continue;
      if (d.state === 'bolt') {
        // the shot: heads up, then away at a full gallop, out of the field and gone
        d.timer -= dt;
        if (d.timer > 0) this._play(d, 'Idle', 0.15);
        else {
          this._play(d, 'Gallop', 0.2);
          const want = Math.atan2(d.target.x - p.x, d.target.y - p.z);
          let turn = want - d.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          d.heading += THREE.MathUtils.clamp(turn, -dt * 5, dt * 5);
          d.speed += (9 - d.speed) * (1 - Math.exp(-dt * 4));
          p.x += Math.sin(d.heading) * d.speed * dt;
          p.z += Math.cos(d.heading) * d.speed * dt;
          p.y = this.ground(p.x, p.z);
          d.holder.rotation.y = d.heading;
          if (Math.hypot(d.target.x - p.x, d.target.y - p.z) < 2) {
            d.gone = true;
            d.holder.visible = false;
          }
        }
        d.mixer.update(dt);
        continue;
      }
      const near = Math.hypot(cam.x - p.x, cam.z - p.z);
      d.timer -= dt;
      // someone on foot close by: heads up, then away at a gallop
      if (onFoot && near < 20 && d.state !== 'flee' && d.state !== 'alert') {
        d.state = 'alert';
        d.timer = 0.5 + Math.random() * 0.6; // (a moment with the head up, then off)
      }
      if (d.state === 'alert') {
        this._play(d, 'Idle', 0.3);
        if (d.timer <= 0) {
          // away from you, within the field
          const away = Math.atan2(p.x - cam.x, p.z - cam.z);
          const a = away + (Math.random() - 0.5) * 0.8;
          const r = 9 + Math.random() * 6;
          let tx = p.x + Math.sin(a) * r;
          let tz = p.z + Math.cos(a) * r;
          if (!this._clear(tx, tz)) {
            // (the field's edge or a camera path that way: across the field instead)
            tx = HERD.x + Math.sin(a) * HERD.r * 0.5;
            tz = HERD.z + Math.cos(a) * HERD.r * 0.5;
          }
          d.target = new THREE.Vector2(tx, tz);
          d.state = 'flee';
          d.timer = 8;
        }
      } else if (d.state === 'graze') {
        this._play(d, d.look ? 'Idle_Headlow' : 'Eating', 0.6);
        if (d.timer <= 0) {
          const r = Math.random();
          if (r < 0.25) {
            d.look = !d.look; // look up for a moment, or back to eating
            d.timer = d.look ? 2 + Math.random() * 3 : 5 + Math.random() * 8;
          } else if (r < 0.55) {
            // a few steps to fresh grass
            for (let k = 0; k < 10; k++) {
              const a = Math.random() * Math.PI * 2;
              const tx = p.x + Math.sin(a) * (2 + Math.random() * 4);
              const tz = p.z + Math.cos(a) * (2 + Math.random() * 4);
              if (this._clear(tx, tz)) {
                d.target = new THREE.Vector2(tx, tz);
                d.state = 'walk';
                d.timer = 12;
                break;
              }
            }
            if (d.state !== 'walk') d.timer = 4;
          } else d.timer = 5 + Math.random() * 8;
        }
      }
      if ((d.state === 'walk' || d.state === 'flee') && d.target) {
        const fleeing = d.state === 'flee';
        this._play(d, fleeing ? 'Gallop' : 'Walk', 0.35);
        const dx = d.target.x - p.x;
        const dz = d.target.y - p.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let turn = want - d.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        d.heading += THREE.MathUtils.clamp(turn, -dt * (fleeing ? 4 : 1.6), dt * (fleeing ? 4 : 1.6));
        const speed = fleeing ? 7.5 : 0.9;
        d.speed += (speed - d.speed) * (1 - Math.exp(-dt * 3));
        p.x += Math.sin(d.heading) * d.speed * dt;
        p.z += Math.cos(d.heading) * d.speed * dt;
        p.y = this.ground(p.x, p.z);
        d.holder.rotation.y = d.heading;
        if (dist < 0.6 || d.timer <= 0) {
          d.state = fleeing && Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 20 ? 'alert' : 'graze';
          d.target = null;
          d.speed = 0;
          d.look = fleeing;
          d.timer = fleeing ? 0.4 : 3 + Math.random() * 6;
        }
      }
      d.mixer.update(dt);
    }
  }

  // --- bats ---

  _makeBats() {
    const N = 12;
    this.batList = [];
    // a body (a small spindle) and a wing (a thin, scalloped triangle fan), black against the dusk
    const body = new THREE.SphereGeometry(0.035, 6, 4).scale(1, 0.8, 1.9);
    const wing = new THREE.BufferGeometry();
    // the wing's outline from the shoulder out to the tip and back, a scalloped trailing edge
    const pts = [
      [0, 0, 0.03],
      [0.06, 0.005, 0.05],
      [0.16, 0.01, 0.03],
      [0.2, 0, -0.02],
      [0.15, 0, -0.035],
      [0.11, 0, -0.06],
      [0.06, 0, -0.04],
      [0, 0, -0.05],
    ];
    const pos = [];
    for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
    wing.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wing.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x0b0908, side: THREE.DoubleSide, fog: true });
    this.bodies = new THREE.InstancedMesh(body, mat, N);
    this.wingsL = new THREE.InstancedMesh(wing, mat, N);
    this.wingsR = new THREE.InstancedMesh(wing.clone().scale(-1, 1, 1), mat, N);
    this.bats = new THREE.Group();
    this.bats.name = 'Bats';
    this.bats.visible = false;
    for (const m of [this.bodies, this.wingsL, this.wingsR]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.bats.add(m);
    }
    this.scene.add(this.bats);
    // where they hunt: along the front of the house under the eaves, over the lawn and the fountain
    const haunts = [
      [-1.85, 6, -5, 9],
      [4.6, 3.5, 8.4, 6],
      [16, 7, -6, 10],
      [-10, 7, -5, 8],
      [6, 9, 4, 12],
    ];
    for (let i = 0; i < N; i++) {
      const [x, y, z, r] = haunts[i % haunts.length];
      this.batList.push({
        home: new THREE.Vector3(x, y, z),
        r,
        p: new THREE.Vector3(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * r),
        v: new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6),
        jink: Math.random(),
        flap: Math.random() * 10,
        rate: 11 + Math.random() * 5,
      });
    }
    this._m = new THREE.Matrix4();
    this._w = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1.4, 1.4, 1.4); // (a serotine's size, 35 cm across)
    this._d = new THREE.Vector3();
  }

  _updateBats(dt, camera) {
    const t = (this._bt = (this._bt ?? 0) + dt);
    this.batList.forEach((b, i) => {
      // a sudden jink every so often (after a moth), and a pull back towards its haunt
      b.jink -= dt;
      if (b.jink <= 0) {
        b.v.add(this._d.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 10));
        b.jink = 0.2 + Math.random() * 0.7;
      }
      this._d.copy(b.home).sub(b.p);
      b.v.addScaledVector(this._d, dt * (this._d.length() > b.r ? 2.2 : 0.4));
      // keep clear of the camera, and of the ground
      this._d.copy(b.p).sub(camera.position);
      if (this._d.length() < 2.5) b.v.addScaledVector(this._d.normalize(), dt * 30);
      if (b.p.y < 1.5) b.v.y += dt * 12;
      const speed = b.v.length();
      if (speed > 8) b.v.multiplyScalar(8 / speed);
      if (speed < 4) b.v.multiplyScalar(4 / Math.max(speed, 0.01));
      b.p.addScaledVector(b.v, dt);
      // facing the way it flies, banking into turns
      const heading = Math.atan2(b.v.x, b.v.z);
      this._e.set(-Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)), heading, Math.sin(t * 3 + i) * 0.4, 'YXZ');
      this._q.setFromEuler(this._e);
      this._m.compose(b.p, this._q, this._s);
      this.bodies.setMatrixAt(i, this._m);
      // the wings beat about the body's long axis
      b.flap += dt * b.rate;
      const beat = Math.sin(b.flap) * 0.9;
      this._w.makeRotationZ(beat);
      this.wingsL.setMatrixAt(i, this._w.clone().premultiply(this._m));
      this._w.makeRotationZ(-beat);
      this.wingsR.setMatrixAt(i, this._w.clone().premultiply(this._m));
    });
    for (const m of [this.bodies, this.wingsL, this.wingsR]) m.instanceMatrix.needsUpdate = true;
  }
}
