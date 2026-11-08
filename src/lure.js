// Halloween night outside: the one who lures you away, and the house dressed for it.
//
// - In the gateway stands a dark figure, still, facing the house: only once your back has been
//   turned on the gate (it is never there while you watch; turn round and it is). Come near and it is
//   gone, in a breath of smoke; a little later it stands further off down the drive, in the fog, waiting;
//   whispering, giggling, moaning, whistling to draw you on. Follow it and it runs on, off the drive
//   and across the fields, to a place in a clearing: an old graveyard behind an iron fence round a
//   dead tree with a swing. Step inside and the candles on the graves flare, a music box plays, the
//   swing swings by itself, and the figure is standing in the open grave; dark figures stand all
//   round among the stones. The lightning strikes, and they are all gone. Leave, and later it is
//   back in the gateway.
// - The house: cobwebs in the porch, the gate's arch and the corners of the windows; sheet ghosts
//   hanging from the oaks by the gate, swaying; a skeleton waiting on the steps; a few headstones on
//   the front lawn; pumpkins lit along both sides of the drive; bats round the roof.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { pumpkin, bulbs } from './festive.js';

const RUN = 5.2; // m/s
const NEAR = 13; // come this close and it runs

function canvasTex(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A cobweb in a corner: radial threads from the corner and sagging spirals between them. */
function webTexture() {
  return canvasTex((g, W) => {
    g.strokeStyle = 'rgba(235,235,240,0.75)';
    g.lineWidth = 1.4;
    const rays = 9;
    const ends = [];
    for (let i = 0; i <= rays; i++) {
      const a = (i / rays) * (Math.PI / 2);
      const r = W * (0.85 + Math.random() * 0.15);
      ends.push(a);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      g.stroke();
    }
    g.lineWidth = 1;
    for (let k = 1; k < 14; k++) {
      const r = W * 0.065 * k;
      g.beginPath();
      for (let i = 0; i < rays; i++) {
        const a0 = ends[i];
        const a1 = ends[i + 1];
        const p0 = [Math.cos(a0) * r, Math.sin(a0) * r];
        const p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
        const am = (a0 + a1) / 2;
        const sag = r * 0.82;
        if (i === 0) g.moveTo(p0[0], p0[1]);
        g.quadraticCurveTo(Math.cos(am) * sag, Math.sin(am) * sag, p1[0], p1[1]);
      }
      g.stroke();
    }
  });
}

/** Weathered grey stone for the headstones. */
export function stoneTexture() {
  return canvasTex((g, W, H) => {
    g.fillStyle = '#8c8a84';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 3000; i++) {
      const v = 90 + Math.random() * 90;
      g.fillStyle = `rgba(${v},${v},${v - 6},${0.08 + Math.random() * 0.12})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 5, 1 + Math.random() * 3);
    }
    // lichen
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${90 + Math.random() * 40},${100 + Math.random() * 40},50,0.35)`;
      g.beginPath();
      g.arc(Math.random() * W, H * (0.4 + Math.random() * 0.6), 3 + Math.random() * 12, 0, Math.PI * 2);
      g.fill();
    }
    // an inscription worn almost away
    g.fillStyle = 'rgba(40,38,34,0.45)';
    for (let r = 0; r < 4; r++) g.fillRect(W * 0.25, H * (0.3 + r * 0.1), W * (0.5 - (r % 2) * 0.12), 4);
  });
}

/** A headstone: a slab with a rounded top (or a cross), set crooked in the ground. */
export function headstone(mat, kind) {
  if (kind === 'cross') {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.12).translate(0, 0.6, 0), mat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.12).translate(0, 0.86, 0), mat));
    return g;
  }
  const w = 0.55 + Math.random() * 0.25;
  const h = 0.75 + Math.random() * 0.45;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 });
  geo.translate(0, 0, -0.05);
  // (the texture across its face)
  const uv = geo.attributes.uv;
  const p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h);
  const m = new THREE.Mesh(geo, mat);
  return m;
}

/** A soft dark breath of smoke (where the figure in the gateway was). */
function puffTexture() {
  return canvasTex((g, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (Math.random() - 0.5) * w * 0.36;
      const y = h / 2 + (Math.random() - 0.5) * h * 0.36;
      const r = w * (0.12 + Math.random() * 0.16);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }
  }, 128, 128);
}

