// Halloween night's haunting (31 October, from dusk), seen through the windows of the dark house.
//
// - Someone walks the house with a candle: a robed figure, room to room, the ground floor round
//   all four sides, then upstairs, then the top floor, pausing at a window now and then to look
//   out. From outside you see the light go from window to window (it is a real light: it lights
//   the rooms it passes); where a room is deep enough you see him too. That is the lure.
// - Every room has something in it. Where there is a room behind the glass: a rocking chair rocking
//   on its own, a sheet ghost that turns to face you, a skeleton that waves as you come near, a
//   clock whose hands run backwards, a mirror with a face in it, a lantern swinging, a portrait
//   whose eyes catch the light. Where the window is blind (a wall just behind it, as most of the
//   model's are): a candlelit room painted behind the glass, with someone in it, each different: a
//   bride in her veil, a child with a toy, a tall thin figure, a hooded figure with a scythe, an old
//   woman rocking, a cat on the sill with shining eyes, a face peering round the edge of the window,
//   hands on the glass, bats hanging, eyes in the dark. They show when his candle is in the room,
//   and all at once when the lightning flashes.
// - The Halloween flyby: he walks the upstairs rooms along the front just ahead of you, and leaves
//   a lit candle on the sill of each room as he goes; at the far end, at a close strike, every
//   candle goes out, and so does his.
//
// The props are Poly Haven's (CC0), Quaternius's skeleton (CC0) and a sheet ghost made for the
// viewer; the walker is CDmir's monk (CC0) with a walk carrying a candle (public/models/halloween/).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const CENTRE = new THREE.Vector2(6, -21); // the middle of the house, for going round it
const WALK = 0.69; // the walker's pace, m/s (his walk's own)

// the house's four faces: rays come in from outside along `dir`; the glass they meet is a window
const FACES = [
  { name: 'front', dir: new THREE.Vector3(0, 0, -1), from: 8, axis: 'x', range: [-16, 31], plane: [-14.5, 1] },
  { name: 'back', dir: new THREE.Vector3(0, 0, 1), from: -44, axis: 'x', range: [-16, 31], plane: [-36, -19] },
  { name: 'west', dir: new THREE.Vector3(1, 0, 0), from: -32, axis: 'z', range: [-37, -6], plane: [-21, -3] },
  { name: 'east', dir: new THREE.Vector3(-1, 0, 0), from: 44, axis: 'z', range: [-37, -6], plane: [14, 35] },
];
const HEIGHTS = [1.7, 2.4, 4.9, 5.7, 7.3, 8.4];

/** Every window in the house's walls: runs of glass met by rays from outside, at several heights. */
export function findWindows(bvh, materialAt) {
  const ray = new THREE.Ray();
  const origin = new THREE.Vector3();
  const glassAt = (f, s, y) => {
    if (f.axis === 'x') origin.set(s, y, f.from);
    else origin.set(f.from, y, s);
    ray.set(origin, f.dir);
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 40);
    if (!hit) return null;
    const p = f.axis === 'x' ? hit.point.z : hit.point.x;
    if (p < f.plane[0] || p > f.plane[1] || Math.abs(hit.face.normal.dot(f.dir)) < 0.6) return null;
    return /glass|window_grid/i.test(materialAt(hit.faceIndex)) ? p : null;
  };
  const out = [];
  for (const f of FACES) {
    const runs = [];
    for (const y of HEIGHTS) {
      let run = null;
      for (let s = f.range[0]; s <= f.range[1]; s += 0.1) {
        const p = glassAt(f, s, y);
        // (the panes of one window, across its stone mullions, are one window)
        if (p !== null && run && s - run.s1 < 0.62 && Math.abs(p - run.p) < 0.3) run.s1 = s;
        else if (p !== null) {
          if (run) runs.push(run);
          run = { s0: s, s1: s, y, p };
        }
      }
      if (run) runs.push(run);
    }
    // each run's height: up and down while there is glass, across its width (the middle may be a mullion)
    for (const r of runs) {
      r.top = r.bottom = r.y;
      for (let k = 0; k <= 6; k++) {
        const s = r.s0 + ((r.s1 - r.s0) * k) / 6;
        if (glassAt(f, s, r.y) === null) continue;
        let top = r.y;
        let bottom = r.y;
        while (top < r.y + 2.8 && glassAt(f, s, top + 0.1) !== null) top += 0.1;
        while (bottom > r.y - 2.5 && glassAt(f, s, bottom - 0.1) !== null) bottom -= 0.1;
        r.top = Math.max(r.top, top);
        r.bottom = Math.min(r.bottom, bottom);
      }
    }
    // one window met at two heights is one window
    const kept = [];
    for (const r of runs.sort((a, b) => b.s1 - b.s0 - (a.s1 - a.s0))) {
      if (r.s1 - r.s0 < 0.45 || r.top - r.bottom < 0.8) continue;
      const same = kept.find((k) => Math.abs(k.p - r.p) < 0.35 && Math.min(k.s1, r.s1) - Math.max(k.s0, r.s0) > 0.3 && Math.min(k.top, r.top) - Math.max(k.bottom, r.bottom) > 0.3);
      if (!same) kept.push(r);
    }
    for (const r of kept) {
      const n = f.dir.clone().negate();
      const u = f.axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      const s = (r.s0 + r.s1) / 2;
      const y = (r.top + r.bottom) / 2;
      const c = f.axis === 'x' ? new THREE.Vector3(s, y, r.p) : new THREE.Vector3(r.p, y, s);
      // how deep the room behind is
      ray.set(c.clone().addScaledVector(n, -0.06), f.dir);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 20);
      out.push({ face: f.name, c, n, u, s, width: r.s1 - r.s0, bottom: r.bottom, top: r.top, depth: hit ? hit.distance : 20 });
    }
  }
  return out;
}

