// More of Christmas at the front of the house, from Christmas Eve to Twelfth Night (with festive.js's
// dressing, in its Christmas Eve group, so it comes and goes with it; its lights in festive.extra, so
// they follow the light show when the bell is rung):
// - a garland of greenery with warm lights and red bows following the porch's arch;
// - iron lanterns with candles lining the drive from the gate to the fountain;
// - the fountain's rim wound with greenery and lights;
// - a wreath with a red bow in each of the front windows;
// - presents wrapped under the big tree on the lawn;
// - two reindeer made of white lights on the lawn, one grazing, one looking up, nodding.
// On New Year's Eve and New Year's Day the Christmas things (the wreaths, the presents, the reindeer,
// the red bows) give way to New Year's: gold and silver balloons by the door and the gate, the coming
// year in lit marquee letters on the lawn, gold stars where the bows were, a mirror ball turning in the
// porch, a champagne table by the door. The Christmas lights stay on.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bulbs } from './festive.js';

const WARM = [1, 0.8, 0.5];
const R2 = (n) => (Math.random() - 0.5) * n;

/** Geometry with only position, normal and uv, non-indexed, placed by m (to merge). */
function prep(geo, m) {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
  g.clearGroups();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

/** A wreath's greens and its reds (berries, bow), as two geometries, facing +z, 0.96 m across. */
function wreathGeometry() {
  const green = [];
  const red = [];
  green.push(prep(new THREE.TorusGeometry(0.33, 0.1, 8, 24), at(0, 0, 0)));
  const sprig = new THREE.ConeGeometry(0.05, 0.16, 5);
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const r = 0.33 + (k % 2 ? 0.07 : -0.05);
    green.push(prep(sprig, at(Math.cos(a) * r, Math.sin(a) * r, 0.05, 0, 0, a + (k % 3) * 0.6)));
  }
  const berry = new THREE.SphereGeometry(0.025, 6, 4);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + R2(0.3);
    red.push(prep(berry, at(Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.1)));
  }
  const loop = new THREE.ConeGeometry(0.07, 0.16, 4);
  for (const s of [-1, 1]) red.push(prep(loop, at(s * 0.08, -0.33, 0.1, 0, 0, (s * Math.PI) / 2)));
  for (const s of [-1, 1]) red.push(prep(new THREE.BoxGeometry(0.03, 0.2, 0.01), at(s * 0.05, -0.45, 0.1, 0, 0, s * 0.3)));
  return { green: mergeGeometries(green), red: mergeGeometries(red) };
}

/** A reindeer's outline (side view, metres, facing +x, about 1.15 m at the shoulder). */
const BODY = [
  [0.62, 0.95], [0.6, 1.1], [0.38, 1.22], [0.0, 1.17], [-0.4, 1.16], [-0.62, 1.1], [-0.72, 1.13], [-0.7, 0.96], [-0.62, 0.8], [-0.4, 0.72], [0.0, 0.68], [0.4, 0.72], [0.6, 0.8],
];
// the legs: front and hind, bent as a deer's are
const LEGS = [
  [[0.48, 0.8], [0.5, 0.42], [0.49, 0.1], [0.54, 0.0]],
  [[-0.5, 0.84], [-0.63, 0.42], [-0.55, 0.12], [-0.5, 0.0]],
];
// from the base of the neck (the pivot when it grazes or nods): the neck and head, an ear, and an
// antler (its beam and tines), x forward, y up
const NECK = new THREE.Vector3(0.5, 1.12, 0);
const HEAD = [
  [-0.12, 0.1], [0.12, 0.43], [0.45, 0.3], [0.48, 0.24], [0.42, 0.2], [0.2, 0.24], [0.1, -0.02],
];
const EAR = [[0.16, 0.44], [0.08, 0.54]];
const ANTLER = [
  [[0.14, 0.46], [0.05, 0.73], [-0.05, 0.98], [0.05, 1.18], [0.2, 1.26]],
  [[0.02, 0.8], [0.16, 0.9]],
  [[-0.03, 0.96], [-0.14, 1.13]],
  [[0.05, 1.13], [0.08, 1.3]],
  [[0.14, 0.5], [0.28, 0.63]],
];

