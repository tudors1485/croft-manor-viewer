// The house going up (Scenes › Sights): the manor as it was being built. A fine May morning. The
// house is all there in plan and you know it at once, but it is a building site: the west end is up
// to its battlements and slated, its windows in; along the middle the walls are up to the eaves and
// the roof is open timber, battened at the west end of it and bare rafters further on; the east wing
// is a storey high, its top course toothed where the bricklayers have stopped, racked back in steps
// to the full height of the middle. No glass anywhere, no doors hung, no floors upstairs but their
// joists, the rooms' walls bare brick in lime mortar, the ground floor trodden earth (the cut and the
// bare brick are in the house's own shaders, shell.js and materials.js: the model is untouched).
//
// Round it, timber pole scaffolding lashed with rope: standards a little over a metre out from the
// wall, ledgers along them at every lift, putlogs from the ledgers into the wall, boards on the
// putlogs, a raking brace on each run and a ladder up to its first lift. Over the east wing a pair of
// shear legs with a block of stone hanging from it and its windlass on the ground. The lawns and the
// drive are churned to mud and ruts (materials.js); on them stacks of brick, dressed stone and timber,
// a sand heap and a lime board, masons' bankers, carts and barrows, and the workmen's hut. The
// builder's surveyor walks round with the plans, showing a couple round the house (people.js),
// stopping to look at the plans and to point out the work; a hodman carries brick up the ladder, a
// mason dresses stone at his banker, and a carter brings a load of stone up the drive (sitelife.js),
// all without a sound of building.
//
// Everything is built here from boxes, cylinders and canvases the first time the scene is chosen, and
// fitted to the house with rays (shell.js's, which only meet what is built). Another scene or Reset
// takes it all away and puts the house back as it was.

import * as THREE from 'three';
import { buildTop, HOUSE } from './shell.js';
import { rng, instanced, canvasTexture } from './abandoned.js';
import { Person, Route, Walker } from './people.js';
import { SiteLife } from './sitelife.js';

const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();

