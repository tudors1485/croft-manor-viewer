// The weather, worked out for each day and hour so a date always has the same weather:
// fluffy clouds in spring, clear summer skies, grey overcast winters, showers on about half
// the autumn days and fog on late-autumn mornings, snow in midwinter (see season.js).
// The panel can also set it outright (clear, cloudy, overcast, rain, fog, snow).
//
// Rain itself: streaks falling round the camera, outdoors.

import * as THREE from 'three';

const ss = THREE.MathUtils.smoothstep;
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// smooth noise along one axis (for showers coming and going through the day)
function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
const apart = (a, b) => {
  const d = Math.abs(a - b) % 365;
  return Math.min(d, 365 - d);
};

export const WEATHERS = {
  auto: 'As the season has it',
  clear: 'Clear',
  clouds: 'Fair-weather clouds',
  overcast: 'Overcast',
  rain: 'Rain',
  fog: 'Fog',
  snow: 'Snow',
};

/**
 * @returns {{ clouds:number, density:number, overcast:number, rain:number, fog:number, snowing:number, label:string }}
 *   clouds: sky cover 0..1; density: how thick; overcast: 0 sunny .. 1 grey (dims the sun);
 *   rain, fog, snowing: 0..1
 */
export function weatherAt(day, hours, snow, choice = 'auto') {
  const d = Math.floor(day);
  const winter = 1 - ss(apart(day, 15), 40, 75); // December to February
  const summer = 1 - ss(apart(day, 200), 35, 70);
  const spring = 1 - ss(apart(day, 110), 30, 55);
  const autumn = 1 - ss(apart(day, 300), 35, 60);
  const today = hash(d * 1.37 + 5); // this day's luck
  let w = { clouds: 0.35, density: 0.45, overcast: 0, rain: 0, fog: 0, snowing: 0 };

  if (choice === 'auto') {
    // the season's sky, with some days brighter or greyer than others
    const cover = 0.55 * spring + 0.1 * summer + 0.6 * autumn + 0.95 * winter + 0.35 * (1 - spring - summer - autumn - winter);
    w.clouds = THREE.MathUtils.clamp(cover + (today - 0.5) * 0.35, 0, 1);
    // spring cumulus are thick, fluffy and separate; winter's are a thick grey blanket
    w.density = THREE.MathUtils.clamp(0.45 + 0.25 * spring + 0.4 * winter + 0.2 * autumn, 0, 0.9);
    w.overcast = ss(w.clouds, 0.7, 1.0) * (0.55 + 0.45 * winter);
    // autumn showers: about half the days are wet, and on those it rains on and off
    if (autumn > 0.3 && hash(d * 2.11 + 1) < 0.5) {
      const shower = ss(noise1(d * 7.3 + hours * 0.85), 0.42, 0.62);
      w.rain = shower * autumn;
      w.clouds = Math.max(w.clouds, 0.75 + 0.25 * shower);
      w.overcast = Math.max(w.overcast, 0.5 + 0.45 * shower);
    }
    // late-autumn mornings: fog that lifts by late morning
    const fogSeason = ss(day, 290, 302) * (1 - ss(day, 338, 350));
    if (fogSeason > 0 && hash(d * 3.7 + 9) < 0.45) {
      const morning = 1 - ss(hours, 9.0, 11.8);
      const night = hours < 6 ? ss(hours, 1, 5) : 1;
      w.fog = fogSeason * morning * night;
      w.overcast = Math.max(w.overcast, 0.6 * w.fog);
    }
    // snow falls on some winter days while it lies
    if (snow > 0.5 && hash(d * 4.3 + 2) < 0.6) w.snowing = ss(noise1(d * 5.1 + hours * 0.6), 0.3, 0.55) * snow;
  } else if (choice === 'clear') {
    w = { ...w, clouds: 0.02, density: 0.4 };
  } else if (choice === 'clouds') {
    w = { ...w, clouds: 0.48, density: 0.5 };
  } else if (choice === 'overcast') {
    w = { ...w, clouds: 1, density: 0.85, overcast: 0.9 };
  } else if (choice === 'rain') {
    w = { ...w, clouds: 1, density: 0.9, overcast: 0.95, rain: 1 };
  } else if (choice === 'fog') {
    w = { ...w, clouds: 0.9, density: 0.7, overcast: 0.7, fog: 1 };
  } else if (choice === 'snow') {
    w = { ...w, clouds: 1, density: 0.85, overcast: 0.85, snowing: 1 };
  }
  if (w.snowing > 0) {
    w.clouds = Math.max(w.clouds, 0.9);
    w.overcast = Math.max(w.overcast, 0.75);
  }
  w.label = w.rain > 0.2 ? 'rain' : w.snowing > 0.2 ? 'snow' : w.fog > 0.3 ? 'fog' : w.overcast > 0.6 ? 'overcast' : w.clouds > 0.3 ? 'cloudy' : 'clear';
  return w;
}

/** Rain: streaks falling round the camera, slanted a little by the wind, drawn only outdoors. */
export class Rainfall {
  constructor(scene, count = 4000) {
    const box = new THREE.Vector3(44, 26, 44);
    const pos = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2);
    const speed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * box.x;
      const y = Math.random() * box.y;
      const z = Math.random() * box.z;
      const v = 8 + Math.random() * 3;
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        end[i * 2 + k] = k;
        speed[i * 2 + k] = v;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('end', new THREE.BufferAttribute(end, 1));
    geo.setAttribute('speed', new THREE.BufferAttribute(speed, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uAmount: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float end;
        attribute float speed;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec3 uBox;
        varying float vFade;
        void main() {
          vec3 vel = vec3(0.9, -speed, 0.4);
          vec3 p = position + vel * uTime;
          p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
          p -= vel * end * 0.045; // the streak a drop draws in a camera's exposure
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          vFade = smoothstep(0.4, 2.0, d) * (1.0 - smoothstep(14.0, 22.0, d));
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(vec3(0.74, 0.78, 0.84), 0.45 * vFade * uAmount);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.lines.renderOrder = 11;
    scene.add(this.lines);
  }

  update(dt, camera, amount) {
    const u = this.material.uniforms;
    u.uTime.value = (u.uTime.value + dt) % 1000;
    u.uCam.value.copy(camera.position);
    u.uAmount.value = amount;
    this.lines.visible = amount > 0.01;
  }
}
