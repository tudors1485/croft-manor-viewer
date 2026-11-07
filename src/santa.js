// Christmas Eve: Father Christmas in his sleigh, drawn by eight reindeer, crossing the night sky
// over the estate every few minutes from dusk, the lead reindeer's nose glowing red and a trail of
// sparkles behind; his sleigh bells and his "ho ho ho" come from far off and pass over (the
// recordings are in public/sounds). And the ride: in the Santa's sleigh flyby you sit behind him,
// the sleigh's front below you and the team galloping on ahead (the flyby's path is his).
//
// The sleigh is Tribus Games's (CC0), Father Christmas Grunion's "Mall Santa" sitting (CC0), the
// reindeer Quaternius's Stag (CC0) with its gallop, made reindeer-brown (public/animals/).

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
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Father Christmas';
    this.group.visible = false;
    scene.add(this.group);
    this.ride = false; // the Santa's sleigh flyby: he flies with the camera
    this.t = 0;
    this.away = 20; // seconds until he comes over (between passes he is gone)
    this.a = 0; // where he is on his circuit (radians)
    this.passing = false;
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
    const [sleigh, santa, stag] = await Promise.all(['sleigh', 'santa', 'stag'].map((n) => loader.loadAsync(`${base}animals/${n}.glb`)));
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
    const brown = new THREE.Color(0.62, 0.45, 0.3);
    for (let k = 0; k < 8; k++) {
      const m = cloneSkinned(stag.scene);
      const box = fit(m, 1.9);
      m.position.y = -box.min.y * m.scale.y;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        o.material = o.material.clone();
        o.material.color.multiply(brown);
        // (a little warmth of their own: against the night they would be black)
        o.material.emissive = new THREE.Color(0x24160c);
      });
      const holder = new THREE.Group();
      holder.add(m);
      const row = Math.floor(k / 2);
      holder.position.set(k % 2 ? 0.75 : -0.75, 0.35, 3.6 + row * 2.4);
      this.team.add(holder);
      const mixer = new THREE.AnimationMixer(m);
      const clip = stag.animations.find((a) => /gallop/i.test(a.name)) ?? stag.animations[0];
      const act = mixer.clipAction(clip);
      act.play();
      mixer.update(Math.random() * 2);
      this.deer.push({ holder, mixer, row });
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
        }
      }
      if (this.passing) {
        team.visible = true;
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
        if (this.lap > Math.PI * 1.4) {
          this.passing = false;
          this.away = 70 + Math.random() * 80;
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
    for (const d of this.deer) {
      d.mixer.update(dt * 1.05);
      // (each pair a little higher than the one behind, as if climbing: from the sleigh you see them all)
      d.holder.position.y = 0.35 + d.row * 0.28 + 0.12 * Math.sin(this.t * 6 + d.row * 1.3);
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
