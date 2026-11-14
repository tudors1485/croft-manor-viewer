// The building site at work (The house going up, building.js), quietly (no hammering, no saws: the
// scene is better without the din):
// - a hodman, his hod on his shoulder, filling it at the stacks of brick by the east wing, carrying
//   it to the ladder, up to the first lift, tipping it out on the boards and coming down again;
// - a mason at his banker by the porch, dressing a block with mallet and chisel;
// - a carter bringing a load of stone: a horse and a two-wheeled cart up the drive from the gate,
//   round to the stone pile, where it stands a while (the carter at the horse's head), then away
//   round the far side of the fountain and out at the gate, and in again a while later.
// The men are Quaternius's Worker in the clothes of the 1780s (people.js); the horse is the park's.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Person, Route } from './people.js';
import { animal, play } from './wildlife.js';

const _v = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Turn `from` towards `to` (radians), at most `rate` per second. */
function turnTo(from, to, rate, dt) {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
}

export class SiteLife {
  /** @param {import('./building.js').Building} site */
  constructor(site) {
    this.site = site;
    this.group = new THREE.Group();
    this.group.name = 'At work';
    site.group.add(this.group);
    this.loading = false;
    this.ready = false;
  }

  ground(x, z) {
    return this.site.ground(x, z);
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    Promise.all([Person.make('hodman'), Person.make('mason'), Person.make('carter'), new GLTFLoader().loadAsync('animals/horse.glb').catch(() => null)])
      .then(([hodman, mason, carter, horse]) => {
        for (const p of [hodman, mason, carter]) this.group.add(p.root, p.loose);
        this._hodman(hodman);
        this._mason(mason);
        if (horse) this._cart(horse, carter);
        else carter.root.visible = false;
        this.ready = true;
      })
      .catch((err) => console.warn('the builder\'s men did not come:', err.message));
  }

  // --- the hodman ---------------------------------------------------------------------------------

  _hodman(p) {
    // the ladder nearest the bricks
    const stack = new THREE.Vector3(14.8, 0, -3.95);
    const ladder = [...this.site.ladders].sort((a, b) => a.foot.distanceTo(stack) - b.foot.distanceTo(stack))[0];
    if (!ladder) {
      p.root.visible = false;
      return;
    }
    const facing = Math.atan2(-ladder.nrm.x, -ladder.nrm.z); // (at the wall)
    // stood on the ladder: in front of its rungs (the side away from the wall)
    const onLadder = (t) => ladder.foot.clone().lerp(ladder.top, t).addScaledVector(ladder.nrm, 0.32);
    const climbTop = (ladder.boardY - ladder.foot.y) / (ladder.top.y - ladder.foot.y); // (where his feet are level with the boards)
    const atFoot = ladder.foot.clone().addScaledVector(ladder.nrm, 0.7);
    atFoot.y = this.ground(atFoot.x, atFoot.z);
    const load = stack.clone().setY(this.ground(stack.x, stack.z));
    this.hod = { p, ladder, facing, onLadder, climbTop, atFoot, load, state: 'fill', t: 0, pos: load.clone(), yaw: Math.PI, climb: 0 };
    p.full = false;
  }

