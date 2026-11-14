// People about the house in the scenes that need them: the builder's surveyor with his plans and the
// couple he shows round the house going up (building.js), and someone trespassing to explore the
// empty house in Fifty, A hundred and Two hundred years empty (abandoned.js, century.js, ruin.js).
//
// They are Quaternius's CC0 characters (Ultimate Modular Men and Women packs, public/models/people/),
// all on one rig with its Idle and Walk: "Business Man" in the coat and breeches of the late
// eighteenth century, with a top hat and coat tails; "Formal" (the woman) in a gown to the ground and
// a bonnet; "Hoodie" as he comes, with a backpack and his phone. The period clothes, the hats and what
// they carry are drawn here and fixed to their bones, and their arms are posed in code over the clips:
// holding the plans open, pointing at the house, holding up a phone for a photo.
//
// Each walks a route (a loop of points), stopping at some to look, point or take a picture, facing
// what they look at. Followers keep a little way behind a leader on the same route and stop with him.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const cache = new Map();

function load(url) {
  if (!cache.has(url)) cache.set(url, new GLTFLoader().loadAsync(url));
  return cache.get(url);
}

/** Paper: a sheet of plans, pale, with the house's elevation and plan drawn in brown ink. */
function plansPicture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 180;
  const g = c.getContext('2d');
  g.fillStyle = '#e8dcc0';
  g.fillRect(0, 0, 256, 180);
  g.strokeStyle = '#5a3a1e';
  g.lineWidth = 2;
  g.strokeRect(10, 10, 236, 160);
  g.lineWidth = 1.5;
  // the front: battlements, the porch, windows
  g.beginPath();
  g.moveTo(24, 80);
  for (let x = 24; x < 232; x += 12) g.lineTo(x, 80), g.lineTo(x, 74), g.lineTo(x + 6, 74), g.lineTo(x + 6, 80);
  g.lineTo(232, 80);
  g.stroke();
  g.strokeRect(24, 80, 208, 46);
  g.strokeRect(112, 66, 32, 60);
  for (const x of [36, 60, 84, 160, 184, 208]) g.strokeRect(x, 90, 12, 20);
  // and the plan below
  g.strokeRect(24, 136, 208, 26);
  for (const x of [70, 112, 144, 186]) {
    g.beginPath();
    g.moveTo(x, 136);
    g.lineTo(x, 162);
    g.stroke();
  }
  g.fillStyle = '#5a3a1e';
  g.font = 'italic 11px Georgia, serif';
  g.fillText('Elevation to the South', 72, 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MATS = {};
function mat(key, make) {
  return (MATS[key] ??= make());
}

/** A top hat: a slightly flared crown, a band and a curled brim. */
function topHat(colour = 0x141210) {
  const g = new THREE.Group();
  const felt = mat(`felt-${colour}`, () => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, metalness: 0.05 }));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.088, 0.19, 18), felt);
  crown.position.y = 0.1;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 18), mat('band', () => new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5 })));
  band.position.y = 0.025;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.012, 22), felt);
  brim.scale.set(1, 1, 0.85);
  g.add(crown, band, brim);
  return g;
}

/** A bonnet: a straw poke bonnet over the crown and the back of the head, its brim framing the face, a ribbon. */
function bonnet() {
  const g = new THREE.Group();
  const straw = mat('straw', () => new THREE.MeshStandardMaterial({ color: 0xd9c38e, roughness: 0.85, side: THREE.DoubleSide }));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), straw);
  cap.scale.set(1, 0.92, 1.15);
  cap.position.set(0, -0.02, -0.035);
  // the brim: the upper half of a ring round the face, tipped back
  const brim = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.19, 20, 1, -0.15, Math.PI + 0.3), straw);
  brim.position.set(0, -0.045, 0.075);
  brim.rotation.x = -0.35;
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.012, 6, 20), mat('ribbon', () => new THREE.MeshStandardMaterial({ color: 0x6a8fb8, roughness: 0.5 })));
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.set(0, -0.06, -0.03);
  g.add(cap, brim, ribbon);
  return g;
}

