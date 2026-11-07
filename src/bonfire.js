// Bonfire Night (5 November): a bonfire on the front lawn, burning from dusk to midnight (flames,
// embers rising, a column of smoke drifting with the wind, and its light flickering over the
// grass and the house), and from half past six to ten, fireworks behind the house: rockets with
// a trail of sparks, bursting into peonies, rings and gold willows, each burst lighting the
// grounds for a moment. New Year: fireworks from two minutes to midnight on New Year's Eve until
// twenty to one, and every half-minute the new year (2027, from the real date) written across
// the sky in gold. Their sounds (the fire, the whistles and the bangs, late by the distance) are
// in sound.js.

import * as THREE from 'three';

const BONFIRE_DAY = 308; // 5 November (day of the year, from 0)

function softDot(inner = 0.15) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(inner, 'rgba(255,255,255,0.8)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A pool of particles drawn as one Points call: position, colour, size and alpha per particle. */
class Particles {
  /**
   * near: closer than this (metres) a particle fades out, so a spark flying past the camera doesn't
   * fill the screen; max: the biggest a particle is drawn (pixels on a screen 800 high, scaled with it)
   */
  constructor(count, { additive = true, map = softDot(), sizeScale = 1, near = 0, max = 160 } = {}) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count); // seconds left (0: free)
    this.age = new Float32Array(count);
    this.kind = new Uint8Array(count);
    this.data = new Float32Array(count * 4); // anything else a particle needs
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('colour', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: { value: 800 * sizeScale }, uNear: { value: near }, uMax: { value: max } },
      vertexShader: /* glsl */ `
        attribute vec3 colour;
        attribute float psize;
        attribute float alpha;
        uniform float uScale;
        uniform float uNear;
        uniform float uMax;
        varying vec3 vColour;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vColour = colour;
          vAlpha = alpha * (uNear > 0.0 ? smoothstep(uNear * 0.3, uNear, -mv.z) : 1.0);
          gl_PointSize = vAlpha > 0.001 ? clamp(psize * uScale / -mv.z, 1.0, uMax * uScale / 800.0) : 0.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColour;
        varying float vAlpha;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
          ${additive ? 'gl_FragColor = vec4(vColour * a, 1.0);' : 'gl_FragColor = vec4(vColour, a);'}
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  /** A free slot (or the oldest, if all are busy). */
  spawn() {
    for (let k = 0; k < this.count; k++) {
      const i = (this.next + k) % this.count;
      if (this.life[i] <= 0) {
        this.next = (i + 1) % this.count;
        return i;
      }
    }
    const i = this.next;
    this.next = (i + 1) % this.count;
    return i;
  }

  flush() {
    const a = this.points.geometry.attributes;
    for (const k of ['position', 'colour', 'psize', 'alpha']) a[k].needsUpdate = true;
  }
}

const FIREWORK_COLOURS = [
  [1, 0.25, 0.2],
  [0.3, 1, 0.35],
  [0.35, 0.55, 1],
  [1, 0.8, 0.3],
  [1, 0.95, 0.9],
  [0.85, 0.35, 1],
  [0.3, 0.95, 1],
];

export class Bonfire {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} at where the bonfire stands (on the ground)
   * @param {object} sound the soundscape (bonfire level, whistles and bangs)
   */
  constructor(scene, at, sound) {
    this.at = at.clone();
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Bonfire Night';
    scene.add(this.group);
    this.t = 0;

    // the pile: logs leaning together in a cone, charred and glowing at the foot once it burns
    this.logMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.95, emissive: new THREE.Color(0.6, 0.16, 0.03), emissiveIntensity: 0 });
    const logGeo = new THREE.CylinderGeometry(0.07, 0.1, 2.3, 7).translate(0, 1.15, 0);
    this.pile = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
      const log = new THREE.Mesh(logGeo, this.logMat);
      log.position.set(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
      log.rotation.set(0, -a, 0);
      log.rotateZ(0.42 + Math.random() * 0.1);
      log.castShadow = true;
      this.pile.add(log);
    }
    this.pile.position.copy(this.at);
    this.group.add(this.pile);

    // fire, embers and smoke
    this.flames = new Particles(500);
    this.embers = new Particles(220, { map: softDot(0.05) });
    this.smoke = new Particles(150, { additive: false, map: softDot(0.35) });
    this.smoke.points.renderOrder = 8;
    this.flames.points.renderOrder = 9;
    this.group.add(this.smoke.points, this.flames.points, this.embers.points);
    // its light, and one for the bursts (both always in the scene, dark the rest of the year:
    // adding lights later would recompile every shader)
    this.fireLight = new THREE.PointLight(0xff7a2a, 0, 18, 2);
    this.fireLight.position.copy(this.at).add(new THREE.Vector3(0, 1.6, 0));
    this.flash = new THREE.PointLight(0xffffff, 0, 160, 1.6);
    this.group.add(this.fireLight, this.flash);

    // fireworks: rockets rise from the field behind the house and burst over it
    this.sparks = new Particles(4000, { map: softDot(0.08), near: 7, max: 42 });
    this.group.add(this.sparks.points);
    this.rockets = [];
    this.nextRocket = 0;
    this.flashLevel = 0;
    this.fire = 0;
    this.boost = 1; // a holiday flyby's show: more rockets, more salvos
    this.autoYear = true; // the year written every half-minute (the New Year flyby writes it on cue)
    this._lastDay = null;
  }

  /** A fresh start for a flyby: no rockets in the air, the year written just after midnight. */
  reset() {
    this.rockets.length = 0;
    this.nextRocket = 0;
    this.nextYear = 1.8;
    this._lastDay = null;
  }

  /** The fire already going, and its smoke already up (a flyby starts at the height of the evening). */
  prime(opts) {
    if (!Bonfire.on(opts.day)) return;
    const sound = this.sound;
    this.sound = null;
    this._priming = true;
    this.fire = 1;
    for (let i = 0; i < 90; i++) this.update(0.125, opts);
    this._priming = false;
    this.sound = sound;
    this.rockets.length = 0;
    this.nextRocket = 0;
  }

  /** Bonfire Night (the fire from dusk to midnight, fireworks 18:30 to 22:00). */
  static on(day) {
    return Math.floor(day) === BONFIRE_DAY;
  }

  /** New Year: from half past eleven on New Year's Eve to half past one on New Year's Day. */
  static newYear(day, hours) {
    const d = Math.floor(day);
    return (d === 364 && hours >= 23.5) || (d === 0 && hours < 1.5);
  }

  update(dt, { day, hours, level, wind, camera, exporting = false }) {
    const bonfireNight = Bonfire.on(day);
    const newYear = Bonfire.newYear(day, hours);
    const today = bonfireNight || newYear;
    this.group.visible = today;
    this.pile.visible = bonfireNight;
    if (!today) {
      this.fireLight.intensity = 0;
      this.flash.intensity = 0;
      this.sound?.setBonfire?.(null, 0);
      return;
    }
    this.t += dt;
    const burning = bonfireNight && level > 0.05 && hours > 12 && hours < 23.9 ? 1 : 0;
    this.fire += (burning - this.fire) * (1 - Math.exp(-dt * 0.6));
    const f = this.fire;
    const flicker = 0.75 + 0.15 * Math.sin(this.t * 13) + 0.1 * Math.sin(this.t * 29 + 1.7);
    this.fireLight.intensity = 16 * f * flicker;
    this.logMat.emissiveIntensity = 0.5 * f * flicker;
    this.sound?.setBonfire?.(this.at, f);

    // flames: rising, shrinking, yellow-white to orange to red
    const fl = this.flames;
    for (let n = Math.floor(dt * 320 * f + Math.random()); n > 0; n--) {
      const i = fl.spawn();
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.8;
      fl.pos.set([this.at.x + Math.cos(a) * r, this.at.y + 0.2 + Math.random() * 0.5, this.at.z + Math.sin(a) * r], i * 3);
      fl.vel.set([(Math.random() - 0.5) * 0.3 + wind * 0.6, 2.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.3], i * 3);
      fl.life[i] = fl.data[i * 4] = 0.55 + Math.random() * 0.6;
      fl.data[i * 4 + 1] = 0.45 + Math.random() * 0.45;
    }
    for (let i = 0; i < fl.count; i++) {
      if (fl.life[i] <= 0) {
        fl.alpha[i] = 0;
        continue;
      }
      fl.life[i] -= dt;
      const u = 1 - Math.max(0, fl.life[i]) / fl.data[i * 4]; // 0 young .. 1 gone
      for (let k = 0; k < 3; k++) fl.pos[i * 3 + k] += fl.vel[i * 3 + k] * dt;
      fl.pos[i * 3] += Math.sin(this.t * 7 + i) * 0.2 * dt;
      fl.col.set([1.05, THREE.MathUtils.lerp(0.72, 0.16, u), THREE.MathUtils.lerp(0.28, 0.02, Math.min(1, u * 1.6))], i * 3);
      fl.size[i] = fl.data[i * 4 + 1] * (1 - 0.7 * u);
      fl.alpha[i] = Math.sin(Math.min(1, u * 4) * Math.PI * 0.5) * (1 - u) * 0.85;
    }
    fl.flush();

    // embers: a few sparks carried up high
    const em = this.embers;
    for (let n = Math.floor(dt * 40 * f + Math.random() * 0.6); n > 0; n--) {
      const i = em.spawn();
      em.pos.set([this.at.x + (Math.random() - 0.5) * 1.2, this.at.y + 1.2, this.at.z + (Math.random() - 0.5) * 1.2], i * 3);
      em.vel.set([(Math.random() - 0.5) * 1.2 + wind * 1.2, 3 + Math.random() * 3, (Math.random() - 0.5) * 1.2], i * 3);
      em.life[i] = em.data[i * 4] = 1.5 + Math.random() * 2.5;
    }
    for (let i = 0; i < em.count; i++) {
      if (em.life[i] <= 0) {
        em.alpha[i] = 0;
        continue;
      }
      em.life[i] -= dt;
      const u = 1 - Math.max(0, em.life[i]) / em.data[i * 4];
      em.vel[i * 3 + 1] -= 0.6 * dt;
      for (let k = 0; k < 3; k++) em.pos[i * 3 + k] += em.vel[i * 3 + k] * dt;
      em.col.set([1.6, 0.6 * (1 - u) + 0.2, 0.1], i * 3);
      em.size[i] = 0.06;
      em.alpha[i] = (1 - u) * (0.6 + 0.4 * Math.sin(this.t * 20 + i));
    }
    em.flush();

    // smoke: grey, rising and spreading, drifting downwind (and still a little after the fire dies)
    const sm = this.smoke;
    for (let n = Math.floor(dt * 9 * Math.max(f, 0.15 * (level > 0 ? 1 : 0)) + Math.random() * 0.3); n > 0; n--) {
      const i = sm.spawn();
      sm.pos.set([this.at.x + (Math.random() - 0.5), this.at.y + 2.4, this.at.z + (Math.random() - 0.5)], i * 3);
      sm.vel.set([0.4 + wind * 2.2 + (Math.random() - 0.5) * 0.3, 1.1 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4], i * 3);
      sm.life[i] = sm.data[i * 4] = 9 + Math.random() * 5;
    }
    const lit = 0.45 + 0.55 * (1 - level); // by day the smoke is pale grey; at night it catches the fire from below
    for (let i = 0; i < sm.count; i++) {
      if (sm.life[i] <= 0) {
        sm.alpha[i] = 0;
        continue;
      }
      sm.life[i] -= dt;
      const u = 1 - Math.max(0, sm.life[i]) / sm.data[i * 4];
      for (let k = 0; k < 3; k++) sm.pos[i * 3 + k] += sm.vel[i * 3 + k] * dt;
      sm.vel[i * 3 + 1] *= 1 - 0.05 * dt;
      const above = sm.pos[i * 3 + 1] - this.at.y - 2;
      const glow = Math.exp(-Math.max(0, above) / 10) * f * level;
      sm.col.set([0.42 * lit + 0.9 * glow, 0.4 * lit + 0.42 * glow, 0.44 * lit + 0.15 * glow], i * 3);
      sm.size[i] = 1.6 + u * 7;
      sm.alpha[i] = Math.min(1, u * 5) * (1 - u) * 0.62;
    }
    sm.flush();

    // fireworks: 18:30 to 22:00 on Bonfire Night; at New Year a few in the last two minutes of the
    // old year, then from midnight a lot
    const d = Math.floor(day);
    const beforeMidnight = newYear && d === 364;
    const showtime = this._priming ? false : bonfireNight ? hours > 18.5 && hours < 22 && level > 0.5 : newYear && (beforeMidnight ? hours > 23.966 : hours < 0.67);
    const b = this.boost;
    this.nextRocket -= dt;
    if (showtime && this.nextRocket <= 0) {
      const salvo = beforeMidnight ? 1 : Math.random() < (newYear ? 0.35 : 0.15) * b ? 3 + Math.floor(Math.random() * (b > 1 ? 3 : 1)) : 1;
      for (let s = 0; s < salvo; s++) this._launch(s * 0.25);
      this.nextRocket = (beforeMidnight ? 2.5 + Math.random() * 2.5 : newYear ? 0.4 + Math.random() * 1.1 : 0.9 + Math.random() * 2.2) / (beforeMidnight ? 1 : b);
    }
    // the stroke of midnight: a dozen at once
    if (newYear && d === 0 && this._lastDay === 364 && !this._priming) for (let s = 0; s < 12; s++) this._launch(s * 0.12 + Math.random() * 0.1);
    this._lastDay = d;
    // the new year in gold across the sky, every half-minute after midnight (more often in its flyby)
    if (newYear && d === 0 && hours < 0.67 && !this._priming && this.autoYear) {
      this.nextYear = (this.nextYear ?? 0) - dt;
      if (this.nextYear <= 0) {
        this._writeYear();
        this.nextYear = b > 1 ? 14 : 30;
      }
    }
    this._updateFireworks(dt, camera);
  }

  _launch(delay = 0) {
    const from = new THREE.Vector3(-18 + Math.random() * 46, 0, -62 + Math.random() * 14);
    const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 38 + Math.random() * 30, (Math.random() - 0.5) * 8));
    const kind = Math.random() < 0.2 ? 'willow' : Math.random() < 0.25 ? 'ring' : 'peony';
    const colour = kind === 'willow' ? [1, 0.72, 0.28] : FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)];
    this.rockets.push({ from, to, t: -delay, time: 1.4 + Math.random() * 0.7, kind, colour, whistled: false });
  }

  _updateFireworks(dt, camera) {
    const sp = this.sparks;
    const p = new THREE.Vector3();
    for (const r of this.rockets) {
      r.t += dt;
      if (r.t < 0) continue;
      if (!r.whistled) {
        r.whistled = true;
        this.sound?.rocket?.(r.from, r.time);
      }
      const u = Math.min(1, r.t / r.time);
      p.lerpVectors(r.from, r.to, 1 - (1 - u) * (1 - u));
      // the trail: sparks dropping behind the rocket
      for (let n = 0; n < 3; n++) {
        const i = sp.spawn();
        sp.pos.set([p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3], i * 3);
        sp.vel.set([(Math.random() - 0.5) * 1.5, -1 - Math.random() * 2, (Math.random() - 0.5) * 1.5], i * 3);
        sp.life[i] = sp.data[i * 4] = 0.35 + Math.random() * 0.3;
        sp.col.set([2, 1.1, 0.5], i * 3);
        sp.size[i] = 0.6;
        sp.kind[i] = 0;
      }
      if (u >= 1 && !r.burst) {
        r.burst = true;
        this._burst(p.clone(), r.kind, r.colour);
        this.flash.position.copy(p);
        this.flashLevel = 1;
        this.flash.color.setRGB(...r.colour.map((c) => 0.5 + 0.5 * c));
        this.sound?.bang?.(p.clone(), p.distanceTo(camera.position));
      }
    }
    this.rockets = this.rockets.filter((r) => !r.burst);
    // sparks: drag, gravity, a fade (willows hang longer and fall further)
    for (let i = 0; i < sp.count; i++) {
      if (sp.life[i] <= 0) {
        sp.alpha[i] = 0;
        continue;
      }
      sp.life[i] -= dt;
      const u = 1 - Math.max(0, sp.life[i]) / sp.data[i * 4];
      const willow = sp.kind[i] === 2;
      const words = sp.kind[i] === 3;
      // (the year's sparks stop hard where they belong, then sink slowly)
      const drag = Math.exp(-dt * (words ? 5 : willow ? 1.6 : 1.1));
      sp.vel[i * 3] *= drag;
      sp.vel[i * 3 + 1] = sp.vel[i * 3 + 1] * drag - (words ? 0.25 : willow ? 5 : 3.5) * dt;
      sp.vel[i * 3 + 2] *= drag;
      for (let k = 0; k < 3; k++) sp.pos[i * 3 + k] += sp.vel[i * 3 + k] * dt;
      const twinkle = sp.kind[i] ? 0.75 + 0.25 * Math.sin(this.t * 30 + i * 1.7) : 1;
      sp.alpha[i] = (1 - u * u) * twinkle;
    }
    sp.flush();
    this.flashLevel *= Math.exp(-dt * 5);
    this.flash.intensity = 2600 * this.flashLevel;
  }

  /** The coming year (2027 in 2026), written in gold sparks high over the house, facing the drive. */
  writeYear() {
    this._writeYear();
  }

  _writeYear() {
    const now = new Date();
    const year = now.getMonth() === 0 && now.getDate() <= 6 ? now.getFullYear() : now.getFullYear() + 1;
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.font = '700 140px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(year), 240, 84);
    const px = g.getImageData(0, 0, 480, 160).data;
    const sp = this.sparks;
    const centre = new THREE.Vector3(5, 36, -44);
    const W = 58; // metres across
    for (let y = 0; y < 160; y += 4) {
      for (let x = 0; x < 480; x += 4) {
        if (px[(y * 480 + x) * 4 + 3] < 128) continue;
        const i = sp.spawn();
        const tx = centre.x + (x / 480 - 0.5) * W;
        const ty = centre.y - (y / 160 - 0.5) * W * (160 / 480);
        // each spark flies out from the middle to its place in the numbers, then hangs and falls
        sp.pos.set([centre.x, centre.y, centre.z], i * 3);
        sp.vel.set([(tx - centre.x) * 2.2, (ty - centre.y) * 2.2, 0], i * 3);
        sp.life[i] = sp.data[i * 4] = 4.5 + Math.random();
        sp.col.set([3, 2.1, 0.8], i * 3);
        sp.size[i] = 1.1;
        sp.kind[i] = 3;
      }
    }
    this.flash.position.copy(centre);
    this.flashLevel = 1;
    this.flash.color.setRGB(1, 0.8, 0.4);
    this.sound?.bang?.(centre, 60);
  }

  _burst(at, kind, colour) {
    const sp = this.sparks;
    const n = kind === 'willow' ? 160 : kind === 'ring' ? 90 : 150;
    const speed = kind === 'willow' ? 13 : 16 + Math.random() * 6;
    // a ring lies in a tilted plane
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 1.2, 0, Math.random() * 1.2));
    const d = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      if (kind === 'ring') {
        const a = (k / n) * Math.PI * 2;
        d.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(tilt);
      } else {
        d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        if (d.lengthSq() > 1 || d.lengthSq() < 1e-3) {
          k--;
          continue;
        }
        d.normalize();
      }
      const i = sp.spawn();
      const v = speed * (0.85 + Math.random() * 0.3);
      sp.pos.set([at.x, at.y, at.z], i * 3);
      sp.vel.set([d.x * v, d.y * v, d.z * v], i * 3);
      sp.life[i] = sp.data[i * 4] = kind === 'willow' ? 3 + Math.random() : 1.6 + Math.random() * 0.9;
      sp.col.set(colour.map((c) => c * 3), i * 3);
      sp.size[i] = kind === 'willow' ? 1.2 : 1.6;
      sp.kind[i] = kind === 'willow' ? 2 : 1;
    }
  }

  setScale(scale) {
    for (const ps of [this.flames, this.embers, this.smoke, this.sparks]) ps.material.uniforms.uScale.value = scale;
  }
}
