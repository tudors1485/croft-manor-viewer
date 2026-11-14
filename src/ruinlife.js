// Animals at home in the ruin (Two hundred years empty, ruin.js), at dawn:
// - red deer grazing in the clearing in front of the east wing, heads coming up now and then; walk up
//   to them and they are off at a gallop into the wood, and back a while later;
// - a fox coming in at the old front door, nosing round what was the hall and going out again across
//   the forecourt, and round again after a while;
// - swallows going in and out through the empty windows, round inside the roofless shell and out
//   over the top, and back down over the grass to the windows again.
// - and, on a misty morning, the mist itself lying low over the grounds and in the shell, in soft
//   drifting layers, the walls and the trees standing up out of it.
// The animals are the park's and the estate's (public/animals/); the swallows are drawn like the
// other flocks (wildlife.js).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { animal, play, Flock } from './wildlife.js';
import { Route } from './people.js';
import { groundFor } from './trespass.js';
import { ruinTop } from './shell.js';

const _v = new THREE.Vector3();

function turnTo(from, to, rate, dt) {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
}

// where the deer graze: the clearing on the old east lawn, in front of the east wing
const GRAZE = [
  [16.5, 2.5],
  [19.2, 4.8],
  [18.2, -0.4],
  [21.5, 1.6],
  [14.6, 5.4],
];
const FOX = [
  { x: -14, z: -2 },
  { x: -6, z: -5.5 },
  { x: -1.85, z: -8.6 },
  { x: -1.85, z: -12.6 },
  { x: -1.5, z: -15.4, stop: { secs: 5 } },
  { x: -0.3, z: -17.6, stop: { secs: 3.5 } },
  { x: -2.8, z: -17.0, stop: { secs: 2.5 } },
  { x: -1.85, z: -12.6 },
  { x: -1.85, z: -8.6 },
  { x: 3, z: -6.8 },
  { x: 12, z: -4.5 },
  { x: 18, z: 4 },
  { x: 24, z: 12 },
  { x: 30, z: 22, stop: { secs: 40 }, away: true },
];

export class RuinLife {
  /**
   * @param {import('./ruin.js').Ruin} ruin
   * @param {{centre: THREE.Vector3, out: THREE.Vector3, box: THREE.Box3}[]} openings  the windows, as holes in the walls
   */
  constructor(ruin, openings) {
    this.ruin = ruin;
    this.group = new THREE.Group();
    this.group.name = 'The animals in the ruin';
    ruin.group.add(this.group);
    this.ground = groundFor(ruin.shell, ruin.landscape, 1);
    // the windows the swallows use: in the front, in what still stands of the wall
    this.openings = openings.filter((w) => w.out.z > 0.7 && w.box.max.y + 0.3 < ruinTop(w.centre.x, w.centre.z));
    this.loading = false;
    this.ready = false;
    this.t = 0;
  }

