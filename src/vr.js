// Walking the manor in a VR headset (WebXR). The Enter VR button only appears when the browser
// says a headset is there. You stand where you were, facing the same way, at your own height.
//
// Comfortable movement: the left stick walks you at an easy pace the way you are looking (no
// sudden starts: it eases in and out), walls stop you and you follow the floor and the stairs;
// the right stick turns you in steps of 30° (smooth turning is what makes most people queasy).
// Or pull either trigger for a hop of a couple of metres forward, all at once (no motion to see).
//
// How it moves you: the headset's position is given relative to a reference space, and moving
// you means offsetting that space (so the camera's position is the world position of your head,
// and everything that follows the camera, the doors, the sound, the lights, still works).

import * as THREE from 'three';

const SPEED = 1.3; // metres a second, an easy walk
const TURN = Math.PI / 6; // a snap turn, 30°
const HOP = 2.5; // a trigger hop, metres

export class VR {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.PerspectiveCamera} camera
   * @param {object} o
   * @param {() => object} o.bvh the collision tree (once it's ready)
   * @param {(origin: THREE.Vector3, dir: THREE.Vector3, far: number) => object|null} o.hit the first surface along a ray
   * @param {(from: THREE.Vector3, to: THREE.Vector3, radius: number) => void} o.slide moves `to` back out of walls
   */
  constructor(renderer, camera, { hit, slide }) {
    this.renderer = renderer;
    this.camera = camera;
    this.hit = hit;
    this.slide = slide;
    this.session = null;
    this.base = null; // the session's own floor-level reference space
    this.pos = new THREE.Vector3(); // where your floor is, in the world (the space's origin)
    this.yaw = 0; // which way the space is turned
    this.vel = new THREE.Vector2();
    this._turned = 0;
    this._hopped = false;
    this.onEnd = null;
    this.supported = false;
  }

  /** Asks the browser whether a headset is there (the button stays hidden until it says yes). */
  async check() {
    try {
      this.supported = !!(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')));
    } catch {
      this.supported = false;
    }
    return this.supported;
  }

  get presenting() {
    return !!this.session;
  }

  /** Into the headset, standing at `feet` facing `yaw` (radians, 0 = towards -z). */
  async enter(feet, yaw) {
    if (!navigator.xr) return;
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.renderer.xr.setFramebufferScaleFactor(0.9);
    await this.renderer.xr.setSession(session);
    this.session = session;
    this.base = this.renderer.xr.getReferenceSpace();
    this.pos.copy(feet);
    this.yaw = yaw;
    this._apply();
    session.addEventListener('end', () => {
      this.session = null;
      this.renderer.xr.enabled = false;
      this.onEnd?.();
    });
  }

  exit() {
    this.session?.end();
  }

  /** The offset that puts your floor at `pos`, turned by `yaw` (see the note at the top). */
  transform() {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
    const p = this.pos.clone().applyQuaternion(q).negate();
    return { position: { x: p.x, y: p.y, z: p.z, w: 1 }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w } };
  }

  _apply() {
    if (!this.base || typeof XRRigidTransform === 'undefined') return;
    const t = this.transform();
    this.renderer.xr.setReferenceSpace(this.base.getOffsetReferenceSpace(new XRRigidTransform(t.position, t.orientation)));
  }

  /** The sticks and triggers of both controllers. */
  _input() {
    const out = { x: 0, y: 0, turn: 0, hop: false };
    for (const src of this.session?.inputSources ?? []) {
      const g = src.gamepad;
      if (!g) continue;
      // (xr-standard mapping: the thumbstick is axes 2 and 3, the trigger button 0)
      const ax = g.axes.length >= 4 ? g.axes[2] : (g.axes[0] ?? 0);
      const ay = g.axes.length >= 4 ? g.axes[3] : (g.axes[1] ?? 0);
      if (src.handedness === 'right') out.turn = ax;
      else {
        out.x = ax;
        out.y = ay;
      }
      if (g.buttons[0]?.pressed) out.hop = true;
    }
    return out;
  }

  /** One frame: walk, turn, hop; then follow the floor. */
  update(dt) {
    if (!this.session) return;
    const input = this._input();
    // which way you are looking, level
    const head = this.camera.position.clone();
    const fwd = this.camera.getWorldDirection(new THREE.Vector3()).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    // walking, eased (a dead zone so a resting thumb doesn't drift)
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const want = new THREE.Vector2(dz(input.x), -dz(input.y)).multiplyScalar(SPEED);
    this.vel.lerp(want, 1 - Math.exp(-dt * 6));
    let move = fwd.clone().multiplyScalar(this.vel.y).addScaledVector(right, this.vel.x).multiplyScalar(dt);
    // a hop: a short step forward in one go
    if (input.hop && !this._hopped) move.addScaledVector(fwd, HOP);
    this._hopped = input.hop;
    this.move(head, move);
    // snap turns: one each time the stick is pushed over
    const turn = Math.abs(input.turn) > 0.7 ? Math.sign(input.turn) : 0;
    if (turn && turn !== this._turned) this.turn(-turn, head);
    this._turned = turn;
  }

  /** Moves you by `move` (world metres, level) from your head at `head`, stopped by walls, onto the floor there. */
  move(head, move) {
    const at = head.clone();
    if (move.lengthSq() > 1e-10) {
      const to = head.clone().add(move);
      this.slide(head, to, 0.25);
      this.pos.x += to.x - head.x;
      this.pos.z += to.z - head.z;
      at.set(to.x, head.y, to.z);
    }
    // the floor under your head where you are now (stairs, the steps, the lawn); a big drop eases down
    const below = this.hit(new THREE.Vector3(at.x, at.y + 0.1, at.z), new THREE.Vector3(0, -1, 0), 4);
    if (below) {
      const floor = below.point.y;
      this.pos.y += (floor - this.pos.y) * (Math.abs(floor - this.pos.y) > 0.6 ? 0.25 : 1);
    }
    this._apply();
  }

  /** Turns you by `sign` × 30° about your head (so you stay where you are). */
  turn(sign, head = this.camera.position) {
    const a = sign * TURN;
    const off = new THREE.Vector3(this.pos.x - head.x, 0, this.pos.z - head.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    this.pos.x = head.x + off.x;
    this.pos.z = head.z + off.z;
    this.yaw += a;
    this._apply();
  }
}
