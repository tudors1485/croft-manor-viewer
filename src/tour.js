// The guided tour and the flybys.
//
// The tour is a series of shots. Each shot is one smooth camera move inside one space
// (the grounds, the great hall, the ballroom...). Between shots it cuts, with a quick dip
// to black, rather than flying through walls. Every move can be checked against the
// collision tree (see `checkPath`), and the viewer does so once walking is ready.
//
// Flybys are long single moves in the style of the old Tomb Raider flyby cameras: the
// camera banks into its turns (a roll about the view axis, as a quaternion, on top of
// the look direction), and a slight fisheye bends the edges of the picture.

import * as THREE from 'three';

// A key is [camera position, look-at point, options]. Options: caption, speed (metres a
// second at this key; it changes smoothly to the next key's), roll (degrees, flybys).
const k = (pos, look, o = {}) => ({ pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), ...o });

export const TOUR = [
  {
    keys: [
      k([62, 30, 96], [5, 4, -20], { caption: 'Croft Manor', speed: 4 }),
      k([32, 17, 80], [5, 4, -14], { speed: 10 }),
      k([9, 8.5, 62], [5, 3, 12], { speed: 6 }),
      k([5, 4, 44], [4.6, 2.4, 18], { caption: 'The gate', speed: 3.2 }),
      k([4.6, 2.1, 28], [4.6, 2.0, 12], { speed: 2.4 }),
      k([4.6, 2.0, 20.5], [4.6, 2.1, 8.4], { speed: 1.8 }),
      k([4.6, 2.3, 15], [4.6, 2.0, 8.4], { caption: 'The fountain', speed: 1.5 }),
      k([0.9, 2.2, 10.4], [4.6, 2.0, 7.4], { speed: 1.8 }),
      k([-1.4, 2.0, 4.2], [-1.85, 2.2, -8], { speed: 2 }),
      k([-1.85, 1.85, 0.5], [-1.85, 1.9, -12], { caption: 'The front door', speed: 1.6 }),
      k([-1.85, 1.75, -9.6], [-1.85, 2.1, -20], { speed: 1.5 }),
      k([-1.85, 1.8, -14.5], [-1.6, 3.6, -24], { caption: 'The great hall', speed: 1.3 }),
      k([-1.7, 3.2, -18], [-1.5, 5.4, -24], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([-7.9, 5.0, -12.8], [-7.6, 4.7, -24], { caption: 'The gallery', speed: 0.6 }),
      k([-7.9, 5.0, -16.5], [0, 2.6, -19], { speed: 1.2 }),
      k([-7.4, 5.0, -21.2], [3, 3, -16], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([10.6, 1.75, -27.6], [-6, 1.9, -27.6], { caption: 'The ballroom', speed: 0.6 }),
      k([4, 1.75, -26.4], [-6, 2.4, -29], { speed: 1.4 }),
      k([-5.5, 1.75, -26.2], [-7, 2.6, -32], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([-9.7, 1.65, -20.4], [-13.5, 1.0, -25.5], { caption: 'The kitchen', speed: 0.5 }),
      k([-10.6, 1.65, -22.5], [-13.6, 1.1, -19.6], { speed: 0.9 }),
      k([-12.2, 1.65, -24.6], [-12.4, 1.2, -19], { speed: 0.4 }),
    ],
  },
  {
    keys: [
      k([19.6, 6.6, -22.9], [26, 4.8, -26.4], { caption: 'The pool', speed: 0.6 }),
      k([24, 6.8, -22.9], [27, 4.6, -27.5], { speed: 1.2 }),
      k([28.6, 6.6, -24.5], [21, 4.8, -27], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([-13.2, 7.3, -19.9], [-11, 6.3, -24], { caption: 'The bedroom', speed: 0.5 }),
      k([-12.2, 7.3, -19.8], [-12.8, 6.4, -24.5], { speed: 0.4 }),
    ],
  },
  {
    keys: [
      k([6.4, 9.3, -27], [-8, 8.9, -27], { caption: 'The attic', speed: 0.5 }),
      k([0, 9.3, -27.2], [-8, 8.8, -26.6], { speed: 1.2 }),
      k([-4, 9.3, -27], [-9, 8.6, -25.6], { speed: 0.4 }),
    ],
  },
  {
    keys: [
      k([36, 13, -36], [10, 3, -70], { caption: 'The assault course', speed: 2 }),
      k([24, 15, -45], [-4, 3, -80], { speed: 6 }),
      k([2, 21, -42], [-4, 2, -78], { speed: 8 }),
      k([-26, 24, -38], [5, 4, -22], { speed: 9 }),
      k([-62, 31, 30], [5, 4, -22], { caption: 'Croft Manor', speed: 2 }),
    ],
  },
];

/** A circuit round the house, rising and falling, for the time-lapse flybys (a = 0 is in front). */
function circuit(start, radius, height, turns = 1, speed = 6) {
  const keys = [];
  const n = Math.round(14 * turns);
  const c = [5, 0, -22];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2 * turns;
    const r = radius * (1 + 0.12 * Math.sin(a * 2 + 0.7));
    const y = height + 6 * Math.sin(a * 1.5);
    keys.push(k([c[0] + Math.sin(a) * r, y, c[2] + Math.cos(a) * r], [c[0], 6, c[2] + 1], { speed }));
  }
  return keys;
}

// The cuts of the seasons-and-weathers flyby, also laid over any other flyby when the panel's
// "With seasons and weathers" is ticked: every few seconds another season, time and weather.
export const SCENES = {
  what: 'scenes',
  every: 3,
  scenes: [
    { day: 95, hours: 12, weather: 'overcast' }, // early spring, grey
    { day: 112, hours: 13, weather: 'rain' }, // an April shower
    { day: 128, hours: 13, weather: 'clouds' }, // spring, fluffy clouds
    { day: 165, hours: 14, weather: 'clear' }, // early summer
    { day: 196, hours: 19.5, weather: 'clear' }, // a summer evening
    { day: 232, hours: 15, weather: 'clouds' }, // late summer
    { day: 290, hours: 13, weather: 'clear' }, // autumn gold
    { day: 300, hours: 14, weather: 'rain' }, // autumn rain
    { day: 318, hours: 9, weather: 'fog' }, // a November morning
    { day: 340, hours: 15.5, weather: 'overcast' }, // December dusk
    { day: 8, hours: 12, weather: 'snow', first: true }, // heavy snow falling (always the first cut)
    { day: 16, hours: 13, weather: 'clear' }, // snow lying, blue sky
    { day: 26, hours: 10, weather: 'fog' }, // freezing fog
  ],
};

export const FLYBYS = {
  estate: {
    label: 'Over the estate',
    keys: [
      k([4.6, 2.6, 36], [4.6, 2.2, 12], { speed: 5 }),
      k([4.6, 2.2, 28], [4.6, 2.0, 12], { speed: 8 }),
      k([4.6, 2.0, 21], [4.6, 2.2, 8.4], { speed: 8 }),
      k([4.6, 3.0, 13.5], [8, 2.2, 6], { speed: 8 }),
      k([12.5, 4.4, 6], [4.6, 2, 8.4], { speed: 8 }),
      k([6, 4, -0.5], [4.6, 2, 8.4], { speed: 8 }),
      k([-10, 5, 3.5], [0, 5, -11], { speed: 9 }),
      k([-19, 9, -6], [-10, 9, -20], { speed: 10 }),
      k([-22, 17, -30], [0, 8, -24], { speed: 11 }),
      k([-2, 21, -42], [6, 9, -22], { speed: 11 }),
      k([24, 19, -40], [22, 5, -25], { speed: 10 }),
      k([40, 14, -20], [22, 5, -24], { speed: 9 }),
      k([23, 13, -3], [5, 5, -16], { speed: 9 }),
      k([10, 18, 42], [4, 4, -14], { speed: 6 }),
      k([4.5, 26, 72], [4, 3, -10], { speed: 2.5 }),
    ],
  },
  gate: {
    label: 'Through the gate',
    // the classic: from just outside the gate, through the gateway and up past the fountain,
    // in through the window over the front door (a lancet 40 cm wide), over the landing and
    // round the great hall
    keys: [
      k([4.6, 1.8, 31], [4.6, 2.3, 8.4], { speed: 2.6 }),
      k([4.6, 2.1, 25], [4.6, 2.6, 6], { speed: 4.5 }),
      k([4.6, 2.3, 20.7], [3.4, 3.6, 2], { speed: 4.5 }),
      k([4.2, 3.4, 15], [0, 5.2, -6], { speed: 4.5 }),
      k([2.2, 4.9, 6.5], [-1.45, 5.4, -12], { speed: 4.2 }),
      k([-0.4, 5.35, 0.5], [-1.45, 5.45, -14], { speed: 3.6 }),
      k([-1.45, 5.4, -5], [-1.45, 5.5, -16], { speed: 2.6 }),
      k([-1.45, 5.45, -9.42], [-1.2, 5.3, -18], { speed: 2.2 }),
      k([-1.45, 5.65, -12.4], [0.5, 4.2, -20], { speed: 2.6 }),
      k([0.6, 4.7, -16], [-3, 4.2, -22], { speed: 3 }),
      k([2.2, 4.4, -19.5], [-4, 4, -18], { speed: 3 }),
      k([-1.5, 5.4, -22], [-4, 3, -14], { speed: 3 }),
      k([-5.4, 4.6, -18.5], [0, 3, -13], { speed: 3 }),
      k([-3.6, 3.2, -14.6], [0.7, 1.8, -22], { speed: 2.2 }),
      k([-0.8, 2.3, -17], [0.7, 1.8, -26], { speed: 0.8 }),
    ],
  },
  lift: {
    label: 'Rising over the gate',
    // from the drive a little way outside, the house framed by the gateway, straight up into the air
    keys: [
      k([4.6, 1.5, 33], [4.6, 3.2, 0], { speed: 0.7 }),
      k([4.6, 4, 33.1], [4.6, 3.4, 0], { speed: 2.4 }),
      k([4.6, 12, 33.5], [4.5, 3, -5], { speed: 3.4 }),
      k([4.6, 24, 34.2], [4.3, 2, -11], { speed: 3 }),
      k([4.6, 36, 35], [4.1, 1, -16], { speed: 0.8 }),
    ],
  },
  circle: {
    label: 'Circling the manor',
    // from the front of the house, spinning round it twice, high up (with "With seasons and
    // weathers" ticked, the seasons cut by as it goes)
    keys: circuit(0, 66, 28, 2, 17),
  },
  halloween: {
    label: 'Halloween night',
    // 31 October, near midnight, in the fog: through the gate past the ghosts on the lawn, down to
    // the pumpkins at the door, then along the front at the height of the windows, where figures
    // stand for a moment, and away over the garden (the seasons tick box doesn't apply)
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: 303, hours: 23.3, weather: 'fog' }] },
    keys: [
      k([4.6, 1.8, 30], [4.6, 2.2, 10], { speed: 2.4 }),
      k([4.6, 2.0, 20.7], [0, 1.8, 8], { speed: 3 }),
      k([0.6, 1.8, 14], [-8, 1.4, 9], { speed: 3 }),
      k([-5, 1.9, 9.5], [-1.85, 1, -6], { speed: 2.6 }),
      k([-1.85, 1.6, 0.5], [-1.85, 0.6, -7], { speed: 1.6 }),
      k([-1.85, 1.9, -3.4], [-1.85, 0.9, -9], { speed: 0.9 }),
      k([-4.5, 4.2, -0.5], [-8, 4.6, -9.4], { speed: 2.2 }),
      k([-10, 4.6, -2.5], [-12, 4.6, -9.4], { speed: 2.2 }),
      k([2, 5.2, -1.5], [6, 4.6, -9.4], { speed: 2.4 }),
      k([12, 4.8, -1.5], [16, 4.6, -9.4], { speed: 2.4 }),
      k([22, 4.8, -1], [26, 4.2, -9.4], { speed: 2.2 }),
      k([24, 7, 10], [12, 1.5, 8], { speed: 2.6 }),
      k([12, 12, 26], [2, 3, 0], { speed: 1.2 }),
    ],
  },
  hall: {
    label: 'The great hall',
    keys: [
      // (straight in: from the porch, the front door swinging open ahead of you)
      k([-1.85, 1.8, -3.5], [-1.85, 2.0, -14], { speed: 4 }),
      k([-1.85, 1.8, -10], [-1.85, 2.4, -20], { speed: 4.5 }),
      k([-1.6, 2.3, -13.8], [-3, 4.4, -22], { speed: 3.5 }),
      k([0.9, 3.4, -16.5], [-4, 4.4, -22], { speed: 3.2 }),
      k([2.2, 4.4, -19.5], [-4, 4, -18], { speed: 3 }),
      k([-1.5, 5.4, -22], [-4, 3, -14], { speed: 3 }),
      k([-5.4, 4.6, -18.5], [0, 3, -13], { speed: 3 }),
      k([-3.6, 3.0, -14], [0.7, 1.6, -24], { speed: 3 }),
      k([0.7, 1.8, -19], [0.7, 1.8, -27], { speed: 2.5 }),
      k([0.8, 1.7, -24.8], [6, 1.8, -27], { speed: 2.4 }),
      k([4.5, 1.7, -26.2], [11, 1.9, -26.5], { speed: 3 }),
      k([10.5, 1.8, -26.4], [-6, 2.2, -28], { speed: 1 }),
    ],
  },
  round: {
    label: 'Round the manor',
    keys: [
      k([-24, 17, 14], [6, 6, -20], { speed: 5 }),
      k([-35, 18, -12], [6, 6, -21], { speed: 11 }),
      k([-31, 19, -44], [6, 6, -21], { speed: 11 }),
      k([-6, 20, -60], [6, 6, -21], { speed: 11 }),
      k([24, 20, -58], [8, 6, -21], { speed: 11 }),
      k([44, 19, -38], [8, 6, -21], { speed: 11 }),
      k([47, 20, -10], [8, 5, -20], { speed: 11 }),
      k([32, 19.5, 14], [6, 5, -18], { speed: 10 }),
      k([8, 14, 24], [2, 6, -14], { speed: 6 }),
      k([-1.85, 17, 8], [-1.85, 9, -16], { speed: 2 }),
    ],
  },
  grounds: {
    label: 'The grounds',
    keys: [
      k([-38, 2.8, 36], [-10, 2.2, 26], { speed: 4 }),
      k([-14, 2.4, 27], [10, 2.2, 25], { speed: 9 }),
      k([8, 2.4, 25.5], [24, 2.6, 22], { speed: 9 }),
      k([21, 2.8, 25], [32, 3, 10], { speed: 9 }),
      k([30, 4.2, 18], [30, 2.6, -4], { speed: 9 }),
      k([27, 3, 2], [40, 3, -22], { speed: 9 }),
      k([40, 3.2, -18], [42, 3, -46], { speed: 9 }),
      k([42, 3.4, -46], [30, 4, -62], { speed: 9 }),
      k([30, 7, -60], [0, 3, -75], { speed: 9 }),
      k([2, 7.5, -92], [-20, 3, -70], { speed: 9 }),
      k([-30, 6, -66], [-34, 3, -40], { speed: 9 }),
      k([-36, 4, -46], [-36, 3, -20], { speed: 9 }),
      k([-37, 3.2, -24], [-30, 3, 0], { speed: 9 }),
      k([-37, 3.2, -6], [-10, 3, 6], { speed: 9 }),
      k([-16, 3.2, 2], [4.6, 2, 8.4], { speed: 8 }),
      k([-3, 4.5, 9], [-1.85, 5, -11], { speed: 6 }),
      k([-1.85, 13, 3], [-1.85, 9, -16], { speed: 2 }),
    ],
  },
  assault: {
    label: 'The assault course',
    keys: [
      k([30, 16, -38], [10, 2, -62], { speed: 4 }),
      k([22, 6, -56], [5, 2, -68], { speed: 10 }),
      k([11, 3.4, -68], [-4, 2, -76], { speed: 10 }),
      k([2, 3.6, -68], [-8, 2, -80], { speed: 10 }),
      k([-6, 4, -72], [-10, 2, -86], { speed: 10 }),
      k([-14, 6, -86], [0, 2, -90], { speed: 10 }),
      k([2, 7, -94], [14, 3, -78], { speed: 10 }),
      k([16, 9, -80], [10, 2, -60], { speed: 9 }),
      k([24, 18, -54], [4, 4, -24], { speed: 4 }),
    ],
  },
};

