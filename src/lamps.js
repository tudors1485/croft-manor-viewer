// Evening and night: the manor's chandeliers, wall sconces and kitchen tubes light up.
// The fittings are found by splitting the merged light-fitting meshes into connected
// pieces. Every fitting gets a glowing flame (one Points draw call for all of them);
// a small pool of real point lights follows the camera to the nearest fittings.

import * as THREE from 'three';

const POOL_SIZE = 8;

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
            if (tips.length) for (const t of tips) flames.push([t.x, t.y, t.z, 0.15, Math.random() * 10, 0]);
            else {
              const r = span * 0.42;
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                flames.push([c.x + Math.cos(a) * r, b.max.y + 0.02, c.z + Math.sin(a) * r, 0.15, Math.random() * 10, 0]);
              }
            }
            this.fixtures.push({ pos: new THREE.Vector3(c.x, b.min.y + size.y * 0.6, c.z), kind: 'chandelier', power: 16 });
          } else {
            if (tips.length) for (const t of tips) flames.push([t.x, t.y, t.z, 0.12, Math.random() * 10, 0]);
            else flames.push([c.x, b.max.y + 0.03, c.z, 0.12, Math.random() * 10, 0]);
            this.fixtures.push({ pos: new THREE.Vector3(c.x, b.max.y, c.z), kind: 'sconce', power: 3.5 });
          }
        }
      } else if (name === 'cm_obj_TLlamp') {
        tlMat = o.material;
        for (const b of fittingsIn(o, 0.3)) {
          const c = b.getCenter(new THREE.Vector3());
          flames.push([c.x, c.y - 0.02, c.z, 0.5, 0, 1]);
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
    }

    // all flames in one draw call
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(flames.flatMap((f) => f.slice(0, 3)), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(flames.map((f) => f[3]), 1));
    geo.setAttribute('phase', new THREE.Float32BufferAttribute(flames.map((f) => f[4]), 1));
    geo.setAttribute('kind', new THREE.Float32BufferAttribute(flames.map((f) => f[5]), 1));
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: glowTexture() },
        uLevel: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: 800 },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float phase;
        attribute float kind;
        uniform float uTime;
        uniform float uScale;
        varying float vFlicker;
        varying float vKind;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float f = kind > 0.5 ? 1.0 : 0.82 + 0.1 * sin(uTime * 9.0 + phase) + 0.08 * sin(uTime * 23.0 + phase * 3.1);
          vFlicker = f;
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
          vec3 col = vKind > 1.5 ? vec3(1.0, 0.78, 0.5) * t.a * 1.8 : vKind > 0.5 ? vec3(0.85, 0.92, 1.0) * t.a * 1.6 : t.rgb * t.a * 2.2;
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

    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(0xffb870, 0, 18, 2);
      l.castShadow = false;
      l.visible = false;
      this.pool.push(l);
      scene.add(l);
    }
    this._order = this.fixtures.map((_, i) => i);
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
      flames.push([pos.x, pos.y - (kind === 'flood' ? 0.13 : 0), pos.z, glowSize, Math.random() * 10, 2]);
    };
    add(new THREE.Vector3(-1.5, 2.7, -10.2), 9, 0.35, 'lantern');
    for (const x of [-12, -6.5, 3.5, 9.5, 15.5, 21, 25.5]) {
      ray.origin.set(x, 1.0, 5);
      ray.direction.set(0, 0, -1);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 40);
      if (!hit) continue;
      add(new THREE.Vector3(x, 0.28, hit.point.z + 0.9), 7, 0.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(flames.flatMap((f) => f.slice(0, 3)), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(flames.map((f) => f[3]), 1));
    geo.setAttribute('phase', new THREE.Float32BufferAttribute(flames.map((f) => f[4]), 1));
    geo.setAttribute('kind', new THREE.Float32BufferAttribute(flames.map((f) => f[5]), 1));
    this.outdoorGlow = new THREE.Points(geo, this.glowMat);
    this.outdoorGlow.frustumCulled = false;
    this.outdoorGlow.renderOrder = 10;
    this.scene.add(this.outdoorGlow);
    this._order = this.fixtures.map((_, i) => i);
  }

  get count() {
    return this.fixtures.length;
  }

  get flameCount() {
    return this.glow.geometry.attributes.position.count;
  }

  /** @param level 0..1 how far into the evening it is */
  update(camera, level, dt, renderer) {
    this.level = level;
    this.glowMat.uniforms.uLevel.value = level;
    this.glowMat.uniforms.uTime.value += dt;
    this.glowMat.uniforms.uScale.value = renderer.domElement.height * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    this.glow.visible = level > 0.001;
    if (this.outdoorGlow) this.outdoorGlow.visible = level > 0.001;
    if (this.tlMat) this.tlMat.emissiveIntensity = 2.2 * level;

    // windows glow warmly when you are outside the house
    const outside = !this.houseBox.containsPoint(camera.position);
    const target = outside ? level : 0;
    this.windowsGlow += (target - this.windowsGlow) * (1 - Math.exp(-dt * 4));
    for (const m of this.glass) m.emissiveIntensity = 0.9 * this.windowsGlow;

    // the point lights go to the nearest fittings, outdoor ones first when you are outside
    const cp = camera.position;
    const d = this.fixtures.map((f) => f.pos.distanceToSquared(cp));
    const key = this.fixtures.map((f, i) => d[i] * (!!f.outdoor === outside ? 1 : 9));
    this._order.sort((a, b) => key[a] - key[b]);
    // switching lights on or off recompiles every shader, so the pool goes on and off together
    const on = level > 0.001;
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i];
      l.visible = on;
      const fi = this._order[i];
      const f = fi === undefined ? null : this.fixtures[fi];
      if (!f || !on) {
        l.intensity = 0;
        continue;
      }
      const dist = Math.sqrt(d[fi]);
      const fade = f.outdoor ? 1 - THREE.MathUtils.smoothstep(dist, 45, 80) : 1 - THREE.MathUtils.smoothstep(dist, 18, 30);
      l.position.copy(f.pos);
      l.color.set(f.kind === 'tube' ? 0xe8f0ff : f.kind === 'flood' ? 0xffc890 : 0xffb870);
      l.intensity = f.power * level * fade;
    }
  }
}
