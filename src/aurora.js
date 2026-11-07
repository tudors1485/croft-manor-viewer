// The northern lights, on a rare clear winter night. Seen from Surrey they need a great storm on
// the sun, so they come on a few nights a winter only, the same nights every year: 7 November,
// 19 January, 2 and 12 February (from dusk until the small hours, and only while the sky is
// clear). They hang low in the north, over the house as you look at it from the drive: a green
// glow along the horizon, red and violet rays standing above it, the curtains folding and
// drifting, brightening and fading.

import * as THREE from 'three';

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The nights with the northern lights (by the day the evening falls on, 0 = 1 January). */
export function auroraNight(day) {
  const d = ((Math.floor(day) % 365) + 365) % 365;
  return (d >= 305 || d <= 75) && hash(d * 17.3 + 8.9) < 0.03;
}

/** Whether they are up at this hour (the evening of an aurora night until five the next morning). */
export function auroraAt(day, hours) {
  return hours >= 12 ? auroraNight(day) && hours >= 18.5 : auroraNight(day - 1) && hours < 5;
}

/** The next aurora night from `day` on. */
export function nextAuroraNight(day) {
  for (let k = 0; k < 366; k++) if (auroraNight(day + k)) return (Math.floor(day) + k) % 365;
  return 310;
}

export class Aurora {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uAmount;
        varying vec3 vDir;
        float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
        float n1(float x) {
          float i = floor(x);
          float f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(h1(i), h1(i + 1.0), f);
        }
        void main() {
          vec3 d = normalize(vDir);
          float el = degrees(asin(clamp(d.y, -1.0, 1.0)));
          float az = atan(d.x, -d.z); // 0 towards the north (-z), the way the house faces from the drive
          float t = uTime;
          // strongest due north, fading to the sides
          float north = 1.0 - smoothstep(0.55, 1.45, abs(az));
          // the curtain's lower edge rises and falls along the horizon, and drifts
          float base = 7.0 + 4.0 * sin(az * 2.6 + t * 0.05) + 3.5 * (n1(az * 5.0 - t * 0.08) - 0.5);
          float above = el - base;
          // its rays: fine vertical streaks that ripple sideways and slide along it
          float fold = az * 34.0 + 2.5 * sin(az * 4.0 + t * 0.21) + t * 0.35;
          float rays = 0.35 + 0.65 * pow(n1(fold), 2.2) * (0.6 + 0.4 * n1(az * 9.0 + t * 0.6));
          // green low down, a sharp lower edge fading upwards; red and violet in the tall rays above
          float green = smoothstep(-1.2, 0.8, above) * exp(-max(above, 0.0) / 7.0);
          float red = smoothstep(2.0, 12.0, above) * exp(-max(above - 12.0, 0.0) / 16.0);
          vec3 c = vec3(0.12, 1.0, 0.42) * green * 1.1 + vec3(0.8, 0.12, 0.42) * red * 0.75 + vec3(0.35, 0.15, 0.8) * red * smoothstep(20.0, 40.0, above) * 0.6;
          // the whole display brightens and fades over minutes
          float pulse = 0.6 + 0.4 * n1(t * 0.05) * (0.7 + 0.3 * sin(t * 0.31));
          float a = north * rays * pulse * uAmount * smoothstep(-0.5, 2.0, el);
          gl_FragColor = vec4(c * a * 0.55, 1.0);
        }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1300, 96, 48), this.material);
    this.mesh.name = 'Northern lights';
    this.mesh.renderOrder = -0.6;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.amount = 0;
  }

  /** `want` 0..1: how strongly they show (they fade in and out slowly). */
  update(dt, camera, want) {
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 0.4));
    this.mesh.visible = this.amount > 0.01;
    if (!this.mesh.visible) return;
    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uAmount.value = this.amount;
    this.mesh.position.copy(camera.position);
  }
}
