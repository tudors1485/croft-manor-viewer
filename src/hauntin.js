// Halloween night inside the house:
//
// - The kitchen: a cauldron bubbling on the floor, green light and steam rising from it, jars and
//   bottles on the table, a witch's hat left beside them, a broom against the wall.
// - The pool runs red, and the dead are having a party: zombies and skeletons dancing round it and in
//   it, waist-deep, a gramophone playing a waltz, the light turning red, green and violet; now and
//   then a groan.
// - The bedroom: a doll sitting on the bed, her head turned to wherever you are; something under the
//   covers, breathing; a music box playing when you come in.
// - The attic: dress forms, an old trunk whose lid lifts and drops, a birdcage swinging on its chain,
//   cobwebs, a spinning wheel; and a ghost, floating, who turns to you and talks.
//
// Models: Quaternius's zombies and skeleton (a dance from his Universal Animation Library), Poly
// Haven's trunk, jars and spinning wheel, reyshapes's dress form, Quaternius's cauldron and cobweb
// (CC0); Poly by Google's birdcage, Don Carson's gramophone, J-Toastie's witch's hat (CC BY 3.0);
// CreativeTrio's doll (CC0); the sheet ghost made for the viewer (public/models/halloween/).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const LINES = [
  'You should not be up here.',
  'She keeps her secrets in the trunk.',
  'Every room remembers who walked in it.',
  'Can you hear the music downstairs? It never stops.',
  'Leave the candles burning. Please.',
  'I have been waiting such a long time.',
  'The one at the gate. Did you follow him?',
  'Go back down. Quietly.',
];