/** A gown's skirt to the ground: a bell, open at the hem. */
function skirt(colour, waist, height) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // (narrow at the waist, falling straight, then out to a full hem)
    pts.push(new THREE.Vector2(waist + (0.4 - waist) * Math.pow(t, 0.6) + 0.015 * Math.sin(t * 9), height * (1 - t)));
  }
  const g = new THREE.LatheGeometry(pts, 24);
  // (fuller behind than in front)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) p.setZ(i, p.getZ(i) * 1.18);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(`gown-${colour}`, () => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.75, side: THREE.DoubleSide })));
  return m;
}

/** A coat's tails: two panels hanging behind from the waist to the back of the knee. */
function coatTails(colour, len) {
  const g = new THREE.Group();
  const cloth = mat(`coat-${colour}`, () => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8, side: THREE.DoubleSide }));
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.13 * s, 0);
    shape.lineTo(0.09 * s, -len);
    shape.lineTo(0.015 * s, -len * 0.96);
    shape.closePath();
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape), cloth);
    panel.rotation.x = 0.12; // (hanging a little away from the legs)
    g.add(panel);
  }
  return g;
}

// how each person is dressed: the model, its materials' new colours, what is added
const LOOKS = {
  surveyor: { url: 'models/people/gentleman.glb', scale: 0.97, colours: { Suit: 0x3e2c1c, Tie: 0xefece2 }, legs: 0xcbb68a, hat: 0x141210, tails: 0x3e2c1c },
  gentleman: { url: 'models/people/gentleman.glb', scale: 0.99, colours: { Suit: 0x1e2a44, Tie: 0xf2f0e8 }, legs: 0xd6cfbf, hat: 0x2a2a2c, tails: 0x1e2a44 },
  lady: { url: 'models/people/lady.glb', scale: 0.94, colours: { LimeGreen: 0x9fb4c8, Gold: 0xe8e2d0 }, gown: 0x9fb4c8, bonnet: true },
  explorer: { url: 'models/people/explorer.glb', scale: 0.98, colours: { Purple: 0x3a4236 }, backpack: true },
};

/** One person: their model, clips, bones, what they wear and carry, and their arms' poses. */
export class Person {
  /**
   * The arms' poses: for each arm posed, its upper arm's and its forearm's turns ([axis, radians]),
   * added over the clip; the left arm's mirrored (y and z turns the other way).
   */
  static poses = {
    plans: [{ side: 'R', ua: [['x', -0.9], ['z', 0.25]], la: [['x', -1.0]] }, { side: 'L', ua: [['x', -0.9], ['z', 0.25]], la: [['x', -1.0]] }],
    point: [{ side: 'R', ua: [['x', -1.5], ['z', 0.9]], la: [] }],
    photo: [{ side: 'R', ua: [['x', -1.3], ['z', 0.65]], la: [['x', -1.5]] }, { side: 'L', ua: [['x', -1.3], ['z', 0.65]], la: [['x', -1.5]] }],
  };

  static async make(kind) {
    const look = LOOKS[kind];
    const gltf = await load(look.url);
    return new Person(kind, look, gltf);
  }

