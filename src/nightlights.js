// Lights outside at night, beyond the porch lantern and the floodlights on the front: a lantern
// either side of the gateway, inside and out; four small uplights in the fountain's basin
// lighting the jet; and on the assault course, safety lights for training after dark: a
// floodlight pole at each corner of the sand and amber markers along the boxes. They come on at
// dusk with the rest (lamps.js). And your own light, if you want one, while you walk at night: a
// soft glow round you, a flashlight, or a flaming torch.

import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Where the night lights go, and their posts and housings.
 * @returns {{ fixtures: object[], group: THREE.Group }} fixtures for Lamps.addMore
 */
export function nightLights({ bvh, materialAt, gate, fountain }) {
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

  // --- the assault course: a floodlight pole at each corner of the sand, amber markers on the boxes ---
  const pole = new THREE.CylinderGeometry(0.07, 0.1, 7, 8).translate(0, 3.5, 0);
  const arm = new THREE.BoxGeometry(1.1, 0.08, 0.08);
  const head = new THREE.BoxGeometry(0.36, 0.22, 0.3);
  const corners = [
    [-23.5, -56.5],
    [42.5, -56.5],
    [-23.5, -91.5],
    [42.5, -91.5],
  ];
  // (one light high over the middle of the course does for the four poles; the pools of light
  // they throw on the sand are painted on, a glow on the ground)
  const courseLight = fixtures.length;
  fixtures.push({ pos: new THREE.Vector3(9.5, 14, -74), kind: 'flood', power: 60, glow: 0, range: 60 });
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,225,170,0.36)');
    r.addColorStop(0.5, 'rgba(255,215,160,0.14)');
    r.addColorStop(1, 'rgba(255,210,150,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  const pools = [];
  const floodIndex = [];
  for (const [x, z] of corners) {
    ray.set(new THREE.Vector3(x, 30, z), DOWN);
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
    const y0 = hit ? hit.point.y : 0;
    const p = new THREE.Group();
    p.position.set(x, y0, z);
    // facing the middle of the course
    p.rotation.y = Math.atan2(9.5 - x, -74 - z);
    const m = new THREE.Mesh(pole, metal);
    m.castShadow = true;
    const a = new THREE.Mesh(arm, metal);
    a.position.set(0, 6.9, 0.1);
    p.add(m, a);
    for (const s of [-0.42, 0.42]) {
      const h = new THREE.Mesh(head, metal);
      h.position.set(s, 6.8, 0.25);
      h.rotation.x = 0.5;
      p.add(h);
    }
    group.add(p);
    const lamp = new THREE.Vector3(0, 6.7, 0.4).applyEuler(p.rotation).add(p.position);
    floodIndex.push(courseLight);
    fixtures.push({ pos: lamp, kind: 'flood', power: 0, glow: 0.55, glowOnly: true, follow: courseLight });
    // its pool of light on the sand, a few metres out towards the course
    const at = new THREE.Vector3(0, 0, 9).applyEuler(p.rotation).add(p.position);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2), poolMat);
    pool.position.set(at.x, y0 + 0.08, at.z);
    pool.renderOrder = 1;
    group.add(pool);
    pools.push(pool);
  }
  // the markers: on the tops of the boxes, every few metres along them
  const tops = [];
  for (let x = -20; x <= 40; x += 1.5) {
    for (let z = -89; z <= -12; z += 1.5) {
      ray.set(new THREE.Vector3(x, 14, z), DOWN);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 20);
      if (!hit || Math.abs(hit.face.normal.y) < 0.9 || hit.point.y < 0.4) continue;
      if (!/assault_box/.test(materialAt(hit.faceIndex))) continue;
      if (tops.every((t) => t.distanceTo(hit.point) > 6)) tops.push(hit.point.clone());
    }
  }
  for (const t of tops.slice(0, 40)) {
    // (each follows the nearest pole's switch)
    let near = 0;
    corners.forEach(([x, z], k) => {
      if (Math.hypot(x - t.x, z - t.z) < Math.hypot(corners[near][0] - t.x, corners[near][1] - t.z)) near = k;
    });
    fixtures.push({ pos: t.clone().setY(t.y + 0.06), kind: 'marker', power: 0, glow: 0.12, glowOnly: true, follow: floodIndex[near], glowKind: 3 });
  }
  return { fixtures, group, markers: tops.length, poolMat, courseLight };
}

/**
 * Your own light while you walk at night (always in the scene, dark when off: adding lights later
 * would recompile every shader). 'glow': a soft warm light all round you, lighting the ground a
 * few metres about; 'flashlight': a cool beam where you look; 'torch': a flame in your right hand,
 * flickering, with its glow in the corner of your eye.
 */
export class MyLight {
  constructor(scene) {
    this.scene = scene;
    this.kind = 'off';
    // (each goes into the scene only once you choose it, then stays: a light costs every pixel,
    // and adding one recompiles every shader, a moment's pause when you pick it)
    this.glow = new THREE.PointLight(0xffd9a8, 0, 10, 1.4);
    this.torch = new THREE.PointLight(0xff9440, 0, 14, 1.8);
    this.beam = new THREE.SpotLight(0xf1f5ff, 0, 48, 0.36, 0.5, 1.3);
    scene.add(this.beam.target);
    // the torch's flame, seen low on the right as you walk
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 36, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,240,190,1)');
    grad.addColorStop(0.25, 'rgba(255,170,70,0.75)');
    grad.addColorStop(0.6, 'rgba(255,100,30,0.18)');
    grad.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.flame.scale.set(0.09, 0.14, 1);
    this.flame.renderOrder = 20;
    scene.add(this.flame);
    this.t = 0;
    this.amount = 0;
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} camera
   * @param {boolean} walking on your feet
   * @param {number} dark 0 light enough .. 1 dark
   */
  /** Which light: 'off', 'glow', 'flashlight' or 'torch'. */
  set(kind) {
    this.kind = kind;
    const light = { glow: this.glow, flashlight: this.beam, torch: this.torch }[kind];
    if (light && !light.parent) this.scene.add(light);
  }

  update(dt, camera, walking, dark) {
    this.t += dt;
    const want = walking && this.kind !== 'off' ? dark : 0;
    this.amount += (want - this.amount) * (1 - Math.exp(-dt * 4));
    const a = this.amount;
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
    const on = (k) => (this.kind === k ? a : 0);
    // the glow, a little above your head
    this.glow.position.copy(camera.position).add(new THREE.Vector3(0, 0.5, 0));
    this.glow.intensity = 7.5 * on('glow');
    // the flashlight, from your chest, where you look
    this.beam.position.copy(camera.position).addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.35, 0));
    this.beam.target.position.copy(camera.position).addScaledVector(fwd, 12);
    this.beam.intensity = 60 * on('flashlight');
    // the torch, held out on the right, flickering
    const flick = 0.78 + 0.12 * Math.sin(this.t * 11) + 0.1 * Math.sin(this.t * 27 + 1.3);
    const hand = camera.position.clone().addScaledVector(right, 0.42).addScaledVector(fwd, 0.55).add(new THREE.Vector3(0, -0.28, 0));
    this.torch.position.copy(hand).add(new THREE.Vector3(0, 0.15, 0));
    this.torch.intensity = 9 * on('torch') * flick;
    this.flame.position.copy(hand).add(new THREE.Vector3(0, 0.06, 0));
    this.flame.material.opacity = on('torch') * (0.75 + 0.25 * flick);
    this.flame.visible = this.flame.material.opacity > 0.01;
  }
}
