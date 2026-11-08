// The intro film (development only, loaded on demand from window.manor.dev.diorama()): the house as a
// miniature on a studio table. The estate is cut down to a block round the house, the gate and the
// fountain (clipping planes), set on cut earth over a walnut plinth with a brass plate, against a
// studio backdrop instead of the sky; its own rain and snow fall on it; and a script per film moves
// the camera, the sun, the season and the weather frame by frame. A page drives it:
//   const d = (await manor.dev.diorama()).setup(manor, 'A'); manor.dev.hold(true);
//   for (each frame) { d.at(t); manor.dev.frame(1 / 30); capture the canvas }

import * as THREE from 'three';

// the block: the house, the forecourt and the fountain, the front wall and the gate
const BOX = { x0: -22, x1: 35, z0: -42, z1: 24 };
const EARTH = 3.2; // how deep the cut earth shows
const PLINTH = 2.2; // the walnut base under it
const HIDDEN = 5; // the layer the sky goes to (the camera doesn't draw it)

const smooth = (a, b, t) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => a + (b - a) * k;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The cut earth's face: a band of turf, then soil in layers with stones and roots. */
function earthTexture() {
  const t = canvasTexture(1024, 256, (g, w, h) => {
    const turf = h * 0.07;
    g.fillStyle = '#3f6a2a';
    g.fillRect(0, 0, w, turf);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${40 + Math.random() * 40},${80 + Math.random() * 50},${25 + Math.random() * 20},0.8)`;
      g.fillRect(Math.random() * w, Math.random() * turf * 1.3, 1.5, 2 + Math.random() * 6);
    }
    const layers = [
      [turf, '#4a3826'],
      [h * 0.32, '#5a4430'],
      [h * 0.55, '#6b5038'],
      [h * 0.78, '#7a6046'],
      [h, '#86705a'],
    ];
    let y = turf;
    for (const [y1, col] of layers.slice(1)) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.013) * 4 + Math.random() * 3);
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.fill();
      y = y1;
    }
    for (let i = 0; i < 520; i++) {
      const r = 1.5 + Math.random() * 5;
      g.fillStyle = `rgba(${130 + Math.random() * 60},${115 + Math.random() * 50},${95 + Math.random() * 40},0.75)`;
      g.beginPath();
      g.ellipse(Math.random() * w, turf + Math.random() * (h - turf), r * 1.3, r, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(60,40,22,0.55)';
    for (let i = 0; i < 70; i++) {
      g.lineWidth = 0.6 + Math.random() * 1.4;
      g.beginPath();
      let x = Math.random() * w;
      let yy = turf;
      g.moveTo(x, yy);
      for (let k = 0; k < 6; k++) g.lineTo((x += (Math.random() - 0.5) * 16), (yy += 4 + Math.random() * 10));
      g.stroke();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Walnut: dark wood with a fine grain. */
function walnutTexture() {
  const t = canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#3b2617';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * h;
      g.strokeStyle = `rgba(${20 + Math.random() * 40},${12 + Math.random() * 20},${6 + Math.random() * 10},${0.25 + Math.random() * 0.35})`;
      g.lineWidth = 0.5 + Math.random() * 2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3);
      g.stroke();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** The brass plate on the front of the plinth. */
function plateTexture() {
  return canvasTexture(1024, 256, (g, w, h) => {
    const b = g.createLinearGradient(0, 0, w, h);
    b.addColorStop(0, '#e2c06e');
    b.addColorStop(0.5, '#b8913f');
    b.addColorStop(1, '#d9b45f');
    g.fillStyle = b;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,48,12,0.7)';
    g.lineWidth = 6;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = 'rgba(60,40,10,0.9)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 104px Georgia, "Times New Roman", serif';
    g.fillText('CROFT MANOR', w / 2, h * 0.44);
    g.font = 'italic 400 34px Georgia, serif';
    g.fillText('Surrey', w / 2, h * 0.76);
  });
}

/** A studio backdrop: a soft sweep, lighter behind the subject, darker at the edges. */
function backdrop(top, bottom, glow) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const lin = g.createLinearGradient(0, 0, 0, h);
    lin.addColorStop(0, top);
    lin.addColorStop(1, bottom);
    g.fillStyle = lin;
    g.fillRect(0, 0, w, h);
    const rad = g.createRadialGradient(w / 2, h * 0.58, 0, w / 2, h * 0.58, w * 0.62);
    rad.addColorStop(0, glow);
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, w, h);
    const vig = g.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
  });
}

function flakeTexture() {
  return canvasTexture(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  });
}

/** The miniature's own rain and snow, falling inside the block. */
class Precipitation {
  constructor(scene) {
    const R = 5000;
    this.R = R;
    this.drops = new Float32Array(R * 3);
    const rainGeo = new THREE.BufferGeometry();
    this.rainPos = new Float32Array(R * 6);
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc4d2e0, transparent: true, opacity: 0.55, depthWrite: false }));
    this.rain.frustumCulled = false;
    const S = 7000;
    this.S = S;
    this.flakes = new Float32Array(S * 4);
    const snowGeo = new THREE.BufferGeometry();
    this.snowPos = new Float32Array(S * 3);
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: flakeTexture(), size: 0.8, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0xffffff }));
    this.snow.frustumCulled = false;
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < R; i++) this.drops.set([rnd(BOX.x0, BOX.x1), rnd(0, 48), rnd(BOX.z0, BOX.z1)], i * 3);
    for (let i = 0; i < S; i++) this.flakes.set([rnd(BOX.x0, BOX.x1), rnd(0, 48), rnd(BOX.z0, BOX.z1), Math.random() * 6.28], i * 4);
    scene.add(this.rain, this.snow);
    this.t = 0;
  }

  update(dt, rain, snow) {
    this.t += dt;
    const nr = Math.round(this.R * rain);
    for (let i = 0; i < nr; i++) {
      let y = this.drops[i * 3 + 1] - 26 * dt;
      if (y < 0) y += 48;
      this.drops[i * 3 + 1] = y;
      const x = this.drops[i * 3];
      const z = this.drops[i * 3 + 2];
      this.rainPos.set([x, y, z, x - 0.12, y + 1.3, z], i * 6);
    }
    this.rain.geometry.setDrawRange(0, nr * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.visible = nr > 0;
    const ns = Math.round(this.S * snow);
    for (let i = 0; i < ns; i++) {
      const ph = this.flakes[i * 4 + 3];
      let y = this.flakes[i * 4 + 1] - 1.7 * dt;
      if (y < 0) y += 48;
      this.flakes[i * 4 + 1] = y;
      this.snowPos.set([this.flakes[i * 4] + Math.sin(this.t * 0.9 + ph) * 0.8, y, this.flakes[i * 4 + 2] + Math.cos(this.t * 0.7 + ph * 1.3) * 0.8], i * 3);
    }
    this.snow.geometry.setDrawRange(0, ns);
    this.snow.geometry.attributes.position.needsUpdate = true;
    this.snow.visible = ns > 0;
  }
}

// The three films: at t seconds (of `length`), where the camera is and what the day is.
// cam: azimuth (degrees round the house, 0 = from the front/south), elevation (degrees), distance (m),
// fov; day (of the year, may be fractional), hours, compass (degrees: turns the sun's path), weather,
// rain and snow (0..1), blur (the miniature's shallow focus, 0..1).
export const FILMS = {
  // A: a turntable, a whole turn round the miniature while a whole year goes by, its days at the
  // door: the bare trees of March come into blossom and leaf (round the back), then at the front a May
  // morning when the hounds come home up the drive to the horse waiting at the door, a summer garden
  // party, autumn and a shower, Halloween at dusk, Christmas Eve in the snow, New Year's midnight with
  // the fireworks; round the back again the winter thaws into spring. It loops without a seam: the
  // camera lingers along the front and swings quickly round the back; each day dissolves into the next.
  A: {
    label: 'Turntable',
    length: 24,
    backdrop: ['#efe9df', '#b9b1a5', 'rgba(255,250,240,0.55)'],
    // the days, in order (t0..t1 seconds; spring wraps round the loop's end)
    segs: [
      { name: 'hunt', t0: 2, t1: 5, at: (u) => ({ day: 132, hours: lerp(8.8, 9.6, u), weather: 'clear', hunt: true }) },
      { name: 'party', t0: 5, t1: 8.5, at: (u) => ({ day: 194, hours: lerp(14.5, 16, u), weather: 'clear', party: true }) },
      { name: 'autumn', t0: 8.5, t1: 10.5, at: (u) => ({ day: lerp(285, 300, u), hours: 14.5, weather: u > 0.3 && u < 0.85 ? 'rain' : 'clear', rain: smooth(0.3, 0.4, u) * (1 - smooth(0.75, 0.85, u)) }) },
      // (the evenings lit as a studio lights a model: brighter than a real dusk)
      { name: 'halloween', t0: 10.5, t1: 13, at: (u) => ({ day: 303, hours: lerp(16.72, 16.95, u), weather: 'clear', exposure: 170, backdrop: 0.42 }) },
      { name: 'christmas', t0: 13, t1: 16, at: (u) => ({ day: 357, hours: lerp(16.05, 16.45, u), weather: 'snow', snow: 0.45, exposure: 160, backdrop: 0.4 }) },
      // (midnight a quarter of the way in: the rockets of the last minutes, then the dozen at once)
      { name: 'nye', t0: 16, t1: 19.6, at: (u) => (u < 0.06 ? { day: 364, hours: lerp(23.996, 23.9999, u / 0.06), weather: 'clear', nye: true, exposure: 40, backdrop: 0.07 } : { day: 0, hours: lerp(0.0001, 0.06, (u - 0.06) / 0.94), weather: 'clear', nye: true, exposure: 40, backdrop: 0.07 }) },
      { name: 'winter', t0: 19.6, t1: 22, at: (u) => ({ day: lerp(4, 64, u), hours: 12.5, weather: u < 0.35 ? 'snow' : 'clear', snow: u < 0.35 ? 0.25 * (1 - smooth(0.25, 0.35, u)) : 0 }) },
      { name: 'spring', t0: 22, t1: 26, at: (u) => ({ day: lerp(64, 132, u), hours: lerp(12, 10, u), weather: 'clear' }) },
    ],
    // the camera: slowly along the front (from the south-west round to the south-east) while the days
    // at the door go by, quickly round the back (a smooth surge of speed), once round in all
    az(t) {
      const tau = t < 2 ? t + 24 : t;
      const v0 = 140 / 17;
      const extra = (360 - v0 * 24) / 3.5;
      const back = tau < 19 ? 0 : (tau - 19) / 2 - (7 / (4 * Math.PI)) * Math.sin((2 * Math.PI * (tau - 19)) / 7);
      return -70 + v0 * (tau - 2) + extra * back;
    },
    // the camera: in close for the hounds coming home to the horse at the door, nearer for the party
    // and for Halloween's drive, further back and higher for the New Year's fireworks (each eased in
    // and out round its day)
    focus: {
      hunt: { dist: 50, el: 15, target: [0, 0.8, -5] },
      party: { dist: 96, el: 21, target: [11, 0, -1] },
      halloween: { dist: 98, el: 19, target: [2, 0, -2] },
      nye: { dist: 205, el: 11, target: [3, 30, -20] },
    },
    cam(t) {
      const tau = t < 2 ? t + 24 : t;
      const base = { dist: 138, el: 24, target: [6, -0.5, -9] };
      let sum = 0;
      const acc = { dist: 0, el: 0, target: [0, 0, 0] };
      for (const g of this.segs) {
        const f = this.focus[g.name];
        if (!f) continue;
        const w = smooth(g.t0 - 0.7, g.t0 + 0.5, tau) * (1 - smooth(g.t1 - 0.5, g.t1 + 0.7, tau));
        if (w <= 0) continue;
        sum += w;
        acc.dist += f.dist * w;
        acc.el += f.el * w;
        for (let i = 0; i < 3; i++) acc.target[i] += f.target[i] * w;
      }
      const k = Math.min(1, sum);
      const n = Math.max(sum, 1e-6);
      return {
        az: this.az(t),
        el: lerp(base.el, acc.el / n, k),
        dist: lerp(base.dist, acc.dist / n, k),
        fov: 30,
        target: base.target.map((v, i) => lerp(v, acc.target[i] / n, k)),
      };
    },
    seg(t) {
      const tau = t < 2 ? t + 24 : t;
      return this.segs.find((g) => tau >= g.t0 && tau < g.t1) ?? this.segs[0];
    },
    state(g, t) {
      const tau = t < 2 ? t + 24 : t;
      const u = Math.min(1, Math.max(0, (tau - g.t0) / (g.t1 - g.t0)));
      const st = g.at(u);
      return {
        cam: this.cam(t),
        compass: lerp(-60, 300, t / this.length),
        rain: 0,
        snow: 0,
        blur: 0.35,
        ...st,
        day: ((st.day % 365) + 365) % 365,
        seg: g.name,
      };
    },
    at(t) {
      return this.state(this.seg(t), t);
    },
    // a dissolve where one day gives way to the next (not where the seasons run on into each other)
    parts(t) {
      const tau = t < 2 ? t + 24 : t;
      const W = 0.22;
      for (let i = 0; i < this.segs.length; i++) {
        const a = this.segs[i];
        const b = this.segs[(i + 1) % this.segs.length];
        const edge = a.t1;
        if (['winter'].includes(a.name)) continue; // (winter runs straight on into spring)
        const d = tau - edge;
        const dd = Math.abs(d) < W ? d : Math.abs(d + 24) < W ? d + 24 : Math.abs(d - 24) < W ? d - 24 : null;
        if (dd === null) continue;
        const k = smooth(-W, W, dd);
        const tA = t - dd - 1e-3; // (each held at its edge)
        const tB = t - dd + 1e-3;
        return [
          { w: 1 - k, s: { ...this.state(a, ((tA % 24) + 24) % 24), cam: this.cam(t) } },
          { w: k, s: { ...this.state(b, ((tB % 24) + 24) % 24), cam: this.cam(t) } },
        ];
      }
      return [{ w: 1, s: this.at(t) }];
    },
  },
  // B: a studio lamp. A dark room, the miniature lit by a lamp swinging from one side to the other
  // as the day runs from dawn to dusk; spring rain, then the snow, and at dusk on Christmas Eve the
  // windows and the lights come on.
  B: {
    label: 'Studio lamp',
    length: 12,
    backdrop: ['#6a707c', '#23262d', 'rgba(200,210,230,0.5)'],
    at(t) {
      const k = t / this.length;
      const winter = t > 6.8;
      return {
        cam: { az: lerp(-18, 12, smooth(0, 12, t)), el: lerp(20, 17, k), dist: lerp(138, 116, smooth(0, 12, t)), fov: 30 },
        day: winter ? 357 : lerp(96, 160, smooth(0, 6.8, t)),
        hours: winter ? lerp(14.2, 16.35, smooth(6.8, 11.5, t)) : lerp(7.6, 17.5, smooth(0, 6.8, t)),
        compass: winter ? lerp(-40, 40, smooth(6.8, 12, t)) : lerp(-90, 70, smooth(0, 6.8, t)),
        weather: t > 2.6 && t < 4.6 ? 'rain' : winter ? 'snow' : 'clear',
        rain: smooth(2.6, 2.9, t) * (1 - smooth(4.2, 4.6, t)),
        snow: smooth(6.8, 7.4, t) * (1 - smooth(9.5, 11, t) * 0.7),
        blur: 0.3,
      };
    },
  },
  // C: from above, a tilt-shift time-lapse: high over the miniature, a slow quarter turn, very
  // shallow focus, the year in four days, each from morning to evening.
  C: {
    label: 'Tilt-shift',
    length: 12,
    backdrop: ['#dfe9f2', '#9fb3c4', 'rgba(255,255,255,0.5)'],
    at(t) {
      const k = t / this.length;
      const q = Math.min(3, Math.floor(t / 3));
      const u = (t - q * 3) / 3;
      const days = [112, 182, 292, 357];
      return {
        cam: { az: lerp(-30, 55, k), el: 42, dist: 172, fov: 26, target: [5, 0, -11], focus: [4, 4, -22] },
        day: days[q],
        hours: q === 3 ? lerp(13.5, 16.6, u) : lerp(9, 18.2, u),
        compass: 0,
        weather: q === 2 && u > 0.45 && u < 0.85 ? 'rain' : q === 3 ? 'snow' : 'clear',
        rain: q === 2 ? smooth(0.45, 0.52, u) * (1 - smooth(0.78, 0.85, u)) : 0,
        snow: q === 3 ? smooth(0, 0.15, u) : 0,
        blur: 0.62,
      };
    },
  },
};

/**
 * Sets the viewer up as the miniature for one of the films.
 * @param {object} manor window.manor
 * @param {'A'|'B'|'C'} id
 */
export function setup(manor, id) {
  const film = FILMS[id];
  const { scene, camera, renderer, tod, quality } = manor;
  const $ = (x) => document.getElementById(x);
  // (nothing over the picture: whatever the stylesheet does with them)
  for (const el of ['panel', 'dock', 'lock-hint', 'crosshair', 'toast', 'loading', 'fade', 'caption', 'countdown', 'tour-stop', 'leave-hint', 'bar-top', 'bar-bottom', 'photo-bar', 'photo-focus', 'video-panel', 'report-panel']) if ($(el)) $(el).style.display = 'none';
  for (const el of document.querySelectorAll('.sfx-menu, .sfx-hud, .sfx-game-credits-btn, .sfx-game-legal')) el.style.display = 'none';
  manor.setMode('orbit');
  manor.orbit.enabled = false;
  quality.adaptive = false;
  // the cut: four planes round the block
  const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -BOX.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), BOX.x1), new THREE.Plane(new THREE.Vector3(0, 0, 1), -BOX.z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), BOX.z1)];
  // (each material gets the cut, not the renderer: the trees standing on the block are left whole,
  // their branches over the edge as a model's would be; those rooted off it are taken away below)
  renderer.localClippingEnabled = true;
  const isTree = (o) => {
    // (the fireworks too: they are placed in their shader, and burst over the block anyway)
    for (let p = o; p; p = p.parent) if (p.name === 'Bonfire Night') return true;
    if (o.isInstancedMesh) for (let p = o; p; p = p.parent) if (p.name === 'Blossom') return true;
    return o.isInstancedMesh && o.parent === manor.landscape?.group && !o.material?.isShaderMaterial;
  };
  const treeMats = new Set();
  scene.traverse((o) => {
    if (isTree(o)) for (const m of [o.material].flat()) treeMats.add(m);
  });
  scene.traverse((o) => {
    if (isTree(o)) return;
    for (const m of [o.material].flat()) {
      if (!m || m.isShaderMaterial || treeMats.has(m) || m.clippingPlanes?.length) continue;
      m.clippingPlanes = planes;
      m.clipShadows = true;
      m.needsUpdate = true;
    }
  });
  // (anything wholly outside the block is hidden: some custom shaders leave out three.js's clipping)
  {
    const keep = new THREE.Box3(new THREE.Vector3(BOX.x0, -1e4, BOX.z0), new THREE.Vector3(BOX.x1, 1e4, BOX.z1));
    const b = new THREE.Box3();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry) return; // (the animals move about: the cut does them)
      if (o.frustumCulled === false && !o.geometry.boundingSphere) return; // (camera-following effects)
      b.setFromObject(o);
      if (!b.isEmpty() && !b.intersectsBox(keep)) o.visible = false;
    });
  }
  // (the trees drawn many at once, and the far woods: those outside the block are taken away)
  {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const crowns = manor.landscape?.crowns ?? [];
    const off = (x, z) => x < BOX.x0 || x > BOX.x1 || z < BOX.z0 || z > BOX.z1;
    const inBlossom = (o) => {
      for (let q = o; q; q = q.parent) if (q.name === 'Blossom') return true;
      return false;
    };
    scene.traverse((o) => {
      if (!o.isInstancedMesh) return;
      o.updateMatrixWorld(true);
      const blossom = inBlossom(o);
      let changed = false;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        p.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
        let gone = off(p.x, p.z);
        if (blossom && crowns.length) {
          // (the tree it flowers on: the nearest crown's trunk decides)
          let best = null;
          let bd = Infinity;
          for (const c of crowns) {
            const d = Math.hypot(c.x - p.x, c.z - p.z);
            if (d < bd) {
              bd = d;
              best = c;
            }
          }
          gone = off(best.x, best.z);
        }
        if (gone) {
          o.setMatrixAt(i, zero);
          changed = true;
        }
      }
      if (changed) o.instanceMatrix.needsUpdate = true;
    });
  }
  // (custom shaders take no notice of clipping planes: the water's reflections, the lamps' glows, the
  // lights, the far woods. Each is given the same cut, in its fragment shader, by world position.)
  const cut = `if (vDioW.x < ${BOX.x0.toFixed(2)} || vDioW.x > ${BOX.x1.toFixed(2)} || vDioW.z < ${BOX.z0.toFixed(2)} || vDioW.z > ${BOX.z1.toFixed(2)}) discard;`;
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (!m.isShaderMaterial || m.isRawShaderMaterial || m.userData.dioCut || isTree(o)) continue;
      m.userData.dioCut = true;
      const before = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        before?.call(m, sh, r);
        sh.vertexShader = sh.vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, (x) => `varying vec3 vDioW;\n${x}\n  { vec4 dioP = vec4(position, 1.0);\n  #ifdef USE_INSTANCING\n  dioP = instanceMatrix * dioP;\n  #endif\n  vDioW = (modelMatrix * dioP).xyz; }`);
        sh.fragmentShader = sh.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, (x) => `varying vec3 vDioW;\n${x}\n  ${cut}`);
      };
      m.customProgramCacheKey = () => 'dio' + (m.uuid ?? '');
      m.needsUpdate = true;
    }
  });
  // the sky to a layer the camera doesn't draw; the backdrop instead; no fog
  for (const o of [tod.sky, tod.haze, tod.nightDome, tod.stars, tod.moon]) if (o) o.layers.set(HIDDEN);
  camera.layers.disable(HIDDEN);
  scene.fog = null;
  scene.background = backdrop(...film.backdrop);
  // the shadows: fitted to the block
  const box = new THREE.Box3(new THREE.Vector3(BOX.x0, -6, BOX.z0), new THREE.Vector3(BOX.x1, 20, BOX.z1));
  const fit = tod.fitShadow.bind(tod);
  tod.fitShadow = (cam) => fit(cam, { inside: 1, house: box });
  // the cut earth and the plinth
  const W = BOX.x1 - BOX.x0;
  const D = BOX.z1 - BOX.z0;
  const cx = (BOX.x0 + BOX.x1) / 2;
  const cz = (BOX.z0 + BOX.z1) / 2;
  const earth = earthTexture();
  const group = new THREE.Group();
  group.name = 'Diorama';
  const face = (len, x, z, ry) => {
    const t = earth.clone();
    t.repeat.set(len / 14, 1);
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, EARTH + 0.08), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    m.position.set(x, 0.06 - (EARTH + 0.08) / 2 + 0.02, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    group.add(m);
  };
  const e = 0.02; // (just inside the cut, so the planes keep it)
  face(W, cx, BOX.z1 - e, 0);
  face(W, cx, BOX.z0 + e, Math.PI);
  face(D, BOX.x1 - e, cz, Math.PI / 2);
  face(D, BOX.x0 + e, cz, -Math.PI / 2);
  const wood = walnutTexture();
  wood.repeat.set(4, 1);
  const walnut = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.38, metalness: 0.05, color: 0xb59a84 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, PLINTH, D - 0.04), walnut);
  base.position.set(cx, -EARTH - PLINTH / 2, cz);
  base.castShadow = base.receiveShadow = true;
  group.add(base);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.18, D - 0.04), walnut);
  lip.position.set(cx, -EARTH - 0.09, cz);
  group.add(lip);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: plateTexture(), metalness: 0.85, roughness: 0.32 }));
  plate.position.set(cx, -EARTH - PLINTH / 2, BOX.z1 - 0.01);
  group.add(plate);
  scene.add(group);
  const precip = new Precipitation(scene);
  // the miniature's shallow focus
  quality.photo.on = true;
  quality.photo.look = 'natural';
  const target = new THREE.Vector3(6, -0.5, -9);
  const set = (el, v, ev = 'input') => {
    const x = $(el);
    if (String(x.value) === String(v)) return;
    x.value = String(v);
    x.dispatchEvent(new Event(ev));
    x.dispatchEvent(new Event('change'));
  };
  let last = null;
  return {
    film,
    length: film.length,
    /** The states to draw at t, and their weights (two where one day dissolves into the next). */
    parts(t) {
      return film.parts ? film.parts(t) : [{ w: 1, s: film.at(t) }];
    },
    /** Puts everything where it is at t seconds into the film (then draw the frame). */
    at(t, dt = 1 / 30) {
      return this.apply(film.at(t), dt);
    },
    /** Puts everything as state s has it (then draw the frame). */
    apply(s, dt = 1 / 30) {
      // the days' doings: the garden party by day, the New Year's rockets, the hounds coming home
      const party = scene.getObjectByName('Garden party')?.userData.sight;
      if (party) {
        party.always = !!s.party;
        if (s.party) party.mode = 'day';
      }
      if (manor.bonfire) {
        manor.bonfire.boost = s.nye ? 3 : 1;
        // (the fireworks' smoke, and the year they write in sparks, read from the lawn; from this far
        // off they are one white blot each)
        manor.bonfire.haze.points.visible = false;
        manor.bonfire.autoYear = false;
        // (the show already going when the film reaches it: the rockets of midnight take two seconds
        // to climb, and the New Year has under four)
        if (s.nye && !this._nyed) {
          this._nyed = true;
          const b = manor.bonfire;
          b.reset();
          b.update(1 / 30, { day: 364, hours: 23.999, level: 0, wind: 0.2, camera });
          for (let i = 0; i < 57; i++) b.update(1 / 30, { day: 0, hours: 0.0001, level: 0, wind: 0.2, camera });
        }
      }
      set('exposure', s.exposure ?? 100);
      const park = manor.park;
      if (park && s.hunt && !this._hunted) {
        this._hunted = true;
        park.hunt(s.day);
        // (on, until the hounds are past the fountain and nearly home: in the shot they come up to the horse at the door)
        for (let i = 0; i < 600 && !(park.hounds?.[0]?.holder.visible && park.hounds[0].holder.position.z < -1); i++) park._updateHunt(0.1, s.day, s.hours, camera);
      }
      if (s.weather !== last?.weather) set('weather', s.weather, 'change');
      manor.setDay(s.day);
      set('time', s.hours.toFixed(3));
      set('sun-azim', Math.round(((s.compass + 540) % 360) - 180));
      target.set(...(s.cam.target ?? [6, -0.5, -9]));
      const az = THREE.MathUtils.degToRad(s.cam.az);
      const el = THREE.MathUtils.degToRad(s.cam.el);
      camera.position.set(target.x + Math.sin(az) * Math.cos(el) * s.cam.dist, target.y + Math.sin(el) * s.cam.dist, target.z + Math.cos(az) * Math.cos(el) * s.cam.dist);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      manor.orbit.target.copy(target); // (the orbit controls aim the camera too, if they update)
      camera.fov = s.cam.fov;
      camera.updateProjectionMatrix();
      quality.photo.focus = camera.position.distanceTo(s.cam.focus ? new THREE.Vector3(...s.cam.focus) : target);
      quality.photo.aperture = s.blur;
      // (the backdrop stays as it is, whatever the eye's adaptation does to the exposure)
      // (the studio dims for the evenings: lights and fireworks show against the dark)
      scene.backgroundIntensity = (s.backdrop ?? 1) / Math.max(0.2, renderer.toneMappingExposure);
      // (no chimney smoke on the miniature: out of scale, and it would not meet itself where the film loops)
      if (manor.garden?.smoke) manor.garden.smoke.points.visible = false;
      precip.snow.material.color.setScalar(0.3 + 0.7 * (1 - tod.night));
      precip.rain.material.opacity = 0.2 + 0.35 * (1 - tod.night);
      precip.update(dt, s.rain, s.snow);
      last = s;
      return s;
    },
  };
}