  constructor(kind, look, gltf) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.root.name = kind;
    // what they carry, placed in the world each frame from their wrists (the owner adds it beside root)
    this.loose = new THREE.Group();
    this.loose.name = `${kind}'s things`;
    const m = cloneSkinned(gltf.scene);
    m.scale.setScalar(look.scale);
    this.root.add(m);
    this.model = m;
    this.bones = {};
    const meshes = {};
    m.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      meshes[o.name] = o;
      // (each person their own colours: the clones share the materials)
      const recolour = (mt) => {
        const c = look.colours[mt.name];
        if (c === undefined) return mt;
        const n = mt.clone();
        n.color.set(c);
        return n;
      };
      o.material = Array.isArray(o.material) ? o.material.map(recolour) : recolour(o.material);
      // the breeches: the suit's legs in buff
      if (look.legs && /_Legs$/.test(o.name)) {
        const n = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
        n.color.set(look.legs);
        o.material = n;
      }
    });
    const clip = (re) => gltf.animations.find((a) => re.test(a.name));
    this.mixer = new THREE.AnimationMixer(m);
    this.actions = {};
    for (const [k, re] of Object.entries({ idle: /\|Idle$/, walk: /\|Walk$/ })) {
      const c = clip(re);
      if (c) this.actions[k] = this.mixer.clipAction(c);
    }
    this.current = null;
    this.play('idle', 0);
    this.mixer.update(0);
    m.updateMatrixWorld(true);
    // what they wear: fixed to the bones in the pose they stand in now (placed from the bones: the
    // top of the head is the head bone's end, the back of the waist a little behind the hips)
    const wp = (name) => this.bones[name]?.getWorldPosition(new THREE.Vector3()) ?? null;
    const headTop = wp('Head_end') ?? wp('Head')?.add(new THREE.Vector3(0, 0.24, 0));
    const hips = this.bones.Hips;
    const hp = wp('Hips');
    const chest = wp('Chest');
    this.props = [];
    const fix = (bone, obj, at) => {
      if (!bone || !at) return;
      obj.position.copy(at);
      this.root.add(obj);
      this.root.updateMatrixWorld(true);
      bone.attach(obj);
      obj.traverse((o) => o.isMesh && (o.castShadow = true));
    };
    const headBone = this.bones.Head;
    if (headTop && look.hat) fix(headBone, topHat(look.hat), headTop.clone().add(new THREE.Vector3(0, -0.05, -0.01)));
    if (headTop && look.bonnet) fix(headBone, bonnet(), headTop.clone().add(new THREE.Vector3(0, -0.1, -0.01)));
    if (hp && look.tails) fix(hips, coatTails(look.tails, 0.5), hp.clone().add(new THREE.Vector3(0, 0.08, -0.13)));
    if (hp && look.gown) {
      const sk = skirt(look.gown, 0.15, hp.y + 0.1);
      fix(hips, sk, new THREE.Vector3(hp.x, 0.015, hp.z - 0.01));
      this.skirt = sk;
      // (her legs and shoes under the gown: hidden, so a stride never shows through it)
      m.traverse((o) => o.isMesh && /_(Legs|Feet)/.test(o.name) && (o.visible = false));
    }
    if (chest && look.backpack) {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.15), mat('pack', () => new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.8 })));
      fix(this.bones.Chest, pack, chest.clone().add(new THREE.Vector3(0, -0.02, -0.2)));
    }
    // what they carry: placed each frame from the wrists (not fixed: the hands turn)
    if (kind === 'surveyor') {
      this.plans = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), mat('plans', () => new THREE.MeshStandardMaterial({ map: plansPicture(), roughness: 0.9, side: THREE.DoubleSide })));
      this.roll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 10), mat('roll', () => new THREE.MeshStandardMaterial({ color: 0xe2d6b8, roughness: 0.9 })));
      this.loose.add(this.plans, this.roll);
    }
    if (kind === 'gentleman') {
      this.cane = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.9, 6), mat('cane', () => new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.4 })));
      this.loose.add(this.cane);
    }
    if (kind === 'explorer') {
      this.phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.01), mat('phone', () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.4 })));
      this.loose.add(this.phone);
    }
    this.root.traverse((o) => o.isMesh && (o.castShadow = true));
    this.loose.traverse((o) => o.isMesh && (o.castShadow = true));
    this.pose = 'none';
    this.weight = 0; // (the arms' pose, faded in and out)
    this.wanted = 'none';
  }

  play(k, fade = 0.3) {
    const a = this.actions[k];
    if (!a || a === this.current) return;
    a.reset().fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = a;
  }

  /** Arms: 'none', 'plans' (open in both hands), 'point' (the right arm at the house), 'photo'. */
  setPose(p) {
    this.wanted = p;
  }

  update(dt, speed = 0) {
    if (this.actions.walk) this.actions.walk.timeScale = Math.max(0.5, speed / 1.25);
    this.mixer.update(dt);
    // the pose fades out before it changes
    if (this.wanted !== this.pose) {
      this.weight = Math.max(0, this.weight - dt * 2.5);
      if (this.weight === 0) this.pose = this.wanted;
    } else this.weight = Math.min(1, this.weight + dt * 2);
    const w = this.weight * (this.pose === 'none' ? 0 : 1);
    const B = this.bones;
    if (w > 0) {
      const turn = (bone, list, mirror) => {
        if (!bone) return;
        for (const [axis, a] of list) {
          const k = mirror && axis !== 'x' ? -1 : 1;
          if (axis === 'x') bone.rotateX(a * k * w);
          else if (axis === 'y') bone.rotateY(a * k * w);
          else bone.rotateZ(a * k * w);
        }
      };
      for (const P of Person.poses[this.pose] ?? []) {
        turn(B[`UpperArm${P.side}`], P.ua ?? [], P.side === 'L');
        turn(B[`LowerArm${P.side}`], P.la ?? [], P.side === 'L');
      }
    }
    this.root.updateMatrixWorld(true);
    const wr = B.WristR?.getWorldPosition(_a);
    const wl = B.WristL?.getWorldPosition(_b);
    const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    if (this.plans && wr && wl) {
      const open = this.pose === 'plans' ? this.weight : 0;
      this.plans.visible = open > 0.6;
      this.roll.visible = !this.plans.visible;
      if (this.plans.visible) {
        // held open between his hands, tilted up to his eyes
        this.plans.position.copy(wr).add(wl).multiplyScalar(0.5).addScaledVector(fwd, 0.04).add(new THREE.Vector3(0, 0.05, 0));
        this.plans.lookAt(this.plans.position.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(fwd, -0.9));
      } else {
        // rolled under his left arm... in his right hand, down by his side
        this.roll.position.copy(wr).add(new THREE.Vector3(0, -0.02, 0));
        _q.setFromUnitVectors(Y, fwd.clone().add(new THREE.Vector3(0, 0.25, 0)).normalize());
        this.roll.quaternion.copy(_q);
      }
    }
    if (this.cane && wr) {
      this.cane.position.copy(wr).add(new THREE.Vector3(0, -0.44, 0)).addScaledVector(fwd, 0.08);
      this.cane.rotation.set(0.12 * Math.sin(performance.now() / 400) * (speed > 0.2 ? 1 : 0), this.root.rotation.y, 0);
    }
    if (this.phone && wr && wl) {
      const up = this.pose === 'photo' ? this.weight : 0;
      if (up > 0.5) {
        this.phone.position.copy(wr).add(wl).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.06, 0));
        this.phone.lookAt(this.phone.position.clone().addScaledVector(fwd, -1));
      } else {
        this.phone.position.copy(wr).addScaledVector(fwd, 0.03);
        this.phone.lookAt(this.phone.position.clone().add(new THREE.Vector3(0, 1, 0)));
      }
    }
  }
}

