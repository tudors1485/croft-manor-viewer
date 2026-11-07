// Thunderstorms: lightning somewhere round the estate every few seconds, most of it far off (a
// flicker in the clouds), some nearer with a bolt you can see, now and then one close. As real
// lightning does, a bolt feels its way down from the cloud in a fraction of a second (the leader,
// faint), then flashes: the return stroke, and two to four more down the same path at uneven
// intervals, each fading fast, now and then one lingering. The flash lights the sky, the fog and
// the house; a near one is the sun's own light for that moment, turned to come from the bolt, so
// the house, the trees and the window frames throw hard shadows from it, indoors too (sky.js). Its
// thunder arrives late by the distance (sound travels 343 m a second): a sharp crack and a boom
// when it is close, a long low roll when it is far (the sound is in sound.js).

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/** A jagged path from `a` to `b`: midpoint displacement, `levels` times, mostly sideways. */
function jagged(a, b, levels, rough) {
  let pts = [a.clone(), b.clone()];
  const side = new THREE.Vector3();
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      const len = p.distanceTo(q);
      side.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize();
      next.push(p.clone().lerp(q, 0.4 + Math.random() * 0.2).addScaledVector(side, len * rough * (0.5 + Math.random() * 0.5)), q);
    }
    pts = next;
  }
  return pts;
}

