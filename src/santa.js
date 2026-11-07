// Christmas Eve: Father Christmas in his sleigh, drawn by eight reindeer, crossing the night sky
// over the estate every few minutes from dusk, the lead reindeer's nose glowing red and a trail of
// sparkles behind; his sleigh bells and his "ho ho ho" come from far off and pass over (the
// recordings are in public/sounds). And the ride: in the Santa's sleigh flyby you sit behind him,
// the sleigh's front below you and the team galloping on ahead (the flyby's path is his).
//
// Every other time he comes over he lands on the ridge of the roof for half a minute, the reindeer
// standing and shaking their bells, then is off again; in the flyby, the sleigh lands there too.
//
// The sleigh is Tribus Games's (CC0), Father Christmas Grunion's "Mall Santa" sitting (CC0), the
// reindeer CDmir's stag (CC0) made grey-brown, on Quaternius's Stag rig with its gallop
// (public/animals/).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const CHRISTMAS_EVE = 357; // 24 December (day of the year, from 0)
const LOOP = { x: 5, z: -10, r: 150, y: 62 }; // his circuit over the estate

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Santa {
  /**
   * @param {THREE.Scene} scene
   * @param {{ sample: Function }} sound (sleigh-bells, hohoho-1, hohoho-2)
   */
  constructor(scene, sound, { roof = null } = {}) {
    this.scene = scene;
    this.sound = sound;
    // where he lands: the ridge of the roof, from where the sleigh stands, along it (+x)
    this.roof = roof;
    this.visits = 0;
    this.group = new THREE.Group();
    this.group.name = 'Father Christmas';
    this.group.visible = false;
    scene.add(this.group);
    this.ride = false; // the Santa's sleigh flyby: he flies with the camera
    this.t = 0;
    this.away = 20; // seconds until he comes over (between passes he is gone)
    this.a = 0; // where he is on his circuit (radians)
    this.passing = false;
    this.landed = 0; // 0 flying .. 1 standing on the roof
    this.visit = null;
    this.ready = false;
    // the sparkle trail behind the sleigh
    const N = 220;
    this.trail = { pos: new Float32Array(N * 3), life: new Float32Array(N), next: 0, n: N };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trail.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('life', new THREE.BufferAttribute(this.trail.life, 1).setUsage(THREE.DynamicDrawUsage));
    this.sparkles = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: glowTexture() }, uScale: { value: 800 } },
        vertexShader: /* glsl */ `
          attribute float life;
          uniform float uScale;
          varying float vLife;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            vLife = life;
            gl_PointSize = life > 0.0 ? clamp(0.35 * uScale / -mv.z, 1.5, 18.0) : 0.0;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          varying float vLife;
          void main() {
            float a = texture2D(uMap, gl_PointCoord).a * clamp(vLife, 0.0, 1.0);
            gl_FragColor = vec4(vec3(1.0, 0.9, 0.6) * a * 1.6, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sparkles.frustumCulled = false;
    this.group.add(this.sparkles);
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  /** Loads the sleigh, Father Christmas and the reindeer. */
  async load(base = '') {
    const loader = new GLTFLoader();
    const [sleigh, santa, stag] = await Promise.all(['sleigh', 'santa', 'reindeer'].map((n) => loader.loadAsync(`${base}animals/${n}.glb`)));
    // the whole team in one holder: the sleigh at its origin facing +z, the reindeer ahead
    this.team = new THREE.Group();
    this.group.add(this.team);
    const fit = (obj, length, axis = 'z') => {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj, true);
      const ext = box.getSize(new THREE.Vector3());
      obj.scale.setScalar(length / (axis === 'y' ? ext.y : Math.max(ext.x, ext.z)));
      return box;
    };
    // the sleigh, about three metres long (its front is +x: turned to +z)
    const sl = sleigh.scene;
    sl.rotation.y = -Math.PI / 2;
    const sbox = fit(sl, 3.1);
    sl.position.y = -sbox.min.y * sl.scale.y;
    sl.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      // (its voxel colours, a little brighter: it is seen against the night)
      if (o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0x200806);
      }
    });
    this.team.add(sl);
    // Father Christmas, sitting in it, facing forward
    const sa = santa.scene;
    const abox = fit(sa, 1.45, 'y');
    sa.position.set(0, -abox.min.y * sa.scale.y + 0.25, -0.35);
    sa.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0x150404);
      }
    });
    this.santa = sa;
    this.team.add(sa);
    // eight reindeer in pairs ahead, the lead pair furthest (Rudolph's nose at the front)
    this.deer = [];
    for (let k = 0; k < 8; k++) {
      const m = cloneSkinned(stag.scene);
      const box = fit(m, 1.9);
      m.position.y = -box.min.y * m.scale.y;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        o.material = o.material.clone();
        // (a little light of their own: against the night they would be black)
        o.material.emissive = new THREE.Color(0x2a2620);
        if (o.material.map) o.material.emissiveMap = o.material.map;
      });
      const holder = new THREE.Group();
      holder.add(m);
      const row = Math.floor(k / 2);
      holder.position.set(k % 2 ? 0.75 : -0.75, 0.35, 3.6 + row * 2.4);
      this.team.add(holder);
      const mixer = new THREE.AnimationMixer(m);
      const find = (re) => stag.animations.find((a) => re.test(a.name));
      const gallop = mixer.clipAction(find(/gallop/i) ?? stag.animations[0]);
      // standing on the roof: idle, a head down now and then
      const idle = mixer.clipAction(find(/^(.*\|)?idle$/i) ?? find(/idle/i) ?? stag.animations[0]);
      const low = mixer.clipAction(find(/headlow|eating/i) ?? find(/idle/i) ?? stag.animations[0]);
      gallop.play();
      mixer.update(Math.random() * 2);
      this.deer.push({ holder, mixer, row, gallop, idle, low, current: gallop });
    }
    // the reins, from the sleigh to the lead pair
    const reins = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.35, 1.1, 0.9), new THREE.Vector3(-0.7, 1.05 + 3 * 0.28, 3.6 + 3 * 2.4), new THREE.Vector3(0.35, 1.1, 0.9), new THREE.Vector3(0.7, 1.05 + 3 * 0.28, 3.6 + 3 * 2.4)]);
    this.team.add(new THREE.LineSegments(reins, new THREE.LineBasicMaterial({ color: 0x2a1a10 })));
    // Rudolph's nose
    this.nose = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.nose.scale.setScalar(0.9);
    this.nose.position.set(-0.75, 1.55 + 3 * 0.28, 3.6 + 3 * 2.4 + 1.0);
    this.team.add(this.nose);
    this.ready = true;
  }

  /** Turns in from the circuit: down to the ridge of the roof, half a minute there, and away. */
  _startVisit() {
    const r = this.roof;
    const team = this.team;
    const from = team.position.clone();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(team.quaternion).setY(0).normalize();
    const along = r.dir.clone().normalize();
    const land = r.at.clone();
    // in along the ridge from behind, low and slow at the end; out along it, climbing
    const curve = (a, b, c, d) => new THREE.CubicBezierCurve3(a, b, c, d);
    const inCurve = curve(from, from.clone().addScaledVector(fwd, 70), land.clone().addScaledVector(along, -60).add(new THREE.Vector3(0, 16, 0)), land);
    const out = land.clone().addScaledVector(along, 140).add(new THREE.Vector3(0, 55, 30));
    const outCurve = curve(land, land.clone().addScaledVector(along, 30).add(new THREE.Vector3(0, 4, 0)), out.clone().addScaledVector(along, -40), out);
    this.visit = { phase: 'in', t: 0, inCurve, outCurve, inTime: inCurve.getLength() / 15, outTime: outCurve.getLength() / 13, stay: 30, landed: false };
    this.visited = true;
  }

  _visit(dt) {
    const v = this.visit;
    const team = this.team;
    team.visible = true;
    v.t += dt;
    let p;
    let tangent;
    if (v.phase === 'in') {
      // (easing in to the ridge: slowing for the last stretch)
      const u = Math.min(1, v.t / v.inTime);
      const e = 1 - Math.pow(1 - u, 2.2);
      p = v.inCurve.getPointAt(e);
      tangent = v.inCurve.getTangentAt(Math.min(0.999, e));
      this.landed = THREE.MathUtils.smoothstep(u, 0.9, 1);
      if (u >= 1) {
        v.phase = 'stay';
        v.t = 0;
        this.nextHo = 1.2;
        this.nextBells = 2.5;
      }
    } else if (v.phase === 'stay') {
      p = this.roof.at;
      tangent = this.roof.dir;
      this.landed = 1;
      if (v.t > v.stay) {
        v.phase = 'out';
        v.t = 0;
        this.nextHo = 0.3;
        this.nextBells = 0.5;
      }
    } else {
      // (off: the gallop first, then the climb)
      const u = Math.min(1, v.t / v.outTime);
      const e = Math.pow(u, 1.6);
      p = v.outCurve.getPointAt(e);
      tangent = v.outCurve.getTangentAt(Math.max(0.001, e));
      this.landed = 1 - THREE.MathUtils.smoothstep(u, 0, 0.06);
      if (u >= 1) {
        this.visit = null;
        this.passing = false;
        this.away = 60 + Math.random() * 60;
        this.visits++;
      }
    }
    team.position.copy(p);
    const flat = Math.hypot(tangent.x, tangent.z);
    team.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
    team.rotateX(-Math.atan2(tangent.y, flat) * 0.5 * (1 - this.landed));
    // the bells: shaken now and then by the team on the roof, ringing as they fly
    this.nextBells -= dt;
    if (this.nextBells <= 0) {
      this.nextBells = v.phase === 'stay' ? 6 + Math.random() * 6 : 5.4;
      this.sound?.sample('sleigh-bells', team.position.clone(), { ref: 30, rolloff: 0.9, max: 900, gain: v.phase === 'stay' ? 0.5 : 0.9, lowpass: 5000 });
    }
    this.nextHo -= dt;
    if (this.nextHo <= 0) {
      this.nextHo = v.phase === 'stay' ? 9 + Math.random() * 6 : 14 + Math.random() * 10;
      this.sound?.sample(Math.random() < 0.5 ? 'hohoho-1' : 'hohoho-2', team.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { ref: 40, rolloff: 0.9, max: 900, gain: 1 });
    }
  }

  /** Christmas Eve, from dusk. */
  static on(day, night) {
    return Math.floor(day) === CHRISTMAS_EVE && night > 0.35;
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {number} o.day
   * @param {number} o.night 0 day .. 1 night
   * @param {THREE.Camera} o.camera
   * @param {number} o.scale the sparkles' size (the focal length in pixels)
   */
  update(dt, { day, night, camera, scale = 800 }) {
    if (!this.ready) return;
    const on = this.ride || Santa.on(day, night);
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    const team = this.team;
    if (this.ride) {
      // riding with the camera: Father Christmas just in front of you and below, the team ahead
      // (the camera is his eyes, a little behind and above his head)
      team.visible = true;
      this.santa.visible = false; // (you are in his seat: only the sleigh's front shows)
      team.quaternion.copy(camera.quaternion);
      // (level: only the heading and the climb or dive follow the camera)
      const fwd = camera.getWorldDirection(this._v);
      team.rotation.set(0, Math.atan2(fwd.x, fwd.z), 0, 'YXZ');
      team.rotateX(-Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1)) * 0.6);
      team.position.copy(camera.position).add(new THREE.Vector3(0, -1.9, 0)).addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), -0.7);
      this.passing = true;
      // (slowed almost to a stop: landed, on the roof; the team stands)
      const v = this._lastCam ? camera.position.distanceTo(this._lastCam) / Math.max(dt, 1e-3) : 10;
      (this._lastCam ??= new THREE.Vector3()).copy(camera.position);
      this.landed += ((v < 1.3 ? 1 : 0) - this.landed) * (1 - Math.exp(-dt * 3));
      if (this.landed > 0.5 && !this._rideLanded) {
        this._rideLanded = true;
        this.nextHo = 0.6;
      } else if (this.landed < 0.3) this._rideLanded = false;
      // the bells on the harness just ahead of you all the way, and now and then his laugh
      this.nextBells = (this.nextBells ?? 0) - dt;
      if (this.nextBells <= 0) {
        this.nextBells = 5.4;
        this.sound?.sample('sleigh-bells', camera.position.clone().addScaledVector(fwd, 5), { ref: 6, rolloff: 1, max: 200, gain: 0.55 });
      }
      this.nextHo = (this.nextHo ?? 4) - dt;
      if (this.nextHo <= 0) {
        this.nextHo = 11 + Math.random() * 8;
        this.sound?.sample(Math.random() < 0.5 ? 'hohoho-1' : 'hohoho-2', camera.position.clone().add(new THREE.Vector3(0, -0.4, 0)), { ref: 3, rolloff: 1, max: 100, gain: 0.8 });
      }
    } else {
      this.santa.visible = true;
      // between passes he is away; then once round his circuit, high over the estate
      if (!this.passing) {
        team.visible = false;
        this.away -= dt;
        if (this.away <= 0) {
          this.passing = true;
          this.a = Math.random() * Math.PI * 2;
          this.dir = Math.random() < 0.5 ? 1 : -1;
          this.lap = 0;
          this.nextHo = 3 + Math.random() * 4;
          this.nextBells = 0;
          this.visited = false;
        }
      }
      if (this.passing && this.visit) this._visit(dt);
      else if (this.passing) {
        team.visible = true;
        this.landed = 0;
        const w = 17 / LOOP.r; // (17 m a second)
        this.a += this.dir * w * dt;
        this.lap += w * dt;
        const y = LOOP.y + 10 * Math.sin(this.a * 2) + 6 * Math.sin(this.t * 0.4);
        team.position.set(LOOP.x + Math.cos(this.a) * LOOP.r, y, LOOP.z + Math.sin(this.a) * LOOP.r);
        // facing along the circle, banked into the turn
        const tx = -Math.sin(this.a) * this.dir;
        const tz = Math.cos(this.a) * this.dir;
        team.rotation.set(0, Math.atan2(tx, tz), 0, 'YXZ');
        team.rotateZ(0.12 * this.dir);
        // every other time (the first of the evening too), a quarter of the way round he turns in to land on the roof
        if (this.roof && this.visits % 2 === 0 && this.lap > Math.PI * 0.35 && !this.visited) this._startVisit();
        if (this.lap > Math.PI * 1.4) {
          this.passing = false;
          this.away = 70 + Math.random() * 80;
          this.visits++;
          this.visited = false;
        }
        // his bells, and now and then "ho ho ho", from wherever he is
        this.nextBells -= dt;
        if (this.nextBells <= 0) {
          this.nextBells = 5.4;
          this.sound?.sample('sleigh-bells', team.position.clone(), { ref: 40, rolloff: 0.9, max: 900, gain: 0.9, lowpass: 5000 });
        }
        this.nextHo -= dt;
        if (this.nextHo <= 0) {
          this.nextHo = 12 + Math.random() * 12;
          this.sound?.sample(Math.random() < 0.5 ? 'hohoho-1' : 'hohoho-2', team.position.clone(), { ref: 45, rolloff: 0.9, max: 900, gain: 1 });
        }
      }
    }
    // the reindeer gallop, each pair bobbing a little out of step
    const fly = 1 - THREE.MathUtils.clamp(this.landed, 0, 1);
    for (const [k, d] of this.deer.entries()) {
      // flying, the gallop; landed, standing (now and then one with its head down)
      const want = fly > 0.5 ? d.gallop : Math.sin(this.t * 0.31 + k * 1.7) > 0.6 ? d.low : d.idle;
      if (want !== d.current) {
        want.reset().play();
        d.current.crossFadeTo(want, 0.4, false);
        d.current = want;
      }
      d.mixer.update(dt * (d.current === d.gallop ? 1.05 : 1));
      // (each pair a little higher than the one behind, as if climbing: from the sleigh you see them
      // all; on the roof, all on the ridge)
      d.holder.position.y = fly * (0.35 + d.row * 0.28 + 0.12 * Math.sin(this.t * 6 + d.row * 1.3));
    }
    this.nose.material.opacity = 0.75 + 0.25 * Math.sin(this.t * 3);
    // sparkles shed behind the sleigh, drifting down and fading
    const tr = this.trail;
    if (team.visible) {
      team.updateMatrixWorld(true);
      for (let n = Math.floor(dt * 70 + Math.random()); n > 0; n--) {
        const i = tr.next;
        tr.next = (i + 1) % tr.n;
        this._v.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.6, -0.8 - Math.random() * 0.8).applyMatrix4(team.matrixWorld);
        tr.pos.set([this._v.x, this._v.y, this._v.z], i * 3);
        tr.life[i] = 1.6 + Math.random() * 0.8;
      }
    }
    for (let i = 0; i < tr.n; i++) {
      if (tr.life[i] <= 0) continue;
      tr.life[i] -= dt;
      tr.pos[i * 3 + 1] -= dt * 0.6;
    }
    this.sparkles.geometry.attributes.position.needsUpdate = true;
    this.sparkles.geometry.attributes.life.needsUpdate = true;
    this.sparkles.material.uniforms.uScale.value = scale;
  }
}