  _updateHodman(dt) {
    const h = this.hod;
    if (!h) return;
    const p = h.p;
    h.t += dt;
    let moving = 0;
    const walkTo = (target, speed = 1.05) => {
      const d = _v.copy(target).sub(h.pos).setY(0);
      const len = d.length();
      if (len < 0.08) return true;
      h.yaw = turnTo(h.yaw, Math.atan2(d.x, d.z), 4, dt);
      h.pos.addScaledVector(d.normalize(), Math.min(len, speed * dt));
      h.pos.y = this.ground(h.pos.x, h.pos.z);
      moving = speed;
      return false;
    };
    let clip = 'idle';
    switch (h.state) {
      case 'fill': // at the stack, loading the hod
        h.yaw = turnTo(h.yaw, Math.PI, 3, dt);
        clip = h.t < 2.6 ? 'interact' : 'idle';
        p.setPose(h.t < 2.6 ? 'none' : 'hod');
        if (h.t > 1.4) p.full = true;
        if (h.t > 3.2) Object.assign(h, { state: 'carry', t: 0 });
        break;
      case 'carry':
        p.setPose('hod');
        if (walkTo(h.atFoot)) Object.assign(h, { state: 'up', t: 0, climb: 0 });
        break;
      case 'up': // up the ladder, a rung at a time
        p.setPose('climb');
        h.climb = Math.min(h.climbTop, h.climb + dt * 0.16 * (0.6 + 0.4 * Math.abs(Math.sin(h.t * 3.2))));
        h.pos.copy(h.onLadder(h.climb));
        h.yaw = turnTo(h.yaw, h.facing, 5, dt);
        moving = 0.45;
        if (h.climb >= h.climbTop) Object.assign(h, { state: 'tip', t: 0 });
        break;
      case 'tip': // off onto the boards, the bricks tipped out by the wall, back to the ladder
        h.pos.lerp(h.ladder.board, Math.min(1, dt * 2));
        h.yaw = turnTo(h.yaw, h.facing, 4, dt);
        clip = h.t > 0.8 && h.t < 2.6 ? 'interact' : 'idle';
        p.setPose(h.t > 0.8 && h.t < 2.6 ? 'none' : 'hod');
        if (h.t > 1.8) p.full = false;
        if (h.t > 3.4) Object.assign(h, { state: 'down', t: 0 });
        break;
      case 'down':
        p.setPose('climb');
        h.climb = Math.max(0, h.climb - dt * 0.2);
        h.pos.lerp(h.onLadder(h.climb), Math.min(1, dt * 6));
        h.yaw = turnTo(h.yaw, h.facing, 5, dt);
        moving = 0.45;
        if (h.climb <= 0) Object.assign(h, { state: 'back', t: 0 });
        break;
      case 'back':
        p.setPose('hod');
        if (walkTo(h.load)) Object.assign(h, { state: 'fill', t: 0 });
        break;
    }
    p.play(moving ? 'walk' : clip);
    p.root.position.copy(h.pos);
    p.root.rotation.y = h.yaw;
    p.update(dt, moving);
  }

  // --- the mason ----------------------------------------------------------------------------------------

  _mason(p) {
    const b = this.site.bankers[0];
    if (!b) {
      p.root.visible = false;
      return;
    }
    const at = new THREE.Vector3(b.x, 0, b.z + 0.62);
    at.y = this.ground(at.x, at.z);
    p.root.position.copy(at);
    p.root.rotation.y = Math.PI; // (at the banker, its block in front of him)
    p.play('interact', 0);
    this.mason = { p, t: Math.random() * 10 };
  }

  _updateMason(dt) {
    const m = this.mason;
    if (!m) return;
    m.t += dt;
    // working steadily, a rest now and then to look at the block
    const resting = m.t % 22 > 17;
    m.p.play(resting ? 'idle' : 'interact');
    if (m.p.actions.interact) m.p.actions.interact.timeScale = 0.75;
    m.p.update(dt, 0);
  }

  // --- the carter, his horse and cart -----------------------------------------------------------------

