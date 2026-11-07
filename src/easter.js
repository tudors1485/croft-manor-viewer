// Spring and Easter. Daffodils come out across the estate from mid-March to late April: clumps
// along the drive either side, inside and outside the gate, round the two oaks at the entrance
// and along the edges of the lawns, coming up, nodding, and going over. Easter weekend (Good
// Friday to Easter Monday, by day) a dozen painted eggs are hidden in the gardens: walk up to one
// and you've found it. Easter falls on a different day each year: it is worked out here.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Easter Sunday in `year`, as the day of the year (0 = 1 January): the Gregorian computus. */
export function easterDay(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 March, 4 April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 864e5);
}

/** The next Easter Sunday from today (this year's, or next year's once Easter Monday has gone). */
export function nextEaster(now = new Date()) {
  const today = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 1)) / 864e5);
  const e = easterDay(now.getFullYear());
  return today <= e + 1 ? e : easterDay(now.getFullYear() + 1);
}

/** This year's Easter Sunday and the next one (the day of the year of each). */
function easterDays() {
  const y = new Date().getFullYear();
  return [easterDay(y), nextEaster()];
}

const BLOOM = [66, 76, 104, 116]; // coming up from about 7 March, out by 17 March, going over from 14 April, gone by late April

/** One daffodil, coloured per vertex: a stem, two leaves, and the flower nodding forward (+z). */
function daffodil() {
  const parts = [];
  const add = (geo, colour) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    const c = new THREE.Color(colour);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
    parts.push(g);
  };
  const green = 0x4f7a2c;
  add(new THREE.CylinderGeometry(0.0045, 0.006, 0.34, 4, 1, true).translate(0, 0.17, 0), green);
  for (const [s, turn] of [[-1, 0.4], [1, 0.9], [-1, 2.6], [1, 3.6]]) add(new THREE.BoxGeometry(0.016, 0.28, 0.002).translate(0, 0.14, 0).rotateZ(s * 0.22).rotateY(turn), 0x5d8a34);
  // the flower: six pale petals round a deeper yellow trumpet, facing forward and a little down
  const head = [];
  const petals = new THREE.CircleGeometry(0.036, 6);
  head.push([petals, 0xf6e27a]);
  head.push([new THREE.CylinderGeometry(0.016, 0.011, 0.032, 7, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.016), 0xf2b52a]);
  for (const [geo, col] of head) add(geo.rotateX(0.35).translate(0, 0.335, 0.012), col);
  return mergeGeometries(parts);
}

