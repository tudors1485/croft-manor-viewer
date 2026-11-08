// Evening and night: the manor's chandeliers, wall sconces and kitchen tubes light up.
// The fittings are found by splitting the merged light-fitting meshes into connected
// pieces. Every fitting gets a glowing flame (one Points draw call for all of them);
// every fitting casts real light: fittings within a few metres of each other share one
// point light, so the whole house is lit at once, wherever you are.
//
// After midnight the household goes to bed: most lights go out one by one between about
// half past eleven and half past one (a few stay on all night, and the porch lantern), until
// you go into the house, when the lights inside come back on. The panel can switch the lights
// of the room you are in, or of the whole house, on and off. A light going out only fades its
// brightness (switching a light off outright would recompile every shader).

import * as THREE from 'three';

const JOIN = 3.2; // fittings closer than this (and at about the same height) share a light
// Real lights: a fixed number, handed each frame to the light groups that matter most from where
// you are (near, bright, in view). Every point light costs every pixel, and past a couple of dozen
// the cost climbs steeply (three more on 41 took a fifth of the frame); and the number never
// changes, so nothing recompiles as they are handed round.
const POOL = 18;

/** Bounding boxes of the connected pieces of a merged mesh (world space). */
function partsIn(mesh) {
  const pos = mesh.geometry.attributes.position;
  const idx = mesh.geometry.index;
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
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      union(idx.getX(i), idx.getX(i + 1));
      union(idx.getX(i), idx.getX(i + 2));
    }
  }
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 200)},${Math.round(pos.getY(i) * 200)},${Math.round(pos.getZ(i) * 200)}`;
    if (seen.has(k)) union(i, seen.get(k));
    else seen.set(k, i);
  }
  mesh.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  const parts = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let b = parts.get(r);
    if (!b) parts.set(r, (b = new THREE.Box3()));
    b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  return [...parts.values()];
}

/** Pieces closer than `joinDistance` grouped into fittings. */
function fittingsIn(mesh, joinDistance = 0.8) {
  const groups = [];
  const c = new THREE.Vector3();
  for (const b of partsIn(mesh)) {
    b.getCenter(c);
    const g = groups.find((g) => g.distanceToPoint(c) < joinDistance);
    if (g) g.union(b);
    else groups.push(b.clone());
  }
  return groups;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,236,190,0.9)');
  grad.addColorStop(0.45, 'rgba(255,170,80,0.25)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Lamps {
  constructor(scene, model) {
    this.scene = scene;
    this.fixtures = []; // { pos, kind, power }
    this.level = 0;
    this.windowsGlow = 0;
    this.houseOn = true; // the panel's switch for the whole house
    this.dark = false; // Halloween: the house dark (seen from outside; inside, the lights still come on)
    this.cut = 0; // the lights failing in a storm (spooky.js): 0 on .. 1 all out
    this.flicker = 0; // Halloween night: how much the lamps outside falter (0 steady .. 1)
    this.houseBox = new THREE.Box3(new THREE.Vector3(-14.6, -1, -32.2), new THREE.Vector3(29.4, 13, -9.3));

    const flames = []; // [x, y, z, size, phase, kind]
    let tlMat = null;
    this.glass = [];

    // candles: small upright pieces of glass (chandeliers) and white wood (sconces)
    const candles = [];
    model.traverse((o) => {
      if (!o.isMesh || !/^(cm_glass_bedroom|cm_whitewood)$/.test(o.material.name)) return;
      for (const b of partsIn(o)) {
        const s = b.getSize(new THREE.Vector3());
        if (s.y > 0.04 && s.y < 0.4 && s.x < 0.12 && s.z < 0.12) candles.push(b);
      }
    });
    const candleTips = (box) => {
      const grown = box.clone().expandByScalar(0.12);
      const tips = [];
      for (const b of candles) {
        const c = b.getCenter(new THREE.Vector3());
        if (grown.containsPoint(c)) tips.push(new THREE.Vector3(c.x, b.max.y + 0.035, c.z));
      }
      return tips;
    };

    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name || '';
      if (name === 'cm_obj_sconcegold') {
        for (const b of fittingsIn(o)) {
          const size = b.getSize(new THREE.Vector3());
          const c = b.getCenter(new THREE.Vector3());
          const span = Math.max(size.x, size.z);
          if (Math.max(size.x, size.y, size.z) < 0.15) continue; // bed finials
          const tips = candleTips(b);
          if (span >= 0.7) {
            // chandelier: a flame on every candle, or a ring on the arms if none are found
            const fx = this.fixtures.length;
            if (tips.length) for (const t of tips) flames.push([t.x, t.y, t.z, 0.15, Math.random() * 10, 0, fx]);
            else {
              const r = span * 0.42;
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                flames.push([c.x + Math.cos(a) * r, b.max.y + 0.02, c.z + Math.sin(a) * r, 0.15, Math.random() * 10, 0, fx]);
              }
            }
            this.fixtures.push({ pos: new THREE.Vector3(c.x, b.min.y + size.y * 0.6, c.z), kind: 'chandelier', power: 16 });
          } else {
            const fx = this.fixtures.length;
            if (tips.length) for (const t of tips) flames.push([t.x, t.y, t.z, 0.12, Math.random() * 10, 0, fx]);
            else flames.push([c.x, b.max.y + 0.03, c.z, 0.12, Math.random() * 10, 0, fx]);
            this.fixtures.push({ pos: new THREE.Vector3(c.x, b.max.y, c.z), kind: 'sconce', power: 3.5 });
          }
        }
      } else if (name === 'cm_obj_TLlamp') {
        tlMat = o.material;
        for (const b of fittingsIn(o, 0.3)) {
          const c = b.getCenter(new THREE.Vector3());
          flames.push([c.x, c.y - 0.02, c.z, 0.5, 0, 1, this.fixtures.length]);
          this.fixtures.push({ pos: new THREE.Vector3(c.x, c.y - 0.15, c.z), kind: 'tube', power: 9 });
        }
      } else if (/glass/.test(name)) {
        this.glass.push(o.material);
      }
    });
    if (tlMat) {
      tlMat.emissive = new THREE.Color(0xeef4ff);
      tlMat.emissiveIntensity = 0;
      this.tlMat = tlMat;
    }
    for (const m of this.glass) {
      m.emissive = new THREE.Color(0xffb25a);
      m.emissiveIntensity = 0;
      // seen from outside by day, old glass is dark and mirrors the sky and the trees (TRJTA's
      // renders); from inside it stays clear to look out through (update)
      m.userData.clearOpacity = m.opacity;
      m.color.multiplyScalar(0.55);
      m.roughness = 0.04;
      m.metalness = 0;
    }
    this._outGlass = 1;

    // all flames in one draw call
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(flames.flatMap((f) => f.slice(0, 3)), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(flames.map((f) => f[3]), 1));
    geo.setAttribute('phase', new THREE.Float32BufferAttribute(flames.map((f) => f[4]), 1));
    geo.setAttribute('kind', new THREE.Float32BufferAttribute(flames.map((f) => f[5]), 1));
    geo.setAttribute('group', new THREE.Float32BufferAttribute(new Float32Array(flames.length), 1));
    this._flameFixtures = flames.map((f) => f[6]);
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: glowTexture() },
        uLevel: { value: 0 },
        uOn: { value: new Float32Array(64) }, // each light group's brightness, 0..1
        uTime: { value: 0 },
        uScale: { value: 800 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float phase;
        attribute float kind;
        attribute float group;
        uniform float uTime;
        uniform float uScale;
        uniform float uOn[64];
        varying float vFlicker;
        varying float vKind;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float f = kind > 0.5 ? 1.0 : 0.82 + 0.1 * sin(uTime * 9.0 + phase) + 0.08 * sin(uTime * 23.0 + phase * 3.1);
          vFlicker = f * uOn[int(group + 0.5)];
          vKind = kind;
          gl_PointSize = size * f * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uLevel;
        varying float vFlicker;
        varying float vKind;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          vec3 col = vKind > 2.5 ? vec3(1.0, 0.52, 0.1) * t.a * 2.0 : vKind > 1.5 ? vec3(1.0, 0.78, 0.5) * t.a * 1.8 : vKind > 0.5 ? vec3(0.85, 0.92, 1.0) * t.a * 1.6 : t.rgb * t.a * 2.2;
          gl_FragColor = vec4(col * uLevel * vFlicker, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glow = new THREE.Points(geo, this.glowMat);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 10;
    scene.add(this.glow);

    this.lights = [];
    this._buildLights();
  }

  /** One light group per group of nearby fittings, each switched (and put to bed) on its own (the real lights are handed out among them: _handOut). */
  _buildLights() {
    if (!this.pool) {
      this.pool = [];
      for (let k = 0; k < POOL; k++) {
        const light = new THREE.PointLight(0xffffff, 0, 10, 2);
        light.castShadow = false;
        light.visible = false;
        this.scene.add(light);
        this.pool.push({ light, group: -1 });
      }
    }
    for (const p of this.pool) p.group = -1;
    const groups = [];
    const fixtureGroup = new Int32Array(this.fixtures.length);
    const order = this.fixtures.map((f, i) => i).sort((a, b) => this.fixtures[b].power - this.fixtures[a].power);
    for (const i of order) {
      const f = this.fixtures[i];
      if (f.glowOnly) continue; // (a glow with no light of its own: it follows another's, below)
      let gi = groups.findIndex(
        (g) => !!g.outdoor === !!f.outdoor && g.kind === f.kind && Math.hypot(g.pos.x - f.pos.x, g.pos.z - f.pos.z) < JOIN && Math.abs(g.pos.y - f.pos.y) < 1.5,
      );
      if (gi >= 0) {
        const g = groups[gi];
        g.pos.multiplyScalar(g.power).addScaledVector(f.pos, f.power).divideScalar(g.power + f.power);
        g.power += f.power;
        g.range = Math.max(g.range ?? 0, f.range ?? 0) || undefined;
      } else {
        gi = groups.length;
        groups.push({ pos: f.pos.clone(), power: f.power, kind: f.kind, outdoor: f.outdoor, range: f.range });
      }
      fixtureGroup[i] = gi;
    }
    this.fixtures.forEach((f, i) => {
      if (f.glowOnly) fixtureGroup[i] = fixtureGroup[f.follow] ?? 0;
    });
    this._fixtureGroup = fixtureGroup;
    this.lights = groups.map((g, i) => {
      const colour = g.kind === 'tube' ? 0xe8f0ff : g.kind === 'flood' || g.kind === 'lantern' ? 0xffc890 : g.kind === 'pool' ? 0x7fe6ff : g.kind === 'fountain' ? 0xfff0d6 : 0xffb870;
      // a shared light is stronger, but less than the sum (the fittings were close together)
      const power = g.power * 0.85;
      const range = g.range ?? (g.outdoor ? 26 : 9 + Math.sqrt(power) * 1.6);
      // bedtime: most lights go out between about 23:25 and 01:30, one by one; about a quarter
      // stay on all night, as does the porch lantern; the floodlights go off around half past
      // midnight and the pool light at eleven
      const r = hash(i * 7.31 + g.pos.x * 0.13 + g.pos.z * 0.71);
      const bedtime = g.kind === 'lantern' ? null : g.kind === 'flood' || g.kind === 'fountain' ? 0.4 + r * 0.25 : g.kind === 'pool' ? 23 : r < 0.25 ? null : 23.4 + ((r - 0.25) / 0.75) * 2.1;
      return { colour: new THREE.Color(colour), range, power, pos: g.pos, kind: g.kind, outdoor: !!g.outdoor, bedtime, manual: null, on: 0, pooled: 0, score: 0 };
    });
    // the flames take their light group's brightness
    for (const [glow, fixtures] of [
      [this.glow, this._flameFixtures],
      [this.outdoorGlow, this._outFlameFixtures],
    ]) {
      if (!glow || !fixtures) continue;
      const attr = glow.geometry.attributes.group;
      fixtures.forEach((fx, k) => attr.setX(k, fx != null && fx < fixtureGroup.length ? fixtureGroup[fx] : 0));
      attr.needsUpdate = true;
    }
  }

  /**
   * The house's switch: off puts out every light inside the house at once (the porch lantern and
   * the floodlights outside stay on); on hands them back to the evening and bedtime.
   */
  setHouse(on) {
    this.houseOn = on;
    for (const l of this.lights) if (!l.outdoor) l.manual = null;
  }

  /** The outdoor switch: the lamps, the floodlights, the porch lantern and the course's lights. */
  setOutdoor(on) {
    this.outdoorOn = on;
    for (const l of this.lights) if (l.outdoor) l.manual = null;
  }

  /**
   * The light groups of the room you are in: indoor ones you can see from where you stand
   * (a ray to the light meets nothing on the way), within a dozen metres.
   */
  roomGroups(camera, bvh, skip) {
    if (!this.houseBox.containsPoint(camera.position)) return [];
    const out = [];
    const ray = new THREE.Ray();
    const to = new THREE.Vector3();
    this.lights.forEach((l, i) => {
      if (l.outdoor) return;
      to.subVectors(l.pos, camera.position);
      const d = to.length();
      if (d > 12 || Math.abs(to.y) > 4) return;
      ray.set(camera.position, to.divideScalar(d));
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, d - 0.35);
      if (hit && !(skip && skip(hit.faceIndex))) return;
      out.push(i);
    });
    return out;
  }

  /** Is a group lit (or going to be, once it fades up)? */
  lit(i) {
    return this._want?.[i] > 0.5;
  }

  /** Switch the given groups (the room's) on or off, whatever the time or the house switch says. */
  setGroups(list, on) {
    for (const i of list) this.lights[i].manual = on;
  }

  /** The light group a fixture belongs to ({ light, on, … }), or null. */
  fixtureLight(i) {
    return this.lights[this._fixtureGroup?.[i]] ?? null;
  }

  get lightCount() {
    return this.lights.length;
  }

  /** How many real lights there are for them. */
  get poolSize() {
    return this.pool?.length ?? 0;
  }

  /**
   * Outdoor lights, placed once the collision tree can answer ray queries:
   * a lantern in the porch and warm floodlights at the foot of the front facade.
   */
  addOutdoor(bvh) {
    const ray = new THREE.Ray();
    const flames = [];
    const add = (pos, power, glowSize, kind = 'flood') => {
      this.fixtures.push({ pos, kind, power, outdoor: true });
      flames.push([pos.x, pos.y - (kind === 'flood' ? 0.13 : 0), pos.z, glowSize, Math.random() * 10, 2, this.fixtures.length - 1]);
    };
    add(new THREE.Vector3(-1.5, 2.7, -10.2), 9, 0.35, 'lantern');
    for (const x of [-12, -6.5, 3.5, 9.5, 15.5, 21, 25.5]) {
      ray.origin.set(x, 1.0, 5);
      ray.direction.set(0, 0, -1);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 40);
      if (!hit) continue;
      add(new THREE.Vector3(x, 0.28, hit.point.z + 0.9), 7, 0.2);
    }
    this._outFlames = flames;
    this._outdoorGlow();
    this._buildLights();
  }

  /**
   * More lights outside, once their places are known (nightlights.js: the gateway's lanterns, the
   * fountain's, the assault course's): { pos, kind, power, glow (its size), range, glowOnly and
   * follow (a glow with no light, lit with that fixture), glowKind }. Before the first frame only:
   * new lights recompile every shader.
   */
  addMore(list) {
    const base = this.fixtures.length;
    for (const f of list) {
      this.fixtures.push({ pos: f.pos, kind: f.kind, power: f.power, outdoor: true, range: f.range, glowOnly: !!f.glowOnly, follow: f.follow != null ? base + f.follow : undefined });
      this._outFlames.push([f.pos.x, f.pos.y, f.pos.z, f.glow ?? 0.2, Math.random() * 10, f.glowKind ?? 2, this.fixtures.length - 1]);
    }
    this._outdoorGlow();
    this._buildLights();
  }

  _outdoorGlow() {
    const flames = this._outFlames;
    if (this.outdoorGlow) {
      this.scene.remove(this.outdoorGlow);
      this.outdoorGlow.geometry.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(flames.flatMap((f) => f.slice(0, 3)), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(flames.map((f) => f[3]), 1));
    geo.setAttribute('phase', new THREE.Float32BufferAttribute(flames.map((f) => f[4]), 1));
    geo.setAttribute('kind', new THREE.Float32BufferAttribute(flames.map((f) => f[5]), 1));
    geo.setAttribute('group', new THREE.Float32BufferAttribute(new Float32Array(flames.length), 1));
    this._outFlameFixtures = flames.map((f) => f[6]);
    this.outdoorGlow = new THREE.Points(geo, this.glowMat);
    this.outdoorGlow.frustumCulled = false;
    this.outdoorGlow.renderOrder = 10;
    this.scene.add(this.outdoorGlow);
  }

  get count() {
    return this.fixtures.length;
  }

  get flameCount() {
    return this.glow.geometry.attributes.position.count;
  }

  /**
   * @param level 0..1 how far into the evening it is
   * @param hours the time on the clock, for bedtime
   */
  update(camera, level, dt, renderer, hours = 18) {
    this.level = level;
    const u = this.glowMat.uniforms;
    u.uLevel.value = 1;
    u.uTime.value += dt;
    u.uScale.value = renderer.domElement.height * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const inside = this.houseBox.containsPoint(camera.position);
    // hours since noon, so the night runs on without a break at midnight
    const sinceNoon = (h) => (h - 12 + 24) % 24;
    const now = sinceNoon(hours);
    this._want = this._want ?? new Float32Array(this.lights.length);
    let lit = 0;
    let tubes = 0;
    let indoorOn = 0;
    let indoor = 0;
    this.lights.forEach((l, i) => {
      // in bed from its bedtime until half past six, unless you are in the house (then the lights
      // inside come back on: nobody wants to walk round a dark house)
      const asleep = l.bedtime != null && now >= sinceNoon(l.bedtime) && now < sinceNoon(6.5) && !(inside && !l.outdoor);
      const dark = this.dark && !l.outdoor && !inside;
      const auto = (l.outdoor ? this.outdoorOn !== false : this.houseOn !== false) && !asleep && !dark ? level : 0;
      // a light switched on by hand shines by day too
      const want = l.manual === true ? 1 : l.manual === false ? 0 : auto;
      this._want[i] = want;
      l.on += (want - l.on) * (1 - Math.exp(-dt * 3.5));
      if (Math.abs(want - l.on) < 0.002) l.on = want;
      // Halloween night: the lamps outside falter now and then (a stutter, a dip, out for a moment),
      // and are never quite steady between
      l.flv = 1;
      if (this.flicker > 0 && l.outdoor) {
        const T = u.uTime.value;
        const F = (l.fl ??= { next: hash(i) * 7, until: 0, kind: 0 });
        if (T >= F.next) {
          F.until = T + 0.15 + Math.random() * 1.2;
          F.kind = Math.random();
          F.next = F.until + 2 + Math.random() * 10;
        }
        let f;
        if (T < F.until) f = F.kind < 0.6 ? (Math.sin(T * 47 + i * 3.7) > 0.15 ? 1 : 0.06) * (0.65 + 0.35 * Math.sin(T * 13 + i)) : F.kind < 0.85 ? 0.35 : 0.02;
        else f = 0.93 + 0.07 * Math.sin(T * 9 + i * 2.1) * Math.sin(T * 3.3 + i);
        l.flv = 1 - this.flicker * (1 - f);
      }
      u.uOn.value[i] = l.on * (1 - this.cut) * l.flv;
      lit = Math.max(lit, l.on);
      if (l.kind === 'tube') tubes = Math.max(tubes, l.on);
      if (!l.outdoor) {
        indoor++;
        indoorOn += l.on;
      }
    });
    this._handOut(camera, inside, dt);
    // the pool stays in the scene while any light is lit (adding or removing one recompiles every shader)
    const any = lit > 0.001;
    for (const { light } of this.pool) light.visible = any;
    this.glow.visible = any;
    if (this.outdoorGlow) this.outdoorGlow.visible = any;
    if (this.tlMat) this.tlMat.emissiveIntensity = 2.2 * tubes;

    // windows glow warmly when you are outside the house, as much as the lights inside are on
    const target = inside ? 0 : indoor ? indoorOn / indoor : 0;
    this.windowsGlow += (target - this.windowsGlow) * (1 - Math.exp(-dt * 4));
    this._outGlass += ((inside ? 0 : 1) - this._outGlass) * (1 - Math.exp(-dt * 4));
    for (const m of this.glass) {
      m.emissiveIntensity = 0.9 * this.windowsGlow;
      m.opacity = THREE.MathUtils.lerp(m.userData.clearOpacity ?? 0.35, 0.66, this._outGlass);
      m.envMapIntensity = THREE.MathUtils.lerp(1, 2.8, this._outGlass);
    }
  }
}

const _frustum = new THREE.Frustum();
const _view = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

/** Gives the real lights to the light groups that matter most from here: bright, near, in view. */
Lamps.prototype._handOut = function (camera, inside, dt) {
  _frustum.setFromProjectionMatrix(_view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const cam = camera.position;
  const cut = 1 - this.cut;
  const lit = [];
  this.lights.forEach((l, i) => {
    const strength = l.power * l.on * cut;
    if (strength < 0.01) {
      l.score = 0;
      return;
    }
    const d = Math.max(0, l.pos.distanceTo(cam) - l.range * 0.6);
    let score = strength / (1 + (d / 12) ** 2);
    if (!_frustum.intersectsSphere(_sphere.set(l.pos, l.range))) score *= 0.05; // (behind you, out of sight)
    // (indoors, the lights outside are behind the walls; outside, the rooms' lights are behind the glass)
    if (inside === l.outdoor) score *= inside ? 0.12 : 0.35;
    l.score = score;
    lit.push(i);
  });
  lit.sort((a, b) => this.lights[b].score - this.lights[a].score);
  const chosen = new Set(lit.slice(0, this.pool.length));
  // (a group keeps its light while it stays among the chosen; the newly chosen take the free ones)
  for (const p of this.pool) if (p.group >= 0 && !chosen.has(p.group)) p.group = -1;
  const has = new Set(this.pool.map((p) => p.group));
  for (const i of chosen) {
    if (has.has(i)) continue;
    const p = this.pool.find((q) => q.group < 0);
    if (!p) break;
    p.group = i;
    this.lights[i].pooled = 0; // (and fades in, rather than popping on)
  }
  for (const p of this.pool) {
    if (p.group < 0) {
      p.light.intensity = 0;
      continue;
    }
    const l = this.lights[p.group];
    l.pooled = Math.min(1, l.pooled + dt * 5);
    p.light.position.copy(l.pos);
    p.light.color.copy(l.colour);
    p.light.distance = l.range;
    p.light.intensity = l.power * l.on * cut * l.pooled * (l.flv ?? 1);
  }
};

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