  _cart(gltf, carter) {
    const horse = animal(gltf, 2.5, { axis: 'xz' });
    this.group.add(horse.holder);
    // the cart: a bed on two wheels, the shafts out in front to the horse, dressed stone on it
    const site = this.site;
    const cart = new THREE.Group();
    const local = [];
    site.beam(new THREE.Vector3(-1.1, 0.9, 0), new THREE.Vector3(1.1, 0.9, 0), 1.3, 0.08, local);
    for (const s of [-1, 1]) site.beam(new THREE.Vector3(-1.1, 1.08, s * 0.64), new THREE.Vector3(1.1, 1.08, s * 0.64), 0.04, 0.28, local);
    for (const s of [-1, 1]) site.beam(new THREE.Vector3(0.7, 0.9, s * 0.42), new THREE.Vector3(2.9, 1.05, s * 0.38), 0.08, 0.1, local);
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), site.mats.sawn, local.length);
    local.forEach((mm, i) => m.setMatrixAt(i, mm));
    m.castShadow = m.receiveShadow = true;
    cart.add(m);
    const wheels = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 6, 28), site.mats.sawn), new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.02, 4, 28), site.mats.iron));
      for (let k = 0; k < 12; k++) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 5), site.mats.sawn);
        const a = (k / 12) * Math.PI * 2;
        sp.position.set(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0);
        sp.rotation.z = a - Math.PI / 2;
        w.add(sp);
      }
      w.position.set(0, 0.7, s * 0.78);
      cart.add(w);
      wheels.push(w);
    }
    for (const [x, z, w, h] of [
      [-0.5, -0.3, 0.6, 0.38],
      [0.25, -0.3, 0.7, 0.34],
      [-0.4, 0.3, 0.75, 0.36],
      [0.35, 0.28, 0.6, 0.4],
      [0, 0, 0.55, 0.3],
    ]) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), site.mats.stone);
      blk.position.set(x, 0.96 + h / 2 + (x === 0 ? 0.36 : 0), z);
      blk.rotation.y = (x * 7) % 0.2;
      cart.add(blk);
    }
    cart.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    this.group.add(cart);
    // up the drive west of the fountain to the stone pile; away round its east side and out
    const route = new Route([
      { x: 4.6, z: 38, stop: { secs: 40 }, away: true },
      { x: 4.6, z: 19.2 },
      { x: 4.4, z: 14.6 },
      { x: 0.2, z: 12.6 },
      { x: -1.8, z: 7.8 },
      { x: -3.0, z: 3.6, stop: { secs: 32 } },
      { x: 0.2, z: 1.0 },
      { x: 5.0, z: 2.2 },
      { x: 8.7, z: 5.6 },
      { x: 9.0, z: 10.0 },
      { x: 6.6, z: 13.8 },
      { x: 4.8, z: 16.2 },
      { x: 4.6, z: 19.2 },
    ]);
    this.cart = { horse, cart, wheels, carter, route, s: 6, wait: 0, speed: 1.35, yaw: 0, cartYaw: 0, roll: 0, snort: 8 };
  }

  _updateCart(dt) {
    const c = this.cart;
    if (!c) return;
    const r = c.route;
    let v = 0;
    if (c.wait > 0) {
      c.wait -= dt;
      if (c.wait <= 0) c.s += 0.01;
    } else {
      v = c.speed;
      let step = v * dt;
      const next = r.nextStop(c.s);
      if (next) {
        const ahead = next.s - r.wrap(c.s);
        const lap = ahead < -1e-6 ? ahead + r.length : ahead;
        if (lap <= step) {
          step = Math.max(0, lap);
          c.wait = next.point.stop.secs;
          c.at = next.point;
        }
      }
      c.s += step;
    }
    const away = c.wait > 0 && c.at?.away;
    // the horse on the route; the cart's axle 2.9 m behind on it, the cart pointing at the hitch
    const a = r.at(c.s);
    const hx = a.x;
    const hz = a.z;
    c.yaw = turnTo(c.yaw, Math.atan2(a.dir.x, a.dir.y), 3, dt);
    c.horse.holder.position.set(hx, this.ground(hx, hz), hz);
    c.horse.holder.rotation.y = c.yaw;
    const axle = r.at(c.s - 2.9);
    const hitch = _v.set(hx - Math.sin(c.yaw) * 0.6, 0, hz - Math.cos(c.yaw) * 0.6);
    const cy = Math.atan2(hitch.x - axle.x, hitch.z - axle.z);
    c.cart.position.set(axle.x, this.ground(axle.x, axle.z), axle.z);
    c.cart.rotation.y = cy - Math.PI / 2; // (its shafts along its +x)
    c.roll += (v * dt) / 0.7;
    for (const w of c.wheels) w.rotation.z = -c.roll;
    c.horse.holder.visible = c.cart.visible = !away;
    play(c.horse, v > 0 ? 'Walk' : c.wait % 9 < 5 ? 'Eating' : 'Idle', 0.4, 0.9);
    c.horse.mixer?.update(dt);
    // the carter at the horse's head, on its left
    const p = c.carter;
    p.root.visible = !away;
    const left = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    const at = new THREE.Vector3(hx, 0, hz).addScaledVector(left, 0.85).add(new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)).multiplyScalar(0.7));
    at.y = this.ground(at.x, at.z);
    p.root.position.copy(at);
    p.root.rotation.y = v > 0 ? c.yaw : c.yaw - 1.2; // (stood, half turned to the horse)
    p.play(v > 0 ? 'walk' : 'idle');
    p.update(dt, v);
    // a snort now and then when it stands
    c.snort -= dt;
    if (c.snort <= 0 && !away) {
      if (v === 0) this.site.sound?.sample?.(Math.random() < 0.2 ? 'horse-neigh' : 'horse-snort', c.horse.holder.position.clone().setY(1.6), { ref: 8, rolloff: 1.1, max: 200, gain: 0.6 });
      c.snort = 12 + Math.random() * 18;
    }
  }

  update(dt) {
    if (!this.ready) return;
    dt = Math.min(dt, 0.1);
    this._updateHodman(dt);
    this._updateMason(dt);
    this._updateCart(dt);
  }
}
