// The weather. By default it is the real weather in Surrey right now (liveweather.js), while
// the viewer keeps time with the real clock. Otherwise it is worked out for each day and hour,
// so a date always has the same weather: fluffy clouds in spring, clear summer skies, grey
// overcast winters, showers on about half the autumn days, fog on still mornings (most often
// in autumn and winter, sometimes in spring, a thin dawn mist now and then in summer), snow in
// midwinter (see season.js), wind that comes and goes (calm days, breezy days, gales in winter),
// and a thunderstorm on a few hot summer afternoons. The panel can also set it outright (clear,
// cloudy, overcast, rain, thunderstorm, fog, snow); the lightning itself is in storm.js.
//
// Rain itself: streaks falling round the camera, outdoors.

import * as THREE from 'three';
import { auroraAt } from './aurora.js';

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
  live: 'The real weather now',
  auto: 'As the season has it',
  clear: 'Clear',
  clouds: 'Fair-weather clouds',
  overcast: 'Overcast',
  rain: 'Rain',
  storm: 'Thunderstorm',
  eerie: 'Storm in the fog',
  fog: 'Fog',
  frost: 'A frosty morning',
  snow: 'Snow',
};

/**
 * @param {object} [live] the real weather now (liveweather.js), for the 'live' choice
 * @returns {{ clouds:number, density:number, overcast:number, rain:number, fog:number, snowing:number, wind:number, storm:number, label:string }}
 *   clouds: sky cover 0..1; density: how thick; overcast: 0 sunny .. 1 grey (dims the sun);
 *   rain, fog, snowing: 0..1; wind: 0 still .. 1 a gale; storm: thunder and lightning, 0..1
 */
export function weatherAt(day, hours, snow, choice = 'auto', live = null) {
  if (choice === 'live') {
    if (live) return finish(fromLive(live));
    choice = 'auto'; // (not loaded, or the clock is not on now)
  }
  const d = Math.floor(day);
  const winter = 1 - ss(apart(day, 15), 40, 75); // December to February
  const summer = 1 - ss(apart(day, 200), 35, 70);
  const spring = 1 - ss(apart(day, 110), 30, 55);
  const autumn = 1 - ss(apart(day, 300), 35, 60);
  const today = hash(d * 1.37 + 5); // this day's luck
  let w = { clouds: 0.35, density: 0.45, overcast: 0, rain: 0, fog: 0, snowing: 0, wind: 0.2, storm: 0 };

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
    // fog on still mornings: most often from late September to December, often in winter
    // (and some winter days it never lifts), sometimes in spring, a thin dawn mist in summer
    const autumnFog = ss(day, 262, 282) * (1 - ss(day, 340, 356));
    const weights = [autumnFog, winter * (1 - autumnFog), spring, summer];
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const chance = (0.45 * weights[0] + 0.3 * weights[1] + 0.18 * weights[2] + 0.06 * weights[3]) / sum;
    if (hash(d * 3.7 + 9) < chance && w.rain < 0.05) {
      // when it lifts: by about 7.30 in summer, 9.30 in spring, 11.30 in autumn, 12.30 in winter
      let lifts = (11.5 * weights[0] + 12.5 * weights[1] + 9.5 * weights[2] + 7.5 * weights[3]) / sum;
      if (weights[1] > 0.5 && hash(d * 6.1 + 4) < 0.2) lifts = 30; // a grey day of freezing fog
      const thick = (1.0 * weights[0] + 0.9 * weights[1] + 0.75 * weights[2] + 0.45 * weights[3]) / sum;
      const morning = 1 - ss(hours, lifts - 2.5, lifts);
      const night = hours < 6 ? ss(hours, 1, 5) : 1;
      w.fog = thick * morning * night;
      w.overcast = Math.max(w.overcast, 0.6 * w.fog);
    }
    // a thunderstorm on a few hot summer afternoons, building from about three and gone by nine
    if (summer > 0.5 && hash(d * 8.3 + 7) < 0.1) {
      const storm = ss(noise1(d * 3.3 + hours * 0.9), 0.35, 0.6) * ss(hours, 14, 15.5) * (1 - ss(hours, 19.5, 21)) * summer;
      if (storm > 0) {
        w.storm = storm;
        w.rain = Math.max(w.rain, storm);
        w.clouds = Math.max(w.clouds, 0.6 + 0.4 * storm);
        w.density = Math.max(w.density, 0.9 * storm);
        w.overcast = Math.max(w.overcast, storm);
        w.fog = 0;
      }
    }
    // snow falls on some winter days while it lies
    if (snow > 0.5 && hash(d * 4.3 + 2) < 0.6) w.snowing = ss(noise1(d * 5.1 + hours * 0.6), 0.3, 0.55) * snow;
    // wind: many days are calm, some breezy, a few blustery (most of those in winter); it
    // drops at night and freshens in the afternoon; rain brings it, fog needs still air
    const gusty = 0.18 + 0.45 * winter + 0.2 * autumn + 0.1 * spring;
    const luck = hash(d * 5.9 + 3);
    w.wind = THREE.MathUtils.clamp(gusty * (0.15 + 1.5 * luck * luck), 0, 1);
    w.wind *= 0.5 + 0.5 * ss(hours, 7, 13) * (1 - ss(hours, 18, 23));
    w.wind = Math.max(w.wind, 0.45 * w.rain, 0.75 * w.storm) * (1 - 0.85 * w.fog);
    // the northern lights' nights are clear (aurora.js), from a little before they come out
    if (auroraAt(day, hours) || auroraAt(day, hours + 1.5)) Object.assign(w, { clouds: Math.min(w.clouds, 0.1), overcast: 0, fog: 0, rain: 0, snowing: 0, storm: 0, wind: Math.min(w.wind, 0.2) });
  } else if (choice === 'clear') {
    w = { ...w, clouds: 0.02, density: 0.4, wind: 0.1 };
  } else if (choice === 'clouds') {
    // big white cumulus in a deep blue sky, as in TRJTA's renders: solid, separate heaps
    w = { ...w, clouds: 0.5, density: 2.0, wind: 0.3, scale: 0.0003, elevation: 0.7 };
  } else if (choice === 'overcast') {
    w = { ...w, clouds: 1, density: 0.85, overcast: 0.9, wind: 0.35 };
  } else if (choice === 'rain') {
    w = { ...w, clouds: 1, density: 0.9, overcast: 0.95, rain: 1, wind: 0.6 };
  } else if (choice === 'storm') {
    w = { ...w, clouds: 1, density: 0.95, overcast: 1, rain: 1, wind: 0.8, storm: 1 };
  } else if (choice === 'eerie') {
    // Halloween's: thunder and lightning in a gale, a thin rain, fog lying on the lawns
    w = { ...w, clouds: 1, density: 0.95, overcast: 0.9, rain: 0.3, wind: 0.85, storm: 0.75, fog: 0.42 };
  } else if (choice === 'frost') {
    // clear and still after a cold night: hoar frost on everything open to the sky, a mist lying
    w = { ...w, clouds: 0.05, density: 0.4, overcast: 0, fog: 0.32, wind: 0, frost: 1 };
  } else if (choice === 'fog') {
    w = { ...w, clouds: 0.9, density: 0.7, overcast: 0.7, fog: 1, wind: 0 };
  } else if (choice === 'snow') {
    w = { ...w, clouds: 1, density: 0.85, overcast: 0.85, snowing: 1, wind: 0.3 };
  }
  return finish(w);
}

