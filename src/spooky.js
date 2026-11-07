// Halloween evening (31 October, from dusk): a storm in the fog, the house dark, the front door
// standing ajar. Nothing here is a show that repeats; each thing happens once in a while, for a
// moment:
//
// - In the bay behind the big window over the front door, a dark figure stands in the middle of
//   the room. A candle on the floor by the window, out of sight below the sill, throws its long
//   shadow up the far wall. Then it is gone: in the flyby when the lightning flashes as you draw
//   level; walking, after a while, or once you have looked at it a moment, or at a flash.
// - Stand close to the front door a while and a dark figure is standing in the gateway behind
//   you, in the fog. Once you look at it, or the lightning flashes, it is gone.
// - After a close strike of lightning the lights outside may fail: they flicker and go out for a
//   few seconds, then come back. (The pumpkins' candles stay lit.)
// - In the Halloween flyby only: as you fly along the front, a candle lights in every room you
//   pass, one after another, and at the end, at a close strike, they all go out at once.

import * as THREE from 'three';

const HALLOWEEN_DAY = 303; // 31 October (day of the year, from 0)

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

/** The gateway figure's outline (as standingTexture draws it), in metres, `W` wide and `H` tall, from its feet. */
function silhouette(W, H) {
  const px = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    px.push([48 + 11 * Math.cos(a), 26 + 14 * Math.sin(a)]);
  }
  // (the head, then the body round from the right shoulder)
  const body = [[54, 38], [70, 46], [74, 70], [80, 238], [58, 246], [56, 252], [40, 252], [38, 246], [16, 238], [22, 70], [26, 46], [42, 38]];
  const pts = [...px.slice(0, 4), ...body, ...px.slice(10)];
  return pts.map(([x, y]) => [(x / 96 - 0.5) * W, (1 - y / 256) * H]);
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

/**
 * A room lit by one candle, seen from outside: warm round the flame (low on the right, where it
 * stands on the sill), falling off into the dark at the edges.
 */