const FADE = 0.4; // seconds to black and back at a cut
const FLYBY_FOV = 68; // the flyby lens (the fisheye magnifies the middle a little)

/** One continuous camera move along keys, with a smoothly changing speed. */
class Move {
  constructor(keys) {
    this.keys = keys;
    this.pos = new THREE.CatmullRomCurve3(keys.map((key) => key.pos), false, 'centripetal');
    this.look = new THREE.CatmullRomCurve3(keys.map((key) => key.look), false, 'centripetal');
    const n = keys.length - 1;
    const per = 120;
    const lengths = this.pos.getLengths(n * per);
    this.length = lengths[lengths.length - 1];
    // per stretch: its length, speeds at both ends, and how long it takes
    this.parts = [];
    let t0 = 0;
    for (let i = 0; i < n; i++) {
      const L = Math.max(1e-3, lengths[(i + 1) * per] - lengths[i * per]);
      const v0 = keys[i].speed ?? 2;
      const v1 = keys[i + 1].speed ?? v0;
      const time = Math.abs(v1 - v0) < 1e-3 ? L / v0 : (L / (v1 - v0)) * Math.log(v1 / v0);
      this.parts.push({ s0: lengths[i * per], L, v0, v1, t0, time });
      t0 += time;
    }
    this.duration = t0;
  }

