// Two more sights:
//
// - Balloons at dawn: on still summer mornings a few hot-air balloons drift low over the estate
//   from the west, their burners roaring and flaring now and then, each in its own stripes.
// - A summer garden party: on the east lawn at dusk, long tables laid with white cloths and candles,
//   chairs, festoon lights strung between posts round it and paper lanterns in the nearest tree, and
//   music (a recording, if there is one: `party-music`) from a gramophone on a side table.
//
// All drawn here (no models to load).

import * as THREE from 'three';

function stripes(colours) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  const n = 16;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colours[i % colours.length];
    g.fillRect((i / n) * 512, 0, 512 / n + 1, 64);
  }
  // a band round the middle, and darker seams
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(0, 26, 512, 6);
  g.strokeStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo((i / n) * 512, 0);
    g.lineTo((i / n) * 512, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function balloon(colours) {
  const g = new THREE.Group();
  // the envelope: a lathe of the classic shape, 17 m tall, 15 m across, its mouth at the bottom
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; // 0 the mouth .. 1 the crown
    const y = t * 17;
    const r = t < 0.3 ? THREE.MathUtils.lerp(2.2, 6.6, Math.sin(((t / 0.3) * Math.PI) / 2)) : 7.5 * Math.sin(Math.acos(Math.min(1, (t - 0.55) / 0.46))) * (t < 0.55 ? THREE.MathUtils.lerp(0.88, 1, (t - 0.3) / 0.25) : 1);
    pts.push(new THREE.Vector2(Math.max(0.05, r), y));
  }
  const env = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ map: stripes(colours), roughness: 0.75, side: THREE.DoubleSide }));
  env.position.y = 5.2;
  env.castShadow = true;
  g.add(env);
  // the basket and the burner frame; ropes from the mouth
  const wicker = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.95 });
  const basket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4).translate(0, 0.55, 0), wicker);
  basket.castShadow = true;
  g.add(basket);
  const steel = new THREE.LineBasicMaterial({ color: 0x2a2622 });
  const lines = [];
  for (const [x, z] of [
    [-0.65, -0.65],
    [0.65, -0.65],
    [0.65, 0.65],
    [-0.65, 0.65],
  ]) {
    lines.push(new THREE.Vector3(x, 1.1, z), new THREE.Vector3(x * 0.6, 2.6, z * 0.6));
    lines.push(new THREE.Vector3(x * 0.6, 2.6, z * 0.6), new THREE.Vector3(x * 3, 5.3, z * 3));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), steel));
  // the burner's flame: a glow in the mouth, flaring when it roars
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: new THREE.Color(2.4, 1.4, 0.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.position.y = 3.1;
  flame.scale.set(1.2, 2.4, 1);
  g.add(flame);
  return { group: g, flame };
}

function glow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.3, 'rgba(255,220,160,0.6)');
  r.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Balloons {
  constructor(scene, sound = null) {
    this.sound = sound;
    this.group = new THREE.Group();
    this.group.name = 'Balloons';
    this.group.visible = false;
    scene.add(this.group);
    const sets = [
      ['#c8202c', '#f2c84b'],
      ['#1f4f9a', '#f4f1e8', '#c8202c'],
      ['#2f8a4a', '#f2c84b'],
      ['#7b2e8f', '#f08a24'],
      ['#f4f1e8', '#1f4f9a'],
    ];
    this.list = sets.map((c, i) => {
      const b = balloon(c);
      this.group.add(b.group);
      // each its own line across the sky from the west, height and pace
      return { ...b, z: -110 + i * 38 + Math.random() * 15, y: 38 + Math.random() * 55, x0: -150 + i * 45 + Math.random() * 30, speed: 1.6 + Math.random() * 1.0, burn: Math.random() * 10, roar: 0, bob: Math.random() * 6 };
    });
    this.t = 0;
    this.always = false; // (the Sight)
  }

  /** Still summer mornings: June to August, at dawn, the odd day. */
  static on(day, hours, wind) {
    const d = Math.floor(day);
    return d >= 150 && d <= 240 && hours > 5 && hours < 9 && wind < 0.25 && Math.sin(d * 7.31) > 0.55;
  }

  update(dt, { day, hours, wind, camera }) {
    const on = this.always ? hours > 4.5 && hours < 10 : Balloons.on(day, hours, wind);
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    for (const b of this.list) {
      const x = b.x0 + this.t * b.speed;
      // (round again once over: a long loop out of sight to the east)
      const span = 760;
      const xx = ((((x + 380) % span) + span) % span) - 380;
      b.group.position.set(xx, b.y + Math.sin(this.t * 0.07 + b.bob) * 4, b.z);
      b.group.rotation.y = Math.sin(this.t * 0.03 + b.bob) * 0.6;
      // the burner: a few seconds' roar every half-minute or so
      b.burn -= dt;
      if (b.burn <= 0) {
        b.roar = 2 + Math.random() * 3;
        b.burn = 18 + Math.random() * 25;
        if (camera.position.distanceTo(b.group.position) < 400) this.sound?.sample?.('balloon-burner', b.group.position.clone().add(new THREE.Vector3(0, 3, 0)), { ref: 30, rolloff: 0.9, max: 900, gain: 0.8 });
      }
      b.roar = Math.max(0, b.roar - dt);
      b.flame.material.opacity = b.roar > 0 ? 0.75 + 0.25 * Math.sin(this.t * 40) : 0;
    }
  }
}

