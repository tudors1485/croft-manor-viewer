// Walking with collision: a capsule body against a BVH of the whole estate.
// Based on the character movement approach from three-mesh-bvh's examples, with
// a step-up probe for stairs and a snap-down so you don't bounce walking down them.

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/worker';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/** Merges the given meshes (world space, positions only) into one indexed geometry. */
export function mergeForCollision(meshes) {
  let vCount = 0;
  let iCount = 0;
  for (const m of meshes) {
    const g = m.geometry;
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  const v = new THREE.Vector3();
  const parts = []; // which vertices came from which mesh, for telling surfaces apart later
  let vo = 0;
  let io = 0;
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    parts.push({ start: vo, count: m.geometry.attributes.position.count, mesh: m });
    const g = m.geometry;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      pos[(vo + i) * 3] = v.x;
      pos[(vo + i) * 3 + 1] = v.y;
      pos[(vo + i) * 3 + 2] = v.z;
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.userData.parts = parts;
  return geo;
}

/** The mesh a collision triangle came from (the tree reorders triangles, not vertices). */
export function meshAtFace(geo, faceIndex) {
  const v = geo.index.getX(faceIndex * 3);
  const parts = geo.userData.parts;
  let lo = 0;
  let hi = parts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (parts[mid].start <= v) lo = mid;
    else hi = mid - 1;
  }
  return parts[lo]?.mesh ?? null;
}

const _ray = new THREE.Ray();
const _dir = new THREE.Vector3();
const _rest = new THREE.Vector3();
const _n = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _push = new THREE.Vector3();
const _sphere = new THREE.Sphere();

/** The nearest surface along a ray, skipping triangles `skip` lets through. */
export function firstHit(bvh, origin, dir, far, skip) {
  _ray.origin.copy(origin);
  _ray.direction.copy(dir);
  if (!skip) return bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
  let best = null;
  for (const h of bvh.raycast(_ray, THREE.DoubleSide, 0, far)) {
    if (skip(h.faceIndex)) continue;
    if (!best || h.distance < best.distance) best = h;
  }
  return best;
}

/**
 * Moves a sphere (a flying camera) from `from` towards `to` without passing through
 * surfaces: it stops at a wall and slides along it. Changes `to` in place.
 */
export function moveSphere(bvh, from, to, radius, skip) {
  const start = from.clone();
  for (let i = 0; i < 3; i++) {
    _dir.subVectors(to, start);
    const len = _dir.length();
    if (len < 1e-6) break;
    _dir.divideScalar(len);
    const hit = firstHit(bvh, start, _dir, len + radius, skip);
    if (!hit) break;
    _n.copy(hit.face.normal);
    if (_n.dot(_dir) > 0) _n.negate();
    const stop = Math.max(0, hit.distance - radius);
    _rest.subVectors(to, start).addScaledVector(_dir, -stop);
    _rest.addScaledVector(_n, -_rest.dot(_n));
    start.addScaledVector(_dir, stop);
    to.copy(start).add(_rest);
  }
  // and out of anything closer than the radius
  _sphere.set(to, radius);
  bvh.shapecast({
    intersectsBounds: (b) => b.intersectsSphere(_sphere),
    intersectsTriangle: (tri, t) => {
      if (skip && skip(t)) return;
      tri.closestPointToPoint(_sphere.center, _closest);
      const d = _closest.distanceTo(_sphere.center);
      if (d < radius && d > 1e-6) {
        _push.subVectors(_sphere.center, _closest).multiplyScalar((radius - d) / d);
        _sphere.center.add(_push);
      }
    },
  });
  to.copy(_sphere.center);
  return to;
}

/** Builds the BVH in a worker when it can, so the page keeps drawing meanwhile. */
export async function buildCollider(meshes) {
  const geo = mergeForCollision(meshes);
  try {
    const worker = new GenerateMeshBVHWorker();
    geo.boundsTree = await worker.generate(geo, { targetLeafSize: 12 });
    worker.dispose();
  } catch (err) {
    console.warn('BVH worker failed, building on the main thread', err);
    geo.boundsTree = new MeshBVH(geo, { targetLeafSize: 12 });
  }
  return geo;
}

