// Halloween night: more old graveyards about the estate, and now and then the dead climb out.
//
// - Three small graveyards, each different: the family plot in the grounds behind the house (a low
//   stone wall round it), one in the field just outside the front wall (iron railings, leaning),
//   one further off beyond the gate (a broken picket fence). Crooked headstones, crosses, a tomb chest, an obelisk; candles on some graves and
//   a lantern on a post; mist lying low among the stones.
// - When you are near one and looking at it, every so often the earth on a fresh grave stirs and a
//   zombie claws its way up out of it, groaning, staggers towards you for a while, then falls and
//   sinks back into the ground. Never more than two at once.
// Only on Halloween night (spooky.js's isOn); the zombies (Quaternius's, already used at the pool's
// party) are loaded the first time a graveyard is near.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bulbs } from './festive.js';
import { headstone, stoneTexture } from './lure.js';

// where they may go, the first that are clear (open ground, no trees, walls or drive), in order
const CANDIDATES = [
  { x: -28, z: -70, fence: 'wall' }, // the family plot, in the grounds behind the house
  { x: -30, z: -45, fence: 'wall' },
  { x: 40, z: 30, fence: 'railings' }, // the field just outside the front wall, east of the gate
  { x: 32, z: 70, fence: 'railings' },
  { x: -30, z: 100, fence: 'pickets' }, // further off, beyond the gate
  { x: 46, z: 108, fence: 'pickets' },
  { x: 60, z: 60, fence: 'pickets' },
];
const NEAR = 32; // the dead rise only when you are this close to a graveyard (and looking)
const R2 = (n) => (Math.random() - 0.5) * n;

function mistTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 30; i++) {
    const x = 64 + R2(70);
    const y = 64 + R2(40);
    const r = 18 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Graveyards {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {(x: number, z: number) => number} o.ground the ground's height
   * @param {(x: number, z: number, r: number) => boolean} o.clear whether the ground is open there
   * @param {{ sample: Function, has?: Function }} [o.sound]
   */
  constructor(scene, { ground, clear, sound = null }) {
    this.ground = ground;
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Graveyards';
    this.group.visible = false;
    scene.add(this.group);
    this.yards = [];
    const fences = new Set();
    for (const c of CANDIDATES) {
      if (this.yards.length >= 3) break;
      if (fences.has(c.fence)) continue; // (one of each kind)
      if (!clear(c.x, c.z, 8)) continue;
      fences.add(c.fence);
      this.yards.push(this._build(c));
    }
    this.zombies = []; // (loaded when first needed)
    this.loading = false;
    this.next = 6;
    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._sphere = new THREE.Sphere(new THREE.Vector3(), 8);
    this.t = 0;
  }

  /** One graveyard at c: its fence, its stones, its candles, its mist, and its fresh graves. */
  _build(c) {
    const y0 = this.ground(c.x, c.z);
    const g = new THREE.Group();
    g.position.set(c.x, y0, c.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(g);
    const R = 7 + Math.random() * 1.5;
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, color: 0xb9b5aa });
    const earth = new THREE.MeshStandardMaterial({ color: 0x2b2318, roughness: 1 });
    // dead grass and trodden earth
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.6, 36).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b3626, roughness: 1 }));
    floor.position.y = 0.025;
    floor.receiveShadow = true;
    g.add(floor);
    const geos = []; // (the stones, merged into one mesh)
    const put = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
      const n = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
      n.clearGroups();
      for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
      geos.push(n);
    };
    const meshGeos = (obj, x, y, z, ry, tilt) => {
      obj.updateMatrixWorld(true);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const n = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt[0], ry, tilt[1])), new THREE.Vector3(1, 1, 1));
        n.applyMatrix4(m);
        n.clearGroups();
        for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
        geos.push(n);
      });
    };
    // the fence
    if (c.fence === 'wall') {
      // a low dry-stone wall, a gap for the way in
      const block = new THREE.BoxGeometry(0.62, 0.5, 0.45);
      for (let a = 0; a < Math.PI * 2; a += 0.085) {
        if (Math.abs(Math.atan2(Math.sin(a - 0.4), Math.cos(a - 0.4))) < 0.16) continue;
        for (let row = 0; row < 2; row++) put(block, Math.cos(a) * R, 0.25 + row * 0.42, Math.sin(a) * R, R2(0.06), -a + R2(0.1), R2(0.06));
      }
    } else if (c.fence === 'railings') {
      const bar = new THREE.CylinderGeometry(0.018, 0.018, 1.5, 5).translate(0, 0.75, 0);
      const spike = new THREE.ConeGeometry(0.04, 0.12, 4).translate(0, 1.56, 0);
      const iron = new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.6, metalness: 0.6 });
      const bars = [];
      for (let a = 0; a < Math.PI * 2; a += 0.12) if (Math.abs(Math.atan2(Math.sin(a - 0.4), Math.cos(a - 0.4))) > 0.13) bars.push(a);
      const im = new THREE.InstancedMesh(mergeGeometries([bar.toNonIndexed(), spike.toNonIndexed()]), iron, bars.length);
      const m = new THREE.Matrix4();
      bars.forEach((a, i) => {
        m.makeTranslation(Math.cos(a) * R, 0, Math.sin(a) * R).multiply(new THREE.Matrix4().makeRotationZ(R2(0.16)));
        im.setMatrixAt(i, m);
      });
      im.castShadow = true;
      g.add(im);
      for (const y of [0.25, 1.3]) {
        const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.02, 4, 80), iron);
        rail.rotation.x = Math.PI / 2;
        rail.position.y = y;
        g.add(rail);
      }
    } else {
      // a broken picket fence, grey and leaning, gaps where pickets have gone
      const wood = new THREE.MeshStandardMaterial({ color: 0x6d675c, roughness: 1 });
      const pick = new THREE.BoxGeometry(0.09, 1.0, 0.03).translate(0, 0.5, 0);
      const list = [];
      for (let a = 0; a < Math.PI * 2; a += 0.06) if (Math.random() > 0.22 && Math.abs(Math.atan2(Math.sin(a - 0.4), Math.cos(a - 0.4))) > 0.14) list.push(a);
      const im = new THREE.InstancedMesh(pick, wood, list.length);
      const m = new THREE.Matrix4();
      list.forEach((a, i) => {
        m.compose(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R), new THREE.Quaternion().setFromEuler(new THREE.Euler(R2(0.25), -a + Math.PI / 2, R2(0.2))), new THREE.Vector3(1, 0.8 + Math.random() * 0.35, 1));
        im.setMatrixAt(i, m);
      });
      im.castShadow = true;
      g.add(im);
    }
    // the stones: crooked rows of headstones and crosses, a tomb chest, an obelisk
    const stones = [];
    for (let row = -2; row <= 2; row++) {
      for (let k = -3; k <= 3; k++) {
        if (Math.random() < 0.3) continue;
        const x = k * 1.7 + R2(0.4);
        const z = row * 2.2 + R2(0.3);
        if (Math.hypot(x, z) > R - 1.2) continue;
        stones.push([x, z]);
      }
    }
    const graves = [];
    stones.forEach(([x, z], i) => {
      if (i === 3) {
        // a tomb chest
        put(new THREE.BoxGeometry(0.9, 0.6, 1.9), x, 0.3, z + 0.6, 0, R2(0.1), 0);
        put(new THREE.BoxGeometry(1.05, 0.1, 2.05), x, 0.65, z + 0.6, R2(0.05), R2(0.1), R2(0.05));
        return;
      }
      if (i === 7) {
        // an obelisk on a plinth
        put(new THREE.BoxGeometry(0.7, 0.4, 0.7), x, 0.2, z);
        put(new THREE.CylinderGeometry(0.16, 0.26, 2.0, 4, 1).rotateY(Math.PI / 4), x, 1.4, z);
        put(new THREE.ConeGeometry(0.16, 0.3, 4).rotateY(Math.PI / 4), x, 2.55, z);
        return;
      }
      const h = headstone(stone, Math.random() < 0.18 ? 'cross' : 'slab');
      meshGeos(h, x, -0.08, z, R2(0.3), [R2(0.22), R2(0.22)]);
      graves.push(new THREE.Vector3(x, 0, z + 1.1));
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), stone);
    merged.castShadow = merged.receiveShadow = true;
    g.add(merged);
    // three fresh graves: a mound of dark earth in front of a stone (where the dead come up)
    const fresh = graves.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const p of fresh) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.45, 0.16, 0.95), earth);
      mound.position.copy(p);
      mound.receiveShadow = true;
      g.add(mound);
    }
    // candles on some graves, and a lantern on a post by the way in
    const lights = [];
    g.updateMatrixWorld(true);
    for (const [x, z] of stones.slice(0, 9)) {
      const w = new THREE.Vector3(x + 0.3, 0.12, z + 0.35).applyMatrix4(g.matrixWorld);
      lights.push({ pos: w.toArray(), colour: [1, 0.6, 0.22], phase: Math.random() });
    }
    const post = new THREE.Vector3(Math.cos(0.4) * (R + 0.8), 0, Math.sin(0.4) * (R + 0.8));
    const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 6).translate(0, 1.05, 0), new THREE.MeshStandardMaterial({ color: 0x1b1814, roughness: 0.8 }));
    postMesh.position.copy(post);
    g.add(postMesh);
    // (a little iron lantern: a dark cap and base, the glass glowing between)
    const lantern = new THREE.Group();
    const ironL = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.7, metalness: 0.5 });
    lantern.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.16, 0), ironL));
    lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16).translate(0, -0.12, 0), ironL));
    lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a1c0c, emissive: 0xff9a3a, emissiveIntensity: 0.9, roughness: 0.4 })));
    lantern.position.copy(post).setY(2.2);
    g.add(lantern);
    lights.push({ pos: post.clone().setY(2.2).applyMatrix4(g.matrixWorld).toArray(), colour: [1, 0.66, 0.3], phase: 0.3 });
    const glow = bulbs(lights, 0.2);
    this.group.add(glow);
    // the mist lying among the stones
    const mistTex = mistTexture();
    const mist = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0x6b737c, transparent: true, depthWrite: false, opacity: 0.12, fog: true }));
      s.position.set(R2(R * 1.4), 0.3 + Math.random() * 0.2, R2(R * 1.4));
      s.scale.set(5 + Math.random() * 4, 0.9 + Math.random() * 0.4, 1);
      g.add(s);
      mist.push({ s, ph: Math.random() * 6, x: s.position.x, z: s.position.z });
    }
    return { c: new THREE.Vector3(c.x, y0, c.z), g, glow, mist, fresh: fresh.map((p) => p.clone().applyMatrix4(g.matrixWorld)), lantern };
  }

  async load(base = '') {
    if (this.loading) return;
    this.loading = true;
    const loader = new GLTFLoader();
    const got = await Promise.all(['zombie-green', 'zombie-blue'].map((n) => loader.loadAsync(`${base}models/halloween/${n}.glb`).catch(() => null)));
    // a pool of three: the dead who rise (only one graveyard is ever near)
    [got[0], got[1], got[0]].forEach((gl) => {
      if (!gl) return;
      const model = cloneSkinned(gl.scene);
      // (its bones placed first: measured before, a skinned model comes out the wrong size)
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model, true);
      model.scale.multiplyScalar(1.7 / Math.max(0.01, box.max.y - box.min.y));
      model.updateMatrixWorld(true);
      model.position.y -= new THREE.Box3().setFromObject(model, true).min.y;
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.frustumCulled = false;
      });
      const holder = new THREE.Group();
      holder.add(model);
      holder.visible = false;
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(model);
      const clip = (n) => {
        const c = gl.animations.find((a) => a.name === n);
        return c ? mixer.clipAction(c) : null;
      };
      const die = clip('Death');
      if (die) {
        die.setLoop(THREE.LoopOnce, 1);
        die.clampWhenFinished = true;
      }
      this.zombies.push({ holder, mixer, claw: clip('Idle_Attack') ?? clip('Idle'), walk: clip('Walk'), die, state: 'down', t: 0 });
    });
  }

  /**
   * @param {number} dt
   * @param {{ on: boolean, rise?: boolean, camera: THREE.Camera, scale?: number, light?: THREE.PointLight, lightHome?: THREE.Vector3, lightFree?: boolean }} o
   *   rise: the dead may climb out (not in a flyby); light: a light borrowed (the lure's graveyard's,
   *   dark but for its own moment: no new light, which would recompile every shader), lit over the
   *   graveyard you are near while lightFree, and put back home otherwise
   */
  update(dt, { on, rise = true, camera, scale, light = null, lightHome = null, lightFree = false }) {
    this.group.visible = on;
    if (!on) {
      if (light && lightHome) light.position.copy(lightHome);
      return;
    }
    this.t += dt;
    const t = this.t;
    const cam = camera.position;
    const flick = 0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 27 + 1.3);
    for (const y of this.yards) {
      y.glow.material.uniforms.uOn.value = flick;
      y.glow.material.uniforms.uTime.value = t;
      if (scale) y.glow.material.uniforms.uScale.value = scale;
      for (const m of y.mist) {
        m.s.position.x = m.x + Math.sin(t * 0.12 + m.ph) * 1.2;
        m.s.position.z = m.z + Math.cos(t * 0.1 + m.ph) * 1.2;
        m.s.material.opacity = 0.09 + 0.05 * Math.sin(t * 0.3 + m.ph);
      }
    }
    // the nearest graveyard, if you are near it and looking its way
    let near = null;
    let nd = Infinity;
    for (const y of this.yards) {
      const d = Math.hypot(cam.x - y.c.x, cam.z - y.c.z);
      if (d < nd) {
        nd = d;
        near = y;
      }
    }
    if (near && nd < NEAR * 2 && !this.loading) this.load().catch((e) => console.warn('the dead did not load:', e.message));
    // the candles' and the lantern's light over the stones (and the dead), when you are near
    if (light) {
      if (lightFree && near && nd < 45) {
        light.position.set(near.c.x, near.c.y + 2.6, near.c.z);
        light.distance = 24;
        light.decay = 1.2;
        light.intensity = 16 * flick;
      } else if (lightHome) light.position.copy(lightHome);
    }
    camera.updateMatrixWorld();
    this._frustum.setFromProjectionMatrix(this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const looking = near && nd < NEAR && this._frustum.intersectsSphere(this._sphere.set(near.c, 8));
    // now and then one rises (never more than two at once)
    this.next -= dt;
    const up = this.zombies.filter((z) => z.state !== 'down').length;
    if (rise && looking && this.next <= 0 && up < 2) {
      const z = this.zombies.find((q) => q.state === 'down');
      const spot = near.fresh[Math.floor(Math.random() * near.fresh.length)];
      if (z && spot) this._rise(z, spot, cam);
      this.next = 9 + Math.random() * 14;
    }
    for (const z of this.zombies) this._step(z, dt, cam);
  }

  _rise(z, spot, cam) {
    z.state = 'rising';
    z.t = 0;
    z.spot = spot.clone();
    z.holder.position.copy(spot).setY(spot.y - 1.8);
    z.holder.rotation.y = Math.atan2(cam.x - spot.x, cam.z - spot.z);
    z.holder.visible = true;
    z.mixer.stopAllAction();
    if (z.claw) {
      z.claw.reset().play();
      z.claw.timeScale = 0.7;
    }
    z.life = 8 + Math.random() * 6;
    if (this.sound?.has?.('zombie-1')) this.sound.sample(`zombie-${1 + Math.floor(Math.random() * 4)}`, spot.clone().setY(spot.y + 0.5), { ref: 4, rolloff: 1.1, max: 60, gain: 0.9 });
  }

  _step(z, dt, cam) {
    if (z.state === 'down') return;
    z.t += dt;
    const ground = z.spot.y;
    if (z.state === 'rising') {
      // clawing up out of the earth, shoulders, then all of it, jerkily
      const k = Math.min(1, z.t / 3.4);
      const e = k * k * (3 - 2 * k) + 0.03 * Math.sin(z.t * 9) * (1 - k);
      z.holder.position.y = ground - 1.8 * (1 - e);
      if (k >= 1) {
        z.state = 'walking';
        z.t = 0;
        if (z.walk) {
          z.walk.reset().play();
          z.walk.timeScale = 0.55;
          z.claw?.crossFadeTo(z.walk, 0.5, false);
        }
      }
    } else if (z.state === 'walking') {
      // staggering towards you, slowly, swaying
      const to = new THREE.Vector3(cam.x - z.holder.position.x, 0, cam.z - z.holder.position.z);
      const d = to.length();
      const want = Math.atan2(to.x, to.z) + Math.sin(z.t * 0.9) * 0.25;
      let dy = want - z.holder.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      z.holder.rotation.y += dy * Math.min(1, dt * 1.5);
      if (d > 1.6) z.holder.position.addScaledVector(new THREE.Vector3(Math.sin(z.holder.rotation.y), 0, Math.cos(z.holder.rotation.y)), 0.42 * dt);
      z.holder.position.y = this.ground(z.holder.position.x, z.holder.position.z);
      if (z.t > z.life || d < 1.6) {
        z.state = 'falling';
        z.t = 0;
        if (z.die) {
          z.die.reset().play();
          z.walk?.crossFadeTo(z.die, 0.25, false);
        }
        if (this.sound?.has?.('zombie-2')) this.sound.sample('zombie-2', z.holder.position.clone().setY(z.holder.position.y + 1), { ref: 4, rolloff: 1.1, max: 50, gain: 0.7, rate: 0.85 });
      }
    } else if (z.state === 'falling') {
      // down, and back into the ground it came from
      if (z.t > 2.4) z.holder.position.y -= dt * 0.6;
      if (z.t > 5.5) {
        z.state = 'down';
        z.holder.visible = false;
        z.mixer.stopAllAction();
      }
    }
    z.mixer.update(dt);
  }
}
