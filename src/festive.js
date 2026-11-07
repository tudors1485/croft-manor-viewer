// The festive days. From 26 October to 3 November carved pumpkins sit either side of the
// front door, their faces glowing and flickering after dark (Halloween's ghosts and figures
// are in spooky.js, Bonfire Night's fire and fireworks in bonfire.js). From 1 December to
// Twelfth Night (6 January) there are Christmas lights: along the top of the front of the
// house (warm white, or a red, green and gold chase, changing every so often) with icicle
// lights dripping below, over the gate, and coloured ones twinkling in the two oaks at the
// entrance. They are lit from dusk to half past midnight, and from Christmas Eve to New Year's
// Eve all day and all night. From Christmas Eve the house is dressed more: a wreath on the front
// door, light strings round the front windows with a candle on each sill, a tall decorated tree
// on the lawn with a star on top, small lit trees in tubs either side of the door, fairy lights
// in more of the trees, lights wound up the gate's pillars and along the wall either side of it.

import * as THREE from 'three';
import { weatherShader } from './materials.js';

const HALLOWEEN = [298, 306]; // 26 October .. 3 November (days of the year, from 0)
const CHRISTMAS = [334, 5]; // 1 December .. 6 January
const ALL_DAY = [357, 364]; // Christmas Eve .. New Year's Eve: the lights stay on

const inRange = (day, [a, b]) => (a <= b ? day >= a && day <= b : day >= a || day <= b);

/** A carved face on a canvas laid round a pumpkin (the sphere's front is u = 0.25, the equator v = 0.5). */
function faceCanvas(kind) {
  const W = 512;
  const H = 256;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const face = (g, fill) => {
    g.fillStyle = fill;
    const cx = W * 0.25;
    const cy = H * 0.5;
    const tri = (pts) => {
      g.beginPath();
      g.moveTo(...pts[0]);
      for (const p of pts.slice(1)) g.lineTo(...p);
      g.closePath();
      g.fill();
    };
    // eyes, nose, and a jagged grin (or a scared face: round eyes, an open mouth)
    if (kind === 0) {
      tri([[cx - 44, cy - 14], [cx - 18, cy - 14], [cx - 31, cy - 40]]);
      tri([[cx + 18, cy - 14], [cx + 44, cy - 14], [cx + 31, cy - 40]]);
      tri([[cx - 8, cy + 6], [cx + 8, cy + 6], [cx, cy - 8]]);
      g.beginPath();
      g.moveTo(cx - 52, cy + 16);
      const teeth = [[-38, 30], [-30, 22], [-20, 36], [-8, 26], [4, 38], [16, 26], [28, 36], [38, 22], [46, 30]];
      for (const [x, y] of teeth) g.lineTo(cx + x, cy + y);
      g.lineTo(cx + 52, cy + 16);
      g.quadraticCurveTo(cx, cy + 70, cx - 52, cy + 16);
      g.fill();
    } else {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + s * 28, cy - 22, 11, 15, 0, 0, Math.PI * 2);
        g.fill();
      }
      tri([[cx - 7, cy + 2], [cx + 7, cy + 2], [cx, cy - 10]]);
      g.beginPath();
      g.ellipse(cx, cy + 30, 22, 17, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  // the skin: orange, darker in the grooves between the ribs, with the face cut dark
  const skin = make();
  const sg = skin.getContext('2d');
  for (let x = 0; x < W; x++) {
    const rib = 0.5 + 0.5 * Math.cos((x / W) * Math.PI * 2 * 10);
    const l = 0.78 + 0.22 * Math.pow(rib, 0.4);
    sg.fillStyle = `rgb(${Math.round(222 * l)},${Math.round(104 * l)},${Math.round(26 * l)})`;
    sg.fillRect(x, 0, 1, H);
  }
  if (kind !== 2) face(sg, '#2a1305');
  // the glow: only the face
  const glow = make();
  const gg = glow.getContext('2d');
  gg.fillStyle = '#000';
  gg.fillRect(0, 0, W, H);
  if (kind !== 2) face(gg, '#fff');
  const t = (c) => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  return { map: t(skin), emissiveMap: t(glow) };
}

/** A pumpkin: ribbed, a little squat, with a stalk. kind 0 grins, 1 is scared, 2 is not carved. */
function pumpkin(radius, kind) {
  const geo = new THREE.SphereGeometry(radius, 64, 32);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = uv.getX(i);
    const rib = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 10);
    const k = 1 - 0.05 * (1 - rib);
    // squat, with a dip round the stalk
    const y = v.y / radius;
    v.x *= k;
    v.z *= k;
    v.y = v.y * 0.78 - radius * 0.1 * Math.exp(-Math.pow((1 - Math.abs(y)) * 4, 2)) * Math.sign(y);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const { map, emissiveMap } = faceCanvas(kind);
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: new THREE.Color(1, 0.55, 0.16), emissiveIntensity: 0, roughness: 0.55 });
  const body = new THREE.Mesh(geo, mat);
  body.position.y = radius * 0.78;
  body.castShadow = true;
  body.receiveShadow = true;
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.07, radius * 0.11, radius * 0.4, 10).translate(0, radius * 0.2, 0).rotateZ(0.25),
    new THREE.MeshStandardMaterial({ color: 0x5b5326, roughness: 0.9 }),
  );
  stalk.position.y = radius * 0.78 * 2 - radius * 0.14;
  stalk.castShadow = true;
  const g = new THREE.Group();
  g.add(body, stalk);
  g.userData = { mat, carved: kind !== 2 };
  return g;
}

