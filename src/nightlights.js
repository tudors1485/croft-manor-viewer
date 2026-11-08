// Lights outside at night, beyond the porch lantern and the floodlights on the front: a lantern
// either side of the gateway, inside and out; four small uplights in the fountain's basin
// lighting the jet; and on the assault course, LED strips round the top edges of the crates,
// guiding the way through it in the dark. They come on at dusk with the rest (lamps.js). And your own light, if you want one, while you walk at night: a
// soft glow round you, a flashlight, or a flaming torch.

import * as THREE from 'three';
import { Particles, softDot } from './bonfire.js';

const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Where the night lights go, and their posts and housings.
 * @returns {{ fixtures: object[], group: THREE.Group }} fixtures for Lamps.addMore
 */
export function nightLights({ bvh, gate, fountain, crateMeshes = [] }) {
  const group = new THREE.Group();
  group.name = 'Night lights';
  const fixtures = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.6, metalness: 0.7 });
  const ray = new THREE.Ray();

  // --- the gateway: a lantern on its face either side of the arch, outside and in ---
  if (gate) {
    const housing = new THREE.BoxGeometry(0.2, 0.32, 0.2);
    // (one light for the four of them, in the gateway itself: every light costs every pixel)
    const gateLight = fixtures.length;
    fixtures.push({ pos: new THREE.Vector3(gate.x, 2.7, gate.z), kind: 'lantern', power: 9, glow: 0.0, range: 16 });
    for (const face of [1, -1]) {
      for (const side of [-1, 1]) {
        const x = gate.x + side * 1.85;
        ray.set(new THREE.Vector3(x, 2.6, gate.z + face * 5), new THREE.Vector3(0, 0, -face));
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 8);
        if (!hit) continue;
        const pos = new THREE.Vector3(x, 2.6, hit.point.z + face * 0.22);
        const box = new THREE.Mesh(housing, metal);
        box.position.copy(pos);
        box.castShadow = true;
        group.add(box);
        fixtures.push({ pos: pos.clone().setY(2.58), kind: 'lantern', power: 0, glow: 0.3, glowOnly: true, follow: gateLight });
      }
    }
  }

  // --- the fountain: four uplights in the basin, lighting the jet from below (one light for them all) ---
  let fountainLight = 0;
  if (fountain) {
    const c = fountain.getCenter(new THREE.Vector3());
    const r = Math.min(fountain.max.x - fountain.min.x, fountain.max.z - fountain.min.z) * 0.32;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      if (k === 0) fountainLight = fixtures.length;
      fixtures.push({ pos: new THREE.Vector3(c.x + Math.cos(a) * r, fountain.max.y + 0.06, c.z + Math.sin(a) * r), kind: 'fountain', power: 6, glow: 0.14, glowOnly: k > 0, follow: fountainLight });
    }
  }

  // --- the assault course: LED strips round the crates, at their foot and along their top edges,
  // guiding the way through it in the dark ---
  // (each crate is a stack of cubes, some turned at an angle, found from the cubes' own planks
  // (findCrates, below); a strip round the foot of each stack and round its top)
  const stacks = findCrates(crateMeshes);
  const segments = [];
  const feet = [];
  const ring = (r, h, out = 0.015) => {
    const c = Math.cos(r.angle);
    const sn = Math.sin(r.angle);
    const corner = (u, w) => new THREE.Vector3(r.cx + u * c - w * sn, h, r.cz + u * sn + w * c);
    const hx = r.hx + out;
    const hz = r.hz + out;
    const k = [corner(-hx, -hz), corner(hx, -hz), corner(hx, hz), corner(-hx, hz)];
    return [0, 1, 2, 3].map((i) => [k[i], k[(i + 1) % 4]]);
  };
  for (const st of stacks) {
    // where the ground is beside it (some crates are sunk into the sand)
    ray.set(new THREE.Vector3(st.foot.cx + st.foot.hx + st.foot.hz + 0.3, st.top.y + 1, st.foot.cz), DOWN);
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, st.top.y + 8);
    const ground = Math.max(st.foot.y, hit ? hit.point.y : st.foot.y);
    if (st.top.y - ground < 0.5) continue; // (sunk almost out of sight)
    const low = ring(st.foot, ground + 0.08);
    segments.push(...low, ...ring(st.top, st.top.y - 0.06));
    for (const [a, b] of low) feet.push([a, b, st.foot]);
  }
  // the light the foot strips throw on the sand round them: painted on, a soft band fading outwards
  const bandTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const r = g.createLinearGradient(0, 0, 0, 64);
    r.addColorStop(0, 'rgba(255,255,255,0.55)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.22)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(c);
  })();
  const bandMat = new THREE.MeshBasicMaterial({ map: bandTex, color: 0xcfe0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
  // (a plane lying flat, its near edge (v = 0) along the strip, reaching 0.7 m out)
  const bandGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  const bands = new THREE.InstancedMesh(bandGeo, bandMat, Math.max(1, feet.length));
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    feet.forEach(([a, b, foot], i) => {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      // outwards: away from the crate's middle
      const out = new THREE.Vector3(b.z - a.z, 0, -(b.x - a.x)).normalize();
      if (out.x * (mid.x - foot.cx) + out.z * (mid.z - foot.cz) < 0) out.negate();
      q.setFromAxisAngle(yAxis, Math.atan2(out.x, out.z));
      m.compose(mid.setY(mid.y - 0.06), q, new THREE.Vector3(a.distanceTo(b), 1, 0.7));
      bands.setMatrixAt(i, m);
    });
  }
  bands.count = feet.length;
  bands.renderOrder = 1;
  group.add(bands);
  // the strips: one draw for them all; dark plastic by day, lit white at night (main.js sets its colour)
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x0b0c0e });
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.035, 0.035), ledMat, Math.max(1, segments.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  segments.forEach(([a, b], i) => {
    const len = a.distanceTo(b);
    q.setFromAxisAngle(up, -Math.atan2(b.z - a.z, b.x - a.x));
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(len + 0.035, 1, 1));
    strips.setMatrixAt(i, m);
  });
  strips.count = segments.length;
  strips.name = 'Assault course LEDs';
  group.add(strips);
  // (the strips' switch: no light of its own, it goes on at dusk and off after midnight with the floodlights)
  const courseLight = fixtures.length;
  fixtures.push({ pos: new THREE.Vector3(9.5, 2, -74), kind: 'flood', power: 0, glow: 0, glowOnly: false });
  // a soft glow along the strips at their foot
  let glows = 0;
  for (const [a, b] of feet) {
    const n = Math.max(1, Math.round(a.distanceTo(b) / 1.2));
    for (let k = 0; k < n; k++) {
      const p = a.clone().lerp(b, (k + 0.5) / n);
      fixtures.push({ pos: p, kind: 'flood', power: 0, glow: 0.07, glowOnly: true, follow: courseLight, glowKind: 1 });
      glows++;
    }
  }
  return { fixtures, group, crates: stacks.length, strips: segments.length, glows, ledMat, bandMat, courseLight };
}