  /** Curve parameter (0..1) at `time` seconds into the move, and the key passed most recently. */
  at(time) {
    const parts = this.parts;
    let i = 0;
    while (i < parts.length - 1 && time > parts[i].t0 + parts[i].time) i++;
    const p = parts[i];
    const t = THREE.MathUtils.clamp(time - p.t0, 0, p.time);
    // speed changes linearly with distance: s(t) solves ds/dt = v0 + (v1 - v0) s / L
    const a = (p.v1 - p.v0) / p.L;
    const s = Math.abs(a) < 1e-6 ? p.v0 * t : (p.v0 * (Math.exp(a * t) - 1)) / a;
    const u = (p.s0 + Math.min(s, p.L)) / this.length;
    const local = Math.min(1, s / p.L);
    // the key you are coming up to counts from halfway along (for captions)
    return { u: this.pos.getUtoTmapping(u), key: local > 0.55 ? i + 1 : i };
  }
}

/**
 * Checks camera moves against the collision tree: a ball of `radius` swept along each
 * move must not pass through anything, nor through a tree's crown. Returns the places
 * where it would, so a bad key can be found and fixed.
 */
export async function checkPath(moves, bvh, skip, { radius = 0.2, step = 0.15, crowns = [], allow = [] } = {}) {
  const { moveSphere } = await import('./walk.js');
  const problems = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const moved = new THREE.Vector3();
  moves.forEach((move, mi) => {
    const n = Math.ceil(move.length / step);
    move.pos.getPoint(0, a);
    for (let i = 1; i <= n; i++) {
      move.pos.getPointAt(i / n, b);
      moved.copy(b);
      moveSphere(bvh, a, moved, radius, skip);
      const at = () => b.toArray().map((x) => Math.round(x * 100) / 100);
      // (allow: places a path squeezes through on purpose, like the 40 cm window over the front door)
      if (moved.distanceTo(b) > 0.05 && !allow.some((box) => box.containsPoint(b))) problems.push({ move: mi, at: at(), by: Math.round(moved.distanceTo(b) * 100) / 100 });
      for (const c of crowns) {
        if (b.y < c.y0 || b.y > c.y1 + radius) continue;
        const d = Math.hypot(b.x - c.x, b.z - c.z);
        if (d < c.r * 0.8 + radius) problems.push({ move: mi, at: at(), tree: [Math.round(c.x), Math.round(c.z)] });
      }
      a.copy(b);
    }
  });
  return problems;
}