function finish(w) {
  if (w.snowing > 0) {
    w.clouds = Math.max(w.clouds, 0.9);
    w.overcast = Math.max(w.overcast, 0.75);
  }
  w.storm = w.storm ?? 0;
  w.label = w.storm > 0.3 && w.fog > 0.3 ? 'storm in the fog' : w.storm > 0.3 ? 'thunderstorm' : w.rain > 0.2 ? 'rain' : w.snowing > 0.2 ? 'snow' : w.fog > 0.3 ? 'fog' : w.overcast > 0.6 ? 'overcast' : w.clouds > 0.3 ? 'cloudy' : 'clear';
  if (w.wind > 0.6 && w.label !== 'fog') w.label += ', windy';
  return w;
}

// WMO weather codes (as Open-Meteo gives them): how hard it rains or snows
const RAIN = { 51: 0.35, 53: 0.5, 55: 0.65, 56: 0.5, 57: 0.65, 61: 0.55, 63: 0.8, 65: 1, 66: 0.7, 67: 0.9, 80: 0.6, 81: 0.85, 82: 1, 95: 1, 96: 1, 99: 1 };
const SNOW = { 71: 0.5, 73: 0.8, 75: 1, 77: 0.4, 85: 0.7, 86: 1 };
// thunderstorms: 95 slight or moderate, 96 and 99 with hail
const STORM = { 95: 0.8, 96: 1, 99: 1 };

/** The real weather (Open-Meteo's current conditions) as the viewer's weather. */
function fromLive(c) {
  const code = c.weather_code;
  const clouds = THREE.MathUtils.clamp((c.cloud_cover ?? 40) / 100, 0, 1);
  const w = {
    clouds,
    density: 0.45 + 0.4 * clouds,
    overcast: ss(clouds, 0.6, 1.0) * 0.9,
    rain: Object.hasOwn(RAIN, code) ? RAIN[code] : 0,
    snowing: Object.hasOwn(SNOW, code) ? SNOW[code] : 0,
    // fog by its code, or mist when you can't see far
    fog: Math.max(code === 45 || code === 48 ? 1 : 0, c.visibility != null ? 1 - ss(c.visibility, 400, 4000) : 0),
    // 6 km/h is still air, 40 km/h a strong wind (and the gusts count)
    wind: THREE.MathUtils.clamp(Math.max(((c.wind_speed_10m ?? 8) - 6) / 34, ((c.wind_gusts_10m ?? 0) - 15) / 50), 0, 1),
    storm: Object.hasOwn(STORM, code) ? STORM[code] : 0,
  };
  if (w.storm) w.overcast = 1;
  if (!w.rain && !w.snowing && (c.precipitation ?? 0) > 0.05) w.rain = 0.4;
  if (w.rain || w.snowing) w.overcast = Math.max(w.overcast, 0.8);
  if (w.fog > 0) w.overcast = Math.max(w.overcast, 0.6 * w.fog);
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