/**
 * The assault course's crates, from their planks. The planks' triangles joined where they share
 * corners make pieces; a piece standing up, a metre or more each way, is a cube's sides (or a
 * tower's). Each one's outline is the smallest rectangle round it, at whatever angle it stands;
 * cubes one above another are a stack.
 * @param {THREE.Mesh[]} meshes the crates' meshes
 * @returns {{foot: object, top: object}[]} each stack's lowest and highest cube: { cx, cz, hx, hz, angle, y }
 *   (y is the bottom of the foot, the top of the top)
 */
function findCrates(meshes) {
  const cubes = [];
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    if (!/straight/.test(mesh.material.name || '')) continue; // (the sides; the lids and corner trims follow them)
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const n = index ? index.count : pos.count;
    const at = (k) => (index ? index.getX(k) : k);
    // the triangles joined at shared corners (corners welded to a centimetre)
    const parent = new Int32Array(pos.count).map((_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    const weld = new Map();
    const world = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      world.set([v.x, v.y, v.z], i * 3);
      const key = `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;
      const w = weld.get(key);
      if (w === undefined) weld.set(key, i);
      else parent[find(i)] = find(w);
    }
    for (let k = 0; k < n; k += 3) {
      const a = find(at(k));
      parent[find(at(k + 1))] = a;
      parent[find(at(k + 2))] = a;
    }
    const pieces = new Map();
    for (let i = 0; i < pos.count; i++) {
      const r = find(i);
      let list = pieces.get(r);
      if (!list) pieces.set(r, (list = []));
      list.push(i);
    }
    for (const list of pieces.values()) {
      let y0 = Infinity;
      let y1 = -Infinity;
      let mx = 0;
      let mz = 0;
      for (const i of list) {
        y0 = Math.min(y0, world[i * 3 + 1]);
        y1 = Math.max(y1, world[i * 3 + 1]);
        mx += world[i * 3];
        mz += world[i * 3 + 2];
      }
      mx /= list.length;
      mz /= list.length;
      if (y1 - y0 < 0.8 || mz > -57 || mz < -90 || mx < -22 || mx > 41) continue; // (standing, on the course)
      // the smallest rectangle round it, trying each angle to a degree
      let best = null;
      for (let deg = 0; deg < 90; deg++) {
        const a = (deg * Math.PI) / 180;
        const c = Math.cos(a);
        const s = Math.sin(a);
        let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
        for (const i of list) {
          const x = world[i * 3];
          const z = world[i * 3 + 2];
          const u = x * c + z * s;
          const w = -x * s + z * c;
          u0 = Math.min(u0, u);
          u1 = Math.max(u1, u);
          w0 = Math.min(w0, w);
          w1 = Math.max(w1, w);
        }
        const area = (u1 - u0) * (w1 - w0);
        if (!best || area < best.area) best = { area, a, u0, u1, w0, w1 };
      }
      const hx = (best.u1 - best.u0) / 2;
      const hz = (best.w1 - best.w0) / 2;
      if (hx < 0.45 || hz < 0.45 || hx > 2.5 || hz > 2.5) continue; // (a cube, not a single plank or a long fence)
      const u = (best.u0 + best.u1) / 2;
      const w = (best.w0 + best.w1) / 2;
      const c = Math.cos(best.a);
      const s = Math.sin(best.a);
      cubes.push({ cx: u * c - w * s, cz: u * s + w * c, hx, hz, angle: best.a, y0, y1 });
    }
  }
  // stacks: cubes one above another (their middles within half a metre)
  const stacks = [];
  for (const cube of cubes.sort((p, q) => p.y0 - q.y0)) {
    const st = stacks.find((t) => Math.hypot(t.top.cx - cube.cx, t.top.cz - cube.cz) < 0.5 && cube.y0 < t.top.y + 0.4);
    if (st) {
      if (cube.y1 > st.top.y) st.top = { ...cube, y: cube.y1 };
    } else stacks.push({ foot: { ...cube, y: cube.y0 }, top: { ...cube, y: cube.y1 } });
  }
  return stacks;
}

/**
 * Your own light while you walk at night (each goes into the scene the first time you choose it,
 * then stays, dark when off: adding a light recompiles every shader, a moment's pause).
 * 'glow': a wide warm light all round you, as in Diablo, lighting the ground a good way about and fading softly at its rim.
 * 'flashlight': a torch in your right hand, its beam where you look, a faint cone of it in the air.
 * 'torch': a flaming torch held out on your right, the flame at the end of its stick, flickering,
 * throwing sparks, lighting you and all round you.
 * The torches are drawn over everything (they are nearest), so they never go into a wall.
 */
export class MyLight {
  constructor(scene) {
    this.scene = scene;
    this.kind = 'off';
    // (v0.58.0, Tudor: "bigger, like the Diablo light": a wide warm pool round you that fades softly at its rim)
    this.glow = new THREE.PointLight(0xffd9a8, 0, 34, 1.05);
    this.fire = new THREE.PointLight(0xff8a3a, 0, 28, 1.25);
    // a broad, soft fill that the flaming torch and the torch carry with them, lighting the ground all round you
    this.pool = new THREE.PointLight(0xffc68a, 0, 30, 1.1);
    this.beam = new THREE.SpotLight(0xf6f2ea, 0, 55, 0.42, 0.65, 1.5);
    scene.add(this.beam.target);

    // what you hold, moved with the view (a little behind it as you turn, as a hand is)
    this.hand = new THREE.Group();
    this.hand.name = 'Your light';
    this.hand.visible = false;
    scene.add(this.hand);
    const over = (m) => {
      m.depthTest = false;
      m.depthWrite = false;
      return m;
    };
    // (the things you hold are drawn unlit, their light painted on: the flame's own light so close
    // would burn them white, and at night nothing else would show them)
    // the torch (a flashlight): a grey metal body and a wider head, their tops catching the light
    const metal = over(new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.metal = metal;
    this.flashlight = new THREE.Group();
    const body = new THREE.Mesh(shade(new THREE.CylinderGeometry(0.017, 0.016, 0.17, 16).rotateX(Math.PI / 2), (n) => 0.045 + 0.09 * Math.max(0, n.y) + 0.02 * Math.max(0, -n.x)), metal);
    body.position.z = 0.03;
    const head = new THREE.Mesh(shade(new THREE.CylinderGeometry(0.027, 0.019, 0.055, 18).rotateX(Math.PI / 2), (n) => 0.055 + 0.11 * Math.max(0, n.y)), metal);
    head.position.z = -0.075;
    // (the lens faces away from you: only where the beam starts)
    this.lens = new THREE.Object3D();
    this.lens.position.z = -0.11;
    // (drawn over everything, so the nearer part last)
    head.renderOrder = 31;
    body.renderOrder = 32;
    this.flashlight.add(body, head, this.lens);
    this.flashlight.position.set(0.21, -0.24, -0.42);
    this.flashlight.rotation.set(0.1, 0.22, 0);
    // its beam in the air: a faint cone, brightest near the lens, fading out
    const cone = new THREE.CylinderGeometry(2.6, 0.03, 9, 24, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -4.5 - 0.1);
    this.cone = new THREE.Mesh(
      cone,
      new THREE.ShaderMaterial({
        uniforms: { uOn: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vAlong;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vAlong = clamp(-(position.z + 0.1) / 9.0, 0.0, 1.0);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOn;
          varying float vAlong;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            // (soft at the cone's edges as you see it, fading with distance from the lens)
            float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.5);
            float a = uOn * edge * pow(1.0 - vAlong, 2.2) * 0.05;
            gl_FragColor = vec4(vec3(1.0, 0.98, 0.93) * a, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.cone.renderOrder = 29;
    this.flashlight.add(this.cone);
    this.hand.add(this.flashlight);

    // the flaming torch: a wooden stick, lit warm by the flame near the top and dark below; the head
    // bound in pitch-soaked cloth, charred black, glowing where it burns at the top
    this.torch = new THREE.Group();
    const wood = over(new THREE.MeshBasicMaterial({ vertexColors: true }));
    const cloth = over(new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.wood = wood;
    this.cloth = cloth;
    const stick = new THREE.Mesh(
      shade(new THREE.CylinderGeometry(0.016, 0.022, 0.6, 10).translate(0, -0.3, 0), (n, p) => {
        const near = Math.exp((p.y - 0) / 0.18); // (1 at the top, falling away down the stick)
        const side = 0.55 + 0.45 * Math.max(0, n.x * -0.6 + n.z * 0.8);
        return [(0.05 + 0.4 * near) * side, (0.03 + 0.17 * near) * side, (0.018 + 0.06 * near) * side];
      }),
      wood,
    );
    const wrap = new THREE.Mesh(
      shade(new THREE.CylinderGeometry(0.034, 0.028, 0.12, 14, 6).translate(0, 0.02, 0), (n, p) => {
        // (charred black, the cloth's folds catching the flame's light, embers glowing at the top)
        const fold = 0.5 + 0.5 * Math.sin(Math.atan2(p.z, p.x) * 7 + p.y * 60);
        const burn = THREE.MathUtils.smoothstep(p.y, 0.045, 0.08) * (0.4 + 0.6 * fold);
        const lit = 0.03 + 0.05 * fold * THREE.MathUtils.smoothstep(p.y, -0.04, 0.06);
        return [lit + 0.75 * burn, lit * 0.7 + 0.22 * burn, lit * 0.5 + 0.03 * burn];
      }),
      cloth,
    );
    stick.renderOrder = 30;
    wrap.renderOrder = 31;
    this.torch.add(stick, wrap);
    // (held out in the right hand, the head forward and up, leaning a little out)
    this.torch.position.set(0.34, -0.23, -0.62);
    this.torch.rotation.set(-0.34, 0, -0.18);
    this.hand.add(this.torch);
    // its flame: tongues of fire rising from the head (in the world, so they trail as you move),
    // and now and then a spark
    this.flames = new Particles(90, { map: softDot(0.2) });
    this.sparks = new Particles(30, { map: softDot(0.05) });
    for (const p of [this.flames, this.sparks]) {
      p.material.depthTest = false;
      p.points.renderOrder = 33;
      p.points.visible = false;
      scene.add(p.points);
    }
    this._head = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this.t = 0;
    this.amount = 0;
    this.noise = 0;
  }

  /** Which light: 'off', 'glow', 'flashlight' or 'torch'. */
  set(kind) {
    this.kind = kind;
    const light = { glow: this.glow, flashlight: this.beam, torch: this.fire }[kind];
    if (light && !light.parent) this.scene.add(light);
    if ((kind === 'torch' || kind === 'flashlight') && !this.pool.parent) this.scene.add(this.pool);
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} camera
   * @param {boolean} walking on your feet
   * @param {number} dark 0 light enough .. 1 dark
   * @param {number} scale the particles' size on screen (the focal length in pixels)
   */
  update(dt, camera, walking, dark, scale = 800) {
    this.t += dt;
    const want = walking && this.kind !== 'off' ? dark : 0;
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 4));
    const a = this.amount;
    const on = (k) => (this.kind === k ? a : 0);
    this.hand.visible = a > 0.01 && (this.kind === 'flashlight' || this.kind === 'torch');
    this.flames.points.visible = this.sparks.points.visible = this.hand.visible && this.kind === 'torch';
    if (a < 0.001 && this.kind === 'off') return; // (nothing to light: no work)
    // the hand follows the view a moment behind as you turn
    this.hand.position.copy(camera.position);
    this._q.copy(camera.quaternion);
    if (this.hand.userData.held) this.hand.quaternion.slerp(this._q, 1 - Math.exp(-dt * 14));
    else this.hand.quaternion.copy(this._q);
    this.hand.userData.held = this.hand.visible;
    this.flashlight.visible = this.kind === 'flashlight';
    this.torch.visible = this.kind === 'torch';
    this.hand.updateMatrixWorld(true);

    // the glow, a little above your head
    this.glow.position.copy(camera.position).add(UP_HALF);
    this.glow.intensity = 34 * on('glow');
    // the pool round you with a torch in hand: higher up, so it spreads wide and soft over the ground
    this.pool.position.copy(camera.position).add(UP_POOL);
    this.pool.intensity = 10 * on('torch') + 5 * on('flashlight');

    // the torch's beam, from its lens, where you look
    if (this.kind === 'flashlight') {
      this.lens.getWorldPosition(this.beam.position);
      const fwd = camera.getWorldDirection((this._fwd ??= new THREE.Vector3()));
      this.beam.target.position.copy(camera.position).addScaledVector(fwd, 14);
      this.cone.material.uniforms.uOn.value = a;
    }
    this.beam.intensity = 70 * on('flashlight');

    // the flaming torch: an uneven flicker, the flame's tongues, sparks
    this.noise += (Math.random() - 0.5) * dt * 9;
    this.noise *= Math.exp(-dt * 4);
    const flick = THREE.MathUtils.clamp(0.82 + 0.08 * Math.sin(this.t * 7.3) + 0.06 * Math.sin(this.t * 13.9 + 1.1) + 0.05 * Math.sin(this.t * 23.1 + 2.3) + this.noise, 0.55, 1.1);
    const f = on('torch');
    this._head.set(0, 0.09, 0);
    this.torch.localToWorld(this._head);
    // (the light just behind the flame, towards you: never on the far side of a wall you are facing)
    this.fire.position.copy(this._head).lerp(camera.position, 0.35);
    this.fire.position.y += 0.08;
    this.fire.intensity = 15 * f * flick;
    this.pool.intensity *= 0.85 + 0.15 * flick;
    this.cloth.color.setScalar(0.65 + 0.4 * flick);
    this.wood.color.setScalar(0.75 + 0.3 * flick);
    const fl = this.flames;
    const sp = this.sparks;
    if (this.flames.points.visible) {
      // (a flame about a hand high: many small tongues, short-lived, hottest and whitest low down)
      for (let n = Math.floor(dt * 220 * f + Math.random()); n > 0; n--) {
        const i = fl.spawn();
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.028;
        fl.pos.set([this._head.x + Math.cos(ang) * r, this._head.y - 0.03 + Math.random() * 0.03, this._head.z + Math.sin(ang) * r], i * 3);
        fl.vel.set([(Math.random() - 0.5) * 0.08, 0.32 + Math.random() * 0.3, (Math.random() - 0.5) * 0.08], i * 3);
        fl.life[i] = fl.data[i * 4] = 0.16 + Math.random() * 0.2;
        fl.data[i * 4 + 1] = 0.032 + Math.random() * 0.03;
      }
      if (Math.random() < dt * 2.5 * f) {
        const i = sp.spawn();
        sp.pos.set([this._head.x, this._head.y + 0.05, this._head.z], i * 3);
        sp.vel.set([(Math.random() - 0.5) * 0.5, 0.8 + Math.random() * 0.9, (Math.random() - 0.5) * 0.5], i * 3);
        sp.life[i] = sp.data[i * 4] = 0.6 + Math.random() * 0.9;
      }
    }
    for (let i = 0; i < fl.count; i++) {
      if (fl.life[i] <= 0) {
        fl.alpha[i] = 0;
        continue;
      }
      fl.life[i] -= dt;
      const u = 1 - Math.max(0, fl.life[i]) / fl.data[i * 4];
      for (let k = 0; k < 3; k++) fl.pos[i * 3 + k] += fl.vel[i * 3 + k] * dt;
      // (pulled in towards the middle as it rises: a tapering flame, licking from side to side)
      fl.pos[i * 3] += (Math.sin(this.t * 11 + i) * 0.06 - (fl.pos[i * 3] - this._head.x) * 2.5) * dt;
      fl.pos[i * 3 + 2] += -(fl.pos[i * 3 + 2] - this._head.z) * 2.5 * dt;
      fl.col.set([1.15, THREE.MathUtils.lerp(0.85, 0.28, u), THREE.MathUtils.lerp(0.5, 0.04, Math.min(1, u * 1.8))], i * 3);
      fl.size[i] = fl.data[i * 4 + 1] * (1 - 0.6 * u);
      fl.alpha[i] = Math.sin(Math.min(1, u * 6) * Math.PI * 0.5) * (1 - u) * (1 - u) * 0.75 * f;
    }
    fl.flush();
    for (let i = 0; i < sp.count; i++) {
      if (sp.life[i] <= 0) {
        sp.alpha[i] = 0;
        continue;
      }
      sp.life[i] -= dt;
      const u = 1 - Math.max(0, sp.life[i]) / sp.data[i * 4];
      sp.vel[i * 3 + 1] -= 0.5 * dt;
      for (let k = 0; k < 3; k++) sp.pos[i * 3 + k] += sp.vel[i * 3 + k] * dt;
      sp.col.set([1.6, 0.7 * (1 - u) + 0.25, 0.1], i * 3);
      sp.size[i] = 0.008;
      sp.alpha[i] = (1 - u) * f;
    }
    sp.flush();
    fl.material.uniforms.uScale.value = sp.material.uniforms.uScale.value = scale;
  }
}

const UP_HALF = new THREE.Vector3(0, 1.2, 0);
const UP_POOL = new THREE.Vector3(0, 2.4, 0);

/** Paints a geometry's vertices: `paint(normal, position)` gives a grey level or [r, g, b]. */
function shade(geo, paint) {
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = paint(n.fromBufferAttribute(nor, i), p.fromBufferAttribute(pos, i));
    col.set(Array.isArray(c) ? c : [c, c, c * 1.06], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