function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Small glowing bulbs (one draw call): position, colour, twinkle phase, and `along` (the bulb's
 * place along its string, for the chase and the drips). kind: 'twinkle' (each bulb in its own
 * time), 'chase' (warm white, then every so often red, green and gold running along the string),
 * 'icicle' (cool white, a drip of light running down each icicle).
 */
function bulbs(list, size, kind = 'twinkle') {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap((b) => b.pos), 3));
  geo.setAttribute('colour', new THREE.Float32BufferAttribute(list.flatMap((b) => b.colour), 3));
  geo.setAttribute('phase', new THREE.Float32BufferAttribute(list.map((b) => b.phase), 1));
  geo.setAttribute('along', new THREE.Float32BufferAttribute(list.map((b) => b.along ?? 0), 1));
  const mat = new THREE.ShaderMaterial({
    defines: { KIND: kind === 'chase' ? 1 : kind === 'icicle' ? 2 : 0 },
    uniforms: { uMap: { value: glowSprite() }, uOn: { value: 0 }, uTime: { value: 0 }, uScale: { value: 800 }, uSize: { value: size }, uShow: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 colour;
      attribute float phase;
      attribute float along;
      uniform float uTime;
      uniform float uScale;
      uniform float uSize;
      uniform float uShow;
      varying vec3 vColour;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // a slow twinkle, each bulb in its own time
        float tw = 0.75 + 0.25 * sin(uTime * (0.8 + fract(phase * 7.1) * 1.6) + phase * 6.28);
        vec3 c = colour * tw;
        #if KIND == 1
          // every 16 seconds the warm white gives way to red, green and gold running along the roof
          // (and all the time in the Christmas flyby)
          float mode = max(uShow, smoothstep(0.42, 0.5, fract(uTime / 32.0)) * (1.0 - smoothstep(0.92, 1.0, fract(uTime / 32.0))));
          float k = mod(floor(along / 3.0 - uTime * 3.0), 3.0);
          vec3 chase = k < 0.5 ? vec3(1.0, 0.12, 0.08) : k < 1.5 ? vec3(0.12, 0.95, 0.25) : vec3(1.0, 0.72, 0.18);
          c = mix(c, chase * (0.75 + 0.25 * sin(uTime * 6.0 + along)), mode);
        #elif KIND == 2
          // a drip of light running down each icicle, every few seconds
          float drip = pow(fract(phase - uTime * 0.45 + along * 0.18), 8.0);
          c = colour * (0.35 + 0.1 * tw + 1.1 * drip);
        #endif
        vColour = c;
        gl_PointSize = clamp(uSize * uScale / -mv.z, 2.0, 22.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOn;
      varying vec3 vColour;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(vColour * a * 2.4 * uOn, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 10;
  return pts;
}

/** A fir tree `h` tall: tiers of dark green cones on a trunk. */
function fir(h) {
  const t = new THREE.Group();
  const needles = new THREE.MeshStandardMaterial({ color: 0x173a22, roughness: 0.9 });
  weatherShader(needles); // (snow on the branches, on the sides that face the sky)
  const bark = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.025, h * 0.035, h * 0.2, 8).translate(0, h * 0.1, 0), bark);
  t.add(trunk);
  const tiers = 5;
  for (let k = 0; k < tiers; k++) {
    const f = k / tiers;
    const r = h * 0.29 * (1 - f * 0.78);
    const tall = h * 0.34 * (1 - f * 0.35);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, tall, 14, 1, true), needles);
    cone.position.y = h * 0.12 + f * h * 0.7 + tall / 2;
    cone.rotation.y = k * 0.7;
    t.add(cone);
  }
  needles.side = THREE.DoubleSide;
  t.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return t;
}

