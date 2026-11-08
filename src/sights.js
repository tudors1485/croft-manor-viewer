// Sights of the sky and the fields:
//
// - Meteors: on the Perseids' nights (10 to 15 August, best on the night of the 12th) shooting
//   stars streak out from Perseus, in the north-east, a few a minute (more on the Sight): most faint
//   and quick, a thin line with a brighter head, fading as they go; now and then a bright one, and
//   rarely a fireball, greenish, that flares as it breaks up and leaves a glowing train hanging in
//   the sky for a few seconds. Drawn at the sky's distance, behind everything (the house hides them).
// - A starling murmuration: on clear winter evenings at dusk, thousands of starlings over the
//   woods and the lawn just west of the house, one dark cloud folding and pouring and turning over
//   on itself, with the rush of their wings when it turns, before they drop into the woods to roost.
// - The harvest moon: the full moon nearest the autumn equinox, found from the moon's real place,
//   rising huge and orange behind the house (main.js frames it through a long lens).

import * as THREE from 'three';
import { moonAt, sunAt } from './sky.js';

const SKY = 1200; // where the meteors are drawn (beyond everything; the sky's far plane does the rest)

/** A soft round glow (a meteor's head). */
let _headGlow = null;
function headGlow() {
  if (_headGlow) return _headGlow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  _headGlow = new THREE.CanvasTexture(c);
  return _headGlow;
}