/** A soft round glow (the cloud lit from inside). */
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,0.8)');
  r.addColorStop(0.3, 'rgba(255,255,255,0.3)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Storm {
  /**
   * @param {THREE.Scene} scene
   * @param {{ thunder: (pos: THREE.Vector3, distance: number, close: number) => void }} sound
   */
  constructor(scene, sound) {
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Lightning';
    scene.add(this.group);
    // the flash's light (always in the scene, dark between strikes: adding a light later would
    // recompile every shader); no shadows, so it is turned down indoors instead
    this.light = new THREE.DirectionalLight(0xdfe4ff, 0);
    this.light.castShadow = false;
    scene.add(this.light, this.light.target);
    this.core = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.1, 3.6), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    this.glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.55, 1), transparent: true, opacity: 0.25, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    this.strikes = [];
    this.next = 1.5;
    this.flash = 0; // how bright the sky is right now, 0..1 (read by sky.js)
    this.key = 0; // a near strike's own light, for the shadowed light (sky.js)
    this.keyDir = new THREE.Vector3(0, 1, 0); // where it comes from
    // the cloud lit from inside where the bolt leaves it
    this.cloudGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xc8ceff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.cloudGlow.renderOrder = -0.5;
    this.cloudGlow.visible = false;
    this.group.add(this.cloudGlow);
  }

  /** A strike at `distance` metres from `centre` (a visible bolt when `bolt`), `front`: in front of the house. */
  strike(centre, distance, bolt, front = false) {
    // (in front: to the south, where the drive is, so it is seen and its light comes in at the front windows)
    const a = front ? (Math.random() - 0.5) * 1.4 : Math.random() * Math.PI * 2;
    const ground = new THREE.Vector3(centre.x + Math.sin(a) * distance, 0, centre.z + Math.cos(a) * distance);
    // the leader first (a visible bolt draws itself down), then the strokes: the first the
    // brightest, the rest down the same path at uneven intervals, now and then one lingering
    const leader = bolt ? 0.045 + Math.random() * 0.06 : 0;
    const s = { t: 0, at: ground, distance, leader, pulses: [], meshes: [] };
    const strokes = bolt ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3);
    for (let k = 0, t = leader; k < strokes; k++) {
      const linger = k > 0 && Math.random() < 0.3;
      s.pulses.push({ at: t, peak: k === 0 ? 1 : 0.45 + Math.random() * 0.5, decay: linger ? 5 + Math.random() * 3 : 18 + Math.random() * 14 });
      t += 0.035 + Math.random() * (linger ? 0.25 : 0.11);
    }
    s.end = s.pulses[s.pulses.length - 1].at + 0.5;
    if (bolt) {
      const top = ground.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, 330 + Math.random() * 120, (Math.random() - 0.5) * 120));
      s.top = top;
      const main = jagged(top, ground, 7, 0.32);
      // thick enough to see from far off: about 4 to 6 pixels at a kilometre
      const r = 1.2 + distance * 0.0016;
      // (each tube drawn from the top down as the leader comes; a branch starts where it forks off)
      const add = (pts, radius, start) => {
        const curve = new THREE.CatmullRomCurve3(pts, false, 'chordal');
        const n = pts.length * 2;
        for (const [mat, k] of [
          [this.core, 1],
          [this.glow, 6],
        ]) {
          const m = new THREE.Mesh(new THREE.TubeGeometry(curve, n, radius * k, 4, false), mat);
          m.frustumCulled = false;
          m.renderOrder = -0.4; // in front of the sky, behind the house
          m.userData.start = start;
          m.userData.full = m.geometry.index.count;
          m.geometry.setDrawRange(0, 0);
          this.group.add(m);
          s.meshes.push(m);
        }
      };
      add(main, r, 0);
      // a few branches, thinner, forking down and out from the upper part (they go dark sooner)
      for (let b = 0; b < 2 + Math.floor(Math.random() * 4); b++) {
        const f = 0.1 + Math.random() * 0.5;
        const from = main[Math.floor(main.length * f)];
        const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 160, -(60 + Math.random() * 120), (Math.random() - 0.5) * 160));
        to.y = Math.max(to.y, 20);
        add(jagged(from, to, 5, 0.35), r * 0.45, f);
        s.meshes[s.meshes.length - 1].userData.branch = s.meshes[s.meshes.length - 2].userData.branch = true;
      }
    }
    this.strikes.push(s);
    // the light comes from where the strike is: from the bolt's middle height for a near one
    // (low, raking: long shadows), from high in the cloud for a far one
    const up = distance < 700 ? 140 + Math.random() * 60 : 260;
    s.dir = new THREE.Vector3(ground.x - centre.x, 0, ground.z - centre.z).setLength(distance).add(UP.clone().multiplyScalar(up)).normalize();
    this.light.position.copy(centre).addScaledVector(s.dir, 400);
    this.light.target.position.copy(centre);
    this.sound?.thunder?.(ground, distance, bolt ? 1 : 0);
  }

  /**
   * @param {number} dt
   * @param {{ storm: number, centre: THREE.Vector3, inside: number }} o storm 0..1 (weather.js)
   * @returns {number} the flash, 0..1
   */
  update(dt, { storm, centre, inside = 0 }) {
    this.next -= dt;
    if (storm > 0.05 && this.next <= 0) {
      // mostly far (a flicker in the clouds), some nearer with a bolt to see, now and then close
      const r = Math.random();
      const distance = r < 0.06 ? 140 + Math.random() * 140 : r < 0.45 ? 350 + Math.random() * 1100 : 1500 + Math.random() * 2500;
      this.strike(centre, distance, distance < 1600);
      this.next = (2.5 + Math.random() * 9) / storm;
    }
    let flash = 0;
    let light = 0;
    let key = 0;
    let cloud = 0;
    for (const s of this.strikes) {
      if (!this.hold) s.t += dt; // (hold: a strike kept at its flash, for a picture of it)
      let b = 0;
      for (const p of s.pulses) if (s.t >= p.at) b = Math.max(b, p.peak * Math.exp(-(s.t - p.at) * p.decay));
      // the leader: a faint flicker as it comes down
      const coming = s.leader > 0 && s.t < s.leader;
      if (coming) b = Math.max(b, 0.07 * (0.6 + 0.4 * Math.sin(s.t * 400)));
      const near = THREE.MathUtils.clamp(700 / s.distance, 0.25, 1);
      flash = Math.max(flash, b * near);
      const strength = b * THREE.MathUtils.clamp(1500 / s.distance, 0.4, 8);
      light = Math.max(light, strength);
      // (the near ones light the scene with shadows)
      if (s.distance < 900 && strength > key) {
        key = strength;
        this.keyDir.copy(s.dir);
      }
      const grown = s.leader > 0 ? Math.min(1, s.t / s.leader) : 1;
      for (const m of s.meshes) {
        const u = m.userData;
        const g = THREE.MathUtils.clamp((grown - u.start) / (1 - u.start), 0, 1);
        m.geometry.setDrawRange(0, Math.floor((u.full * g) / 6) * 6);
        // (branches fade first: only the main channel carries the later strokes)
        m.visible = g > 0 && (coming || b > (u.branch ? 0.25 : 0.04));
      }
      if (s.top && b > cloud) {
        cloud = b;
        this.cloudGlow.position.copy(s.top);
        this.cloudGlow.scale.setScalar(260 + s.distance * 0.12);
      }
    }
    this.cloudGlow.visible = cloud > 0.02;
    this.cloudGlow.material.opacity = Math.min(1, cloud * 0.8);
    // done strikes: their bolts go
    for (const s of this.strikes) {
      if (s.t < s.end) continue;
      for (const m of s.meshes) {
        this.group.remove(m);
        m.geometry.dispose();
      }
      s.done = true;
    }
    this.strikes = this.strikes.filter((s) => !s.done);
    this.core.opacity = 1;
    this.flash = flash;
    this.key = key;
    // (a soft fill from the same side, for the parts the shadowed light doesn't reach; indoors it
    // comes in at the windows, so dimmer)
    this.light.intensity = light * 0.3 * (1 - 0.6 * inside);
    return flash;
  }
}
