// Other visitors, live, as faint lanterns walking the estate. Only where the site runs the small
// server for it (sfatosu.com's Worker, /api/visitors): elsewhere the setting never appears. Off
// until you tick it. While it is on, it shares one thing: where you are while you walk (a
// position, every half-second at most), under a random name the server gives this visit. Nothing
// about you, and nothing is kept: you are gone from everyone's estate when you leave or untick it.
// Not walking (orbiting, flying, a flyby), your lantern is put out.

import * as THREE from 'three';

const MAX = 50;

function glow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.12, 'rgba(255,240,200,0.9)');
  r.addColorStop(0.35, 'rgba(255,190,110,0.28)');
  r.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Lanterns {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.alpha = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glow() }, uScale: { value: 800 }, uNight: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float alpha;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = alpha;
          gl_PointSize = alpha > 0.001 ? clamp(0.9 * uScale / -mv.z, 3.0, 90.0) : 0.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uNight;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * t.a * vAlpha * (0.55 + 1.1 * uNight), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.name = 'Other visitors';
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.others = new Map(); // id -> { at, shown, seen, phase }
    this.ws = null;
    this.on = false;
    this.me = null;
    this._sent = null;
    this._sentAt = 0;
    this._retry = 0;
    this.onCount = null; // (n) => void: how many others are out walking
  }

  /** Whether this site has the server for it. */
  static async available() {
    // (only sfatosu.com and its local preview have it: anywhere else, don't even ask)
    if (!/(^|\.)sfatosu\.com$|\.localhost$/.test(location.hostname)) return false;
    try {
      const r = await fetch('/api/visitors/ping', { cache: 'no-store', headers: { accept: 'application/json' } });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return false;
      return (await r.json())?.ok === true;
    } catch {
      return false;
    }
  }

  setOn(on) {
    this.on = on;
    if (on) this._connect();
    else {
      this._retry = 0;
      this.ws?.close(1000, 'off');
      this.ws = null;
      this.others.clear();
      this.onCount?.(0);
    }
  }

  _connect() {
    if (!this.on || this.ws) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/visitors`);
    this.ws = ws;
    this._sent = null;
    ws.onmessage = (e) => this._message(e.data);
    ws.onopen = () => (this._retry = 0);
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.others.clear();
      this.onCount?.(0);
      // dropped while still on: try again, a little later each time
      if (this.on) setTimeout(() => this._connect(), Math.min(30000, 1000 * 2 ** this._retry++));
    };
    clearInterval(this._ping);
    // a word every half-minute keeps the line open (the server answers without waking up)
    this._ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 30000);
  }

  _message(data) {
    if (data === 'pong') return;
    let m;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    const valid = (p) => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number' && Number.isFinite(n));
    if (typeof m?.you === 'string') {
      this.me = m.you;
      for (const o of Array.isArray(m.all) ? m.all.slice(0, MAX) : []) if (typeof o?.id === 'string' && valid(o.p)) this._place(o.id, o.p);
    } else if (typeof m?.id === 'string' && m.id !== this.me) {
      if (m.gone) this.others.delete(m.id);
      else if (valid(m.p)) this._place(m.id, m.p);
    }
    this.onCount?.(this.others.size);
  }

  _place(id, p) {
    let o = this.others.get(id);
    if (!o) {
      if (this.others.size >= MAX) return;
      o = { at: new THREE.Vector3(...p), shown: new THREE.Vector3(...p), fade: 0, phase: Math.random() * 6.28 };
      this.others.set(id, o);
    } else o.at.set(...p);
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3|null} lantern where your own lantern is (null when you aren't walking)
   * @param {number} night 0 day .. 1 night
   * @param {number} scale the points' size scale (as the lamps' glows)
   */
  update(dt, lantern, night, scale) {
    // yours: sent when it has moved, at most twice a second (and put out when you stop walking)
    const ws = this.ws;
    const now = performance.now();
    if (this.on && ws?.readyState === 1) {
      if (lantern) {
        const moved = !this._sent || this._sent.distanceTo(lantern) > 0.15;
        if (moved && now - this._sentAt > 500) {
          ws.send(JSON.stringify({ p: lantern.toArray().map((n) => Math.round(n * 10) / 10) }));
          this._sent = (this._sent ?? new THREE.Vector3()).copy(lantern);
          this._sentAt = now;
        }
      } else if (this._sent) {
        ws.send(JSON.stringify({ p: null }));
        this._sent = null;
      }
    }
    // theirs: drifting smoothly to where they are, bobbing a little as if carried
    let i = 0;
    this._t = (this._t ?? 0) + dt;
    for (const o of this.others.values()) {
      if (i >= MAX) break;
      o.shown.lerp(o.at, 1 - Math.exp(-dt * 3));
      o.fade = Math.min(1, o.fade + dt);
      this.pos[i * 3] = o.shown.x;
      this.pos[i * 3 + 1] = o.shown.y + 0.04 * Math.sin(this._t * 2.2 + o.phase);
      this.pos[i * 3 + 2] = o.shown.z;
      this.alpha[i] = o.fade * (0.85 + 0.15 * Math.sin(this._t * 9 + o.phase * 3));
      i++;
    }
    for (; i < MAX; i++) this.alpha[i] = 0;
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true;
    a.alpha.needsUpdate = true;
    this.points.visible = this.others.size > 0;
    this.material.uniforms.uNight.value = night;
    this.material.uniforms.uScale.value = scale;
  }
}
