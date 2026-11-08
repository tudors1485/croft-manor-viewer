// Two more sights:
//
// - Balloons at dawn: on still summer mornings a few hot-air balloons drift over the estate from the
//   west, one low over the house, the others further off and higher. Each is a real balloon's size
//   (an envelope about 20 m tall, some 2,500 m³), in its own colours: gores between load tapes,
//   bulging a little between them, a dark skirt at the mouth, flying wires down to the burner frame,
//   a wicker basket with a leather rim and people in it. Every so often the pilot burns: a flame
//   roars up into the mouth, lights the envelope from inside, and the balloon climbs a little.
// - A summer garden party: on the east lawn, a white pole marquee (two king poles, a scalloped
//   valance, a windowed wall at the back and the far end, the other sides open, the curtains tied
//   back, guy ropes and pegs), two long tables under it laid with linen to the grass, slatted
//   folding chairs, plates, glasses, cutlery, flowers, candles in hurricane lamps and wine; festoon
//   lights swagged from the king poles, and more strung out over the lawn in front, where two bistro
//   tables stand; a gramophone on a side table plays (a recording, if there is one: `party-music`).
//   At dusk the lights come up and the marquee glows. By day (mode 'day') the party is in full swing
//   and dressed for the afternoon: bunting criss-crossing, parasols over the bistro tables, a bar of
//   lemonade and Pimm's, a cake table, picnic blankets and hampers, striped deckchairs, croquet laid
//   out on the lawn, a string quartet's chairs, stands and instruments on a little dais, balloons
//   tied to the posts, flowers in urns, and the guests' traces: a hat on a chair, glasses half drunk,
//   a napkin dropped on the grass.
//
// The balloons and the marquee are drawn here; the chairs and the bistro tables are James Ray Cock's
// "Outdoor Table Chair Set 01" (Poly Haven, CC0), and the gramophone is Don Carson's (CC BY 3.0), both loaded
// only when the party is on.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A canvas texture. */
function canvasTexture(draw, w, h, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/**
 * Fewer draw calls: a group's plain meshes (its own children, not instanced, not marked `keep`)
 * merged into one mesh a material, in place. A mesh with `userData.tint` takes that colour as
 * vertex colours and goes into the one `tinted` material.
 */
function mergeMeshes(group, tinted = null) {
  const byMat = new Map();
  for (const o of [...group.children]) {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) continue;
    o.updateMatrix();
    const geo = o.geometry.clone().applyMatrix4(o.matrix);
    let mat = o.material;
    if (o.userData.tint !== undefined && tinted) {
      const c = new THREE.Color(o.userData.tint);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      mat = tinted;
    }
    if (!byMat.has(mat)) byMat.set(mat, { geos: [], cast: false, receive: false });
    const e = byMat.get(mat);
    e.geos.push(geo);
    e.cast ||= o.castShadow;
    e.receive ||= o.receiveShadow;
    group.remove(o);
  }
  for (const [mat, { geos, cast, receive }] of byMat) {
    const list = geos.every((g) => g.index) ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const m = new THREE.Mesh(list.length === 1 ? list[0] : mergeGeometries(list), mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
  }
}

function glow() {
  return canvasTexture(
    (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.3, 'rgba(255,220,160,0.6)');
      r.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    },
    64,
    64,
    { srgb: false },
  );
}

// ─── Balloons ────────────────────────────────────────────────────────────────────────────────────

const GORES = 24;
// the envelope's shape, the "natural shape" of a balloon: [radius, height] from the mouth (0) to the
// crown, in metres
const PROFILE = [
  [1.75, 0],
  [2.3, 1.2],
  [3.6, 3],
  [5.6, 5.5],
  [7.3, 8],
  [8.25, 10.5],
  [8.45, 12.4],
  [8.15, 14.5],
  [7.05, 16.5],
  [5.0, 18.2],
  [2.8, 19.2],
  [0.9, 19.6],
  [0, 19.7],
];
const SCHEMES = [
  { kind: 'stripes', colours: ['#c41e2a', '#f3c443'] },
  { kind: 'chevron', base: '#203e86', band: ['#f2efe6', '#c41e2a'] },
  { kind: 'rainbow', colours: ['#d7263d', '#f46036', '#f9c80e', '#3bb273', '#2e86ab', '#5b3c88'] },
  { kind: 'solid', base: '#2b7a4b', crown: '#f2efe6', band: '#f3c443' },
  { kind: 'harlequin', colours: ['#f2efe6', '#7a2c8e'] },
];

