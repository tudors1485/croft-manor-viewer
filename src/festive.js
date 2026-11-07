// The festive days. From 26 October to 3 November carved pumpkins sit either side of the
// front door, their faces glowing and flickering after dark (Halloween's ghosts and figures
// are in spooky.js, Bonfire Night's fire and fireworks in bonfire.js). From 1 December to
// Twelfth Night (6 January) there are Christmas lights: along the top of the front of the
// house (warm white, or a red, green and gold chase, changing every so often) with icicle
// lights dripping below, over the gate, and coloured ones twinkling in the two oaks at the
// entrance. They are lit from dusk to half past midnight, and from Christmas Eve to New Year's
// Eve all day and all night.

import * as THREE from 'three';

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
    this.update(0, 0, 145, 12, true);
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
      for (const p of [this.outline, this.icicles, this.treeLights]) {
        p.material.uniforms.uOn.value = on;
        p.material.uniforms.uTime.value = t;
        p.material.uniforms.uShow.value = this.show;
        p.visible = on > 0.01;
      }
    }
  }

  /** Points need the screen's size to size their bulbs in metres. */
  setScale(scale) {
    for (const p of [this.pumpkinGlow, this.outline, this.icicles, this.treeLights]) if (p) p.material.uniforms.uScale.value = scale;
  }
}
