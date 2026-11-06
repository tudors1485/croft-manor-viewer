// Ambient sound, synthesised with Web Audio (no audio files):
// birdsong by day, crickets and the odd owl at night, a breeze outdoors, the fountain
// when you are near it, a ticking clock in the hall, and footsteps in Walk mode.
// Browsers only allow audio after a click, so it starts off and the panel switches it on.

import * as THREE from 'three';

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.listener = new THREE.Vector3();
    this.fountain = new THREE.Vector3(4.6, 1, 8.4);
    this.clock = new THREE.Vector3(-1.85, 1.2, -20.1);
    this._nextBird = 0;
    this._nextOwl = 8;
    this._nextTick = 0;
    this._tickSide = 0;
    this.night = 0;
    this.inside = 0;
  }

  async enable() {
    if (!this.ctx) this._build();
    await this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.4);
  }

  disable() {
    if (!this.ctx) return;
    this.on = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  _noiseBuffer(seconds = 2, brown = false) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  _loop(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  _build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // breeze: brown noise through a slowly wandering low-pass
    const brown = this._noiseBuffer(4, true);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this._loop(brown).connect(this.windFilter).connect(this.windGain).connect(this.master);

    // fountain: white noise, band-passed, with a little splashy flutter
    const white = this._noiseBuffer(3);
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.6;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    this._loop(white).connect(bp).connect(hp).connect(this.waterGain).connect(this.master);

    // crickets: a pulsed 4.5 kHz tone
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.frequency.value = 4500;
    const am = ctx.createGain();
    am.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 28;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    const chirp = ctx.createOscillator();
    chirp.type = 'square';
    chirp.frequency.value = 2.3;
    const chirpGain = ctx.createGain();
    chirpGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    chirp.connect(chirpGain).connect(am.gain);
    osc.connect(am).connect(this.cricketGain).connect(this.master);
    osc.start();
    lfo.start();
    chirp.start();

    this.white = white;
  }

  _bird(t) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const level = 0.025 + Math.random() * 0.03;
    g.connect(pan).connect(this.master);
    const notes = 2 + Math.floor(Math.random() * 5);
    const base = 2600 + Math.random() * 2200;
    let at = t;
    for (let n = 0; n < notes; n++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = base * (0.85 + Math.random() * 0.35);
      const len = 0.05 + Math.random() * 0.12;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.35 : 0.7), at + len);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, at);
      e.gain.linearRampToValueAtTime(level, at + 0.012);
      e.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(e).connect(g);
      o.start(at);
      o.stop(at + len + 0.02);
      at += len + 0.03 + Math.random() * 0.08;
    }
  }

  _owl(t) {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    pan.connect(this.master);
    const hoot = (at, len, f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, at);
      o.frequency.linearRampToValueAtTime(f * 0.93, at + len);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, at);
      e.gain.linearRampToValueAtTime(0.05, at + 0.06);
      e.gain.linearRampToValueAtTime(0.0001, at + len);
      o.connect(e).connect(pan);
      o.start(at);
      o.stop(at + len + 0.05);
    };
    hoot(t, 0.45, 420);
    hoot(t + 0.9, 0.18, 440);
    hoot(t + 1.15, 0.7, 430);
  }

  _tick(t, level) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = this._tickSide ? 3200 : 2600;
    bp.Q.value = 8;
    const e = ctx.createGain();
    e.gain.setValueAtTime(level, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(bp).connect(e).connect(this.master);
    src.start(t, Math.random() * 2, 0.05);
    this._tickSide ^= 1;
  }

  footstep(surface = 'stone', speed = 3) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = surface === 'grass' ? 'lowpass' : 'bandpass';
    f.frequency.value = surface === 'grass' ? 900 : surface === 'gravel' ? 2400 : 1200;
    f.Q.value = surface === 'stone' ? 2 : 0.7;
    const e = ctx.createGain();
    const level = (surface === 'gravel' ? 0.16 : surface === 'grass' ? 0.08 : 0.12) * Math.min(1.4, speed / 3);
    const len = surface === 'gravel' ? 0.16 : surface === 'grass' ? 0.12 : 0.07;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(level, t + 0.008);
    e.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(e).connect(this.master);
    src.start(t, Math.random() * 2, len + 0.02);
  }

  /** A heavy old door: a creak as it swings open, a soft thud as it shuts. */
  door(opening, distance = 2) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const level = 0.09 * Math.max(0.15, 1 - distance / 12);
    if (opening) {
      // a creak: a buzzy tone wandering in pitch, through a resonant band
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t);
      o.frequency.linearRampToValueAtTime(140, t + 0.25);
      o.frequency.linearRampToValueAtTime(110, t + 0.55);
      o.frequency.linearRampToValueAtTime(165, t + 0.8);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 5;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(level * 0.5, t + 0.08);
      e.gain.linearRampToValueAtTime(level * 0.35, t + 0.6);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      o.connect(bp).connect(e).connect(this.master);
      o.start(t);
      o.stop(t + 1);
    }
    // the latch (opening) or the thud of the door meeting its frame (closing)
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const lp = ctx.createBiquadFilter();
    lp.type = opening ? 'bandpass' : 'lowpass';
    lp.frequency.value = opening ? 2200 : 260;
    lp.Q.value = opening ? 6 : 0.8;
    const e = ctx.createGain();
    const at = opening ? t : t + 0.05;
    e.gain.setValueAtTime(opening ? level * 0.8 : level * 3, at);
    e.gain.exponentialRampToValueAtTime(0.0001, at + (opening ? 0.05 : 0.22));
    src.connect(lp).connect(e).connect(this.master);
    src.start(at, Math.random() * 2, 0.3);
  }

  /** Call once a frame. */
  update(dt, camera, { night, inside }) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.listener.copy(camera.position);
    const day = 1 - night;
    const outdoors = 1 - inside;

    this.windGain.gain.setTargetAtTime(0.05 * outdoors * (0.6 + 0.4 * day), t, 0.5);
    this.windFilter.frequency.setTargetAtTime(380 + 260 * Math.sin(t * 0.13) + 140 * Math.sin(t * 0.37), t, 0.8);

    const df = this.listener.distanceTo(this.fountain);
    const water = Math.max(0, 1 - df / 28) ** 2;
    this.waterGain.gain.setTargetAtTime(0.18 * water * (0.4 + 0.6 * outdoors), t, 0.3);

    this.cricketGain.gain.setTargetAtTime(0.008 * night * outdoors, t, 1.0);

    if (t > this._nextBird) {
      if (day > 0.3) this._bird(t + 0.05);
      this._nextBird = t + (0.8 + Math.random() * 3.5) / Math.max(0.2, day * (0.35 + 0.65 * outdoors));
    }
    if (t > this._nextOwl) {
      if (night > 0.7 && outdoors > 0.5) this._owl(t + 0.05);
      this._nextOwl = t + 14 + Math.random() * 22;
    }
    const dc = this.listener.distanceTo(this.clock);
    if (dc < 16 && t > this._nextTick) {
      this._tick(t + 0.01, 0.05 * Math.max(0, 1 - dc / 16) ** 1.5);
      this._nextTick = t + 1;
    } else if (dc >= 16) this._nextTick = t;
  }
}
