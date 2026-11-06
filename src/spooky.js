// Halloween night (31 October, after dark): dark figures stand at the front windows, a few
// seconds at a time, against a candlelit room, then are gone; pale ghosts drift over the lawns
// in the fog, fading in and out, with a low moan when one appears near you. Seen from outside
// only (the figures and their rooms are flat cut-outs just inside the glass).

import * as THREE from 'three';

const HALLOWEEN_DAY = 303; // 31 October (day of the year, from 0)

/** A standing figure, black, head and shoulders and a body fading out below. */
function figureTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.filter = 'blur(1.5px)';
  g.beginPath();
  g.ellipse(64, 42, 19, 23, 0, 0, Math.PI * 2); // head
  g.fill();
  g.beginPath();
  g.moveTo(56, 60);
  g.lineTo(72, 60);
  g.lineTo(76, 74);
  g.quadraticCurveTo(116, 80, 118, 112); // a shoulder
  g.lineTo(108, 256);
  g.lineTo(20, 256);
  g.lineTo(10, 112);
  g.quadraticCurveTo(12, 80, 52, 74); // the other
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A ghost: a soft pale shape with a rounded head, hollow eyes, and a ragged hem that fades away. */
function ghostTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, 'rgba(235,242,255,0.95)');
  grad.addColorStop(0.55, 'rgba(225,235,255,0.6)');
  grad.addColorStop(1, 'rgba(220,232,255,0)');
  g.fillStyle = grad;
  g.filter = 'blur(5px)';
  g.beginPath();
  g.moveTo(24, 70);
  g.bezierCurveTo(24, 10, 104, 10, 104, 70);
  g.lineTo(112, 150);
  for (let i = 0; i <= 6; i++) g.quadraticCurveTo(112 - i * 16 + 8, 176 + (i % 2) * 12, 112 - (i + 1) * 16, 160);
  g.lineTo(16, 150);
  g.closePath();
  g.fill();
  g.filter = 'blur(2px)';
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = 'rgba(0,0,0,0.75)';
  for (const x of [50, 78]) {
    g.beginPath();
    g.ellipse(x, 58, 7, 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Spooky {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree (to find the front windows)
   * @param {(faceIndex: number) => string} o.materialAt the material name of a collision triangle
   * @param {(x: number, z: number) => boolean} o.isLawn open grass at x, z
   * @param {THREE.Box3} o.houseBox (the figures only show from outside)
   * @param {{ moan: (pos: THREE.Vector3) => void }} o.sound
   */
  constructor(scene, { bvh, materialAt, isLawn, houseBox, sound }) {
    this.group = new THREE.Group();
    this.group.name = 'Halloween night';
    this.group.visible = false;
    scene.add(this.group);
    this.houseBox = houseBox;
    this.sound = sound;
    this.t = 0;

    // --- the front windows: rays from the front at two heights; runs of glass are windows ---
    const ray = new THREE.Ray();
    const isGlass = (x, y) => {
      ray.set(new THREE.Vector3(x, y, 6), new THREE.Vector3(0, 0, -1));
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 20);
      if (!hit || hit.point.z > 1 || hit.point.z < -12.5 || Math.abs(hit.face.normal.z) < 0.6) return null;
      return /glass|window_grid/i.test(materialAt(hit.faceIndex)) ? hit.point.z : null;
    };
    const windows = [];
    for (const y of [2.1, 5.3]) {
      let run = null;
      for (let x = -14.4; x <= 29.4; x += 0.1) {
        const z = isGlass(x, y);
        if (z !== null && run && x - run.x1 < 0.45 && Math.abs(z - run.z) < 0.3) run.x1 = x;
        else if (z !== null) {
          if (run) windows.push(run);
          run = { x0: x, x1: x, y, z };
        }
      }
      if (run) windows.push(run);
    }
    // its height: up and down from the middle while there is glass
    for (const w of windows) {
      const cx = (w.x0 + w.x1) / 2;
      let top = w.y;
      let bottom = w.y;
      while (top < w.y + 2.5 && isGlass(cx, top + 0.1) !== null) top += 0.1;
      while (bottom > w.y - 2.5 && isGlass(cx, bottom - 0.1) !== null) bottom -= 0.1;
      Object.assign(w, { cx, top, bottom });
    }
    // six of them, spread along the front, upstairs and down
    const big = windows.filter((w) => w.x1 - w.x0 > 0.5 && w.top - w.bottom > 0.9);
    const chosen = [];
    for (const w of big.sort(() => Math.random() - 0.5)) {
      if (chosen.length >= 6) break;
      if (chosen.every((c) => Math.abs(c.cx - w.cx) > 3 || Math.abs(c.y - w.y) > 1)) chosen.push(w);
    }
    const figTex = figureTexture();
    this.figures = chosen.map((w) => {
      const width = Math.min(0.9, Math.max(0.55, (w.x1 - w.x0) * 0.8));
      const g = new THREE.Group();
      g.position.set(w.cx, 0, w.z);
      // the room behind: warm candlelight, only while someone stands there
      const roomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 0.35), transparent: true, opacity: 0, depthWrite: false });
      const room = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0 + 1.2, w.top - w.bottom + 1.2), roomMat);
      room.position.set(0, (w.top + w.bottom) / 2, -1.1);
      const figMat = new THREE.MeshBasicMaterial({ map: figTex, color: 0x050407, transparent: true, opacity: 0, depthWrite: false });
      const fig = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 2), figMat);
      fig.position.set((Math.random() - 0.5) * 0.15, w.top - 0.12 - width, -0.55);
      fig.renderOrder = 2;
      g.add(room, fig);
      this.group.add(g);
      return { roomMat, figMat, show: 0, next: 1 + Math.random() * 8, on: false };
    });

    // --- the ghosts, drifting over the lawns ---
    const ghostTex = ghostTexture();
    const homes = [
      [-8, 10],
      [-11, 3],
      [12.5, 11],
      [19, 4],
      [-4.5, 15.5],
      [10, 16],
      [25, 13],
      [-13, 14],
    ].filter(([x, z]) => isLawn(x, z));
    this.ghosts = homes.map(([x, z]) => {
      const mat = new THREE.SpriteMaterial({ map: ghostTex, color: 0xdfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      s.scale.set(1.1, 1.65, 1);
      this.group.add(s);
      return { s, mat, home: new THREE.Vector3(x, 0, z), r: 1.2 + Math.random() * 2, a: Math.random() * 6.28, speed: (0.12 + Math.random() * 0.15) * (Math.random() < 0.5 ? -1 : 1), show: 0, next: Math.random() * 6, on: false, phase: Math.random() * 6.28 };
    });
    this.windowCount = this.figures.length;
  }

  /** Halloween night: 31 October, after dark (a Halloween flyby sets that). */
  static isOn(day, night) {
    return Math.floor(day) === HALLOWEEN_DAY && night > 0.4;
  }

  update(dt, camera, day, night) {
    const on = Spooky.isOn(day, night);
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    const outside = !this.houseBox.containsPoint(camera.position);
    // the figures: there for a few seconds, then gone for a while
    for (const f of this.figures) {
      f.next -= dt;
      if (f.next <= 0) {
        f.on = !f.on;
        f.next = f.on ? 3 + Math.random() * 4 : 5 + Math.random() * 10;
      }
      f.show += ((f.on && outside ? 1 : 0) - f.show) * (1 - Math.exp(-dt * 5));
      const flicker = 0.8 + 0.2 * Math.sin(this.t * 9 + f.next * 3);
      f.figMat.opacity = f.show;
      f.roomMat.opacity = f.show * 0.85 * flicker;
    }
    // the ghosts: drifting round their spot, bobbing, fading in and out (and moaning as they come)
    for (const g of this.ghosts) {
      g.next -= dt;
      if (g.next <= 0) {
        g.on = !g.on;
        g.next = g.on ? 5 + Math.random() * 5 : 3 + Math.random() * 8;
        if (g.on && g.s.position.distanceTo(camera.position) < 30) this.sound?.moan?.(g.s.position);
      }
      g.show += ((g.on ? 1 : 0) - g.show) * (1 - Math.exp(-dt * 1.2));
      g.a += g.speed * dt;
      g.s.position.set(g.home.x + Math.cos(g.a) * g.r, 1.15 + 0.15 * Math.sin(this.t * 1.3 + g.phase), g.home.z + Math.sin(g.a) * g.r);
      g.mat.opacity = 0.5 * g.show * (0.85 + 0.15 * Math.sin(this.t * 2.3 + g.phase));
    }
  }
}