  /** Ground mist: thin layers of soft noise, one over the other, lying in the first two metres. */
  _mist() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(0, 0, 256, 256);
    // soft blobs, wrapped round the edges so it tiles
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 20 + Math.random() * 55;
      for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, `rgba(255,255,255,${0.08 + Math.random() * 0.1})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.mist = [];
    const centre = new THREE.Vector3(6, 0, -10);
    for (let i = 0; i < 12; i++) {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(5, 4);
      t.offset.set(Math.random(), Math.random());
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(150, 120).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: t, color: 0xdfe3e6, transparent: true, opacity: 0, depthWrite: false, fog: false, alphaMap: null }),
      );
      // (thin near you, thicker into the distance, as mist is: the alpha faded by the distance)
      m.material.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vMistDist;').replace('#include <project_vertex>', '#include <project_vertex>\nvMistDist = length(mvPosition.xyz);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vMistDist;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(2.0, 28.0, vMistDist);');
      };
      m.position.set(centre.x, 0.15 + i * 0.19, centre.z);
      m.renderOrder = 2;
      m.userData.drift = new THREE.Vector2((Math.random() - 0.5) * 0.004, 0.002 + Math.random() * 0.003);
      this.group.add(m);
      this.mist.push(m);
    }
  }

  _updateMist(dt, fog, light) {
    if (!this.mist) return;
    const want = THREE.MathUtils.smoothstep(fog, 0.2, 0.6);
    this.mist.forEach((m, i) => {
      m.visible = want > 0.01;
      // (thicker low down)
      m.material.opacity = want * (0.2 - i * 0.014);
      m.material.color.setScalar(0.35 + 0.65 * light).multiply(new THREE.Color(0.95, 0.97, 1));
      m.material.map.offset.x += m.userData.drift.x * dt;
      m.material.map.offset.y += m.userData.drift.y * dt;
    });
  }

  load() {
    if (this.loading) return;
    this._mist();
    this.loading = true;
    const loader = new GLTFLoader();
    Promise.all(['red-hind', 'red-stag', 'fox'].map((n) => loader.loadAsync(`animals/${n}.glb`).catch(() => null))).then(([hind, stag, fox]) => {
      if (hind && stag) this._deer(hind, stag);
      if (fox) this._fox(fox);
      this._swallows();
      this.ready = true;
    });
  }

  // --- deer ---------------------------------------------------------------------------------------

  _deer(hind, stag) {
    this.deer = GRAZE.map(([x, z], i) => {
      const g = i === 2 ? stag : hind;
      const a = animal(g, i === 2 ? 2.05 : 1.55, { tint: new THREE.Color(0.82, 0.74, 0.68) });
      a.holder.position.set(x, this.ground(x, z), z);
      a.holder.rotation.y = i * 1.7;
      this.group.add(a.holder);
      play(a, 'Eating', 0);
      a.mixer?.update(Math.random() * 3);
      return { a, home: new THREE.Vector3(x, 0, z), yaw: i * 1.7, state: 'graze', t: Math.random() * 8, gone: 0 };
    });
  }

  _updateDeer(dt, cam, walking) {
    const herd = this.deer;
    if (!herd) return;
    // (someone on foot coming within 13 m of any of them: the whole herd goes)
    const onFoot = walking && cam && cam.y - this.ground(cam.x, cam.z) < 3.5;
    const scared = onFoot && herd.some((d) => d.state !== 'gone' && Math.hypot(cam.x - d.a.holder.position.x, cam.z - d.a.holder.position.z) < 13);
    for (const d of herd) {
      const h = d.a.holder;
      d.t -= dt;
      if (scared && (d.state === 'graze' || d.state === 'look')) {
        d.state = 'flee';
        d.yaw = Math.atan2(h.position.x - cam.x, h.position.z - cam.z) + (Math.random() - 0.5) * 0.6;
        d.t = 5;
      }
      if (d.state === 'graze') {
        play(d.a, 'Eating', 0.5);
        if (d.t <= 0) Object.assign(d, { state: 'look', t: 2 + Math.random() * 3 });
      } else if (d.state === 'look') {
        play(d.a, 'Idle', 0.5);
        if (d.t <= 0) Object.assign(d, { state: Math.random() < 0.4 ? 'step' : 'graze', t: 4 + Math.random() * 8, yaw: d.yaw + (Math.random() - 0.5) * 1.5 });
      } else if (d.state === 'step') {
        // a few steps to fresh grass, never far from its place
        play(d.a, 'Walk', 0.5, 0.8);
        const back = _v.copy(d.home).sub(h.position).setY(0);
        if (back.length() > 2.5) d.yaw = Math.atan2(back.x, back.z);
        h.position.x += Math.sin(d.yaw) * 0.45 * dt;
        h.position.z += Math.cos(d.yaw) * 0.45 * dt;
        if (d.t <= 0 || d.t < 2.5) Object.assign(d, { state: 'graze', t: 6 + Math.random() * 10 });
      } else if (d.state === 'flee') {
        play(d.a, 'Gallop', 0.2, 1.1);
        h.position.x += Math.sin(d.yaw) * 8 * dt;
        h.position.z += Math.cos(d.yaw) * 8 * dt;
        if (d.t <= 0) Object.assign(d, { state: 'gone', gone: 45 + Math.random() * 30 });
      } else if (d.state === 'gone') {
        h.visible = false;
        d.gone -= dt;
        // (back when nobody is near their place)
        if (d.gone <= 0 && (!cam || Math.hypot(cam.x - d.home.x, cam.z - d.home.z) > 25)) {
          h.position.copy(d.home);
          h.visible = true;
          Object.assign(d, { state: 'graze', t: 5 + Math.random() * 5 });
        }
      }
      d.a.holder.rotation.y = turnTo(h.rotation.y, d.yaw, d.state === 'flee' ? 6 : 1.5, dt);
      h.position.y = this.ground(h.position.x, h.position.z);
      d.a.mixer?.update(dt);
    }
  }

  // --- the fox ----------------------------------------------------------------------------------------

  _fox(g) {
    const a = animal(g, 0.5);
    this.group.add(a.holder);
    this.fox = { a, route: new Route(FOX), s: 8, wait: 0, yaw: 0, at: null };
  }

  _updateFox(dt) {
    const f = this.fox;
    if (!f) return;
    const r = f.route;
    let v = 0;
    if (f.wait > 0) {
      f.wait -= dt;
      if (f.wait <= 0) f.s = f.at?.away ? 0 : f.s + 0.01; // (back in from the west side, unseen)
    } else {
      v = 1.5;
      let step = v * dt;
      const next = r.nextStop(f.s);
      if (next) {
        const ahead = next.s - r.wrap(f.s);
        const lap = ahead < -1e-6 ? ahead + r.length : ahead;
        if (lap <= step) {
          step = Math.max(0, lap);
          f.wait = next.point.stop.secs;
          f.at = next.point;
        }
      }
      f.s += step;
    }
    const p = r.at(f.s);
    const h = f.a.holder;
    h.visible = !(f.wait > 0 && f.at?.away);
    if (v > 0) f.yaw = turnTo(f.yaw, Math.atan2(p.dir.x, p.dir.y), 5, dt);
    h.position.set(p.x, this.ground(p.x, p.z), p.z);
    h.rotation.y = f.yaw;
    // trotting; stopped, nose to the ground (or head up, listening)
    play(f.a, v > 0 ? 'Walk' : f.wait % 3 > 1.2 ? 'Eating' : 'Idle', 0.3, 1.25);
    f.a.mixer?.update(dt);
  }

  // --- swallows ------------------------------------------------------------------------------------------

  _swallows() {
    if (!this.openings.length) return;
    const n = 7;
    this.flock = new Flock(this.group, n, { colour: 0x141822, length: 0.17, span: 0.34 });
    this.flock.group.removeFromParent();
    this.group.add(this.flock.group);
    this.birds = [];
    for (let i = 0; i < n; i++) {
      const w = this.openings[(i * 3) % this.openings.length];
      const c = w.centre;
      const o = w.out;
      const inside = c.clone().addScaledVector(o, -3.5);
      const top = ruinTop(inside.x, inside.z);
      const pts = [
        c.clone().addScaledVector(o, 9 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 12, -c.y + 1.2 + Math.random() * 1.5, 0)),
        c.clone().addScaledVector(o, 2.5),
        c.clone(),
        inside.clone().add(new THREE.Vector3(0, 0.4, 0)),
        inside.clone().addScaledVector(o, -2).add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.max(0, top - inside.y) + 2.5, 0)),
        c.clone().addScaledVector(o, 3).add(new THREE.Vector3((Math.random() - 0.5) * 8, Math.max(0, top - c.y) + 4, 0)),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
      this.birds.push({ curve, u: Math.random(), len: curve.getLength(), speed: 8 + Math.random() * 3, ph: Math.random() * 6 });
    }
  }

  _updateSwallows(dt) {
    if (!this.flock) return;
    this.birds.forEach((b, i) => {
      b.u = (b.u + (b.speed * dt) / b.len) % 1;
      const p = b.curve.getPointAt(b.u);
      const tan = b.curve.getTangentAt(b.u);
      // quick beats, then a glide
      const beat = Math.sin(this.t * 11 + b.ph) > -0.2 ? Math.sin(this.t * 32 + b.ph) * 0.8 : 0.15;
      const bank = THREE.MathUtils.clamp(-tan.x * 0.6, -0.8, 0.8);
      this.flock.set(i, p, tan, beat, bank);
    });
    this.flock.show(this.birds.length);
  }

  update(dt, { camera, fog = 0, light = 1, onFoot = false } = {}) {
    dt = Math.min(dt, 0.1);
    this._updateMist(dt, fog, light);
    if (!this.ready) return;
    this.t += dt;
    this._updateDeer(dt, camera?.position, onFoot);
    this._updateFox(dt);
    this._updateSwallows(dt);
  }
}
