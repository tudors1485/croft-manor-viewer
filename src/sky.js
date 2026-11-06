// Time of day: sun and moon, sky, stars, fog and the environment light.
// The sun follows its real path for Surrey (51.3° N, 0.3° W) on the chosen day of the
// year, with north at -z (so the front of the house, facing +z, faces south). Clock times
// are local: British Summer Time from late March to late October, GMT otherwise.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const LAT = THREE.MathUtils.degToRad(51.3);
const LON = -0.3;

/** British Summer Time, roughly: the last Sunday of March to the last Sunday of October. */
export const isSummerTime = (day) => day >= 87 && day < 300;

/** The sun's declination (radians) and local clock time of solar noon on day 0..364. */
export function sunDay(day) {
  const decl = THREE.MathUtils.degToRad(23.44) * Math.sin((2 * Math.PI * (284 + day + 1)) / 365);
  // the equation of time: the sun runs up to 16 minutes fast or slow of the clock over the year
  const B = (2 * Math.PI * (day + 1 - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
  const noon = 12 - LON / 15 - eot / 60 + (isSummerTime(day) ? 1 : 0);
  return { decl, noon };
}

/** Sun elevation and azimuth (radians, azimuth clockwise from north) at `hours` on `day`. */
export function sunAt(hours, day = 145) {
  const { decl, noon } = sunDay(day);
  const H = THREE.MathUtils.degToRad((hours - noon) * 15);
  const sinE = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
  const e = Math.asin(sinE);
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(decl) * Math.cos(LAT)) + Math.PI;
  return { elevation: e, azimuth: az };
}

function dirFrom(elevation, azimuth, compass, out) {
  const a = azimuth + compass;
  return out.set(Math.sin(a) * Math.cos(elevation), Math.sin(elevation), -Math.cos(a) * Math.cos(elevation)).normalize();
}

function makeStars(count = 3200) {
  const pos = new Float32Array(count * 3);
  const mag = new Float32Array(count);
  const rnd = mulberry32(7);
  for (let i = 0; i < count; i++) {
    // uniform on the upper hemisphere, a few just below the horizon for hills
    const u = rnd();
    const v = rnd() * 0.97 + 0.03;
    const th = u * Math.PI * 2;
    const y = v;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 1300, y * 1300, Math.sin(th) * r * 1300], i * 3);
    mag[i] = Math.pow(rnd(), 3.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 0 }, uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float mag;
      uniform float uTime;
      uniform float uScale;
      varying float vBright;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.75 + 0.25 * sin(uTime * (1.3 + mag * 3.1) + position.x * 0.37);
        vBright = (0.25 + mag * 1.6) * tw;
        gl_PointSize = (1.2 + mag * 2.6) * uScale;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying float vBright;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vBright * a * uFade, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  return pts;
}

function makeNightDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 0 }, uTwilight: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      uniform float uTwilight;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 horizon = vec3(0.045, 0.075, 0.15);
        vec3 zenith = vec3(0.008, 0.012, 0.035);
        vec3 col = mix(horizon, zenith, pow(h, 0.45)) * uFade;
        // the blue hour: a deeper, brighter blue for the first hour after sunset
        vec3 blueHour = mix(vec3(0.16, 0.24, 0.42), vec3(0.04, 0.07, 0.17), pow(h, 0.6));
        col += blueHour * uTwilight;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -2;
  return dome;
}

