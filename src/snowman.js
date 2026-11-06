// A snowman on the front lawn in winter. It goes up once the snow is deep (from about
// 21 December), melts through the first half of February as the snow goes (it sags,
// shrinks, its head tips and drops its nose, the arms droop and fall), and its carrot, coal
// and sticks lie on the grass for a few days after.

import * as THREE from 'three';

const BUILT_FROM = 355; // 21 December
const MELT_FROM = 34; // 3 February
const MELT_TO = 46; // 15 February
const GONE = 53; // the leftovers cleared by 22 February

/** A ball of packed snow, a little lumpy, as made by hand. */
function snowball(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 9.1 + seed) * Math.sin(v.y * 7.3 - seed) * Math.sin(v.z * 8.7 + seed * 2.1);
    v.multiplyScalar(1 + 0.045 * n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class Snowman {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} at where it stands (on the ground)
   * @param {number} facing which way it looks (radians about y; 0 faces +z)
   */
  constructor(scene, at, facing = 0) {
    this.group = new THREE.Group();
    this.group.name = 'Snowman';
    this.group.position.copy(at);
    this.group.rotation.y = facing;
    scene.add(this.group);
    this.obstacle = { x: at.x, z: at.z, r: 0 }; // for walking; sized when it stands

    const snow = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.88, metalness: 0 });
    const coal = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    const carrot = new THREE.MeshStandardMaterial({ color: 0xe06a1b, roughness: 0.7 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4b3420, roughness: 0.9 });
    const wool = new THREE.MeshStandardMaterial({ color: 0xa3222a, roughness: 0.95 });
    const mesh = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    this.base = mesh(snowball(0.55, 1.3), snow);
    this.body = mesh(snowball(0.4, 2.7), snow);
    this.headPivot = new THREE.Group();
    this.head = mesh(snowball(0.27, 4.1), snow);
    this.headPivot.add(this.head);
    this.group.add(this.base, this.body, this.headPivot);

    // the face and the buttons
    this.nose = mesh(new THREE.ConeGeometry(0.045, 0.26, 10).rotateX(Math.PI / 2).translate(0, 0, 0.13), carrot);
    this.nose.position.set(0, 0, 0.25);
    this.head.add(this.nose);
    this.eyes = [-0.09, 0.09].map((x) => {
      const e = mesh(new THREE.SphereGeometry(0.03, 10, 8), coal);
      e.position.set(x, 0.07, 0.24);
      this.head.add(e);
      return e;
    });
    this.buttons = [0.16, 0, -0.16].map((y) => {
      const b = mesh(new THREE.SphereGeometry(0.035, 10, 8), coal);
      b.position.set(0, y, 0.385);
      this.body.add(b);
      return b;
    });
    // stick arms with twig fingers
    const armGeo = () => {
      const g = new THREE.CylinderGeometry(0.018, 0.026, 0.75, 6).translate(0, 0.375, 0);
      const twig = new THREE.CylinderGeometry(0.008, 0.012, 0.16, 5).translate(0, 0.08, 0).rotateZ(0.6).translate(0, 0.62, 0);
      const merged = new THREE.BufferGeometry();
      // (two pieces in one mesh: keep it simple, add the twig as a child instead)
      merged.copy(g);
      return [merged, twig];
    };
    this.arms = [-1, 1].map((side) => {
      const [g, t] = armGeo();
      const arm = mesh(g, wood);
      arm.add(mesh(t, wood));
      arm.position.set(side * 0.34, 0.08, 0);
      arm.rotation.z = -side * 1.05;
      this.body.add(arm);
      return { arm, side };
    });
    // a red scarf round the neck
    this.scarf = mesh(new THREE.TorusGeometry(0.23, 0.05, 8, 20).rotateX(Math.PI / 2), wool);
    this.group.add(this.scarf);

    // what is left on the grass once it has melted
    this.leftovers = new THREE.Group();
    this.group.add(this.leftovers);
    const lc = mesh(new THREE.ConeGeometry(0.045, 0.26, 10).rotateZ(Math.PI / 2), carrot);
    lc.position.set(0.25, 0.045, 0.3);
    lc.rotation.y = 0.6;
    this.leftovers.add(lc);
    for (const [x, z] of [
      [-0.2, 0.35],
      [-0.05, 0.42],
      [0.1, 0.18],
      [0.32, -0.05],
      [-0.3, 0.05],
    ]) {
      const c = mesh(new THREE.SphereGeometry(0.035, 8, 6), coal);
      c.position.set(x, 0.03, z);
      this.leftovers.add(c);
    }
    for (const [x, z, r] of [
      [-0.55, 0.1, 0.4],
      [0.5, -0.25, 2.1],
    ]) {
      const s = mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.75, 6).rotateZ(Math.PI / 2), wood);
      s.position.set(x, 0.03, z);
      s.rotation.y = r;
      this.leftovers.add(s);
    }
    const sc = mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 20).rotateX(Math.PI / 2).scale(1.3, 0.4, 0.8), wool);
    sc.position.set(-0.1, 0.03, -0.2);
    this.leftovers.add(sc);
    this.update(145);
  }

  /** How melted it is on day 0..364: null when it isn't there, 0 standing .. 1 a puddle. */
  static meltOn(day) {
    if (day >= BUILT_FROM || day < MELT_FROM) return 0;
    if (day < MELT_TO) return (day - MELT_FROM) / (MELT_TO - MELT_FROM);
    if (day < GONE) return 1;
    return null;
  }

  update(day) {
    const m = Snowman.meltOn(day);
    this.group.visible = m !== null;
    if (m === null) {
      this.obstacle.r = 0;
      return;
    }
    // it slumps: the balls shrink and squash, the lowest least
    const sb = 1 - 0.55 * m;
    const sm = Math.max(0.001, 1 - 0.85 * m);
    const sh = Math.max(0.001, 1 - 1.1 * m);
    this.base.scale.set(sb * (1 + 0.25 * m), sb * (1 - 0.35 * m), sb * (1 + 0.25 * m));
    const baseTop = 0.55 * this.base.scale.y;
    this.base.position.y = 0.47 * this.base.scale.y;
    this.body.scale.setScalar(sm);
    this.body.visible = m < 0.97;
    this.body.position.y = 0.47 * this.base.scale.y + baseTop * 0.85 + 0.36 * sm;
    const neck = this.body.position.y + 0.36 * sm;
    this.headPivot.position.set(0.06 * m, neck, 0);
    this.head.scale.setScalar(sh);
    this.head.position.y = 0.24 * sh;
    this.headPivot.rotation.z = 0.5 * m; // tipping over
    this.headPivot.visible = m < 0.88;
    this.nose.visible = m < 0.7; // it falls off first
    this.scarf.position.y = neck;
    this.scarf.scale.setScalar(Math.max(0.6, sm));
    this.scarf.visible = m < 0.8;
    for (const { arm, side } of this.arms) {
      arm.rotation.z = -side * (1.05 + 0.9 * m); // drooping
      arm.visible = m < 0.6;
    }
    // the leftovers show as the parts fall: the carrot first, then the rest
    this.leftovers.visible = m >= 0.6;
    this.obstacle.r = 0.5 * sb;
  }
}
