// Fifty years empty (Scenes › Sights): the manor as it would be if nobody had lived there since the
// seventies. A grey late-October afternoon. Every outside surface grimed, streaked black under the
// sills and copings, green with damp from the ground up and mossy wherever it faces the sky (the
// shader is materials.js's weatherShader, switched on by seasonUniforms.uDecay); the lawn gone to
// rank grass and straw. Ivy over most of the walls, thick from the ground and thinning as it climbs,
// round the windows rather than over them. The windows filthy, half of them broken (jagged holes
// into the dark rooms, glass on the ground below) and many of the ground floor's boarded up. Holes
// in the roof down to the rafters, slates slipped round them and smashed on the ground under the
// eaves, buddleia growing out of the parapets and the chimneys. Long grass, docks and brambles
// over the lawns and up through the gravel, saplings of sycamore and birch come up in them, a
// big tree down across the lawn with its root plate in the air, dead branches everywhere. The
// fountain dry, full of black leaves. A chain and padlock on the gate and a faded sign. Dead leaves
// blowing across the ground. No lamps, no clock ticking, no birdsong but the crows, the wind
// round the house, and a creak or a bang somewhere inside now and then (sound.js).
//
// Everything is built here from boxes, cards and canvases, the first time the scene is chosen, and
// fitted to the model with rays (the windows from the glass mesh, the ivy and the roof from the
// BVH). Another scene or Reset puts the house back as it was.

import * as THREE from 'three';
import { seasonUniforms } from './season.js';
import { addTreeShader } from './landscape.js';
import { leavesPicture, cardsGeometry, ballPlace } from './garden.js';