export class Tour {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {(text: string) => void} onCaption
   * @param {(alpha: number) => void} onFade 0 clear .. 1 black
   */
  constructor(camera, onCaption, onFade) {
    this.camera = camera;
    this.onCaption = onCaption;
    this.onFade = onFade;
    this.running = false;
    this.flyby = false;
    this.rate = 1; // playback speed (0 holds the frame)
    this.fisheye = 0; // 0..1, read by the renderer
    this._look = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._qRoll = new THREE.Quaternion();
    this._axis = new THREE.Vector3(0, 0, 1);
    this.tourMoves = TOUR.map((shot) => new Move(shot.keys));
    this.flybyMoves = Object.fromEntries(Object.entries(FLYBYS).map(([id, f]) => [id, new Move(f.keys)]));
  }

  get total() {
    return this.moves ? this.moves.reduce((s, m) => s + m.duration, 0) : 0;
  }

  /** Starts the tour, or the flyby with this id. */
  start(flybyId = null) {
    this.flyby = !!flybyId;
    this.flybyId = flybyId;
    this.moves = flybyId ? [this.flybyMoves[flybyId]] : this.tourMoves;
    this.shot = 0;
    this.t = 0;
    this.running = true;
    this._caption = null;
    this._roll = 0;
    this._heading = null;
    this._fovBase = this.camera.fov;
    this.onFade?.(0);
    this.onCaption?.('');
    // a flyby starts with its lens on: the fisheye and the wider view from the first frame
    this.fisheye = this.flyby ? 1 : 0;
    if (this.flyby) {
      this.camera.fov = FLYBY_FOV;
      this.camera.updateProjectionMatrix();
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.fisheye = 0;
    this.onCaption?.('');
    this.onFade?.(0);
    if (this._fovBase) {
      this.camera.fov = this._fovBase;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * The running flyby's time-lapse ({ what, from, to } or the scenes) and how far through it is
   * (0..1), or null. `lapseOver` lays one over a flyby that has none (or replaces its own).
   */
  get lapse() {
    if (!this.running || !this.flyby) return null;
    const l = this.lapseOver ?? FLYBYS[this.flybyId]?.lapse;
    if (!l) return null;
    const move = this.moves[0];
    return { ...l, progress: THREE.MathUtils.clamp(this.t / move.duration, 0, 1), seconds: this.t };
  }

  /** Returns false when it has ended. */
  update(dt) {
    if (!this.running) return false;
    this.t += dt * this.rate;
    let move = this.moves[this.shot];
    // (rewinding: back into the shot before, or held at the very start)
    while (this.t < 0) {
      if (this.shot === 0) {
        this.t = 0;
        break;
      }
      this.shot--;
      move = this.moves[this.shot];
      this.t += move.duration;
      this._heading = null;
    }
    if (this.t > move.duration) {
      if (this.shot === this.moves.length - 1) {
        this.stop();
        return false;
      }
      this.t -= move.duration;
      this.shot++;
      move = this.moves[this.shot];
      this._heading = null;
    }
    const { u, key } = move.at(this.t);
    this.camera.position.copy(move.pos.getPoint(u));
    this._look.copy(move.look.getPoint(u));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._look);

    // a dip to black at each cut between shots
    const last = this.shot === this.moves.length - 1;
    const first = this.shot === 0;
    let black = 0;
    if (!last) black = Math.max(black, 1 - (move.duration - this.t) / FADE);
    if (!first) black = Math.max(black, 1 - this.t / FADE);
    this.onFade?.(THREE.MathUtils.clamp(black, 0, 1));

    if (this.flyby) this._bank(dt, move, u);

    // captions: the most recent key that has one, within this shot
    let caption = '';
    for (let i = Math.min(key, move.keys.length - 1); i >= 0; i--) {
      if (move.keys[i].caption) {
        caption = move.keys[i].caption;
        break;
      }
    }
    if (this.flyby) caption = '';
    if (caption !== this._caption) {
      this._caption = caption;
      this.onCaption?.(caption);
    }
    return true;
  }

  /** Flyby camera: lean into turns like a banking aircraft, and bend the edges a little. */
  _bank(dt, move, u) {
    this.camera.getWorldDirection(this._fwd);
    const heading = Math.atan2(this._fwd.x, this._fwd.z);
    let turn = 0;
    if (this._heading !== null && dt > 0) {
      let dh = heading - this._heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      turn = dh / dt; // radians a second, positive turning left
    }
    this._heading = heading;
    // bank into the turn: turning left rolls the horizon clockwise (left wing down)
    const want = THREE.MathUtils.clamp(turn * 0.42, -0.42, 0.42);
    this._roll += (want - this._roll) * (1 - Math.exp(-dt * 2.2));
    // the roll is a rotation about the camera's own view axis, composed onto its orientation
    this._qRoll.setFromAxisAngle(this._axis, this._roll);
    this.camera.quaternion.multiply(this._qRoll);
    this.fisheye = 1;
  }

  /** Where the camera is looking right now (for handing over to orbit). */
  get target() {
    return this._look;
  }
}