/**
 * A route: a loop of points, some with a stop ({ secs, face: [x, z], pose }). `at(s)` is the point
 * and the heading s metres along it.
 */
export class Route {
  constructor(points, { loop = true } = {}) {
    this.points = points.map((p) => ({ ...p, v: new THREE.Vector2(p.x, p.z) }));
    this.loop = loop;
    this.cum = [0];
    const n = this.points.length;
    const segs = loop ? n : n - 1;
    for (let i = 0; i < segs; i++) this.cum.push(this.cum[i] + this.points[i].v.distanceTo(this.points[(i + 1) % n].v));
    this.length = this.cum[segs];
  }

  wrap(s) {
    return this.loop ? THREE.MathUtils.euclideanModulo(s, this.length) : THREE.MathUtils.clamp(s, 0, this.length);
  }

  /** { x, z, dir: Vector2 } at s metres along. */
  at(s) {
    s = this.wrap(s);
    const n = this.points.length;
    let i = 0;
    while (i < this.cum.length - 2 && this.cum[i + 1] < s) i++;
    const a = this.points[i].v;
    const b = this.points[(i + 1) % n].v;
    const t = (s - this.cum[i]) / Math.max(1e-6, this.cum[i + 1] - this.cum[i]);
    const dir = b.clone().sub(a).normalize();
    return { x: a.x + (b.x - a.x) * t, z: a.y + (b.y - a.y) * t, dir };
  }