/** A dark figure in a long coat, whole, from head to foot: the same outline as spooky.js's. */
function figureTexture() {
  return canvasTex((g) => {
    g.fillStyle = '#000';
    g.filter = 'blur(2px)';
    g.beginPath();
    g.ellipse(48, 26, 11, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(42, 38);
    g.lineTo(54, 38);
    g.quadraticCurveTo(76, 44, 74, 70);
    g.lineTo(80, 238);
    g.lineTo(58, 246);
    g.lineTo(56, 252);
    g.lineTo(40, 252);
    g.lineTo(38, 246);
    g.lineTo(16, 238);
    g.lineTo(22, 70);
    g.quadraticCurveTo(20, 44, 42, 38);
    g.closePath();
    g.fill();
  }, 96, 256);
}

function glowTex() {
  return canvasTex((g, W) => {
    const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    r.addColorStop(0, 'rgba(255,240,200,1)');
    r.addColorStop(0.2, 'rgba(255,190,100,0.6)');
    r.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, W, W);
  }, 64, 64);
}

export class Lure {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {{x:number,z:number}} o.gate
   * @param {(x: number, z: number) => number} o.ground the height of the ground, inside and out
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh
   * @param {object} o.landscape (its crowns and billboards: a clearing is made for the graveyard)
   * @param {object} [o.door] the front door ({ centre, normal })
   * @param {{ sample: Function, has?: Function }} [o.sound]
   */
  constructor(scene, { gate, ground, bvh, landscape, door = null, sound = null }) {
    this.scene = scene;
    this.ground = ground;
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Halloween outside';
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0;
    const g = gate ?? { x: 4.6, z: 20.7 };
    const at = (x, z) => new THREE.Vector3(x, ground(x, z), z);
    // the way: the gateway, down the drive, off it across the field, to the graveyard
    this.grave = at(-62, 150);
    this.stops = [at(g.x, g.z + 0.5), at(g.x - 0.4, 54), at(g.x + 0.3, 86), at(-14, 112), at(-40, 136), this.grave.clone().add(new THREE.Vector3(0, 0, -1.6))];
    this.stop = 0;
    this.state = 'wait';
    this.pos = this.stops[0].clone();
    this.heading = Math.PI; // facing the house (-z)
    this.callIn = 4;
    this.rearm = 0;
    // in the gateway: there only once you have turned your back on it for a moment, gone when you near
    this.shown = false;
    this.unseen = 0;
    this.away = 0; // (gone from the gate: how long until it stands down the drive)
    this._frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._sphere = new THREE.Sphere(new THREE.Vector3(), 1.1);
    this.puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0x0b0a0c, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    this.puff.visible = false;
    this.puffT = 0;
    // a clearing for the graveyard: the woods' billboards there taken away
    this._clearing(landscape, this.grave, 22);
    this._buildGraveyard();
    this._dressHouse({ gate: g, bvh, landscape, door });
    // the figure: a dark silhouette until the walker model loads (then a dark robed figure)
    this.sil = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.85).translate(0, 0.92, 0), new THREE.MeshBasicMaterial({ map: figureTexture(), color: 0x020203, transparent: true, alphaTest: 0.05, depthWrite: false, fog: true }));
    this.group.add(this.sil, this.puff);
    this.figure = null;
  }

  _clearing(landscape, c, r) {
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    landscape?.group.traverse((o) => {
      if (!o.isInstancedMesh || !o.material.uniforms?.uMap) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        if (Math.hypot(p.x - c.x, p.z - c.z) < r) o.setMatrixAt(i, zero);
      }
      o.instanceMatrix.needsUpdate = true;
    });
  }

  async load(base = '') {
    if (this.loading) return;
    this.loading = true;
    const loader = new GLTFLoader();
    const get = (n) => loader.loadAsync(`${base}models/halloween/${n}.glb`).catch(() => null);
    const [walker, ghost, skeleton] = await Promise.all([get('walker'), get('sheet-ghost'), get('skeleton')]);
    if (walker) {
      const m = cloneSkinned(walker.scene);
      // all in black: a dark figure, its face hidden
      const dark = new THREE.MeshStandardMaterial({ color: 0x0a0909, roughness: 0.95 });
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.material = dark;
        o.frustumCulled = false;
        o.castShadow = true;
      });
      const holder = new THREE.Group();
      holder.add(m);
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(m);
      const act = (n) => {
        const c = walker.animations.find((a) => a.name === n);
        return c ? mixer.clipAction(c) : null;
      };
      const walk = act('Walk');
      const idle = act('Idle');
      idle?.play();
      this.figure = { holder, mixer, walk, idle, current: idle };
      this.sil.visible = false;
    }
    // sheet ghosts hanging from the branches of the oaks by the gate
    if (ghost && this.ghostSpots) {
      for (const s of this.ghostSpots) {
        const o = ghost.scene.clone(true);
        const box = new THREE.Box3().setFromObject(o);
        o.scale.setScalar(1.3 / (box.max.y - box.min.y));
        const b2 = new THREE.Box3().setFromObject(o);
        o.position.y = -b2.max.y; // (hanging below its pivot)
        o.traverse((n) => {
          if (n.isMesh) {
            n.material = n.material.clone();
            n.material.emissive = new THREE.Color(0x1a1d22);
            n.castShadow = true;
          }
        });
        const pivot = new THREE.Group();
        pivot.position.copy(s);
        pivot.add(o);
        // the cord
        pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.6, 0)]), new THREE.LineBasicMaterial({ color: 0x222222 })));
        this.group.add(pivot);
        this.ghosts.push({ pivot, phase: Math.random() * 6 });
      }
    }
    // a skeleton sitting on the steps by the door, waiting
    if (skeleton && this.stepSpot) {
      const m = cloneSkinned(skeleton.scene);
      const box = new THREE.Box3().setFromObject(m, true);
      m.scale.setScalar(1.75 / (box.max.y - box.min.y));
      m.traverse((o) => {
        if (o.isMesh) {
          o.frustumCulled = false;
          o.castShadow = true;
        }
      });
      const holder = new THREE.Group();
      holder.add(m);
      holder.position.copy(this.stepSpot.pos);
      holder.rotation.y = this.stepSpot.yaw;
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(m);
      const clip = skeleton.animations.find((a) => /idle/i.test(a.name)) ?? skeleton.animations[0];
      if (clip) mixer.clipAction(clip).play();
      const wave = skeleton.animations.find((a) => /wave/i.test(a.name));
      this.skeleton = { holder, mixer, wave: wave ? mixer.clipAction(wave) : null, idle: clip ? mixer.clipAction(clip) : null, waving: false };
    }
    this.loaded = true;
  }

  // --- the graveyard in the clearing ---------------------------------------------------------

  _buildGraveyard() {
    const c = this.grave;
    const g = new THREE.Group();
    g.position.copy(c);
    this.graveGroup = g;
    this.group.add(g);
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x16151a, roughness: 0.6, metalness: 0.6 });
    const earth = new THREE.MeshStandardMaterial({ color: 0x2c2418, roughness: 1 });
    // trodden earth and dead grass under it all
    const ground = new THREE.Mesh(new THREE.CircleGeometry(12.5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3524, roughness: 1 }));
    ground.position.y = 0.02;
    ground.receiveShadow = true;
    g.add(ground);
    // the fence: railings with spikes round it, a gap for the gate on the side you come from
    const R = 11;
    const bars = [];
    for (let a = 0; a < Math.PI * 2; a += 0.11) {
      const gateDir = Math.atan2(-0.6, 0.8); // (towards the drive: north-east)
      let d = a - gateDir;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.12) continue;
      bars.push(a);
    }
    const bar = new THREE.CylinderGeometry(0.018, 0.018, 1.6, 5).translate(0, 0.8, 0);
    const spike = new THREE.ConeGeometry(0.04, 0.12, 4).translate(0, 1.66, 0);
    const im = new THREE.InstancedMesh(bar, iron, bars.length);
    const is = new THREE.InstancedMesh(spike, iron, bars.length);
    const m = new THREE.Matrix4();
    bars.forEach((a, i) => {
      // (leaning here and there: old)
      const lean = new THREE.Matrix4().makeRotationZ((Math.random() - 0.5) * 0.12);
      m.makeTranslation(Math.cos(a) * R, 0, Math.sin(a) * R).multiply(lean);
      im.setMatrixAt(i, m);
      is.setMatrixAt(i, m);
    });
    g.add(im, is);
    for (const y of [0.3, 1.35]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.02, 4, 90), iron);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = y;
      g.add(rail);
    }
    // the headstones, in crooked rows, and two crosses; an open grave by the tree
    this.graveStones = [];
    const R2 = (n) => (Math.random() - 0.5) * n;
    for (let row = -2; row <= 2; row++) {
      for (let k = -3; k <= 3; k++) {
        if (Math.abs(row) < 1 && Math.abs(k) < 2) continue; // (the middle: the tree and the grave)
        if (Math.random() < 0.25) continue;
        const x = k * 2.2 + R2(0.5);
        const z = row * 2.6 + R2(0.4);
        if (Math.hypot(x, z) > R - 1.4) continue;
        const h = headstone(stone, Math.random() < 0.12 ? 'cross' : 'slab');
        h.position.set(x, -0.08, z);
        h.rotation.set(R2(0.25), Math.PI * 0.2 + R2(0.3), R2(0.25));
        h.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
        g.add(h);
        this.graveStones.push(new THREE.Vector3(x, 0, z));
      }
    }
    // the open grave: a dark hole and the heap of earth beside it
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050403 }));
    hole.position.set(0, 0.03, -1.6);
    g.add(hole);
    const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8).scale(0.6, 0.35, 1.1), earth);
    heap.position.set(1.1, 0, -1.6);
    g.add(heap);
    // the dead tree, and the swing on its low branch
    const bark = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 1 });
    const branch = (from, to, r0, r1) => {
      const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(R2(0.6), 0.3, R2(0.6))), to);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, r0, 6), bark);
      tube.castShadow = true;
      g.add(tube);
      return curve;
    };
    branch(new THREE.Vector3(0, -0.2, 1.2), new THREE.Vector3(0.2, 5.2, 1.0), 0.32, 0.2);
    const arm = branch(new THREE.Vector3(0.15, 3.4, 1.1), new THREE.Vector3(3.2, 4.2, 1.5), 0.14, 0.06);
    branch(new THREE.Vector3(0.1, 4.2, 1.0), new THREE.Vector3(-2.6, 6.3, 0.2), 0.12, 0.05);
    branch(new THREE.Vector3(0.2, 5.0, 1.0), new THREE.Vector3(1.4, 7.4, -0.6), 0.1, 0.04);
    branch(new THREE.Vector3(-1.2, 5.0, 0.6), new THREE.Vector3(-2.2, 6.8, 1.8), 0.06, 0.03);
    const top = arm.getPoint(0.72);
    this.swing = new THREE.Group();
    this.swing.position.copy(top);
    const rope = new THREE.LineBasicMaterial({ color: 0x8a7a5c });
    const len = top.y - 0.55;
    this.swing.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.22, 0, 0), new THREE.Vector3(-0.22, -len, 0), new THREE.Vector3(0.22, 0, 0), new THREE.Vector3(0.22, -len, 0)]), rope));
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }));
    seat.position.y = -len;
    seat.castShadow = true;
    this.swing.add(seat);
    g.add(this.swing);
    // candles on the graves, unlit until you come in
    const candles = this.graveStones.slice(0, 18).map((p) => ({ pos: [c.x + p.x + 0.25, c.y + 0.1, c.z + p.z + 0.25], colour: [1, 0.6, 0.22], phase: Math.random() }));
    this.candles = bulbs(candles, 0.16);
    this.group.add(this.candles);
    this.graveLight = new THREE.PointLight(0xffa04a, 0, 30, 1.2);
    this.graveLight.position.set(c.x, c.y + 1.2, c.z);
    this.graveHome = this.graveLight.position.clone(); // (graves.js borrows the light while it is dark)
    this.scene.add(this.graveLight);
    // the dark ones among the stones (hidden till the moment)
    const figTex = figureTexture();
    this.watchers = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 8.5 + Math.random() * 1.5;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.85).translate(0, 0.92, 0), new THREE.MeshBasicMaterial({ map: figTex, color: 0x020203, transparent: true, opacity: 0, alphaTest: 0.05, depthWrite: false }));
      w.position.set(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r);
      w.visible = false;
      this.group.add(w);
      this.watchers.push(w);
    }
    this.moment = 0; // 0 nothing .. the surprise running (seconds)
    this.swingA = 0;
  }

  // --- the house dressed for Halloween -------------------------------------------------------

  _dressHouse({ gate, bvh, landscape, door }) {
    const webTex = webTexture();
    const webMat = new THREE.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const ray = new THREE.Ray();
    const web = (corner, right, down, size) => {
      // a web spanning a corner: from `corner`, along `right` and `down`
      const geo = new THREE.BufferGeometry();
      const a = corner;
      const b = corner.clone().addScaledVector(right, size);
      const d = corner.clone().addScaledVector(down, size);
      const e = corner.clone().addScaledVector(right, size).addScaledVector(down, size);
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...e.toArray(), ...d.toArray()], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(geo, webMat);
      m.renderOrder = 5;
      this.group.add(m);
    };
    // the gate's arch: in its two top corners, inside and out
    const up = new THREE.Vector3(0, 1, 0);
    const down = new THREE.Vector3(0, -1, 0);
    for (const side of [-1, 1]) {
      ray.set(new THREE.Vector3(gate.x, 2.2, gate.z + 0.2), new THREE.Vector3(side, 0, 0));
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 4);
      if (!hit) continue;
      ray.set(new THREE.Vector3(hit.point.x - side * 0.05, 1.5, gate.z + 0.2), up);
      const top = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 5);
      if (!top) continue;
      for (const dz of [1.2, -0.8]) web(new THREE.Vector3(hit.point.x - side * 0.03, top.point.y - 0.05, gate.z + dz), new THREE.Vector3(-side, 0, 0), down, 0.75);
    }
    // the porch: the corners of its opening, and the door's
    if (door) {
      const out = door.normal.clone();
      if (out.z < 0) out.negate();
      const side = new THREE.Vector3(out.z, 0, -out.x);
      for (const s of [-1, 1]) {
        ray.set(door.centre.clone().addScaledVector(out, 1.2).setY(2.3), side.clone().multiplyScalar(s));
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 3);
        if (!hit) continue;
        ray.set(hit.point.clone().addScaledVector(side, -s * 0.05), up);
        const top = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 4);
        if (!top) continue;
        web(new THREE.Vector3(hit.point.x - side.x * s * 0.03, top.point.y - 0.04, hit.point.z), side.clone().multiplyScalar(-s), down, 0.95);
      }
      // the skeleton: sitting on the top step by the door, to one side
      const p = door.centre.clone().addScaledVector(out, 2.4).addScaledVector(side, 1.1);
      ray.set(p.clone().setY(door.y0 + 2), down);
      const step = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 4);
      this.stepSpot = { pos: step ? step.point.clone() : p.setY(door.y0), yaw: Math.atan2(out.x, out.z) - 0.3 };
    }
    // the webs in the corners of the front windows' heads (a few of them)
    // (the sheet ghosts: hanging from the gate oaks, on the side away from the path)
    this.ghosts = [];
    this.ghostSpots = [];
    for (const c of (landscape?.crowns ?? []).filter((c) => Math.hypot(c.x - gate.x, c.z - (gate.z - 4)) < 9)) {
      for (const a of [0.4, 2.6]) this.ghostSpots.push(new THREE.Vector3(c.x + Math.cos(a) * c.r * 0.55, c.y0 + 1.2, c.z + Math.sin(a) * c.r * 0.55));
    }
    // headstones on the front lawn, west of the drive, as a joke graveyard
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95 });
    for (const [x, z, r] of [
      [-9, 4, 0.2],
      [-10.6, 4.4, -0.15],
      [-12.2, 3.8, 0.35],
      [-9.8, 6.1, -0.3],
      [-11.6, 6.2, 0.1],
    ]) {
      if (!landscape?._grassAt(x, z)) continue;
      const h = headstone(stone, 'slab');
      h.position.set(x, this.ground(x, z) - 0.06, z);
      h.rotation.set(0.12 * Math.sin(x * 3), Math.PI + r, 0.1 * Math.cos(z * 5));
      h.castShadow = true;
      this.group.add(h);
    }
    // pumpkins lit along both edges of the drive, from the gate to the porch
    this.pumpkins = [];
    const lights = [];
    if (landscape?.drive) {
      for (let z = gate.z - 3; z > -4; z -= 3.2) {
        for (const sx of [-1, 1]) {
          const x = gate.x + sx * (z > 12 ? 2.4 : 3.6);
          const y = this.ground(x, z);
          const r = 0.17 + Math.random() * 0.08;
          const pk = pumpkin(r, Math.random() < 0.5 ? 0 : 1);
          pk.position.set(x, y, z);
          pk.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
          this.group.add(pk);
          this.pumpkins.push(pk);
          lights.push({ pos: [x - sx * r * 0.9, y + r * 0.75, z], colour: [1, 0.5, 0.12], phase: Math.random() });
        }
      }
    }
    this.pumpkinGlow = bulbs(lights, 0.45);
    this.group.add(this.pumpkinGlow);
    // bats round the roof: a pair of black wings each, flapping
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.06, 0.32, 0.02, -0.02, 0.22, 0, -0.12, 0, 0, -0.08], 3));
    wing.setIndex([0, 1, 2, 0, 2, 3]);
    const batMat = new THREE.MeshBasicMaterial({ color: 0x050405, side: THREE.DoubleSide });
    this.bats = [];
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Group();
      const l = new THREE.Mesh(wing, batMat);
      const r = new THREE.Mesh(wing, batMat);
      r.scale.x = -1;
      b.add(l, r, new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4).scale(1, 1, 1.8), batMat));
      this.group.add(b);
      this.bats.push({ b, l, r, a: Math.random() * 6.28, rad: 14 + Math.random() * 16, h: 12 + Math.random() * 8, sp: 0.35 + Math.random() * 0.3, ph: Math.random() * 6 });
    }
  }

  /** A flyby starts, or the date jumps: back to the gateway. */
  reset() {
    this.stop = 0;
    this.state = 'wait';
    this.shown = false;
    this.unseen = 0;
    this.pos.copy(this.stops[0]);
    this.heading = Math.PI;
    this.moment = 0;
  }

  _call(name, gain = 0.8) {
    if (!this.sound?.has?.(name)) return;
    this.sound.sample(name, this.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), { ref: 8, rolloff: 1.0, max: 300, gain });
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {boolean} o.on Halloween night
   * @param {boolean} o.flight a flyby is on (the lure keeps still then)
   * @param {THREE.Camera} o.camera
   * @param {number} o.flash the lightning 0..1
   * @param {number} o.level the lamps (dusk) 0..1
   * @param {() => void} o.strike asks for a close strike of lightning
   * @param {number} [o.scale] the focal length, for the glows
   */
  update(dt, { on, flight, camera, flash = 0, level = 1, strike, scale }) {
    this.group.visible = on;
    if (!on) {
      this.graveLight.intensity = 0;
      return;
    }
    if (!this.loaded) this.load().catch((err) => console.warn('Halloween outside did not load:', err.message));
    this.sound?.has?.('music-box'); // (the long recording, fetched ahead of the moment)
    this.t += dt;
    const t = this.t;
    const cam = camera.position;
    if (scale) for (const p of [this.candles, this.pumpkinGlow]) p.material.uniforms.uScale.value = scale;
    const flick = 0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 27 + 1.3);
    // the pumpkins along the drive
    for (const pk of this.pumpkins) if (pk.userData.carved) pk.userData.mat.emissiveIntensity = 4 * Math.max(level, 0.15) * flick;
    this.pumpkinGlow.material.uniforms.uOn.value = Math.max(level, 0.15) * flick;
    this.pumpkinGlow.material.uniforms.uTime.value = t;
    // the ghosts sway; the bats circle; the skeleton waves when you come up the steps
    for (const g of this.ghosts) {
      g.pivot.rotation.z = 0.12 * Math.sin(t * 0.9 + g.phase);
      g.pivot.rotation.x = 0.06 * Math.sin(t * 0.7 + g.phase * 2);
      g.pivot.rotation.y += dt * 0.15 * Math.sin(t * 0.2 + g.phase);
    }
    for (const b of this.bats) {
      b.a += dt * b.sp;
      const x = 6 + Math.cos(b.a) * b.rad + Math.sin(t * 1.3 + b.ph) * 2;
      const z = -21 + Math.sin(b.a) * b.rad * 0.8 + Math.cos(t * 1.1 + b.ph) * 2;
      b.b.position.set(x, b.h + Math.sin(t * 2.3 + b.ph) * 1.2, z);
      b.b.rotation.y = -b.a;
      const f = Math.sin(t * 22 + b.ph) * 0.9;
      b.l.rotation.z = f;
      b.r.rotation.z = -f;
    }
    if (this.skeleton) {
      const near = cam.distanceTo(this.skeleton.holder.position) < 5;
      if (near !== this.skeleton.waving && this.skeleton.wave && this.skeleton.idle) {
        this.skeleton.waving = near;
        const [a, b] = near ? [this.skeleton.idle, this.skeleton.wave] : [this.skeleton.wave, this.skeleton.idle];
        b.reset().play();
        a.crossFadeTo(b, 0.4, false);
      }
      this.skeleton.mixer.update(dt);
    }

    // --- the one who lures you ---
    const fig = this.figure;
    const d = Math.hypot(cam.x - this.pos.x, cam.z - this.pos.z);
    let moving = false;
    // the gateway: is it in view? (there only once it has been behind you for a moment, and you a
    // little way off; never appearing while you look)
    if (this.stop === 0 && this.state === 'wait' && !this.shown) {
      camera.updateMatrixWorld();
      this._frustum.setFromProjectionMatrix(this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      this._sphere.center.copy(this.pos).setY(this.pos.y + 1);
      const seen = this._frustum.intersectsSphere(this._sphere);
      this.unseen = seen ? 0 : this.unseen + dt;
      if (this.unseen > 1.2 && d > 14 && !flight) this.shown = true;
    }
    if (!flight) {
      if (this.state === 'vanished') {
        // gone from the gate: a little later it stands further down the drive
        this.away -= dt;
        if (this.away <= 0) {
          this.pos.copy(this.stops[this.stop]);
          this.state = 'wait';
          this.callIn = 2.5;
        }
      } else if (this.state === 'wait' && this.stop === 0) {
        if (this.shown) {
          // facing you, calling you on now and then
          const want = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
          let dy = want - this.heading;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          this.heading += dy * (1 - Math.exp(-dt * 1.5));
          this.callIn -= dt;
          if (this.callIn <= 0 && d < 120) {
            this.callIn = 7 + Math.random() * 8;
            this._call(['whispers', 'child-giggle', 'moan', 'eerie-whistle'][Math.floor(Math.random() * 4)], 0.75);
          }
          // come close and it is gone, in a breath of smoke
          if (d < 9) {
            this.puff.position.copy(this.pos).setY(this.pos.y + 1.1);
            this.puff.visible = true;
            this.puffT = 0.001;
            this._call('whispers', 0.9);
            this.shown = false;
            this.state = 'vanished';
            this.stop = 1;
            this.away = 2.5;
          }
        }
      } else if (this.state === 'wait') {
        // facing you
        const want = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
        let dy = want - this.heading;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.heading += dy * (1 - Math.exp(-dt * 1.5));
        // calling you on, now and then, when you are within earshot
        this.callIn -= dt;
        if (this.callIn <= 0 && d < 120 && this.stop < this.stops.length - 1) {
          this.callIn = 7 + Math.random() * 8;
          this._call(['whispers', 'child-giggle', 'moan', 'eerie-whistle'][Math.floor(Math.random() * 4)], 0.75);
        }
        if (d < NEAR && this.stop < this.stops.length - 1) {
          this.state = 'run';
          this.stop++;
          this._call('child-giggle', 0.9);
          this.runSound = 0;
        }
      } else if (this.state === 'run') {
        const to = this.stops[this.stop].clone().sub(this.pos).setY(0);
        const dist = to.length();
        if (dist < 0.3) {
          this.state = 'wait';
          this.callIn = 2.5;
        } else {
          moving = true;
          this.pos.addScaledVector(to.normalize(), Math.min(dist, RUN * dt));
          this.heading = Math.atan2(to.x, to.z);
          this.runSound -= dt;
          if (this.runSound <= 0 && d < 60) {
            this.runSound = 2.2;
            this._call('running-gravel', 0.5);
          }
        }
      }
      this.pos.y = this.ground(this.pos.x, this.pos.z);
    }
    // the graveyard: step inside the fence and it all happens
    const inYard = Math.hypot(cam.x - this.grave.x, cam.z - this.grave.z) < 10.5 && cam.y < this.grave.y + 6;
    if (inYard && this.moment === 0 && this.stop === this.stops.length - 1) {
      this.moment = 0.001;
      if (this.sound?.has?.('music-box')) this.sound.sample('music-box', this.grave.clone().add(new THREE.Vector3(0, 1, 1.2)), { ref: 5, rolloff: 1.1, max: 120, gain: 0.8 });
    }
    let candles = 0;
    let watchers = 0;
    if (this.moment > 0) {
      this.moment += dt;
      const m = this.moment;
      candles = THREE.MathUtils.smoothstep(m, 0, 1.2);
      // the swing: swinging higher and higher by itself
      this.swingA = Math.min(0.75, m * 0.06) * Math.sin(m * 1.9);
      // the dark ones: there among the stones from the fourth second
      watchers = THREE.MathUtils.smoothstep(m, 4, 6);
      if (m > 13 && !this.struck) {
        this.struck = true;
        strike?.();
      }
      if (this.struck && flash > 0.55) {
        // the flash: all gone, candles out, swing still, the figure gone
        this.moment = -1;
        this.gone = 40;
      }
    } else if (this.moment < 0) {
      // (gone; once you have walked away, it is back at the gate)
      this.swingA *= 1 - dt * 0.6;
      this.gone -= dt;
      if (this.gone <= 0 && Math.hypot(cam.x - this.grave.x, cam.z - this.grave.z) > 60) {
        this.reset();
        this.struck = false;
      }
    } else this.swingA = 0.04 * Math.sin(t * 1.2);
    this.swing.rotation.x = this.swingA;
    this.candles.material.uniforms.uOn.value = candles * flick;
    this.candles.material.uniforms.uTime.value = t;
    if (this.moment !== 0) {
      this.graveLight.position.copy(this.graveHome);
      this.graveLight.distance = 30;
      this.graveLight.decay = 1.2;
      this.graveLight.intensity = 26 * candles * flick;
    } else this.graveLight.intensity = 0; // (graves.js may light it over another graveyard after this)
    for (const w of this.watchers) {
      w.visible = watchers > 0.01;
      w.material.opacity = watchers;
      w.rotation.y = Math.atan2(cam.x - w.position.x, cam.z - w.position.z);
    }
    // the breath of smoke where it stood
    if (this.puffT > 0) {
      this.puffT += dt;
      const k = this.puffT / 1.4;
      this.puff.scale.setScalar(0.8 + 2.4 * k);
      this.puff.material.opacity = 0.85 * (1 - k) * Math.min(1, this.puffT * 8);
      this.puff.position.y += dt * 0.4;
      if (k >= 1) {
        this.puffT = 0;
        this.puff.visible = false;
      }
    }
    // the figure (in the grave during the moment; gone after it; in the gateway only once shown)
    const hidden = this.moment < 0 || this.state === 'vanished' || (this.stop === 0 && !this.shown);
    const where = this.moment > 0 ? this.grave.clone().add(new THREE.Vector3(0, -0.5, -1.6)) : this.pos;
    if (fig) {
      fig.holder.visible = !hidden;
      fig.holder.position.copy(where);
      fig.holder.rotation.y = this.moment > 0 ? Math.atan2(cam.x - where.x, cam.z - where.z) : this.heading;
      const want = moving ? fig.walk : fig.idle;
      if (want && want !== fig.current) {
        want.reset().play();
        fig.current?.crossFadeTo(want, 0.2, false);
        fig.current = want;
      }
      if (fig.walk) fig.walk.timeScale = 2.4; // (running)
      fig.mixer.update(dt);
    } else {
      this.sil.visible = !hidden;
      this.sil.position.copy(where);
      this.sil.rotation.y = Math.atan2(cam.x - where.x, cam.z - where.z);
    }
  }
}