let envelopeGeo = null;
/** The envelope: a lathe of the profile, each gore bulging a little between its load tapes. */
function envelopeGeometry() {
  if (envelopeGeo) return envelopeGeo;
  const M = 56;
  const S = GORES * 6;
  const curve = new THREE.CatmullRomCurve3(
    PROFILE.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  );
  const prof = curve.getSpacedPoints(M); // (spaced along the cloth: the panels come out even)
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= M; j++) {
    const v = j / M;
    const { x: r0, y } = prof[j];
    const bulge = 0.032 * THREE.MathUtils.smoothstep(v, 0.04, 0.25) * (1 - THREE.MathUtils.smoothstep(v, 0.86, 0.99));
    for (let i = 0; i <= S; i++) {
      const u = i / S;
      const a = u * Math.PI * 2;
      const r = Math.max(0, r0) * (1 + bulge * Math.sin(Math.PI * ((u * GORES) % 1)));
      pos.push(Math.cos(a) * r, y, -Math.sin(a) * r);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < S; i++) {
      const a = j * (S + 1) + i;
      const b = a + 1;
      const c = a + S + 1;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  envelopeGeo = geo;
  return geo;
}

/** An envelope's fabric: its colours by gore, the panel seams, the load tapes, the dark mouth. */
function envelopeTexture(scheme) {
  return canvasTexture(
    (g, w, h) => {
      const gw = w / GORES;
      const yOf = (v) => (1 - v) * h; // (v: 0 the mouth .. 1 the crown; the canvas's top is the crown)
      if (scheme.kind === 'stripes' || scheme.kind === 'rainbow') {
        for (let i = 0; i < GORES; i++) {
          g.fillStyle = scheme.colours[i % scheme.colours.length];
          g.fillRect(i * gw, 0, gw + 1, h);
        }
      } else if (scheme.kind === 'solid') {
        g.fillStyle = scheme.base;
        g.fillRect(0, 0, w, h);
        g.fillStyle = scheme.crown;
        g.fillRect(0, 0, w, yOf(0.84));
        g.fillStyle = scheme.band;
        g.fillRect(0, yOf(0.57), w, yOf(0.5) - yOf(0.57));
      } else if (scheme.kind === 'chevron') {
        g.fillStyle = scheme.base;
        g.fillRect(0, 0, w, h);
        // a zigzag band round the widest part, two colours, a V to each gore
        for (const [k, colour] of scheme.band.entries()) {
          const top = 0.64 - k * 0.075;
          const t = 0.07;
          const a = 0.05;
          g.fillStyle = colour;
          for (let i = 0; i < GORES; i++) {
            const x0 = i * gw;
            g.beginPath();
            g.moveTo(x0, yOf(top));
            g.lineTo(x0 + gw / 2, yOf(top - a));
            g.lineTo(x0 + gw, yOf(top));
            g.lineTo(x0 + gw, yOf(top - t));
            g.lineTo(x0 + gw / 2, yOf(top - t - a));
            g.lineTo(x0, yOf(top - t));
            g.closePath();
            g.fill();
          }
        }
      } else if (scheme.kind === 'harlequin') {
        g.fillStyle = scheme.colours[0];
        g.fillRect(0, 0, w, h);
        const rows = 10;
        for (let r = 0; r < rows; r++) {
          const v0 = 0.08 + (r / rows) * 0.8;
          const v1 = 0.08 + ((r + 1) / rows) * 0.8;
          for (let i = 0; i < GORES; i++) {
            if ((i + r) % 2 === 0) continue;
            g.fillStyle = scheme.colours[1];
            g.fillRect(i * gw, yOf(v1), gw + 1, yOf(v0) - yOf(v1));
          }
        }
      }
      // each gore a little darker at its edges, where it meets the tapes (the bulge between them)
      for (let i = 0; i < GORES; i++) {
        const grad = g.createLinearGradient(i * gw, 0, (i + 1) * gw, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.18)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(0,0,0,0.18)');
        g.fillStyle = grad;
        g.fillRect(i * gw, 0, gw, h);
      }
      // the panel seams across, and the load tapes up each gore's edge
      g.strokeStyle = 'rgba(0,0,0,0.14)';
      g.lineWidth = 1;
      for (let k = 1; k < 16; k++) {
        g.beginPath();
        g.moveTo(0, yOf(k / 16));
        g.lineTo(w, yOf(k / 16));
        g.stroke();
      }
      g.fillStyle = 'rgba(38,30,24,0.7)';
      for (let i = 0; i <= GORES; i++) g.fillRect(i * gw - 1.3, 0, 2.6, h);
      // the mouth's scorch-proof band, and the parachute vent's edge at the crown
      g.fillStyle = 'rgba(28,22,18,0.9)';
      g.fillRect(0, yOf(0.045), w, h - yOf(0.045));
      g.fillStyle = 'rgba(38,30,24,0.8)';
      g.fillRect(0, yOf(0.985), w, 3);
    },
    1024,
    512,
  );
}

/** Wicker: rows of weavers over and under the stakes. */
function wickerTexture() {
  return canvasTexture(
    (g, w, h) => {
      g.fillStyle = '#5e4224';
      g.fillRect(0, 0, w, h);
      const rowH = 8;
      for (let y = 0, r = 0; y < h; y += rowH, r++) {
        for (let x = (r % 2) * 8 - 8; x < w; x += 16) {
          const grad = g.createLinearGradient(0, y, 0, y + rowH);
          grad.addColorStop(0, '#8f6a3d');
          grad.addColorStop(0.5, '#b88f58');
          grad.addColorStop(1, '#6f4f2c');
          g.fillStyle = grad;
          g.beginPath();
          g.ellipse(x + 8, y + rowH / 2, 8.6, rowH / 2 - 0.4, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.fillStyle = 'rgba(35,22,10,0.35)';
      for (let x = 0; x < w; x += 16) g.fillRect(x - 1, 0, 2, h);
    },
    128,
    128,
    { repeat: [3, 2] },
  );
}

/** The burner's flame: white-yellow at the base, orange, gone at the tip. */
function flameTexture() {
  return canvasTexture(
    (g, w, h) => {
      const v = g.createLinearGradient(0, h, 0, 0);
      v.addColorStop(0, 'rgba(170,200,255,0.9)');
      v.addColorStop(0.08, 'rgba(255,250,225,1)');
      v.addColorStop(0.35, 'rgba(255,205,90,0.9)');
      v.addColorStop(0.75, 'rgba(255,120,30,0.45)');
      v.addColorStop(1, 'rgba(255,80,10,0)');
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      // (streaks up it)
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
        g.fillRect(Math.random() * w, Math.random() * h * 0.7 + h * 0.3, 1 + Math.random() * 2, h * 0.3);
      }
    },
    32,
    128,
    { srgb: false },
  );
}

/** A rod (a cylinder) from a to b. */
function rod(a, b, r, mat) {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

let shared = null;
function balloonParts() {
  if (shared) return shared;
  shared = {
    wicker: new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.95 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x3f2616, roughness: 0.55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.85, roughness: 0.35 }),
    wire: new THREE.LineBasicMaterial({ color: 0x1d1a17 }),
    flame: new THREE.MeshBasicMaterial({ map: flameTexture(), color: new THREE.Color(2.0, 1.5, 1.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    glow: glow(),
    skin: ['#e0b99a', '#c69276', '#8d5a3f', '#f1cfb3'],
    jacket: ['#2d3e50', '#7a2e2e', '#3d5a3a', '#c9b38a', '#1d1d24'],
    people: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
  };
  return shared;
}

/** One balloon: its group's origin is the envelope's mouth; the basket hangs 4.5 to 5.7 m below. */
function balloon(scheme, seed) {
  const P = balloonParts();
  const g = new THREE.Group();
  const burn = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ map: envelopeTexture(scheme), roughness: 0.8, side: THREE.DoubleSide });
  // the burner's flame lights the envelope from inside: the fabric glows, most near the mouth
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBurn = burn;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBurn;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #ifdef USE_MAP
        float hb = 1.0 - smoothstep(0.0, 0.75, vMapUv.y);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.78, 0.5) * uBurn * (0.22 + 0.9 * hb);
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => 'balloon-envelope';
  const env = new THREE.Mesh(envelopeGeometry(), mat);
  env.castShadow = true;
  env.userData.keep = true;
  g.add(env);
  // the skirt: a deep shade of the balloon's own colour
  const deep = new THREE.Color(scheme.base ?? scheme.colours[0]).multiplyScalar(0.32);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.98, 1.5, 32, 1, true).translate(0, -0.75, 0), new THREE.MeshStandardMaterial({ color: deep, roughness: 0.9, side: THREE.DoubleSide }));
  g.add(skirt);
  // the burner frame and the burners, the flexi-rods down to the basket
  const F = -3.3; // (the frame's height)
  const corners = [
    [-0.42, -0.5],
    [0.42, -0.5],
    [0.42, 0.5],
    [-0.42, 0.5],
  ].map(([x, z]) => new THREE.Vector3(x, F, z));
  for (let k = 0; k < 4; k++) g.add(rod(corners[k], corners[(k + 1) % 4], 0.025, P.steel));
  for (const x of [-0.15, 0.15]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.36, 12), P.steel);
    can.position.set(x, F - 0.05, 0);
    g.add(can);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 14), P.steel);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(x, F + 0.12, 0);
    g.add(coil);
  }
  // the basket: wicker, a padded leather rim, the rods up from its corners
  const B = -4.55; // (the rim)
  const bw = 1.25;
  const bd = 1.6;
  const bh = 1.15;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd).translate(0, B - bh / 2, 0), P.wicker);
  basket.castShadow = true;
  g.add(basket);
  const rim = [
    new THREE.Vector3(-bw / 2, B, -bd / 2),
    new THREE.Vector3(bw / 2, B, -bd / 2),
    new THREE.Vector3(bw / 2, B, bd / 2),
    new THREE.Vector3(-bw / 2, B, bd / 2),
  ];
  for (let k = 0; k < 4; k++) {
    g.add(rod(rim[k], rim[(k + 1) % 4], 0.055, P.leather));
    g.add(rod(rim[k].clone().setY(B + 0.02), corners[k], 0.022, P.leather));
  }
  // flying wires: from the load tapes at the mouth down to the frame's corners
  const lines = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * 1.72, 0.02, -Math.sin(a) * 1.72);
    let best = corners[0];
    for (const c of corners) if (c.distanceToSquared(p) < best.distanceToSquared(p)) best = c;
    lines.push(p, best);
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), P.wire));
  // the people in it: the pilot by the burners, two or three passengers
  const R = (k) => Math.abs(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
  const people = [
    [0, 0.5, 1.06],
    [-0.3, -0.4, 1],
    [0.3, -0.42, 0.97],
    [0.32, 0.15, 0.95],
  ].slice(0, 3 + (R(1) > 0.5 ? 1 : 0));
  for (const [k, [x, z, s]] of people.entries()) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.24), P.people);
    body.userData.tint = P.jacket[Math.floor(R(k + 2) * P.jacket.length)];
    body.position.set(x, B + 0.02, z);
    body.scale.setScalar(s);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), P.people);
    head.userData.tint = P.skin[Math.floor(R(k + 7) * P.skin.length)];
    head.position.set(x, B + 0.31 * s, z);
    g.add(body, head);
  }
  // the flame, up from the burners into the mouth, and its glow
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 3.0, 16, 1, true).translate(0, 1.5, 0), P.flame);
  flame.position.y = F + 0.15;
  flame.visible = false;
  flame.userData.keep = true;
  g.add(flame);
  const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.glow, color: new THREE.Color(2.4, 1.5, 0.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  light.position.y = F + 0.6;
  light.scale.set(2.6, 3.4, 1);
  g.add(light);
  mergeMeshes(g, P.people); // (the rods, the burners, the rim, the basket, the people: a mesh each)
  return { group: g, flame, light, burn };
}

// [where it starts along x, the mouth's height, z, metres a second]: the first low over the house,
// the others further off and higher
const FLIGHTS = [
  [-60, 44, -34, 1.25],
  [-150, 92, -125, 1.55],
  [-95, 150, -235, 1.8],
  [-215, 115, 70, 1.45],
  [-40, 215, -390, 2.1],
];

export class Balloons {
  constructor(scene, sound = null) {
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Balloons';
    this.group.userData.sight = this; // (for tests: scene.getObjectByName('Balloons'))
    this.group.visible = false;
    scene.add(this.group);
    this.list = FLIGHTS.map(([x0, y, z, speed], i) => {
      const b = balloon(SCHEMES[i % SCHEMES.length], i + 1);
      this.group.add(b.group);
      return { ...b, x0, y, z, speed, burnIn: 3 + i * 4.5 + Math.random() * 6, roar: 0, vy: 0, dy: 0, spin: Math.random() * 6.28, turn: (Math.random() - 0.5) * 0.02, ph: Math.random() * 10 };
    });
    this.t = 0;
    this.always = false; // (the Sight)
    this._was = false;
  }

  /** Still summer mornings: June to August, at dawn, the odd day. */
  static on(day, hours, wind) {
    const d = Math.floor(day);
    return d >= 150 && d <= 240 && hours > 5 && hours < 9 && wind < 0.25 && Math.sin(d * 7.31) > 0.55;
  }

  update(dt, { day, hours, wind, camera }) {
    // (the Sight chosen: each from the start of its line, the low one coming over the house)
    if (this.always && !this._was) this.t = 0;
    this._was = this.always;
    const on = this.always ? hours > 4.5 && hours < 10 : Balloons.on(day, hours, wind);
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    for (const b of this.list) {
      const x = b.x0 + this.t * b.speed;
      // (round again once over: a long loop out of sight to the east)
      const span = 900;
      const xx = ((((x + 450) % span) + span) % span) - 450;
      // the burner: a few seconds' burn every quarter of a minute or so; it climbs while it burns,
      // and sinks slowly between (sinking too low, the pilot burns sooner)
      b.burnIn -= dt;
      if (b.burnIn <= 0 && b.roar <= 0) {
        b.roar = 2 + Math.random() * 4;
        b.burnIn = b.roar + 12 + Math.random() * 22;
        if (camera.position.distanceTo(b.group.position) < 450) this.sound?.sample?.('balloon-burner', b.group.position.clone().add(new THREE.Vector3(0, -3, 0)), { ref: 30, rolloff: 0.9, max: 900, gain: 0.8 });
      }
      if (b.roar > 0) b.roar -= dt;
      const burning = b.roar > 0;
      b.vy += ((burning ? 0.55 : -0.22) - b.vy) * Math.min(1, dt * 0.35);
      b.dy = THREE.MathUtils.clamp(b.dy + b.vy * dt, -9, 9);
      if (b.dy < -6 && b.burnIn > 1.5) b.burnIn = 0.5 + Math.random();
      b.group.position.set(xx, b.y + b.dy, b.z);
      b.group.rotation.y = b.spin + this.t * b.turn;
      const fl = burning ? 0.8 + 0.2 * Math.sin(this.t * 37 + b.ph) * Math.sin(this.t * 23) : 0;
      b.flame.visible = burning;
      b.flame.scale.set(1, 0.8 + 0.3 * fl, 1);
      b.light.material.opacity = burning ? 0.25 + 0.6 * fl : 0;
      b.burn.value += ((burning ? 0.85 + 0.15 * fl : 0) - b.burn.value) * Math.min(1, dt * 10);
    }
  }
}

// ─── The garden party ────────────────────────────────────────────────────────────────────────────

const W = 7.6; // the marquee: across (x)
const L = 12.8; // and along (z)
const EAVE = 2.45;
const PEAK = 5.4;
const KING = [-L / 4, L / 4]; // the king poles, along the middle
const SIDE_Z = [-6.4, -3.2, 0, 3.2, 6.4]; // the side poles along the long sides
const TABLE_H = 0.76;

/** The roof's height over a point inside the marquee: a cone up each king pole, sagging between. */
function roofY(x, z) {
  const u = Math.min(1, Math.abs(x) / (W / 2));
  const zk = z < 0 ? KING[0] : KING[1];
  const dz = z - zk;
  const outward = Math.sign(dz) === Math.sign(zk);
  const w = Math.abs(dz) / (L / 4) / (outward ? 1 : 1.6);
  const d = Math.min(1, Math.hypot(u, w) * 0.55 + Math.max(u, w) * 0.45);
  return EAVE + (PEAK - EAVE) * Math.pow(1 - d, 1.55);
}