function makeMoon() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const glow = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  glow.addColorStop(0, 'rgba(220,228,255,0.55)');
  glow.addColorStop(1, 'rgba(220,228,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 256, 256);
  const disc = g.createRadialGradient(118, 118, 4, 128, 128, 34);
  disc.addColorStop(0, '#fbfbf4');
  disc.addColorStop(1, '#d9dbd2');
  g.fillStyle = disc;
  g.beginPath();
  g.arc(128, 128, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(150,152,160,0.35)';
  for (const [x, y, r] of [[116, 120, 8], [140, 136, 6], [132, 108, 5], [112, 142, 4], [146, 118, 3]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false, transparent: true, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(110);
  s.renderOrder = -1;
  return s;
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TimeOfDay {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.hours = 15;
    this.day = 145; // day of the year, 0 = 1 January (145 = 26 May)
    this.compass = 0;
    this.centre = new THREE.Vector3();
    this.radius = 100;
    this.night = 0; // 0 day .. 1 night
    this.inside = 0; // 0 outdoors .. 1 inside the house (set by the caller each frame)
    this.lamps = 0; // 0 off .. 1 on (lamps come on before sunset)
    this.dusk = 0; // 1 around sunrise and sunset
    // the weather (weather.js): sky cover and thickness, grey overcast, rain, fog, snow falling
    this.weather = { clouds: 0.35, density: 0.45, overcast: 0, rain: 0, fog: 0, snowing: 0 };
    this.windy = 0;

    this.sky = new Sky();
    this.sky.scale.setScalar(3000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    u.cloudCoverage.value = 0.35;
    scene.add(this.sky);

    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(1000);
    this.envSky.material.uniforms.showSunDisc.value = 0;
    this.envSky.material.uniforms.cloudCoverage.value = 0;
    this.envScene.add(this.envSky);
    // fog and heavy weather close in the horizon: a dome inside the sky in the fog's colour
    this.haze = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0xc9d6e2, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.haze.renderOrder = -1;
    this.haze.visible = false;
    scene.add(this.haze);
    // the same veil in the sky that lights the scene, so overcast light is grey, not blue
    this.envHaze = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.haze.material.clone());
    this.envScene.add(this.envHaze);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = null;
    this.lastEnvHours = null;

    this.light = new THREE.DirectionalLight(0xfff1dc, 3.2);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(4096, 4096);
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.03;
    this.light.shadow.radius = 2;
    scene.add(this.light, this.light.target);

    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a5040, 0.7);
    scene.add(this.hemi);

    this.nightDome = makeNightDome();
    scene.add(this.nightDome);
    this.stars = makeStars();
    scene.add(this.stars);
    this.moon = makeMoon();
    scene.add(this.moon);

    this.fog = new THREE.FogExp2(0xc9d6e2, 0.00085);
    scene.fog = this.fog;

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
  }

  setBounds(centre, radius) {
    this.centre.copy(centre);
    this.radius = radius;
    const cam = this.light.shadow.camera;
    cam.left = cam.bottom = -radius;
    cam.right = cam.top = radius;
    cam.near = 1;
    cam.far = radius * 3.2;
    cam.updateProjectionMatrix();
  }

  label() {
    const h = Math.floor(this.hours) % 24;
    const m = Math.floor((this.hours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(force = false) {
    const { elevation, azimuth } = sunAt(this.hours, this.day);
    dirFrom(elevation, azimuth, this.compass, this.sunDir);
    // the moon: opposite side of the sky, fairly high
    dirFrom(THREE.MathUtils.degToRad(32), azimuth + Math.PI + 0.4, this.compass, this.moonDir);

    const deg = THREE.MathUtils.radToDeg(elevation);
    this.night = THREE.MathUtils.smoothstep(-deg, -2, 9); // 0 above the horizon, 1 by 9° below
    this.lamps = THREE.MathUtils.smoothstep(-deg, -9, 3); // on from about 9° up
    this.dusk = Math.max(0, 1 - Math.abs(deg - 2) / 12);

    for (const s of [this.sky, this.envSky]) s.material.uniforms.sunPosition.value.copy(this.sunDir);
    // the weather in the sky: cloud cover, and a grey, hazy sky when it is overcast
    const w = this.weather;
    const oc = w.overcast;
    for (const [s, cover] of [
      [this.sky, w.clouds],
      [this.envSky, w.clouds * 0.85],
    ]) {
      const su = s.material.uniforms;
      su.cloudCoverage.value = cover;
      su.cloudDensity.value = w.density;
      su.turbidity.value = THREE.MathUtils.lerp(4, 6, oc);
      su.rayleigh.value = THREE.MathUtils.lerp(1.2, 0.35, oc);
      su.mieCoefficient.value = THREE.MathUtils.lerp(0.004, 0.014, oc);
      su.cloudSpeed.value = 0.00002 * (1 + 2.5 * this.windy);
    }

    const t = Math.max(0, Math.sin(elevation));
    const sunUp = THREE.MathUtils.smoothstep(deg, -1.5, 4);
    const useMoon = deg < -1;
    const dir = useMoon ? this.moonDir : this.sunDir;
    this.light.position.copy(this.centre).addScaledVector(dir, this.radius * 1.5);
    this.light.target.position.copy(this.centre);
    if (useMoon) {
      this.light.color.set(0x9db4ff);
      this.light.intensity = 0.9 * this.night;
    } else {
      this.light.color.setHSL(0.08, (0.75 - 0.45 * t) * (1 - 0.6 * oc), 0.58 + 0.32 * t);
      // under cloud the sun is dimmed and its shadows go soft and faint
      this.light.intensity = (1.3 + 2.2 * Math.min(1, t * 1.6)) * sunUp * (1 - 0.8 * oc);
    }
    this.light.shadow.intensity = 1 - 0.72 * oc;
    this._sunIntensity = this.light.intensity;
    this._moonLight = useMoon;

    // twilight: the sky keeps lighting the ground for a while after sunset
    const twilight = THREE.MathUtils.smoothstep(deg, -10, 0);
    this._hemiBase = THREE.MathUtils.lerp(0.14, 0.7, twilight) * (1 - 0.2 * this.dusk) * (1 + 0.45 * oc);
    this.applyAmbient(t);

    this.stars.material.uniforms.uFade.value = this.night * (1 - w.clouds * 0.95);
    this.nightDome.material.uniforms.uFade.value = this.night;
    const blueHour = THREE.MathUtils.smoothstep(-deg, 0.5, 3.5) * (1 - THREE.MathUtils.smoothstep(-deg, 7, 13));
    this.nightDome.material.uniforms.uTwilight.value = blueHour;
    this.nightDome.visible = this.night > 0.001 || blueHour > 0.001;
    this.moon.position.copy(this.moonDir).multiplyScalar(1250);
    this.moon.material.opacity = this.night * (1 - oc * 0.9);
    this.moon.visible = this.night > 0.01;

    // fog follows the sky: blue-grey by day, warm at dusk, deep blue at night
    const day = new THREE.Color(0xc9d6e2).lerp(new THREE.Color(0xb9bfc6), oc).lerp(new THREE.Color(0xd0d4d8), w.fog);
    const duskC = new THREE.Color(0xd9a77f);
    const nightC = new THREE.Color(0x0b1224);
    this.fog.color.copy(day).lerp(duskC, this.dusk * 0.6 * (1 - oc)).lerp(nightC, this.night);
    // fog, rain and falling snow thicken the air
    this.fog.density = 0.00085 + 0.019 * w.fog + 0.004 * w.rain + 0.007 * w.snowing;
    // an overcast sky is a grey lid (with only a little of the cloud shapes showing through)
    this.haze.material.color.copy(this.fog.color);
    this.haze.material.opacity = THREE.MathUtils.clamp(w.fog * 0.97 + w.rain * 0.35 + w.snowing * 0.5 + oc * 0.72, 0, 0.97);
    this.haze.visible = this.haze.material.opacity > 0.01;
    this.envHaze.material.color.copy(this.fog.color);
    this.envHaze.material.opacity = THREE.MathUtils.clamp(this.haze.material.opacity * 1.1, 0, 0.98);
    this.envHaze.visible = this.haze.visible;

    // the environment map is the costly part: refresh it every 10 minutes of sky time
    const dayMoved = Math.abs(this.day - (this.lastEnvDay ?? -99)) > 3;
    const skyChanged = Math.abs(w.clouds - (this.lastEnvClouds ?? -1)) > 0.08 || Math.abs(oc - (this.lastEnvOvercast ?? -1)) > 0.08;
    if (force || dayMoved || skyChanged || this.lastEnvHours === null || Math.abs(this.hours - this.lastEnvHours) > 1 / 6) {
      this.lastEnvHours = this.hours;
      this.lastEnvDay = this.day;
      this.lastEnvClouds = w.clouds;
      this.lastEnvOvercast = oc;
      if (this.envTarget) this.envTarget.dispose();
      this.envTarget = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
      this.scene.environment = this.envTarget.texture;
    }
  }

  /** Sky light outdoors; indoors the light has bounced off warm walls, so it is warmer and dimmer. */
  applyAmbient(t = this._t ?? 0.5) {
    this._t = t;
    this._hemiBase = this._hemiBase ?? 0.7;
    const outdoor = this._hemiOut ?? (this._hemiOut = new THREE.Color());
    outdoor.set(this.night > 0.5 ? 0x5a6a9a : 0xcfe0ff).lerp(this._greySky ?? (this._greySky = new THREE.Color(0xd2d7dd)), this.weather.overcast * (1 - this.night));
    const indoor = this._hemiIn ?? (this._hemiIn = new THREE.Color(0xffe6c8));
    this.hemi.color.copy(outdoor).lerp(indoor, this.inside * (1 - this.night));
    this.hemi.groundColor.set(0x5a5040).lerp(this._groundIn ?? (this._groundIn = new THREE.Color(0x7a5a40)), this.inside);
    const env = THREE.MathUtils.lerp(0.35 + 0.5 * t, 0.04, this.night) + 0.2;
    // indoors the sky is mostly hidden: much less sky light, more warm bounce
    // by day the rooms also get the light the sunlit floors, walls and gallery bounce about
    // (there is no real bounce light here), so they keep more of it than at night
    const day = 1 - this.night;
    this.scene.environmentIntensity = env * THREE.MathUtils.lerp(1, THREE.MathUtils.lerp(0.22, 0.34, day), this.inside);
    this.hemi.intensity = this._hemiBase * THREE.MathUtils.lerp(1, 1.25 + 0.3 * t, this.inside * day);
    // and the sun that does come in lands harder, so its patches show against the room
    if (this._sunIntensity !== undefined) this.light.intensity = this._sunIntensity * (this._moonLight ? 1 : THREE.MathUtils.lerp(1, 1.45, this.inside));
  }

  tick(dt) {
    this.sky.material.uniforms.time.value += dt;
    this.stars.material.uniforms.uTime.value += dt;
    this.stars.material.uniforms.uScale.value = this.renderer.getPixelRatio();
  }
}
