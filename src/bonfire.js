// Bonfire Night (5 November): a bonfire on the front lawn, burning from dusk to midnight (flames,
// embers rising, a column of smoke drifting with the wind, and its light flickering over the
// grass and the house), and from half past six to ten, fireworks behind the house: rockets with
// a trail of sparks, bursting into peonies, chrysanthemums, gold willows and palms, rings and
// crackling glitter, the sparks streaking, white-hot then coloured then dying orange, each burst lighting the
// grounds for a moment. New Year: fireworks from two minutes to midnight on New Year's Eve until
// twenty to one, and every half-minute "Happy New Year" and the year (2027, from the real date)
// written across the sky in gold. Their sounds (the fire, the whistles and the bangs, late by the distance) are
// in sound.js.

import * as THREE from 'three';

const BONFIRE_DAY = 308; // 5 November (day of the year, from 0)

export function softDot(inner = 0.15) {
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
export class Particles {
  /**
   * near: closer than this (metres) a particle fades out, so a spark flying past the camera doesn't
   * fill the screen; max: the biggest a particle is drawn (pixels on a screen 800 high, scaled with it)
   */
  constructor(count, { additive = true, map = softDot(), sizeScale = 1, near = 0, max = 160, streak = false } = {}) {
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
    this.streak = streak;
    if (streak) {
      // fireworks: each spark drawn as a streak along its motion, `trail` seconds long, bright at its head
      this.trail = new Float32Array(count);
      geo.setAttribute('velocity', new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('trail', new THREE.BufferAttribute(this.trail, 1).setUsage(THREE.DynamicDrawUsage));
      this.material = streakMaterial(near, max);
      this.points = new THREE.Points(geo, this.material);
      this.points.frustumCulled = false;
      return;
    }
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
    if (this.streak) a.velocity.needsUpdate = a.trail.needsUpdate = true;
  }
}

/**
 * Sparks as streaks: the point is stretched over where the spark was `trail` seconds ago, the line
 * soft-edged and brightest at its head (as a burning star and its trail look to the eye and the
 * camera), sized in pixels from the focal length (uScale) so it holds at any distance.
 */
function streakMaterial(near, max) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 }, uNear: { value: near }, uMax: { value: max } },
    vertexShader: /* glsl */ `
      attribute vec3 colour;
      attribute float psize;
      attribute float alpha;
      attribute vec3 velocity;
      attribute float trail;
      uniform float uScale;
      uniform float uNear;
      uniform float uMax;
      varying vec3 vColour;
      varying float vAlpha;
      varying vec2 vDir;
      varying float vLen;
      varying float vWidth;
      void main() {
        vec4 head = modelViewMatrix * vec4(position, 1.0);
        vec4 tail = modelViewMatrix * vec4(position - velocity * trail, 1.0);
        vColour = colour;
        vAlpha = alpha * (uNear > 0.0 ? smoothstep(uNear * 0.3, uNear, -head.z) : 1.0);
        float base = clamp(psize * uScale / max(-head.z, 0.1), 1.5, uMax * uScale / 800.0);
        vec2 d = (head.xy / max(-head.z, 0.1) - tail.xy / max(-tail.z, 0.1)) * uScale;
        float full = length(d);
        // (the streak is cut short where the point would grow too big to draw)
        float size = min(base + full, 160.0 * uScale / 800.0);
        float len = max(0.0, size - base);
        vec4 mid = mix(head, tail, full > 0.001 ? 0.5 * len / full : 0.0);
        gl_Position = projectionMatrix * mid;
        vDir = full > 0.001 ? d / full : vec2(1.0, 0.0);
        vLen = 0.5 * len / size;
        vWidth = 0.32 * base / size;
        gl_PointSize = vAlpha > 0.001 ? size : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColour;
      varying float vAlpha;
      varying vec2 vDir;
      varying float vLen;
      varying float vWidth;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.y = -q.y;
        float t = clamp(dot(q, vDir), -vLen, vLen);
        float r = length(q - vDir * t) / vWidth;
        float along = vLen > 0.0 ? (t + vLen) / (2.0 * vLen) : 1.0;
        float a = exp(-r * r * 1.6) * mix(0.18, 1.0, along * along) * vAlpha;
        gl_FragColor = vec4(vColour * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
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
  constructor(scene, at, sound, { groundAt = null } = {}) {
    this.at = at.clone();
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Bonfire Night';
    scene.add(this.group);
    this.t = 0;

    // the pile: logs leaning together in a cone a little over two metres high, charred and glowing at the foot once it burns
    this.logMat = new THREE.MeshStandardMaterial({ color: 0x150e09, roughness: 0.97, emissive: new THREE.Color(0.6, 0.16, 0.03), emissiveIntensity: 0 });
    const logGeo = new THREE.CylinderGeometry(0.09, 0.13, 2.8, 7).translate(0, 1.4, 0);
    this.pile = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
      const log = new THREE.Mesh(logGeo, this.logMat);
      log.position.set(Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25);
      log.rotation.set(0, -a, 0);
      log.rotateZ(0.42 + Math.random() * 0.1);
      log.castShadow = true;
      this.pile.add(log);
    }
    this.pile.position.copy(this.at);
    this.group.add(this.pile);

    // fire, embers and smoke
    this.flames = new Particles(900);
    this.embers = new Particles(320, { map: softDot(0.05) });
    this.smoke = new Particles(520, { additive: false, map: softDot(0.35) });
    this.smoke.points.renderOrder = 8;
    // the fireworks' smoke, hanging over the field where they burst, lit by each new burst
    this.haze = new Particles(240, { additive: false, map: softDot(0.3), max: 600 });
    this.haze.points.renderOrder = 7;
    this.group.add(this.haze.points);
    this.flames.points.renderOrder = 9;
    this.group.add(this.smoke.points, this.flames.points, this.embers.points);
    // its light, and one for the bursts (both always in the scene, dark the rest of the year:
    // adding lights later would recompile every shader)
    this.fireLight = new THREE.PointLight(0xff7a2a, 0, 22, 2);
    this.fireLight.position.copy(this.at).add(new THREE.Vector3(0, 1.9, 0));
    this.flash = new THREE.PointLight(0xffffff, 0, 160, 1.6);
    // (in the scene itself, not the group: a hidden group's lights don't count, so showing it would
    // change the number of lights and recompile every shader, a pause of half a second)
    scene.add(this.fireLight, this.flash);

    // fireworks: rockets rise from the field behind the house and burst over it
    this.sparks = new Particles(6000, { near: 11, max: 16, streak: true });
    this.group.add(this.sparks.points);
    this.rockets = [];
    this.nextRocket = 0;
    this.flashLevel = 0;
    this.fire = 0;
    this.boost = 1; // a holiday flyby's show: more rockets, more salvos
    this.autoYear = true; // the year written every half-minute (the New Year flyby writes it on cue)
    this._lastDay = null;

    // other bonfires across the country, far off on the hills and in the villages: a flickering
    // point of orange each, with its smoke going up; and now and then someone else's fireworks,
    // small and low over the horizon, their bangs arriving seconds later
    this.far = [];
    if (groundAt) {
      let seed = 5;
      const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      // (only where you can see them from the lawn: on the slopes facing the estate, not behind a hill)
      const eye = this.at.clone().add(new THREE.Vector3(0, 1.7, 0));
      const seen = (p) => {
        for (let k = 1; k < 60; k++) {
          const q = eye.clone().lerp(p, k / 60);
          if (groundAt(q.x, q.z) > q.y - 1.5) return false;
        }
        return true;
      };
      for (let tries = 0; tries < 600 && this.far.length < 12; tries++) {
        const a = R() * Math.PI * 2;
        const d = 380 + R() * 2000;
        const x = this.at.x + Math.cos(a) * d;
        const z = this.at.z + Math.sin(a) * d;
        const p = new THREE.Vector3(x, groundAt(x, z) + 1.2, z);
        // (spread round the horizon, not bunched)
        if (!seen(p.clone().setY(p.y + 2)) || this.far.some((b) => Math.abs(Math.atan2(Math.sin(b.a - a), Math.cos(b.a - a))) < 0.32)) continue;
        this.far.push({ p, a, size: 2.6 + R() * 2.2, phase: R() * 10, from: 16.6 + R() * 1.6 });
      }
    }
    this.farFire = new Particles(Math.max(1, this.far.length * 3), { map: softDot(0.08), max: 40 });
    this.farSmoke = new Particles(Math.max(1, this.far.length * 26), { additive: false, map: softDot(0.35), max: 300 });
    this.farFire.points.renderOrder = 6;
    this.farSmoke.points.renderOrder = 5;
    this.group.add(this.farSmoke.points, this.farFire.points);
    this.nextFar = 0;
    this.farSmokeAt = 0;
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
    this.farFire.points.visible = this.farSmoke.points.visible = bonfireNight;
    this.t += dt;
    const burning = bonfireNight && level > 0.05 && hours > 12 && hours < 23.9 ? 1 : 0;
    this.fire += (burning - this.fire) * (1 - Math.exp(-dt * 0.6));
    const f = this.fire;
    const flicker = 0.75 + 0.15 * Math.sin(this.t * 13) + 0.1 * Math.sin(this.t * 29 + 1.7);
    this.fireLight.intensity = 26 * f * flicker;
    this.logMat.emissiveIntensity = 0.5 * f * flicker;
    this.sound?.setBonfire?.(this.at, f);

    // flames: rising, shrinking, yellow-white to orange to red
    const fl = this.flames;
    for (let n = Math.floor(dt * 430 * f + Math.random()); n > 0; n--) {
      const i = fl.spawn();
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.0;
      fl.pos.set([this.at.x + Math.cos(a) * r, this.at.y + 0.2 + Math.random() * 0.55, this.at.z + Math.sin(a) * r], i * 3);
      fl.vel.set([(Math.random() - 0.5) * 0.35 + wind * 0.7, 2.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.35], i * 3);
      fl.life[i] = fl.data[i * 4] = 0.6 + Math.random() * 0.7;
      fl.data[i * 4 + 1] = 0.6 + Math.random() * 0.6;
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
    for (let n = Math.floor(dt * 60 * f + Math.random() * 0.6); n > 0; n--) {
      const i = em.spawn();
      em.pos.set([this.at.x + (Math.random() - 0.5) * 1.4, this.at.y + 1.4, this.at.z + (Math.random() - 0.5) * 1.4], i * 3);
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

    // smoke: a thick grey column, rising and spreading, drifting downwind and hanging over the
    // grounds (and still a little after the fire dies)
    const sm = this.smoke;
    for (let n = Math.floor(dt * 26 * Math.max(f, 0.15 * (level > 0 ? 1 : 0)) + Math.random() * 0.5); n > 0; n--) {
      const i = sm.spawn();
      sm.pos.set([this.at.x + (Math.random() - 0.5) * 1.2, this.at.y + 2.6, this.at.z + (Math.random() - 0.5) * 1.2], i * 3);
      sm.vel.set([0.4 + wind * 2.2 + (Math.random() - 0.5) * 0.4, 1.0 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5], i * 3);
      sm.life[i] = sm.data[i * 4] = 13 + Math.random() * 8;
    }
    // by day the smoke is pale grey; at night dark, a little paler than the sky, catching the fire's
    // light from below and the fireworks' flashes
    const lit = THREE.MathUtils.lerp(0.42, 0.012, level);
    for (let i = 0; i < sm.count; i++) {
      if (sm.life[i] <= 0) {
        sm.alpha[i] = 0;
        continue;
      }
      sm.life[i] -= dt;
      const u = 1 - Math.max(0, sm.life[i]) / sm.data[i * 4];
      for (let k = 0; k < 3; k++) sm.pos[i * 3 + k] += sm.vel[i * 3 + k] * dt;
      sm.vel[i * 3 + 1] *= 1 - 0.05 * dt;
      const above = sm.pos[i * 3 + 1] - this.at.y - 2.4;
      const glow = Math.exp(-Math.max(0, above) / 3.5) * f * level;
      const flash = this.flashLevel * 0.05;
      sm.col.set([lit + 0.3 * glow + flash, 0.96 * lit + 0.11 * glow + flash, 1.1 * lit + 0.03 * glow + flash], i * 3);
      sm.size[i] = 2.2 + u * 12;
      sm.alpha[i] = Math.min(1, u * 5) * (1 - u) * 0.55;
    }
    sm.flush();

    if (bonfireNight) this._farOff(dt, hours, level, wind, camera);

    // fireworks: 18:30 to 22:00 on Bonfire Night; at New Year a few in the last two minutes of the
    // old year, then from midnight a lot
    const d = Math.floor(day);
    this._newYear = newYear;
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
    // (Bonfire Night's go up behind the house; New Year's in the fields beyond the gate, over the drive)
    const from = this._newYear ? new THREE.Vector3(-26 + Math.random() * 62, 0, 74 + Math.random() * 18) : new THREE.Vector3(-18 + Math.random() * 46, 0, -62 + Math.random() * 14);
    const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 38 + Math.random() * 30, (Math.random() - 0.5) * 8));
    // a mix, as a real display has: mostly peonies (some with a heart of another colour), gold
    // chrysanthemums, willows hanging long, palms, rings, and crackling glitter
    const r = Math.random();
    const kind = r < 0.3 ? 'peony' : r < 0.47 ? 'double' : r < 0.6 ? 'chrysanthemum' : r < 0.72 ? 'willow' : r < 0.8 ? 'palm' : r < 0.9 ? 'ring' : 'crackle';
    const pick = () => FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)];
    const gold = [1, 0.68, 0.26];
    const colour = kind === 'willow' || kind === 'palm' || kind === 'chrysanthemum' ? gold : kind === 'crackle' ? [1, 0.9, 0.7] : pick();
    this.rockets.push({ from, to, t: -delay, time: 1.4 + Math.random() * 0.7, kind, colour, heart: pick(), whistled: false });
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
      // the trail: orange sparks dropping behind the rocket as it climbs, slowing towards the top
      for (let n = 0; n < 2; n++) {
        const i = sp.spawn();
        sp.pos.set([p.x + (Math.random() - 0.5) * 0.2, p.y, p.z + (Math.random() - 0.5) * 0.2], i * 3);
        sp.vel.set([(Math.random() - 0.5) * 1.2, -2 - Math.random() * 2, (Math.random() - 0.5) * 1.2], i * 3);
        sp.life[i] = sp.data[i * 4] = 0.3 + Math.random() * 0.35;
        this._colour(i, [1, 0.55, 0.2], 2.2);
        sp.size[i] = 0.12;
        sp.trail[i] = 0.08;
        sp.kind[i] = 0;
      }
      if (u >= 1 && !r.burst) {
        r.burst = true;
        this._burst(p.clone(), r.kind, r.colour, r.heart);
        this.flash.position.copy(p);
        this.flashLevel = 1;
        this.flash.color.setRGB(...r.colour.map((c) => 0.5 + 0.5 * c));
        this.sound?.bang?.(p.clone(), p.distanceTo(camera.position));
      }
    }
    this.rockets = this.rockets.filter((r) => !r.burst);
    // sparks: air drag (they slow hard after the burst), gravity, and their colour as they burn:
    // white-hot at first, then their own colour, then dimming through orange to nothing (willows
    // and palms hang longer and fall further; crackle glitters at the end; the year's sparks stop
    // hard where they belong, then sink slowly)
    const ember = [1, 0.38, 0.1];
    for (let i = 0; i < sp.count; i++) {
      if (sp.life[i] <= 0) {
        sp.alpha[i] = 0;
        continue;
      }
      sp.life[i] -= dt;
      const u = 1 - Math.max(0, sp.life[i]) / sp.data[i * 4];
      const kind = sp.kind[i];
      const willow = kind === 2;
      const words = kind === 3;
      const drag = Math.exp(-dt * (words ? 5 : willow ? 2.2 : kind === 5 ? 1.2 : 1.7));
      sp.vel[i * 3] *= drag;
      sp.vel[i * 3 + 1] = sp.vel[i * 3 + 1] * drag - (words ? 0.25 : willow ? 4.2 : 6) * dt;
      sp.vel[i * 3 + 2] *= drag;
      for (let k = 0; k < 3; k++) sp.pos[i * 3 + k] += sp.vel[i * 3 + k] * dt;
      const b = i * 4;
      if (kind !== 0 && kind !== 6) {
        const hot = 1 - THREE.MathUtils.smoothstep(u, 0, 0.12);
        const cool = THREE.MathUtils.smoothstep(u, words ? 0.8 : 0.6, 1);
        for (let k = 0; k < 3; k++) sp.col[i * 3 + k] = 3 * THREE.MathUtils.lerp(THREE.MathUtils.lerp(sp.data[b + 1 + k], 1.15, hot), ember[k] * 0.6, cool);
      }
      let a = (1 - u * u) * (kind === 6 ? 1 - u : 1);
      if (kind === 4 && u > 0.55) a *= Math.sin(this.t * 47 + i * 12.9) > 0.3 ? 1.8 : 0.05; // crackle
      else if (kind === 1 || kind === 2 || kind === 5) a *= 0.85 + 0.15 * Math.sin(this.t * 30 + i * 1.7);
      sp.alpha[i] = a;
    }
    sp.flush();
    this.flashLevel *= Math.exp(-dt * 5);
    this.flash.intensity = 1800 * this.flashLevel;

    // the fireworks' smoke: puffs where the shells burst, spreading and drifting, dark against the
    // night sky but lit up by each new burst near them
    const hz = this.haze;
    const fp = this.flash.position;
    const fc = this.flash.color;
    for (let i = 0; i < hz.count; i++) {
      if (hz.life[i] <= 0) {
        hz.alpha[i] = 0;
        continue;
      }
      hz.life[i] -= dt;
      const u = 1 - Math.max(0, hz.life[i]) / hz.data[i * 4];
      for (let k = 0; k < 3; k++) hz.pos[i * 3 + k] += hz.vel[i * 3 + k] * dt;
      const dx = hz.pos[i * 3] - fp.x;
      const dy = hz.pos[i * 3 + 1] - fp.y;
      const dz = hz.pos[i * 3 + 2] - fp.z;
      const lit = this.flashLevel * Math.min(1, 900 / (dx * dx + dy * dy + dz * dz + 1));
      hz.col.set([0.012 + 0.3 * lit * fc.r, 0.012 + 0.3 * lit * fc.g, 0.016 + 0.3 * lit * fc.b], i * 3);
      hz.size[i] = hz.data[i * 4 + 1] * (0.5 + u * 1.2);
      hz.alpha[i] = Math.min(1, u * 8) * (1 - u) * 0.35;
    }
    hz.flush();
  }

  /** A shell's smoke, left hanging where it burst. */
  _puff(at) {
    const hz = this.haze;
    for (let k = 0; k < 5; k++) {
      const i = hz.spawn();
      hz.pos.set([at.x + (Math.random() - 0.5) * 9, at.y + (Math.random() - 0.5) * 7, at.z + (Math.random() - 0.5) * 9], i * 3);
      hz.vel.set([0.9 + (Math.random() - 0.5) * 0.5, -0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5], i * 3);
      hz.life[i] = hz.data[i * 4] = 22 + Math.random() * 18;
      hz.data[i * 4 + 1] = 9 + Math.random() * 9;
    }
  }

  /** Other people's bonfires and fireworks, far off across the country. */
  _farOff(dt, hours, level, wind, camera) {
    const fire = this.farFire;
    const smoke = this.farSmoke;
    let j = 0;
    for (const b of this.far) {
      // (each lit at its own time after dusk, out by midnight)
      const on = level > 0.3 && hours > b.from && hours < 23.6 ? 1 : 0;
      b.on = (b.on ?? 0) + (on - (b.on ?? 0)) * (1 - Math.exp(-dt * 0.3));
      const flick = 0.75 + 0.15 * Math.sin(this.t * 9 + b.phase) + 0.1 * Math.sin(this.t * 23 + b.phase * 3);
      // (a wide faint glow on the smoke and the ground round it, the fire itself, a flame above)
      for (let k = 0; k < 3; k++, j++) {
        fire.pos.set([b.p.x, b.p.y + (k === 2 ? 1.2 : 0), b.p.z], j * 3);
        fire.col.set(k === 0 ? [1.2, 0.36, 0.08] : [1.7, 0.62 - k * 0.12, 0.14], j * 3);
        fire.size[j] = b.size * (k === 0 ? 5 : k === 1 ? 1 : 0.65);
        fire.alpha[j] = b.on * (k === 0 ? 0.22 : flick * (k === 1 ? 1 : 0.8));
      }
    }
    fire.flush();
    // their smoke: a slow faint column from each, leaning with the wind
    this.farSmokeAt -= dt;
    if (this.farSmokeAt <= 0 && this.far.length) {
      this.farSmokeAt = 0.35;
      const b = this.far[Math.floor(Math.random() * this.far.length)];
      if (b.on > 0.2) {
        const i = smoke.spawn();
        smoke.pos.set([b.p.x, b.p.y + 4, b.p.z], i * 3);
        smoke.vel.set([0.8 + wind * 3, 1.6 + Math.random(), (Math.random() - 0.5)], i * 3);
        smoke.life[i] = smoke.data[i * 4] = 30 + Math.random() * 15;
      }
    }
    for (let i = 0; i < smoke.count; i++) {
      if (smoke.life[i] <= 0) {
        smoke.alpha[i] = 0;
        continue;
      }
      smoke.life[i] -= dt;
      const u = 1 - Math.max(0, smoke.life[i]) / smoke.data[i * 4];
      for (let k = 0; k < 3; k++) smoke.pos[i * 3 + k] += smoke.vel[i * 3 + k] * dt;
      const low = Math.exp(-u * 6); // (lit orange by the fire just above it)
      smoke.col.set([0.02 + 0.25 * low, 0.02 + 0.09 * low, 0.024 + 0.02 * low], i * 3);
      smoke.size[i] = 8 + u * 40;
      smoke.alpha[i] = Math.min(1, u * 6) * (1 - u) * 0.28;
    }
    smoke.flush();
    // someone else's fireworks: a small shell low over the horizon now and then, its bang late
    this.nextFar -= dt;
    if (!this._priming && hours > 18.3 && hours < 22.5 && level > 0.5 && this.nextFar <= 0 && this.far.length) {
      this.nextFar = 1.5 + Math.random() * 6;
      const b = this.far[Math.floor(Math.random() * this.far.length)];
      const at = b.p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, 45 + Math.random() * 50, (Math.random() - 0.5) * 120));
      const r = Math.random();
      this._burst(at, r < 0.5 ? 'peony' : r < 0.7 ? 'chrysanthemum' : r < 0.85 ? 'willow' : 'crackle', FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)], undefined, 0.6);
      this.sound?.bang?.(at, at.distanceTo(camera.position));
    }
  }

  /** "Happy New Year" and the coming year (2027 in 2026), written in gold sparks high over the drive beyond the gate, facing the house. */
  writeYear() {
    this._writeYear();
  }

  _writeYear() {
    const now = new Date();
    const year = now.getMonth() === 0 && now.getDate() <= 6 ? now.getFullYear() : now.getFullYear() + 1;
    // "Happy New Year" over the year, drawn on a canvas and sampled into sparks
    const Wpx = 640;
    const Hpx = 300;
    const c = document.createElement('canvas');
    c.width = Wpx;
    c.height = Hpx;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 700 74px Georgia, serif';
    g.fillText('Happy New Year', Wpx / 2, 70);
    g.font = '700 150px Georgia, serif';
    g.fillText(String(year), Wpx / 2, 205);
    const px = g.getImageData(0, 0, Wpx, Hpx).data;
    const sp = this.sparks;
    const centre = new THREE.Vector3(4.4, 36, 62); // where the year hangs, over the drive beyond the gate (the flyby flies through it)
    const W = 74; // metres across
    // (read from the house, looking south: east is on the left)
    for (let y = 0; y < Hpx; y += 3) {
      const words = y < 130;
      if (!words && y % 4) continue; // (the year's big strokes need fewer sparks)
      for (let x = 0; x < Wpx; x += words ? 3 : 4) {
        if (px[(y * Wpx + x) * 4 + 3] < 128) continue;
        const i = sp.spawn();
        const tx = centre.x - (x / Wpx - 0.5) * W;
        const ty = centre.y - ((y - 205) / Wpx) * W;
        // each spark flies out from the middle to its place in the letters, then hangs and falls
        sp.pos.set([centre.x, centre.y, centre.z], i * 3);
        sp.vel.set([(tx - centre.x) * 2.2, (ty - centre.y) * 2.2, 0], i * 3);
        sp.life[i] = sp.data[i * 4] = 4.5 + Math.random();
        this._colour(i, words ? [1, 0.82, 0.45] : [1, 0.72, 0.3]);
        sp.size[i] = words ? 0.26 : 0.32;
        sp.trail[i] = 0.06;
        sp.kind[i] = 3;
      }
    }
    this.flash.position.copy(centre);
    this.flashLevel = 1;
    this.flash.color.setRGB(1, 0.8, 0.4);
    this.sound?.bang?.(centre, 60);
  }

  /** A spark's own colour (it burns white-hot, then this, then dims through orange). */
  _colour(i, colour, scale = 3) {
    const sp = this.sparks;
    sp.data[i * 4 + 1] = colour[0];
    sp.data[i * 4 + 2] = colour[1];
    sp.data[i * 4 + 3] = colour[2];
    sp.col.set([colour[0] * scale, colour[1] * scale, colour[2] * scale], i * 3);
  }

  /**
   * A shell bursting: its stars fly out in a sphere (or a ring), fast, then slow in the air.
   * peony: coloured stars; double: with a heart of another colour inside; chrysanthemum: gold
   * stars with long trails; willow: gold, hanging and falling a long way; palm: a few thick gold
   * branches; ring: a tilted circle; crackle: white-gold glitter that crackles at the end.
   */
  _burst(at, kind, colour, heart = colour, scale = 1) {
    const sp = this.sparks;
    const n = Math.round(({ peony: 130, double: 120, chrysanthemum: 140, willow: 150, palm: 16, ring: 80, crackle: 150 }[kind] ?? 120) * (scale < 1 ? 0.6 : 1));
    const speed = (kind === 'willow' ? 15 : kind === 'palm' ? 20 : 22 + Math.random() * 8) * scale;
    if (scale === 1) this._puff(at);
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 1.2, 0, Math.random() * 1.2));
    const d = new THREE.Vector3();
    const star = (dir, v, life, col, size, trail, k) => {
      const i = sp.spawn();
      sp.pos.set([at.x, at.y, at.z], i * 3);
      sp.vel.set([dir.x * v, dir.y * v, dir.z * v], i * 3);
      sp.life[i] = sp.data[i * 4] = life;
      this._colour(i, col);
      sp.size[i] = size;
      sp.trail[i] = trail;
      sp.kind[i] = k;
    };
    const sphere = () => {
      do d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      while (d.lengthSq() > 1 || d.lengthSq() < 1e-3);
      return d.normalize();
    };
    for (let k = 0; k < n; k++) {
      const v = speed * (0.88 + Math.random() * 0.24);
      if (kind === 'ring') {
        const a = (k / n) * Math.PI * 2;
        star(d.set(Math.cos(a), 0, Math.sin(a)).applyQuaternion(tilt), v, 1.4 + Math.random() * 0.6, colour, 0.3, 0.1, 1);
      } else if (kind === 'willow') star(sphere(), v, 3.2 + Math.random() * 1.2, colour, 0.22, 0.35, 2);
      else if (kind === 'palm') star(sphere().setY(Math.abs(d.y) * 0.6 + 0.4).normalize(), v, 2.6 + Math.random() * 0.6, colour, 0.5, 0.3, 5);
      else if (kind === 'chrysanthemum') star(sphere(), v, 1.6 + Math.random() * 0.7, colour, 0.22, 0.22, 5);
      else if (kind === 'crackle') star(sphere(), v * 0.85, 1.5 + Math.random() * 0.8, colour, 0.22, 0.08, 4);
      else star(sphere(), v, 1.4 + Math.random() * 0.7, colour, 0.3, 0.1, 1);
    }
    // a double's heart: a smaller ball of another colour inside
    if (kind === 'double') for (let k = 0; k < 60; k++) star(sphere(), speed * 0.45 * (0.85 + Math.random() * 0.3), 1.2 + Math.random() * 0.5, heart, 0.28, 0.08, 1);
    // the flash of the burst itself, a moment's white glare at its heart
    star(d.set(0, 1, 0), 0, 0.16, [1, 0.95, 0.85], 2.4, 0, 6);
  }

  setScale(scale) {
    for (const ps of [this.flames, this.embers, this.smoke, this.sparks, this.haze, this.farFire, this.farSmoke]) ps.material.uniforms.uScale.value = scale;
  }
}