/** Canvas: white, with faint seams. */
function canvasCloth() {
  return canvasTexture(
    (g, w, h) => {
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) {
        g.fillStyle = `rgba(${200 + Math.random() * 40},${195 + Math.random() * 40},${185 + Math.random() * 40},0.08)`;
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 6, 1);
      }
      g.fillStyle = 'rgba(150,140,125,0.22)';
      g.fillRect(0, 0, 2, h);
    },
    128,
    128,
    { repeat: [8, 1] },
  );
}

/** A marquee's window wall: white canvas with arched windows of clear panes, a bay a repeat. */
function windowWall() {
  return canvasTexture(
    (g, w, h) => {
      g.fillStyle = '#f2efe7';
      g.fillRect(0, 0, w, h);
      // (folds down it)
      for (let x = 0; x < w; x += 16) {
        const grad = g.createLinearGradient(x, 0, x + 16, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0.05)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
        grad.addColorStop(1, 'rgba(0,0,0,0.05)');
        g.fillStyle = grad;
        g.fillRect(x, 0, 16, h);
      }
      // two arched windows to a bay, between 0.8 m and 2.05 m up (the wall is the eaves' height)
      const px = h / EAVE;
      for (const cx of [w * 0.27, w * 0.73]) {
        const ww = w * 0.3;
        const y0 = h - 2.05 * px;
        const y1 = h - 0.8 * px;
        g.fillStyle = 'rgba(148,163,172,1)';
        g.beginPath();
        g.moveTo(cx - ww / 2, y1);
        g.lineTo(cx - ww / 2, y0 + ww / 2);
        g.arc(cx, y0 + ww / 2, ww / 2, Math.PI, 0);
        g.lineTo(cx + ww / 2, y1);
        g.closePath();
        g.fill();
        g.strokeStyle = '#f7f5ef';
        g.lineWidth = 4;
        g.stroke();
        g.lineWidth = 3;
        for (const f of [-1 / 6, 1 / 6]) {
          g.beginPath();
          g.moveTo(cx + f * ww, y0 + ww * 0.1);
          g.lineTo(cx + f * ww, y1);
          g.stroke();
        }
        for (const f of [0.45, 0.72]) {
          g.beginPath();
          g.moveTo(cx - ww / 2, y0 + (y1 - y0) * f);
          g.lineTo(cx + ww / 2, y0 + (y1 - y0) * f);
          g.stroke();
        }
      }
    },
    256,
    256,
  );
}

/** The valance's scalloped edge (cut by alphaTest). */
function scallops() {
  return canvasTexture(
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, w, h * 0.55);
      g.beginPath();
      g.arc(w / 2, h * 0.55, w / 2, 0, Math.PI);
      g.fill();
      g.fillStyle = 'rgba(150,140,125,0.35)';
      g.fillRect(0, h * 0.08, w, 2);
    },
    64,
    64,
  );
}

/** Linen: a fine weave. */
function linen() {
  return canvasTexture(
    (g, w, h) => {
      g.fillStyle = '#f5f2eb';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        g.fillStyle = `rgba(0,0,0,${0.015 + Math.random() * 0.02})`;
        g.fillRect(0, y, w, 1);
      }
      for (let x = 0; x < w; x += 2) {
        g.fillStyle = `rgba(0,0,0,${0.01 + Math.random() * 0.015})`;
        g.fillRect(x, 0, 1, h);
      }
    },
    64,
    64,
    { repeat: [12, 4] },
  );
}

/** A tablecloth over a table `w` by `d` at height `h`: the top, and a skirt to the grass in soft folds. */
function tablecloth(w, d, h, mat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d).translate(0, h - 0.006, 0), mat));
  // (the top carries the skirt's attributes too, for merging: no extra attributes on either)
  // the skirt: round the edge (the corners rounded), from the top down to just above the grass
  const rc = 0.04;
  const hw = w / 2 - rc;
  const hd = d / 2 - rc;
  const path = [];
  const seg = (ax, az, bx, bz) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.028));
    for (let i = 0; i < n; i++) path.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  };
  const arc = (cx, cz, a0) => {
    for (let i = 0; i < 6; i++) {
      const a = a0 - (i / 6) * (Math.PI / 2);
      path.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc]);
    }
  };
  seg(-hw, d / 2, hw, d / 2);
  arc(hw, hd, Math.PI / 2);
  seg(w / 2, hd, w / 2, -hd);
  arc(hw, -hd, 0);
  seg(hw, -d / 2, -hw, -d / 2);
  arc(-hw, -hd, -Math.PI / 2);
  seg(-w / 2, -hd, -w / 2, hd);
  arc(-hw, hd, -Math.PI);
  const rows = 6;
  const pos = [];
  const uv = [];
  const idx = [];
  const n = path.length;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const [x, z] = path[i % n];
    const [nx0, nz0] = path[(i + 1) % n];
    const tx = nx0 - x;
    const tz = nz0 - z;
    const tl = Math.hypot(tx, tz) || 1;
    const ox = -tz / tl; // (outward)
    const oz = tx / tl;
    if (i > 0) s += Math.hypot(x - path[(i - 1) % n][0], z - path[(i - 1) % n][1]);
    for (let r = 0; r <= rows; r++) {
      const f = r / rows; // 0 the top .. 1 the hem
      const fold = (0.002 + 0.01 * f) * Math.sin((s / 0.17) * Math.PI * 2 + Math.sin(s * 2.3) * 1.6);
      const out = 0.004 + 0.025 * f * f + fold;
      pos.push(x + ox * out, h - 0.01 - f * (h - 0.06), z + oz * out);
      uv.push(s * 2, f * 2);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < rows; r++) {
      const a = i * (rows + 1) + r;
      const b = a + rows + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
  g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
  return g;
}