/** A five-pointed star, `outer` and `inner` radii, `depth` thick, facing +z. */
function starGeometry(outer, inner, depth) {
  const shape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 ? inner : outer;
    if (k === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}

export class Festive {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree, to find the walls and the ground
   * @param {{centre: THREE.Vector3, normal: THREE.Vector3, y0: number}} o.door the front door
   * @param {{x:number, z:number, r:number}[]} o.oaks the two oaks inside the gate
   * @param {{x:number, z:number}} o.gate
   */
  constructor(scene, { bvh, door, oaks, gate }) {
    this.halloween = new THREE.Group();
    this.halloween.name = 'Halloween';
    this.christmas = new THREE.Group();
    this.christmas.name = 'Christmas';
    scene.add(this.halloween, this.christmas);
    const ray = new THREE.Ray();
    const down = new THREE.Vector3(0, -1, 0);
    const groundAt = (x, z, from = 3) => {
      ray.set(new THREE.Vector3(x, from, z), down);
      return bvh.raycastFirst(ray, THREE.DoubleSide, 0, 10)?.point.y ?? null;
    };

    // --- Halloween: pumpkins either side of the front door, faces out ---
    this.pumpkins = [];
    if (door) {
      const out = door.normal.clone();
      // (the normal may point into the house: outside is towards the drive, +z)
      if (out.z < 0) out.negate();
      const side = new THREE.Vector3(out.z, 0, -out.x);
      // [sideways, out from the door, radius, face]: in the porch, and on the steps by the pots
      const spots = [
        [-1.25, 0.75, 0.3, 0],
        [-1.35, 1.35, 0.17, 1],
        [1.25, 0.75, 0.28, 1],
        [-0.95, 3.0, 0.27, 0],
        [-1.3, 3.5, 0.19, 2],
        [0.95, 3.05, 0.25, 1],
        [1.25, 3.55, 0.17, 0],
      ];
      const lights = [];
      for (const [s, o, r, kind] of spots) {
        const p = door.centre.clone().addScaledVector(side, s).addScaledVector(out, o);
        const y = groundAt(p.x, p.z, door.y0 + 1.5);
        if (y === null) continue;
        const pk = pumpkin(r, kind);
        pk.position.set(p.x, y, p.z);
        // facing out, each turned a little
        pk.rotation.y = Math.atan2(out.x, out.z) + (s < 0 ? 0.25 : -0.25) + (Math.random() - 0.5) * 0.2;
        this.halloween.add(pk);
        this.pumpkins.push(pk);
        if (kind !== 2) {
          const f = new THREE.Vector3(Math.sin(pk.rotation.y), 0, Math.cos(pk.rotation.y));
          lights.push({ pos: [p.x + f.x * r * 0.9, y + r * 0.75, p.z + f.z * r * 0.9], colour: [1, 0.5, 0.12], phase: Math.random() });
        }
      }
      this.pumpkinGlow = bulbs(lights, 0.55);
      this.halloween.add(this.pumpkinGlow);
      // the candles inside them light the steps and the porch, flickering (one light, always in
      // the scene and dark the rest of the year: adding a light later would recompile every shader)
      this.candle = new THREE.PointLight(0xff8a2a, 0, 5.5, 2);
      this.candle.position.copy(door.centre).addScaledVector(out, 2.1).setY((groundAt(this.candle.position.x, this.candle.position.z, door.y0 + 1.5) ?? door.y0) + 0.45);
      this.halloween.parent.add(this.candle);
    }

    // --- Christmas: warm white along the top of the front of the house and over the gate ---
    const outline = [];
    const warm = () => [1, 0.78, 0.45];
    // from the top down, the first height at which a ray from the front meets a wall facing
    // it (not a roof slope), within the given depth: the top edge of the front, battlements and all
    const traceTop = (x0, x1, zFrom, zNear, zFar, yTop, dz) => {
      for (let x = x0; x <= x1; x += 0.24) {
        for (let y = yTop; y > 1.5; y -= 0.08) {
          ray.set(new THREE.Vector3(x, y, zFrom), new THREE.Vector3(0, 0, -1));
          const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
          if (!hit || hit.point.z > zNear || hit.point.z < zFar) continue;
          if (Math.abs(hit.face.normal.z) < 0.6) continue; // a roof, not a wall
          outline.push({ pos: [x, y - 0.06, hit.point.z + dz], colour: warm(), phase: Math.random(), along: outline.length });
          break;
        }
      }
    };
    traceTop(-14.4, 29.2, 6, 1, -12.5, 16, 0.14); // the front of the house
    // icicle lights hanging under the house's line: strands of four to nine bulbs, cool white
    const icicles = [];
    for (const b of outline) {
      const n = 4 + Math.floor(Math.random() * 6);
      const phase = Math.random();
      for (let k = 1; k <= n; k++) icicles.push({ pos: [b.pos[0] + (Math.random() - 0.5) * 0.03, b.pos[1] - k * 0.1, b.pos[2] + 0.02], colour: [0.85, 0.93, 1], phase, along: k });
    }
    if (gate) traceTop(gate.x - 3.4, gate.x + 3.4, gate.z + 6, gate.z + 2.5, gate.z - 2, 8, 0.16); // the gate
    this.outline = bulbs(outline, 0.18, 'chase');
    this.christmas.add(this.outline);
    this.icicles = bulbs(icicles, 0.1, 'icicle');
    this.christmas.add(this.icicles);
    // coloured lights through the two bare oaks inside the gate
    const tree = [];
    const colours = [
      [1, 0.15, 0.1],
      [0.15, 0.9, 0.25],
      [0.2, 0.4, 1],
      [1, 0.7, 0.15],
      [1, 0.85, 0.6],
    ];
    for (const o of oaks) {
      const h = 10.5;
      for (let i = 0; i < 320; i++) {
        // spread through the crown (a squat ellipsoid), more on the outside, where you see them
        const a = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const r = Math.pow(Math.random(), 0.35);
        const s = Math.sqrt(1 - u * u);
        const x = o.x + Math.cos(a) * s * r * o.r * 0.85;
        const z = o.z + Math.sin(a) * s * r * o.r * 0.85;
        const y = h * 0.58 + u * r * h * 0.32;
        tree.push({ pos: [x, y, z], colour: colours[i % colours.length], phase: Math.random() });
      }
    }
    this.treeLights = bulbs(tree, 0.15);
    this.christmas.add(this.treeLights);
    this.show = 0; // 1 in the Christmas flyby: the roofline chases red, green and gold all the way
    this._traceTop = traceTop;
    this._outline = outline;
    this._bvh = bvh;
    this._door = door;
    this._gate = gate;
    this._groundAt = groundAt;
    this.extra = []; // (the dressing from Christmas Eve: decorate)
    this.update(0, 0, 145, 12, true);
  }

  /**
   * The dressing for Christmas Eve to Twelfth Night, once the windows and the trees are known.
   * @param {object} o
   * @param {{x0:number, x1:number, bottom:number, top:number, z:number}[]} o.windows the front windows
   * @param {{x:number, z:number, r:number}[]} o.crowns the trees' crowns (fairy lights in some)
   * @param {THREE.Vector3|null} o.treeAt where the big tree stands, on the lawn
   */
  decorate({ windows = [], crowns = [], treeAt = null }) {
    this.eve = new THREE.Group();
    this.eve.name = 'Christmas Eve';
    this.christmas.add(this.eve);
    const ray = new THREE.Ray();
    const bvh = this._bvh;
    const warm = [1, 0.78, 0.45];
    const colours = [
      [1, 0.15, 0.1],
      [0.15, 0.9, 0.25],
      [0.2, 0.4, 1],
      [1, 0.7, 0.15],
      [1, 0.85, 0.6],
    ];
    // light strings round the front windows, and a candle on each sill
    const frames = [];
    const candles = [];
    for (const w of windows) {
      const z = w.z + 0.12;
      const edge = (ax, ay, bx, by) => {
        const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 0.2));
        for (let k = 0; k < n; k++) frames.push({ pos: [ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, z], colour: warm, phase: Math.random() });
      };
      const x0 = w.x0 - 0.12;
      const x1 = w.x1 + 0.12;
      const y0 = w.bottom - 0.1;
      const y1 = w.top + 0.1;
      edge(x0, y0, x1, y0);
      edge(x1, y0, x1, y1);
      edge(x1, y1, x0, y1);
      edge(x0, y1, x0, y0);
      candles.push({ pos: [(w.x0 + w.x1) / 2, w.bottom + 0.16, w.z - 0.12], colour: [1, 0.62, 0.22], phase: Math.random() });
    }
    this.extra.push(bulbs(frames, 0.11), bulbs(candles, 0.32));
    // fairy lights in the trees round the lawns (warm white) and the one outside the gate
    const fairy = [];
    for (const c of crowns) {
      const h = 11;
      const n = Math.round(c.r * 45);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const r = Math.pow(Math.random(), 0.3);
        const sq = Math.sqrt(1 - u * u);
        fairy.push({ pos: [c.x + Math.cos(a) * sq * r * c.r * 0.85, h * 0.6 + u * r * h * 0.32, c.z + Math.sin(a) * sq * r * c.r * 0.85], colour: i % 4 ? [1, 0.86, 0.6] : [0.85, 0.92, 1], phase: Math.random() });
      }
    }
    this.extra.push(bulbs(fairy, 0.12));
    // the gate's pillars: lights wound up them; and along the top of the wall either side
    const g = this._gate;
    if (g) {
      const spiral = [];
      for (const dir of [-1, 1]) {
        ray.set(new THREE.Vector3(g.x, 1.4, g.z + 0.3), new THREE.Vector3(dir, 0, 0));
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 6);
        if (!hit) continue;
        const cx = hit.point.x + dir * 0.42;
        ray.set(new THREE.Vector3(cx, 12, g.z + 0.3), new THREE.Vector3(0, -1, 0));
        const top = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 14)?.point.y ?? 3.5;
        for (let y = 0.3, a = 0; y < top - 0.1; y += 0.035, a += 0.32) spiral.push({ pos: [cx + Math.cos(a) * 0.56, y, g.z + 0.3 + Math.sin(a) * 0.56], colour: colours[Math.floor(a / 1.2) % 4], phase: Math.random(), along: y * 10 });
      }
      this.extra.push(bulbs(spiral, 0.1));
      this._traceTop(g.x - 22, g.x - 3.6, g.z + 6, g.z + 2.5, g.z - 2, 5, 0.16);
      this._traceTop(g.x + 3.6, g.x + 22, g.z + 6, g.z + 2.5, g.z - 2, 5, 0.16);
      // (the roofline's string grows by these: rebuilt with them)
      this.christmas.remove(this.outline);
      this.outline = bulbs(this._outline, 0.18, 'chase');
      this.christmas.add(this.outline);
    }
    // a wreath on the front door
    const door = this._door;
    if (door) {
      const out = door.normal.clone();
      if (out.z < 0) out.negate();
      const wreath = new THREE.Group();
      const green = new THREE.MeshStandardMaterial({ color: 0x1c4425, roughness: 0.85 });
      const red = new THREE.MeshStandardMaterial({ color: 0xa3120f, roughness: 0.45, emissive: 0x200202 });
      wreath.add(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.1, 10, 28), green));
      // (sprigs round it, berries, and a bow at the bottom)
      const sprig = new THREE.ConeGeometry(0.05, 0.16, 5);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        const m = new THREE.Mesh(sprig, green);
        m.position.set(Math.cos(a) * (0.33 + (k % 2 ? 0.07 : -0.05)), Math.sin(a) * (0.33 + (k % 2 ? 0.07 : -0.05)), 0.05);
        m.rotation.z = a + (k % 3) * 0.6;
        wreath.add(m);
      }
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), red);
        b.position.set(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.1);
        wreath.add(b);
      }
      for (const s of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), red);
        loop.position.set(s * 0.08, -0.33, 0.1);
        loop.rotation.z = (s * Math.PI) / 2;
        wreath.add(loop);
      }
      wreath.position.copy(door.centre).addScaledVector(out, 0.14).setY(door.y0 + 2.05);
      wreath.lookAt(wreath.position.clone().add(out));
      wreath.traverse((o) => o.isMesh && (o.castShadow = true));
      this.eve.add(wreath);
      // small trees in tubs either side of the door, white lights on them
      const side = new THREE.Vector3(out.z, 0, -out.x);
      const tubLights = [];
      for (const s of [-1.6, 1.6]) {
        const p = door.centre.clone().addScaledVector(side, s).addScaledVector(out, 1.5);
        const y = this._groundAt(p.x, p.z, door.y0 + 1.5) ?? door.y0;
        const t = fir(1.7);
        t.position.set(p.x, y, p.z);
        this.eve.add(t);
        for (let k = 0; k < 60; k++) {
          const f = k / 60;
          const a = f * Math.PI * 2 * 6;
          const r = 0.42 * (1 - f) + 0.04;
          tubLights.push({ pos: [p.x + Math.cos(a) * r, y + 0.45 + f * 1.2, p.z + Math.sin(a) * r], colour: [1, 0.88, 0.65], phase: Math.random() });
        }
      }
      this.extra.push(bulbs(tubLights, 0.08));
    }
    // the big tree on the lawn: a tall fir, coloured lights wound round it, a star on top
    if (treeAt) {
      const H = 6.2;
      const t = fir(H);
      t.position.copy(treeAt);
      this.eve.add(t);
      const lights = [];
      for (let k = 0; k < 420; k++) {
        const f = k / 420;
        const a = f * Math.PI * 2 * 11;
        const r = 1.7 * (1 - f) * 0.98 + 0.1;
        lights.push({ pos: [treeAt.x + Math.cos(a) * r, treeAt.y + 0.7 + f * (H - 1.1), treeAt.z + Math.sin(a) * r], colour: colours[k % colours.length], phase: Math.random() });
      }
      this.extra.push(bulbs(lights, 0.13));
      const star = new THREE.Mesh(starGeometry(0.34, 0.14, 0.07), new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffb830, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 }));
      star.position.set(treeAt.x, treeAt.y + H + 0.2, treeAt.z);
      this.star = star;
      this.eve.add(star);
      this.extra.push(bulbs([{ pos: [treeAt.x, treeAt.y + H + 0.2, treeAt.z], colour: [1, 0.85, 0.45], phase: 0 }], 1.1));
      this.treeAt = treeAt.clone();
    }
    for (const b of this.extra) this.christmas.add(b);
  }

  /**
   * @param dt seconds
   * @param level how far into the evening it is (the lamps' 0..1)
   * @param day day of the year
   * @param hours the clock
   * @param houseOn the house's light switch
   */
  update(dt, level, day, hours, houseOn) {
    const halloween = inRange(Math.floor(day), HALLOWEEN);
    const christmas = inRange(Math.floor(day), CHRISTMAS);
    this.halloween.visible = halloween;
    this.christmas.visible = christmas;
    const t = (this._t = (this._t ?? 0) + dt);
    if (halloween) {
      // candles inside: a flicker, lit from dusk (and a little by day, in the shade of the porch),
      // out at half past one
      const late = hours > 1.5 && hours < 6.5;
      const on = late ? 0 : Math.max(level, 0.12);
      const flicker = 0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 27 + 1.3);
      for (const pk of this.pumpkins) if (pk.userData.carved) pk.userData.mat.emissiveIntensity = 4 * on * flicker;
      if (this.pumpkinGlow) {
        this.pumpkinGlow.material.uniforms.uOn.value = on * flicker;
        this.pumpkinGlow.material.uniforms.uTime.value = t;
      }
      if (this.candle) this.candle.intensity = 6 * on * flicker;
    } else if (this.candle) this.candle.intensity = 0;
    if (christmas) {
      // dusk to half past midnight; from Christmas Eve to New Year's Eve, all day and all night
      // (by day they show a little less against the light)
      const allDay = inRange(Math.floor(day), ALL_DAY);
      const late = hours > 0.5 && hours < 6.5;
      const on = !houseOn ? 0 : allDay ? Math.max(level, 0.75) : late ? 0 : level;
      for (const p of [this.outline, this.icicles, this.treeLights, ...this.extra]) {
        p.material.uniforms.uOn.value = on;
        p.material.uniforms.uTime.value = t;
        p.material.uniforms.uShow.value = this.show;
        p.visible = on > 0.01;
      }
      // the dressing from Christmas Eve (the wreath, the trees) to Twelfth Night
      if (this.eve) this.eve.visible = inRange(Math.floor(day), [357, 5]);
      if (this.star) this.star.rotation.y = t * 0.3;
    }
  }

  /** Points need the screen's size to size their bulbs in metres. */
  setScale(scale) {
    for (const p of [this.pumpkinGlow, this.outline, this.icicles, this.treeLights, ...this.extra]) if (p) p.material.uniforms.uScale.value = scale;
  }
}
