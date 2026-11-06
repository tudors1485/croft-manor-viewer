// The guided tour: a smooth camera flight through the estate along a Catmull-Rom path,
// looking at points of interest on the way, with captions.

import * as THREE from 'three';

// [camera position, look-at, caption]
const STOPS = [
  [[60, 28, 95], [5, 4, -20], 'Croft Manor'],
  [[6, 4.5, 58], [5, 3, 20], 'The gate'],
  [[5.2, 3.4, 30], [5, 2.6, 18], ''],
  [[11, 2.4, 15], [4.6, 2.2, 8.4], 'The fountain'],
  [[-2, 2.2, 6], [-1.5, 3, -12], 'The front door'],
  [[-1.5, 1.7, -12.6], [-1.5, 2.8, -22], 'The great hall'],
  [[-1.5, 3.2, -18.5], [-1.5, 4.6, -24], ''],
  [[-6.5, 5.3, -21.5], [3, 3, -15], 'The landing'],
  [[3, 4.6, -27.5], [8, 4.5, -27], ''],
  [[18.4, 6.7, -22.6], [25, 4.7, -26.5], 'The pool'],
  [[27.5, 7.4, -28], [21, 5, -23], ''],
  [[35, 12, -38], [10, 4, -70], 'The assault course'],
  [[20, 9, -58], [-5, 3, -80], ''],
  [[-25, 22, -40], [5, 4, -22], ''],
  [[-60, 30, 30], [5, 4, -22], 'Croft Manor'],
];

export class Tour {
  constructor(camera, onCaption) {
    this.camera = camera;
    this.onCaption = onCaption;
    this.pos = new THREE.CatmullRomCurve3(STOPS.map((s) => new THREE.Vector3(...s[0])), false, 'centripetal');
    this.look = new THREE.CatmullRomCurve3(STOPS.map((s) => new THREE.Vector3(...s[1])), false, 'centripetal');
    // spend time per stretch in proportion to its length, with a floor so close-ups linger
    const lens = [];
    for (let i = 0; i < STOPS.length - 1; i++) {
      lens.push(Math.max(8, new THREE.Vector3(...STOPS[i][0]).distanceTo(new THREE.Vector3(...STOPS[i + 1][0]))));
    }
    const speed = 5.5; // metres a second, roughly
    this.durations = lens.map((l) => 3.2 + l / speed);
    this.total = this.durations.reduce((a, b) => a + b, 0);
    // each stop's caption, carried forward over the stops that have none
    this.captions = [];
    let last = '';
    for (const st of STOPS) this.captions.push((last = st[2] || last));
    this.t = 0;
    this.running = false;
    this._lookNow = new THREE.Vector3();
    this._lastCaption = null;
  }

  start() {
    this.t = 0;
    this.running = true;
    this._lastCaption = null;
  }

  stop() {
    this.running = false;
    this.onCaption?.('');
  }

  /** Returns false when the tour has ended. */
  update(dt) {
    if (!this.running) return false;
    this.t += dt;
    if (this.t >= this.total) {
      this.stop();
      return false;
    }
    // which stretch, and how far along it (eased so it slows at each stop)
    let acc = 0;
    let i = 0;
    while (i < this.durations.length - 1 && acc + this.durations[i] < this.t) acc += this.durations[i++];
    const local = (this.t - acc) / this.durations[i];
    const eased = local * local * (3 - 2 * local);
    const u = (i + eased) / (STOPS.length - 1);
    this.camera.position.copy(this.pos.getPoint(u));
    this._lookNow.copy(this.look.getPoint(u));
    this.camera.lookAt(this._lookNow);

    const caption = this.captions[local < 0.6 ? i : i + 1];
    if (caption !== this._lastCaption) {
      this._lastCaption = caption;
      this.onCaption?.(caption);
    }
    return true;
  }

  /** Where the camera is looking right now (for handing over to orbit). */
  get target() {
    return this._lookNow;
  }
}