/** A painted egg's pattern: bands, zigzags or dots in two pastel colours. */
function eggTexture(k) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const pastel = ['#f4a7b9', '#9fd3f0', '#b8e3a1', '#f7d774', '#c9b2f0', '#f6b98a'];
  const a = pastel[k % pastel.length];
  const b = pastel[(k + 2) % pastel.length];
  g.fillStyle = a;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = b;
  g.strokeStyle = b;
  g.lineWidth = 5;
  if (k % 3 === 0) {
    for (const y of [16, 32, 48]) g.fillRect(0, y - 3, 128, 6);
  } else if (k % 3 === 1) {
    g.beginPath();
    for (let x = 0; x <= 128; x += 8) g.lineTo(x, x % 16 ? 26 : 38);
    g.stroke();
    g.fillRect(0, 10, 128, 3);
    g.fillRect(0, 51, 128, 3);
  } else {
    for (let y = 8; y < 64; y += 14) for (let x = (y / 14) % 2 ? 0 : 8; x < 128; x += 16) {
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Easter {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {(x: number, z: number) => boolean} o.isLawn grass inside the estate
   * @param {(x: number, z: number) => number|null} o.ground the ground's height
   * @param {{x: number, z: number}[]} o.obstacles trunks and shrubs ({ x, z, r })
   * @param {{x: number, z: number}|null} o.gate
   * @param {{x0: number, x1: number}|null} o.drive the drive outside the gate
   * @param {number} o.lawnEdge where the estate ends to the south (z)
   */
  constructor(scene, { isLawn, ground, obstacles, gate, drive, lawnEdge }) {
    this.group = new THREE.Group();
    this.group.name = 'Spring and Easter';
    scene.add(this.group);
    this.t = 0;
    const R = mulberry(20270328);
    const clear = (x, z, r = 0.3) => obstacles.every((o) => o.when || Math.hypot(o.x - x, o.z - z) > (o.r ?? 0) + r);
    const okAt = (x, z) => {
      if (z > lawnEdge) return drive ? (x < drive.x0 - 1.2 || x > drive.x1 + 1.2) && ground(x, z) !== null : ground(x, z) !== null;
      return isLawn(x, z);
    };

    // --- daffodils, in clumps ---
    const clumps = [];
    const gx = gate?.x ?? 4.6;
    const gz = gate?.z ?? 20.7;
    for (let z = gz - 1.5; z > 8; z -= 1.8) for (const side of [-1, 1]) clumps.push([gx + side * (2.6 + R() * 1.2), z + R() - 0.5, 0.7]); // the drive, inside
    for (let z = gz + 3; z < gz + 26; z += 2.2) for (const side of [-1, 1]) clumps.push([gx + side * (3.4 + R() * 1.6), z + R(), 0.8]); // the drive, outside
    for (const side of [-1, 1]) for (let a = 0; a < 6; a++) clumps.push([gx + side * 5.4 + Math.cos(a) * (2.5 + R()), gz - 6.5 + Math.sin(a) * (2.5 + R()), 0.9]); // round the oaks
    for (let i = 0; i < 26; i++) clumps.push([-13 + R() * 6, -4 + R() * 22, 1]); // the west lawn's edge
    for (let i = 0; i < 26; i++) clumps.push([21 + R() * 7, -4 + R() * 22, 1]); // the east lawn's edge
    const spots = [];
    for (const [cx, cz, r] of clumps) {
      const n = 22 + Math.floor(R() * 26);
      for (let k = 0; k < n; k++) {
        const a = R() * Math.PI * 2;
        const d = Math.sqrt(R()) * r;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        if (!okAt(x, z) || !clear(x, z)) continue;
        const y = ground(x, z);
        if (y === null) continue;
        spots.push([x, y, z]);
      }
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    this.grow = { value: 1 };
    this.sway = { value: 0 };
    this.time = { value: 0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrow = this.grow;
      shader.uniforms.uSway = this.sway;
      shader.uniforms.uTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uGrow;\nuniform float uSway;\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          // coming up and going over: they grow from the ground, then droop; and they nod in the wind
          float h = transformed.y;
          transformed.y *= uGrow;
          float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3;
          transformed.x += h * h * 6.0 * uSway * sin(uTime * 1.9 + phase);`,
        );
    };
    const geo = daffodil();
    this.flowers = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(([x, y, z], i) => {
      q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.25, R() * Math.PI * 2, (R() - 0.5) * 0.25));
      const s = 0.8 + R() * 0.45;
      m.compose(new THREE.Vector3(x, y - 0.01, z), q, new THREE.Vector3(s, s, s));
      this.flowers.setMatrixAt(i, m);
    });
    this.flowers.count = spots.length;
    this.flowers.receiveShadow = true;
    this.flowers.frustumCulled = false;
    this.group.add(this.flowers);
    this.daffodils = spots.length;

    // --- the eggs ---
    const homes = [
      [2.2, 13.6], [-3.4, 9.2], [7.4, 11.8], [-8.2, 4.4], [12.6, 6.2], [-11.5, 13.5],
      [16.5, 14.8], [-5.8, 16.2], [24.5, 6.5], [0.8, 4.2], [9.6, 16.8], [-12.6, 1.2],
      [19, 2], [-1.6, 18.4], [14.2, 1.6], [26, 13], [-9.6, 9.8], [21.5, 9.5], [5.6, 2.4], [-6.8, 0.8],
    ].filter(([x, z]) => isLawn(x, z) && clear(x, z, 0.4));
    const eggGeo = new THREE.SphereGeometry(1, 20, 14).scale(0.042, 0.058, 0.042);
    this.eggs = homes.slice(0, 12).map(([x, z], k) => {
      const mesh = new THREE.Mesh(eggGeo, new THREE.MeshStandardMaterial({ map: eggTexture(k), roughness: 0.45, transparent: true }));
      const y = (ground(x, z) ?? 0) + 0.035;
      mesh.position.set(x, y, z);
      mesh.rotation.set((R() - 0.5) * 1.2, R() * Math.PI * 2, (R() - 0.5) * 1.2);
      mesh.castShadow = true;
      this.group.add(mesh);
      return { mesh, home: mesh.position.clone(), found: false, pop: 0 };
    });
    this.found = 0;
    this.onFound = null; // (found, total) => void
  }

  /**
   * Easter weekend, Good Friday to Easter Monday. (The viewer's date has no year: it is this
   * year's Easter or the next one, whichever the day falls on.)
   */
  static weekend(day) {
    const d = Math.floor(day);
    return easterDays().some((e) => d >= e - 2 && d <= e + 1);
  }

  /** Easter Sunday itself (this year's or the next). */
  static sunday(day) {
    return easterDays().includes(Math.floor(day));
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {number} o.night 0 day .. 1 night
   * @param {number} o.snow snow lying 0..1
   * @param {number} o.wind 0..1
   * @param {THREE.Vector3|null} o.feet where you stand while walking (null otherwise)
   */
  update(dt, { day, night, snow, wind, feet }) {
    this.t += dt;
    this.time.value = this.t;
    const ss = THREE.MathUtils.smoothstep;
    const bloom = ss(day, BLOOM[0], BLOOM[1]) * (1 - ss(day, BLOOM[2], BLOOM[3]));
    // (they come up from the ground, and lie down as they go over, under snow they hide)
    this.grow.value = 0.25 + 0.75 * bloom;
    this.flowers.visible = bloom > 0.02 && snow < 0.4;
    this.sway.value = 0.004 + 0.02 * wind;
    // the eggs: the Easter weekend, by day
    const hunt = Easter.weekend(day) && night < 0.5;
    // (away from Easter and back again, they are all hidden again: a fresh hunt)
    if (!hunt && this.found) {
      this.found = 0;
      for (const e of this.eggs) {
        Object.assign(e, { found: false, pop: 0 });
        e.mesh.position.copy(e.home);
        e.mesh.material.opacity = 1;
      }
    }
    for (const e of this.eggs) {
      e.mesh.visible = hunt && e.pop < 1;
      if (!hunt) continue;
      if (!e.found && feet && Math.hypot(feet.x - e.home.x, feet.z - e.home.z) < 1.25 && Math.abs(feet.y - e.home.y) < 1.5) {
        e.found = true;
        this.found++;
        this.onFound?.(this.found, this.eggs.length);
      }
      if (e.found && e.pop < 1) {
        // found: it hops up, spinning, and is gone
        e.pop = Math.min(1, e.pop + dt * 1.1);
        e.mesh.position.y = e.home.y + Math.sin(e.pop * Math.PI) * 0.6;
        e.mesh.rotation.y += dt * 9;
        e.mesh.material.opacity = 1 - ss(e.pop, 0.55, 1);
      }
    }
  }
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
