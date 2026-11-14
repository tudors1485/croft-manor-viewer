// Someone trespassing in the empty house, in Fifty, A hundred and Two hundred years empty: a young
// man in a hoodie with a backpack (people.js), come in at the gate to explore it. He walks up the
// drive, stops at the fountain to take a picture, goes up to the porch and looks at the front, goes
// in at the front door (forced, standing open) and round the hall (pictures of the stairs, a look up
// at each side), comes out again, goes round on the east lawn for a picture of the whole front, and
// back down the drive to the gate; and round again. In Fifty and A hundred years there is an old
// photograph lying on the hall floor (the family, in a silver frame, its glass cracked): he stops
// and picks it up, looks at it a while, and puts it back where it was. In the dark he has a torch,
// its beam going where he looks, and his photographs flash.

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
  // (the photograph on the floor: he stops, picks it up, looks at it, and puts it back)
  { x: -2.15, z: -16.35, stop: { secs: 9, face: [-2.35, -16.95], act: 'photo' }, photo: true },
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

/** The old photograph: the family on the steps of the house, sepia, foxed, in a silver frame. */
function photoPicture() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 148;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9690';
  g.fillRect(0, 0, 192, 148);
  g.fillStyle = '#d9c8a4';
  g.fillRect(10, 10, 172, 128);
  const grad = g.createLinearGradient(0, 10, 0, 138);
  grad.addColorStop(0, '#b89a6e');
  grad.addColorStop(1, '#6e5436');
  g.fillStyle = grad;
  g.fillRect(16, 16, 160, 116);
  // the porch behind them
  g.fillStyle = 'rgba(70, 50, 30, 0.55)';
  g.fillRect(56, 20, 80, 70);
  g.fillStyle = 'rgba(40, 28, 18, 0.6)';
  g.fillRect(84, 44, 24, 46);
  // the family: five figures, the lady's skirt wide, a child
  const fig = (x, h, w, skirt) => {
    g.fillStyle = 'rgba(38, 26, 16, 0.85)';
    g.beginPath();
    g.arc(x, 132 - h, w * 0.32, 0, 6.28);
    g.fill();
    if (skirt) {
      g.beginPath();
      g.moveTo(x - w * 0.25, 132 - h + w * 0.4);
      g.lineTo(x + w * 0.25, 132 - h + w * 0.4);
      g.lineTo(x + w * 0.75, 128);
      g.lineTo(x - w * 0.75, 128);
      g.fill();
    } else g.fillRect(x - w * 0.3, 132 - h + w * 0.35, w * 0.6, h - w * 0.4);
  };
  fig(52, 62, 16, false);
  fig(78, 56, 16, true);
  fig(98, 36, 12, true);
  fig(118, 60, 16, false);
  fig(140, 54, 15, true);
  // foxing and a crack across the glass
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(120, 80, 40, ${0.1 + Math.random() * 0.2})`;
    g.beginPath();
    g.arc(16 + Math.random() * 160, 16 + Math.random() * 116, 1 + Math.random() * 4, 0, 6.28);
    g.fill();
  }
  g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(20, 30);
  g.lineTo(80, 70);
  g.lineTo(110, 66);
  g.lineTo(176, 120);
  g.moveTo(80, 70);
  g.lineTo(70, 130);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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
  constructor(group, { shell, landscape, mode, door = false, start = 0, photo = false }) {
    this.group = group;
    this.photoOn = photo;
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
          const ground = groundFor(this.shell, this.landscape, this.mode);
          this.walker = new Walker(p, new Route(ROUTE.filter((q) => this.photoOn || !q.photo)), { ground, speed: 1.05, start: this.start });
          if (this.photoOn) {
            // the photograph on the floor (a small silver frame, face up)
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.16), new THREE.MeshStandardMaterial({ color: 0x8a8a88, metalness: 0.8, roughness: 0.45 }));
            const face = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.13), new THREE.MeshStandardMaterial({ map: photoPicture(), roughness: 0.25 }));
            face.rotation.x = -Math.PI / 2;
            face.position.y = 0.0065;
            frame.add(face);
            frame.castShadow = frame.receiveShadow = true;
            this.photo = frame;
            this.photoHome = new THREE.Vector3(-2.35, ground(-2.35, -16.95) + 0.006, -16.95);
            this.photoYaw = 0.5;
            frame.position.copy(this.photoHome);
            frame.rotation.y = this.photoYaw;
            this.group.add(frame);
            // (held, the picture faces him: its own little group, turned so its face looks along +z)
            this.photoHeld = new THREE.Group();
            this.photoHeld.visible = false;
            p.loose.add(this.photoHeld);
          }
          this.flash = new THREE.PointLight(0xf4f6ff, 0, 14, 1.6);
          p.loose.add(this.flash);
        })
        .catch((err) => console.warn('the trespasser did not come:', err.message));
    }
    // (the front door forced, and left standing open)
    const d = this.door ? this.frontDoor : null;
    if (d) d.ajar = on ? 0.92 : 0;
  }

  update(dt, { dark = 0 } = {}) {
    const w = this.walker;
    if (!w) return;
    const p = w.p;
    dt = Math.min(dt, 0.1);
    // the torch in the dark (and held out when nothing else is in his hands)
    const night = dark > 0.55;
    p.torchWanted = night ? 1 : 0;
    if (night && p.wanted === 'none' && !w.waiting?.act) p.setPose('torch');
    if (!night && p.wanted === 'torch') p.setPose('none');
    // the photograph: reach down for it, look at it, put it back
    const st = w.waiting;
    w.clip = null;
    p.lookDown = 0;
    if (st?.act === 'photo' && this.photo) {
      const e = st.secs - w.wait;
      const reaching = (e > 0.2 && e < 1.6) || (e > 6.6 && e < 8.0);
      if (reaching) w.clip = 'interact';
      const inHand = e > 1.0 && e < 7.4;
      if (inHand && !p.held) {
        p.held = this.photoHeld;
        this.photoHeld.add(this.photo);
        this.photo.position.set(0, 0, 0);
        // (its face, +y in its own frame, towards him: the held group looks along its -z...)
        this.photo.rotation.set(Math.PI / 2, Math.PI, 0);
        this.photoHeld.visible = true;
      }
      if (!inHand && p.held) this._putBack(p);
      p.setPose(e > 1.6 && e < 6.6 ? 'hold' : 'none');
      p.lookDown = 0.35;
    } else if (p.held) this._putBack(p);
    // a flash for each photograph in the dark
    if (st?.pose === 'photo' && night) {
      const e = st.secs - w.wait;
      this.flash.intensity = (e > 1.6 && e < 1.7) || (e > 3.0 && e < 3.08) ? 60 : 0;
      p.phone && this.flash.position.copy(p.phone.position);
    } else this.flash.intensity = 0;
    w.update(dt);
  }

  _putBack(p) {
    p.held = null;
    this.group.add(this.photo);
    this.photo.position.copy(this.photoHome);
    this.photo.rotation.set(0, this.photoYaw, 0);
    this.photoHeld.visible = false;
  }

  /** Put him `s` metres along his round (now, or as soon as he has come). */
  jump(s) {
    this.start = s;
    if (this.walker) {
      this.walker.s = s;
      this.walker.wait = 0;
      this.walker.waiting = null;
      const a = this.walker.route.at(s);
      this.walker.pos.set(a.x, this.walker.ground(a.x, a.z, 0), a.z);
    }
  }

  get person() {
    return this.walker?.p ?? null;
  }
}