// --- pictures ---------------------------------------------------------------------------------

function canvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A room lit by one candle, from outside: warm round the flame, falling away into the dark. */
function roomGlow() {
  return canvasTexture((g, W, H) => {
    const r = g.createRadialGradient(W * 0.56, H * 0.66, 0, W * 0.52, H * 0.6, W * 0.72);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.28, 'rgba(255,255,255,0.6)');
    r.addColorStop(0.65, 'rgba(255,255,255,0.18)');
    r.addColorStop(1, 'rgba(255,255,255,0.03)');
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  });
}

function glowDot(colour = '255,210,150') {
  return canvasTexture((g, W) => {
    const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    r.addColorStop(0, `rgba(${colour},1)`);
    r.addColorStop(0.2, `rgba(${colour},0.6)`);
    r.addColorStop(1, `rgba(${colour},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, W, W);
  }, 64, 64);
}

// the people (and things) painted in the blind windows' rooms: white where the shape is, on a
// 256 x 256 picture whose bottom edge is the sill
const SHAPES = {
  bride(g) {
    g.beginPath();
    g.ellipse(128, 70, 15, 19, 0, 0, Math.PI * 2);
    g.fill();
    // the veil falling from the head to the shoulders and down the back; the dress to the floor
    g.beginPath();
    g.moveTo(112, 62);
    g.quadraticCurveTo(128, 40, 144, 62);
    g.lineTo(160, 120);
    g.lineTo(150, 126);
    g.quadraticCurveTo(178, 200, 186, 256);
    g.lineTo(70, 256);
    g.quadraticCurveTo(78, 200, 106, 126);
    g.lineTo(96, 120);
    g.closePath();
    g.fill();
  },
  child(g) {
    g.beginPath();
    g.ellipse(120, 132, 15, 17, -0.25, 0, Math.PI * 2); // head, tilted
    g.fill();
    g.beginPath();
    g.moveTo(106, 150);
    g.lineTo(134, 150);
    g.lineTo(146, 220);
    g.lineTo(138, 256);
    g.lineTo(126, 256);
    g.lineTo(122, 226);
    g.lineTo(118, 256);
    g.lineTo(104, 256);
    g.lineTo(96, 220);
    g.closePath();
    g.fill();
    // the toy hanging from one hand by an arm
    g.beginPath();
    g.ellipse(158, 214, 10, 12, 0.3, 0, Math.PI * 2);
    g.ellipse(160, 198, 7, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(140, 176, 16, 5);
  },
  tall(g) {
    g.beginPath();
    g.ellipse(128, 22, 10, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(116, 38);
    g.lineTo(140, 38);
    g.lineTo(146, 120);
    g.lineTo(166, 216); // a long arm, to below the knee
    g.lineTo(158, 218);
    g.lineTo(140, 140);
    g.lineTo(138, 256);
    g.lineTo(130, 256);
    g.lineTo(128, 160);
    g.lineTo(126, 256);
    g.lineTo(118, 256);
    g.lineTo(116, 140);
    g.lineTo(98, 218);
    g.lineTo(90, 216);
    g.lineTo(110, 120);
    g.closePath();
    g.fill();
  },
  reaper(g) {
    g.beginPath();
    g.moveTo(128, 40);
    g.quadraticCurveTo(160, 44, 158, 90); // the hood
    g.lineTo(176, 256);
    g.lineTo(82, 256);
    g.lineTo(98, 90);
    g.quadraticCurveTo(96, 44, 128, 40);
    g.fill();
    // the scythe: a long shaft, the blade curving out at the top
    g.save();
    g.lineWidth = 5;
    g.strokeStyle = '#fff';
    g.beginPath();
    g.moveTo(66, 250);
    g.lineTo(76, 30);
    g.stroke();
    g.beginPath();
    g.moveTo(76, 32);
    g.quadraticCurveTo(140, 8, 178, 50);
    g.quadraticCurveTo(136, 30, 78, 46);
    g.closePath();
    g.fill();
    g.restore();
  },
  crone(g) {
    // an old woman in a rocking chair, side on: drawn about the chair's foot (it rocks)
    g.beginPath();
    g.ellipse(112, 120, 13, 15, 0, 0, Math.PI * 2); // head, bowed
    g.fill();
    g.beginPath();
    g.moveTo(100, 132);
    g.quadraticCurveTo(84, 160, 92, 196); // a bent back
    g.lineTo(150, 200);
    g.lineTo(156, 236);
    g.lineTo(144, 238);
    g.lineTo(138, 212);
    g.lineTo(100, 214);
    g.closePath();
    g.fill();
    g.save();
    g.lineWidth = 5;
    g.strokeStyle = '#fff';
    g.beginPath();
    g.moveTo(84, 110); // the chair's back
    g.lineTo(90, 218);
    g.moveTo(60, 236); // the rocker
    g.quadraticCurveTo(120, 252, 176, 232);
    g.moveTo(92, 216);
    g.lineTo(96, 244);
    g.moveTo(150, 216);
    g.lineTo(148, 244);
    g.stroke();
    g.restore();
  },
  cat(g) {
    g.beginPath();
    g.ellipse(128, 222, 26, 32, 0, 0, Math.PI * 2);
    g.ellipse(128, 180, 16, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath(); // ears
    g.moveTo(114, 174);
    g.lineTo(116, 156);
    g.lineTo(126, 168);
    g.moveTo(142, 174);
    g.lineTo(140, 156);
    g.lineTo(130, 168);
    g.fill();
    g.beginPath(); // the tail curled round
    g.ellipse(160, 250, 26, 6, -0.2, 0, Math.PI * 2);
    g.fill();
  },
  peeker(g) {
    // a face and a shoulder round the left edge of the window, one hand on the frame
    g.beginPath();
    g.ellipse(18, 120, 24, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(0, 150);
    g.quadraticCurveTo(30, 160, 34, 200);
    g.lineTo(0, 210);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(40, 96, 8, 14, 0.3, 0, Math.PI * 2);
    g.fill();
  },
  bats(g) {
    for (const [x, s] of [
      [70, 1],
      [130, 0.8],
      [186, 1.1],
    ]) {
      g.save();
      g.translate(x, 8);
      g.scale(s, s);
      g.fillRect(-1, 0, 2, 12);
      g.beginPath();
      g.ellipse(0, 30, 8, 18, 0, 0, Math.PI * 2);
      g.moveTo(-8, 18);
      g.quadraticCurveTo(-26, 34, -14, 52);
      g.lineTo(-6, 40);
      g.moveTo(8, 18);
      g.quadraticCurveTo(26, 34, 14, 52);
      g.lineTo(6, 40);
      g.fill();
      g.restore();
    }
  },
  hands() {}, // (on the glass: see below)
  eyes() {}, // (only eyes: see below)
};
const SHAPE_ORDER = ['bride', 'peeker', 'cat', 'tall', 'crone', 'eyes', 'child', 'reaper', 'hands', 'bats'];
// the shining eyes each shape has (as fractions of the picture), if any
const EYES = { cat: [[0.47, 0.71], [0.53, 0.71]], eyes: [[0.42, 0.45], [0.58, 0.45]], peeker: [[0.1, 0.46]], bats: [[0.27, 0.12], [0.73, 0.13]], tall: [[0.48, 0.08], [0.52, 0.08]] };

function shapeTexture(name) {
  return canvasTexture((g) => {
    g.fillStyle = '#fff';
    g.filter = 'blur(1.5px)';
    SHAPES[name](g);
  });
}

/** Two muddy hands pressed on the glass, from inside. */
function handsTexture() {
  return canvasTexture((g) => {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.filter = 'blur(2px)';
    for (const [x, y, flip] of [
      [92, 118, -1],
      [168, 104, 1],
    ]) {
      g.save();
      g.translate(x, y);
      g.scale(flip, 1);
      g.beginPath();
      g.ellipse(0, 22, 18, 22, 0, 0, Math.PI * 2);
      g.fill();
      for (const [fx, fy, len, a] of [
        [-14, 4, 26, -0.5],
        [-6, -2, 34, -0.15],
        [4, -2, 36, 0.05],
        [13, 2, 30, 0.25],
        [20, 18, 22, 1.1],
      ]) {
        g.save();
        g.translate(fx, fy);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, -len / 2, 4.5, len / 2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.restore();
    }
  });
}

/** A pale face, for the mirror. */
function faceTexture() {
  return canvasTexture((g, W) => {
    const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    r.addColorStop(0, 'rgba(230,235,240,0.9)');
    r.addColorStop(0.6, 'rgba(200,210,220,0.5)');
    r.addColorStop(1, 'rgba(200,210,220,0)');
    g.fillStyle = r;
    g.beginPath();
    g.ellipse(W / 2, W / 2, W * 0.32, W * 0.44, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(10,10,14,0.95)';
    for (const x of [0.38, 0.62]) {
      g.beginPath();
      g.ellipse(W * x, W * 0.44, W * 0.07, W * 0.05, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.ellipse(W / 2, W * 0.7, W * 0.06, W * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  }, 128, 128);
}

/** A dark old portrait: a woman in black against a brown ground. */
function portraitTexture() {
  return canvasTexture((g, W, H) => {
    const bg = g.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.8);
    bg.addColorStop(0, '#4a3a26');
    bg.addColorStop(1, '#120c07');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#0c0a09';
    g.beginPath();
    g.ellipse(W / 2, H * 0.36, W * 0.15, H * 0.2, 0, 0, Math.PI * 2);
    g.moveTo(W * 0.2, H);
    g.quadraticCurveTo(W * 0.24, H * 0.56, W / 2, H * 0.55);
    g.quadraticCurveTo(W * 0.76, H * 0.56, W * 0.8, H);
    g.fill();
    g.fillStyle = '#c9b8a0';
    g.beginPath();
    g.ellipse(W / 2, H * 0.38, W * 0.1, H * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1210';
    for (const x of [0.46, 0.54]) {
      g.beginPath();
      g.ellipse(W * x, H * 0.36, W * 0.016, H * 0.01, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, 128, 160);
}

const PROPS = ['rocker', 'ghost', 'skeleton', 'clock', 'mirror', 'lantern', 'portrait'];

export class Haunt {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {object[]} o.windows (findWindows)
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh
   * @param {THREE.Box3} o.houseBox
   * @param {{ sample: Function }} [o.sound]
   */
  constructor(scene, { windows, bvh, houseBox, sound = null, bay = null }) {
    this.scene = scene;
    this.bvh = bvh;
    this.houseBox = houseBox;
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Haunting';
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0;
    this.flash = 0;
    this.flight = false; // the Halloween flyby (spooky.js says)
    this.candlesOut = false;
    this.loaded = false;
    this.loading = false;
    // his candle's light: in the scene all year, dark (adding a light later recompiles every shader)
    this.light = new THREE.PointLight(0xffa04a, 0, 5.5, 1.6);
    scene.add(this.light);
    this.dot = glowDot();
    const glow = roomGlow();
    const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    // --- a room behind every window ---
    this.rooms = [];
    let shapeN = 0;
    let propN = 0;
    for (const w of windows) {
      // (the big window over the front door has its own scene: spooky.js. He passes behind it,
      // at the back of the room, unseen)
      w.isBay = !!bay && w.face === 'front' && w.c.distanceTo(bay) < 1.2;
      const deep = w.depth > 1.6;
      // the room's back: a lit wall, at most a couple of metres in (or just behind the glass, if
      // there is a wall there)
      const back = deep ? Math.min(w.depth - 0.1, 2.6) : Math.max(0.03, w.depth * 0.5);
      const room = { w, deep, back, lit: 0, candle: 0, want: 0, phase: Math.random() * 10, out: -1 };
      room.mat = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(1.6, 0.78, 0.32), transparent: true, opacity: 0, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w.width + 0.8, w.top - w.bottom + 0.8), room.mat);
      plane.position.copy(w.c).addScaledVector(w.n, -back);
      plane.lookAt(plane.position.clone().add(w.n));
      plane.renderOrder = 1;
      this.group.add(plane);
      room.plane = plane;
      // a candle on the sill, for the flyby (his, left as he goes)
      room.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: new THREE.Color(2.2, 1.7, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      room.flame.scale.setScalar(0.34);
      room.flame.position.copy(w.c).addScaledVector(w.u, w.width * 0.22).addScaledVector(w.n, -Math.min(0.2, Math.max(0.02, w.depth - 0.04))).setY(w.bottom + 0.14);
      this.group.add(room.flame);
      // where he stands in it: a little in from the glass, on its floor
      const inward = deep ? Math.min(1.3, w.depth * 0.4) : Math.max(0.02, w.depth * 0.4);
      const at = w.c.clone().addScaledVector(w.n, -inward);
      ray.origin.set(at.x, w.bottom + 0.4, at.z);
      const floor = deep ? bvh.raycastFirst(ray, THREE.DoubleSide, 0, 2.6) : null;
      room.floor = floor ? floor.point.y : w.bottom - 0.9;
      room.stand = at.setY(room.floor);
      // (he can be seen there: in a room, or over the hall behind the upstairs windows, where from
      // outside his feet would be below the sill anyway)
      room.show = deep && !w.isBay;
      room.level = w.bottom < 2.6 ? 0 : w.bottom < 6 ? 1 : 2;
      room.angle = Math.atan2(w.c.z - CENTRE.y, w.c.x - CENTRE.x);
      if (w.isBay) {
        room.stand = w.c.clone().addScaledVector(w.n, -3.4).setY(room.floor);
        plane.visible = false;
        room.bay = true;
      } else if (deep && floor) room.prop = PROPS[propN++ % PROPS.length];
      else {
        // a painted someone in the blind window's room
        room.shape = SHAPE_ORDER[shapeN++ % SHAPE_ORDER.length];
        if (room.shape !== 'eyes' && room.shape !== 'hands') {
          room.shapeMat = new THREE.MeshBasicMaterial({ map: shapeTexture(room.shape), color: 0x060405, transparent: true, opacity: 0, depthWrite: false });
          const h = w.top - w.bottom;
          const s = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.9, h * 0.9).translate(0, h * 0.45, 0), room.shapeMat);
          s.position.copy(w.c).addScaledVector(w.n, -Math.max(0.015, back - 0.02)).setY(w.bottom);
          s.lookAt(s.position.clone().add(w.n));
          s.renderOrder = 2;
          this.group.add(s);
          room.shapeMesh = s;
          room.shapeHome = s.position.clone();
        }
        if (room.shape === 'hands') {
          room.handsMat = new THREE.MeshBasicMaterial({ map: handsTexture(), color: 0x2a1e16, transparent: true, opacity: 0, depthWrite: false });
          const s = new THREE.Mesh(new THREE.PlaneGeometry(w.width * 0.9, (w.top - w.bottom) * 0.6), room.handsMat);
          s.position.copy(w.c).addScaledVector(w.n, 0.012);
          s.lookAt(s.position.clone().add(w.n));
          s.renderOrder = 4;
          this.group.add(s);
        }
        const eyes = EYES[room.shape];
        if (eyes) {
          room.eyes = eyes.map(([fx, fy]) => {
            const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot(room.shape === 'cat' ? '190,255,120' : '255,90,60'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
            const h = w.top - w.bottom;
            e.position.copy(w.c).addScaledVector(w.n, -Math.max(0.01, back - 0.04)).addScaledVector(w.u, (fx - 0.5) * h * 0.9).setY(w.bottom + (1 - fy) * h * 0.9);
            e.scale.setScalar(0.09);
            e.renderOrder = 5;
            this.group.add(e);
            return e;
          });
        }
      }
      this.rooms.push(room);
    }
    // --- his round: the ground floor round all four sides, then upstairs, then the top floor ---
    const order = (lvl) => this.rooms.filter((r) => r.level === lvl).sort((a, b) => a.angle - b.angle);
    this.route = [...order(0), ...order(1), ...order(2)];
    this.stop = 0;
    this.pos = this.route[0]?.stand.clone() ?? new THREE.Vector3();
    this.pause = 0;
    this.walker = null;
    this.stats = { windows: this.rooms.length, deep: this.rooms.filter((r) => r.prop).length, painted: this.rooms.filter((r) => r.shape).length };
  }

  /** The walker and the props (only on Halloween, the first time). */
  async load(base = '') {
    if (this.loading) return;
    this.loading = true;
    const loader = new GLTFLoader();
    const get = (n) => loader.loadAsync(`${base}models/halloween/${n}.glb`).catch(() => null);
    const [walker, chair, ghost, skeleton, clock, mirror, lantern, frame] = await Promise.all(['walker', 'rocking-chair', 'sheet-ghost', 'skeleton', 'clock', 'mirror', 'lantern', 'frame'].map(get));
    // the walker: his robe, the candle in his right hand, its flame
    if (walker) {
      const m = cloneSkinned(walker.scene);
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.frustumCulled = false;
      });
      const holder = new THREE.Group();
      holder.add(m);
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(m);
      const act = (n) => {
        const c = walker.animations.find((a) => a.name === n);
        return c ? mixer.clipAction(c) : null;
      };
      const walk = act('Walk_Candle') ?? act('Walk');
      const idle = act('Idle');
      walk?.play();
      let hand = null;
      m.traverse((o) => o.isBone && /hand_?r/i.test(o.name) && (hand = o));
      const candle = new THREE.Group();
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xeee6d0, roughness: 0.6, emissive: 0x3a2a10 }));
      wax.position.y = 0.08;
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: new THREE.Color(2.4, 1.8, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flame.position.y = 0.2;
      flame.scale.setScalar(0.16);
      candle.add(wax, flame);
      if (hand) {
        hand.add(candle);
        // (upright in the world, whatever the hand does: set each frame)
      } else {
        candle.position.set(0.2, 1.13, 0.25);
        holder.add(candle);
      }
      this.walker = { holder, mixer, walk, idle, current: walk, candle, flame, hand };
    }
    // the props, one kind per deep room, in turn
    const place = (obj, room, { out = 0.9, y = null, wall = false } = {}) => {
      const w = room.w;
      const g = new THREE.Group();
      g.add(obj);
      g.position.copy(w.c).addScaledVector(w.n, wall ? -(room.back - 0.06) : -Math.min(out, room.back - 0.3)).setY(y ?? room.floor);
      g.rotation.y = Math.atan2(w.n.x, w.n.z);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        o.receiveShadow = true;
        // (only the skeleton is skinned: the others keep their bounds and are left out off screen)
        o.frustumCulled = !o.isSkinnedMesh;
        // glass drawn by transmission makes three.js draw the whole scene again every frame, for
        // a clock's door and a lantern's panes: plain see-through glass instead
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m, i) => {
          if (!(m.transmission > 0)) return;
          const g = new THREE.MeshStandardMaterial({ color: 0x9aa4a8, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false });
          if (Array.isArray(o.material)) o.material[i] = g;
          else o.material = g;
        });
      });
      this.group.add(g);
      return g;
    };
    const fit = (obj, size, axis = 'y') => {
      const box = new THREE.Box3().setFromObject(obj, true);
      const e = box.getSize(new THREE.Vector3());
      obj.scale.multiplyScalar(size / (axis === 'y' ? e.y : Math.max(e.x, e.z)));
      const b = new THREE.Box3().setFromObject(obj, true);
      obj.position.y -= b.min.y;
    };
    for (const room of this.rooms) {
      if (!room.prop) continue;
      const w = room.w;
      if (room.prop === 'rocker' && chair) {
        const o = chair.scene.clone(true);
        room.obj = place(o, room, { out: 1.3 });
        room.obj.rotation.y += 0.5; // (a little turned)
      } else if (room.prop === 'ghost' && ghost) {
        const o = ghost.scene.clone(true);
        fit(o, 1.72);
        o.traverse((m) => {
          if (m.isMesh) {
            m.material = m.material.clone();
            m.material.emissive = new THREE.Color(0x1c2026);
          }
        });
        room.obj = place(o, room, { out: 1.4 });
        room.home = room.obj.position.clone();
      } else if (room.prop === 'skeleton' && skeleton) {
        const o = cloneSkinned(skeleton.scene);
        fit(o, 1.72);
        room.obj = place(o, room, { out: 1.4 });
        room.mixer = new THREE.AnimationMixer(o);
        const a = (n) => skeleton.animations.find((c) => c.name === n || c.name.endsWith('|' + n));
        room.idle = a('Idle') ? room.mixer.clipAction(a('Idle')) : null;
        room.wave = a('Wave') ? room.mixer.clipAction(a('Wave')) : null;
        room.idle?.play();
        room.current = room.idle;
      } else if (room.prop === 'clock' && clock) {
        const o = clock.scene.clone(true);
        room.obj = place(o, room, { wall: true });
        o.traverse((n) => {
          if (/HourHand/.test(n.name)) room.hour = n;
          if (/MinuteHand/.test(n.name)) room.minute = n;
        });
      } else if (room.prop === 'mirror' && mirror) {
        const o = mirror.scene.clone(true);
        fit(o, 1.0);
        room.obj = place(o, room, { wall: true, y: w.bottom + 0.2 });
        room.face = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTexture(), transparent: true, opacity: 0, depthWrite: false }));
        room.face.scale.set(0.3, 0.38, 1);
        room.face.position.set(0, 0.55, 0.05);
        room.obj.add(room.face);
      } else if (room.prop === 'lantern' && lantern) {
        const o = lantern.scene.clone(true);
        // (hung from the ceiling: the lantern below its pivot)
        const pivot = new THREE.Group();
        const box = new THREE.Box3().setFromObject(o);
        o.position.y = -box.max.y;
        pivot.add(o);
        room.obj = place(pivot, room, { out: 1.2, y: w.top + 0.4 });
      } else if (room.prop === 'portrait' && frame) {
        const o = frame.scene.clone(true);
        fit(o, 1.05);
        o.traverse((n) => {
          if (n.isMesh && /canvas/.test(n.material.name)) n.material = new THREE.MeshStandardMaterial({ map: portraitTexture(), roughness: 0.7 });
        });
        room.obj = place(o, room, { wall: true, y: w.bottom + 0.15 });
        room.eyes = [-0.045, 0.045].map((x) => {
          const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot('255,120,70'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
          e.position.set(x, 0.66, 0.06);
          e.scale.setScalar(0.05);
          room.obj.add(e);
          return e;
        });
      }
    }
    this.loaded = true;
  }

  /** A flyby starts: nothing has happened yet. */
  reset() {
    this.candlesOut = false;
    this.flyStarted = false;
    for (const r of this.rooms) r.want = r.candle = r.out = 0;
  }

  /** The upstairs rooms along the front, west to east, for the flyby. */
  get front() {
    return (this._front ??= this.rooms.filter((r) => r.w.face === 'front' && r.level === 1).sort((a, b) => a.w.s - b.w.s));
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {boolean} o.on Halloween night
   * @param {THREE.Camera} o.camera
   * @param {number} o.flash the lightning, 0..1
   * @param {boolean} o.flight the Halloween flyby is on
   * @param {boolean} o.candlesOut (spooky.js: the end strike has come)
   */
  update(dt, { on, camera, flash = 0, flight = false, candlesOut = false }) {
    this.group.visible = on;
    if (!on) {
      this.light.intensity = 0;
      return;
    }
    if (!this.loaded) {
      this.load().catch((err) => console.warn('the haunting did not load:', err.message));
      this.light.intensity = 0;
      return;
    }
    this.t += dt;
    const cam = camera.position;
    const outside = !this.houseBox.containsPoint(cam);
    const strike = flash > 0.55 && this.flash <= 0.55;
    this.flash = flash;
    const flick = 0.8 + 0.12 * Math.sin(this.t * 13) * Math.sin(this.t * 5.1) + 0.08 * Math.sin(this.t * 31);

    // --- where he is ---
    const wk = this.walker;
    let moving = false;
    let face = null;
    if (flight) {
      // the flyby: along the upstairs rooms of the front, just ahead of you, leaving a candle in each
      const rooms = this.front;
      const along = cam.y > 3.2 && cam.z > -5 && cam.z < 1.5;
      if (!this.flyStarted && along && rooms.length) {
        this.flyStarted = true;
        this.pos.copy(rooms[0].stand);
      }
      if (this.flyStarted && rooms.length) {
        const vx = this._lastX === undefined ? 0 : (cam.x - this._lastX) / Math.max(dt, 1e-3);
        this._vxS = (this._vxS ?? 0) + (vx - (this._vxS ?? 0)) * (1 - Math.exp(-dt * 3));
        const want = Math.max(this.pos.x, Math.min(rooms[rooms.length - 1].stand.x, cam.x + 1.6));
        const step = Math.min(want - this.pos.x, Math.max(0.8, vx + 0.6) * dt);
        if (step > 1e-4 && vx > 0.2) {
          moving = true;
          this.pos.x += step;
        }
        // (between the rooms' own points, along the front)
        let i = 0;
        while (i < rooms.length - 2 && this.pos.x > rooms[i + 1].stand.x) i++;
        const a = rooms[i].stand;
        const b = rooms[Math.min(i + 1, rooms.length - 1)].stand;
        const k = b.x === a.x ? 0 : THREE.MathUtils.clamp((this.pos.x - a.x) / (b.x - a.x), 0, 1);
        this.pos.z = THREE.MathUtils.lerp(a.z, b.z, k);
        this.pos.y = THREE.MathUtils.lerp(a.y, b.y, k);
        // a candle left on each sill as he comes to it
        if (!candlesOut) for (const r of rooms) if (Math.abs(r.stand.x - this.pos.x) < 0.5 && !r.w.isBay) r.want = 1;
        face = moving ? new THREE.Vector3(1, 0, 0) : rooms[i].w.n;
      }
      this._lastX = cam.x;
    } else if (this.route.length) {
      // his round: walking slowly in a room, quickly between them (unseen, behind the walls),
      // stopping at a window now and then to look out
      const r = this.route[this.stop];
      const to = r.stand.clone().sub(this.pos);
      const d = to.length();
      if (this.pause > 0) {
        this.pause -= dt;
        face = r.w.n;
        if (this.pause <= 0) this.stop = (this.stop + 1) % this.route.length;
      } else if (d < 0.05) {
        this.pause = Math.random() < 0.55 ? 2.5 + Math.random() * 5 : 0.01;
      } else {
        const prev = this.route[(this.stop + this.route.length - 1) % this.route.length];
        const near = Math.min(d, prev.stand.distanceTo(this.pos)) < 2.2;
        // (from one floor to the next: at once, out of sight)
        if (Math.abs(to.y) > 1.2 && !near) this.pos.copy(r.stand);
        else this.pos.addScaledVector(to.normalize(), Math.min(d, (near ? WALK : 3.2) * dt));
        moving = true;
        face = to.setY(0);
      }
    }
    // the room he is in, if any (the nearest window, close)
    let inRoom = null;
    let best = 3.2;
    for (const r of this.rooms) {
      const d = r.stand.distanceTo(this.pos);
      if (d < best) {
        best = d;
        inRoom = r;
      }
    }
    const gone = flight && candlesOut;
    this.walkerGone = gone ? Math.min(1, (this.walkerGone ?? 0) + dt) : 0;
    if (wk) {
      const seen = outside && inRoom?.show && !gone;
      wk.holder.visible = !!seen;
      wk.holder.position.copy(this.pos);
      if (face && face.lengthSq() > 1e-6) {
        const yaw = Math.atan2(face.x, face.z);
        let dy = yaw - wk.holder.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        wk.holder.rotation.y += dy * (1 - Math.exp(-dt * 5));
      }
      const want = moving ? wk.walk : wk.idle ?? wk.walk;
      if (want && want !== wk.current) {
        want.reset().play();
        wk.current?.crossFadeTo(want, 0.35, false);
        wk.current = want;
      }
      if (wk.walk) wk.walk.timeScale = flight ? THREE.MathUtils.clamp(Math.abs((this._vxS ?? WALK) / WALK), 0.8, 2.4) : 1;
      wk.mixer.update(dt);
      // the candle upright in his hand, its flame flickering
      if (wk.hand) {
        wk.holder.updateMatrixWorld(true);
        const q = wk.hand.getWorldQuaternion(new THREE.Quaternion()).invert();
        wk.candle.quaternion.copy(q);
        wk.candle.scale.setScalar(1 / wk.hand.getWorldScale(new THREE.Vector3()).x);
      }
      wk.flame.material.opacity = flick;
      wk.flame.visible = !gone;
    }
    // his light: at the candle (or where it would be, when he can't be seen)
    const lightAt = wk?.holder.visible ? wk.flame.getWorldPosition(new THREE.Vector3()) : this.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.light.position.copy(lightAt);
    this.light.intensity = gone ? 0 : 7 * flick;

    // --- the rooms: lit by his candle when he is in them, by a candle he left, by the lightning ---
    const cool = (this._cool ??= new THREE.Color(0.75, 0.82, 1.15));
    const warm = (this._warm ??= new THREE.Color(1.6, 0.78, 0.32));
    for (const r of this.rooms) {
      if (r.out > 0 && (r.out -= dt) <= 0) r.candle = r.want = 0;
      if (candlesOut && r.want && r.out <= 0) r.out = 0.05 + Math.random() * 0.4;
      r.candle += (r.want - r.candle) * (1 - Math.exp(-dt * (r.want ? 2.2 : 8)));
      const his = gone ? 0 : Math.max(0, 1 - r.stand.distanceTo(this.pos) / 3.4);
      const candle = Math.max(his, r.candle * 0.85);
      const f = flash * 0.75;
      r.lit = r.bay ? 0 : Math.max(candle * flick, f);
      r.mat.opacity = r.lit * 0.8;
      r.mat.color.copy(warm).lerp(cool, f / Math.max(1e-3, candle * flick + f));
      r.plane.visible = r.lit > 0.01;
      r.flame.material.opacity = r.candle * flick;
      r.flame.visible = r.candle > 0.01;
      // the painted someone: against the lit room
      if (r.shapeMat) {
        r.shapeMat.opacity = Math.min(1, r.lit * 2.2);
        if (r.shape === 'crone') r.shapeMesh.rotation.z = 0.07 * Math.sin(this.t * 2.2 + r.phase);
        if (r.shape === 'peeker') {
          // round the edge of the window when you aren't looking; back when you are
          const looking = this._looking(camera, r.w.c) && outside;
          r.peek = THREE.MathUtils.clamp((r.peek ?? 0) + (looking ? -dt * 2 : dt * 0.4), 0, 1);
          r.shapeMesh.position.copy(r.shapeHome).addScaledVector(r.w.u, -(1 - r.peek) * r.w.width * 0.5);
        }
        if (r.shape === 'bride') r.shapeMesh.position.copy(r.shapeHome).addScaledVector(r.w.u, 0.08 * Math.sin(this.t * 0.4 + r.phase));
      }
      if (r.handsMat) r.handsMat.opacity = Math.min(1, flash * 1.4 + r.lit * 0.5);
      if (r.eyes) {
        const blink = Math.sin(this.t * 0.7 + r.phase * 3) > 0.96 ? 0 : 1;
        const o = r.shape === 'eyes' ? (0.5 + 0.5 * Math.sin(this.t * 0.25 + r.phase)) * blink : Math.min(1, r.lit * 2) * blink;
        for (const e of r.eyes) e.material.opacity = o;
      }
      // the props
      if (!r.obj) continue;
      const near = cam.distanceTo(r.w.c);
      if (r.prop === 'rocker') {
        r.obj.children[0].rotation.x = 0.13 * Math.sin(this.t * 3.7 + r.phase);
        // (creaking, each time it rocks back, if you are close)
        const back = Math.sin(this.t * 3.7 + r.phase) > 0.98;
        if (back && !r.creaked && near < 14 && outside) this.sound?.sample('rocking-chair', r.obj.position.clone(), { ref: 4, rolloff: 1.3, max: 40, gain: 0.55, lowpass: 2200 });
        r.creaked = back;
      } else if (r.prop === 'ghost') {
        // turning to face you, slowly, and drifting a little
        const yaw = Math.atan2(cam.x - r.obj.position.x, cam.z - r.obj.position.z);
        let dy = yaw - r.obj.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        r.obj.rotation.y += dy * (1 - Math.exp(-dt * 0.35));
        r.obj.position.copy(r.home).addScaledVector(r.w.u, 0.25 * Math.sin(this.t * 0.21 + r.phase));
        r.obj.position.y = r.home.y + 0.04 * Math.sin(this.t * 1.3 + r.phase);
      } else if (r.prop === 'skeleton' && r.mixer) {
        const want = near < 16 && outside && r.wave ? r.wave : r.idle;
        if (want && want !== r.current) {
          want.reset().play();
          r.current?.crossFadeTo(want, 0.4, false);
          r.current = want;
        }
        r.mixer.update(dt);
      } else if (r.prop === 'clock') {
        if (r.minute) r.minute.rotation.z += dt * 1.6;
        if (r.hour) r.hour.rotation.z += dt * 0.14;
      } else if (r.prop === 'mirror') {
        // a face in it: at a flash, and now and then while his candle is there
        const show = Math.max(flash > 0.3 ? 1 : 0, candleIn(this, r) > 0.4 && Math.sin(this.t * 0.5 + r.phase) > 0.6 ? 1 : 0);
        r.faceShow = (r.faceShow ?? 0) + (show - (r.faceShow ?? 0)) * (1 - Math.exp(-dt * (show ? 6 : 1.5)));
        r.face.material.opacity = r.faceShow * 0.85;
      } else if (r.prop === 'lantern') {
        r.obj.children[0].rotation.z = 0.16 * Math.sin(this.t * 1.9 + r.phase);
        r.obj.children[0].rotation.x = 0.06 * Math.sin(this.t * 1.3 + r.phase);
      } else if (r.prop === 'portrait' && r.eyes) {
        const o = Math.max(flash, r.lit > 0.3 && Math.sin(this.t * 0.6 + r.phase) > 0.3 ? 1 : 0);
        for (const e of r.eyes) e.material.opacity = o;
      }
    }
    // a board creaking under him now and then, if you are near
    this.creakIn = (this.creakIn ?? 3) - dt;
    if (this.creakIn <= 0) {
      this.creakIn = 3 + Math.random() * 6;
      if (moving && cam.distanceTo(this.pos) < 16 && !gone) this.sound?.sample('floor-creak', this.pos.clone(), { ref: 4, rolloff: 1.2, max: 50, gain: 0.5, lowpass: 2500, rate: 0.85 + Math.random() * 0.3 });
    }
    if (strike) this.lastStrike = this.t;
  }

  _looking(camera, at) {
    const fwd = camera.getWorldDirection((this._fwd ??= new THREE.Vector3()));
    const to = (this._to ??= new THREE.Vector3()).copy(at).sub(camera.position).normalize();
    return to.dot(fwd) > Math.cos(THREE.MathUtils.degToRad(16));
  }
}

/** How much his candle is in room `r`. */
function candleIn(h, r) {
  return Math.max(0, 1 - r.stand.distanceTo(h.pos) / 3.4);
}
