// The doors. Every door in the model is a flat painted panel (or two, back to back).
// A door is usable when there is a real room on both sides of it: floor to stand on,
// headroom, and nothing right behind it. The usable ones (the front door and the
// kitchen's garden door) become hinged leaves that swing open as you come up to them;
// the rest are painted onto walls or open onto rooms that were never built, so they stay
// shut and block you like a wall.

import * as THREE from 'three';
import { meshAtFace } from './walk.js';

const DOOR = /door/i;
const OPEN_ANGLE = THREE.MathUtils.degToRad(94);

/** Connected pieces of a mesh: their triangles (by index) and world-space bounds. */
function piecesOf(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index;
  const n = pos.count;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  };
  const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const triCount = (idx ? idx.count : n) / 3;
  for (let t = 0; t < triCount; t++) {
    union(vi(t, 0), vi(t, 1));
    union(vi(t, 0), vi(t, 2));
  }
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 200)},${Math.round(pos.getY(i) * 200)},${Math.round(pos.getZ(i) * 200)}`;
    if (seen.has(k)) union(i, seen.get(k));
    else seen.set(k, i);
  }
  mesh.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  const pieces = new Map();
  for (let t = 0; t < triCount; t++) {
    const r = find(vi(t, 0));
    let p = pieces.get(r);
    if (!p) pieces.set(r, (p = { mesh, tris: [], box: new THREE.Box3() }));
    p.tris.push(t);
    for (let k = 0; k < 3; k++) p.box.expandByPoint(v.fromBufferAttribute(pos, vi(t, k)).applyMatrix4(mesh.matrixWorld));
  }
  return [...pieces.values()];
}

const span = (b, axis) => [b.min[axis], b.max[axis]];
function overlap([a0, a1], [b0, b1]) {
  const o = Math.min(a1, b1) - Math.max(a0, b0);
  return o / Math.max(1e-6, Math.min(a1 - a0, b1 - b0));
}

/** Door panels in the model, with back-to-back panels joined into one door. */
function findDoors(model) {
  const panels = [];
  model.traverse((o) => {
    if (!o.isMesh || !DOOR.test(o.material.name || '')) return;
    for (const p of piecesOf(o)) {
      const s = p.box.getSize(new THREE.Vector3());
      if (s.y < 1.2 || Math.max(s.x, s.z) < 0.5 || Math.min(s.x, s.z) > 0.08) continue;
      p.axis = s.x < s.z ? 'x' : 'z'; // the axis the door faces along
      panels.push(p);
    }
  });
  const doors = [];
  for (const p of panels) {
    const wide = p.axis === 'x' ? 'z' : 'x';
    const d = doors.find(
      (d) =>
        d.axis === p.axis &&
        Math.abs(d.box.getCenter(new THREE.Vector3())[p.axis] - p.box.getCenter(new THREE.Vector3())[p.axis]) < 0.2 &&
        overlap(span(d.box, wide), span(p.box, wide)) > 0.7 &&
        overlap(span(d.box, 'y'), span(p.box, 'y')) > 0.7,
    );
    if (d) {
      d.pieces.push(p);
      d.box.union(p.box);
    } else doors.push({ axis: p.axis, wide, pieces: [p], box: p.box.clone() });
  }
  for (const d of doors) {
    d.centre = d.box.getCenter(new THREE.Vector3());
    d.y0 = d.box.min.y;
    d.y1 = d.box.max.y;
    d.width = d.box.max[d.wide] - d.box.min[d.wide];
    d.normal = new THREE.Vector3().setComponent(d.axis === 'x' ? 0 : 2, 1);
  }
  return doors;
}

/** Ray queries against the collision tree that ignore the doors themselves. */
function makeProbe(geo) {
  const bvh = geo.boundsTree;
  const ray = new THREE.Ray();
  const isDoor = (faceIndex) => DOOR.test(meshAtFace(geo, faceIndex)?.material.name || '');
  return (origin, dir, far) => {
    ray.origin.copy(origin);
    ray.direction.copy(dir);
    let best = null;
    for (const h of bvh.raycast(ray, THREE.DoubleSide, 0, far)) {
      if (isDoor(h.faceIndex)) continue;
      if (!best || h.distance < best.distance) best = h;
    }
    if (best) best.material = meshAtFace(geo, best.faceIndex)?.material.name || '';
    return best;
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/** How far you could walk out from the door on one side (metres, up to 1.5). */
function walkableFrom(probe, door, sign) {
  const n = door.normal.clone().multiplyScalar(sign);
  const at = (d, y) => new THREE.Vector3(door.centre.x, y, door.centre.z).addScaledVector(n, d);
  let floor = door.y0;
  let walked = 0;
  for (let d = 0.3; d <= 1.51; d += 0.3) {
    // nothing in the way at knee or head height for the next stretch
    if (probe(at(d - 0.3, floor + 0.5), n, 0.3) || probe(at(d - 0.3, floor + 1.6), n, 0.3)) break;
    // a floor close to the last one; the top of a ceiling (a room that was never built) doesn't count
    const f = probe(at(d, floor + 0.45), DOWN, 0.9);
    if (!f || /ceiling/i.test(f.material) || Math.abs(f.point.y - floor) > 0.4) break;
    // and headroom
    if (probe(at(d, f.point.y + 0.1), UP, 1.8)) break;
    floor = f.point.y;
    walked = d;
  }
  return walked;
}

function vertex(mesh, nm, t, k) {
  const g = mesh.geometry;
  const i = g.index ? g.index.getX(t * 3 + k) : t * 3 + k;
  return {
    p: new THREE.Vector3().fromBufferAttribute(g.attributes.position, i).applyMatrix4(mesh.matrixWorld),
    n: g.attributes.normal ? new THREE.Vector3().fromBufferAttribute(g.attributes.normal, i).applyMatrix3(nm).normalize() : new THREE.Vector3(),
    uv: g.attributes.uv ? new THREE.Vector2().fromBufferAttribute(g.attributes.uv, i) : new THREE.Vector2(),
  };
}

const lerpVertex = (a, b, t) => ({ p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), uv: a.uv.clone().lerp(b.uv, t) });

/** Keeps the part of a polygon on one side of the plane `axis = value`. */
function clip(poly, axis, value, keepAbove) {
  const out = [];
  const s = keepAbove ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a.p[axis] - value) * s;
    const db = (b.p[axis] - value) * s;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) out.push(lerpVertex(a, b, da / (da - db)));
  }
  return out;
}

/** One swinging leaf: the door's triangles between `lo` and `hi` along its width, hinged at `hingeAt`. */
function makeLeaf(door, lo, hi, hingeAt) {
  const pivot = new THREE.Group();
  pivot.name = 'Door leaf';
  const hinge = door.centre.clone().setY(0);
  hinge[door.wide] = hingeAt;
  pivot.position.copy(hinge);
  const byMaterial = new Map();
  for (const piece of door.pieces) {
    const nm = new THREE.Matrix3().getNormalMatrix(piece.mesh.matrixWorld);
    for (const t of piece.tris) {
      let poly = [0, 1, 2].map((k) => vertex(piece.mesh, nm, t, k));
      poly = clip(clip(poly, door.wide, lo, true), door.wide, hi, false);
      if (poly.length < 3) continue;
      const list = byMaterial.get(piece.mesh.material) ?? [];
      byMaterial.set(piece.mesh.material, list);
      for (let i = 1; i < poly.length - 1; i++) list.push(poly[0], poly[i], poly[i + 1]);
    }
  }
  for (const [material, verts] of byMaterial) {
    const pos = new Float32Array(verts.length * 3);
    const nor = new Float32Array(verts.length * 3);
    const uv = new Float32Array(verts.length * 2);
    verts.forEach((v, i) => {
      pos.set([v.p.x - hinge.x, v.p.y - hinge.y, v.p.z - hinge.z], i * 3);
      nor.set([v.n.x, v.n.y, v.n.z], i * 3);
      uv.set([v.uv.x, v.uv.y], i * 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
  }
  // panels back to back: fill the gap between them so the edge looks solid when it swings
  const thick = door.box.max[door.axis] - door.box.min[door.axis];
  if (thick > 0.02) {
    const size = new THREE.Vector3();
    size[door.axis] = thick - 0.006;
    size[door.wide] = hi - lo - 0.006;
    size.y = door.y1 - door.y0 - 0.006;
    const core = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), coreMaterial());
    core.position.copy(door.centre).sub(hinge);
    core.position[door.wide] = (lo + hi) / 2 - hinge[door.wide];
    core.castShadow = true;
    core.receiveShadow = true;
    pivot.add(core);
  }
  // which way along the width the free edge lies, seen from the hinge
  return { pivot, freeDir: Math.sign((lo + hi) / 2 - hingeAt), sign: 1 };
}

let _core = null;
const coreMaterial = () => (_core ??= new THREE.MeshStandardMaterial({ color: 0x3b2817, roughness: 0.8, metalness: 0 }));

/** Takes the given triangles out of a mesh (the swinging leaves replace them). */
function removeTriangles(mesh, tris) {
  const drop = new Set(tris);
  const g = mesh.geometry.clone();
  const idx = g.index;
  const keep = [];
  const count = (idx ? idx.count : g.attributes.position.count) / 3;
  for (let t = 0; t < count; t++) {
    if (drop.has(t)) continue;
    for (let k = 0; k < 3; k++) keep.push(idx ? idx.getX(t * 3 + k) : t * 3 + k);
  }
  g.setIndex(keep);
  mesh.geometry = g;
}

export class Doors {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} model
   * @param {THREE.BufferGeometry} collider the merged collision geometry, with its boundsTree
   */
  constructor(scene, model, collider) {
    this.collider = collider;
    this.all = findDoors(model);
    const probe = makeProbe(collider);
    this.usable = [];
    for (const d of this.all) {
      d.reach = [walkableFrom(probe, d, 1), walkableFrom(probe, d, -1)];
      if (Math.min(...d.reach) >= 1.2) this.usable.push(d);
    }
    this.onSound = null; // (opening: boolean, door) => void

    const pending = new Map(); // mesh -> triangles to take out
    for (const d of this.usable) {
      // an outside door swings into the house: the side with open sky above is outside
      const sky = [1, -1].map((s) => !probe(d.centre.clone().setY(d.y0 + 2.5).addScaledVector(d.normal, s * 1.2), UP, 40));
      d.inside = sky[0] && !sky[1] ? -1 : sky[1] && !sky[0] ? 1 : 0;
      const lo = d.box.min[d.wide];
      const hi = d.box.max[d.wide];
      const mid = (lo + hi) / 2;
      // a wide doorway is a pair of doors, each hinged at its outer edge
      d.leaves = d.width > 1.5 ? [makeLeaf(d, lo, mid, lo), makeLeaf(d, mid, hi, hi)] : [makeLeaf(d, lo, hi, lo)];
      for (const leaf of d.leaves) scene.add(leaf.pivot);
      d.open = 0;
      d.want = 0;
      d.side = 0;
      for (const p of d.pieces) pending.set(p.mesh, [...(pending.get(p.mesh) ?? []), ...p.tris]);
    }
    for (const [mesh, tris] of pending) removeTriangles(mesh, tris);

    // which collision triangles belong to which usable door (they let you through once it opens)
    const pos = collider.attributes.position;
    const doorOfVertex = new Uint8Array(pos.count);
    const v = new THREE.Vector3();
    const boxes = this.usable.map((d) => d.box.clone().expandByScalar(0.02));
    for (const part of collider.userData.parts) {
      if (!DOOR.test(part.mesh.material?.name || '')) continue;
      for (let i = part.start; i < part.start + part.count; i++) {
        v.fromBufferAttribute(pos, i);
        const k = boxes.findIndex((b) => b.containsPoint(v));
        if (k >= 0) doorOfVertex[i] = k + 1;
      }
    }
    const index = collider.index;
    this.triDoor = new Uint8Array(index.count / 3);
    for (let t = 0; t < this.triDoor.length; t++) this.triDoor[t] = doorOfVertex[index.getX(t * 3)];
    this._last = new THREE.Vector3();
    this._first = true;
  }

  get summary() {
    return `${this.usable.length} open, ${this.all.length - this.usable.length} stay shut`;
  }

  /** For collision: may you pass through this triangle of the collision tree? */
  passable(triangleIndex) {
    const k = this.triDoor[triangleIndex];
    return k > 0 && this.usable[k - 1].open > 0.45;
  }

  update(camera, dt) {
    const p = camera.position;
    const speed = this._first ? 0 : Math.min(20, p.distanceTo(this._last) / Math.max(dt, 1e-3));
    this._first = false;
    this._last.copy(p);
    for (const d of this.usable) {
      const dist = Math.hypot(p.x - d.centre.x, p.z - d.centre.z);
      const level = p.y > d.y0 - 1 && p.y < d.y1 + 2.5;
      // open ahead of you (further ahead when you are moving fast), close once you are well away
      const lead = Math.min(4, speed * 0.55);
      if (level && dist < 2.3 + lead) d.want = 1;
      else if (!level || dist > 3.8 + lead) d.want = 0;
      if (d.want && d.open < 0.02) {
        // outside doors swing into the house; inside ones swing away from you
        const mine = Math.sign((p.x - d.centre.x) * d.normal.x + (p.z - d.centre.z) * d.normal.z) || 1;
        d.side = d.inside || -mine;
        for (const leaf of d.leaves) {
          // rotating +90° about y turns the free edge's direction (along the width) into the normal: x -> -z, z -> x
          const along = d.wide === 'z' ? leaf.freeDir : -leaf.freeDir;
          leaf.sign = d.side * along;
        }
      }
      const before = d.open;
      const rate = d.want ? 1.5 : 1.1;
      d.open = THREE.MathUtils.clamp(d.open + Math.sign(d.want - d.open) * rate * dt, 0, 1);
      if (before === 0 && d.open > 0) this.onSound?.(true, d, dist);
      if (before > 0 && d.open === 0) this.onSound?.(false, d, dist);
      const k = d.open * d.open * (3 - 2 * d.open);
      for (const leaf of d.leaves) leaf.pivot.rotation.y = k * OPEN_ANGLE * leaf.sign;
    }
  }
}
