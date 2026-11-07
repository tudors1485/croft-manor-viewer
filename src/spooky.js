// Halloween evening (31 October, from dusk): a storm in the fog, the house dark, the front door
// standing ajar. Nothing here is a show that repeats; each thing happens once in a while, for a
// moment:
//
// - A figure stands at one of the front windows for a few seconds, then is gone. Only ever one,
//   and never straight away at another window: the next is a long while later, somewhere else.
//   (A flat cut-out just inside the glass, seen from outside only.)
// - Stand close to the front door a while and a dark figure is standing in the gateway behind
//   you, in the fog. Once you look at it, or the lightning flashes, it is gone.
// - After a close strike of lightning the lights outside may fail: they flicker and go out for a
//   few seconds, then come back. (The pumpkins' candles stay lit.)
// - In the Halloween flyby only: someone walks past the upstairs windows carrying a candle, from
//   one room to the next, as you fly along the front.

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

/** A tall figure in a long coat, whole, from head to foot (for the gateway), blurred at the edges. */
function standingTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.filter = 'blur(2.5px)';
  g.beginPath();
  g.ellipse(48, 26, 11, 14, 0, 0, Math.PI * 2); // head
  g.fill();
  g.beginPath();
  g.moveTo(42, 38);
  g.lineTo(54, 38);
  g.quadraticCurveTo(76, 44, 74, 70); // shoulder
  g.lineTo(80, 238); // the coat's hem
  g.lineTo(58, 246);
  g.lineTo(56, 252); // feet
  g.lineTo(40, 252);
  g.lineTo(38, 246);
  g.lineTo(16, 238);
  g.lineTo(22, 70);
  g.quadraticCurveTo(20, 44, 42, 38);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A small warm glow for the candle's flame (seen through the glass). */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,240,200,1)');
  r.addColorStop(0.15, 'rgba(255,190,100,0.7)');
  r.addColorStop(0.5, 'rgba(255,140,50,0.15)');
  r.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Spooky {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree (to find the front windows)
   * @param {(faceIndex: number) => string} o.materialAt the material name of a collision triangle
   * @param {THREE.Box3} o.houseBox (the figures only show from outside)
   * @param {{x: number, z: number}|null} o.gate where the gateway is
   * @param {THREE.Vector3|null} o.door the front door's middle
   * @param {(x: number, z: number) => number|null} o.ground the ground's height
   */
  constructor(scene, { bvh, materialAt, houseBox, gate, door, ground }) {
    this.group = new THREE.Group();
    this.group.name = 'Halloween';
    this.group.visible = false;
    scene.add(this.group);
    this.houseBox = houseBox;
    this.t = 0;
    this.flight = false; // the Halloween flyby is on (the candle walks only then)

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
    const big = windows.filter((w) => w.x1 - w.x0 > 0.5 && w.top - w.bottom > 0.9);
    this.windows = big;

    // each window has its room behind it: dark, but warm with candlelight when someone is there
    for (const w of big) {
      w.roomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 0.35), transparent: true, opacity: 0, depthWrite: false });
      const room = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0 + 1.2, w.top - w.bottom + 1.2), w.roomMat);
      room.position.set(w.cx, (w.top + w.bottom) / 2, w.z - 1.1);
      this.group.add(room);
      w.show = 0;
    }
    // the one figure, moved to whichever window it stands at
    this.figMat = new THREE.MeshBasicMaterial({ map: figureTexture(), color: 0x050407, transparent: true, opacity: 0, depthWrite: false });
    this.figure = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), this.figMat);
    this.figure.renderOrder = 2;
    this.figure.visible = false;
    this.group.add(this.figure);
    this.at = null; // the window it is at
    this.lastAt = null;
    this.figureOn = false;
    this.figureShow = 0;
    this.nextFigure = 12 + Math.random() * 20;

    // --- the candle (the flyby's), with its own light, in the scene all year (dark): adding a
    // light later would recompile every shader ---
    this.candleLight = new THREE.PointLight(0xffa04a, 0, 6, 2);
    scene.add(this.candleLight);
    this.candleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.candleGlow.scale.setScalar(0.35);
    this.group.add(this.candleGlow);
    this.candle = null; // { x, to, row, t }
    this.candleDone = false;

    // --- the figure in the gateway ---
    this.gate = gate;
    this.door = door;
    this.gateMat = new THREE.MeshBasicMaterial({ map: standingTexture(), color: 0x020203, transparent: true, opacity: 0, depthWrite: false });
    this.gateFigure = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.85), this.gateMat);
    this.gateFigure.visible = false;
    // (in the middle of the opening, so the fog beyond outlines it)
    if (gate) this.gateFigure.position.set(gate.x - 0.2, (ground?.(gate.x, gate.z + 0.3) ?? 0) + 0.92, gate.z + 0.3);
    this.group.add(this.gateFigure);
    this.nearDoor = 0; // seconds you have been by the door
    this.gateState = 'waiting'; // waiting → there → gone (then waiting again, a while later)
    this.gateShow = 0;
    this.gateLooked = 0;
    this.gateRearm = 0;

    // --- the lights failing after a close strike ---
    this.cut = 0; // 0 the lights on .. 1 out
    this.cutT = -1;
    this.cutLength = 0;
    this._flash = 0;
    this.cutOnStrike = false; // the flyby: the first strike after the candle has gone puts them out
    this.strikeIn = 0; // (the flyby: seconds until it asks for a close strike)
    this.wantStrike = false; // asks the storm for a close strike now (main.js passes it on)

    this.windowCount = big.length;
  }

  /** Halloween evening: 31 October, from dusk. */
  static isOn(day, night) {
    return Math.floor(day) === HALLOWEEN_DAY && night > 0.15;
  }

  /** Back to the start (a flyby begins): nothing has happened yet. */
  reset() {
    this.candle = null;
    this.candleDone = false;
    this.figureOn = false;
    this.figureShow = 0;
    this.at = null;
    this.lastAt = null;
    this.nextFigure = 0.5;
    this.cut = 0;
    this.cutT = -1;
    this.cutOnStrike = false;
    this.strikeIn = 0;
    this.wantStrike = false;
    this.gateState = 'waiting';
    this.gateShow = 0;
    this.nearDoor = 0;
  }

  /**
   * @param {number} dt
   * @param {THREE.Camera} camera
   * @param {number} day
   * @param {number} night 0 day .. 1 night
   * @param {number} flash the lightning, 0..1
   */
  update(dt, camera, day, night, flash = 0) {
    const on = Spooky.isOn(day, night);
    this.group.visible = on;
    if (!on) {
      this.candleLight.intensity = 0;
      this.cut = 0;
      return;
    }
    this.t += dt;
    const p = camera.position;
    const outside = !this.houseBox.containsPoint(p);
    const strike = flash > 0.55 && this._flash <= 0.55;
    this._flash = flash;
    const fwd = camera.getWorldDirection((this._fwd ??= new THREE.Vector3()));
    // which way you are going along the front (the flyby times its moments by it)
    const vx = dt > 0 && this._lastX !== undefined ? (p.x - this._lastX) / dt : 0;
    this._lastX = p.x;
    this.vx = (this.vx ?? 0) + (vx - (this.vx ?? 0)) * (1 - Math.exp(-dt * 3));
    const along = this.flight && p.y > 3.2 && p.z > -5 && p.z < 1.5; // flying along the front at the windows' height

    // --- the figure at a window: one at a time, a long while apart, never the same window twice running ---
    this.nextFigure -= dt;
    if (this.nextFigure <= 0) {
      if (this.figureOn) {
        this.figureOn = false;
        this.nextFigure = this.flight ? 1e9 : 35 + Math.random() * 50; // (once in the flyby)
      } else {
        // (in the flyby, once you are flying along the front: at a window a little ahead of you)
        const ahead = (w) => along && Math.abs(this.vx) > 0.8 && Math.sign(this.vx) * (w.cx - p.x) > 7 && Math.sign(this.vx) * (w.cx - p.x) < 14;
        const choices = this.windows.filter((w) => w !== this.lastAt && (!this.flight || ahead(w)));
        const w = choices[Math.floor(Math.random() * choices.length)];
        if (w && outside) {
          this.at = this.lastAt = w;
          this.figureOn = true;
          // (in the flyby, gone before you get there)
          this.nextFigure = this.flight ? 2 + Math.random() * 0.6 : 2.5 + Math.random() * 2.5;
          const width = Math.min(0.9, Math.max(0.55, (w.x1 - w.x0) * 0.8));
          this.figure.scale.setScalar(width / 0.7);
          this.figure.position.set(w.cx + (Math.random() - 0.5) * 0.15, w.top - 0.12 - width, w.z - 0.55);
        } else this.nextFigure = this.flight ? 0.5 : 3;
      }
    }
    this.figureShow += ((this.figureOn && outside ? 1 : 0) - this.figureShow) * (1 - Math.exp(-dt * 5));
    this.figMat.opacity = this.figureShow;
    this.figure.visible = this.figureShow > 0.01;

    // --- the candle, in the flyby: along the upstairs rooms ahead of you, slower than you ---
    // (once you have turned and are flying east along the front, after the figure)
    if (along && !this.candle && !this.candleDone && this.vx > 0.8 && this.lastAt && !this.figureOn && p.x > -12 && p.x < 14) {
      const row = this.windows.filter((w) => w.y > 4);
      if (row.length) this.candle = { x: p.x + 4.5, to: p.x + 15, row, t: 0 };
    }
    if (this.candle) {
      const c = this.candle;
      c.t += dt;
      c.x += dt * 0.85;
      // it comes in, walks on, and goes deeper into the house at the end
      const candleOn = THREE.MathUtils.smoothstep(c.t, 0, 1.2) * (1 - THREE.MathUtils.smoothstep(c.x, c.to - 2, c.to));
      if (c.x >= c.to) {
        this.candle = null;
        this.candleDone = true;
        // and a moment later the lightning strikes close by, and the lights go
        this.cutOnStrike = true;
        this.strikeIn = 1.6;
      }
      // just inside the front wall: as far in from the nearest window as that window is set
      let near = c.row[0];
      for (const w of c.row) if (Math.abs(w.cx - c.x) < Math.abs(near.cx - c.x)) near = w;
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 17) * Math.sin(this.t * 6.3 + 1);
      const at = new THREE.Vector3(c.x, near.y - 0.15 + 0.03 * Math.sin(c.t * 4.1), near.z - 1.25);
      this.candleLight.position.copy(at);
      this.candleLight.intensity = 3.2 * candleOn * flicker;
      this.candleGlow.position.copy(at);
      this.candleGlow.material.opacity = 0.9 * candleOn * flicker;
      // the rooms it passes glow warm, the more the closer it is
      for (const w of this.windows) {
        const dx = Math.abs(w.cx - c.x) - (w.x1 - w.x0) / 2;
        const lit = w.y > 4 ? candleOn * (1 - THREE.MathUtils.smoothstep(dx, 0, 2.2)) : 0;
        w.show += (lit - w.show) * (1 - Math.exp(-dt * 6));
      }
    } else {
      this.candleLight.intensity = 0;
      this.candleGlow.material.opacity = 0;
      for (const w of this.windows) w.show += (0 - w.show) * (1 - Math.exp(-dt * 4));
    }
    // and behind the figure, a little light too, so it stands out against the room
    for (const w of this.windows) {
      const behind = w === this.at ? this.figureShow * 0.55 : 0;
      w.roomMat.opacity = Math.max(w.show * 0.7, behind) * (0.85 + 0.15 * Math.sin(this.t * 9 + w.cx));
    }

    // --- the figure in the gateway: once you've stood by the front door a little while ---
    if (this.gate && this.door) {
      const byDoor = Math.hypot(p.x - this.door.x, p.z - this.door.z) < 4.6 && p.y < this.door.y + 2.5;
      this.nearDoor = byDoor ? this.nearDoor + dt : 0;
      const to = (this._to ??= new THREE.Vector3()).copy(this.gateFigure.position).sub(p);
      const dist = to.length();
      const seen = to.normalize().dot(fwd) > Math.cos(THREE.MathUtils.degToRad(14));
      if (this.gateState === 'waiting' && this.nearDoor > 4 && !seen) {
        this.gateState = 'there';
        this.gateLooked = 0;
      } else if (this.gateState === 'there') {
        // looked at for a moment, or lit by the lightning, or walked towards: gone
        this.gateLooked = seen ? this.gateLooked + dt : 0;
        if (this.gateLooked > 0.5 || strike || dist < 12) {
          this.gateState = 'gone';
          this.gateRearm = 150 + Math.random() * 120;
        }
      } else if (this.gateState === 'gone') {
        this.gateRearm -= dt;
        if (this.gateRearm <= 0 && !byDoor) this.gateState = 'waiting';
      }
      const want = this.gateState === 'there' ? 1 : 0;
      this.gateShow += (want - this.gateShow) * (1 - Math.exp(-dt * (want ? 1.5 : 4.5)));
      this.gateMat.opacity = this.gateShow * 0.92;
      this.gateFigure.visible = this.gateShow > 0.01;
      // it faces you
      this.gateFigure.rotation.y = Math.atan2(p.x - this.gateFigure.position.x, p.z - this.gateFigure.position.z);
    }

    if (this.strikeIn > 0 && (this.strikeIn -= dt) <= 0) this.wantStrike = true;
    // --- the lights fail after a close strike, now and then (in the flyby, once, after the candle) ---
    if (strike && this.cutT < 0) {
      if (this.cutOnStrike || (!this.flight && Math.random() < 0.3)) {
        this.cutT = 0;
        this.cutLength = 4 + Math.random() * 4;
        this.cutOnStrike = false;
      }
    }
    if (this.cutT >= 0) {
      this.cutT += dt;
      const t = this.cutT;
      const L = this.cutLength;
      // a stutter as they go, out, and a stutter as they come back
      const stutter = (u) => (Math.sin(u * 53) * Math.sin(u * 31) > 0 ? 1 : 0.25);
      if (t < 0.7) this.cut = stutter(t);
      else if (t < L) this.cut = 1;
      else if (t < L + 0.6) this.cut = 1 - stutter(t) * 0.8;
      else {
        this.cut = 0;
        this.cutT = -1;
      }
    }
  }
}