export class Walker {
  constructor(camera, colliderGeometry) {
    this.camera = camera;
    this.bvh = colliderGeometry.boundsTree;
    this.radius = 0.28;
    this.height = 1.8; // capsule, feet to crown
    this.eye = 1.62; // feet to eyes
    this.stepMax = 0.36;
    this.gravity = -17;
    this.jumpSpeed = 4.6;
    this.walkSpeed = 3.0;
    this.runSpeed = 6.5;

    this.feet = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.camY = 0;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.lastStepPhase = 0;
    this.onFootstep = null; // callback(speed)
    this.obstacles = []; // tree trunks: { x, z, r }
    this.skipTriangle = null; // (triangleIndex) => true for surfaces you can pass (open doors)
    this.ghost = false; // through walls: only floors and ceilings hold you
    this._triN = new THREE.Vector3();

    this._seg = new THREE.Line3();
    this._box = new THREE.Box3();
    this._triPoint = new THREE.Vector3();
    this._capPoint = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._tmp = new THREE.Vector3();
  }

  /** Floor height under a point, or null. */
  floorBelow(point, maxDrop = 60) {
    this._ray.origin.copy(point);
    this._ray.direction.copy(DOWN);
    const hit = this.bvh.raycastFirst(this._ray, THREE.DoubleSide, 0, maxDrop);
    return hit ? hit.point.y : null;
  }

  /** Puts the walker's eyes near `eyePos`, standing on whatever floor is below it. */
  placeAt(eyePos, lookAt) {
    const probe = eyePos.clone();
    probe.y += 0.3;
    const floor = this.floorBelow(probe, 60);
    this.feet.set(eyePos.x, floor ?? eyePos.y - this.eye, eyePos.z);
    this.feet.y += 0.02;
    this.vel.set(0, 0, 0);
    this.onGround = floor !== null;
    this.camY = this.feet.y + this.eye;
    this.camera.position.set(this.feet.x, this.camY, this.feet.z);
    if (lookAt) {
      const t = lookAt.clone();
      t.y = Math.max(t.y, this.camY - 3);
      this.camera.lookAt(t);
    }
  }

  /** How high the eyes are above the floor under them (for deciding whether to drop in). */
  heightAboveFloor(eyePos) {
    const floor = this.floorBelow(eyePos.clone().add(new THREE.Vector3(0, 0.2, 0)), 200);
    return floor === null ? Infinity : eyePos.y - floor;
  }

  _resolve() {
    const r = this.radius;
    const seg = this._seg;
    seg.start.set(this.feet.x, this.feet.y + r, this.feet.z);
    seg.end.set(this.feet.x, this.feet.y + this.height - r, this.feet.z);
    const box = this._box.makeEmpty();
    box.expandByPoint(seg.start).expandByPoint(seg.end);
    box.min.addScalar(-r);
    box.max.addScalar(r);
    const triPoint = this._triPoint;
    const capPoint = this._capPoint;
    this.bvh.shapecast({
      intersectsBounds: (b) => b.intersectsBox(box),
      intersectsTriangle: (tri, triIndex) => {
        if (this.skipTriangle && this.skipTriangle(triIndex)) return;
        if (this.ghost && Math.abs(tri.getNormal(this._triN).y) < 0.6) return;
        const d = tri.closestPointToSegment(seg, triPoint, capPoint);
        if (d < r) {
          const depth = r - d;
          const dir = capPoint.sub(triPoint);
          if (d < 1e-6) tri.getNormal(dir);
          else dir.normalize();
          seg.start.addScaledVector(dir, depth);
          seg.end.addScaledVector(dir, depth);
        }
      },
    });
    return this._tmp.set(seg.start.x, seg.start.y - r, seg.start.z).sub(this.feet);
  }