function glowDot(colour) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${colour},1)`);
  r.addColorStop(0.35, `rgba(${colour},0.35)`);
  r.addColorStop(1, `rgba(${colour},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class HauntInside {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh
   * @param {THREE.Box3} o.houseBox
   * @param {object} o.poolUniforms the indoor pool's water uniforms (uBlood)
   * @param {{ sample: Function, has?: Function, duration?: Function, voice?: Function }} [o.sound]
   * @param {(text: string) => void} [o.say] shows what the ghost says
   */
  constructor(scene, { bvh, houseBox, poolUniforms = null, sound = null, say = null }) {
    this.scene = scene;
    this.bvh = bvh;
    this.houseBox = houseBox;
    this.pool = poolUniforms;
    this.sound = sound;
    this.say = say;
    this.group = new THREE.Group();
    this.group.name = 'Halloween inside';
    this.group.visible = false;
    scene.add(this.group);
    this.t = 0;
    // the lights (in the scene all year, dark: adding a light later recompiles every shader)
    // (one light, moved to the room you are nearest: every light in the scene costs every frame)
    this.light = new THREE.PointLight(0xffffff, 0, 16, 1.4);
    scene.add(this.light);
    this.cauldronLight = { position: new THREE.Vector3(), color: new THREE.Color(0x4cff6a), intensity: 0, distance: 6 };
    this.partyLight = { position: new THREE.Vector3(), color: new THREE.Color(0xff3030), intensity: 0, distance: 16 };
    this.ghostLight = { position: new THREE.Vector3(), color: new THREE.Color(0xa8c8ff), intensity: 0, distance: 6 };
    this.candleLight = { position: new THREE.Vector3(-10.9, 6.5, -23.4), color: new THREE.Color(0xffa04a), intensity: 0, distance: 6 };
    this.dancers = [];
    this.nextLine = 0;
    this.nextGroan = 5;
    this.nextMusic = 0;
    this.nextBubble = 0;
    this.lineAt = 0;
  }

  _floor(x, z, from) {
    const ray = new THREE.Ray(new THREE.Vector3(x, from, z), new THREE.Vector3(0, -1, 0));
    return this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 4)?.point.y ?? null;
  }

  async load(base = '') {
    if (this.loading) return;
    this.loading = true;
    const loader = new GLTFLoader();
    const names = ['zombie-green', 'zombie-blue', 'zombie-blocky', 'skeleton', 'cauldron', 'jars', 'witch-hat', 'gramophone', 'doll', 'dress-form', 'trunk', 'spinning-wheel', 'birdcage', 'cobweb', 'sheet-ghost'];
    const got = await Promise.all(names.map((n) => loader.loadAsync(`${base}models/halloween/${n}.glb`).catch(() => null)));
    const m = Object.fromEntries(names.map((n, i) => [n, got[i]]));
    const fit = (obj, size, axis = 'y') => {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj, true);
      const e = box.getSize(new THREE.Vector3());
      obj.scale.multiplyScalar(size / Math.max(1e-4, axis === 'y' ? e.y : Math.max(e.x, e.z)));
      obj.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(obj, true);
      obj.position.y -= b.min.y;
      return obj;
    };
    const put = (obj, x, y, z, yaw = 0) => {
      const g = new THREE.Group();
      g.add(obj);
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = !o.isSkinnedMesh;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mm, i) => {
          if (!(mm.transmission > 0)) return;
          const glass = new THREE.MeshStandardMaterial({ color: 0x9ab0a0, roughness: 0.08, transparent: true, opacity: 0.3, depthWrite: false });
          if (Array.isArray(o.material)) o.material[i] = glass;
          else o.material = glass;
        });
      });
      this.group.add(g);
      return g;
    };

    // --- the kitchen ---
    if (m.cauldron) {
      const y = this._floor(-12.4, -21.4, 2) ?? 0.04;
      const c = put(fit(m.cauldron.scene.clone(true), 0.62), -12.4, y, -21.4);
      c.traverse((o) => {
        if (o.isMesh && /soup/i.test(o.material.name)) {
          o.material = o.material.clone();
          o.material.color.set(0x2a6a20);
          o.material.emissive = new THREE.Color(0x3cff50);
          o.material.emissiveIntensity = 0.9;
        }
      });
      this.cauldronAt = new THREE.Vector3(-12.4, y + 0.65, -21.4);
      this.cauldronLight.position.copy(this.cauldronAt).add(new THREE.Vector3(0, 0.35, 0));
      // the steam: soft green puffs rising
      const n = 40;
      this.steam = { pos: new Float32Array(n * 3), life: new Float32Array(n), n };
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.steam.pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.steamPts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowDot('120,255,140'), size: 0.5, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.steamPts.frustumCulled = false;
      this.group.add(this.steamPts);
    }
    // jars and the hat on the kitchen table (its top found from above)
    const tableY = this._floor(-10.6, -23.4, 1.8);
    if (tableY !== null && tableY > 0.5) {
      if (m.jars) put(fit(m.jars.scene.clone(true), 0.95, 'xz'), -10.6, tableY, -23.4, 0.3);
      if (m['witch-hat']) put(fit(m['witch-hat'].scene.clone(true), 0.3), -10.4, tableY, -21.9, 0.8);
    }
    // a broom against the wall
    {
      const broom = new THREE.Group();
      broom.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6).translate(0, 0.95, 0), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 })));
      broom.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 10, 1, true).translate(0, 0.22, 0), new THREE.MeshStandardMaterial({ color: 0x9a8150, roughness: 1, side: THREE.DoubleSide })));
      const y = this._floor(-13.55, -23.2, 2) ?? 0.04;
      broom.position.set(-13.55, y, -23.2);
      broom.rotation.z = -0.22;
      broom.traverse((o) => o.isMesh && (o.castShadow = true));
      this.group.add(broom);
    }

    // --- the zombies' party at the pool ---
    const pool = [
      ['zombie-green', 18.6, 4.95, -23.7, 1.65],
      ['skeleton', 20.4, 4.95, -24.9, 1.75],
      ['zombie-blue', 18.7, 4.95, -26.6, 1.7],
      ['zombie-blocky', 20.5, 4.95, -27.8, 1.6],
      ['skeleton', 28.1, 4.95, -24.0, 1.75],
      ['zombie-green', 28.1, 4.95, -27.2, 1.65],
      // two in the water, up to the waist
      ['zombie-blue', 23.6, 4.67 - 0.85, -25.4, 1.7],
      ['zombie-blocky', 25.4, 4.67 - 0.8, -24.3, 1.6],
    ];
    for (const [kind, x, y, z, h] of pool) {
      const g = m[kind];
      if (!g) continue;
      const model = cloneSkinned(g.scene);
      fit(model, h);
      const holder = put(model, x, y, z, Math.atan2(23.6 - x, -25.5 - z));
      const mixer = new THREE.AnimationMixer(model);
      const clip = g.animations.find((a) => a.name === 'Dance') ?? g.animations[0];
      if (clip) {
        const a = mixer.clipAction(clip);
        a.play();
        a.timeScale = 0.9 + Math.random() * 0.25;
      }
      mixer.update(Math.random() * 2);
      this.dancers.push({ holder, mixer, phase: Math.random() * 6, base: holder.rotation.y });
    }
    if (m.gramophone) {
      const y = this._floor(17.3, -22.6, 7) ?? 4.95;
      put(fit(m.gramophone.scene.clone(true), 0.75), 17.3, y, -22.6, 2.4);
      this.musicAt = new THREE.Vector3(17.3, y + 0.6, -22.6);
    }
    this.partyLight.position.set(22.5, 7.6, -25.5);

    // --- the bedroom ---
    const bedY = this._floor(-10, -22.4, 7.4);
    if (bedY !== null && m.doll) {
      this.doll = put(fit(m.doll.scene.clone(true), 0.36, 'xz'), -10.15, bedY, -22.6, 1.4);
      this.doll.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(0x2a2420);
        }
      });
    }
    // a candle on the bedside, the only light in the room
    {
      const y = this._floor(-10.9, -23.5, 7.4) ?? 5.54;
      this.candleLight.position.set(-10.9, y + 0.35, -23.5);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot('255,190,110'), color: new THREE.Color(2.2, 1.6, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flame.position.set(-10.9, y + 0.3, -23.5);
      flame.scale.setScalar(0.18);
      this.group.add(flame);
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xeee6d0, emissive: 0x3a2a10 }));
      wax.position.set(-10.9, y + 0.12, -23.5);
      this.group.add(wax);
    }
    if (bedY !== null) {
      // something under the covers, breathing
      const sheet = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 });
      this.lump = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10).scale(0.32, 0.16, 0.7), sheet);
      this.lump.position.set(-9.75, bedY + 0.06, -22.0);
      this.lump.castShadow = true;
      this.group.add(this.lump);
    }
    this.bedroomAt = new THREE.Vector3(-11.5, 6.5, -22);

    // --- the attic ---
    const A = 7.96;
    if (m['dress-form']) {
      put(fit(m['dress-form'].scene.clone(true), 1.6), -6.6, A, -26.3, 0.6);
      put(fit(m['dress-form'].scene.clone(true), 1.55), -5.3, A, -28.4, -0.4);
    }
    if (m.trunk) {
      this.trunk = put(fit(m.trunk.scene.clone(true), 0.62), 4.4, A, -28.5, -0.15);
      this.trunk.traverse((o) => /lid/i.test(o.name) && !this.lid && (this.lid = o));
      this.lidBase = this.lid ? this.lid.rotation.x : 0;
    }
    if (m['spinning-wheel']) this.wheel = put(fit(m['spinning-wheel'].scene.clone(true), 0.97), -1.6, A, -28.6, 0.2);
    if (m.birdcage) {
      const cage = fit(m.birdcage.scene.clone(true), 0.55);
      cage.position.y = -0.95; // (on its chain, below the beam)
      this.cage = put(cage, 1.6, A + 2.1, -27.3);
      this.cage.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.4, 0)]), new THREE.LineBasicMaterial({ color: 0x333333 })));
    }
    if (m.cobweb) {
      for (const [x, y, z, yaw] of [
        [-7.7, A + 1.3, -25.8, Math.PI * 0.75],
        [6.6, A + 1.3, -25.8, -Math.PI * 0.75],
        [-7.7, A + 1.2, -28.8, Math.PI * 0.25],
        [6.6, A + 1.2, -28.8, -Math.PI * 0.25],
      ])
        put(fit(m.cobweb.scene.clone(true), 0.9, 'xz'), x, y, z, yaw);
    }
    if (m['sheet-ghost']) {
      const gh = fit(m['sheet-ghost'].scene.clone(true), 1.7);
      gh.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(0x6a7a96);
          o.material.emissiveIntensity = 0.6;
          o.material.transparent = true;
          o.material.opacity = 0.82;
        }
      });
      this.ghost = put(gh, -2.6, A + 0.25, -27.2);
      this.ghostLight.position.set(-2.6, A + 1.5, -27.2);
    }
    this.loaded = true;
  }

  /**
   * @param {number} dt
   * @param {object} o
   * @param {boolean} o.on Halloween night
   * @param {THREE.Camera} o.camera
   */
  update(dt, { on, camera }) {
    const cam = camera.position;
    const near = on && this.houseBox.containsPoint(cam);
    // (the pool runs red all Halloween night, from inside or out)
    if (this.pool) this.pool.uBlood.value += ((on ? 1 : 0) - this.pool.uBlood.value) * Math.min(1, dt * 1.5);
    this.group.visible = on;
    if (!on) {
      this.light.intensity = 0;
      return;
    }
    if (!this.loaded) {
      this.load().catch((err) => console.warn('the haunted rooms did not load:', err.message));
      return;
    }
    this.t += dt;
    const t = this.t;
    const flick = 0.85 + 0.1 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23 + 1);
    // the kitchen
    this.cauldronLight.intensity = near ? 5 * flick : 0;
    if (this.steam) {
      const s = this.steam;
      for (let i = 0; i < s.n; i++) {
        s.life[i] -= dt;
        if (s.life[i] <= 0) {
          s.life[i] = 2 + Math.random() * 2;
          s.pos.set([this.cauldronAt.x + (Math.random() - 0.5) * 0.4, this.cauldronAt.y, this.cauldronAt.z + (Math.random() - 0.5) * 0.4], i * 3);
        }
        s.pos[i * 3 + 1] += dt * 0.35;
        s.pos[i * 3] += Math.sin(t + i) * dt * 0.05;
      }
      this.steamPts.geometry.attributes.position.needsUpdate = true;
      this.nextBubble -= dt;
      if (this.nextBubble <= 0 && cam.distanceTo(this.cauldronAt) < 12) {
        this.nextBubble = (this.sound?.duration?.('cauldron') || 12) - 0.3;
        this.sound?.sample('cauldron', this.cauldronAt.clone(), { ref: 2, rolloff: 1.3, max: 30, gain: 0.6 });
      }
    }
    // the party: the dancers sway round as they dance; the light turns red, green, violet
    for (const d of this.dancers) {
      d.mixer.update(dt);
      d.holder.rotation.y = d.base + Math.sin(t * 0.6 + d.phase) * 0.6;
    }
    const hue = (t * 0.08) % 1;
    this.partyLight.color.setHSL([0, 0.33, 0.78][Math.floor(hue * 3)], 0.95, 0.55);
    this.partyLight.intensity = near ? 9 * (0.75 + 0.25 * Math.sin(t * 3.1)) : 0;
    if (this.musicAt) {
      this.sound?.has?.('zombie-party');
      this.nextMusic -= dt;
      if (this.nextMusic <= 0 && cam.distanceTo(this.musicAt) < 30 && this.sound?.has?.('zombie-party')) {
        this.nextMusic = (this.sound.duration?.('zombie-party') || 100) + 1;
        this.sound.sample('zombie-party', this.musicAt.clone(), { ref: 4, rolloff: 1.2, max: 60, gain: 0.7, lowpass: 5000 });
      }
      this.nextGroan -= dt;
      if (this.nextGroan <= 0 && cam.distanceTo(this.musicAt) < 25 && this.dancers.length) {
        this.nextGroan = 4 + Math.random() * 6;
        const d = this.dancers[Math.floor(Math.random() * this.dancers.length)];
        this.sound?.sample(`zombie-${1 + Math.floor(Math.random() * 4)}`, d.holder.position.clone().add(new THREE.Vector3(0, 1.5, 0)), { ref: 3, rolloff: 1.2, max: 40, gain: 0.7 });
      }
    }
    // the bedroom: the doll's eyes on you; the covers rise and fall; the music box as you come in
    if (this.doll) {
      const want = Math.atan2(cam.x - this.doll.position.x, cam.z - this.doll.position.z);
      let dy = want - this.doll.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.doll.rotation.y += dy * (1 - Math.exp(-dt * 0.8));
    }
    if (this.lump) this.lump.scale.y = 1 + 0.18 * Math.sin(t * 1.4);
    const inBedroom = cam.distanceTo(this.bedroomAt) < 4.5;
    this.sound?.has?.('music-box');
    if (inBedroom && !this.wasInBedroom && this.sound?.has?.('music-box')) this.sound.sample('music-box', this.bedroomAt.clone(), { ref: 3, rolloff: 1.2, max: 30, gain: 0.6 });
    this.wasInBedroom = inBedroom;
    this.candleLight.intensity = 4 * flick;
    // the one real light: the strongest of the four where you are
    {
      let best = null;
      let bestK = 0;
      for (const L of [this.cauldronLight, this.partyLight, this.ghostLight, this.candleLight]) {
        const k = L.intensity / (1 + cam.distanceTo(L.position) ** 2 * 0.05);
        if (near && k > bestK) {
          bestK = k;
          best = L;
        }
      }
      if (best) {
        this.light.position.copy(best.position);
        this.light.color.copy(best.color);
        this.light.distance = best.distance;
        this.light.intensity = best.intensity;
      } else this.light.intensity = 0;
    }
    // the attic
    if (this.lid) this.lid.rotation.x = this.lidBase - Math.max(0, Math.sin(t * 0.5)) ** 6 * 0.35;
    if (this.cage) {
      this.cage.rotation.z = 0.1 * Math.sin(t * 0.8);
      this.cage.rotation.x = 0.05 * Math.sin(t * 0.6 + 1);
    }
    if (this.ghost) {
      this.ghost.position.y = 7.96 + 0.25 + 0.12 * Math.sin(t * 1.1);
      const want = Math.atan2(cam.x - this.ghost.position.x, cam.z - this.ghost.position.z);
      let dy = want - this.ghost.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.ghost.rotation.y += dy * (1 - Math.exp(-dt * 1.2));
      const d = cam.distanceTo(this.ghost.position);
      this.ghostLight.intensity = d < 15 ? 3 * (0.8 + 0.2 * Math.sin(t * 2)) : 0;
      // it talks when you come close
      this.nextLine -= dt;
      if (d < 7 && this.nextLine <= 0) {
        this.nextLine = 11 + Math.random() * 6;
        const line = LINES[this.lineAt++ % LINES.length];
        this._speak(line);
        this.say?.(`“${line}”`);
      } else if (d >= 7 && d < 14 && this.nextLine <= 0) {
        this.nextLine = 9 + Math.random() * 6;
        this.sound?.sample('whispers', this.ghost.position.clone().add(new THREE.Vector3(0, 1, 0)), { ref: 3, rolloff: 1.2, max: 30, gain: 0.5 });
      }
    }
  }

  /** The ghost's voice: the browser's own speech, low and slow, if it has any. */
  _speak(text) {
    try {
      const synth = window.speechSynthesis;
      const level = this.sound?.voice?.() ?? 1; // (silent with the sound off or muted)
      if (!synth || level <= 0) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 0.1;
      u.rate = 0.72;
      u.volume = 0.85 * level;
      const voice = synth.getVoices().find((v) => /en-GB/i.test(v.lang)) ?? synth.getVoices().find((v) => /^en/i.test(v.lang));
      if (voice) u.voice = voice;
      synth.speak(u);
    } catch {
      // (no speech here: the words still show)
    }
  }
}