/** Fresh-sawn timber: pale, with grain and the odd knot. */
function timberPicture(seed = 5, base = '#b8925f') {
  const R = rng(seed);
  return canvasTexture(256, 64, (g, W, H) => {
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      const y = R() * H;
      g.strokeStyle = `rgba(${90 + R() * 40}, ${60 + R() * 30}, ${30 + R() * 20}, ${0.12 + R() * 0.3})`;
      g.lineWidth = 0.5 + R() * 1.4;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.3, y + (R() - 0.5) * 5, W * 0.7, y + (R() - 0.5) * 5, W, y + (R() - 0.5) * 3);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(80, 50, 25, 0.55)';
      g.beginPath();
      g.ellipse(R() * W, R() * H, 2 + R() * 3, 1.5 + R() * 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, { repeat: true });
}

/** Barked poles: grey-brown, a little rough. */
function polePicture(seed = 7) {
  const R = rng(seed);
  return canvasTexture(64, 256, (g, W, H) => {
    g.fillStyle = '#7a6a54';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(${40 + R() * 50}, ${35 + R() * 40}, ${25 + R() * 30}, ${0.25 + R() * 0.4})`;
      g.fillRect(R() * W, R() * H, 1 + R() * 3, 4 + R() * 16);
    }
    for (let i = 0; i < 20; i++) {
      g.fillStyle = `rgba(${170 + R() * 40}, ${140 + R() * 30}, ${100 + R() * 20}, 0.45)`;
      g.fillRect(R() * W, R() * H, 2 + R() * 6, 3 + R() * 10);
    }
  }, { repeat: true });
}

/** The face of a stack of new bricks: courses of red and orange, lime-dusted. */
function brickStackPicture(seed = 11) {
  const R = rng(seed);
  return canvasTexture(256, 256, (g, W, H) => {
    g.fillStyle = '#5a3020';
    g.fillRect(0, 0, W, H);
    const rows = 12;
    const bh = H / rows;
    for (let r = 0; r < rows; r++) {
      const cols = r % 2 ? 4 : 8; // (headers and stretchers, as they are stacked)
      const bw = W / cols;
      for (let c = 0; c < cols; c++) {
        const t = R();
        g.fillStyle = `rgb(${150 + t * 50}, ${60 + t * 35}, ${35 + t * 20})`;
        g.fillRect(c * bw + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      }
    }
    g.fillStyle = 'rgba(220, 210, 190, 0.12)';
    for (let i = 0; i < 40; i++) g.fillRect(R() * W, R() * H, 6 + R() * 20, 2 + R() * 6);
  });
}

/** Rope: twisted fibre, a dull straw-brown. */
function ropeMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x8a7550, roughness: 1 });
}

export class Building {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {object} o.landscape  (groundHeight, obstacles)
   * @param {import('./shell.js').HouseShell} o.shell
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh
   * @param {(faceIndex:number)=>string} o.materialAt
   * @param {object|null} o.water
   * @param {import('./sound.js').Soundscape|null} o.sound
   * @param {object|null} o.garden
   */
  constructor(scene, { landscape, shell, bvh, materialAt, water = null, sound = null, garden = null }) {
    this.scene = scene;
    this.landscape = landscape;
    this.shell = shell;
    this.bvh = bvh;
    this.materialAt = materialAt;
    this.water = water;
    this.sound = sound;
    this.garden = garden;
    this.on = false;
    this.built = false;
    this.group = new THREE.Group();
    this.group.name = 'The house going up';
    this.group.visible = false;
    scene.add(this.group);
    this.ray = new THREE.Ray();
    this.next = { knock: 2, mallet: 4 };
    this.soundAt = [];
    this.bankers = [];
    this.ladders = [];
  }

  ground(x, z) {
    return this.landscape.groundHeight(x, z) ?? 0.04;
  }

  set(on) {
    if (on === this.on) return;
    this.on = on;
    if (on && !this.built) this._build();
    if (on) this._visitors();
    if (on) (this.life ??= new SiteLife(this)).load();
    this.group.visible = on;
    this.shell?.setMode(on ? 2 : 0);
    if (this.pond) this.pond.mesh.visible = !on;
    if (this.garden) this.garden.group.visible = !on; // (nothing planted yet)
    for (const m of this.landscape.shrubs ?? []) m.visible = !on; // (nor the bushes at the house's foot)
  }

  _build() {
    const t0 = performance.now();
    this.built = true;
    this.R = rng(17860512);
    this.stats = {};
    this.mats = {
      pole: new THREE.MeshStandardMaterial({ map: polePicture(), roughness: 0.95, envMapIntensity: 0.3 }),
      board: new THREE.MeshStandardMaterial({ map: timberPicture(5), roughness: 0.85, envMapIntensity: 0.3 }),
      sawn: new THREE.MeshStandardMaterial({ map: timberPicture(9, '#a88458'), roughness: 0.85, envMapIntensity: 0.3 }),
      rope: ropeMaterial(),
      stone: new THREE.MeshStandardMaterial({ color: 0x8a8068, roughness: 0.95, envMapIntensity: 0.2 }),
      bricks: new THREE.MeshStandardMaterial({ map: brickStackPicture(), roughness: 0.9, envMapIntensity: 0.25 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.6, metalness: 0.6 }),
    };
    this.poles = [];
    this.boards = [];
    this.lashings = [];
    this.timbers = [];
    this._findPond();
    this._scaffold();
    this._roofTimbers();
    this._joists();
    this._site();
    this._shearLegs();
    // all the poles, boards, lashings and sawn timbers, each in one draw
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
    this.group.add(instanced(cyl, this.mats.pole, this.poles));
    this.group.add(instanced(new THREE.BoxGeometry(1, 1, 1), this.mats.board, this.boards));
    this.group.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 8, 1), this.mats.rope, this.lashings, { shadow: false }));
    this.group.add(instanced(new THREE.BoxGeometry(1, 1, 1), this.mats.sawn, this.timbers));
    Object.assign(this.stats, { poles: this.poles.length, boards: this.boards.length, lashings: this.lashings.length, timbers: this.timbers.length, ms: Math.round(performance.now() - t0) });
    console.info('the house going up', JSON.stringify(this.stats));
  }

  _findPond() {
    const at = new THREE.Vector3(4.59, 0, 8.28);
    const surfaces = (this.water?.surfaces ?? []).filter((w) => w.outdoor);
    this.pond = surfaces.sort((a, b) => a.box.getCenter(new THREE.Vector3()).distanceTo(at) - b.box.getCenter(new THREE.Vector3()).distanceTo(at))[0] ?? null;
  }

  /** A pole from a to b, radius r (one instance of the shared cylinder). */
  pole(a, b, r = 0.065, list = this.poles) {
    const d = _v.subVectors(b, a);
    const len = d.length();
    if (len < 0.05) return;
    _q.setFromUnitVectors(Y, d.clone().normalize());
    list.push(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), _q, _s.set(r, len, r)));
  }

  /** A box (a board, a timber) from a to b, w wide (across, horizontal) and t thick. */
  beam(a, b, w, t, list = this.boards, roll = 0) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 0.05) return;
    const x = d.clone().normalize();
    let side = new THREE.Vector3().crossVectors(Y, x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const up = new THREE.Vector3().crossVectors(x, side).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, side));
    if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll));
    list.push(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, _s.set(len, t, w)));
  }

  // --- the scaffolding -----------------------------------------------------------------------------

  /**
   * The walls' outer faces as straight runs: rays in from all four sides at chest height, grouped
   * where the face keeps to one line.
   */
  _faceRuns() {
    const sides = [
      { dir: new THREE.Vector3(0, 0, -1), from: (s) => new THREE.Vector3(s, 1.4, HOUSE.z1 + 2), range: [HOUSE.x0, HOUSE.x1], axis: 'x' },
      { dir: new THREE.Vector3(0, 0, 1), from: (s) => new THREE.Vector3(s, 1.4, HOUSE.z0 - 2), range: [HOUSE.x0, HOUSE.x1], axis: 'x' },
      { dir: new THREE.Vector3(-1, 0, 0), from: (s) => new THREE.Vector3(HOUSE.x1 + 2, 1.4, s), range: [HOUSE.z0, HOUSE.z1], axis: 'z' },
      { dir: new THREE.Vector3(1, 0, 0), from: (s) => new THREE.Vector3(HOUSE.x0 - 2, 1.4, s), range: [HOUSE.z0, HOUSE.z1], axis: 'z' },
    ];
    const runs = [];
    for (const side of sides) {
      let cur = null;
      const close = () => {
        if (cur && cur.pts.length >= 6) runs.push(cur);
        cur = null;
      };
      for (let s = side.range[0]; s <= side.range[1]; s += 0.5) {
        const h = this.shell.hit(side.from(s), side.dir, 30, 2);
        // (a wall facing back at us, brick or stone)
        if (!h || Math.abs(h.normal.y) > 0.3 || h.normal.dot(side.dir) > -0.8 || !/brick|whitestone/.test(h.name)) {
          close();
          continue;
        }
        const depth = side.axis === 'x' ? h.point.z : h.point.x;
        if (cur && Math.abs(depth - cur.depth) > 0.3) close();
        if (!cur) cur = { pts: [], depth, normal: side.dir.clone().negate(), axis: side.axis };
        cur.pts.push(h.point);
      }
      close();
    }
    return runs;
  }

  /** How high the wall stands at a point of its face. */
  _wallHeight(p, normal) {
    if (p.x > 9.5) return buildTop(p.x);
    const h = this.shell.hit(new THREE.Vector3(p.x - normal.x * 0.15, 30, p.z - normal.z * 0.15), DOWN, 30, 2);
    return THREE.MathUtils.clamp(h ? h.point.y : 8, 3, 11);
  }

  _scaffold() {
    const R = this.R;
    const runs = this._faceRuns();
    const OUT = 1.3; // the standards out from the wall
    let n = 0;
    for (const run of runs) {
      const a = run.pts[0];
      const b = run.pts[run.pts.length - 1];
      if (Math.max(a.x, b.x) < -2) continue; // (the west end is finished: its scaffold is down)
      const nrm = run.normal;
      const along = new THREE.Vector3().subVectors(b, a).setY(0);
      const L = along.length();
      along.normalize();
      const count = Math.max(2, Math.ceil(L / 2.1) + 1);
      const stds = [];
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const at = a.clone().lerp(b, t).setY(0);
        const foot = at.clone().addScaledVector(nrm, OUT);
        foot.y = this.ground(foot.x, foot.z);
        const H = this._wallHeight(at, nrm) + 1.1;
        stds.push({ foot, H, at, top: foot.y + H });
        // the standard, a little out of true
        const top = foot.clone().add(new THREE.Vector3((R() - 0.5) * 0.08, H, (R() - 0.5) * 0.08));
        this.pole(foot.clone().setY(foot.y - 0.3), top, 0.06 + R() * 0.015);
      }
      // the lifts: a ledger along the standards that reach it, putlogs into the wall, boards on them
      for (let y = 1.4; ; y += 1.4) {
        // (the span of standards that stand above this lift)
        const tall = stds.map((s) => s.H > y + 0.4);
        if (!tall.some(Boolean)) break;
        let i0 = tall.indexOf(true);
        while (i0 < stds.length) {
          let i1 = i0;
          while (i1 + 1 < stds.length && tall[i1 + 1]) i1++;
          if (i1 > i0) {
            const s0 = stds[i0];
            const s1 = stds[i1];
            const ly0 = s0.foot.y + y;
            const ly1 = s1.foot.y + y;
            const p0 = s0.foot.clone().setY(ly0).addScaledVector(nrm, 0.09).addScaledVector(along, -0.25);
            const p1 = s1.foot.clone().setY(ly1).addScaledVector(nrm, 0.09).addScaledVector(along, 0.25);
            this.pole(p0, p1, 0.05);
            for (let k = i0; k <= i1; k++) {
              const s = stds[k];
              const ly = s.foot.y + y;
              this.lashings.push(new THREE.Matrix4().compose(s.foot.clone().setY(ly).addScaledVector(nrm, 0.04), _q.identity(), _s.set(0.085, 0.14, 0.085)));
            }
            // putlogs: at every standard and between, from the ledger into the wall
            const putlogs = [];
            for (let k = i0; k <= i1; k++) {
              putlogs.push(stds[k]);
              if (k < i1) putlogs.push({ foot: stds[k].foot.clone().lerp(stds[k + 1].foot, 0.5), at: stds[k].at.clone().lerp(stds[k + 1].at, 0.5) });
            }
            const py = (s) => s.foot.y + y + 0.07;
            for (const s of putlogs) {
              const outer = s.foot.clone().setY(py(s)).addScaledVector(nrm, 0.2);
              const inner = s.at.clone().setY(py(s)).addScaledVector(nrm, -0.12);
              this.pole(inner, outer, 0.04);
            }
            // boards on the putlogs: five across, butted along the run, the odd one askew
            const by = Math.min(py(s0), py(s1)) + 0.065;
            for (let j = 0; j < 5; j++) {
              const off = 0.18 + j * 0.24 + (R() - 0.5) * 0.03;
              const q0 = s0.at.clone().setY(by).addScaledVector(nrm, off).addScaledVector(along, -0.1);
              const q1 = s1.at.clone().setY(by).addScaledVector(nrm, off).addScaledVector(along, 0.1);
              // (in lengths of about four metres)
              const len = q0.distanceTo(q1);
              const pieces = Math.max(1, Math.round(len / 3.9));
              for (let pc = 0; pc < pieces; pc++) {
                const u0 = q0.clone().lerp(q1, pc / pieces);
                const u1 = q0.clone().lerp(q1, (pc + 1) / pieces).addScaledVector(along, 0.05);
                u0.y += (pc % 2) * 0.012;
                u1.y += (pc % 2) * 0.012;
                this.beam(u0, u1, 0.22, 0.035, this.boards, (R() - 0.5) * 0.04);
              }
            }
          }
          i0 = i1 + 1;
          while (i0 < stds.length && !tall[i0]) i0++;
        }
      }
      // a raking brace across the face, outside the standards
      if (stds.length >= 3) {
        const s0 = stds[0];
        const s2 = stds[Math.min(stds.length - 1, 3)];
        const h = Math.min(s0.H, s2.H) - 0.3;
        this.pole(s0.foot.clone().addScaledVector(nrm, 0.16).setY(s0.foot.y + 0.1), s2.foot.clone().addScaledVector(nrm, 0.16).setY(s2.foot.y + h), 0.045);
      }
      // a ladder up to the first lift, at one end
      if (stds.length >= 2 && stds[0].H > 2.6) {
        const s = stds[1];
        const top = s.foot.clone().setY(s.foot.y + 2.6 + 0.9).addScaledVector(nrm, 0.25).addScaledVector(along, -0.6);
        const foot = s.foot.clone().addScaledVector(nrm, 1.35).addScaledVector(along, -0.6);
        foot.y = this.ground(foot.x, foot.z);
        this._ladder(foot, top, along);
        // (for the hodman: the ladder, and where its top lands on the boards of the lift)
        const boardY = s.foot.y + 2.8 + 0.135;
        this.ladders.push({ foot, top, along: along.clone(), nrm: nrm.clone(), boardY, board: s.at.clone().addScaledVector(nrm, 0.62).addScaledVector(along, -0.6).setY(boardY) });
      }
      for (const s of stds) this.soundAt.push(s.foot.clone().setY(s.foot.y + Math.min(s.H - 1, 6)));
      n++;
    }
    this.stats.scaffoldRuns = n;
  }

  /** A ladder of two poles and rungs, from its foot to its top, `across` its width. */
  _ladder(foot, top, across) {
    const w = 0.24;
    const a0 = foot.clone().addScaledVector(across, -w);
    const a1 = top.clone().addScaledVector(across, -w);
    const b0 = foot.clone().addScaledVector(across, w);
    const b1 = top.clone().addScaledVector(across, w);
    this.pole(a0, a1, 0.035);
    this.pole(b0, b1, 0.035);
    const len = foot.distanceTo(top);
    for (let d = 0.3; d < len - 0.1; d += 0.3) {
      const t = d / len;
      this.pole(a0.clone().lerp(a1, t), b0.clone().lerp(b1, t), 0.02);
    }
  }

  // --- the roof in timber ----------------------------------------------------------------------------

  /** The roof's surface down a line of rays: the points of the top roof, with their normals. */
  _roofLine(points) {
    const out = [];
    for (const p of points) {
      this.ray.origin.set(p.x, 30, p.z);
      this.ray.direction.copy(DOWN);
      const h = this.bvh.raycastFirst(this.ray, THREE.DoubleSide, 0, 40);
      if (!h || !/^cm_roof/.test(this.materialAt(h.faceIndex))) {
        out.push(null);
        continue;
      }
      const n = h.face.normal.clone();
      if (n.y < 0) n.negate();
      out.push({ p: h.point.clone(), n });
    }
    return out;
  }

  /** Straight stretches of a line of roof points: one slope, no gap, the same pitch. */
  _segments(line, test) {
    const segs = [];
    let cur = [];
    const close = () => {
      if (cur.length >= 3) segs.push(cur);
      cur = [];
    };
    for (const h of line) {
      if (!h || !test(h)) {
        close();
        continue;
      }
      const last = cur[cur.length - 1];
      if (last && (last.n.angleTo(h.n) > 0.12 || Math.abs(last.p.y - h.p.y) > 0.35)) close();
      cur.push(h);
    }
    close();
    return segs;
  }

  /**
   * Where the roof is not slated yet (the middle of the house), its timbers, as a carpenter frames
   * a roof: a wall plate along the top of each wall, a ridge board along each ridge, and common
   * rafters 450 apart between them, each sitting on the plate at its foot and against the ridge board
   * (or a standing wall) at its head; at the west end of it, battens across the rafters, ready for the
   * slates. A rafter that would rest on nothing at either end is left out, and so are the hips and
   * the small cross roofs (not framed yet), so nothing hangs in the air.
   */
  _roofTimbers() {
    const X0 = -2.4;
    const X1 = 9.4;
    const BATTENS = 3.5; // (battened as far as here)
    const DEPTH = 0.1; // (the timbers' faces just under where the slates will lie)
    const z0 = HOUSE.z0;
    const z1 = HOUSE.z1;
    const faceZ = (h) => Math.abs(h.n.z) >= Math.abs(h.n.x) && h.n.y < 0.95 && h.n.y > 0.3;
    const masonry = (name) => /brick|whitestone/.test(name);
    // is there brick or stone under this point (within `below`), or against it in direction `dir`?
    const restsOn = (p, below = 1.4) => {
      const h = this.shell.hit(new THREE.Vector3(p.x, p.y + 0.25, p.z), DOWN, below + 0.25, 2);
      return h && masonry(h.name);
    };
    const abuts = (p, dir) => {
      const h = this.shell.hit(p.clone().addScaledVector(dir, -0.1), dir, 1.1, 2);
      return h && masonry(h.name);
    };
    // every slope's straight runs, down lines of rays 450 apart (along z: the slopes facing north and south)
    const runs = [];
    for (let x = X0 + 0.2; x < X1; x += 0.45) {
      const pts = [];
      for (let z = z0; z <= z1; z += 0.2) pts.push(new THREE.Vector3(x, 0, z));
      for (const seg of this._segments(this._roofLine(pts), faceZ)) {
        const a = seg[0].p;
        const b = seg[seg.length - 1].p;
        const rise = Math.abs(b.y - a.y) / Math.max(0.01, Math.abs(b.z - a.z));
        if (rise < 0.35 || rise > 2.5) continue; // (a rafter rises: a flat run is a gutter or a lead)
        const n = seg[0].n;
        const foot = (a.y < b.y ? a : b).clone().addScaledVector(n, -DEPTH);
        const head = (a.y < b.y ? b : a).clone().addScaledVector(n, -DEPTH);
        runs.push({ x, foot, head, n, side: Math.sign(n.z) });
      }
    }
    // ridges: two runs at the same x whose heads meet, back to back
    for (const r of runs) {
      r.ridge = runs.find((o) => o !== r && o.x === r.x && o.side === -r.side && Math.abs(o.head.y - r.head.y) < 0.2 && Math.abs(o.head.z - r.head.z) < 0.6) ?? null;
    }
    const kept = [];
    let feet = 0;
    let heads = 0;
    for (const r of runs) {
      // its foot on the wall (the plate on the wall's top, or the wall right beside it, behind a
      // parapet), its head on the ridge or against a wall
      const up = new THREE.Vector3(0, 0, -r.side);
      const down = up.clone().negate();
      const low = r.foot.clone().add(new THREE.Vector3(0, -0.35, 0));
      const footOk = restsOn(r.foot, 1.6) || abuts(low, down) || abuts(r.foot, down);
      const headOk = !!r.ridge || abuts(r.head, up) || abuts(r.head.clone().add(new THREE.Vector3(0, -0.3, 0)), up);
      r.footOk = footOk;
      r.headOk = headOk;
      if (footOk) feet++;
      if (headOk) heads++;
    }
    // valleys: where two slopes come down to meet (the gutter between the two roofs of a double pile),
    // their feet rest on a valley beam, propped on posts (the spine wall under it is not up yet)
    const valleys = [];
    for (const r of runs) {
      if (r.footOk || r.valley) continue;
      const o = runs.find((q) => q !== r && q.x === r.x && q.side === -r.side && !q.footOk && Math.abs(q.foot.y - r.foot.y) < 0.35 && Math.abs(q.foot.z - r.foot.z) < 0.9);
      if (!o) continue;
      const at = r.foot.clone().lerp(o.foot, 0.5);
      r.valley = o.valley = at;
      r.footOk = o.footOk = true;
      valleys.push({ x: r.x, p: at });
    }
    for (const r of runs) if (r.footOk && r.headOk) kept.push(r);
    this.stats.raftersFeetOk = feet;
    this.stats.raftersHeadsOk = heads;
    const rafters = [];
    const plates = [];
    const ridges = [];
    const battens = [];
    for (const r of kept) {
      // (the head a little short of the ridge board's middle; the foot over the plate)
      const head = r.ridge ? r.head.clone().lerp(r.ridge.head, 0.5).addScaledVector(new THREE.Vector3(0, 0, r.side), 0.03) : r.head;
      // (in a valley, down onto the valley beam)
      const foot = r.valley ? r.valley.clone().addScaledVector(new THREE.Vector3(0, 0, r.side), 0.05) : r.foot;
      this.beam(foot, head, 0.06, 0.15, rafters);
    }
    // plates and ridge boards: along x, joining the feet (and the heads) of rafters side by side
    const chain = (items, get, list, w, t, drop) => {
      items.sort((a, b) => a.x - b.x);
      let run = [];
      const close = () => {
        if (run.length >= 2) {
          const a = get(run[0]).clone();
          const b = get(run[run.length - 1]).clone();
          a.x -= 0.2;
          b.x += 0.2;
          a.y = b.y = Math.min(a.y, b.y) - drop;
          this.beam(a, b, w, t, list);
        }
        run = [];
      };
      for (const it of items) {
        const last = run[run.length - 1];
        if (last && (it.x - last.x > 0.5 || Math.abs(get(it).y - get(last).y) > 0.12 || Math.abs(get(it).z - get(last).z) > 0.3)) close();
        run.push(it);
      }
      close();
    };
    for (const side of [-1, 1]) {
      // (grouped by where the foot is, so each wall's plate is its own)
      const feet = kept.filter((r) => r.side === side && !r.valley);
      const byWall = new Map();
      for (const r of feet) {
        const key = `${Math.round(r.foot.z * 2)}:${Math.round(r.foot.y * 4)}`;
        if (!byWall.has(key)) byWall.set(key, []);
        byWall.get(key).push(r);
      }
      for (const g of byWall.values()) chain(g, (r) => r.foot, plates, 0.1, 0.075, 0.1);
    }
    {
      const heads = kept.filter((r) => r.ridge && r.side > 0).map((r) => ({ x: r.x, p: r.head.clone().lerp(r.ridge.head, 0.5) }));
      const byRidge = new Map();
      for (const h of heads) {
        const key = `${Math.round(h.p.z * 2)}:${Math.round(h.p.y * 4)}`;
        if (!byRidge.has(key)) byRidge.set(key, []);
        byRidge.get(key).push(h);
      }
      for (const g of byRidge.values()) chain(g, (h) => h.p, ridges, 0.04, 0.22, 0.04);
    }
    // the valley beams, and their posts down to the floor below, every couple of metres
    const posts = [];
    {
      const byValley = new Map();
      for (const v of valleys) {
        const key = `${Math.round(v.p.z * 2)}:${Math.round(v.p.y * 4)}`;
        if (!byValley.has(key)) byValley.set(key, []);
        byValley.get(key).push(v);
      }
      for (const g of byValley.values()) {
        g.sort((a, b) => a.x - b.x);
        let run = [];
        const close = () => {
          if (run.length >= 2) {
            const a = run[0].p.clone().add(new THREE.Vector3(-0.2, -0.16, 0));
            const b = run[run.length - 1].p.clone().add(new THREE.Vector3(0.2, -0.16, 0));
            a.y = b.y = Math.min(a.y, b.y);
            this.beam(a, b, 0.15, 0.2, plates);
            const n = Math.max(2, Math.round(a.distanceTo(b) / 2.2) + 1);
            for (let i = 0; i < n; i++) {
              const top = a.clone().lerp(b, i / (n - 1)).add(new THREE.Vector3(0, -0.1, 0));
              const floor = this.shell.hit(top.clone().add(new THREE.Vector3(0, -0.2, 0)), DOWN, 12, 2);
              const bottom = new THREE.Vector3(top.x, floor ? floor.point.y : 0, top.z);
              this.beam(bottom, top, 0.14, 0.14, posts);
            }
          }
          run = [];
        };
        for (const v of g) {
          if (run.length && v.x - run[run.length - 1].x > 0.5) close();
          run.push(v);
        }
        close();
      }
    }
    this.timbers.push(...posts);
    this.stats.valleyPosts = posts.length;
    // battens: across neighbouring rafters of one slope, every 0.3 m up it, where the slaters will go next
    {
      const slopes = new Map();
      for (const r of kept) {
        if (r.x > BATTENS) continue;
        const key = `${r.side}:${Math.round(r.foot.z * 2)}:${Math.round(r.foot.y * 4)}:${Math.round(r.head.y * 4)}`;
        if (!slopes.has(key)) slopes.set(key, []);
        slopes.get(key).push(r);
      }
      for (const g of slopes.values()) {
        g.sort((a, b) => a.x - b.x);
        let i = 0;
        while (i < g.length) {
          let j = i;
          while (j + 1 < g.length && g[j + 1].x - g[j].x < 0.5) j++;
          if (j > i) {
            const a = g[i];
            const b = g[j];
            const len = a.foot.distanceTo(a.head);
            for (let d = 0.15; d < len - 0.1; d += 0.3) {
              const t = d / len;
              const p0 = a.foot.clone().lerp(a.head, t).addScaledVector(a.n, 0.09);
              const p1 = b.foot.clone().lerp(b.head, t).addScaledVector(b.n, 0.09);
              p0.x -= 0.03;
              p1.x += 0.03;
              this.beam(p0, p1, 0.05, 0.025, battens);
            }
          }
          i = j + 1;
        }
      }
    }
    this.timbers.push(...rafters, ...plates, ...ridges, ...battens);
    Object.assign(this.stats, { rafters: rafters.length, droppedRafters: runs.length - kept.length, plates: plates.length, ridges: ridges.length, battens: battens.length });
  }

  /** The floors upstairs: their joists in, 400 apart, no boards on them yet. */
  _joists() {
    const joists = [];
    for (let x = HOUSE.x0 + 0.2; x < HOUSE.x1; x += 0.4) {
      // every floor this line of rays goes down through, level by level
      const levels = new Map();
      for (let z = HOUSE.z0; z <= HOUSE.z1; z += 0.25) {
        this.ray.origin.set(x, 25, z);
        this.ray.direction.copy(DOWN);
        const hits = this.bvh.raycast(this.ray, THREE.DoubleSide, 0, 30);
        for (const h of hits) {
          // (the first floor's: they rest on the ground floor's walls; the floor above waits for the walls
          // up there, not built yet inside)
          if (h.point.y < 2.2 || h.point.y > Math.min(4.5, buildTop(x) - 0.3)) continue;
          if (Math.abs(h.face.normal.y) < 0.9) continue;
          if (!/^cm_int_floor/.test(this.materialAt(h.faceIndex))) continue;
          const key = Math.round(h.point.y * 10);
          if (!levels.has(key)) levels.set(key, []);
          levels.get(key).push({ z, y: h.point.y });
        }
      }
      for (const pts of levels.values()) {
        pts.sort((a, b) => a.z - b.z);
        let start = pts[0];
        let prev = pts[0];
        const close = () => {
          if (prev.z - start.z >= 0.7) this.beam(new THREE.Vector3(x, start.y - 0.13, start.z - 0.1), new THREE.Vector3(x, start.y - 0.13, prev.z + 0.1), 0.07, 0.22, joists);
        };
        for (let i = 1; i < pts.length; i++) {
          if (pts[i].z - prev.z > 0.3) {
            close();
            start = pts[i];
          }
          prev = pts[i];
        }
        close();
      }
    }
    this.timbers.push(...joists);
    this.stats.joists = joists.length;
  }

  // --- the site --------------------------------------------------------------------------------------

  _site() {
    const R = this.R;
    const obstacles = this.landscape.obstacles;
    const block = (x, z, r) => obstacles?.push({ x, z, r, when: () => this.on });
    const box = new THREE.BoxGeometry(1, 1, 1);
    // stacks of new brick along the front of the east wing, where it is going up
    const stacks = [];
    for (let i = 0; i < 16; i++) {
      const x = 11 + (i % 8) * 1.9 + (R() - 0.5) * 0.4;
      const z = -6.4 + Math.floor(i / 8) * 1.6 + (R() - 0.5) * 0.3;
      const h = 0.7 + R() * 0.45;
      _q.setFromAxisAngle(Y, (R() - 0.5) * 0.15);
      stacks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, this.ground(x, z) + h / 2, z), _q, _s.set(1.1, h, 0.75)));
      block(x, z, 0.6);
    }
    this.group.add(instanced(box, this.mats.bricks, stacks));
    // dressed stone for the dressings: blocks in a pile by the porch, two bankers with a block on each
    const stones = [];
    for (let i = 0; i < 22; i++) {
      const x = -7.5 + (R() - 0.5) * 4;
      const z = -5 + (R() - 0.5) * 2.4;
      const w = 0.5 + R() * 0.5;
      const h = 0.3 + R() * 0.25;
      const y = this.ground(x, z) + h / 2 + (i > 14 ? 0.45 : 0);
      _q.setFromAxisAngle(Y, R() * 0.4);
      stones.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, _s.set(w, h, 0.4 + R() * 0.3)));
    }
    block(-7.5, -5, 2);
    for (const [x, z] of [
      [-3.6, -4.2],
      [-10.8, -4.6],
    ]) {
      const y = this.ground(x, z);
      // the banker: a stout bench of timber, waist high, the mason's block on it
      this.beam(new THREE.Vector3(x - 0.6, y + 0.82, z), new THREE.Vector3(x + 0.6, y + 0.82, z), 0.6, 0.12, this.timbers);
      for (const [dx, dz] of [
        [-0.5, -0.22],
        [0.5, -0.22],
        [-0.5, 0.22],
        [0.5, 0.22],
      ])
        this.beam(new THREE.Vector3(x + dx, y, z + dz), new THREE.Vector3(x + dx, y + 0.78, z + dz), 0.1, 0.1, this.timbers);
      stones.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.88 + 0.17, z), _q.identity(), _s.set(0.7, 0.34, 0.45)));
      // chippings round it
      for (let i = 0; i < 40; i++) {
        const a = R() * 6.28;
        const r = 0.3 + R() * 1.1;
        _q.setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
        const cx = x + Math.cos(a) * r;
        const cz = z + Math.sin(a) * r;
        const s = 0.03 + R() * 0.06;
        stones.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, this.ground(cx, cz) + 0.015, cz), _q, _s.set(s, s * 0.5, s * 0.8)));
      }
      this.bankers.push(new THREE.Vector3(x, y + 1, z));
      block(x, z, 0.8);
    }
    this.group.add(instanced(box, this.mats.stone, stones));
    // timber in stacks: planks on bearers, and a pile of poles
    for (const [x, z, rot] of [
      [-13, -3.5, 0.1],
      [-13.5, 0.5, -0.05],
      [21, 0.5, 1.5],
    ]) {
      const y = this.ground(x, z);
      const dir = new THREE.Vector3(Math.cos(rot), 0, Math.sin(rot));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const off of [-1.4, 0, 1.4]) {
        const c = new THREE.Vector3(x, y + 0.06, z).addScaledVector(dir, off);
        this.beam(c.clone().addScaledVector(side, -0.6), c.clone().addScaledVector(side, 0.6), 0.12, 0.12, this.timbers);
      }
      for (let layer = 0; layer < 7; layer++) {
        for (let k = 0; k < 4; k++) {
          const c = new THREE.Vector3(x, y + 0.15 + layer * 0.06, z).addScaledVector(side, -0.42 + k * 0.28);
          this.beam(c.clone().addScaledVector(dir, -2), c.clone().addScaledVector(dir, 2 + (R() - 0.5) * 0.3), 0.24, 0.05, this.timbers);
        }
      }
      block(x, z, 2);
    }
    for (let i = 0; i < 14; i++) {
      const x = -12 + (R() - 0.5) * 1.2;
      const z = 4 + (R() - 0.5) * 1.2;
      const y = this.ground(x, z) + 0.07 + Math.floor(i / 5) * 0.12;
      const a = 0.05 + (R() - 0.5) * 0.08;
      this.pole(new THREE.Vector3(x - 3 * Math.cos(a), y, z - 3 * Math.sin(a) + i * 0.13 - 0.9), new THREE.Vector3(x + 3 * Math.cos(a), y, z + 3 * Math.sin(a) + i * 0.13 - 0.9), 0.06);
    }
    // a sand heap and the lime board beside it
    {
      const x = 17;
      const z = -1.8;
      const y = this.ground(x, z);
      const heap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.95, 18, 2), new THREE.MeshStandardMaterial({ color: 0xc8a46a, roughness: 1 }));
      heap.geometry.attributes.position.array.forEach((_, i, arr) => {
        if (i % 3 === 1 && arr[i] > -0.4) arr[i] *= 0.95;
      });
      heap.position.set(x, y + 0.45, z);
      heap.scale.set(1.15, 1, 0.9);
      heap.castShadow = heap.receiveShadow = true;
      this.group.add(heap);
      block(x, z, 1.6);
      const bx = x - 2.6;
      const by = this.ground(bx, z);
      for (const [a, b] of [
        [[-1, -0.6], [1, -0.6]],
        [[-1, 0.6], [1, 0.6]],
        [[-1, -0.6], [-1, 0.6]],
        [[1, -0.6], [1, 0.6]],
      ])
        this.beam(new THREE.Vector3(bx + a[0], by + 0.12, z + a[1]), new THREE.Vector3(bx + b[0], by + 0.12, z + b[1]), 0.05, 0.24, this.timbers);
      const lime = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.12, 1.15), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.95 }));
      lime.position.set(bx, by + 0.1, z);
      lime.receiveShadow = true;
      this.group.add(lime);
      this.soundAt.push(new THREE.Vector3(bx, by + 1, z));
    }
    // the workmen's hut: boarded, a pitched roof of boards, a door and a stovepipe
    {
      const x = 24.5;
      const z = 4.5;
      const y = this.ground(x, z);
      const hut = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.3, 2.6), new THREE.MeshStandardMaterial({ map: timberPicture(13, '#8a6a46'), roughness: 0.95 }));
      walls.position.y = 1.15;
      hut.add(walls);
      const roofMat = new THREE.MeshStandardMaterial({ map: timberPicture(17, '#5a4a38'), roughness: 0.95, side: THREE.DoubleSide });
      for (const s of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.65), roofMat);
        r.position.set(0, 2.3 + 0.38, s * 0.66);
        r.rotation.x = -(Math.PI / 2 - s * 0.52); // (30°, each side rising to the ridge)
        hut.add(r);
      }
      const gable = new THREE.Shape();
      gable.moveTo(-1.3, 0);
      gable.lineTo(1.3, 0);
      gable.lineTo(0, 0.75);
      gable.closePath();
      for (const s of [-1, 1]) {
        const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), walls.material);
        gm.position.set(s * 1.8, 2.3, 0);
        gm.rotation.y = s * Math.PI / 2;
        hut.add(gm);
      }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.85), new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 1 }));
      door.position.set(0.6, 0.95, 1.31);
      hut.add(door);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), this.mats.iron);
      pipe.position.set(-1.1, 2.9, -0.3);
      hut.add(pipe);
      hut.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      hut.position.set(x, y, z);
      hut.rotation.y = -0.25;
      this.group.add(hut);
      block(x, z, 2.2);
    }
    // carts: two-wheeled, shafts down on the ground, one loaded with brick
    for (const [x, z, rot, load] of [
      [8.5, 1.5, 0.4, true],
      [-6.5, 1, -0.9, false],
    ])
      this._cart(x, z, rot, load);
    // barrows
    for (const [x, z, rot] of [
      [13.5, -3, 0.8],
      [6.6, -7.3, -1.9],
      [-4.5, -6.6, 2.6],
    ])
      this._barrow(x, z, rot);
  }

  _cart(x, z, rot, load) {
    const g = new THREE.Group();
    const y = this.ground(x, z);
    const local = [];
    // the bed, its sides, the shafts
    this.beam(new THREE.Vector3(-1.1, 0.9, 0), new THREE.Vector3(1.1, 0.9, 0), 1.3, 0.08, local);
    for (const s of [-1, 1]) this.beam(new THREE.Vector3(-1.1, 1.08, s * 0.64), new THREE.Vector3(1.1, 1.08, s * 0.64), 0.04, 0.28, local);
    for (const s of [-1, 1]) this.beam(new THREE.Vector3(0.6, 0.86, s * 0.5), new THREE.Vector3(3.2, 0.12, s * 0.45), 0.08, 0.1, local);
    const im = instanced(new THREE.BoxGeometry(1, 1, 1), this.mats.sawn, local);
    g.add(im);
    // wheels: an iron-shod rim, spokes, a hub
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 6, 28), this.mats.sawn);
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.02, 4, 28), this.mats.iron);
      w.add(rim, tyre);
      for (let k = 0; k < 12; k++) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 5), this.mats.sawn);
        const a = (k / 12) * Math.PI * 2;
        sp.position.set(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0);
        sp.rotation.z = a - Math.PI / 2;
        w.add(sp);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 10), this.mats.sawn);
      hub.rotation.x = Math.PI / 2;
      w.add(hub);
      w.position.set(0, 0.7, s * 0.78);
      g.add(w);
    }
    if (load) {
      const bricks = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 1.1), this.mats.bricks);
      bricks.position.set(0, 1.17, 0);
      g.add(bricks);
    }
    g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    g.position.set(x, y, z);
    g.rotation.y = rot;
    this.group.add(g);
    this.landscape.obstacles?.push({ x, z, r: 1.3, when: () => this.on });
  }

  _barrow(x, z, rot) {
    const g = new THREE.Group();
    const local = [];
    // the tray: a bottom and four sides, splayed
    this.beam(new THREE.Vector3(-0.35, 0.42, 0), new THREE.Vector3(0.35, 0.42, 0), 0.5, 0.03, local);
    for (const s of [-1, 1]) this.beam(new THREE.Vector3(-0.42, 0.55, s * 0.3), new THREE.Vector3(0.42, 0.55, s * 0.3), 0.03, 0.25, local, s * 0.3);
    this.beam(new THREE.Vector3(0.45, 0.55, -0.3), new THREE.Vector3(0.45, 0.55, 0.3), 0.03, 0.25, local);
    // the handles, out behind, and the legs
    for (const s of [-1, 1]) {
      this.beam(new THREE.Vector3(0.6, 0.38, s * 0.22), new THREE.Vector3(-1.1, 0.5, s * 0.27), 0.04, 0.05, local);
      this.beam(new THREE.Vector3(-0.3, 0, s * 0.22), new THREE.Vector3(-0.3, 0.4, s * 0.22), 0.04, 0.04, local);
    }
    g.add(instanced(new THREE.BoxGeometry(1, 1, 1), this.mats.sawn, local));
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), this.mats.sawn);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(0.7, 0.22, 0);
    g.add(wheel);
    g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    g.position.set(x, this.ground(x, z), z);
    g.rotation.y = rot;
    this.group.add(g);
  }

  /** Shear legs over the east wing: two poles to a block, a stone hanging, a windlass on the ground. */
  _shearLegs() {
    const R = this.R;
    // (in front of the east wing's front wall, wherever that is found)
    const h = this.shell.hit(new THREE.Vector3(16, 1.4, HOUSE.z1 + 2), new THREE.Vector3(0, 0, -1), 30, 2);
    const wallZ = h ? h.point.z : -12;
    const apex = new THREE.Vector3(16, 8.6, wallZ - 0.4);
    for (const s of [-1, 1]) {
      const foot = new THREE.Vector3(16 + s * 2.2, 0, wallZ + 3.6);
      foot.y = this.ground(foot.x, foot.z) - 0.2;
      this.pole(foot, apex.clone().add(new THREE.Vector3(s * 0.12, 0.3, 0)), 0.11);
      this.landscape.obstacles?.push({ x: foot.x, z: foot.z, r: 0.3, when: () => this.on });
    }
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.14), this.mats.sawn);
    block.position.copy(apex).add(new THREE.Vector3(0, -0.25, 0));
    this.group.add(block);
    // the back-stay, to a stake out on the lawn
    const stake = new THREE.Vector3(16, 0, wallZ + 12);
    stake.y = this.ground(stake.x, stake.z) + 0.3;
    this.pole(apex, stake, 0.018, this.lashings);
    this.pole(stake.clone().setY(stake.y - 0.6), stake.clone().setY(stake.y + 0.2), 0.05);
    // the stone, slung in rope, a metre over the top course
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.5), this.mats.stone);
    stone.position.set(16, buildTop(16) + 1.3, wallZ - 0.4);
    stone.castShadow = stone.receiveShadow = true;
    this.group.add(stone);
    this.stone = stone;
    this.pole(block.position, stone.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.014, this.lashings);
    // and the fall to the windlass at the foot of the legs
    const wx = 16;
    const wz = wallZ + 4.4;
    const wy = this.ground(wx, wz);
    const frame = [];
    for (const s of [-1, 1]) {
      this.beam(new THREE.Vector3(wx + s * 0.6, wy, wz - 0.3), new THREE.Vector3(wx + s * 0.6, wy + 0.9, wz - 0.3), 0.1, 0.1, frame);
      this.beam(new THREE.Vector3(wx + s * 0.6, wy, wz + 0.3), new THREE.Vector3(wx + s * 0.6, wy + 0.9, wz + 0.3), 0.1, 0.1, frame);
      this.beam(new THREE.Vector3(wx + s * 0.6, wy + 0.1, wz - 0.4), new THREE.Vector3(wx + s * 0.6, wy + 0.1, wz + 0.4), 0.12, 0.12, frame);
    }
    this.timbers.push(...frame);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 12), this.mats.sawn);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(wx, wy + 0.85, wz);
    drum.castShadow = true;
    this.group.add(drum);
    for (const s of [-1, 1]) this.pole(new THREE.Vector3(wx + s * 0.72, wy + 0.85, wz), new THREE.Vector3(wx + s * 0.72, wy + 0.85 + 0.5 * (s > 0 ? 1 : -1), wz + 0.25), 0.025);
    this.pole(block.position, new THREE.Vector3(wx, wy + 1.05, wz), 0.014, this.lashings);
    this.landscape.obstacles?.push({ x: wx, z: wz, r: 0.8, when: () => this.on });
    this.soundAt.push(stone.position.clone());
    void R;
  }

  /**
   * The surveyor and the couple he is showing round: he walks ahead with the plans, stops to look
   * at them and to point out the work to them, and they follow a little behind, arm's length apart,
   * stopping when he stops and looking where he points.
   */
  _visitors() {
    if (this.visitorsLoading) return;
    this.visitorsLoading = true;
    const R = (stop) => stop;
    const route = new Route([
      { x: 21, z: 6.5, stop: R({ secs: 4, face: [12, -12], pose: 'plans' }) },
      { x: 13, z: 4.6 },
      { x: 12, z: 4.4, stop: R({ secs: 6, face: [15.5, -9], pose: 'point' }) },
      { x: 5, z: 4.2, stop: R({ secs: 5, face: [4, -12], pose: 'plans' }) },
      { x: -2, z: 4.4 },
      { x: -4.5, z: 4.6, stop: R({ secs: 6, face: [-8, -14], pose: 'point' }) },
      { x: -9.5, z: 5.5, stop: R({ secs: 4, face: [-11, -12], pose: 'plans' }) },
      { x: -4, z: 8 },
      { x: 6, z: 8.5, stop: R({ secs: 5, face: [2, -14], pose: 'point' }) },
      { x: 15, z: 8.2 },
    ]);
    const ground = (x, z) => this.ground(x, z);
    Promise.all(['surveyor', 'gentleman', 'lady'].map((k) => Person.make(k)))
      .then(([surveyor, gentleman, lady]) => {
        for (const p of [surveyor, gentleman, lady]) this.group.add(p.root, p.loose);
        const lead = new Walker(surveyor, route, { ground, speed: 0.95, start: 0 });
        this.visitors = [
          lead,
          new Walker(gentleman, route, { ground, speed: 0.95, lead, lag: 2.0, side: 0.4, start: 0 }),
          new Walker(lady, route, { ground, speed: 0.95, lead, lag: 2.0, side: -0.35, start: 0 }),
        ];
        // (start them a little way into the round, where you see them from the scene's view)
        for (const v of this.visitors) v.s = v === lead ? 1.5 : -0.5;
      })
      .catch((err) => console.warn('the visitors did not come:', err.message));
  }

  /** The visitors walk; the stone turns a little on its rope. (No hammering: nobody is working.) */
  update(dt) {
    if (!this.on) return;
    if (this.stone) this.stone.rotation.y = Math.sin(performance.now() / 2300) * 0.08;
    for (const v of this.visitors ?? []) v.update(Math.min(dt, 0.1));
    this.life?.update(dt);
  }
}