export class Meteors {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'Meteors';
    scene.add(this.group);
    this.pool = [];
    const geo = new THREE.BufferGeometry();
    // a ribbon from the head (v = 1) to the tail (v = 0), set each frame
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uColour: { value: new THREE.Color(1, 1, 1) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position.z = gl_Position.w * 0.99998;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAlpha;
          uniform vec3 uColour;
          varying vec2 vUv;
          void main() {
            // a thin bright core with a soft edge, brightest at the head, gone at the tail
            float d = abs(vUv.x * 2.0 - 1.0);
            float core = exp(-d * d * 18.0) + 0.25 * exp(-d * d * 3.0);
            float a = pow(vUv.y, 2.6) * core * uAlpha;
            gl_FragColor = vec4(uColour * a * 2.4, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide, // (the ribbon may face either way)
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo.clone(), mat);
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
      // the head: a small glow running in front
      const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: headGlow(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
      head.visible = false;
      head.renderOrder = 2;
      head.material.onBeforeCompile = (sh) => {
        // (at the sky's distance, behind everything, as the streak is)
        sh.vertexShader = sh.vertexShader.replace('#include <logdepthbuf_vertex>', 'gl_Position.z = gl_Position.w * 0.99998;\n  #include <logdepthbuf_vertex>');
      };
      this.group.add(head);
      this.pool.push({ mesh: m, head, t: 1, life: 1 });
    }
    this.next = 2;
    this.boost = 0; // the Sight: seconds of a busier sky left
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  /** The Perseids: 10 to 15 August, strongest on the night of the 12th (day of the year from 0). */
  static rate(day) {
    const d = Math.floor(day);
    if (d < 221 || d > 226) return 0;
    return Math.max(0.25, 1 - Math.abs(d - 224) * 0.25);
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {number} o.night 0..1
   * @param {number} o.clouds 0..1
   * @param {number} o.compass the sky's turn (degrees), so Perseus stays in the north-east
   * @param {THREE.Camera} o.camera
   */
  update(dt, { day, night, clouds, compass = 0, camera }) {
    const rate = Meteors.rate(day) * THREE.MathUtils.smoothstep(night, 0.7, 0.95) * (1 - THREE.MathUtils.smoothstep(clouds, 0.3, 0.7));
    this.boost = Math.max(0, this.boost - dt);
    this.group.visible = rate > 0 || this.pool.some((p) => p.mesh.visible);
    if (!this.group.visible) return;
    this.group.position.copy(camera.position);
    this.next -= dt * (this.boost > 0 ? 3.5 : 1);
    if (rate > 0 && this.next <= 0) {
      this.next = (2 + Math.random() * 9) / rate;
      const p = this.pool.find((q) => !q.mesh.visible);
      if (p) this._launch(p, compass);
    }
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.t += dt / p.life;
      if (p.t >= 1 + p.linger) {
        p.mesh.visible = false;
        p.head.visible = false;
        continue;
      }
      // the head runs from start to end; the tail follows a little behind
      const head = Math.min(1, p.t);
      const tail = Math.max(0, head - p.len);
      const a = this._a.copy(p.from).lerp(p.to, tail).normalize().multiplyScalar(SKY);
      const b = this._b.copy(p.from).lerp(p.to, head).normalize().multiplyScalar(SKY);
      const along = b.clone().sub(a);
      // (a train, once the meteor has gone, slowly widening as it drifts)
      const spread = p.t > 1 ? 1 + (p.t - 1) * 2.2 : 1;
      const side = along.clone().cross(b).normalize().multiplyScalar(p.width * spread);
      const pos = p.mesh.geometry.attributes.position;
      // (the tail thinner than the head)
      pos.setXYZ(0, a.x - side.x * 0.35, a.y - side.y * 0.35, a.z - side.z * 0.35);
      pos.setXYZ(1, a.x + side.x * 0.35, a.y + side.y * 0.35, a.z + side.z * 0.35);
      pos.setXYZ(2, b.x + side.x, b.y + side.y, b.z + side.z);
      pos.setXYZ(3, b.x - side.x, b.y - side.y, b.z - side.z);
      pos.needsUpdate = true;
      // bright almost at once, fading as it burns out; a fireball flares as it breaks up near the
      // end, and its train hangs on, glowing green, then fades
      let fade;
      if (p.t < 1) {
        fade = Math.min(1, p.t * 6) * (1 - 0.55 * p.t);
        if (p.fireball) fade *= 1 + 1.6 * Math.exp(-((p.t - 0.8) ** 2) * 90) * (0.7 + 0.3 * Math.sin(p.t * 90));
      } else fade = (1 - (p.t - 1) / p.linger) ** 1.5 * 0.3;
      p.mesh.material.uniforms.uAlpha.value = fade * p.bright;
      if (p.t > 1 && p.fireball) p.mesh.material.uniforms.uColour.value.setRGB(0.45, 1, 0.6);
      // the head's glow, with the streak
      p.head.visible = p.t < 1;
      if (p.head.visible) {
        p.head.position.copy(b);
        p.head.scale.setScalar(p.width * (p.fireball ? 8 : 6));
        p.head.material.opacity = Math.min(1, fade * p.bright * 0.9);
      }
    }
  }

  _launch(p, compass) {
    // the radiant: Perseus, in the north-east, about 40° up early in the night, rising
    const az = THREE.MathUtils.degToRad(45 + compass);
    const radiant = new THREE.Vector3(Math.sin(az) * Math.cos(0.7), Math.sin(0.7), -Math.cos(az) * Math.cos(0.7));
    // a meteor starts some way from the radiant and runs straight away from it
    const off = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize();
    const from = radiant.clone().addScaledVector(off, 0.35 + Math.random() * 0.6).normalize();
    if (from.y < 0.15) from.y = 0.15 + Math.random() * 0.3;
    from.normalize();
    const dir = from.clone().sub(radiant).normalize();
    // most are faint and quick; a few bright; rarely a fireball (the Perseids are fast: a short life)
    const roll = Math.random();
    const fireball = roll < 0.06;
    const bright = fireball ? 2.6 : roll < 0.25 ? 1.6 + Math.random() * 0.6 : 0.75 + Math.random() * 0.6;
    const to = from.clone().addScaledVector(dir, (fireball ? 0.35 : 0.12) + Math.random() * 0.22).normalize();
    Object.assign(p, { from, to, t: 0, fireball, life: (fireball ? 0.9 : 0.22) + Math.random() * 0.45, len: fireball ? 0.55 : 0.3 + Math.random() * 0.3, linger: fireball ? 3.2 : 0.01, width: fireball ? 5 : 1.8 + bright * 1.3, bright });
    // (white, a touch of yellow or blue; a fireball greener)
    const tint = Math.random();
    p.mesh.material.uniforms.uColour.value.setRGB(fireball ? 0.85 : tint < 0.5 ? 1 : 0.9, fireball ? 1 : 0.97, fireball ? 0.7 : tint < 0.5 ? 0.86 : 1);
    p.head.material.color.copy(p.mesh.material.uniforms.uColour.value);
    p.mesh.visible = true;
  }
}

export class Murmuration {
  /**
   * @param {THREE.Scene} scene
   * @param {{ sample: Function }} [sound]
   */
  constructor(scene, sound = null) {
    this.sound = sound;
    const N = 5000;
    this.n = N;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      // a place in the flock: inside a squashed ball, denser in the middle
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.cbrt(Math.random());
      const s = Math.sqrt(1 - u * u);
      this.seed.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r, Math.random()], i * 4);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(0.32 * uScale / -mv.z, 1.0, 6.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          if (dot(q, q) > 0.25) discard;
          gl_FragColor = vec4(0.03, 0.03, 0.035, uFade);
        }`,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.t = 0;
    this.centre = new THREE.Vector3(-40, 25, -16); // (over the woods and the lawn just west of the house)
    this.roam = new THREE.Vector3(18, 4, 12); // (how far its middle wanders)
    this.always = false; // (the Sight: tonight, whatever the luck)
    this.nextRush = 0;
  }

  /** A winter evening at dusk, clear enough: November to February. */
  static season(day) {
    const d = Math.floor(day);
    return d >= 305 || d <= 50;
  }

  update(dt, { day, sunDeg, clouds, rain, scale }) {
    const dusk = sunDeg < 4 && sunDeg > -7;
    const on = (this.always || (Murmuration.season(day) && clouds < 0.6 && rain < 0.2 && Math.sin(Math.floor(day) * 12.9898) > -0.2)) && dusk;
    // (as the light goes they drop into the woods to roost)
    const fade = on ? THREE.MathUtils.smoothstep(sunDeg, -7, -4.5) : 0;
    this.points.visible = fade > 0.01;
    if (!this.points.visible) return;
    this.material.uniforms.uFade.value = fade;
    if (scale) this.material.uniforms.uScale.value = scale;
    this.t += dt;
    const t = this.t;
    // the flock's middle drifts over the fields; its shape folds: a ball that stretches into a
    // ribbon, pours, turns over on itself, splits and joins
    const c = this.centre;
    const cx = c.x + Math.sin(t * 0.05) * this.roam.x;
    const cy = c.y + Math.sin(t * 0.09) * this.roam.y;
    const cz = c.z + Math.cos(t * 0.04) * this.roam.z;
    const sx = 28 + 16 * Math.sin(t * 0.21);
    const sy = 7 + 5 * Math.sin(t * 0.17 + 1);
    const sz = 22 + 14 * Math.cos(t * 0.19);
    const turn = t * 0.12;
    const ct = Math.cos(turn);
    const st = Math.sin(turn);
    const P = this.pos;
    const S = this.seed;
    for (let i = 0; i < this.n; i++) {
      let x = S[i * 4];
      let y = S[i * 4 + 1];
      let z = S[i * 4 + 2];
      const w = S[i * 4 + 3];
      // waves running through the flock (each bird follows its neighbours: a smooth field)
      const wave = Math.sin(x * 2.1 + t * 0.9) * 0.45 + Math.sin(z * 2.7 - t * 0.7) * 0.35;
      y += wave * 0.6 + Math.sin(x * 3.3 + z * 1.7 + t * 1.3) * 0.15;
      x += Math.sin(y * 2.5 + t * 0.6) * 0.3;
      z += Math.sin(x * 1.9 + t * 0.5 + w) * 0.25;
      // the fold: the flock bends round on itself
      const bend = Math.sin(t * 0.3) * 0.9;
      const bx = x * Math.cos(bend * z) - y * Math.sin(bend * z);
      const by = x * Math.sin(bend * z) + y * Math.cos(bend * z);
      const rx = bx * ct - z * st;
      const rz = bx * st + z * ct;
      P[i * 3] = cx + rx * sx;
      P[i * 3 + 1] = cy + by * sy;
      P[i * 3 + 2] = cz + rz * sz;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    // the rush of thousands of wings as it turns
    this.nextRush -= dt;
    if (this.nextRush <= 0 && this.sound?.has?.('starlings')) {
      this.nextRush = 6 + Math.random() * 6;
      this.sound.sample('starlings', new THREE.Vector3(cx, cy, cz), { ref: 60, rolloff: 0.8, max: 900, gain: 0.8 * fade });
    }
  }
}

/** The harvest moon: the full moon nearest the autumn equinox this year (day of the year, from 0), and the hour it rises. */
export function harvestMoon(year) {
  // the day in mid September to mid October when the moon is most nearly opposite the sun at 8 pm
  let best = null;
  for (let d = 248; d <= 290; d++) {
    const m = moonAt(20, d, year);
    const s = sunAt(20, d);
    const md = new THREE.Vector3(Math.cos(m.elevation) * Math.sin(m.azimuth), Math.sin(m.elevation), Math.cos(m.elevation) * Math.cos(m.azimuth));
    const sd = new THREE.Vector3(Math.cos(s.elevation) * Math.sin(s.azimuth), Math.sin(s.elevation), Math.cos(s.elevation) * Math.cos(s.azimuth));
    const full = (1 - md.dot(sd)) / 2;
    const fromEquinox = Math.abs(d - 265);
    const score = full - fromEquinox * 0.002;
    if (!best || score > best.score) best = { day: d, score };
  }
  // the hour it is twenty degrees up, rising, in the evening (clear of the woods round the estate)
  let hours = 19;
  for (let h = 16; h <= 23.9; h += 0.05) {
    if (THREE.MathUtils.radToDeg(moonAt(h, best.day, year).elevation) > 20) {
      hours = h;
      break;
    }
  }
  return { day: best.day, hours };
}