function candlelitRoom() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(80, 92, 0, 72, 84, 92);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  r.addColorStop(1, 'rgba(255,255,255,0.02)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
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
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 22);
      if (!hit || hit.point.z > 1 || hit.point.z < -14.5 || Math.abs(hit.face.normal.z) < 0.6) return null;
      return /glass|window_grid/i.test(materialAt(hit.faceIndex)) ? hit.point.z : null;
    };
    const windows = [];
    for (const y of [2.1, 5.3]) {
      let run = null;
      for (let x = -14.4; x <= 29.4; x += 0.1) {
        const z = isGlass(x, y);
        // (the panes of one window, across its stone mullions, are one window)
        if (z !== null && run && x - run.x1 < 0.62 && Math.abs(z - run.z) < 0.3) run.x1 = x;
        else if (z !== null) {
          if (run) windows.push(run);
          run = { x0: x, x1: x, y, z };
        }
      }
      if (run) windows.push(run);
    }
    // its height: up and down while there is glass, tried across its width (the middle may be a mullion)
    for (const w of windows) {
      w.cx = (w.x0 + w.x1) / 2;
      w.top = w.bottom = w.y;
      for (let k = 0; k <= 6; k++) {
        const x = w.x0 + ((w.x1 - w.x0) * k) / 6;
        if (isGlass(x, w.y) === null) continue;
        let top = w.y;
        let bottom = w.y;
        while (top < w.y + 2.8 && isGlass(x, top + 0.1) !== null) top += 0.1;
        while (bottom > w.y - 2.5 && isGlass(x, bottom - 0.1) !== null) bottom -= 0.1;
        w.top = Math.max(w.top, top);
        w.bottom = Math.min(w.bottom, bottom);
      }
    }
    const big = windows.filter((w) => w.x1 - w.x0 > 0.5 && w.top - w.bottom > 0.9);
    this.windows = big;

    // each window has its room behind it, dark; in the flyby a candle is lit in it as you pass: its
    // flame on the sill inside the glass, the room behind warm with it
    const depth = (w) => {
      ray.set(new THREE.Vector3(w.cx, (w.top + w.bottom) / 2, w.z - 0.05), new THREE.Vector3(0, 0, -1));
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 20);
      return hit ? hit.distance : 20;
    };
    this.flameTex = glowTexture();
    const roomTex = candlelitRoom();
    for (const w of big) {
      w.depth = depth(w);
      w.roomMat = new THREE.MeshBasicMaterial({ map: roomTex, color: new THREE.Color(1.6, 0.78, 0.32), transparent: true, opacity: 0, depthWrite: false });
      const room = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0 + 1.2, w.top - w.bottom + 1.2), w.roomMat);
      room.position.set(w.cx, (w.top + w.bottom) / 2, w.z - Math.min(1.1, w.depth - 0.08));
      this.group.add(room);
      w.room = room;
      w.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, color: new THREE.Color(2.2, 1.7, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      w.flame.scale.setScalar(0.4);
      w.flame.position.set(w.cx + (w.x1 - w.x0) * 0.22, w.bottom + 0.16, w.z - Math.min(0.22, w.depth - 0.05));
      this.group.add(w.flame);
      w.lit = 0; // 0 dark .. 1 its candle lit
      w.want = 0;
      w.phase = Math.random() * 10;
    }

    // --- the figure in the bay behind the big window over the front door ---
    // (the widest window high up near the door's line; the figure stands in the middle of the
    // room behind it, the candle on the floor in the corner by the glass, its shadow thrown up the
    // far side wall: the shadow is the figure's outline seen from the candle, laid on that wall)
    this.bay = null;
    const bay = big.filter((w) => w.y > 4 && Math.abs(w.cx - (door?.x ?? -1.85)) < 4).sort((p, q) => q.x1 - q.x0 - (p.x1 - p.x0))[0];
    if (bay) {
      const across = (y, z, dir) => {
        ray.set(new THREE.Vector3(bay.cx, y, z), new THREE.Vector3(dir, 0, 0));
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 8);
        return hit ? hit.point.x : bay.cx + dir * 1.4;
      };
      ray.set(new THREE.Vector3(bay.cx, bay.bottom + 0.4, bay.z - 1.2), new THREE.Vector3(0, -1, 0));
      const floorHit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 3);
      const floor = floorHit ? floorHit.point.y : bay.bottom - 0.4;
      const z = bay.z - 1.2;
      const west = across(floor + 1.2, z, -1);
      const east = across(floor + 1.2, z, 1);
      // the candle: on the floor below the sill, a little west of the middle; the figure: in the
      // middle of the room, so that flying in from the west you see it through the glass, dark,
      // with its shadow thrown up the back of the room, huge, past the ceiling
      const L = new THREE.Vector3(bay.cx - 0.3, floor + 0.14, bay.z - 0.3);
      const H = 1.8;
      const W = H * (0.62 / 1.85);
      const F = new THREE.Vector3(bay.cx + 0.25, floor, bay.z - 1.5);
      this.figMat = new THREE.MeshBasicMaterial({ map: standingTexture(), color: 0x020203, transparent: true, opacity: 0, depthWrite: false, fog: false });
      this.figure = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.figMat);
      this.figure.position.set(F.x, floor + H / 2, F.z);
      this.figure.renderOrder = 3;
      this.group.add(this.figure);
      // the room's walls lit by the candle, and the shadow on them: painted (the real walls, behind
      // leaded glass and deep in the bay, show too little from outside; and the back of the bay
      // opens on to the dark hall). Warm nearest the candle, falling off; the shadow is the
      // figure's outline seen from the candle, where it lands, cut out of the light
      const tall = 2.9;
      const back = bay.z - 3.1;
      const outline = silhouette(W, H).map(([sx, sy]) => new THREE.Vector3(F.x + sx, floor + sy, F.z));
      this.wallMat = [];
      const lit = (origin, uAxis, vAxis, width, height) => {
        const N = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = N;
        const g = canvas.getContext('2d');
        const normal = uAxis.clone().cross(vAxis);
        const toCanvas = (S) => {
          const d = S.clone().sub(origin);
          return [(d.dot(uAxis) / width) * N, (1 - d.dot(vAxis) / height) * N];
        };
        const along = L.clone().sub(origin).dot(normal);
        const [lx, ly] = toCanvas(L.clone().addScaledVector(normal, -along));
        const reach = N * (0.5 + 0.25 * Math.abs(along));
        const glow = g.createRadialGradient(lx, ly, 0, lx, ly, reach);
        const near = 1 / (1 + 0.12 * along * along);
        glow.addColorStop(0, `rgba(255,255,255,${0.95 * near})`);
        glow.addColorStop(0.35, `rgba(255,255,255,${0.55 * near})`);
        glow.addColorStop(0.75, `rgba(255,255,255,${0.16 * near})`);
        glow.addColorStop(1, 'rgba(255,255,255,0.02)');
        g.fillStyle = glow;
        g.fillRect(0, 0, N, N);
        // the shadow, where the outline seen from the candle lands on this wall
        const pts = outline.map((P) => {
          const t = origin.clone().sub(L).dot(normal) / P.clone().sub(L).dot(normal);
          return toCanvas(L.clone().lerp(P, t));
        });
        g.globalCompositeOperation = 'destination-out';
        g.filter = 'blur(3px)';
        g.fillStyle = 'rgba(0,0,0,0.9)';
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
        const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), color: new THREE.Color(1.45, 0.7, 0.28), transparent: true, opacity: 0, depthWrite: false, fog: false });
        const geo = new THREE.BufferGeometry();
        const c = [origin, origin.clone().addScaledVector(uAxis, width), origin.clone().addScaledVector(uAxis, width).addScaledVector(vAxis, height), origin.clone().addScaledVector(vAxis, height)];
        geo.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap((v) => v.toArray()), 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 2;
        mat.side = THREE.DoubleSide;
        this.group.add(mesh);
        this.wallMat.push(mat);
        return mesh;
      };
      // the back of the bay (facing the window), and the east wall (facing west, as you come in)
      this.walls = [
        lit(new THREE.Vector3(west, floor, back), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), east - west, tall),
        lit(new THREE.Vector3(east - 0.03, floor, back), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), bay.z - 0.05 - back, tall),
      ];
      this.bay = { window: bay, candle: L, figure: F };
      this.bayFlame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flameTex, color: new THREE.Color(2.2, 1.7, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.bayFlame.scale.setScalar(0.28);
      this.bayFlame.position.copy(L).add(new THREE.Vector3(0, 0.05, 0));
      this.group.add(this.bayFlame);
      bay.isBay = true;
    }
    this.figureOn = false;
    this.figureShow = 0;
    this.figureDone = false; // (the flyby: once)
    this.nextFigure = 20 + Math.random() * 25;
    this.figureLooked = 0;
    this.figureFor = 0;

    // --- the bay's candle light, in the scene all year (dark): adding a light later would
    // recompile every shader ---
    this.candleLight = new THREE.PointLight(0xffa04a, 0, 8, 1.8);
    scene.add(this.candleLight);

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
    this.figureOn = false;
    this.figureShow = 0;
    this.figureDone = false;
    this.figureFor = 0;
    this.nextFigure = 0.5;
    this.candlesOut = false;
    this.endStrike = false;
    for (const w of this.windows) w.want = w.lit = 0;
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

    // --- the flyby: a candle lit in each room as you come level with it; all out at the end ---
    if (this.flight) {
      if (along && !this.candlesOut) for (const w of this.windows) if (Math.abs(w.cx - p.x) < 3.2 && !w.isBay) w.want = 1;
      // (at the far end of the front, a close strike: the lights fail and every candle goes out)
      if (along && this.vx > 0.5 && p.x > 16.5 && !this.endStrike) {
        this.endStrike = true;
        this.cutOnStrike = true;
        this.strikeIn = 0.4;
      }
      if (this.endStrike && strike && !this.candlesOut) {
        this.candlesOut = true;
        this.windows.forEach((w, i) => {
          w.want = 0;
          w.outIn = 0.05 + i * 0.04;
        });
      }
    }
    for (const w of this.windows) {
      if (w.outIn > 0) {
        w.outIn -= dt;
        if (w.outIn <= 0) w.lit = 0; // (blown out)
      }
      // a candle catching: a flare, then steady, guttering a little
      w.lit += (w.want - w.lit) * (1 - Math.exp(-dt * (w.want ? 2.2 : 8)));
      const flick = 0.82 + 0.1 * Math.sin(this.t * 13 + w.phase) * Math.sin(this.t * 5.1 + w.phase * 2) + 0.08 * Math.sin(this.t * 31 + w.phase);
      w.flame.material.opacity = w.lit * flick;
      w.flame.visible = w.lit > 0.01;
      w.roomMat.opacity = w.lit * 0.75 * flick;
      w.room.visible = w.lit > 0.01;
    }

    // --- the figure in the bay ---
    if (this.bay) {
      const toBay = (this._toBay ??= new THREE.Vector3()).copy(this.figure.position).sub(p);
      const seenBay = toBay.clone().normalize().dot(fwd) > Math.cos(THREE.MathUtils.degToRad(18));
      if (this.flight) {
        // coming east along the front towards the big window: there; as you draw level, the
        // lightning, and gone
        if (!this.figureDone && !this.figureOn && along && this.vx > 0.5 && p.x > this.bay.window.cx - 7.5 && p.x < this.bay.window.cx - 2) this.figureOn = true;
        if (this.figureOn && p.x > this.bay.window.cx - 1.6 && !this.strikeIn && !this.wantStrike && !this._bayStrike) {
          this._bayStrike = true;
          this.wantStrike = true;
        }
        if (this.figureOn && this._bayStrike && strike) {
          this.figureOn = false;
          this.figureDone = true;
          this._bayStrike = false;
          this.figureShow = 0; // (gone in the flash)
        }
      } else {
        // walking: now and then, while you are outside in front and not looking at it; gone after a
        // while, or once you have looked at it a moment, or at a flash
        const inFront = outside && p.z > this.bay.window.z + 2 && p.z < this.bay.window.z + 45 && Math.abs(p.x - this.bay.window.cx) < 30;
        this.nextFigure -= dt;
        if (!this.figureOn && this.nextFigure <= 0 && inFront && !seenBay) {
          this.figureOn = true;
          this.figureFor = 9 + Math.random() * 7;
          this.figureLooked = 0;
        }
        if (this.figureOn) {
          this.figureFor -= dt;
          this.figureLooked = seenBay ? this.figureLooked + dt : 0;
          if (this.figureFor <= 0 || this.figureLooked > 2.5 || strike || !inFront) {
            this.figureOn = false;
            this.nextFigure = 45 + Math.random() * 60;
            if (strike) this.figureShow = 0;
          }
        }
      }
      const want = this.figureOn && outside ? 1 : 0;
      this.figureShow += (want - this.figureShow) * (1 - Math.exp(-dt * (want ? 1.6 : 3)));
      const flick = 0.8 + 0.12 * Math.sin(this.t * 11) * Math.sin(this.t * 4.3 + 1) + 0.08 * Math.sin(this.t * 29);
      this.figMat.opacity = this.figureShow * 0.96;
      for (const m of this.wallMat) m.opacity = this.figureShow * (0.8 + 0.2 * flick);
      this.figure.visible = this.figureShow > 0.01;
      for (const w of this.walls) w.visible = this.figure.visible;
      this.bayFlame.material.opacity = this.figureShow * flick;
      this.bayFlame.visible = this.figureShow > 0.01;
      this.candleLight.position.copy(this.bay.candle).add(new THREE.Vector3(0, 0.12, 0));
      this.candleLight.intensity = 16 * this.figureShow * flick;
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
