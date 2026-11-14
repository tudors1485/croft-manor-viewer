// The lady of the house, in Fifty and A hundred years empty: now and then, from the lawns, a faint
// figure at one of the upstairs windows at the front, in a gown and a bonnet, looking out. Look
// straight at her, or come close, and she is gone; a while later she is at another window. Never
// at night only: a dull afternoon is when you catch her. (Quaternius's lady, people.js, drawn pale
// and see-through.)

import * as THREE from 'three';
import { Person } from './people.js';

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();

export class Ghost {
  /**
   * @param {THREE.Group} group  the scene's group
   * @param {object} o
   * @param {{centre: THREE.Vector3, out: THREE.Vector3, box: THREE.Box3, boarded?: boolean}[]} o.windows
   * @param {(origin, dir, far) => object|null} o.hit  rays meeting what is left of the house
   * @param {object} [o.sound]
   */
  constructor(group, { windows, hit, sound = null }) {
    this.group = group;
    this.hit = hit;
    this.sound = sound;
    // the upstairs windows of the front (the side you see from the lawns), not boarded, with a floor behind
    this.spots = [];
    for (const w of windows) {
      if (w.boarded || w.box.min.y < 3 || w.out.z < 0.7 || w.w < 0.6) continue;
      const stand = w.centre.clone().addScaledVector(w.out, -0.45);
      const floor = hit(stand.clone().setY(w.box.min.y + 0.3), new THREE.Vector3(0, -1, 0), 2.2);
      if (!floor || floor.normal.y < 0.7) continue;
      stand.y = floor.point.y;
      this.spots.push({ w, stand, yaw: Math.atan2(w.out.x, w.out.z) });
    }
    this.person = null;
    this.state = 'away';
    this.timer = 12 + Math.random() * 15;
    this.alpha = 0;
    this.seen = 0;
    this.visits = 0;
    if (this.spots.length) {
      Person.make('lady')
        .then((p) => {
          this.person = p;
          this.mat = new THREE.MeshLambertMaterial({ color: 0xc8d0dc, emissive: 0x8a929e, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true });
          for (const g of [p.root, p.loose])
            g.traverse((o) => {
              if (!o.isMesh) return;
              o.material = this.mat;
              o.castShadow = false;
              o.receiveShadow = false;
              o.renderOrder = 3;
            });
          p.root.visible = false;
          group.add(p.root);
        })
        .catch((err) => console.warn('the lady did not come:', err.message));
    }
  }

  /** Is she somewhere the camera can catch her: the window in view, from the lawns in front of it? */
  _canSee(spot, camera) {
    const cam = camera.position;
    const to = _v.copy(spot.stand).setY(spot.stand.y + 1.4).sub(cam);
    const d = to.length();
    if (d < 14 || d > 70) return false;
    if (-to.dot(spot.w.out) < d * 0.35) return false; // (in front of the window, not side on)
    camera.getWorldDirection(_f);
    const a = to.normalize().angleTo(_f);
    return a > 0.12 && a < 0.5; // (in view, a little off where you look)
  }

  update(dt, { camera }) {
    const p = this.person;
    if (!p || !camera) return;
    const cam = camera.position;
    if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const choices = this.spots.filter((s) => s !== this.spot && this._canSee(s, camera));
        if (choices.length) {
          this.spot = choices[Math.floor(Math.random() * choices.length)];
          // (the grime on that pane thinner while she is there: you see her through it, faintly)
          const pane = this.spot.w.pane;
          if (pane) {
            this.paneMat = pane.material;
            this.clear ??= Object.assign(pane.material.clone(), { depthWrite: false });
            this.clear.opacity = this.paneMat.opacity;
            pane.material = this.clear;
          }
          p.root.position.copy(this.spot.stand);
          p.root.rotation.y = this.spot.yaw;
          p.root.visible = true;
          this.state = 'coming';
          this.seen = 0;
          this.stay = 14 + Math.random() * 14;
        } else this.timer = 2;
      }
    } else {
      const head = _v.copy(this.spot.stand).setY(this.spot.stand.y + 1.45);
      const d = cam.distanceTo(head);
      camera.getWorldDirection(_f);
      const looked = head.clone().sub(cam).normalize().angleTo(_f) < 0.06;
      this.seen = looked ? this.seen + dt : Math.max(0, this.seen - dt);
      this.stay -= dt;
      if (this.state === 'coming') {
        this.alpha = Math.min(1, this.alpha + dt * 0.35);
        if (this.alpha >= 1) this.state = 'there';
      }
      // gone the moment you look straight at her, or come near, or when she has stood long enough
      if (this.state !== 'going' && (this.seen > 0.35 || d < 11 || this.stay <= 0)) this.state = 'going';
      if (this.state === 'going') {
        this.alpha = Math.max(0, this.alpha - dt * (this.stay <= 0 ? 0.5 : 2.5));
        if (this.alpha <= 0) {
          p.root.visible = false;
          this._restorePane();
          this.state = 'away';
          this.timer = 25 + Math.random() * 35;
          this.visits++;
        }
      }
      // (a slight sway, and her head turned a little now and then)
      p.root.rotation.y = this.spot.yaw + Math.sin(performance.now() / 2600) * 0.12;
      p.update(dt, 0);
    }
    this.mat.opacity = 0.42 * this.alpha * (0.85 + 0.15 * Math.sin(performance.now() / 700));
    if (this.clear && this.spot?.w.pane?.material === this.clear) this.clear.opacity = THREE.MathUtils.lerp(this.paneMat.opacity, 0.5, this.alpha);
  }

  _restorePane() {
    const pane = this.spot?.w.pane;
    if (pane && this.paneMat) pane.material = this.paneMat;
  }

  set(on) {
    if (!on && this.person) {
      this.person.root.visible = false;
      this._restorePane();
      this.state = 'away';
      this.alpha = 0;
      this.timer = 12 + Math.random() * 15;
    }
  }
}