  /** The next stop at or after s: { s, point } (or null). */
  nextStop(s) {
    s = this.wrap(s);
    for (let k = 0; k < this.points.length * 2; k++) {
      const i = k % this.points.length;
      const base = k >= this.points.length ? this.length : 0;
      const at = this.cum[i] + base;
      if (this.points[i].stop && at >= s - 1e-6) return { s: at, point: this.points[i] };
    }
    return null;
  }
}

/**
 * Someone walking a route: their position, heading and clip; stopping where the route says, facing
 * what it says to look at, with the pose it gives. `lead` (another Walker) makes this one follow it,
 * `lag` metres behind and `side` to the left (+) or right (−), stopping when it stops.
 */
export class Walker {
  constructor(person, route, { ground, speed = 1.1, start = 0, lead = null, lag = 1.6, side = 0 } = {}) {
    this.p = person;
    this.route = route;
    this.ground = ground;
    this.speed = speed;
    this.s = start;
    this.lead = lead;
    this.lag = lag;
    this.side = side;
    this.wait = 0;
    this.stop = route.nextStop(start);
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.faceYaw = null;
    this.moving = false;
    const a = route.at(start);
    this.pos.set(a.x, ground(a.x, a.z, 0), a.z);
  }

  update(dt) {
    let target = null;
    let v = 0;
    if (this.lead) {
      // keep `lag` behind the leader on the route; stand when he stands
      const want = this.lead.s - this.lag;
      const gap = want - this.s;
      v = gap > 0.05 ? Math.min(this.speed * 1.15, gap * 1.6 + 0.3) : 0;
      this.s += Math.min(gap, v * dt);
      if (!this.lead.moving && gap < 0.3) target = this.lead.faceAt;
    } else if (this.wait > 0) {
      this.wait -= dt;
      target = this.faceAt;
      if (this.wait <= 0) {
        this.p.setPose('none');
        this.s += 0.01;
        this.stop = this.route.nextStop(this.s);
      }
    } else {
      v = this.speed;
      let step = v * dt;
      this.stop = this.route.nextStop(this.s); // (always the next one ahead, wherever it was put)
      if (this.stop) {
        // (unwrapped: the next stop may be on the next lap)
        const ahead = this.stop.s - this.route.wrap(this.s);
        const lapAhead = ahead < -1e-6 ? ahead + this.route.length : ahead;
        if (lapAhead <= step) {
          step = Math.max(0, lapAhead);
          const st = this.stop.point.stop;
          this.wait = st.secs;
          this.faceAt = st.face ? new THREE.Vector2(st.face[0], st.face[1]) : null;
          this.p.setPose(st.pose ?? 'none');
        }
      }
      this.s += step;
    }
    this.moving = v > 0.05;
    const a = this.route.at(this.s);
    let x = a.x;
    let z = a.z;
    if (this.side) {
      x += -a.dir.y * this.side;
      z += a.dir.x * this.side;
    }
    // (eased: so a follower's side step at a corner doesn't jump)
    const k = 1 - Math.exp(-dt * 6);
    this.pos.x += (x - this.pos.x) * k;
    this.pos.z += (z - this.pos.z) * k;
    this.pos.y += (this.ground(this.pos.x, this.pos.z, this.pos.y) - this.pos.y) * Math.min(1, dt * 10);
    // heading: along the way when walking, at what they look at when stood
    let yaw = this.yaw;
    if (this.moving) yaw = Math.atan2(a.dir.x, a.dir.y);
    else if (target) yaw = Math.atan2(target.x - this.pos.x, target.y - this.pos.z);
    let d = yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 4);
    this.p.play(this.moving ? 'walk' : 'idle');
    this.p.root.position.copy(this.pos);
    this.p.root.rotation.y = this.yaw;
    this.p.update(dt, this.moving ? v : 0);
  }
}
