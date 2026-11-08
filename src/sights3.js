// Five more sights, each as it really comes in Surrey, each where the house is in the view:
//
// - Fireflies: on warm, still nights from mid-June to late July, after about a quarter past ten, a
//   few of them over the meadow behind the house, drifting, each flashing yellow-green in its own
//   time, a quick bright flash and a slower fade, rising a little as it lights.
// - Night-shining clouds (noctilucent clouds): on some clear nights in June and July, an hour or two
//   after sunset, while the sun is 6 to 16 degrees below the horizon, electric-blue and silver ripples
//   low in the north, 80 km up, still lit by the sun long after the ordinary clouds have gone dark.
// - A comet: a bright one (none is due: this is the Sight's own), low in the west-north-west in the
//   deep dusk of late March: a bright coma, a broad curved yellow-white dust tail and a straighter,
//   fainter blue ion tail, both pointing away from the sun below the horizon.
// - Blossom: in April the trees round the lawns flower, pink and white, before their leaves, and the
//   petals drift down on the breeze (with the daffodils still out in the grass).
// - Snow falling at night: big flakes coming down slowly through still air, lit where they fall
//   through the lamps' light (the floodlights up the front, the lanterns), dark grey elsewhere.

import * as THREE from 'three';
import { sunAt } from './sky.js';

