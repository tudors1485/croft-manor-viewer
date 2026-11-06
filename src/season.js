// The seasons: one slider for the day of the year. The sun takes its path for that day
// (sky.js); this is the rest of the year: the trees come into leaf in April and May, turn
// in October and are bare by the end of November (each tree a little early or late, see
// the leaf shader in landscape.js); the grass is lush in spring and a little parched by
// late summer; snow lies in the depth of winter; the birds are busiest in spring and the
// crickets only sing in summer.

import * as THREE from 'three';

/** Shared by every shader that changes with the season. */
export const seasonUniforms = {
  uDay: { value: 145 },
  uSnow: { value: 0 },
  uGrassTint: { value: new THREE.Color(1, 1, 1) },
  uWet: { value: 0 }, // rain on the ground (weather.js)
  uIce: { value: 0 }, // the fountain and the assault-course pond frozen over
  // where the sky reaches: the height of the highest surface at each point (materials.js)
  uSkyMap: { value: null },
  uSkyBox: { value: new THREE.Vector4(0, 0, 1, 1) }, // min x, max z, size x, size z
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Day of the year (0 = 1 January) as "26 May". */
export function dateLabel(day) {
  let d = Math.floor(day) % 365;
  let m = 0;
  while (d >= LENGTHS[m]) d -= LENGTHS[m++];
  return `${d + 1} ${MONTHS[m]}`;
}

/** Days between two days of the year, going round the year either way. */
const apart = (a, b) => {
  const d = Math.abs(a - b) % 365;
  return Math.min(d, 365 - d);
};

// the grass through the year: [day, colour multiplier]. Late May is 1, the colour the
// lawn was calibrated to against TRJTA's renders.
const GRASS = [
  [15, [0.82, 0.82, 0.86]],
  [80, [0.9, 0.92, 0.9]],
  [120, [0.97, 1.03, 0.93]],
  [145, [1, 1, 1]],
  [205, [1.02, 0.97, 0.98]],
  [240, [1.1, 0.96, 0.86]],
  [290, [1.0, 0.92, 0.88]],
  [335, [0.88, 0.85, 0.86]],
];

function grassOn(day) {
  const n = GRASS.length;
  for (let i = 0; i < n; i++) {
    const [a, ca] = GRASS[i];
    const [b0, cb] = GRASS[(i + 1) % n];
    const b = b0 <= a ? b0 + 365 : b0; // the last stretch runs across the new year
    const d = day < a ? day + 365 : day;
    if (d >= a && d < b) {
      const t = THREE.MathUtils.smoothstep(d, a, b);
      return ca.map((v, k) => THREE.MathUtils.lerp(v, cb[k], t));
    }
  }
  return GRASS[0][1];
}

/** Everything the year changes, on day 0..364. */
export function seasonAt(day) {
  const ss = THREE.MathUtils.smoothstep;
  // snow lies from about 21 December to early February, deepest in mid-January
  const snow = 1 - ss(apart(day, 12), 22, 34);
  // ponds freeze over in the coldest weeks, from about 20 December to early February
  const ice = 1 - ss(apart(day, 14), 24, 40);
  // birds: the dawn chorus is a spring thing; few sing in winter
  // birds sing from March to late August (the dawn chorus is a spring thing), none in autumn or winter
  const birds = ss(day, 55, 90) * (1 - ss(day, 236, 262)) * (1 + 0.35 * (1 - ss(day, 120, 170)));
  // wind: gusty from autumn through winter, calm in summer
  const windy = 1 - ss(apart(day, 15), 50, 140);
  // crickets: from late April, loudest in high summer, quiet again by late October
  const warm = ss(day, 105, 140) * (1 - ss(day, 268, 300));
  const crickets = warm * (0.6 + 0.4 * ss(day, 150, 195));
  const name = day < 59 || day >= 334 ? 'winter' : day < 151 ? 'spring' : day < 243 ? 'summer' : 'autumn';
  return { day, snow, ice, grass: grassOn(day), birds, crickets, windy, name };
}

/** Snow falling round the camera: big soft flakes of mixed sizes, drifting as they fall (outdoors). */
export class Snowfall {
  constructor(scene, count = 6500) {
    const box = new THREE.Vector3(56, 28, 56);
    const off = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      off.set([Math.random() * box.x, Math.random() * box.y, Math.random() * box.z], i * 3);
      speed[i] = 0.45 + Math.random() * 0.55;
      size[i] = 0.5 + Math.pow(Math.random(), 2) * 1.4; // mostly small, a few big clumps
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(off, 3));
    geo.setAttribute('speed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uAmount: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float speed;
        attribute float size;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uBox;
        uniform float uScale;
        varying float vFade;
        void main() {
          vec3 p = position;
          // flakes fall slowly and flutter: the big ones slowest
          p.y -= uTime * speed / (0.7 + size * 0.3);
          p.x += uTime * 0.35 + sin(uTime * 0.6 + position.z * 0.7) * 1.2 + sin(uTime * 1.7 + position.y) * 0.25;
          p.z += cos(uTime * 0.45 + position.x * 0.6) * 1.0;
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          vFade = smoothstep(0.25, 1.4, d) * (1.0 - smoothstep(16.0, 28.0, d));
          gl_PointSize = uScale * size * 110.0 / max(d, 0.1);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying float vFade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          // a soft, fuzzy flake: a bright middle fading out, not a hard disc
          float a = (smoothstep(0.5, 0.0, r) * 0.75 + smoothstep(0.22, 0.0, r) * 0.25) * vFade * uAmount;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.96, 0.97, 1.0), a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 11;
    scene.add(this.points);
  }

  update(dt, camera, amount, pixelRatio) {
    const u = this.material.uniforms;
    u.uTime.value += dt;
    u.uCam.value.copy(camera.position);
    u.uAmount.value = amount;
    u.uScale.value = pixelRatio;
    this.points.visible = amount > 0.01;
  }
}