export class GardenParty {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {THREE.Vector3} o.at the middle of the party, on the lawn
   * @param {(x: number, z: number) => number} o.ground
   * @param {{ sample: Function, has?: Function }} [o.sound]
   */
  constructor(scene, { at, ground, sound = null, obstacles = [] }) {
    this.sound = sound;
    this.at = at;
    this.group = new THREE.Group();
    this.group.name = 'Garden party';
    this.group.visible = false;
    scene.add(this.group);
    this.always = false;
    const cloth = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xd8e4ea, roughness: 0.05, transparent: true, opacity: 0.45 });
    const y0 = ground(at.x, at.z);
    const flames = [];
    const put = (m, x, y, z) => {
      m.position.set(at.x + x, y0 + y, at.z + z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // two long tables, end to end along z, with cloths hanging, candles, glasses, and chairs
    for (const tx of [-2.2, 2.2]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 6.4), cloth), tx, 0.76, 0);
      put(new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.3, 6.44), cloth), tx, 0.6, 0);
      for (const [lx, lz] of [
        [-0.45, -3],
        [0.45, -3],
        [-0.45, 3],
        [0.45, 3],
      ])
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), wood), tx + lx, 0.22, lz);
      for (let k = -2.5; k <= 2.5; k += 1.25) {
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.24, 8), white), tx, 0.9, k);
        flames.push(new THREE.Vector3(at.x + tx, y0 + 1.05, at.z + k));
        for (const side of [-1, 1]) {
          put(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.12, 8), glass), tx + side * 0.36, 0.84, k + 0.3);
          // a chair: seat, back, legs
          const ch = new THREE.Group();
          ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.44).translate(0, 0.45, 0), white));
          ch.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.04).translate(0, 0.72, -0.2), white));
          for (const [a, b] of [
            [-0.19, -0.19],
            [0.19, -0.19],
            [-0.19, 0.19],
            [0.19, 0.19],
          ])
            ch.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 5).translate(a, 0.225, b), white));
          ch.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          ch.traverse((o) => o.isMesh && (o.castShadow = true));
          put(ch, tx + side * 0.85, 0, k + 0.3);
        }
      }
      obstacles.push({ x: at.x + tx, z: at.z - 2, r: 1.1, when: () => this.group.visible }, { x: at.x + tx, z: at.z + 2, r: 1.1, when: () => this.group.visible });
    }
    // the gramophone on a side table
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 20), wood), 0, 0.8, -4.4);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), wood), 0, 0.4, -4.4);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), wood), 0, 0.9, -4.4);
    const horn = put(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.3, side: THREE.DoubleSide })), 0.12, 1.25, -4.4);
    horn.rotation.z = -1.0;
    this.musicAt = new THREE.Vector3(at.x, y0 + 1.2, at.z - 4.4);
    // posts round it, and festoon lights strung between them, sagging
    const posts = [];
    const R = 6.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const p = new THREE.Vector3(at.x + Math.cos(a) * R, y0, at.z + Math.sin(a) * R * 1.25);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6), wood), p.x - at.x, 1.6, p.z - at.z);
      posts.push(p.setY(y0 + 3.1));
    }
    const bulbs = [];
    const wire = [];
    for (let i = 0; i < posts.length; i++) {
      // round the edge, and across to the post opposite
      for (const j of [(i + 1) % posts.length, i < 4 ? i + 4 : -1]) {
        if (j < 0) continue;
        const a = posts[i];
        const b = posts[j];
        const n = Math.round(a.distanceTo(b) / 0.5);
        let prev = null;
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const p = a.clone().lerp(b, t);
          p.y -= Math.sin(t * Math.PI) * (j === (i + 1) % posts.length ? 0.5 : 0.9);
          if (prev) wire.push(prev, p);
          prev = p;
          if (k % 1 === 0 && k > 0 && k < n) bulbs.push(p.clone().add(new THREE.Vector3(0, -0.08, 0)));
        }
      }
    }
    this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x151310 })));
    // the bulbs (and the candles' flames): glowing points, sized by the focal length
    const pts = [...bulbs.map((p) => [p, 0.2, [1, 0.78, 0.45]]), ...flames.map((p) => [p, 0.09, [1, 0.62, 0.25]])];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([p]) => [p.x, p.y, p.z]), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(pts.map(([, s]) => s), 1));
    geo.setAttribute('colour', new THREE.Float32BufferAttribute(pts.flatMap(([, , c]) => c), 3));
    this.lights = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 800 }, uMap: { value: glow() }, uOn: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float size;
          attribute vec3 colour;
          uniform float uScale;
          uniform float uTime;
          varying vec3 vColour;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            float f = size < 0.15 ? 0.85 + 0.15 * sin(uTime * 13.0 + position.z * 9.0) : 1.0;
            vColour = colour * f;
            gl_PointSize = clamp(size * uScale / -mv.z, 1.5, 48.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform float uOn;
          varying vec3 vColour;
          void main() {
            float a = texture2D(uMap, gl_PointCoord).a * uOn;
            gl_FragColor = vec4(vColour * a * 2.2, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.lights.frustumCulled = false;
    this.group.add(this.lights);
    // their light on the lawn and the cloths: one warm light, in the scene all year (dark)
    this.light = new THREE.PointLight(0xffc27a, 0, 18, 1.6);
    this.light.position.set(at.x, y0 + 2.8, at.z);
    scene.add(this.light);
    this.nextMusic = 0;
  }

  /** Midsummer weekends' evenings: Saturdays in June and July, from seven till midnight, when it's dry. */
  static on(day, hours, rain) {
    const d = Math.floor(day);
    const date = new Date(Date.UTC(new Date().getFullYear(), 0, 1 + d));
    return d >= 152 && d <= 212 && date.getUTCDay() === 6 && hours > 19 && hours < 24 && rain < 0.1;
  }

  update(dt, { day, hours, rain, dusk, camera, scale }) {
    const on = this.always ? hours > 17 || hours < 1 : GardenParty.on(day, hours, rain);
    this.group.visible = on;
    const lit = on ? THREE.MathUtils.clamp(dusk * 1.4, 0.15, 1) : 0;
    this.lights.material.uniforms.uOn.value = lit;
    this.lights.material.uniforms.uTime.value += dt;
    if (scale) this.lights.material.uniforms.uScale.value = scale;
    this.light.intensity = 14 * lit * (on ? 1 : 0);
    if (!on) return;
    // the music, again and again while you are near enough to hear it
    this.nextMusic -= dt;
    if (this.nextMusic <= 0 && this.sound?.has?.('party-music') && camera.position.distanceTo(this.musicAt) < 120) {
      this.nextMusic = (this.sound.duration?.('party-music') || 60) + 2;
      this.sound.sample('party-music', this.musicAt.clone(), { ref: 6, rolloff: 1.2, max: 140, gain: 0.7, lowpass: 6000 });
    }
  }
}