/** Instanced meshes: a geometry and material, and the matrices (and colours) for each. */
function instances(geo, mat, list, { colours = null, shadow = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.count = list.length;
  list.forEach((mx, i) => m.setMatrixAt(i, mx));
  if (colours) colours.forEach((c, i) => m.setColorAt(i, c));
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}
const mat4 = (x, y, z, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
const lathe = (pts, n = 16) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    n,
  );

export class GardenParty {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {THREE.Vector3} o.at the middle of the party, on the lawn
   * @param {(x: number, z: number) => number} o.ground
   * @param {{ sample: Function, has?: Function, onStopMusic?: Function }} [o.sound]
   * @param {object[]} [o.obstacles] (the tables, the king poles and the bistro tables are added)
   * @param {(x: number, z: number) => boolean} [o.isGrass] whether there is lawn at a point (the day's
   *   dressing goes only on the lawn)
   */
  constructor(scene, { at, ground, sound = null, obstacles = [], isGrass = () => true }) {
    this.sound = sound;
    this.at = at;
    this.ground = ground;
    this.isGrass = isGrass;
    this.obstacles = obstacles;
    this.mode = 'evening'; // 'day': the afternoon party, dressed for it (built when first wanted)
    this.day = null;
    this.group = new THREE.Group();
    this.group.name = 'Garden party';
    this.group.userData.sight = this;
    this.group.visible = false;
    scene.add(this.group);
    this.always = false;
    this.y0 = ground(at.x, at.z);
    this.group.position.set(at.x, this.y0, at.z); // (everything below is laid out from the middle)
    this.glowPoints = []; // [position (in the group), size, colour]
    this._marquee();
    this._tables();
    this._festoons();
    this._lights();
    mergeMeshes(this.group); // (the poles, the curtains with the roof, the cloths, the posts: a mesh each)
    // their light on the lawn and the cloths: one warm light, in the scene all year (dark)
    this.light = new THREE.PointLight(0xffc27a, 0, 18, 1.6);
    this.light.position.set(at.x, this.y0 + 3.0, at.z + 0.5);
    scene.add(this.light);
    const when = () => this.group.visible;
    for (const tx of [-1.75, 1.75]) obstacles.push({ x: at.x + tx, z: at.z - 1.65, r: 1.2, when }, { x: at.x + tx, z: at.z + 1.65, r: 1.2, when });
    for (const z of KING) obstacles.push({ x: at.x, z: at.z + z, r: 0.3, when });
    for (const [x, z] of this.bistro) obstacles.push({ x: at.x + x, z: at.z + z, r: 0.9, when });
    this.nextMusic = 0;
    // (another scene stops the music: the waltz starts again straight away next time)
    sound?.onStopMusic?.(() => (this.nextMusic = 0));
    this.loaded = false;
  }

  /** The marquee: roof, valance, poles, the windowed walls, the tied-back curtains, guy ropes, pegs. */
  _marquee() {
    const cloth = new THREE.MeshStandardMaterial({ map: canvasCloth(), roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc890, emissiveIntensity: 0 });
    this.cloths = [cloth];
    // the roof: a grid over the rectangle, raised to roofY
    const nx = 28;
    const nz = 52;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = -W / 2 + (W * i) / nx;
        const z = -L / 2 + (L * j) / nz;
        pos.push(x, roofY(x, z), z);
        uv.push(x / W + 0.5, z / L + 0.5);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const roof = new THREE.Mesh(geo, cloth);
    roof.castShadow = true;
    this.group.add(roof);
    // the valance, all round under the eaves
    const scal = scallops();
    const strip = (len, x, z, ry) => {
      const t = scal.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(len / 0.5, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.34), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc890, emissiveIntensity: 0 }));
      this.cloths.push(m.material);
      m.position.set(x, EAVE - 0.15, z);
      m.rotation.y = ry;
      this.group.add(m);
    };
    strip(L, -W / 2 - 0.012, 0, Math.PI / 2);
    strip(L, W / 2 + 0.012, 0, Math.PI / 2);
    strip(W, 0, -L / 2 - 0.012, 0);
    strip(W, 0, L / 2 + 0.012, 0);
    // the poles: two king poles, with a ball and a pennant on top; the side poles round the edge
    const white = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.55 });
    const gilt = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.3 });
    const pennant = new THREE.MeshStandardMaterial({ color: 0x1f3f8a, side: THREE.DoubleSide, roughness: 0.8 });
    this.flags = [];
    for (const z of KING) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, PEAK + 0.5, 10).translate(0, (PEAK + 0.5) / 2, 0), white);
      p.position.set(0, 0, z);
      p.castShadow = true;
      this.group.add(p);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), gilt);
      ball.position.set(0, PEAK + 0.55, z);
      this.group.add(ball);
      const fg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.28, 0), new THREE.Vector3(0.75, -0.14, 0)]);
      fg.computeVertexNormals();
      const flag = new THREE.Mesh(fg, pennant);
      flag.userData.keep = true;
      flag.position.set(0.04, PEAK + 0.5, z);
      this.group.add(flag);
      this.flags.push(flag);
    }
    // [x, z, which way out (x), which way out (z)]
    const sidePoles = [];
    for (const z of SIDE_Z) for (const x of [-W / 2, W / 2]) sidePoles.push([x, z, x > 0 ? 1 : -1, 0]);
    for (const z of [-L / 2, L / 2]) sidePoles.push([0, z, 0, Math.sign(z)]);
    for (const [x, z] of sidePoles) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, EAVE, 8).translate(0, EAVE / 2, 0), white);
      p.position.set(x, 0, z);
      p.castShadow = true;
      this.group.add(p);
    }
    this.sidePoles = sidePoles;
    // the walls: the back (+x) and the far end (-z), with windows; the other sides open
    const wallTex = windowWall();
    const wall = (len, x, z, ry) => {
      const t = wallTex.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(len / 3.2, 1);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, EAVE), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffc890, emissiveIntensity: 0 }));
      this.cloths.push(m.material);
      m.position.set(x, EAVE / 2, z);
      m.rotation.y = ry;
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    };
    wall(L, W / 2, 0, -Math.PI / 2);
    wall(W, 0, -L / 2, 0);
    // the curtains of the open sides, gathered and tied back at each pole
    const tie = lathe(
      [
        [0.02, 0],
        [0.08, 0.03],
        [0.1, 0.3],
        [0.055, 1.0],
        [0.04, 1.12],
        [0.07, 1.4],
        [0.12, EAVE - 0.35],
        [0.1, EAVE - 0.1],
        [0.02, EAVE - 0.08],
      ],
      12,
    );
    const curtain = (x, z) => {
      const m = new THREE.Mesh(tie, cloth);
      m.position.set(x, 0, z);
      m.scale.set(1, 1, 0.7);
      m.castShadow = true;
      this.group.add(m);
    };
    for (const [x, z] of sidePoles) {
      if (x > 0 || z < -L / 2 + 0.1) continue; // (the walled sides)
      if (x === 0) for (const s of [-0.25, 0.25]) curtain(s, z - 0.08);
      else curtain(x + 0.08, z + (z > 0 ? -0.25 : 0.25));
    }
    // guy ropes out from each side pole's top to its peg (the corners pull out both ways)
    const rope = [];
    const pegs = [];
    for (const [x, z, ox, oz] of sidePoles) {
      const outs = [[ox, oz]];
      if (Math.abs(z) === L / 2 && x !== 0) outs.push([0, Math.sign(z)]);
      for (const [dx, dz] of outs) {
        const peg = new THREE.Vector3(x + dx * 1.8, 0.05, z + dz * 1.8);
        rope.push(new THREE.Vector3(x, EAVE - 0.05, z), peg);
        pegs.push(mat4(peg.x, 0.08, peg.z, 0, 1, -dz * 0.35, dx * 0.35));
      }
    }
    this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rope), new THREE.LineBasicMaterial({ color: 0xcfc6b2 })));
    this.group.add(instances(new THREE.CylinderGeometry(0.018, 0.012, 0.24, 6), new THREE.MeshStandardMaterial({ color: 0x3a3634, metalness: 0.6, roughness: 0.5 }), pegs));
  }

  /** The two long tables under the marquee, laid; a side table for the gramophone, a drinks table. */
  _tables() {
    const H = TABLE_H;
    const linenMat = new THREE.MeshStandardMaterial({ map: linen(), roughness: 0.92, side: THREE.DoubleSide });
    const tables = [-1.75, 1.75];
    for (const tx of tables) {
      for (const m of [...tablecloth(0.95, 6.6, H, linenMat).children]) {
        m.position.x += tx;
        this.group.add(m);
      }
    }
    // the side tables, round, clothed to the grass: the gramophone's and the drinks
    const round = lathe(
      [
        [0, H],
        [0.42, H],
        [0.44, H - 0.02],
        [0.46, H - 0.2],
        [0.5, 0.25],
        [0.53, 0.04],
        [0.53, 0.02],
      ],
      36,
    );
    const drinksAt = [2.35, 5.0];
    for (const [x, z] of [[-2.55, 5.3], drinksAt]) {
      const m = new THREE.Mesh(round, linenMat);
      m.position.set(x, 0, z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
    }
    this.gramophoneAt = new THREE.Vector3(-2.55, H, 5.3);
    this.musicAt = new THREE.Vector3(this.at.x - 2.55, this.y0 + 1.2, this.at.z + 5.3);
    this.gramophoneMusicAt = this.musicAt.clone();
    // the place settings: a plate, a napkin on it, a knife and fork, a glass
    const seats = [];
    for (const tx of tables) for (let k = 0; k < 6; k++) for (const side of [-1, 1]) seats.push([tx, -2.75 + k * 1.1, side]);
    this.seats = seats;
    const plates = [];
    const napkins = [];
    const cutlery = [];
    const glasses = [];
    for (const [tx, z, side] of seats) {
      const x = tx + side * 0.3;
      plates.push(mat4(x, H, z));
      napkins.push(mat4(x + side * 0.01, H + 0.016, z, 0.15 * side));
      cutlery.push(mat4(x, H + 0.003, z - 0.17), mat4(x, H + 0.003, z + 0.17));
      glasses.push(mat4(x - side * 0.17, H, z + 0.16));
    }
    // (on the drinks table: glasses round the bottles)
    for (let i = 0; i < 9; i++) glasses.push(mat4(drinksAt[0] + Math.cos(i * 0.7 + 0.3) * 0.32, H, drinksAt[1] + Math.sin(i * 0.7 + 0.3) * 0.32));
    const china = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.22 });
    const plate = lathe(
      [
        [0, 0.003],
        [0.09, 0.003],
        [0.12, 0.008],
        [0.135, 0.017],
        [0.133, 0.019],
        [0.117, 0.012],
        [0.09, 0.007],
        [0, 0.007],
      ],
      24,
    );
    this.group.add(instances(plate, china, plates));
    this.group.add(instances(new THREE.BoxGeometry(0.16, 0.012, 0.1), new THREE.MeshStandardMaterial({ color: 0xb7c9ae, roughness: 0.9 }), napkins));
    this.group.add(instances(new THREE.BoxGeometry(0.2, 0.004, 0.017), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 1, roughness: 0.22 }), cutlery));
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xeef4f6, transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
    const wineGlass = lathe([
      [0.034, 0],
      [0.036, 0.004],
      [0.006, 0.009],
      [0.004, 0.085],
      [0.012, 0.09],
      [0.03, 0.105],
      [0.041, 0.135],
      [0.04, 0.165],
      [0.036, 0.19],
    ]);
    this.group.add(instances(wineGlass, glassMat, glasses));
    // down the middle of each table: flowers, candles in hurricane lamps, wine
    const blooms = [];
    const bloomColours = [];
    const bowls = [];
    const lamps = [];
    const bottles = [];
    const palette = [0xffd9d4, 0xfffaf0, 0xf7b9b3, 0xffe6c4, 0xf0d2ee, 0xfffaf0].map((c) => new THREE.Color(c));
    const leaf = new THREE.Color(0x4d6b3c);
    for (const tx of tables) {
      for (const z of [-3.0, -1.1, 1.1, 3.0]) {
        bowls.push(mat4(tx, H, z));
        // (a low mound of small flowers over greenery, spilling over the bowl's rim)
        for (let i = 0; i < 80; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 0.17;
          const isLeaf = i % 3 === 0;
          const y = H + 0.07 + (0.17 - r) * 0.45 + Math.random() * 0.012 - (isLeaf ? 0.025 : 0);
          blooms.push(mat4(tx + Math.cos(a) * r * 0.72, y, z + Math.sin(a) * r, Math.random() * 6, isLeaf ? 0.6 + Math.random() * 0.4 : 0.38 + Math.random() * 0.32, Math.random(), 0));
          bloomColours.push(isLeaf ? leaf : palette[Math.floor(Math.random() * palette.length)]);
        }
      }
      for (const z of [-2.1, 0, 2.1]) {
        lamps.push(mat4(tx, H, z));
        this.glowPoints.push([new THREE.Vector3(tx, H + 0.17, z), 0.07, [1, 0.62, 0.25]]);
      }
      for (const z of [-1.6, 0.55, 2.6]) bottles.push(mat4(tx + 0.12, H, z, Math.random() * 6));
    }
    for (let i = 0; i < 4; i++) bottles.push(mat4(drinksAt[0] + Math.cos(i * 1.6) * 0.12, H, drinksAt[1] + Math.sin(i * 1.6) * 0.12, i));
    this.group.add(instances(new THREE.IcosahedronGeometry(0.03, 0).scale(1, 0.75, 1), new THREE.MeshStandardMaterial({ roughness: 0.8, emissive: 0x201a18 }), blooms, { colours: bloomColours }));
    this.group.add(
      instances(
        lathe([
          [0, 0],
          [0.06, 0],
          [0.075, 0.02],
          [0.09, 0.07],
          [0.085, 0.072],
          [0, 0.072],
        ], 20),
        china,
        bowls,
      ),
    );
    this.group.add(instances(new THREE.CylinderGeometry(0.065, 0.06, 0.26, 16, 1, true).translate(0, 0.13, 0), glassMat, lamps));
    this.candleMat = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.6, emissive: 0xffa040, emissiveIntensity: 0 });
    this.group.add(instances(new THREE.CylinderGeometry(0.028, 0.028, 0.11, 12).translate(0, 0.055, 0), this.candleMat, lamps));
    const bottle = lathe([
      [0, 0],
      [0.037, 0],
      [0.038, 0.2],
      [0.03, 0.235],
      [0.014, 0.26],
      [0.013, 0.3],
      [0.015, 0.305],
      [0, 0.305],
    ]);
    this.group.add(instances(bottle, new THREE.MeshStandardMaterial({ color: 0x173520, roughness: 0.12, metalness: 0.1 }), bottles));
    this.group.add(instances(new THREE.CylinderGeometry(0.0385, 0.0385, 0.07, 14, 1, true).translate(0, 0.11, 0), new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.8 }), bottles));
    // the bistro tables out on the lawn in front (their chairs and tables come with the models)
    this.bistro = [
      [-1.7, 9.0],
      [1.9, 9.4],
    ];
  }

  /** Festoon lights: swagged from the king poles to the side poles inside, and out over the lawn. */
  _festoons() {
    const strings = [];
    const sag = (a, b, drop) => {
      const n = Math.max(2, Math.round(a.distanceTo(b) / 0.45));
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * drop;
        pts.push(p);
      }
      strings.push(pts);
    };
    for (const kz of KING) {
      const top = new THREE.Vector3(0, 4.15, kz);
      for (const [x, z] of this.sidePoles) {
        if (Math.abs(z - kz) > 3.3) continue;
        sag(top, new THREE.Vector3(x * 0.97, EAVE - 0.1, z * 0.99), 0.35);
      }
    }
    // out from the open end over the lawn, to two posts, and between them
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.85 });
    for (const x of [-3.2, 3.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.9, 8).translate(0, 1.45, 0), wood);
      p.position.set(x, 0, 10.5); // (the drive's gravel starts a metre further on)
      p.castShadow = true;
      this.group.add(p);
    }
    const pa = new THREE.Vector3(-3.2, 2.8, 10.5);
    const pb = new THREE.Vector3(3.2, 2.8, 10.5);
    sag(new THREE.Vector3(-W / 2, EAVE - 0.1, L / 2), pa, 0.45);
    sag(new THREE.Vector3(W / 2, EAVE - 0.1, L / 2), pb, 0.45);
    sag(new THREE.Vector3(0, EAVE - 0.1, L / 2), pa, 0.5);
    sag(new THREE.Vector3(0, EAVE - 0.1, L / 2), pb, 0.5);
    sag(pa, pb, 0.6);
    const wire = [];
    const bulbs = [];
    for (const pts of strings) {
      for (let k = 1; k < pts.length; k++) wire.push(pts[k - 1], pts[k]);
      for (let k = 1; k < pts.length - 1; k++) {
        const b = pts[k].clone().add(new THREE.Vector3(0, -0.07, 0));
        bulbs.push(mat4(b.x, b.y, b.z));
        this.glowPoints.push([b, 0.1, [1, 0.78, 0.45]]);
      }
    }
    this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x151310 })));
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2d8, roughness: 0.3, emissive: 0xffc070, emissiveIntensity: 0 });
    this.group.add(instances(new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.25, 1), this.bulbMat, bulbs));
  }

  /** The bulbs' and candles' glow: points, sized by the focal length. */
  _lights() {
    const pts = this.glowPoints;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([p]) => [p.x, p.y, p.z]), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(pts.map(([, s]) => s), 1));
    geo.setAttribute('colour', new THREE.Float32BufferAttribute(pts.flatMap(([, , c]) => c), 3));
    this.lights = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 800 }, uMap: { value: glow() }, uOn: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float size;
          attribute vec3 colour;
          uniform float uScale;
          uniform float uTime;
          varying vec3 vColour;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            float f = size < 0.08 ? 0.85 + 0.15 * sin(uTime * 13.0 + position.z * 9.0) : 1.0;
            vColour = colour * f;
            gl_PointSize = clamp(size * uScale / -mv.z, 1.5, 40.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform float uOn;
          varying vec3 vColour;
          void main() {
            float a = texture2D(uMap, gl_PointCoord).a * uOn;
            gl_FragColor = vec4(vColour * a * 1.6, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.lights.frustumCulled = false;
    this.group.add(this.lights);
  }

  /**
   * The afternoon party's dressing, laid out round the marquee on the lawn (each piece only where
   * there is grass and nothing standing): built the first time a day party is wanted.
   */
  _dressForDay() {
    const g = new THREE.Group();
    g.name = 'Garden party by day';
    this.day = g;
    this.group.add(g);
    const at = this.at;
    const ok = (x, z, r = 0.6) => {
      const wx = at.x + x;
      const wz = at.z + z;
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (!this.isGrass(wx + dx, wz + dz)) return false;
      return !this.obstacles.some((o) => !o.when && Math.hypot(o.x - wx, o.z - wz) < (o.r ?? 0) + r);
    };
    const y = (x, z) => this.ground(at.x + x, at.z + z) - this.y0; // (the lawn's height there, in the group)
    const H = TABLE_H;
    const R = (n) => (Math.random() - 0.5) * n;
    // shared materials (so the pieces merge into a few meshes)
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.55 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.7 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.45 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.3 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.6, roughness: 0.5 });
    const linenMat = new THREE.MeshStandardMaterial({ map: linen(), roughness: 0.92, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xeef4f6, transparent: true, opacity: 0.28, roughness: 0.04, depthWrite: false, side: THREE.DoubleSide });
    const china = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.22 });
    const tinted = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const add = (geo, mat, x, yy, z, ry = 0, tint, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, yy, z);
      m.rotation.set(rx, ry, rz);
      if (tint !== undefined) m.userData.tint = tint;
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const glasses = [];
    const drinks = []; // [matrix, colour]: what is left in the glasses
    const glassAt = (x, yy, z, colour, left = 0.5) => {
      glasses.push(mat4(x, yy, z));
      if (colour !== null) drinks.push([mat4(x, yy + 0.09, z, 0, 1), colour, left]);
    };
    const PIMMS = 0x9a4a1e;
    const LEMON = 0xf3e7a0;
    const FIZZ = 0xf2dd9a;

    // --- parasols over the bistro tables, cream canvas on a wooden pole ---
    const canopy = new THREE.ConeGeometry(1.05, 0.36, 16, 1, true);
    const canvasMat = new THREE.MeshStandardMaterial({ map: canvasCloth(), roughness: 0.85, side: THREE.DoubleSide });
    for (const [x, z] of this.bistro) {
      add(new THREE.CylinderGeometry(0.022, 0.026, 2.2, 8).translate(0, 1.1, 0), wood, x, y(x, z), z);
      add(canopy, canvasMat, x, y(x, z) + 2.1, z, 0.2);
      add(new THREE.SphereGeometry(0.035, 8, 6), wood, x, y(x, z) + 2.31, z);
      // (on each: two glasses, half drunk, and a jug)
      glassAt(x + 0.12, y(x, z) + 0.74, z + 0.08, PIMMS, 0.45);
      glassAt(x - 0.1, y(x, z) + 0.74, z - 0.1, LEMON, 0.3);
    }

    // --- the bar: a long table, clothed, with lemonade and Pimm's, glasses, lemons, an ice bucket ---
    const bar = [5.4, 2.2];
    if (ok(bar[0], bar[1], 1.4)) {
      const cloth = tablecloth(0.75, 2.6, H, linenMat);
      for (const m of [...cloth.children]) {
        m.position.x += bar[0];
        m.position.z += bar[1];
        m.position.y += y(...bar);
        m.userData.keep = false;
        g.add(m);
      }
      const yb = y(...bar) + H;
      // two glass dispensers on stands, lemonade and Pimm's, a tap on each
      const jar = lathe([
        [0, 0],
        [0.11, 0],
        [0.12, 0.03],
        [0.12, 0.3],
        [0.1, 0.33],
        [0, 0.33],
      ], 20);
      const liquid = lathe([
        [0, 0],
        [0.11, 0],
        [0.115, 0.03],
        [0.115, 0.22],
        [0, 0.22],
      ], 20);
      for (const [dz, col] of [[-0.8, LEMON], [-0.3, PIMMS]]) {
        add(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 16).translate(0, 0.06, 0), brass, bar[0], yb, bar[1] + dz);
        add(jar, glassMat, bar[0], yb + 0.12, bar[1] + dz).userData.keep = true;
        add(liquid, new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, transparent: true, opacity: 0.85 }), bar[0], yb + 0.125, bar[1] + dz).userData.keep = true;
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8).rotateZ(Math.PI / 2), brass, bar[0] - 0.14, yb + 0.16, bar[1] + dz);
      }
      // lemons in a bowl, an ice bucket with bottles, rows of glasses
      add(lathe([
        [0, 0],
        [0.09, 0],
        [0.13, 0.06],
        [0.14, 0.08],
        [0, 0.08],
      ], 20), china, bar[0], yb, bar[1] + 0.25);
      for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(0.034, 10, 8).scale(1, 0.85, 1.25), tinted, bar[0] + R(0.14), yb + 0.08 + Math.random() * 0.03, bar[1] + 0.25 + R(0.14), Math.random() * 6, 0xe8cf2a);
      add(lathe([
        [0, 0],
        [0.1, 0],
        [0.12, 0.22],
        [0.125, 0.23],
        [0, 0.23],
      ], 20), new THREE.MeshStandardMaterial({ color: 0xd8dadc, metalness: 1, roughness: 0.25 }), bar[0], yb, bar[1] + 0.75);
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12).translate(0, 0.15, 0), tinted, bar[0] + Math.cos(i * 2.1) * 0.05, yb + 0.06, bar[1] + 0.75 + Math.sin(i * 2.1) * 0.05, 0, i === 1 ? 0x2a5530 : 0x18381e, R(0.3), R(0.3));
      for (let k = 0; k < 12; k++) glassAt(bar[0] + 0.22 - (k % 2) * 0.12, yb, bar[1] + 1.05 + Math.floor(k / 2) * 0.03 - 0.15 + (k % 6) * 0.03, null);
      // a chalkboard on an easel beside it
      const board = canvasTexture((c, w, h) => {
        c.fillStyle = '#5c3a1e';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#23272a';
        c.fillRect(10, 10, w - 20, h - 20);
        c.fillStyle = '#f4f1e8';
        c.textAlign = 'center';
        c.font = 'italic 600 30px Georgia, serif';
        c.fillText("Pimm's", w / 2, 62);
        c.font = 'italic 400 24px Georgia, serif';
        c.fillText('Lemonade', w / 2, 112);
        c.fillText('Elderflower', w / 2, 152);
        c.fillText('Strawberries', w / 2, 192);
      }, 256, 256);
      const easel = [bar[0] + 0.2, bar[1] - 1.75];
      add(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: board, roughness: 0.9 }), easel[0], y(...easel) + 1.0, easel[1], Math.PI / 2 + 0.45, undefined, -0.12).userData.keep = true;
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 1.5, 0.03).translate(0, 0.75, 0), wood, easel[0] + 0.05, y(...easel), easel[1] + s * 0.25, 0, undefined, 0, 0.12);
    }

    // --- the cake table: a round table, a three-tiered cake, scones and strawberries on a stand, a jug of Pimm's, teacups ---
    const cake = [5.2, -2.4];
    if (ok(cake[0], cake[1], 0.8)) {
      add(lathe([
        [0, H],
        [0.5, H],
        [0.52, H - 0.02],
        [0.54, H - 0.2],
        [0.58, 0.25],
        [0.6, 0.02],
        [0, 0.02],
      ], 36), linenMat, cake[0], y(...cake), cake[1]);
      const yc = y(...cake) + H;
      const icing = new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.5 });
      add(new THREE.CylinderGeometry(0.03, 0.12, 0.08, 16).translate(0, 0.04, 0), china, cake[0], yc, cake[1]);
      let yy = yc + 0.08;
      for (const r of [0.16, 0.12, 0.08]) {
        add(new THREE.CylinderGeometry(r, r, 0.1, 28).translate(0, 0.05, 0), icing, cake[0], yy, cake[1]);
        for (let i = 0; i < Math.round(r * 60); i++) {
          const a = (i / Math.round(r * 60)) * Math.PI * 2;
          add(new THREE.SphereGeometry(0.014, 8, 6).scale(1, 1.2, 1), tinted, cake[0] + Math.cos(a) * r, yy + 0.1, cake[1] + Math.sin(a) * r, 0, i % 3 ? 0xc81d2a : 0xf4a6b6);
        }
        yy += 0.1;
      }
      add(new THREE.SphereGeometry(0.03, 10, 8), tinted, cake[0], yy + 0.02, cake[1], 0, 0xe85a7a);
      // a three-tiered stand: scones with jam and cream, and strawberries
      const st = [cake[0] + 0.28, cake[1] + 0.22];
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6).translate(0, 0.21, 0), brass, st[0], yc, st[1]);
      for (const [h, r] of [[0.02, 0.15], [0.18, 0.12], [0.33, 0.09]]) {
        add(new THREE.CylinderGeometry(r, r * 0.92, 0.012, 24), china, st[0], yc + h, st[1]);
        for (let i = 0; i < Math.round(r * 40); i++) {
          const a = (i / Math.round(r * 40)) * Math.PI * 2;
          const sx = st[0] + Math.cos(a) * r * 0.6;
          const sz = st[1] + Math.sin(a) * r * 0.6;
          if (h > 0.3) add(new THREE.SphereGeometry(0.018, 8, 6).scale(1, 1.25, 1), tinted, sx, yc + h + 0.025, sz, 0, 0xc4182a);
          else {
            add(new THREE.CylinderGeometry(0.03, 0.033, 0.035, 12).translate(0, 0.018, 0), tinted, sx, yc + h + 0.006, sz, 0, 0xc89a5a);
            add(new THREE.SphereGeometry(0.016, 8, 6).scale(1, 0.6, 1), tinted, sx, yc + h + 0.045, sz, 0, (i % 2 ? 0x9c1626 : 0xfff6dd));
          }
        }
      }
      // the jug of Pimm's: fruit and mint on top; teacups
      const jug = [cake[0] - 0.25, cake[1] + 0.25];
      add(lathe([
        [0, 0],
        [0.06, 0],
        [0.075, 0.08],
        [0.07, 0.2],
        [0.05, 0.24],
        [0.055, 0.26],
        [0, 0.26],
      ], 20), glassMat, jug[0], yc, jug[1]).userData.keep = true;
      add(lathe([
        [0, 0.005],
        [0.058, 0.005],
        [0.071, 0.08],
        [0.066, 0.19],
        [0, 0.19],
      ], 20), new THREE.MeshStandardMaterial({ color: PIMMS, roughness: 0.12, transparent: true, opacity: 0.85 }), jug[0], yc, jug[1]).userData.keep = true;
      for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 12), tinted, jug[0] + R(0.06), yc + 0.19 + i * 0.004, jug[1] + R(0.06), Math.random() * 3, i % 2 ? 0xf08a1c : 0xe94a3a, Math.random(), 0);
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.012, 0.04, 5), tinted, jug[0] + R(0.06), yc + 0.21, jug[1] + R(0.06), 0, 0x3e7a32, R(1), R(1));
      for (let i = 0; i < 4; i++) {
        const a = 2.4 + i * 0.5;
        add(lathe([
          [0, 0],
          [0.03, 0],
          [0.045, 0.05],
          [0.047, 0.055],
          [0, 0.055],
        ], 16), china, cake[0] + Math.cos(a) * 0.36, yc, cake[1] + Math.sin(a) * 0.36);
      }
    }

    // --- picnic blankets with hampers, and striped deckchairs, on the lawn ---
    const tartan = (base, line1, line2) =>
      canvasTexture((c, w, h) => {
        c.fillStyle = base;
        c.fillRect(0, 0, w, h);
        for (const [col, step, wd] of [[line1, 64, 18], [line2, 32, 4]]) {
          c.fillStyle = col;
          c.globalAlpha = 0.55;
          for (let p = 0; p < w; p += step) {
            c.fillRect(p, 0, wd, h);
            c.fillRect(0, p, w, wd);
          }
        }
        c.globalAlpha = 1;
      }, 256, 256, { repeat: [2, 2] });
    const blankets = [
      [7.6, 7.2, 0.4, tartan('#8a1f22', '#1d3a2a', '#e9d27a')],
      [9.6, 3.0, -0.3, tartan('#23406b', '#2e6a3c', '#f2efe6')],
      [-6.2, 8.4, 0.9, tartan('#2f5a34', '#7a1c22', '#f0d47a')],
    ];
    const hamperMat = new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.85 });
    for (const [x, z, ry, tex] of blankets) {
      if (!ok(x, z, 1.0)) continue;
      const by = y(x, z) + 0.012;
      add(new THREE.PlaneGeometry(1.7, 1.35).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), x, by, z, ry).userData.keep = true;
      // a hamper, its lid up, plates and glasses out, a bottle, a book left open
      const hx = x + Math.cos(ry) * 0.55;
      const hz = z - Math.sin(ry) * 0.55;
      add(new THREE.BoxGeometry(0.48, 0.26, 0.32).translate(0, 0.13, 0), hamperMat, hx, by, hz, ry);
      add(new THREE.BoxGeometry(0.48, 0.03, 0.32).translate(0, 0, -0.16), hamperMat, hx - Math.sin(ry) * 0.16, by + 0.26, hz - Math.cos(ry) * 0.16, ry, undefined, -1.1);
      for (const [px, pz] of [[-0.3, 0.2], [0.1, 0.35]]) add(new THREE.CylinderGeometry(0.11, 0.1, 0.01, 20), china, x + px, by + 0.005, z + pz);
      glassAt(x - 0.42, by, z + 0.42, FIZZ, 0.35);
      glassAt(x + 0.32, by, z + 0.5, PIMMS, 0.6);
      add(new THREE.CylinderGeometry(0.036, 0.036, 0.28, 12).translate(0, 0.14, 0), tinted, x - 0.1, by, z - 0.1, 0, 0x163a1e, Math.PI / 2 - 0.05, 0.4);
      add(new THREE.BoxGeometry(0.22, 0.025, 0.16), tinted, x - 0.45, by + 0.012, z - 0.35, 0.6, 0x7a2a22);
      add(new THREE.BoxGeometry(0.2, 0.004, 0.15), tinted, x - 0.45, by + 0.027, z - 0.35, 0.6, 0xf3eedd);
    }
    // deckchairs: a wooden frame, a striped sling sagging between the rails
    const stripes = (a, b) =>
      canvasTexture((c, w, h) => {
        for (let x = 0; x < w; x += 16) {
          c.fillStyle = (x / 16) % 2 ? a : b;
          c.fillRect(x, 0, 16, h);
        }
      }, 128, 32);
    const slingGeo = new THREE.PlaneGeometry(0.5, 1.15, 1, 12);
    {
      const p = slingGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = p.getY(i) / 1.15 + 0.5; // 0 at the foot, 1 at the head
        p.setZ(i, -Math.sin(v * Math.PI) * 0.14);
      }
      slingGeo.computeVertexNormals();
    }
    const deckchairs = [
      [8.2, 9.2, 2.6, stripes('#c8302a', '#f4f0e6')],
      [9.3, 8.4, 2.4, stripes('#2a4f8a', '#f4f0e6')],
      [10.2, 1.0, 1.9, stripes('#2f7a4a', '#f4f0e6')],
      [-5.4, 10.0, -2.6, stripes('#d89a2a', '#f4f0e6')],
    ];
    for (const [x, z, ry, tex] of deckchairs) {
      if (!ok(x, z, 0.6)) continue;
      const cy = y(x, z);
      const chair = new THREE.Group();
      for (const s of [-1, 1]) {
        chair.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1.25).translate(0, 0, -0.6).rotateX(0.9).translate(s * 0.29, 0.02, 0.35), wood));
        chair.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.75).translate(0, 0, -0.35).rotateX(-0.55).translate(s * 0.29, 0.02, -0.15), wood));
      }
      const sling = new THREE.Mesh(slingGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
      sling.rotation.x = -Math.PI / 2 + 0.9;
      sling.position.set(0, 0.5, -0.1);
      chair.add(sling);
      chair.position.set(x, cy, z);
      chair.rotation.y = ry;
      chair.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      g.add(chair);
    }

    // --- croquet laid out on the lawn: six hoops, the peg, four balls, the mallets ---
    const cq = [9.0, -1.0];
    if (ok(cq[0], cq[1], 1.6) && ok(cq[0] + 1.4, cq[1] + 1.4, 0.5) && ok(cq[0] - 1.4, cq[1] - 1.4, 0.5)) {
      const hoop = new THREE.TorusGeometry(0.1, 0.006, 6, 16, Math.PI);
      for (const [hx, hz] of [[-1.3, -1.6], [1.3, -1.6], [-0.5, 0], [0.5, 0], [-1.3, 1.6], [1.3, 1.6]]) add(hoop, white, cq[0] + hx, y(cq[0] + hx, cq[1] + hz), cq[1] + hz, Math.PI / 2 + 0.1);
      const peg = canvasTexture((c, w, h) => {
        c.fillStyle = '#f2efe8';
        c.fillRect(0, 0, w, h);
        ['#2a4f9a', '#c8302a', '#1c1c1c', '#e0b62a'].forEach((col, i) => {
          c.fillStyle = col;
          c.fillRect(0, i * 10, w, 8);
        });
      }, 16, 64);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.46, 10).translate(0, 0.23, 0), new THREE.MeshStandardMaterial({ map: peg, roughness: 0.6 }), cq[0], y(...cq), cq[1]).userData.keep = true;
      for (const [bx, bz, col] of [[0.7, 0.9, 0x2a4f9a], [-0.9, -0.4, 0xc8302a], [1.1, -1.3, 0x1c1c1c], [-0.2, 1.4, 0xe0b62a]]) add(new THREE.SphereGeometry(0.046, 14, 10), tinted, cq[0] + bx, y(cq[0] + bx, cq[1] + bz) + 0.046, cq[1] + bz, 0, col);
      for (const [mx, mz, ry, col] of [[0.9, 0.5, 0.6, 0x2a4f9a], [-1.1, 0.2, 2.1, 0xc8302a]]) {
        const yy = y(cq[0] + mx, cq[1] + mz);
        add(new THREE.CylinderGeometry(0.012, 0.014, 0.9, 8).rotateZ(Math.PI / 2).translate(0.45, 0.03, 0), wood, cq[0] + mx, yy, cq[1] + mz, ry);
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.23, 14).rotateX(Math.PI / 2), tinted, cq[0] + mx, yy + 0.045, cq[1] + mz, ry, col);
      }
    }

    // --- a little dais, the string quartet's chairs, stands and instruments, between the sets ---
    const dq = [-6.6, 2.2];
    if (ok(dq[0], dq[1], 1.8)) {
      const yd = y(...dq);
      add(new THREE.CylinderGeometry(1.7, 1.75, 0.16, 40).translate(0, 0.08, 0), wood, dq[0], yd, dq[1]);
      const body = (() => {
        // a violin's outline: two bouts and a waist
        const sh = new THREE.Shape();
        sh.moveTo(0, -0.18);
        sh.bezierCurveTo(0.12, -0.18, 0.11, -0.04, 0.06, -0.01);
        sh.bezierCurveTo(0.085, 0.03, 0.1, 0.16, 0, 0.16);
        sh.bezierCurveTo(-0.1, 0.16, -0.085, 0.03, -0.06, -0.01);
        sh.bezierCurveTo(-0.11, -0.04, -0.12, -0.18, 0, -0.18);
        return new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -0.02);
      })();
      const varnish = new THREE.MeshStandardMaterial({ color: 0x7a3a14, roughness: 0.25, metalness: 0.05 });
      const ebony = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.4 });
      const paper = new THREE.MeshStandardMaterial({ color: 0xf6f2e4, roughness: 0.9, side: THREE.DoubleSide });
      // four chairs in an arc facing the lawn (+z, -x), a stand before each
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.6;
        const cx = dq[0] + Math.sin(a) * 1.0;
        const cz = dq[1] - Math.cos(a) * 0.4;
        const face = Math.PI + a * 0.6 - 0.5; // (towards the guests)
        const chair = new THREE.Group();
        chair.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20).translate(0, 0.46, 0), darkWood));
        for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) chair.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6).translate(lx, 0.23, lz), darkWood));
        chair.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 16, Math.PI).rotateX(-0.1).translate(0, 0.62, -0.17), darkWood));
        for (const lx of [-0.17, 0.17]) chair.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6).translate(lx, 0.54, -0.18), darkWood));
        chair.position.set(cx, yd + 0.16, cz);
        chair.rotation.y = face;
        chair.traverse((o) => o.isMesh && (o.castShadow = true));
        g.add(chair);
        // the stand: a tripod, a rod, a desk with music on it
        const sx = cx + Math.sin(face + Math.PI) * -0.62;
        const sz = cz + Math.cos(face + Math.PI) * -0.62;
        const stand = new THREE.Group();
        stand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.05, 6).translate(0, 0.53, 0), iron));
        for (let k = 0; k < 3; k++) stand.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 5).translate(0, -0.16, 0).rotateX(0.9).rotateY((k / 3) * Math.PI * 2).translate(0, 0.25, 0), iron));
        stand.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.01).rotateX(-0.45).translate(0, 1.12, 0.02), iron));
        stand.add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.29).rotateX(-0.45).translate(0, 1.12, 0.03), paper));
        stand.position.set(sx, yd + 0.16, sz);
        stand.rotation.y = face + Math.PI;
        stand.traverse((o) => o.isMesh && (o.castShadow = true));
        g.add(stand);
        // the instruments laid on the chairs, and the cello against the last
        if (i < 3) {
          const inst = new THREE.Group();
          const sc = i === 2 ? 1.15 : 1; // (the viola a little bigger)
          inst.add(new THREE.Mesh(body, varnish));
          inst.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.26, 0.02).translate(0, 0.29, 0.03), ebony));
          inst.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.008, 6, 10).translate(0, 0.43, 0.03), varnish));
          inst.scale.setScalar(sc);
          inst.rotation.set(-Math.PI / 2, 0, face + 0.4);
          inst.position.set(cx, yd + 0.16 + 0.5, cz);
          g.add(inst);
        } else {
          const cello = new THREE.Group();
          cello.add(new THREE.Mesh(body, varnish));
          cello.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.3, 0.02).translate(0, 0.27, 0.03), ebony));
          cello.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 5).translate(0, -0.27, 0), iron));
          cello.scale.setScalar(2.7);
          cello.position.set(cx + 0.3, yd + 0.16 + 0.68, cz + 0.12);
          cello.rotation.set(0, face, -0.22);
          cello.traverse((o) => o.isMesh && (o.castShadow = true));
          g.add(cello);
        }
      }
      this.quartetAt = new THREE.Vector3(at.x + dq[0], this.y0 + 1.2, at.z + dq[1]);
    }

    // --- flowers in urns either side of the marquee's open end ---
    const blooms = [];
    const bloomCols = [];
    const palette = [0xf2a6b8, 0xfffaf0, 0xc94a6a, 0xf6d36a, 0xb7a6e8].map((c) => new THREE.Color(c));
    const urnGeo = lathe([
      [0, 0],
      [0.14, 0],
      [0.15, 0.05],
      [0.06, 0.12],
      [0.06, 0.3],
      [0.18, 0.42],
      [0.24, 0.58],
      [0.25, 0.62],
      [0, 0.62],
    ], 24);
    const stone = new THREE.MeshStandardMaterial({ color: 0xd9d2c2, roughness: 0.9 });
    for (const x of [-4.4, 4.4]) {
      const z = L / 2 + 0.5;
      if (!ok(x, z, 0.4)) continue;
      const yu = y(x, z);
      add(new THREE.BoxGeometry(0.4, 0.5, 0.4).translate(0, 0.25, 0), stone, x, yu, z);
      add(urnGeo, stone, x, yu + 0.5, z);
      for (let i = 0; i < 140; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 0.34;
        const isLeaf = i % 3 === 0;
        blooms.push(mat4(x + Math.cos(a) * r, yu + 1.12 + (0.34 - r) * 0.7 + Math.random() * 0.05, z + Math.sin(a) * r, Math.random() * 6, isLeaf ? 1.2 : 0.8 + Math.random() * 0.5, Math.random(), 0));
        bloomCols.push(isLeaf ? new THREE.Color(0x4d6b3c) : palette[i % palette.length]);
      }
    }
    if (blooms.length) g.add(instances(new THREE.IcosahedronGeometry(0.035, 0).scale(1, 0.75, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), blooms, { colours: bloomCols }));

    // --- the guests' traces: straw boaters on two chairs, napkins dropped on the grass ---
    const straw = canvasTexture((c, w, h) => {
      c.fillStyle = '#d9bf7e';
      c.fillRect(0, 0, w, h);
      for (let yy = 0; yy < h; yy += 3) {
        c.fillStyle = `rgba(120,90,40,${0.15 + Math.random() * 0.15})`;
        c.fillRect(0, yy, w, 1);
      }
    }, 64, 64, { repeat: [6, 1] });
    const boater = lathe([
      [0, 0.075],
      [0.11, 0.075],
      [0.11, 0.012],
      [0.2, 0.01],
      [0.2, 0],
      [0, 0.002],
    ], 24);
    const strawMat = new THREE.MeshStandardMaterial({ map: straw, roughness: 0.85 });
    for (const k of [3, 14]) {
      const s = this.seats[k];
      if (!s) continue;
      const [tx, z, side] = s;
      add(boater, strawMat, tx + side * 0.78, y(tx, z) + 0.47, z, Math.random() * 3);
      add(new THREE.CylinderGeometry(0.112, 0.112, 0.022, 24).translate(0, 0.045, 0), tinted, tx + side * 0.78, y(tx, z) + 0.47, z, 0, 0x1c2a4a);
    }
    for (const [x, z] of [[2.6, 8.0], [6.8, 5.2]]) if (ok(x, z, 0.3)) add(new THREE.BoxGeometry(0.3, 0.004, 0.3), tinted, x, y(x, z) + 0.006, z, Math.random() * 3, 0xb7c9ae, R(0.2), R(0.2));
    // half-drunk glasses on the long tables
    for (const [tx, z, side] of this.seats.filter((_, i) => i % 3 === 0)) glassAt(tx + side * 0.3 - side * 0.17, y(tx, z) + H, z + 0.16, [PIMMS, FIZZ, LEMON][Math.floor(Math.random() * 3)], 0.2 + Math.random() * 0.5);

    // the glasses, and what is left in them
    const wineGlass = lathe([
      [0.034, 0],
      [0.036, 0.004],
      [0.006, 0.009],
      [0.004, 0.085],
      [0.012, 0.09],
      [0.03, 0.105],
      [0.041, 0.135],
      [0.04, 0.165],
      [0.036, 0.19],
    ]);
    if (glasses.length) g.add(instances(wineGlass, glassMat, glasses));
    if (drinks.length) {
      const lq = lathe([
        [0, 0.0],
        [0.028, 0.0],
        [0.037, 0.03],
        [0.038, 0.05],
        [0, 0.05],
      ], 16);
      const list = drinks.map(([m, , left]) => m.clone().multiply(new THREE.Matrix4().makeScale(1, 0.4 + left, 1)));
      g.add(instances(lq, new THREE.MeshStandardMaterial({ roughness: 0.12, transparent: true, opacity: 0.82 }), list, { colours: drinks.map(([, c]) => new THREE.Color(c)) }));
    }

    // --- bunting criss-crossing: from the marquee's corners to the posts, across the open end, out to two poles ---
    const flags = [];
    const flagCols = [0xc8302a, 0xf4f0e6, 0x2a4f9a, 0xe0b62a, 0x3e8a4a, 0xf2a6b8].map((c) => new THREE.Color(c));
    const flagColList = [];
    const strings = [];
    const run = (a, b, drop) => {
      const n = Math.max(3, Math.round(a.distanceTo(b) / 0.32));
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * drop;
        pts.push(p);
      }
      strings.push(...pts.slice(1).flatMap((p, k) => [pts[k], p]));
      const dir = b.clone().sub(a).setY(0).normalize();
      const ry = Math.atan2(-dir.z, dir.x);
      for (let k = 1; k < n; k++) {
        flags.push(mat4(pts[k].x, pts[k].y, pts[k].z, ry));
        flagColList.push(flagCols[(k + strings.length) % flagCols.length]);
      }
    };
    const E = EAVE - 0.08;
    const poles = [];
    for (const [px, pz] of [[8.6, -4.6], [8.8, 6.6]]) if (ok(px, pz, 0.3)) poles.push([px, pz]);
    for (const [px, pz] of poles) add(new THREE.CylinderGeometry(0.03, 0.035, 2.9, 8).translate(0, 1.45, 0), white, px, y(px, pz), pz);
    run(new THREE.Vector3(-W / 2, E, L / 2), new THREE.Vector3(3.2, 2.85, 10.5), 0.25);
    run(new THREE.Vector3(W / 2, E, L / 2), new THREE.Vector3(-3.2, 2.85, 10.5), 0.25);
    run(new THREE.Vector3(-W / 2, E - 0.25, L / 2), new THREE.Vector3(W / 2, E - 0.25, L / 2), 0.3);
    for (const [px, pz] of poles) for (const z of [-3.2, 3.2]) if (Math.abs(z - pz) < 7) run(new THREE.Vector3(W / 2, E, z), new THREE.Vector3(px, y(px, pz) + 2.8, pz), 0.4);
    if (poles.length === 2) run(new THREE.Vector3(poles[0][0], y(...poles[0]) + 2.8, poles[0][1]), new THREE.Vector3(poles[1][0], y(...poles[1]) + 2.8, poles[1][1]), 0.5);
    const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(0.1, 0, 0), new THREE.Vector3(0, -0.22, 0)]);
    flagGeo.computeVertexNormals();
    this.bunting = new THREE.Group();
    this.bunting.add(instances(flagGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), flags, { colours: flagColList }));
    this.bunting.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strings), new THREE.LineBasicMaterial({ color: 0xe8e2d4 })));
    g.add(this.bunting);

    // --- balloons tied to the festoon posts and the bar ---
    this.balloonsTied = [];
    const ties = [[-3.2, 10.5], [3.2, 10.5]];
    if (this.day && ok(bar[0], bar[1], 1.4)) ties.push([bar[0] - 0.3, bar[1] + 1.25]);
    const balloonGeo = new THREE.SphereGeometry(0.14, 16, 12).scale(1, 1.22, 1);
    const bcols = [0xf2a6b8, 0xf4f0e6, 0xb7d3f2, 0xf6d36a];
    let bi = 0;
    for (const [tx, tz] of ties) {
      const ty = y(tx, tz) + (Math.abs(tz - 10.5) < 0.01 ? 1.6 : H + 0.05);
      for (let k = 0; k < 3; k++) {
        const top = new THREE.Vector3(tx + R(0.5), ty + 1.1 + k * 0.18, tz + R(0.5));
        const mesh = new THREE.Mesh(balloonGeo, new THREE.MeshStandardMaterial({ color: bcols[bi++ % bcols.length], roughness: 0.25, metalness: 0.05 }));
        mesh.userData.keep = true;
        mesh.position.copy(top);
        mesh.castShadow = true;
        g.add(mesh);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(tx, ty, tz), top.clone().setY(top.y - 0.17)]), new THREE.LineBasicMaterial({ color: 0xdddddd }));
        line.userData.keep = true;
        g.add(line);
        this.balloonsTied.push({ mesh, line, at: top.clone(), ph: Math.random() * 6 });
      }
    }
    mergeMeshes(g, tinted);
  }

  /** The chairs, the bistro tables and the gramophone (models), once the party is on. */
  async load() {
    this.loaded = true;
    const loader = new GLTFLoader();
    const [set, gram] = await Promise.all([loader.loadAsync('/models/party/table-chair-set.glb'), loader.loadAsync('/models/halloween/gramophone.glb').catch(() => null)]);
    // the set's chair and table, each centred on its own footprint, standing on y = 0
    const pick = (re) => {
      let found = null;
      set.scene.traverse((o) => {
        if (o.isMesh && !found && re.test(o.material.name)) found = o;
      });
      if (!found) return null;
      const geo = found.geometry.clone();
      geo.computeBoundingBox();
      const b = geo.boundingBox;
      geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      return { geo, mat: found.material };
    };
    // (by the material's name: "outdoor_table_chair_set_01_chair" and "…_table")
    const chair = pick(/_chair$/);
    const table = pick(/_table$/);
    if (chair) {
      // (the chair faces -z: each turned to face its table, a little askew)
      const list = this.seats.map(([tx, z, side]) => mat4(tx + side * 0.78, 0, z + (Math.random() - 0.5) * 0.06, (side < 0 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * 0.12));
      for (const [x, z] of this.bistro) for (const s of [-1, 1]) list.push(mat4(x + s * 0.62, 0, z + s * 0.12, (s < 0 ? -Math.PI / 2 : Math.PI / 2) + 0.3));
      this.group.add(instances(chair.geo, chair.mat, list, { shadow: true }));
    }
    if (table) {
      this.group.add(
        instances(
          table.geo,
          table.mat,
          this.bistro.map(([x, z]) => mat4(x, 0, z, 0.3)),
          { shadow: true },
        ),
      );
    }
    if (gram) {
      const g = gram.scene;
      const box = new THREE.Box3().setFromObject(g);
      g.scale.setScalar(0.5 / (box.max.y - box.min.y));
      box.setFromObject(g);
      const c = box.getCenter(new THREE.Vector3());
      g.position.set(this.gramophoneAt.x - c.x, this.gramophoneAt.y - box.min.y, this.gramophoneAt.z - c.z);
      g.rotation.y = 0.6;
      g.traverse((o) => o.isMesh && (o.castShadow = true));
      this.group.add(g);
    }
  }

  /**
   * Midsummer Saturdays in June and July, when it's dry: 'day' in the afternoon (one till seven),
   * 'evening' from seven till midnight; otherwise null.
   */
  static on(day, hours, rain) {
    const d = Math.floor(day);
    const date = new Date(Date.UTC(new Date().getFullYear(), 0, 1 + d));
    if (!(d >= 152 && d <= 212 && date.getUTCDay() === 6 && rain < 0.1)) return null;
    return hours >= 13 && hours < 19 ? 'day' : hours >= 19 && hours < 24 ? 'evening' : null;
  }

  update(dt, { day, hours, rain, dusk, camera, scale }) {
    let mode = null;
    if (this.always) mode = this.mode === 'day' ? (hours > 9 && hours < 20 ? 'day' : null) : hours > 17 || hours < 1 ? 'evening' : null;
    else mode = GardenParty.on(day, hours, rain);
    const on = !!mode;
    this.group.visible = on;
    if (mode === 'day' && !this.day) this._dressForDay();
    if (this.day) this.day.visible = mode === 'day';
    this.musicAt = mode === 'day' && this.quartetAt ? this.quartetAt : this.gramophoneMusicAt;
    const lit = on ? THREE.MathUtils.clamp(dusk * 1.4, 0.15, 1) : 0;
    this.lights.material.uniforms.uOn.value = lit;
    this.lights.material.uniforms.uTime.value += dt;
    if (scale) this.lights.material.uniforms.uScale.value = scale;
    this.light.intensity = 14 * lit;
    if (!on) return;
    if (!this.loaded) this.load().catch((err) => console.warn('the garden party did not load:', err.message));
    // at dusk the marquee glows from the lights inside; the bulbs and the candles shine
    const glowing = THREE.MathUtils.smoothstep(lit, 0.2, 1);
    for (const m of this.cloths) m.emissiveIntensity = 0.2 * glowing;
    this.bulbMat.emissiveIntensity = 2.5 * lit;
    this.candleMat.emissiveIntensity = 0.6 * lit;
    // the pennants stir
    const t = this.lights.material.uniforms.uTime.value;
    for (const [k, f] of this.flags.entries()) f.rotation.y = 0.35 * Math.sin(t * 1.3 + k * 2) + 0.15 * Math.sin(t * 3.1 + k);
    // by day the balloons bob on their strings and the bunting stirs
    if (this.day?.visible) {
      for (const b of this.balloonsTied) {
        b.mesh.position.set(b.at.x + 0.12 * Math.sin(t * 0.9 + b.ph), b.at.y + 0.06 * Math.sin(t * 1.3 + b.ph * 2), b.at.z + 0.1 * Math.cos(t * 0.8 + b.ph));
        const pos = b.line.geometry.attributes.position;
        pos.setXYZ(1, b.mesh.position.x, b.mesh.position.y - 0.17, b.mesh.position.z);
        pos.needsUpdate = true;
      }
    }
    // the music, again and again while you are near enough to hear it
    this.nextMusic -= dt;
    if (this.nextMusic <= 0 && this.sound?.has?.('party-music') && camera.position.distanceTo(this.musicAt) < 120) {
      this.nextMusic = (this.sound.duration?.('party-music') || 60) + 2;
      this.sound.sample('party-music', this.musicAt.clone(), { ref: 6, rolloff: 1.2, max: 140, gain: 0.7, lowpass: 6000 });
    }
  }
}