const ss = THREE.MathUtils.smoothstep;
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft round glow (for points). */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The hour on `day` when the sun is `deg` degrees below the horizon after sunset. */
export function duskHour(day, deg) {
  let best = 20;
  for (let h = 15; h < 24; h += 1 / 60) {
    if (THREE.MathUtils.radToDeg(sunAt(h, day).elevation) <= -deg) {
      best = h;
      break;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Fireflies

export class Fireflies {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {(x: number, z: number) => number|null} o.ground
   * @param {THREE.Vector3} [o.at] where they dance: over the meadow behind the house
   */
  constructor(scene, { ground, at = new THREE.Vector3(8, 0, -58) }) {
    this.group = new THREE.Group();
    this.group.name = 'Fireflies';
    this.group.visible = false;
    scene.add(this.group);
    this.always = false;
    this.amount = 0;
    this.t = 0;
    const tex = glowTexture();
    const R = mulberry(19072027);
    this.flies = [];
    for (let i = 0; i < 5; i++) {
      const home = new THREE.Vector3(at.x + (R() - 0.5) * 9, 0, at.z + (R() - 0.5) * 7);
      home.y = (ground(home.x, home.z) ?? 0) + 0.7 + R() * 1.2;
      // the flash: a bright core and a wide soft halo, yellow-green
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xf0ff80, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      core.scale.setScalar(0.2);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xb6f04a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      halo.scale.setScalar(0.62);
      this.group.add(core, halo);
      this.flies.push({
        home,
        core,
        halo,
        p: home.clone(),
        ph: R() * 100,
        sp: 0.35 + R() * 0.35,
        period: 3 + R() * 3.5, // (seconds between flashes, each in its own time)
        next: R() * 4,
        flash: -1,
      });
    }
  }

  /** On warm June and July nights, from about a quarter past ten until half past one. */
  static on(day, hours) {
    const d = Math.floor(day);
    return d >= 162 && d <= 206 && (hours >= 22.25 || hours < 1.5);
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {number} o.hours
   * @param {number} o.night 0..1
   * @param {number} o.rain 0..1
   */
  update(dt, { day, hours, night, rain = 0 }) {
    const want = (this.always || Fireflies.on(day, hours)) && rain < 0.1 ? ss(night, 0.7, 0.95) : 0;
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * (want > this.amount ? 0.8 : 4)));
    this.group.visible = this.amount > 0.01;
    if (!this.group.visible) return;
    this.t += dt;
    const t = this.t;
    for (const f of this.flies) {
      // a slow wandering flight, rising a little as it flashes (as they do: a short climb, lit)
      f.next -= dt;
      if (f.next <= 0) {
        f.flash = 0;
        f.next = f.period * (0.8 + Math.random() * 0.4);
      }
      let glow = 0.03; // (a faint glow between flashes)
      if (f.flash >= 0) {
        f.flash += dt;
        const k = f.flash;
        // quick to light, slower to fade: about half a second in all
        glow = k < 0.12 ? k / 0.12 : Math.max(0.03, Math.exp(-(k - 0.12) * 6));
        if (k > 0.9) f.flash = -1;
      }
      const lift = f.flash >= 0 ? Math.min(1, f.flash * 2) * 0.25 : 0;
      f.p.set(
        f.home.x + Math.sin(t * 0.21 * f.sp + f.ph) * 2.2 + Math.sin(t * 0.53 * f.sp + f.ph * 2) * 0.7,
        f.home.y + Math.sin(t * 0.37 * f.sp + f.ph * 3) * 0.35 + lift,
        f.home.z + Math.cos(t * 0.17 * f.sp + f.ph) * 2.0 + Math.sin(t * 0.61 * f.sp + f.ph * 4) * 0.6,
      );
      f.core.position.copy(f.p);
      f.halo.position.copy(f.p);
      f.core.material.opacity = Math.min(1, glow * 1.4) * this.amount;
      f.halo.material.opacity = glow * 0.6 * this.amount;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The sky's sights: drawn on a sphere at the far plane, behind every hill (as the northern lights)

function skyDome(fragment, uniforms, order = -0.55) {
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.99999;
      }`,
    fragmentShader: fragment,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1250, 96, 48), material);
  mesh.renderOrder = order;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

const NOISE_GLSL = /* glsl */ `
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int k = 0; k < 5; k++) {
      s += a * n2(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return s;
  }
`;

export class NightClouds {
  constructor(scene) {
    this.mesh = skyDome(
      /* glsl */ `
      uniform float uTime;
      uniform float uAmount;
      uniform float uCompass;
      uniform float uSunAz;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
        float az = atan(d.x, -d.z) - uCompass; // 0 = north (-z)
        az = mod(az + 3.14159265, 6.2831853) - 3.14159265;
        // brightest under where the sun is (north-north-west at midsummer), fading along the horizon
        float da = mod(az - uSunAz + 3.14159265, 6.2831853) - 3.14159265;
        float spread = exp(-da * da / 0.9);
        // low in the sky: from just above the horizon to some 20 degrees, the lowest part dimmer
        // (more air to see through, and that part already in the Earth's shadow)
        float band = smoothstep(1.0, 4.0, el) * (1.0 - smoothstep(7.0, 16.0, el + 3.0 * n2(vec2(az * 3.0, 1.0))));
        // the structure: long parallel billows across the sky, a finer herringbone over them, and
        // patches where the cloud is thicker (seen in perspective: the bands crowd near the horizon)
        vec2 p = vec2(az * 22.0, 60.0 / max(el, 1.0));
        float t = uTime * 0.012;
        float warp = fbm(p * vec2(0.12, 0.6) + t);
        float billows = 0.5 + 0.5 * sin(p.x * 1.1 + p.y * 2.2 + warp * 5.0);
        float bones = 0.5 + 0.5 * sin(p.x * 3.4 - p.y * 5.5 + warp * 3.0 + t * 4.0);
        float patches = smoothstep(0.3, 0.68, fbm(p * vec2(0.08, 0.35) - t * 0.6));
        float wisp = patches * (0.35 + 0.65 * pow(billows, 1.6)) * (0.7 + 0.3 * bones);
        // electric blue and silver; warmer and paler low down
        vec3 c = mix(vec3(0.85, 0.82, 0.72), vec3(0.45, 0.72, 1.0), smoothstep(3.0, 11.0, el));
        c = mix(c, vec3(0.92, 0.97, 1.0), pow(wisp, 3.0) * 0.6);
        float a = wisp * band * (0.25 + 0.75 * spread) * uAmount;
        gl_FragColor = vec4(c * a * 1.7, 1.0);
      }`,
      { uTime: { value: 0 }, uAmount: { value: 0 }, uCompass: { value: 0 }, uSunAz: { value: 0 } },
    );
    this.mesh.name = 'Night-shining clouds';
    scene.add(this.mesh);
    this.always = false;
    this.amount = 0;
    this.t = 0;
  }

  /** Some clear nights in June and July (by the day the evening falls on). */
  static night(day) {
    const d = Math.floor(day);
    return d >= 150 && d <= 212 && hash(d * 3.7 + 1.9) < 0.3;
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {THREE.Vector3} o.sunDir the sun's direction (towards it)
   * @param {number} o.clouds the ordinary clouds 0..1
   * @param {number} o.compass the sky's turn (radians)
   */
  update(dt, { day, sunDir, clouds = 0, compass = 0 }) {
    const sunDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1)));
    // lit by the sun from below the horizon: from 6 degrees down, best at 9 to 12, gone past 16
    const lit = ss(-sunDeg, 5, 8.5) * (1 - ss(-sunDeg, 13, 16.5));
    const want = (this.always || NightClouds.night(day)) ? lit * (1 - ss(clouds, 0.25, 0.6)) : 0;
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 1.2));
    this.mesh.visible = this.amount > 0.005;
    if (!this.mesh.visible) return;
    this.t += dt;
    const u = this.mesh.material.uniforms;
    u.uTime.value = this.t;
    u.uAmount.value = this.amount;
    u.uCompass.value = compass;
    // the sun's azimuth from north (the scene's -z), as the shader measures it
    u.uSunAz.value = Math.atan2(sunDir.x, -sunDir.z) - compass;
  }
}

export class Comet {
  constructor(scene) {
    this.mesh = skyDome(
      /* glsl */ `
      uniform float uAmount;
      uniform float uTime;
      uniform vec3 uHead;
      uniform vec3 uSun;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
        if (dot(d, uHead) < 0.8) discard;
        // a frame at the head: along the tail (away from the sun) and across it
        vec3 tail = normalize(-uSun + dot(uSun, uHead) * uHead);
        vec3 across = normalize(cross(uHead, tail));
        vec3 q = d - uHead * dot(d, uHead);
        float u = dot(q, tail); // radians along the tail
        float v = dot(q, across); // radians across it
        float r = length(vec2(u, v));
        // the coma: a bright green-white head with a starlike middle
        float coma = exp(-pow(r / 0.0035, 2.0)) * 2.2 + exp(-pow(r / 0.011, 2.0)) * 0.55 + exp(-r / 0.02) * 0.12;
        vec3 c = vec3(0.86, 1.0, 0.88) * coma;
        float behind = smoothstep(-0.004, 0.012, u);
        // the dust tail: broad and curved (bowed back along the orbit), yellow-white, brightest
        // along its leading edge, fading with distance from the head
        float bend = v - 1.15 * u * u;
        float wd = 0.006 + 0.17 * u;
        float lead = bend > 0.0 ? 1.6 : 0.8; // (a sharper outer edge)
        float dust = exp(-pow(bend * lead / wd, 2.0)) * exp(-u / 0.2) * behind;
        dust *= 0.75 + 0.25 * n2(vec2(u * 60.0, bend / wd * 3.0));
        c += vec3(1.0, 0.9, 0.72) * dust * 0.85;
        // the ion tail: straight away from the sun, narrow, faint blue, in fine streamers that
        // shift slowly
        float wi = 0.0028 + 0.02 * u;
        float streams = 0.55 + 0.45 * n2(vec2(v / wi * 2.5, u * 8.0 - uTime * 0.02));
        float ion = exp(-pow(v / wi, 2.0)) * exp(-u / 0.42) * behind * streams;
        c += vec3(0.38, 0.6, 1.0) * ion * 0.6;
        // the air low down dims it and warms it
        float air = smoothstep(0.0, 7.0, el);
        c *= air * mix(vec3(1.0, 0.7, 0.45), vec3(1.0), smoothstep(3.0, 14.0, el));
        gl_FragColor = vec4(c * uAmount, 1.0);
      }`,
      { uAmount: { value: 0 }, uTime: { value: 0 }, uHead: { value: new THREE.Vector3(0, 0.25, -1).normalize() }, uSun: { value: new THREE.Vector3(0, -1, 0) } },
    );
    this.mesh.name = 'A comet';
    scene.add(this.mesh);
    this.always = false;
    this.amount = 0;
    this.t = 0;
    // where it hangs: west-north-west, 13 degrees up (azimuth clockwise from north)
    this.az = THREE.MathUtils.degToRad(287);
    this.el = THREE.MathUtils.degToRad(13);
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {THREE.Vector3} o.sunDir the sun's direction (towards it)
   * @param {number} o.clouds 0..1
   * @param {number} o.fog 0..1
   * @param {number} o.compass the sky's turn (radians)
   */
  update(dt, { sunDir, clouds = 0, fog = 0, compass = 0 }) {
    const sunDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1)));
    const want = this.always ? ss(-sunDeg, 4, 11) * (1 - ss(clouds, 0.3, 0.7)) * (1 - fog) : 0;
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 1.0));
    this.mesh.visible = this.amount > 0.005;
    if (!this.mesh.visible) return;
    this.t += dt;
    const u = this.mesh.material.uniforms;
    u.uAmount.value = this.amount;
    u.uTime.value = this.t;
    const az = this.az + compass;
    u.uHead.value.set(Math.sin(az) * Math.cos(this.el), Math.sin(this.el), -Math.cos(az) * Math.cos(this.el));
    u.uSun.value.copy(sunDir).normalize();
  }
}

// ---------------------------------------------------------------------------------------------
// Blossom

/** A picture of a spray of blossom: small five-petalled flowers, in clusters, on a clear ground. */
function blossomTexture(pink) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const R = mulberry(pink ? 41 : 43);
  const petal = pink ? ['#f7c6d6', '#f3b2c8', '#fbd9e4', '#eea3bd'] : ['#ffffff', '#fbf6f1', '#f6efe9', '#fff8fb'];
  // a few twigs under the flowers
  g.strokeStyle = 'rgba(70,45,35,0.9)';
  g.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.moveTo(128 + (R() - 0.5) * 60, 250);
    g.quadraticCurveTo(128 + (R() - 0.5) * 140, 140, 128 + (R() - 0.5) * 180, 20 + R() * 60);
    g.stroke();
  }
  for (let i = 0; i < 70; i++) {
    // clustered round a few points, as blossom grows
    const cl = Math.floor(R() * 6);
    const cx = 60 + ((cl * 53) % 140) + (R() - 0.5) * 70;
    const cy = 50 + ((cl * 71) % 150) + (R() - 0.5) * 70;
    const r = 9 + R() * 7;
    g.fillStyle = petal[Math.floor(R() * petal.length)];
    const rot = R() * 6.28;
    for (let p = 0; p < 5; p++) {
      const a = rot + (p / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.55, r * 0.38, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = pink ? '#c2577f' : '#d9c46a';
    g.beginPath();
    g.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Blossom {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {{x:number, z:number, r:number, y0:number, y1:number}[]} o.crowns the trees' crowns
   * @param {THREE.Box3} o.lawn the estate inside its walls
   * @param {(x: number, z: number) => number|null} o.ground
   */
  constructor(scene, { crowns, lawn: L, ground }) {
    this.group = new THREE.Group();
    this.group.name = 'Blossom';
    this.group.visible = false;
    scene.add(this.group);
    this.always = false;
    this.t = 0;
    const R = mulberry(1042027);
    // the smaller trees round the lawns flower (the great oaks by the drive and the gate are only
    // coming into leaf), pink or white
    this.trees = crowns.filter((c) => c.x > L.min.x && c.x < L.max.x && c.z > -50 && c.z < 30 && c.r < 10 && !(Math.abs(c.x - 4) < 12 && c.z > 10));
    const cards = { pink: [], white: [] };
    this.trees.forEach((c, k) => {
      const list = k % 3 === 1 ? cards.white : cards.pink;
      const cy = (c.y0 + c.y1) / 2 + (ground(c.x, c.z) ?? 0);
      const ry = (c.y1 - c.y0) / 2;
      const n = Math.round(c.r * c.r * 30);
      const clump = (v) => Math.sin(v.x * 3.1 + k) * Math.sin(v.y * 2.3 + k * 2.0) * Math.sin(v.z * 2.7 - k) + 0.25 * Math.sin(v.x * 9.0 + v.z * 7.0);
      for (let i = 0; i < n; i++) {
        // over the crown's outside (most of them), some further in
        const a = R() * Math.PI * 2;
        const u = R() * 1.6 - 0.6; // (more on the top half, where the sun is)
        const s = Math.sqrt(Math.max(0, 1 - u * u));
        const depth = 0.72 + 0.3 * Math.pow(R(), 0.4);
        const n3 = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s);
        if (clump(n3) < -0.12 && R() < 0.85) continue; // (gaps between the clumps of flowers)
        const out = 0.62 + 0.42 * R();
        const p = new THREE.Vector3(c.x + n3.x * c.r * 0.84 * depth * out / 0.83, cy + n3.y * ry * 0.95 * depth * out / 0.83, c.z + n3.z * c.r * 0.84 * depth * out / 0.83);
        list.push({ p, n: n3, spin: R() * Math.PI * 2, s: 0.55 + R() * 0.5 });
      }
    });
    const card = new THREE.PlaneGeometry(1, 1);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const look = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [kind, list] of Object.entries(cards)) {
      if (!list.length) continue;
      const mat = new THREE.MeshStandardMaterial({ map: blossomTexture(kind === 'pink'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
      // (lit as the crowns are: from outside in, a little light of their own through the petals)
      mat.emissive = new THREE.Color(kind === 'pink' ? 0x2a1219 : 0x2e2a24);
      mat.color = new THREE.Color(kind === 'pink' ? 0xffffff : 0xfff6ea); // (white blossom is warm, not the sky's blue)
      mat.emissiveMap = mat.map;
      const mesh = new THREE.InstancedMesh(card, mat, list.length);
      list.forEach((b, i) => {
        look.lookAt(new THREE.Vector3(), b.n, Math.abs(b.n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up);
        q.setFromRotationMatrix(look).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.spin));
        m.compose(b.p, q, new THREE.Vector3(b.s, b.s, b.s));
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.cards = cards.pink.length + cards.white.length;
    // the petals coming down: round the camera, drifting with the breeze
    const N = 1400;
    const off = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      off.set([R() * 40, R() * 14, R() * 40], i * 3);
      seed[i] = R();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(off, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.petals = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: 0.2 }, uAmount: { value: 0 }, uScale: { value: 800 }, uLight: { value: 1 } },
        vertexShader: /* glsl */ `
          attribute float seed;
          uniform float uTime;
          uniform vec3 uCam;
          uniform float uWind;
          uniform float uScale;
          varying float vSeed;
          varying float vFade;
          void main() {
            vec3 box = vec3(40.0, 14.0, 40.0);
            vec3 p = position;
            // falling slowly, tumbling, carried on the breeze
            p.y -= uTime * (0.35 + seed * 0.3);
            p.x += uTime * (0.4 + 2.2 * uWind) + sin(uTime * (0.9 + seed) + seed * 30.0) * 0.6;
            p.z += cos(uTime * (0.7 + seed * 0.6) + seed * 20.0) * 0.5 + uTime * 0.3 * uWind;
            p = mod(p - uCam + box * 0.5, box) + uCam - box * 0.5;
            p.y = max(p.y, 0.05);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            vSeed = seed;
            float d = -mv.z;
            vFade = smoothstep(0.3, 1.2, d) * (1.0 - smoothstep(14.0, 20.0, d));
            // (a petal turning: wide face on, thin edge on)
            float turn = 0.35 + 0.65 * abs(sin(uTime * (2.0 + seed * 3.0) + seed * 50.0));
            gl_PointSize = clamp(0.03 * uScale * turn / max(d, 0.1), 1.0, 12.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmount;
          uniform float uLight;
          varying float vSeed;
          varying float vFade;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            // an oval petal
            float r = length(c * vec2(1.0, 1.6));
            float a = smoothstep(0.5, 0.35, r) * vFade * uAmount;
            if (a < 0.02) discard;
            vec3 col = mix(vec3(1.0, 0.86, 0.9), vec3(1.0, 0.97, 0.96), step(0.6, vSeed));
            gl_FragColor = vec4(col * uLight, a);
          }`,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.petals.frustumCulled = false;
    this.petals.renderOrder = 11;
    this.group.add(this.petals);
    this.amount = 0;
  }

  /** In flower from the start of April to about the 25th, best in the middle of the month. */
  static bloom(day) {
    return ss(day, 89, 95) * (1 - ss(day, 110, 116));
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {number} o.wind 0..1
   * @param {number} o.snow snow lying 0..1
   * @param {number} o.daylight 0..1 how light it is (the petals' own colour by day, dim by night)
   * @param {THREE.Camera} o.camera
   * @param {number} [o.scale] the point scale
   */
  update(dt, { day, wind = 0.2, snow = 0, daylight = 1, camera, scale }) {
    const want = (this.always ? Math.max(0.85, Blossom.bloom(day)) : Blossom.bloom(day)) * (snow > 0.4 ? 0 : 1);
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 2));
    this.group.visible = this.amount > 0.02;
    if (!this.group.visible) return;
    this.t += dt;
    const u = this.petals.material.uniforms;
    u.uTime.value = this.t;
    u.uCam.value.copy(camera.position);
    u.uWind.value = wind;
    u.uAmount.value = this.amount * (camera.position.y < 30 ? 1 : 0);
    u.uLight.value = 0.15 + 0.85 * daylight;
    if (scale) u.uScale.value = scale;
  }
}

// ---------------------------------------------------------------------------------------------
// Snow falling at night, lit by the lamps

const MAX_LAMPS = 12;

export class NightSnow {
  constructor(scene, count = 20000) {
    this.always = false;
    this.t = 0;
    const box = new THREE.Vector3(36, 18, 36);
    const R = mulberry(2112027);
    const off = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      off.set([R() * box.x, R() * box.y, R() * box.z], i * 3);
      seed[i] = R();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(off, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.lampPos = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3(0, -999, 0));
    this.lampCol = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3());
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uBox: { value: box },
        uAmount: { value: 0 },
        uScale: { value: 800 },
        uLampPos: { value: this.lampPos },
        uLampCol: { value: this.lampCol },
        uAmbient: { value: new THREE.Vector3(0.1, 0.11, 0.14) },
      },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uBox;
        uniform float uScale;
        uniform vec3 uLampPos[${MAX_LAMPS}];
        uniform vec3 uLampCol[${MAX_LAMPS}];
        uniform vec3 uAmbient;
        varying vec3 vLight;
        varying float vFade;
        void main() {
          vec3 p = position;
          // big flakes coming down slowly through still air, drifting a little, turning
          float size = 0.6 + pow(seed, 3.0) * 1.6;
          p.y -= uTime * (0.55 + 0.35 * fract(seed * 7.3)) / (0.75 + size * 0.25);
          p.x += sin(uTime * (0.35 + seed * 0.4) + seed * 40.0) * 0.45 + sin(uTime * 1.3 + p.y * 0.7) * 0.06;
          p.z += cos(uTime * (0.3 + seed * 0.3) + seed * 25.0) * 0.4;
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          // lit by the lamps they fall past (the floodlights shine upwards: brighter above them)
          vec3 light = uAmbient;
          for (int i = 0; i < ${MAX_LAMPS}; i++) {
            vec3 d = p - uLampPos[i];
            float r2 = dot(d, d);
            float up = 0.55 + 0.45 * smoothstep(-0.5, 2.0, d.y);
            light += uLampCol[i] * up / (1.0 + r2 * 0.22);
          }
          vLight = light;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          vFade = smoothstep(0.3, 1.2, d) * (1.0 - smoothstep(17.0, 24.0, d));
          gl_PointSize = clamp(uScale * size * 0.028 / max(d, 0.1), 1.0, 26.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying vec3 vLight;
        varying float vFade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          float a = (smoothstep(0.5, 0.05, r) * 0.7 + smoothstep(0.2, 0.0, r) * 0.3) * vFade * uAmount;
          if (a < 0.01) discard;
          gl_FragColor = vec4(min(vLight, vec3(2.5)), a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 11;
    scene.add(this.points);
    this.amount = 0;
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.snowing 0..1 the weather's snow
   * @param {number} o.night 0..1
   * @param {number} o.inside 0..1 (none indoors)
   * @param {THREE.Camera} o.camera
   * @param {{ lights: { pos: THREE.Vector3, colour: THREE.Color, on: number, outdoor: boolean }[] }|null} o.lamps
   * @param {number} [o.scale] the point scale
   */
  update(dt, { snowing = 0, night = 0, inside = 0, camera, lamps, scale }) {
    // whenever it snows after dark (and always in its Sight)
    const want = (this.always ? 1 : snowing) * ss(night, 0.4, 0.8) * (1 - inside);
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 1.5));
    this.points.visible = this.amount > 0.01;
    if (!this.points.visible) return;
    this.t += dt;
    const u = this.material.uniforms;
    u.uTime.value = this.t;
    u.uCam.value.copy(camera.position);
    u.uAmount.value = this.amount;
    if (scale) u.uScale.value = scale;
    // the nearest lit lamps outside
    const near = (lamps?.lights ?? [])
      .filter((l) => l.outdoor && l.on > 0.02)
      .map((l) => ({ l, d: l.pos.distanceToSquared(camera.position) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LAMPS);
    for (let i = 0; i < MAX_LAMPS; i++) {
      const n = near[i];
      if (!n) {
        this.lampPos[i].set(0, -999, 0);
        this.lampCol[i].set(0, 0, 0);
        continue;
      }
      this.lampPos[i].copy(n.l.pos);
      const k = n.l.on * (n.l.kind === 'flood' ? 2.2 : 1.6);
      this.lampCol[i].set(n.l.colour.r * k, n.l.colour.g * k, n.l.colour.b * k);
    }
  }
}