const HOUSE = { x0: -15.5, x1: 29.5, z0: -33, z1: -9 }; // the house's footprint, roughly
const CENTRE = new THREE.Vector3(4, 0, -21);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth 1D value noise (for where the ivy climbs high and where it doesn't). */
function noise1(x, seed = 0) {
  const h = (i) => {
    const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

function canvasTexture(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Ivy: a clump of dark, glossy, lobed leaves with pale veins, ragged at the edge (alpha). */
function ivyPicture(seed = 31) {
  const R = rng(seed);
  return canvasTexture(256, 256, (g, S) => {
    const cols = ['#142710', '#1a3113', '#213a17', '#28451b', '#2f4f1f', '#3a5a26', '#20361a'];
    for (let i = 0; i < 70; i++) {
      const a = R() * Math.PI * 2;
      const r = Math.pow(R(), 0.6) * S * 0.42;
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r;
      const l = 16 + R() * 18;
      g.save();
      g.translate(x, y);
      g.rotate(R() * Math.PI * 2);
      g.fillStyle = cols[Math.floor(R() * cols.length)];
      // five lobes, the middle one longest
      g.beginPath();
      g.moveTo(0, l * 0.35);
      for (const [ang, len] of [
        [-2.3, 0.55],
        [-1.25, 0.75],
        [0, 1],
        [1.25, 0.75],
        [2.3, 0.55],
      ]) {
        const tx = Math.sin(ang) * l * len;
        const ty = -Math.cos(ang) * l * len;
        g.quadraticCurveTo(tx * 0.55 - ty * 0.25, ty * 0.55 + tx * 0.25, tx, ty);
        g.quadraticCurveTo(tx * 0.55 + ty * 0.25, ty * 0.55 - tx * 0.25, 0, 0);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(150, 175, 120, 0.45)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, l * 0.3);
      g.lineTo(0, -l * 0.8);
      g.stroke();
      g.restore();
    }
  });
}

/** Rank grass gone to seed: pale straw and old olive blades, seed heads at their tips (alpha). */
function rankGrassPicture(seed = 17) {
  const R = rng(seed);
  return canvasTexture(256, 256, (g, W) => {
    for (let i = 0; i < 190; i++) {
      const x0 = W * (0.15 + R() * 0.7);
      const h = W * (0.3 + R() * 0.68);
      const lean = (R() - 0.5) * W * 0.7;
      const w = 0.8 + R() * 1.8;
      const dry = R();
      const grd = g.createLinearGradient(0, W, 0, W - h);
      grd.addColorStop(0, `rgb(${84 + dry * 40}, ${92 + dry * 26}, ${46 + dry * 12})`);
      grd.addColorStop(0.5, `rgb(${120 + dry * 60}, ${124 + dry * 40}, ${64 + dry * 24})`);
      grd.addColorStop(1, `rgb(${178 + dry * 40}, ${164 + dry * 30}, ${108 + dry * 20})`);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x0 - w, W);
      g.quadraticCurveTo(x0 + lean * 0.3, W - h * 0.6, x0 + lean, W - h);
      g.quadraticCurveTo(x0 + lean * 0.3 + w * 0.6, W - h * 0.6, x0 + w, W);
      g.closePath();
      g.fill();
      if (R() < 0.25) {
        // a seed head
        g.fillStyle = `rgb(${150 + dry * 40}, ${130 + dry * 30}, ${90 + dry * 20})`;
        g.beginPath();
        g.ellipse(x0 + lean, W - h + 8, 2.2, 9, Math.atan2(lean, h) * 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** Weathered grey boards: silvered, split, with dark grain and old nail stains. */
function boardPicture(seed = 41) {
  const R = rng(seed);
  return canvasTexture(256, 64, (g, W, H) => {
    g.fillStyle = '#7d766a';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const y = R() * H;
      g.strokeStyle = `rgba(${40 + R() * 40}, ${36 + R() * 30}, ${30 + R() * 25}, ${0.15 + R() * 0.35})`;
      g.lineWidth = 0.5 + R() * 1.5;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.3, y + (R() - 0.5) * 6, W * 0.7, y + (R() - 0.5) * 6, W, y + (R() - 0.5) * 4);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(${60 + R() * 30}, ${30 + R() * 15}, 15, 0.6)`;
      const x = R() < 0.5 ? 8 + R() * 6 : W - 14 + R() * 6;
      g.beginPath();
      g.ellipse(x, H * (0.25 + R() * 0.5), 2.5, 4 + R() * 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    // green-black weathering at the ends
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, 'rgba(30, 40, 20, 0.5)');
    grd.addColorStop(0.15, 'rgba(30, 40, 20, 0)');
    grd.addColorStop(0.85, 'rgba(30, 40, 20, 0)');
    grd.addColorStop(1, 'rgba(30, 40, 20, 0.5)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  });
}

/** Leaf litter: a mat of brown, black and ochre leaves, rotting into silt (tiles). */
function litterPicture(seed = 51) {
  const R = rng(seed);
  return canvasTexture(256, 256, (g, S) => {
    g.fillStyle = '#3a2c1c';
    g.fillRect(0, 0, S, S);
    const cols = ['#4b3520', '#5e4220', '#74522a', '#8a6430', '#3b2c1c', '#9a7038', '#5a4630', '#2e2418', '#6b5a3a'];
    for (let i = 0; i < 900; i++) {
      const x = R() * S;
      const y = R() * S;
      const l = 6 + R() * 12;
      for (const dx of [-S, 0, S])
        for (const dy of [-S, 0, S]) {
          g.save();
          g.translate(x + dx, y + dy);
          g.rotate(R() * Math.PI);
          g.fillStyle = cols[Math.floor(R() * cols.length)];
          g.beginPath();
          g.ellipse(0, 0, l / 2, l * 0.3, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
    }
  }, { repeat: true });
}

/** A dead leaf on the wind: one curled brown leaf (alpha). */
function deadLeafPicture() {
  return canvasTexture(64, 64, (g) => {
    g.translate(32, 32);
    g.fillStyle = '#8a5a26';
    g.beginPath();
    g.moveTo(0, -26);
    g.quadraticCurveTo(20, -8, 0, 26);
    g.quadraticCurveTo(-20, -8, 0, -26);
    g.fill();
    g.strokeStyle = '#4a2e12';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -24);
    g.lineTo(0, 26);
    g.stroke();
  });
}

/** Bark: dark grey-brown, furrowed (tiles round the trunk). */
function barkPicture(seed = 61) {
  const R = rng(seed);
  return canvasTexture(128, 256, (g, W, H) => {
    g.fillStyle = '#6a6052';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = R() * W;
      g.strokeStyle = `rgba(${15 + R() * 20}, ${14 + R() * 15}, ${10 + R() * 10}, ${0.4 + R() * 0.5})`;
      g.lineWidth = 1 + R() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (R() - 0.5) * 20, H * 0.33, x + (R() - 0.5) * 20, H * 0.66, x, H);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${70 + R() * 30}, ${90 + R() * 30}, ${50 + R() * 20}, 0.35)`;
      g.fillRect(R() * W, R() * H, 4 + R() * 10, 3 + R() * 6);
    }
  }, { repeat: true });
}

/** The sign on the gate: faded red on white, rust running from its screws. */
function signPicture() {
  return canvasTexture(512, 320, (g, W, H) => {
    g.fillStyle = '#d9d2bf';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#9a4a3c';
    g.fillRect(0, 0, W, 92);
    g.fillStyle = '#efe6d2';
    g.font = 'bold 64px Helvetica, Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('DANGER', W / 2, 70);
    g.fillStyle = '#3a3530';
    g.font = 'bold 42px Helvetica, Arial, sans-serif';
    g.fillText('UNSAFE BUILDING', W / 2, 150);
    g.fillText('KEEP OUT', W / 2, 200);
    g.font = '24px Helvetica, Arial, sans-serif';
    g.fillText('Trespassers will be prosecuted', W / 2, 250);
    // rust from the screws, grime from the top
    for (const [x, y] of [
      [18, 18],
      [W - 18, 18],
      [18, H - 18],
      [W - 18, H - 18],
    ]) {
      const grd = g.createLinearGradient(0, y, 0, y + 120);
      grd.addColorStop(0, 'rgba(110, 50, 20, 0.85)');
      grd.addColorStop(1, 'rgba(110, 50, 20, 0)');
      g.fillStyle = grd;
      g.fillRect(x - 4, y, 8 + Math.random() * 4, 120);
      g.fillStyle = '#4a2a18';
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
    const grime = g.createLinearGradient(0, 0, 0, H);
    grime.addColorStop(0, 'rgba(60, 55, 40, 0.35)');
    grime.addColorStop(0.5, 'rgba(60, 55, 40, 0.1)');
    grime.addColorStop(1, 'rgba(40, 50, 30, 0.4)');
    g.fillStyle = grime;
    g.fillRect(0, 0, W, H);
  });
}

/** Many copies of one shape in one draw. */
function instanced(geometry, material, items, { shadow = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  items.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = items.length;
  im.castShadow = shadow;
  im.receiveShadow = receive;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

export class Abandoned {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {object} o.landscape  (groundHeight, _grassAt, lawn, wind, gate)
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh  the estate's BVH (world space)
   * @param {(faceIndex:number)=>string} o.materialAt  the material's name at a face of the BVH
   * @param {THREE.Object3D} o.model
   * @param {object|null} o.water  the water system (its outdoor surfaces, the jet)
   * @param {import('./sound.js').Soundscape|null} o.sound
   * @param {THREE.Vector3[]} o.doors  the doors' centres (nothing grows across them)
   */
  constructor(scene, { landscape, bvh, materialAt, model, water = null, sound = null, doors = [] }) {
    this.scene = scene;
    this.landscape = landscape;
    this.bvh = bvh;
    this.materialAt = materialAt;
    this.model = model;
    this.water = water;
    this.sound = sound;
    this.doors = doors;
    this.on = false;
    this.built = false;
    this.group = new THREE.Group();
    this.group.name = 'Fifty years empty';
    this.group.visible = false;
    scene.add(this.group);
    this.time = 0;
    this.next = { crow: 3, creak: 9, bang: 25 };
    this.windows = [];
    this.glass = null; // the windows' glass mesh (hidden: each window gets its own dirty or broken pane)
    this.pond = null;
    this.ray = new THREE.Ray();
  }

  get ground() {
    return (x, z) => this.landscape.groundHeight(x, z) ?? 0.04;
  }

  set(on) {
    if (on === this.on) return;
    this.on = on;
    if (on && !this.built) this._build();
    this.group.visible = on;
    seasonUniforms.uDecay.value = on ? 1 : 0;
    if (this.glass) this.glass.visible = !on;
    if (this.pond) this.pond.mesh.visible = !on;
    if (this.sound) this.sound.abandoned = on;
    this.garden?.group.traverse((o) => o.userData.tidy && (o.visible = !on));
    if (on) this.next = { crow: 2 + Math.random() * 3, creak: 7 + Math.random() * 6, bang: 20 + Math.random() * 20 };
  }

  _hit(origin, dir, far) {
    this.ray.origin.copy(origin);
    this.ray.direction.copy(dir);
    const h = this.bvh.raycastFirst(this.ray, THREE.DoubleSide, 0, far);
    if (!h) return null;
    const n = h.face.normal.clone();
    if (n.dot(dir) > 0) n.negate(); // (towards where the ray came from)
    return { point: h.point.clone(), normal: n, name: this.materialAt(h.faceIndex) || '', distance: h.distance };
  }

  _build() {
    const t0 = performance.now();
    this.built = true;
    this.R = rng(19761027);
    // (a phone or a tablet: about half as much grass, ivy and bramble)
    this.light = !!window.matchMedia?.('(pointer: coarse)').matches;
    this.pictures = { ivy: ivyPicture(), board: boardPicture(), litter: litterPicture(), leaf: deadLeafPicture(), bark: barkPicture() };
    this.stats = {};
    this._findWindows();
    this._windows();
    this._roof();
    this._ivy();
    this._grass();
    this._brambles();
    this._saplings();
    this._fallenTree();
    this._branches();
    this._fountain();
    this._gate();
    this._driftingLeaves();
    this.stats.ms = Math.round(performance.now() - t0);
    console.info('fifty years empty', JSON.stringify(this.stats));
  }

  // --- windows ---------------------------------------------------------------------------------

  /** The windows: the panes of the house's one glass mesh for its big windows, one box each. */
  _findWindows() {
    let glass = null;
    this.model.traverse((o) => {
      if (o.isMesh && /^cm_glass/.test(o.material.name || '') && /Window_Large/.test(o.name)) glass = o;
    });
    if (!glass) return;
    this.glass = glass;
    glass.updateMatrixWorld(true);
    const pos = glass.geometry.attributes.position;
    const idx = glass.geometry.index;
    const tris = idx ? idx.count / 3 : pos.count / 3;
    const boxes = [];
    const v = new THREE.Vector3();
    for (let t = 0; t < tris; t++) {
      const b = new THREE.Box3();
      for (let k = 0; k < 3; k++) b.expandByPoint(v.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(glass.matrixWorld));
      const near = boxes.find((o) => o.clone().expandByScalar(0.06).intersectsBox(b));
      if (near) near.union(b);
      else boxes.push(b);
    }
    // (merge again: two triangles of one pane can each have met a different half first)
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < boxes.length && !changed; i++)
        for (let j = i + 1; j < boxes.length; j++)
          if (boxes[i].clone().expandByScalar(0.06).intersectsBox(boxes[j])) {
            boxes[i].union(boxes[j]);
            boxes.splice(j, 1);
            changed = true;
            break;
          }
    }
    for (const b of boxes) {
      const size = b.getSize(new THREE.Vector3());
      if (size.y < 0.6) continue;
      const alongX = size.x > size.z;
      const c = b.getCenter(new THREE.Vector3());
      const out = alongX ? new THREE.Vector3(0, 0, Math.sign(c.z - CENTRE.z) || 1) : new THREE.Vector3(Math.sign(c.x - CENTRE.x) || 1, 0, 0);
      this.windows.push({ box: b, centre: c, w: alongX ? size.x : size.z, h: size.y, out, alongX });
    }
    this.stats.windows = this.windows.length;
  }

  _windows() {
    const R = this.R;
    const dirty = new THREE.MeshStandardMaterial({ color: 0x26251d, roughness: 0.85, metalness: 0.05, transparent: true, opacity: 0.93, side: THREE.DoubleSide, envMapIntensity: 0.2 });
    const boardMat = new THREE.MeshStandardMaterial({ map: this.pictures.board, roughness: 0.95 });
    const shardMat = new THREE.MeshStandardMaterial({ color: 0x9aa39c, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const boards = [];
    const shards = [];
    let nBoarded = 0;
    let nBroken = 0;
    for (const win of this.windows) {
      const low = win.box.min.y < 3;
      const r = R();
      const boarded = r < (low ? 0.45 : 0.12);
      const broken = !boarded ? R() < (low ? 0.6 : 0.5) : R() < 0.5;
      // the pane, its own: grimy, and broken through in one or two jagged holes
      const w = win.w;
      const h = win.h;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.lineTo(-w / 2, -h / 2);
      if (broken) {
        nBroken++;
        const holes = R() < 0.4 ? 2 : 1;
        for (let k = 0; k < holes; k++) {
          const cx = (R() - 0.5) * w * 0.5;
          const cy = (R() - 0.3) * h * 0.5;
          const rr = Math.min(w, h) * (0.18 + R() * 0.22) * (holes > 1 ? 0.7 : 1);
          const path = new THREE.Path();
          const n = 9 + Math.floor(R() * 6);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            // spikes and notches: a star of broken glass
            const rad = rr * (i % 2 ? 0.45 + R() * 0.35 : 0.85 + R() * 0.6);
            const px = THREE.MathUtils.clamp(cx + Math.cos(a) * rad, -w / 2 + 0.03, w / 2 - 0.03);
            const py = THREE.MathUtils.clamp(cy + Math.sin(a) * rad * 1.2, -h / 2 + 0.03, h / 2 - 0.03);
            if (i === 0) path.moveTo(px, py);
            else path.lineTo(px, py);
          }
          path.closePath();
          shape.holes.push(path);
        }
        // glass on the ground below (outside, the ground floor's)
        if (low) {
          for (let i = 0; i < 9; i++) {
            const along = (R() - 0.5) * w * 1.3;
            const outD = 0.15 + R() * 0.9;
            const x = win.centre.x + (win.alongX ? along : win.out.x * outD);
            const z = win.centre.z + (win.alongX ? win.out.z * outD : along);
            const s = 0.04 + R() * 0.09;
            _q.setFromEuler(new THREE.Euler(-Math.PI / 2 + (R() - 0.5) * 0.3, R() * 6.28, 0));
            shards.push(new THREE.Matrix4().compose(new THREE.Vector3(x, this.ground(x, z) + 0.012, z), _q, _s.set(s, s * (0.6 + R()), 1)));
          }
        }
      }
      const pane = new THREE.Mesh(new THREE.ShapeGeometry(shape), dirty);
      pane.position.copy(win.centre).addScaledVector(win.out, 0.004);
      pane.rotation.y = win.alongX ? 0 : Math.PI / 2;
      pane.renderOrder = 1;
      this.group.add(pane);
      // boards across: nailed over the frame, a little askew, the odd one diagonal or fallen short
      if (boarded) {
        nBoarded++;
        const n = Math.max(3, Math.round(h / 0.3));
        for (let i = 0; i < n; i++) {
          if (R() < 0.12) continue; // (one missing)
          const bw = 0.17 + R() * 0.08;
          const y = win.box.min.y + 0.12 + (i + 0.5) * ((h - 0.1) / n);
          const len = w + 0.3 + R() * 0.15;
          const tilt = (R() - 0.5) * 0.14;
          const lift = 0.06 + R() * 0.02;
          const c = win.centre.clone().setY(y).addScaledVector(win.out, lift);
          _q.setFromAxisAngle(win.out, tilt).multiply(new THREE.Quaternion().setFromAxisAngle(Y, win.alongX ? 0 : Math.PI / 2));
          boards.push(new THREE.Matrix4().compose(c, _q, _s.set(len, bw, 0.025)));
        }
        // and one corner to corner
        if (R() < 0.5) {
          const c = win.centre.clone().addScaledVector(win.out, 0.1);
          _q.setFromAxisAngle(win.out, Math.atan2(h, w) * (R() < 0.5 ? 1 : -1)).multiply(new THREE.Quaternion().setFromAxisAngle(Y, win.alongX ? 0 : Math.PI / 2));
          boards.push(new THREE.Matrix4().compose(c, _q, _s.set(Math.hypot(w, h) + 0.1, 0.2, 0.025)));
        }
      }
    }
    const boardGeo = new THREE.BoxGeometry(1, 1, 1);
    this.group.add(instanced(boardGeo, boardMat, boards));
    this.group.add(instanced(new THREE.CircleGeometry(0.5, 3), shardMat, shards, { shadow: false }));
    Object.assign(this.stats, { boarded: nBoarded, broken: nBroken });
  }

  // --- the roof --------------------------------------------------------------------------------

  /** Holes in the roof down to the rafters, slates slipped round them and smashed below the eaves. */
  _roof() {
    const R = this.R;
    const down = new THREE.Vector3(0, -1, 0);
    const cands = [];
    for (let i = 0; i < 900; i++) {
      const x = THREE.MathUtils.lerp(HOUSE.x0, HOUSE.x1, R());
      const z = THREE.MathUtils.lerp(HOUSE.z0, HOUSE.z1, R());
      const h = this._hit(new THREE.Vector3(x, 40, z), down, 60);
      if (!h || h.name !== 'cm_roof' || h.normal.y < 0.3 || h.normal.y > 0.9) continue;
      // (a hole needs the roof around it too)
      let ok = true;
      for (const [dx, dz] of [
        [1.3, 0],
        [-1.3, 0],
        [0, 1.3],
        [0, -1.3],
      ]) {
        const k = this._hit(new THREE.Vector3(x + dx, 40, z + dz), down, 60);
        if (!k || k.name !== 'cm_roof' || Math.abs(k.point.y - h.point.y) > 2) ok = false;
      }
      if (ok) cands.push(h);
    }
    // a few, spread out; the first on the front slopes, where you see them from the lawn
    cands.sort((a, b) => b.normal.z - a.normal.z + (R() - 0.5) * 0.6);
    const picked = [];
    for (const c of cands) {
      if (picked.length >= 7) break;
      if (picked.every((p) => p.point.distanceTo(c.point) > 6)) picked.push(c);
    }
    const voidMat = new THREE.MeshStandardMaterial({ color: 0x17120d, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.15 });
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x4a3c2c, roughness: 0.95 });
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x45403a, roughness: 0.8, envMapIntensity: 0.25 });
    const timbers = [];
    const slates = [];
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (const hole of picked) {
      const n = hole.normal.clone().normalize();
      const d = down.clone().addScaledVector(n, -down.dot(n)).normalize(); // down the slope
      const a = new THREE.Vector3().crossVectors(n, d).normalize(); // across it
      const rad = 0.7 + R() * 0.8;
      // the hole: a ragged dark patch laid on the slates (each corner found on the roof by a ray)
      const pts = [];
      const N = 14;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const r = rad * (0.6 + 0.35 * noise1(i * 0.9, picked.indexOf(hole)) + (i % 2 ? -0.12 : 0.08) + (R() - 0.5) * 0.2);
        const p = hole.point.clone().addScaledVector(a, Math.cos(ang) * r * 1.2).addScaledVector(d, Math.sin(ang) * r);
        const k = this._hit(p.clone().addScaledVector(n, 1), n.clone().negate(), 2.5);
        pts.push((k ? k.point : p).addScaledVector(n, 0.025));
      }
      const g = new THREE.BufferGeometry();
      const verts = [hole.point.clone().addScaledVector(n, 0.025), ...pts];
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts.flatMap((p) => [p.x, p.y, p.z]), 3));
      const index = [];
      for (let i = 0; i < N; i++) index.push(0, 1 + i, 1 + ((i + 1) % N));
      g.setIndex(index);
      g.computeVertexNormals();
      this.group.add(new THREE.Mesh(g, voidMat));
      // the rafters across it, down the slope, and what is left of the battens
      const basis = new THREE.Matrix4().makeBasis(a, d, n);
      const qb = new THREE.Quaternion().setFromRotationMatrix(basis);
      for (let u = -rad * 1.1; u <= rad * 1.1; u += 0.45) {
        const half = Math.sqrt(Math.max(0, (rad * 0.62) ** 2 - (u / 1.2) ** 2));
        if (half < 0.15) continue;
        const c = hole.point.clone().addScaledVector(a, u).addScaledVector(n, 0.05);
        timbers.push(new THREE.Matrix4().compose(c, qb, _s.set(0.05, half * 2, 0.07)));
      }
      for (let v = -rad * 0.55; v <= rad * 0.55; v += 0.3) {
        if (R() < 0.45) continue;
        const half = Math.sqrt(Math.max(0, (rad * 0.62) ** 2 - v * v)) * 1.2 * (0.4 + R() * 0.6);
        if (half < 0.15) continue;
        const c = hole.point.clone().addScaledVector(d, v).addScaledVector(a, (R() - 0.5) * 0.3).addScaledVector(n, 0.085);
        timbers.push(new THREE.Matrix4().compose(c, qb, _s.set(half * 2, 0.04, 0.022)));
      }
      // slates slipped and askew round its rim, and some further down the slope
      for (let i = 0; i < 16; i++) {
        const ang = R() * Math.PI * 2;
        const r = rad * (0.8 + R() * 0.5) + (i > 11 ? R() * 1.5 : 0);
        const p = hole.point.clone().addScaledVector(a, Math.cos(ang) * r * 1.2).addScaledVector(d, Math.abs(Math.sin(ang)) * r * (i > 11 ? 1.6 : 1) * (i > 11 ? 1 : Math.sign(Math.sin(ang))));
        const k = this._hit(p.clone().addScaledVector(n, 1), n.clone().negate(), 2.5);
        if (!k || k.name !== 'cm_roof') continue;
        const q = qb.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, (R() - 0.5) * 0.4, (R() - 0.5) * 1.2)));
        slates.push(new THREE.Matrix4().compose(k.point.addScaledVector(n, 0.035), q, _s.set(0.3, 0.5, 0.014)));
      }
      // smashed on the ground under the eaves: walk down the slope off the roof, then out a little
      const p = hole.point.clone();
      for (let i = 0; i < 40; i++) {
        p.addScaledVector(d, 0.3);
        const k = this._hit(new THREE.Vector3(p.x, p.y + 3, p.z), down, 6);
        if (!k || k.name !== 'cm_roof') break;
      }
      const flat = new THREE.Vector3(d.x, 0, d.z).normalize();
      const at = p.clone().addScaledVector(flat, 0.9);
      if (this._hit(new THREE.Vector3(at.x, 30, at.z), down, 40)?.point.y < 1) {
        for (let i = 0; i < 34; i++) {
          const x = at.x + (R() - 0.5) * 2.4 + flat.x * R() * 1.2;
          const z = at.z + (R() - 0.5) * 2.4 + flat.z * R() * 1.2;
          const s = 0.3 + R() * 0.7;
          _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.5, R() * 6.28, (R() - 0.5) * 0.5));
          slates.push(new THREE.Matrix4().compose(new THREE.Vector3(x, this.ground(x, z) + 0.02 + R() * 0.04, z), _q, _s.set(0.25 * s, 0.012, 0.4 * s)));
        }
      }
    }
    this.group.add(instanced(box, timberMat, timbers));
    this.group.add(instanced(box, slateMat, slates));
    // buddleia out of the parapets, the gutters and the chimney stacks
    const tops = [];
    for (let i = 0; i < 1500 && tops.length < 16; i++) {
      const x = THREE.MathUtils.lerp(HOUSE.x0, HOUSE.x1, R());
      const z = THREE.MathUtils.lerp(HOUSE.z0, HOUSE.z1, R());
      const h = this._hit(new THREE.Vector3(x, 40, z), down, 60);
      if (!h || h.point.y < 6.5 || h.normal.y < 0.92 || /roof|glass|water/.test(h.name)) continue;
      if (tops.some((t) => t.distanceTo(h.point) < 3)) continue;
      tops.push(h.point);
    }
    this.buddleia = tops;
    this.stats.roofHoles = picked.length;
    this.stats.buddleia = tops.length;
  }

  // --- ivy ---------------------------------------------------------------------------------------

  /** Ivy over the walls: rays in from all four sides, thick from the ground up, round the windows. */
  _ivy() {
    const R = this.R;
    const spots = [];
    const sides = [
      { dir: new THREE.Vector3(0, 0, -1), from: (s) => [s, HOUSE.z1 + 1.5], range: [HOUSE.x0, HOUSE.x1] },
      { dir: new THREE.Vector3(0, 0, 1), from: (s) => [s, HOUSE.z0 - 2.5], range: [HOUSE.x0, HOUSE.x1] },
      { dir: new THREE.Vector3(-1, 0, 0), from: (s) => [HOUSE.x1 + 2.5, s], range: [HOUSE.z0, HOUSE.z1] },
      { dir: new THREE.Vector3(1, 0, 0), from: (s) => [HOUSE.x0 - 2, s], range: [HOUSE.z0, HOUSE.z1] },
    ];
    const step = 0.22;
    const nearWindow = (p) => this.windows.some((w) => w.box.clone().expandByScalar(0.2).containsPoint(p));
    const nearDoor = (p) => this.doors.some((d) => Math.hypot(d.x - p.x, d.z - p.z) < 1.1 && p.y < 3.2);
    sides.forEach((side, si) => {
      for (let s = side.range[0]; s <= side.range[1]; s += step) {
        // how high the ivy has climbed here: colonies, with bare stretches between
        const reach = Math.max(0, noise1(s * 0.16, si) * 1.25 - 0.18) * 12 + noise1(s * 0.9, si + 9) * 1.5;
        if (reach < 0.4) continue;
        for (let y = 0.1; y < Math.min(reach, 14); y += step) {
          const [x, z] = side.from(s + (R() - 0.5) * step);
          const h = this._hit(new THREE.Vector3(x, y + (R() - 0.5) * step, z), side.dir, 13);
          if (!h || Math.abs(h.normal.y) > 0.4 || !/brick|whitestone|assault_bricks/.test(h.name)) continue;
          // thinner towards its top
          if (R() > 0.35 + 0.65 * (1 - y / reach)) continue;
          if (nearWindow(h.point) && R() < 0.85) continue;
          if (nearDoor(h.point)) continue;
          spots.push(h);
        }
      }
    });
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.ivy, color: 0xd6dcc0, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, metalness: 0, envMapIntensity: 0.2 });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.pictures.ivy, alphaTest: 0.4, side: THREE.DoubleSide });
    const mats = [];
    const MAX = this.light ? 8000 : 16000;
    if (spots.length > MAX) for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (const h of spots.slice(0, MAX)) {
      const s = 0.42 + R() * 0.4;
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), h.normal);
      _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), R() * Math.PI * 2));
      _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.7, (R() - 0.5) * 0.7, 0)));
      mats.push(new THREE.Matrix4().compose(h.point.clone().addScaledVector(h.normal, 0.04 + R() * 0.1), _q, _s.set(s, s, s)));
    }
    const im = instanced(new THREE.PlaneGeometry(1, 1), mat, mats, { shadow: true });
    im.customDepthMaterial = depth;
    this.group.add(im);
    this.ivySpots = spots;
    this.stats.ivy = mats.length;
  }

  // --- the grounds -------------------------------------------------------------------------------

  /** Points on the lawns (and, thinner, up through the gravel), with their ground height. */
  _groundSpots(count, { gravel = 0.25, avoidHouse = 0.5, seed = 0 } = {}) {
    const R = rng(1976 + seed);
    const L = this.landscape.lawn;
    const out = [];
    const down = new THREE.Vector3(0, -1, 0);
    for (let tries = 0; out.length < count && tries < count * 12; tries++) {
      const x = THREE.MathUtils.lerp(L.min.x + 0.5, L.max.x - 0.5, R());
      const z = THREE.MathUtils.lerp(L.min.z + 0.5, L.max.z - 0.5, R());
      if (x > HOUSE.x0 - avoidHouse && x < HOUSE.x1 + avoidHouse && z > HOUSE.z0 - avoidHouse && z < HOUSE.z1 + avoidHouse) continue;
      if (this.landscape._grassAt(x, z)) {
        out.push({ x, y: this.ground(x, z), z, gravel: false });
        continue;
      }
      if (R() > gravel) continue;
      const h = this._hit(new THREE.Vector3(x, 3, z), down, 4);
      if (h && h.name === 'cm_gravel' && h.normal.y > 0.9) out.push({ x, y: h.point.y, z, gravel: true });
    }
    return out;
  }

  /** Rank grass and docks, waist high, all over the lawns and in tufts up through the drive. */
  _grass() {
    const R = this.R;
    const spots = this._groundSpots(this.light ? 8000 : 15000, { gravel: 0.35, avoidHouse: -0.3, seed: 1 });
    const tuft = new THREE.BufferGeometry();
    {
      const pos = [];
      const uv = [];
      const nor = [];
      const idx = [];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI + 0.3;
        const c = Math.cos(a) * 0.5;
        const s = Math.sin(a) * 0.5;
        const b = pos.length / 3;
        pos.push(-c, 0, -s, c, 0, s, c, 0.8, s, -c, 0.8, -s);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        for (let j = 0; j < 4; j++) nor.push(0, 1, 0);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      tuft.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      tuft.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      tuft.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      tuft.setIndex(idx);
    }
    const mat = new THREE.MeshStandardMaterial({ map: rankGrassPicture(), color: 0xd8d0b0, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.92, envMapIntensity: 0.2 });
    const wind = this.landscape.wind;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = wind.time;
      shader.uniforms.uWindAmp = wind.amp;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindAmp;\nvarying float vTone;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec2 ip = instanceMatrix[3].xz;
         float bend = uv.y * uv.y;
         transformed.x += sin(uWindTime * 1.5 + ip.x * 0.4 + ip.y * 0.3) * 0.12 * bend * (0.5 + uWindAmp);
         transformed.z += sin(uWindTime * 2.1 + ip.y * 0.5) * 0.08 * bend * (0.5 + uWindAmp);
         vTone = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);`,
      );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTone;')
        // (both faces of a card lit as if facing up, like the ground it grows from: from above, its
        // back face would otherwise go black)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif')
        .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // straw and old green, some dead dark tussocks
         diffuseColor.rgb *= mix(vec3(0.85, 0.9, 0.68), vec3(1.2, 1.06, 0.78), vTone) * (0.9 + 0.25 * vMapUv.y);`,
      );
    };
    mat.customProgramCacheKey = () => 'rank-grass';
    const mats = spots.map((p) => {
      const s = p.gravel ? 0.55 + R() * 0.5 : 0.75 + R() * 0.6;
      _q.setFromAxisAngle(Y, R() * Math.PI * 2);
      return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y - 0.03, p.z), _q, _s.set(s * 1.2, s * (0.8 + R() * 0.5), s * 1.2));
    });
    // and round the house's foot, where the mower never reached even when there was one
    for (const h of (this.ivySpots ?? []).filter((h) => h.point.y < 0.6)) {
      if (R() > 0.25) continue;
      const x = h.point.x + h.normal.x * (0.2 + R() * 1.4);
      const z = h.point.z + h.normal.z * (0.2 + R() * 1.4);
      const s = 0.8 + R() * 0.6;
      _q.setFromAxisAngle(Y, R() * Math.PI * 2);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, this.ground(x, z) - 0.03, z), _q, _s.set(s, s * 1.15, s)));
    }
    this.group.add(instanced(tuft, mat, mats, { shadow: false }));
    this.stats.grass = mats.length;
  }

  /** A leafy material for cards, with the trees' wind and crown shading. */
  _leaves(map, tint = 0xffffff, { stiff = 3, height = 1.5 } = {}) {
    const m = new THREE.MeshStandardMaterial({ map, color: tint, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, envMapIntensity: 0.3 });
    addTreeShader(m, this.landscape.wind, { stiff, snow: 'cap', height, crown: true });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45, side: THREE.DoubleSide });
    addTreeShader(depth, this.landscape.wind, { stiff });
    return { m, depth };
  }

  /** Brambles in mounds against the walls, round the fountain and out over the lawns. */
  _brambles() {
    const R = this.R;
    const pic = leavesPicture({ size: 256, count: 900, len: [8, 14], tile: false, clump: true, seed: 71, palette: ['#1d2b12', '#26361a', '#2f3f1c', '#3b4720', '#4a4a22', '#5a4423', '#3a2a1c'] });
    const { m, depth } = this._leaves(pic, 0xd8d0b8);
    const geo = cardsGeometry(this.light ? 70 : 120, this.light ? 0.7 : 0.6, ballPlace(1.1, 0.55, 1.0, -0.15, 0.5), 73);
    const spots = [];
    // against the house
    for (const h of (this.ivySpots ?? []).filter((h) => h.point.y < 0.5)) {
      if (R() > 0.06) continue;
      if (this.doors.some((d) => Math.hypot(d.x - h.point.x, d.z - h.point.z) < 1.6)) continue;
      const x = h.point.x + h.normal.x * (0.6 + R() * 0.5);
      const z = h.point.z + h.normal.z * (0.6 + R() * 0.5);
      spots.push([x, z, 0.8 + R() * 0.9]);
    }
    // out on the lawns
    for (const p of this._groundSpots(130, { gravel: 0.15, seed: 2 })) spots.push([p.x, p.z, 0.6 + R() * 1.1]);
    const mats = spots.map(([x, z, s]) => {
      _q.setFromAxisAngle(Y, R() * Math.PI * 2);
      return new THREE.Matrix4().compose(new THREE.Vector3(x, this.ground(x, z), z), _q, _s.set(s * (0.9 + R() * 0.5), s * (0.7 + R() * 0.6), s));
    });
    // buddleia up on the parapets and chimneys: smaller, greyer
    for (const p of this.buddleia ?? []) {
      const s = 0.35 + R() * 0.3;
      _q.setFromAxisAngle(Y, R() * Math.PI * 2);
      mats.push(new THREE.Matrix4().compose(p.clone().setY(p.y + 0.05), _q, _s.set(s, s * 1.4, s)));
    }
    const im = instanced(geo, m, mats);
    im.customDepthMaterial = depth;
    this.group.add(im);
    this.stats.brambles = mats.length;
  }

  /** Self-sown sycamore and birch, turning yellow, a few metres high, out of the long grass. */
  _saplings() {
    const R = this.R;
    const pic = leavesPicture({ size: 256, count: 1000, len: [10, 18], tile: false, clump: true, seed: 81, palette: ['#4b4a1c', '#5f5a1e', '#77691f', '#8c7722', '#a3862a', '#6b6a26', '#3d4a1c'] });
    const { m, depth } = this._leaves(pic, 0xffffff, { stiff: 2, height: 4 });
    const crown = cardsGeometry(120, 0.7, ballPlace(0.9, 1.0, 0.9, 1.3, 0.55), 83);
    const trunk = new THREE.CylinderGeometry(0.03, 0.06, 2.4, 6, 1);
    trunk.translate(0, 1.2, 0);
    const bark = new THREE.MeshStandardMaterial({ color: 0x7a7468, roughness: 0.9 });
    const spots = this._groundSpots(60, { gravel: 0.2, avoidHouse: 1.5, seed: 3 });
    // (more of them along the estate's walls and round the house, where seed blows in and lodges)
    const mats = [];
    for (const p of spots) {
      if (p.gravel && R() < 0.5) continue;
      const s = 0.6 + R() * 1.2;
      _q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.12, R() * 6.28, (R() - 0.5) * 0.12));
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y - 0.05, p.z), _q, _s.set(s, s, s)));
    }
    const ci = instanced(crown, m, mats);
    ci.customDepthMaterial = depth;
    this.group.add(ci, instanced(trunk, bark, mats));
    this.stats.saplings = mats.length;
  }

  /** A big tree down across the west lawn, its root plate up on end, and its broken stump's hole. */
  _fallenTree() {
    const R = this.R;
    const barkMat = new THREE.MeshStandardMaterial({ map: this.pictures.bark, roughness: 0.95, envMapIntensity: 0.3 });
    const soil = new THREE.MeshStandardMaterial({ map: this.pictures.litter, color: 0x9a8a74, roughness: 1 });
    // find a long clear stretch of lawn west of the drive, in front of the house
    let best = null;
    for (let i = 0; i < 400; i++) {
      const x = -26 + R() * 18;
      const z = -4 + R() * 22;
      const ang = R() * Math.PI;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      let ok = true;
      for (let t = -1.5; t <= 14; t += 1) if (!this.landscape._grassAt(x + dx * t, z + dz * t)) ok = false;
      if (!ok) continue;
      const score = -Math.abs(z - 6) - Math.abs(x + 15) * 0.5;
      if (!best || score > best.score) best = { x, z, ang, dx, dz, score };
    }
    if (!best) return;
    const g = new THREE.Group();
    const L = 14;
    const trunk = new THREE.CylinderGeometry(0.2, 0.48, L, 14, 6);
    // (a little bent along its length)
    const p = trunk.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin((p.getY(i) / L + 0.5) * Math.PI) * 0.25);
    trunk.computeVertexNormals();
    trunk.rotateZ(-Math.PI / 2);
    trunk.translate(L / 2, 0, 0);
    const tm = new THREE.Mesh(trunk, barkMat);
    tm.position.y = 0.42;
    tm.rotation.z = 0.03;
    tm.castShadow = tm.receiveShadow = true;
    g.add(tm);
    // the root plate, torn up on end: a ragged disc of earth with roots out of it
    const plate = new THREE.CylinderGeometry(1.7, 1.5, 0.55, 14, 1);
    const pp = plate.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const a = Math.atan2(pp.getZ(i), pp.getX(i));
      const k = 0.75 + 0.35 * noise1(a * 2.2 + 3, 5);
      pp.setX(i, pp.getX(i) * k);
      pp.setZ(i, pp.getZ(i) * k);
    }
    plate.computeVertexNormals();
    plate.rotateZ(Math.PI / 2);
    const pm = new THREE.Mesh(plate, soil);
    pm.position.set(-0.2, 1.25, 0);
    pm.castShadow = pm.receiveShadow = true;
    g.add(pm);
    const root = new THREE.CylinderGeometry(0.02, 0.07, 1, 5, 1);
    root.translate(0, 0.5, 0);
    for (let i = 0; i < 18; i++) {
      const a = R() * Math.PI * 2;
      const rm = new THREE.Mesh(root, barkMat);
      rm.position.set(-0.5, 1.25 + Math.sin(a) * 1.1, Math.cos(a) * 1.1);
      rm.lookAt(rm.position.clone().add(new THREE.Vector3(-0.6 - R(), Math.sin(a) * (0.8 + R()), Math.cos(a) * (0.8 + R()))));
      rm.rotateX(Math.PI / 2);
      rm.scale.setScalar(0.6 + R() * 0.9);
      g.add(rm);
    }
    // the hole it came out of, and its big limbs, broken, one up in the air
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), soil);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(-1.0, 0.03, 0);
    g.add(hole);
    const limb = new THREE.CylinderGeometry(0.05, 0.16, 1, 7, 1);
    limb.translate(0, 0.5, 0);
    const tips = [];
    for (let i = 0; i < 11; i++) {
      const t = 5 + R() * 8.5;
      const side = R() < 0.5 ? 1 : -1;
      const lm = new THREE.Mesh(limb, barkMat);
      const r = 0.48 - (t / L) * 0.28;
      lm.position.set(t, 0.42 + side * 0.0 + r * 0.3, side * r * 0.7);
      // (out along the trunk, a little up or flat to the ground, the odd one broken short)
      const dir = new THREE.Vector3(0.8 + R() * 0.6, 0.05 + R() * 0.7, side * (0.4 + R() * 0.9)).normalize();
      lm.quaternion.setFromUnitVectors(Y, dir);
      const len = R() < 0.25 ? 0.6 + R() * 0.6 : 1.8 + R() * 2.6;
      lm.scale.set(r * 1.6, len, r * 1.6);
      lm.castShadow = true;
      g.add(lm);
      if (len > 1.5) tips.push(lm.position.clone().addScaledVector(dir, len));
    }
    // what is left of its crown: a tangle of twigs with dead brown leaves still on them
    const deadPic = leavesPicture({ size: 256, count: 700, len: [8, 14], tile: false, clump: true, seed: 91, palette: ['#3a2a18', '#4d3820', '#5e4426', '#6e5230', '#2e2216'] });
    const dead = this._leaves(deadPic, 0xb0a090, { stiff: 6, height: 2 });
    const twigs = cardsGeometry(70, 0.8, ballPlace(1.0, 0.6, 1.0, -0.4, 0.6), 93);
    for (const p of tips) {
      const c = new THREE.Mesh(twigs, dead.m);
      c.customDepthMaterial = dead.depth;
      c.position.copy(p);
      c.scale.setScalar(0.8 + R() * 0.6);
      c.castShadow = true;
      g.add(c);
    }
    g.position.set(best.x, this.ground(best.x, best.z), best.z);
    g.rotation.y = -best.ang;
    this.group.add(g);
    this.fallenTree = g;
    this.landscape.obstacles?.push({ x: best.x + best.dx * 6, z: best.z + best.dz * 6, r: 0.8, when: () => this.on });
    this.stats.fallenTree = [Math.round(best.x), Math.round(best.z)];
  }

  /** Dead branches about the lawns and the drive. */
  _branches() {
    const R = this.R;
    const barkMat = new THREE.MeshStandardMaterial({ map: this.pictures.bark, roughness: 0.95, color: 0x8a8070, envMapIntensity: 0.3 });
    const geo = new THREE.BufferGeometry();
    {
      // one branch: a bough and two side twigs, merged
      const parts = [];
      const add = (len, r0, r1, rot, off) => {
        const c = new THREE.CylinderGeometry(r1, r0, len, 5, 1);
        c.translate(0, len / 2, 0);
        c.rotateZ(rot);
        c.translate(...off);
        parts.push(c);
      };
      add(2.4, 0.07, 0.025, -Math.PI / 2, [0, 0.06, 0]);
      add(0.9, 0.03, 0.01, -Math.PI / 2 + 0.6, [0.8, 0.06, 0]);
      add(0.7, 0.025, 0.008, -Math.PI / 2 - 0.5, [1.4, 0.06, 0]);
      const merged = [];
      let offset = 0;
      const pos = [];
      const nor = [];
      const uv = [];
      for (const p of parts) {
        const ix = p.index.array;
        for (let i = 0; i < ix.length; i++) merged.push(ix[i] + offset);
        pos.push(...p.attributes.position.array);
        nor.push(...p.attributes.normal.array);
        uv.push(...p.attributes.uv.array);
        offset += p.attributes.position.count;
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(merged);
    }
    const mats = this._groundSpots(60, { gravel: 0.6, seed: 4 }).map((p) => {
      const s = 0.6 + R() * 0.9;
      _q.setFromEuler(new THREE.Euler(0, R() * 6.28, (R() - 0.5) * 0.08));
      return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), _q, _s.set(s, s, s));
    });
    this.group.add(instanced(geo, barkMat, mats));
    this.stats.branches = mats.length;
  }

  /** The fountain dry: no water, no jet, its basin full of black leaves and silt. */
  _fountain() {
    const surfaces = (this.water?.surfaces ?? []).filter((w) => w.outdoor);
    const at = new THREE.Vector3(4.59, 0, 8.28);
    const pond = surfaces.sort((a, b) => a.box.getCenter(new THREE.Vector3()).distanceTo(at) - b.box.getCenter(new THREE.Vector3()).distanceTo(at))[0];
    if (!pond) return;
    this.pond = pond;
    // the leaf mat, cut to the water's own shape (its mesh's geometry), a little lower
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.litter, roughness: 1, color: 0xffffff });
    const g = pond.mesh.geometry.clone();
    const m = new THREE.Mesh(g, mat);
    pond.mesh.updateMatrixWorld(true);
    m.applyMatrix4(pond.mesh.matrixWorld);
    m.position.y -= 0.12;
    // world-space UVs, so the leaves are leaf-sized
    const p = g.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(pond.mesh.matrixWorld);
      uv[i * 2] = _v.x / 1.4;
      uv[i * 2 + 1] = _v.z / 1.4;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.receiveShadow = true;
    this.group.add(m);
  }

  /** The gateway boarded across, a rusty chain hung over the boards, and a faded sign nailed on. */
  _gate() {
    const gate = this.landscape.gate;
    if (!gate) return;
    // the gateway's sides: rays out from its middle, just inside the wall's outer face
    const side = (dx) => this._hit(new THREE.Vector3(gate.x, 1.1, gate.z - 0.25), new THREE.Vector3(dx, 0, 0), 4)?.point.x ?? gate.x + dx * 1.6;
    const x0 = side(-1);
    const x1 = side(1);
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    const z = gate.z + 0.05;
    const R = this.R;
    const boardMat = new THREE.MeshStandardMaterial({ map: this.pictures.board, roughness: 0.95, color: 0xb0a898 });
    const boards = [];
    for (const [y, tilt] of [
      [0.55, 0.03],
      [1.05, -0.04],
      [1.6, 0.02],
    ]) {
      _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
      boards.push(new THREE.Matrix4().compose(new THREE.Vector3(cx + (R() - 0.5) * 0.1, y, z), _q, _s.set(w + 0.5, 0.22, 0.03)));
    }
    _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(1.4, w));
    boards.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, 1.08, z + 0.035), _q, _s.set(Math.hypot(w, 1.4) + 0.1, 0.2, 0.03)));
    this.group.add(instanced(new THREE.BoxGeometry(1, 1, 1), boardMat, boards));
    // a chain sagging across, padlocked to itself
    const steel = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8, metalness: 0.5 });
    const link = new THREE.TorusGeometry(0.04, 0.01, 5, 10);
    const links = [];
    const n = Math.round(w / 0.07);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      _q.setFromEuler(new THREE.Euler(0, i % 2 ? Math.PI / 2 : 0, 0));
      links.push(new THREE.Matrix4().compose(new THREE.Vector3(x0 + t * w, 1.3 - Math.sin(t * Math.PI) * 0.28, z + 0.07), _q, _s.set(1, 1, 1)));
    }
    this.group.add(instanced(link, steel, links));
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.035), steel);
    lock.position.set(cx + 0.03, 0.95, z + 0.09);
    lock.rotation.z = 0.2;
    this.group.add(lock);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.47), new THREE.MeshStandardMaterial({ map: signPicture(), color: 0x9c968a, roughness: 0.9 }));
    sign.position.set(cx - w * 0.18, 1.33, z + 0.07);
    sign.rotation.set(0, 0, 0.07);
    sign.castShadow = true;
    this.group.add(sign);
    this.landscape.obstacles?.push({ x: cx, z: gate.z, r: w / 2, when: () => this.on });
    this.gateAt = new THREE.Vector3(cx, 1, z);
  }

  /** Dead leaves blowing across the ground round you. */
  _driftingLeaves() {
    const N = 140;
    const mat = new THREE.MeshStandardMaterial({ map: this.pictures.leaf, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), mat, N);
    im.frustumCulled = false;
    im.castShadow = false;
    const R = this.R;
    const tones = [0x8a5a26, 0x6e4a20, 0x9a7030, 0x5a3e1c, 0x7a4a1a];
    this.drift = {
      im,
      leaves: Array.from({ length: N }, (_, i) => {
        im.setColorAt(i, new THREE.Color(tones[i % tones.length]));
        return { p: new THREE.Vector3((R() - 0.5) * 40, 0, (R() - 0.5) * 40), y: R() * 2, vy: 0, spin: new THREE.Vector3(R() * 6, R() * 6, R() * 6), rot: new THREE.Euler(R() * 6, R() * 6, R() * 6), ph: R() * 10, placed: false };
      }),
    };
    im.instanceColor.needsUpdate = true;
    this.group.add(im);
  }

  /** The leaves blow, the crows call, the house creaks and something bangs inside now and then. */
  update(dt, { camera = null, wind = 0.5, inside = 0 } = {}) {
    if (!this.on || !camera) return;
    this.time += dt;
    const t = this.time;
    if (this.drift) {
      const { im, leaves } = this.drift;
      const gust = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.61 + 1.2);
      const speed = (1.2 + 3.2 * wind) * gust;
      const dir = _v.set(0.8, 0, 0.6);
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i];
        // (kept in a box round you: those that blow out of it come back in on the far side)
        let rx = l.p.x - camera.position.x;
        let rz = l.p.z - camera.position.z;
        if (!l.placed || Math.abs(rx) > 20 || Math.abs(rz) > 20) {
          if (l.placed) {
            if (Math.abs(rx) > 20) l.p.x -= Math.sign(rx) * 40;
            if (Math.abs(rz) > 20) l.p.z -= Math.sign(rz) * 40;
          } else l.placed = true;
          l.p.x = camera.position.x + THREE.MathUtils.euclideanModulo(l.p.x - camera.position.x + 20, 40) - 20;
          l.p.z = camera.position.z + THREE.MathUtils.euclideanModulo(l.p.z - camera.position.z + 20, 40) - 20;
        }
        const g = this.landscape.groundHeight(l.p.x, l.p.z) ?? 0;
        // tumbling along low down, lifted in the gusts and settling again
        const lift = Math.max(0, Math.sin(t * 0.8 + l.ph) * gust - 0.35) * 2.2;
        l.y += (lift - l.y) * Math.min(1, dt * 1.5);
        const moving = l.y > 0.03 || gust > 0.75;
        if (moving) {
          l.p.addScaledVector(dir, speed * dt * (0.6 + 0.4 * Math.sin(l.ph + t)));
          l.p.x += Math.sin(t * 1.3 + l.ph) * dt * 0.6;
          l.rot.x += l.spin.x * dt;
          l.rot.y += l.spin.y * dt * 0.5;
          l.rot.z += l.spin.z * dt;
        }
        _q.setFromEuler(l.rot);
        _m.compose(_s.set(l.p.x, g + 0.03 + l.y, l.p.z), _q, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    const snd = this.sound;
    if (!snd?.on) return;
    for (const k of Object.keys(this.next)) this.next[k] -= dt;
    const cam = camera.position;
    if (this.next.crow <= 0) {
      // a crow from the trees or the roof, off to one side
      const a = Math.random() * Math.PI * 2;
      const p = new THREE.Vector3(cam.x + Math.cos(a) * (15 + Math.random() * 30), 8 + Math.random() * 10, cam.z + Math.sin(a) * (15 + Math.random() * 30));
      const name = Math.random() < 0.2 ? 'crows' : `crow-${1 + Math.floor(Math.random() * 3)}`;
      snd.sample(name, p, { gain: 0.7, rate: 0.92 + Math.random() * 0.15 });
      this.next.crow = 5 + Math.random() * 11;
    }
    // the house: a slow creak from somewhere in it, nearer and louder when you are inside
    if (this.next.creak <= 0) {
      const p = new THREE.Vector3(THREE.MathUtils.lerp(HOUSE.x0, HOUSE.x1, Math.random()), 2 + Math.random() * 6, THREE.MathUtils.lerp(HOUSE.z0, HOUSE.z1, Math.random()));
      if (inside > 0.5 && Math.random() < 0.6) snd.sample('floor-creak', p.lerp(cam, 0.7), { gain: 0.8, rate: 0.85 + Math.random() * 0.2 });
      else snd.creakAt?.(p, { rate: 0.55 + Math.random() * 0.35, gain: 0.9 });
      this.next.creak = 10 + Math.random() * 16;
    }
    // a loose shutter or a door banging in the wind, upstairs
    if (this.next.bang <= 0) {
      const ws = this.windows.filter((w) => w.box.min.y > 3);
      const w = ws[Math.floor(Math.random() * ws.length)];
      if (w) snd.sample('door-slam', w.centre, { gain: 0.35, rate: 0.8 + Math.random() * 0.3, lowpass: 1600 });
      this.next.bang = 35 + Math.random() * 40;
    }
  }
}
