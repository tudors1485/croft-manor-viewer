// Moving in (Sights): the great hall on the day the crates came. Crates and boxes stacked on the
// floor before the stairs, most of the paintings not hung yet (two of them leaning against the
// crates), and where each will hang, a paler patch of wall. Reset, or another scene, puts it all back.
//
// The crates and boxes are Poly Haven's (CC0): public/models/moving/.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// the hall's paintings that aren't up yet (the big one over the stairs is)
const NOT_HUNG = /^cm_obj_(painting_rome|painting_smallset2|painting_mainhall_01|tapestry_unicorn)$/;
export class MovingIn {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} model the house
   * @param {object[]} obstacles walking's obstacles (the crates join them while it is on)
   */
  constructor(scene, model, obstacles) {
    this.scene = scene;
    this.model = model;
    this.obstacles = obstacles;
    this.on = false;
    this.group = new THREE.Group();
    this.group.name = 'Moving in';
    this.group.visible = false;
    scene.add(this.group);
    this.hidden = [];
    let plaster = null;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.material.name || '';
      if (NOT_HUNG.test(n)) this.hidden.push(o);
      if (n === 'cm_whitestone_sepia_int') plaster = o.material;
    });
    this.paintings = this.hidden.map((m) => m.material);
    // where a painting isn't hung yet, the wall behind it (the model has no wall there: a hole):
    // a patch of the plaster, a little paler, unfaded where the painting will go
    this.patch = plaster ? plaster.clone() : new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 });
    this.patch.color = this.patch.color.clone().multiplyScalar(1.08);
  }

  async _load(base = '') {
    if (this.loaded || this.loading) return;
    this.loading = true;
    const loader = new GLTFLoader();
    const [big, chest, small, box] = await Promise.all(['crate-big', 'chest', 'crate-small', 'box'].map((n) => loader.loadAsync(`${base}models/moving/${n}.glb`).catch(() => null)));
    const kinds = { big, chest, small, box };
    const tops = new Map(); // (what stands on what)
    const put = (kind, x, z, rot = 0, on = null) => {
      const g = kinds[kind];
      if (!g) return null;
      const o = g.scene.clone(true);
      o.rotation.y = rot;
      // (the big crates and the chests a size up: tea-chest and packing-case size)
      if (kind === 'big' || kind === 'chest') o.scale.setScalar(1.3);
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      const base = on ? tops.get(on) : 0;
      o.position.set(x - (b.min.x + b.max.x) / 2, base - b.min.y, z - (b.min.z + b.max.z) / 2);
      o.traverse((m) => {
        if (m.isMesh) m.castShadow = m.receiveShadow = true;
      });
      this.group.add(o);
      tops.set(o, base + (b.max.y - b.min.y));
      if (!on) this.obstacles.push({ x, z, r: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.55, when: () => this.on });
      return o;
    };
    // before the stairs, either side of the rug: big crates, some with others on them, boxes about
    const a = put('big', -3.6, -17.4, 0.08);
    const b = put('big', -3.3, -18.9, -0.04);
    put('chest', -3.5, -17.3, 0.3, a);
    put('box', -3.2, -18.8, 0.5, b);
    const c = put('big', 0.0, -17.6, -0.12);
    put('big', 0.3, -19.0, 0.05);
    const d = put('chest', 1.6, -16.6, 1.5);
    put('small', 1.5, -16.5, 1.2, d);
    put('chest', -1.9, -19.4, 0.02);
    put('small', -0.1, -17.7, 0.4, c);
    const e = put('box', -5.3, -16.2, 0.3);
    const f = put('box', -5.4, -16.2, -0.2, e);
    put('box', -5.3, -16.2, 0.6, f);
    put('box', -4.9, -15.3, -0.4);
    const h = put('box', 2.7, -18.3, 0.2);
    put('box', 2.6, -18.3, 0.9, h);
    put('small', 2.4, -15.4, -0.6);
    // two of the paintings, leaning against the crates, waiting to be hung
    for (const [m, x, z, rot] of [
      [this.paintings[0], -4.4, -16.6, 1.2],
      [this.paintings[2], 0.95, -17.0, -1.4],
    ]) {
      if (!m?.map) continue;
      const img = m.map.image;
      const ar = img?.width && img?.height ? img.width / img.height : 1.3;
      const w = 1.0;
      const frame = new THREE.Group();
      const geo = new THREE.PlaneGeometry(w, w / ar);
      // (the model's pictures come from glTF, the right way up for its own UVs, not a plane's)
      if (m.map.flipY === false) {
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k));
      }
      const canvas = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.7 }));
      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, w / ar + 0.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x6a4a1c, roughness: 0.4, metalness: 0.4 }));
      back.position.z = -0.03;
      canvas.position.z = 0.001;
      frame.add(back, canvas);
      frame.position.set(x, (w / ar) / 2 + 0.03, z);
      frame.rotation.set(-0.18, rot, 0, 'YXZ');
      frame.traverse((o) => o.isMesh && (o.castShadow = true));
      this.group.add(frame);
    }
    this.loaded = true;
  }

  set(on) {
    this.on = on;
    if (on) this._load().catch((err) => console.warn('the crates did not load:', err.message));
    this.group.visible = on;
    for (const m of this.hidden) {
      m.material = on ? this.patch : this.paintings[this.hidden.indexOf(m)];
      for (const f of m.userData.frames ?? []) f.visible = !on; // (their gilt frames too: interior.js)
    }
  }
}
