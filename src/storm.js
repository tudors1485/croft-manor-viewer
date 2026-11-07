// Thunderstorms: lightning somewhere round the estate every few seconds, most of it far off (a
// flicker in the clouds), some nearer with a bolt you can see, now and then one close. Each strike
// flashes two or three times, lighting the sky, the fog and the house, and its thunder arrives
// late by the distance (sound travels 343 m a second): a sharp crack and a boom when it is close,
// a long low roll when it is far (the sound is in sound.js).

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
  }

  /** A strike at `distance` metres from `centre` (a visible bolt when `bolt`). */
  strike(centre, distance, bolt) {
    const a = Math.random() * Math.PI * 2;
    const ground = new THREE.Vector3(centre.x + Math.sin(a) * distance, 0, centre.z + Math.cos(a) * distance);
    const s = { t: 0, at: ground, distance, pulses: [0], meshes: [] };
    // it flickers: a return stroke or two after the first
    for (let n = Math.random() < 0.75 ? 1 + Math.floor(Math.random() * 2) : 0, t = 0; n > 0; n--) s.pulses.push((t += 0.06 + Math.random() * 0.12));
    if (bolt) {
      const top = ground.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, 330 + Math.random() * 120, (Math.random() - 0.5) * 120));
      const main = jagged(top, ground, 7, 0.32);
      // thick enough to see from far off: about 4 to 6 pixels at a kilometre
      const r = 1.2 + distance * 0.0016;
      const add = (pts, radius) => {
        const curve = new THREE.CatmullRomCurve3(pts, false, 'chordal');
        const n = pts.length * 2;
        for (const [mat, k] of [
          [this.core, 1],
          [this.glow, 6],
        ]) {
          const m = new THREE.Mesh(new THREE.TubeGeometry(curve, n, radius * k, 4, false), mat);
          m.frustumCulled = false;
          m.renderOrder = -0.4; // in front of the sky, behind the house
          this.group.add(m);
          s.meshes.push(m);
        }
      };
      add(main, r);
      // a few branches, thinner, forking down and out from the upper part
      for (let b = 0; b < 2 + Math.floor(Math.random() * 3); b++) {
        const from = main[Math.floor(main.length * (0.1 + Math.random() * 0.5))];
        const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 160, -(60 + Math.random() * 120), (Math.random() - 0.5) * 160));
        to.y = Math.max(to.y, 20);
        add(jagged(from, to, 5, 0.35), r * 0.45);
      }
    }
    this.strikes.push(s);
    // the light comes from where the strike is, from above
    this.light.position.copy(centre).add(new THREE.Vector3(ground.x - centre.x, 0, ground.z - centre.z).setLength(300).add(UP.clone().multiplyScalar(260)));
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
    for (const s of this.strikes) {
      if (!this.hold) s.t += dt; // (hold: a strike kept at its flash, for a picture of it)
      let b = 0;
      for (const p of s.pulses) if (s.t >= p) b = Math.max(b, Math.exp(-(s.t - p) * 22));
      const near = THREE.MathUtils.clamp(700 / s.distance, 0.25, 1);
      flash = Math.max(flash, b * near);
      light = Math.max(light, b * THREE.MathUtils.clamp(1500 / s.distance, 0.4, 8));
      for (const m of s.meshes) m.visible = b > 0.04;
    }
    // done strikes: their bolts go
    for (const s of this.strikes) {
      if (s.t < s.pulses[s.pulses.length - 1] + 0.4) continue;
      for (const m of s.meshes) {
        this.group.remove(m);
        m.geometry.dispose();
      }
      s.done = true;
    }
    this.strikes = this.strikes.filter((s) => !s.done);
    this.core.opacity = 1;
    this.flash = flash;
    // (indoors it comes in at the windows: dimmer, but a close strike still lights the room)
    this.light.intensity = light * (1 - 0.6 * inside);
    return flash;
  }
}