/** Points every `step` along a smooth curve through `pts` (x, y), at z (or z(y) for a spreading antler). */
function along(pts, step, z, closed = false) {
  const zf = typeof z === 'function' ? z : () => z;
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, zf(y))), closed, 'centripetal');
  const n = Math.max(2, Math.round(curve.getLength() / step));
  return curve.getSpacedPoints(n);
}

/** A reindeer of lights: { group, head, lights } (head turns about the neck). Warm bulbs, and a thin pale frame. */
function reindeer(scale = 1) {
  const group = new THREE.Group();
  const frame = new THREE.LineBasicMaterial({ color: 0xdedcd6, transparent: true, opacity: 0.5 });
  const bodyPts = [];
  const bodyLines = [];
  const strand = (pts, list, lines) => {
    list.push(...pts);
    for (let i = 0; i < pts.length - 1; i++) lines.push(pts[i], pts[i + 1]);
  };
  for (const z of [-0.17, 0.17]) strand(along(BODY, 0.06, z, true), bodyPts, bodyLines);
  // the legs, a pair each side, one a step ahead of the other
  for (const z of [-0.1, 0.1]) for (const leg of LEGS) strand(along(leg.map(([x, y]) => [x + (z > 0 ? 0.05 : -0.03), y]), 0.06, z), bodyPts, bodyLines);
  // (cross-wires along the back and the belly)
  for (const [x, y] of [BODY[2], BODY[4], BODY[9], BODY[11]]) bodyLines.push(new THREE.Vector3(x, y, -0.17), new THREE.Vector3(x, y, 0.17));
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(bodyLines), frame));
  const bodyBulbs = bulbs(bodyPts.map((p) => ({ pos: p.toArray(), colour: WARM, phase: Math.random() })), 0.05);
  group.add(bodyBulbs);
  const headGroup = new THREE.Group();
  headGroup.position.copy(NECK);
  const headPts = [];
  const headLines = [];
  for (const z of [-0.07, 0.07]) {
    strand(along(HEAD, 0.055, z, true), headPts, headLines);
    strand(along(EAR, 0.05, z * 1.6), headPts, headLines);
    // (the antlers spread apart as they rise)
    const spread = (y) => Math.sign(z) * (0.07 + Math.max(0, y - 0.45) * 0.3);
    for (const a of ANTLER) strand(along(a, 0.055, spread), headPts, headLines);
  }
  headGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(headLines), frame));
  const headBulbs = bulbs(headPts.map((p) => ({ pos: p.toArray(), colour: WARM, phase: Math.random() })), 0.05);
  headGroup.add(headBulbs);
  group.add(headGroup);
  group.scale.setScalar(scale);
  return { group, head: headGroup, lights: [bodyBulbs, headBulbs] };
}

/**
 * @param {import('./festive.js').Festive} festive (after festive.decorate)
 * @param {object} o
 * @param {import('three-mesh-bvh').MeshBVH} o.bvh
 * @param {object} o.door the front door ({ centre, normal, y0, width })
 * @param {{x:number, z:number}} o.gate
 * @param {THREE.Vector3|null} o.treeAt the big tree on the lawn
 * @param {object[]} o.windows haunt.js's windows ({ c, u, n, width, bottom, top })
 * @param {(x: number, z: number) => number} o.ground
 * @param {(x: number, z: number, r: number) => boolean} o.clear open lawn there
 * @returns {{ update: (dt: number) => void }}
 */