  /**
   * @param {number} dt seconds
   * @param {{forward:number, right:number, jump:boolean, run:boolean}} input
   */
  update(dt, input) {
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const want = new THREE.Vector3().addScaledVector(fwd, input.forward).addScaledVector(right, input.right);
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(input.run ? this.runSpeed : this.walkSpeed);

    // horizontal velocity eases towards what the keys ask for (less control in the air)
    const accel = this.onGround ? 14 : 2.5;
    const k = 1 - Math.exp(-dt * accel);
    this.vel.x += (want.x - this.vel.x) * k;
    this.vel.z += (want.z - this.vel.z) * k;

    if (input.jump && this.onGround) {
      this.vel.y = this.jumpSpeed;
      this.onGround = false;
    }

    // through walls, over rooms that were never built: hold your height rather than fall
    const hover = this.ghost && this.floorBelow(this._tmp.copy(this.feet).setY(this.feet.y + 0.3), 3) === null;
    if (hover) this.vel.y = Math.max(this.vel.y, 0);

    const steps = 5;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      const wasGround = this.onGround;
      if (hover) {
        if (this.vel.y > 0) this.vel.y += this.gravity * h; // a jump still comes back down to here
        if (this.vel.y < 0) this.vel.y = 0;
        this.onGround = true;
      } else if (this.onGround && this.vel.y <= 0) this.vel.y = this.gravity * h;
      else this.vel.y += this.gravity * h;
      this.feet.addScaledVector(this.vel, h);

      // stairs: if something low is just ahead, step onto it
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (wasGround && hs > 0.2) {
        const dir = this._tmp.set(this.vel.x / hs, 0, this.vel.z / hs);
        const probe = new THREE.Vector3(
          this.feet.x + dir.x * (this.radius + 0.12),
          this.feet.y + this.stepMax + 0.05,
          this.feet.z + dir.z * (this.radius + 0.12),
        );
        this._ray.origin.copy(probe);
        this._ray.direction.copy(DOWN);
        const hit = this.bvh.raycastFirst(this._ray, THREE.DoubleSide, 0, this.stepMax + 0.05);
        if (hit && Math.abs(hit.face.normal.y) > 0.7) {
          const rise = hit.point.y - this.feet.y;
          if (rise > 0.02 && rise <= this.stepMax) {
            // headroom over the step
            this._ray.origin.set(probe.x, hit.point.y + 0.05, probe.z);
            this._ray.direction.copy(UP);
            const ceil = this.bvh.raycastFirst(this._ray, THREE.DoubleSide, 0, this.height);
            if (!ceil) this.feet.y += rise + 0.005;
          }
        }
      }

      const delta = this._resolve();
      this.onGround = delta.y > Math.abs(h * this.vel.y * 0.25);
      const len = delta.length();
      if (len > 1e-5) {
        const push = delta.clone().multiplyScalar(Math.max(0, len - 1e-5) / len);
        this.feet.add(push);
        if (!this.onGround) {
          push.normalize();
          const into = push.dot(this.vel);
          if (into < 0) this.vel.addScaledVector(push, -into);
        } else {
          this.vel.y = 0;
        }
      }

      // tree trunks
      for (const o of this.obstacles) {
        const dx = this.feet.x - o.x;
        const dz = this.feet.z - o.z;
        const min = o.r + this.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && this.feet.y < 8) {
          const d = Math.sqrt(d2) || 1e-4;
          this.feet.x = o.x + (dx / d) * min;
          this.feet.z = o.z + (dz / d) * min;
        }
      }

      // walking down stairs or a slope: stay on it rather than skipping into the air
      if (wasGround && !this.onGround && this.vel.y <= 0) {
        this._ray.origin.set(this.feet.x, this.feet.y + 0.05, this.feet.z);
        this._ray.direction.copy(DOWN);
        const hit = this.bvh.raycastFirst(this._ray, THREE.DoubleSide, 0, this.stepMax + 0.05);
        if (hit && Math.abs(hit.face.normal.y) > 0.7) {
          this.feet.y = hit.point.y + 0.005;
          this.onGround = true;
          this.vel.y = 0;
        }
      }
    }

    if (this.feet.y < -40) return 'fell';

    // camera: smooth out steps, add a little head bob
    const eyeY = this.feet.y + this.eye;
    if (Math.abs(eyeY - this.camY) > 0.8) this.camY = eyeY;
    else this.camY += (eyeY - this.camY) * (1 - Math.exp(-dt * 16));
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const target = this.onGround ? Math.min(1, speed / this.walkSpeed) : 0;
    this.bobAmount += (target - this.bobAmount) * (1 - Math.exp(-dt * 8));
    this.bobPhase += dt * (4.2 + speed * 1.1);
    const bob = Math.sin(this.bobPhase * 2) * 0.03 * this.bobAmount;
    if (this.onFootstep && this.bobAmount > 0.3) {
      const stepIndex = Math.floor((this.bobPhase * 2) / Math.PI);
      if (stepIndex !== this.lastStepPhase) {
        this.lastStepPhase = stepIndex;
        this.onFootstep(speed);
      }
    }
    this.camera.position.set(this.feet.x, this.camY + bob, this.feet.z);
    return null;
  }
}
