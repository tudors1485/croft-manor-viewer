// Someone trespassing in the empty house, in Fifty, A hundred and Two hundred years empty: a young
// man in a hoodie with a backpack (people.js), come in at the gate to explore it. He walks up the
// drive, stops at the fountain to take a picture, goes up to the porch and looks at the front, goes
// in at the front door (forced, standing open) and round the hall (pictures of the stairs, a look up
// at each side), comes out again, goes round on the east lawn for a picture of the whole front, and
// back down the drive to the gate; and round again.

import * as THREE from 'three';
import { Person, Route, Walker } from './people.js';

const ROUTE = [
  { x: 4.6, z: 19.2, stop: { secs: 2.5, face: [4.6, 0] } },
  { x: 4.9, z: 13.5 },
  { x: 8.4, z: 12.6 },
  // (round the fountain's basin, never over its rim)
  { x: 9.0, z: 9.6, stop: { secs: 4.5, face: [4.59, 8.28], pose: 'photo' } },
  { x: 9.0, z: 6.0 },
  { x: 5.6, z: 2.5 },
  { x: -0.6, z: -4.5 },
  { x: -1.85, z: -7.8, stop: { secs: 3.5, face: [-1.85, -14] } },
  { x: -1.85, z: -11.85 },
  { x: -1.85, z: -15.2, stop: { secs: 4, face: [-1.85, -20], pose: 'photo' } },
  { x: -3.9, z: -17.3, stop: { secs: 3, face: [-6, -18.5] } },
  { x: 0.2, z: -17.3, stop: { secs: 3.5, face: [2.5, -19], pose: 'photo' } },
  { x: -1.0, z: -14.0 },
  { x: -1.85, z: -11.85 },
  { x: -1.85, z: -8.2 },
  { x: 3.2, z: -3.5 },
  { x: 11.5, z: 1.5, stop: { secs: 5, face: [5, -14], pose: 'photo' } },
  { x: 9.5, z: 9.5 },
  { x: 5.6, z: 14.5 },
];

/** The ground under someone walking: the house's floors (what is left of them in this mode), else the estate's. */
export function groundFor(shell, landscape, mode) {
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  return (x, z, y = 0) => {
    const terrain = landscape.groundHeight(x, z);
    from.set(x, (y || terrain || 0) + 1.2, z);
    const h = shell?.hit(from, down, 3, mode);
    if (h && h.normal.y > 0.6) return h.point.y;
    return terrain ?? 0.04;
  };
}

export class Trespasser {
  /**
   * @param {THREE.Group} group  the scene's group (he comes and goes with it)
   * @param {object} o
   * @param {import('./shell.js').HouseShell} o.shell
   * @param {object} o.landscape
   * @param {number} o.mode  the shell's mode for the scene (what floors are left to walk on)
   * @param {boolean} [o.door]  open the front door for him (the scenes where it still hangs)
   * @param {number} [o.start]  how far along his round he is when the scene begins (metres)
   */
  constructor(group, { shell, landscape, mode, door = false, start = 0 }) {
    this.group = group;
    this.shell = shell;
    this.landscape = landscape;
    this.mode = mode;
    this.door = door;
    this.start = start;
    this.walker = null;
    this.loading = false;
  }

  get frontDoor() {
    return this.shell?.doors?.usable?.find((d) => Math.abs(d.centre.x + 1.85) < 0.5 && Math.abs(d.centre.z + 11.85) < 0.6) ?? null;
  }

  set(on) {
    if (on && !this.walker && !this.loading) {
      this.loading = true;
      Person.make('explorer')
        .then((p) => {
          this.group.add(p.root, p.loose);
          this.walker = new Walker(p, new Route(ROUTE), { ground: groundFor(this.shell, this.landscape, this.mode), speed: 1.05, start: this.start });
        })
        .catch((err) => console.warn('the trespasser did not come:', err.message));
    }
    // (the front door forced, and left standing open)
    const d = this.door ? this.frontDoor : null;
    if (d) d.ajar = on ? 0.92 : 0;
  }

  update(dt) {
    this.walker?.update(Math.min(dt, 0.1));
  }

  get person() {
    return this.walker?.p ?? null;
  }
}