export function dressFront(festive, { bvh, door, gate, treeAt, windows, ground, clear }) {
  const eve = festive.eve;
  if (!eve) return { update() {} };
  const lights = []; // (their bulbs objects, for festive.extra)
  const christmasOnly = []; // (put away on New Year's Eve and Day)
  const stars = []; // (where the bows are: New Year's gold stars instead) [position, yaw]
  const ray = new THREE.Ray();
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x1d4526, roughness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xa3120f, roughness: 0.45, emissive: 0x200202 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x18161a, roughness: 0.55, metalness: 0.6 });
  const add = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    eve.add(mesh);
    return mesh;
  };
  const sprig = new THREE.ConeGeometry(0.06, 0.2, 5);
  const bowGeo = mergeGeometries([prep(new THREE.ConeGeometry(0.09, 0.2, 4), at(-0.1, 0, 0, 0, 0, Math.PI / 2)), prep(new THREE.ConeGeometry(0.09, 0.2, 4), at(0.1, 0, 0, 0, 0, -Math.PI / 2)), prep(new THREE.BoxGeometry(0.04, 0.3, 0.02), at(-0.06, -0.16, 0, 0, 0, 0.3)), prep(new THREE.BoxGeometry(0.04, 0.3, 0.02), at(0.06, -0.16, 0, 0, 0, -0.3))]);
  /** A garland along a curve: sprigs of greenery round it, warm bulbs through it, bows at `bows` (0..1). */
  const garland = (curve, { thick = 0.16, bows = [], lightsEvery = 0.16, bowYaw = () => 0 } = {}) => {
    const len = curve.getLength();
    const greens = [];
    const reds = [];
    const n = Math.round(len / 0.07);
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n);
      for (let k = 0; k < 3; k++) greens.push(prep(sprig, at(p.x + R2(thick), p.y + R2(thick), p.z + R2(thick), Math.random() * 6, Math.random() * 6, Math.random() * 6)));
    }
    for (const b of bows) {
      const p = curve.getPointAt(b);
      reds.push(prep(bowGeo, at(p.x, p.y - 0.04, p.z, 0, bowYaw(p), 0)));
      stars.push([p.clone(), bowYaw(p)]);
    }
    add(new THREE.Mesh(mergeGeometries(greens), greenMat));
    if (reds.length) christmasOnly.push(add(new THREE.Mesh(mergeGeometries(reds), redMat)));
    const pts = [];
    const m = Math.round(len / lightsEvery);
    for (let i = 0; i <= m; i++) {
      const p = curve.getPointAt(i / m);
      pts.push({ pos: [p.x + R2(thick * 0.8), p.y + R2(thick * 0.8), p.z + R2(thick * 0.8)], colour: WARM, phase: Math.random() });
    }
    const b = bulbs(pts, 0.08);
    lights.push(b);
  };

  // --- the porch: a garland following its arch ---
  if (door) {
    const out = door.normal.clone();
    if (out.z < 0) out.negate();
    const side = new THREE.Vector3(out.z, 0, -out.x);
    const front = (s, y) => {
      ray.set(door.centre.clone().addScaledVector(out, 6).addScaledVector(side, s).setY(y), out.clone().negate());
      return bvh.raycastFirst(ray, THREE.DoubleSide, 0, 12);
    };
    // the porch's front face: from in front, beside the opening
    let faceD = null;
    for (const s of [1.9, -1.9, 2.3, -2.3]) {
      const h = front(s, door.y0 + 1.5);
      if (h) {
        faceD = Math.min(faceD ?? Infinity, h.distance);
      }
    }
    if (faceD !== null) {
      // across the opening: the height where the ray stops going through (the arch's edge)
      const arch = [];
      for (let s = -1.6; s <= 1.6001; s += 0.1) {
        let edge = null;
        for (let y = door.y0 + 1.2; y < door.y0 + 5; y += 0.04) {
          const h = front(s, y);
          if (h && Math.abs(h.distance - faceD) < 0.25) {
            edge = y;
            break;
          }
        }
        if (edge !== null && edge > door.y0 + 1.6) arch.push(door.centre.clone().addScaledVector(out, 6 - faceD + 0.12).addScaledVector(side, s).setY(edge + 0.04));
      }
      // (only the arch itself: the stretch where the edge is above the springing, either side)
      if (arch.length > 6) {
        const pts = arch;
        // hang it a little lower at the ends, as a swag does
        pts[0].y -= 0.15;
        pts[pts.length - 1].y -= 0.15;
        garland(new THREE.CatmullRomCurve3(pts), { bows: [0.02, 0.5, 0.98] });
      }
    }
  }

  // --- lanterns along the drive, from the gate to the fountain ---
  if (gate) {
    const cage = mergeGeometries([
      prep(new THREE.BoxGeometry(0.22, 0.03, 0.22), at(0, 0.015, 0)),
      prep(new THREE.ConeGeometry(0.17, 0.14, 4), at(0, 0.43, 0, 0, Math.PI / 4)),
      prep(new THREE.TorusGeometry(0.05, 0.008, 4, 10), at(0, 0.53, 0)),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => prep(new THREE.BoxGeometry(0.018, 0.33, 0.018), at(a * 0.095, 0.2, b * 0.095))),
    ]);
    const spots = [];
    for (let z = gate.z - 2.2; z > 13.2; z -= 2.4) for (const s of [-1, 1]) spots.push(new THREE.Vector3(gate.x + s * 2.7, 0, z));
    const im = new THREE.InstancedMesh(cage, ironMat, spots.length);
    const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xffa040, emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.85 }), spots.length);
    const flames = [];
    spots.forEach((p, i) => {
      p.y = ground(p.x, p.z);
      const m = at(p.x, p.y, p.z, 0, Math.random() * 0.4);
      im.setMatrixAt(i, m);
      glass.setMatrixAt(i, at(p.x, p.y + 0.19, p.z));
      flames.push({ pos: [p.x, p.y + 0.18, p.z], colour: [1, 0.62, 0.25], phase: Math.random() });
    });
    add(im);
    eve.add(glass);
    lights.push(bulbs(flames, 0.22));
  }

  // --- the fountain: its rim wound with greenery and lights ---
  {
    const c = new THREE.Vector3(4.59, 0, 8.28);
    // the rim's top: the highest ring of ground round the middle, between 3 and 4.3 m out
    let best = null;
    for (let r = 3; r <= 4.3; r += 0.05) {
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += ground(c.x + Math.cos(k) * r, c.z + Math.sin(k) * r);
      if (!best || sum / 8 > best.y) best = { r, y: sum / 8 };
    }
    if (best && best.y > 0.25) {
      const pts = [];
      for (let k = 0; k <= 64; k++) pts.push(new THREE.Vector3(c.x + Math.cos((k / 64) * Math.PI * 2) * best.r, best.y + 0.07, c.z + Math.sin((k / 64) * Math.PI * 2) * best.r));
      garland(new THREE.CatmullRomCurve3(pts, true), { thick: 0.12, bows: [0, 0.25, 0.5, 0.75], bowYaw: (p) => Math.atan2(p.x - c.x, p.z - c.z) });
    }
  }

  // --- a wreath in each front window ---
  {
    const front = windows.filter((w) => w.n.z > 0.75 && w.width > 0.5 && w.width < 2.2 && w.top - w.bottom > 0.9);
    if (front.length) {
      const { green, red } = wreathGeometry();
      const g = new THREE.InstancedMesh(green, greenMat, front.length);
      const r = new THREE.InstancedMesh(red, redMat, front.length);
      front.forEach((w, i) => {
        const s = Math.min(0.62, (w.width * 0.7) / 0.96);
        const p = w.c.clone().addScaledVector(w.n, 0.1).setY(w.bottom + (w.top - w.bottom) * 0.6);
        const m = new THREE.Matrix4().lookAt(p, p.clone().add(w.n), new THREE.Vector3(0, 1, 0));
        // (lookAt points -z at the target: turn it round so the wreath's face (+z) looks out)
        m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
        m.setPosition(p);
        m.multiply(new THREE.Matrix4().makeScale(s, s, s));
        g.setMatrixAt(i, m);
        r.setMatrixAt(i, m);
      });
      christmasOnly.push(add(g), add(r));
    }
  }

  // --- presents under the big tree ---
  if (treeAt) {
    const parts = [];
    const colours = [0xb3141a, 0x1f6b35, 0xd6a537, 0x23468f, 0xf1ece0, 0x8a1d5c];
    const ribbon = [0xf3d27a, 0xb3141a, 0xf1ece0, 0xd6a537];
    const coloured = (geo, m, hex) => {
      const g = prep(geo, m);
      const c = new THREE.Color(hex);
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0).flatMap(() => [c.r, c.g, c.b]), 3));
      parts.push(g);
    };
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R2(0.4);
      const r = 1.75 + Math.random() * 0.45;
      const w = 0.3 + Math.random() * 0.35;
      const h = 0.2 + Math.random() * 0.3;
      const d = 0.3 + Math.random() * 0.3;
      const x = treeAt.x + Math.cos(a) * r;
      const z = treeAt.z + Math.sin(a) * r;
      const y = ground(x, z);
      const yaw = Math.random() * Math.PI;
      const base = at(x, y, z, 0, yaw);
      const box = colours[i % colours.length];
      const rib = ribbon[i % ribbon.length];
      coloured(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), base, box);
      coloured(new THREE.BoxGeometry(w + 0.006, h + 0.006, 0.05).translate(0, h / 2, 0), base, rib);
      coloured(new THREE.BoxGeometry(0.05, h + 0.006, d + 0.006).translate(0, h / 2, 0), base, rib);
      coloured(new THREE.ConeGeometry(0.05, 0.12, 4).rotateZ(Math.PI / 2).translate(-0.06, h + 0.03, 0), base, rib);
      coloured(new THREE.ConeGeometry(0.05, 0.12, 4).rotateZ(-Math.PI / 2).translate(0.06, h + 0.03, 0), base, rib);
    }
    christmasOnly.push(add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }))));
  }

  // --- two reindeer of lights on the lawn ---
  const deer = [];
  const deerLights = []; // (inside their reindeer, so they move with them: not moved to festive.christmas)
  {
    // on open lawn either side of the drive, facing the drive
    const cands = [
      [-7, 6],
      [-9, 2],
      [16, 6],
      [17, 1],
      [-6, 12],
      [15, 12],
    ];
    for (const [x, z] of cands) {
      if (deer.length >= 2) break;
      if (deer.some((d) => Math.abs(d.group.position.x - x) < 8)) continue; // (one each side)
      if (!clear(x, z, 1.6)) continue;
      const r = reindeer(1.05);
      r.group.position.set(x, ground(x, z), z);
      r.group.rotation.y = x < 4.6 ? -0.5 : Math.PI + 0.5;
      eve.add(r.group);
      christmasOnly.push(r.group);
      deer.push({ ...r, grazing: deer.length === 0, ph: Math.random() * 6 });
      deerLights.push(...r.lights);
    }
  }

  // --- New Year's Eve ---
  const nye = new THREE.Group();
  nye.name = 'New Year';
  nye.visible = false;
  festive.christmas.parent.add(nye);
  // (a little light of their own: metal shows nothing but the dark round it at night)
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 0.85, roughness: 0.25, emissive: 0x5a4210, emissiveIntensity: 0.6 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.9, roughness: 0.2, emissive: 0x3c4048, emissiveIntensity: 0.6 });
  const string = new THREE.LineBasicMaterial({ color: 0xd8d4c8, transparent: true, opacity: 0.6 });
  // gold stars where the bows are
  {
    const shape = new THREE.Shape();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
      const r = k % 2 ? 0.07 : 0.17;
      if (k === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }).translate(0, 0, -0.015);
    for (const [p, yaw] of stars) {
      const m = new THREE.Mesh(starGeo, gold);
      m.position.copy(p).setY(p.y - 0.06);
      m.rotation.y = yaw;
      m.castShadow = true;
      nye.add(m);
    }
  }
  // balloons: clusters of gold and silver, on strings, bobbing
  const balloons = [];
  const cluster = (base, n, height = 1.7) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R2(0.5);
      const r = 0.18 + Math.random() * 0.25;
      const top = new THREE.Vector3(base.x + Math.cos(a) * r, base.y + height + Math.random() * 0.5, base.z + Math.sin(a) * r);
      const b = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12).scale(1, 1.18, 1), i % 2 ? silver : gold);
      ball.castShadow = true;
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 6).translate(0, -0.25, 0), i % 2 ? silver : gold);
      b.add(ball, knot);
      b.position.copy(top);
      nye.add(b);
      const geo = new THREE.BufferGeometry().setFromPoints([base.clone(), top.clone().setY(top.y - 0.26)]);
      const line = new THREE.Line(geo, string);
      nye.add(line);
      balloons.push({ b, top, line, base: base.clone(), ph: Math.random() * 6 });
    }
  };
  if (door) {
    const out = door.normal.clone();
    if (out.z < 0) out.negate();
    const side = new THREE.Vector3(out.z, 0, -out.x);
    for (const sd of [-1, 1]) {
      const p = door.centre.clone().addScaledVector(side, sd * 1.95).addScaledVector(out, 2.2);
      p.y = ground(p.x, p.z) + 0.6;
      cluster(p, 6);
    }
    // a mirror ball turning in the porch, high up
    const facets = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const g = c.getContext('2d');
      for (let y = 0; y < 128; y += 8) for (let x = 0; x < 256; x += 8) {
        const v = 120 + Math.random() * 135;
        g.fillStyle = `rgb(${v},${v},${v + 10})`;
        g.fillRect(x, y, 7, 7);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ map: facets, metalness: 1, roughness: 0.12 }));
    ball.position.copy(door.centre).addScaledVector(out, 1.0).setY(door.y0 + 2.75);
    nye.add(ball);
    nye.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([ball.position.clone(), ball.position.clone().setY(ball.position.y + 0.6)]), string));
    nye.userData.mirror = ball;
    // a champagne table by the door: a white cloth, an ice bucket with two bottles, flutes
    const tp = door.centre.clone().addScaledVector(side, -2.9).addScaledVector(out, 3.1);
    const ty = ground(tp.x, tp.z);
    const table = new THREE.Group();
    table.position.set(tp.x, ty, tp.z);
    const cloth = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.85 });
    table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.74, 28, 1, true).translate(0, 0.37, 0), cloth));
    table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 28).translate(0, 0.74, 0), cloth));
    table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.2, 18, 1, true).translate(0.12, 0.85, 0), silver));
    const bottle = new THREE.MeshStandardMaterial({ color: 0x173a22, roughness: 0.25, metalness: 0.2 });
    for (const [x, z, tilt] of [
      [0.1, 0.03, 0.2],
      [0.15, -0.04, -0.15],
    ]) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 12).translate(0, 0.11, 0), bottle));
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.034, 0.1, 12).translate(0, 0.27, 0), bottle));
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.05, 10).translate(0, 0.33, 0), gold));
      b.position.set(x, 0.76, z);
      b.rotation.z = tilt;
      table.add(b);
    }
    const flute = new THREE.LatheGeometry([new THREE.Vector2(0.03, 0), new THREE.Vector2(0.004, 0.005), new THREE.Vector2(0.004, 0.09), new THREE.Vector2(0.02, 0.12), new THREE.Vector2(0.024, 0.2)], 14);
    const glass = new THREE.MeshStandardMaterial({ color: 0xf6efd6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(flute, glass);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(-0.18 + Math.cos(a) * 0.15, 0.75, Math.sin(a) * 0.15);
      table.add(f);
    }
    table.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    nye.add(table);
  }
  if (gate) {
    for (const sd of [-1, 1]) {
      const p = new THREE.Vector3(gate.x + sd * 3.0, 0, gate.z - 1.0);
      p.y = ground(p.x, p.z) + 0.2;
      cluster(p, 5, 2.4);
    }
  }
  // the coming year in marquee letters, lit, on the lawn facing the gate
  let yearSign = null;
  {
    // (the year about to begin, as the fireworks write it: this one in its first week, else the next)
    const now = new Date();
    const year = String(now.getMonth() === 0 && now.getDate() <= 6 ? now.getFullYear() : now.getFullYear() + 1);
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.font = '700 236px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(year, 320, 136);
    const img = g.getImageData(0, 0, 640, 256).data;
    const W = 4.5; // metres across
    const H = (W * 256) / 640;
    const pts = [];
    const step = 9;
    for (let y = 4; y < 256; y += step) {
      for (let x = 4; x < 640; x += step) {
        if (img[(y * 640 + x) * 4 + 3] < 140) continue;
        pts.push({ pos: [(x / 640 - 0.5) * W, (1 - y / 256) * H, 0.06], colour: Math.random() < 0.2 ? [1, 0.95, 0.85] : [1, 0.8, 0.42], phase: Math.random(), along: x / 9 });
      }
    }
    const spot = [-1.9, 7.6]; // (the west lawn, in view from the gate, clear of the drive, the fountain and the tree)
    const sx = spot[0];
    const sz = spot[1];
    const sign = new THREE.Group();
    sign.position.set(sx, ground(sx, sz) + 0.35, sz);
    sign.rotation.y = Math.atan2((gate?.x ?? 4.6) - sx, (gate?.z ?? 20.7) - sz);
    // the letters' backing, dark, in their own shape
    const backTex = new THREE.CanvasTexture(c);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x1b1b1f, alphaMap: backTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }));
    back.position.y = H / 2;
    back.castShadow = true;
    sign.add(back);
    for (const sd of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8).translate(0, -0.1, -0.05), silver);
      post.position.x = sd * W * 0.32;
      sign.add(post);
    }
    const sb = bulbs(pts, 0.07);
    sign.add(sb);
    nye.add(sign);
    yearSign = sb;
  }

  for (const b of lights) {
    festive.christmas.add(b);
    festive.extra.push(b);
  }
  for (const b of deerLights) festive.extra.push(b);
  festive.setScale?.(festive.outline.material.uniforms.uScale.value);
  let t = 0;
  return {
    deer,
    nye,
    /** day: the day of the year (New Year's Eve and Day dress the house for the new year instead) */
    update(dt, day = null) {
      t += dt;
      const d = day == null ? -1 : Math.floor(day);
      const newYear = d === 364 || d === 0;
      for (const o of christmasOnly) o.visible = !newYear;
      if (newYear) for (const w of festive.doorWreaths ?? []) w.visible = false;
      nye.visible = newYear && !!eve.visible && !!festive.christmas.visible;
      if (nye.visible) {
        for (const b of balloons) {
          const sway = new THREE.Vector3(Math.sin(t * 0.9 + b.ph) * 0.08, Math.sin(t * 1.3 + b.ph) * 0.05, Math.cos(t * 0.7 + b.ph) * 0.08);
          b.b.position.copy(b.top).add(sway);
          b.b.rotation.z = Math.sin(t * 0.8 + b.ph) * 0.12;
          const pos = b.line.geometry.attributes.position;
          pos.setXYZ(1, b.b.position.x, b.b.position.y - 0.26, b.b.position.z);
          pos.needsUpdate = true;
        }
        if (nye.userData.mirror) nye.userData.mirror.rotation.y += dt * 0.6;
        if (yearSign) {
          const u = yearSign.material.uniforms;
          u.uOn.value = 1;
          u.uTime.value = t;
          u.uScale.value = festive.outline.material.uniforms.uScale.value;
        }
      }
      for (const d of deer) {
        // one grazing (its head down, now and then lifting), one looking about, nodding
        if (d.grazing) d.head.rotation.z = -0.95 + 0.5 * Math.max(0, Math.sin(t * 0.25 + d.ph)) ** 3;
        else d.head.rotation.z = 0.12 * Math.sin(t * 0.6 + d.ph);
      }
    },
  };
}
