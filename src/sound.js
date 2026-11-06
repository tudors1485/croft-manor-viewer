// Ambient sound, synthesised with Web Audio (no audio files).
//
// What you hear: birdsong in spring and summer, crickets on warm nights, the odd owl, a
// breeze outdoors (gustier in autumn and winter), rain, the fountain, the grandfather
// clock in the hall, footsteps in Walk mode, the doors, and the air rushing past when you
// fly fast. The clock, the fountain and the doors are placed in 3D around a listener that
// follows the camera, so you can tell where they are as you move or fly around them; walls
// muffle the clock when you are outside and the fountain when you are in.
//
// Browsers only allow audio after a click, so it starts off and the panel switches it on.
// It can also run on an OfflineAudioContext (for recording a flyby to video).

import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

export class Soundscape {
  /** @param {{ context?: BaseAudioContext }} [opts] give a context to render offline */
  constructor(opts = {}) {
    this.ctx = null;
    this._context = opts.context ?? null;
    this.on = false;
    this.listener = new THREE.Vector3();
    this.fountain = new THREE.Vector3(4.6, 1.4, 8.4);
    this.clock = new THREE.Vector3(-1.85, 1.9, -20.1);
    this._nextBird = 0;
    this._nextOwl = 8;
    this._nextTick = 0;
    this._tickSide = 0;
    this.snow = 0;
  }

  async enable() {
    if (!this.ctx) this._build();
    if (!this._context) await this.ctx.resume(); // (an offline context starts when it renders)
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

  /** A sound source at a place in the world (HRTF panning, quieter with distance). */
  _placed(position, { ref = 2, rolloff = 1.1, max = 80 } = {}) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = max;
    if (p.positionX) {
      p.positionX.value = position.x;
      p.positionY.value = position.y;
      p.positionZ.value = position.z;
    } else p.setPosition(position.x, position.y, position.z);
    p.connect(this.master);
    return p;
  }

  _filter(type, frequency, Q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = Q;
    return f;
  }

  _build() {
    const ctx = (this.ctx = this._context ?? new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this._context ? 0.9 : 0;
    this.master.connect(ctx.destination);

    const brown = this._noiseBuffer(4, true);
    const white = (this.white = this._noiseBuffer(3));

    // breeze: brown noise through a slowly wandering low-pass, with gusts
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windFilter = this._filter('lowpass', 500);
    this._loop(brown).connect(this.windFilter).connect(this.windGain).connect(this.master);
    // and the whistle of a strong wind round the house
    this.howlGain = ctx.createGain();
    this.howlGain.gain.value = 0;
    this.howlFilter = this._filter('bandpass', 700, 6);
    this._loop(white).connect(this.howlFilter).connect(this.howlGain).connect(this.master);

    // rain: a soft hiss of drops, and closer pattering
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this._loop(white).connect(this._filter('lowpass', 5200)).connect(this._filter('highpass', 400)).connect(this.rainGain).connect(this.master);

    // the air rushing past your ears when you fly fast
    this.rushGain = ctx.createGain();
    this.rushGain.gain.value = 0;
    this.rushFilter = this._filter('bandpass', 600, 0.8);
    this._loop(white).connect(this.rushFilter).connect(this.rushGain).connect(this.master);

    // fountain: band-passed noise at the fountain, muffled when you are indoors
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    this.waterMuffle = this._filter('lowpass', 8000);
    this._loop(white)
      .connect(this._filter('bandpass', 1800, 0.6))
      .connect(this._filter('highpass', 500))
      .connect(this.waterGain)
      .connect(this.waterMuffle)
      .connect(this._placed(this.fountain, { ref: 3, rolloff: 1.3 }));

    // the grandfather clock: ticks go through a filter (the walls, when you are outside)
    this.clockMuffle = this._filter('lowpass', 9000);
    this.clockGain = ctx.createGain();
    this.clockGain.gain.value = 1;
    this.clockMuffle.connect(this.clockGain).connect(this._placed(this.clock, { ref: 1.6, rolloff: 1.15, max: 60 }));

    // crickets: a chorus of a dozen, each its own pitch, place, rhythm and loudness. A
    // cricket's chirp is a few quick pulses of a pure high tone; each one keeps a steady
    // beat, with the odd rest. Every cricket is one oscillator whose gain is scheduled.
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.master);
    this.crickets = [];
    for (let i = 0; i < 12; i++) {
      const o = ctx.createOscillator();
      o.frequency.value = 3900 + Math.random() * 1500;
      const g = ctx.createGain();
      g.gain.value = 0;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 1.8 - 0.9;
      o.connect(g).connect(pan).connect(this.cricketGain);
      o.start();
      this.crickets.push({
        gain: g,
        next: ctx.currentTime + Math.random() * 2,
        pulses: 2 + Math.floor(Math.random() * 3),
        rate: 24 + Math.random() * 14, // pulses a second within a chirp
        period: 0.45 + Math.random() * 0.6, // seconds from chirp to chirp
        level: (0.35 + Math.random() * 0.65) * (i < 4 ? 1 : 0.45), // a few close, the rest further off
      });
    }
    // and the far-off shimmer of many more, too many to pick out
    this.shimmerGain = ctx.createGain();
    this.shimmerGain.gain.value = 0;
    const shimmerAm = ctx.createGain();
    shimmerAm.gain.value = 0.6;
    const trill = ctx.createOscillator();
    trill.frequency.value = 31;
    const trillDepth = ctx.createGain();
    trillDepth.gain.value = 0.4;
    trill.connect(trillDepth).connect(shimmerAm.gain);
    trill.start();
    this._loop(white).connect(this._filter('bandpass', 4600, 9)).connect(shimmerAm).connect(this.shimmerGain).connect(this.master);

    this.creak = this._creakBuffer();
  }

  /**
   * A dry hinge: stick-slip, a train of tiny clicks whose rate wanders, each one ringing
   * the wood of the door (two resonances), louder in the middle of the swing.
   */
  _creakBuffer() {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.round(sr * 1.25);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let t = 0.02;
    let n = 0;
    while (t < 1.15) {
      const u = t / 1.15;
      const rate = 38 + 90 * Math.sin(u * Math.PI * 1.3 + 0.4) ** 2 + 25 * Math.sin(u * 23 + n * 0.3);
      const amp = Math.sin(u * Math.PI) ** 0.6 * (0.6 + 0.4 * Math.random());
      const i0 = Math.round(t * sr);
      for (let i = 0; i < sr * 0.012 && i0 + i < len; i++) {
        const s = i / sr;
        const ring = Math.sin(2 * Math.PI * 740 * s) * Math.exp(-s * 520) + 0.6 * Math.sin(2 * Math.PI * 1620 * s) * Math.exp(-s * 800) + 0.35 * Math.sin(2 * Math.PI * 310 * s) * Math.exp(-s * 300);
        d[i0 + i] += ring * amp;
      }
      t += 1 / Math.max(25, rate);
      n++;
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= peak || 1;
    return buf;
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

  /** Schedules each cricket's next chirps, a little ahead of time. */
  _chirps(now) {
    for (const c of this.crickets) {
      while (c.next < now + 0.25) {
        const at = Math.max(c.next, now);
        const g = c.gain.gain;
        for (let p = 0; p < c.pulses; p++) {
          const s = at + p / c.rate;
          const len = 0.55 / c.rate;
          g.setValueAtTime(0, s);
          g.linearRampToValueAtTime(c.level, s + len * 0.25);
          g.linearRampToValueAtTime(0, s + len);
        }
        // a steady beat, now and then a rest
        c.next = at + c.period * (0.93 + Math.random() * 0.14) + (Math.random() < 0.06 ? 1.5 + Math.random() * 4 : 0);
      }
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

  /** One beat of the grandfather clock: a woody tick, then (next second) a tock. */
  _tick(t) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const bp = this._filter('bandpass', this._tickSide ? 2300 : 2900, 7);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.32, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp).connect(e).connect(this.clockMuffle);
    src.start(t, Math.random() * 2, 0.06);
    // the case resonates a little
    const o = ctx.createOscillator();
    o.frequency.value = this._tickSide ? 420 : 520;
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(0.05, t);
    oe.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(oe).connect(this.clockMuffle);
    o.start(t);
    o.stop(t + 0.1);
    this._tickSide ^= 1;
  }

  footstep(surface = 'stone', speed = 3) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    // snow on the ground: a soft, squeaky crunch outdoors
    if (this.snow > 0.5 && surface !== 'stone') surface = 'snow';
    const f = this._filter(
      surface === 'grass' ? 'lowpass' : 'bandpass',
      surface === 'grass' ? 900 : surface === 'gravel' ? 2400 : surface === 'snow' ? 3200 : 1200,
      surface === 'stone' ? 2 : surface === 'snow' ? 1.4 : 0.7,
    );
    const e = ctx.createGain();
    const level = (surface === 'gravel' ? 0.16 : surface === 'grass' ? 0.08 : surface === 'snow' ? 0.11 : 0.12) * Math.min(1.4, speed / 3);
    const len = surface === 'gravel' ? 0.16 : surface === 'grass' ? 0.12 : surface === 'snow' ? 0.22 : 0.07;
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(level, t + 0.008);
    e.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(e).connect(this.master);
    src.start(t, Math.random() * 2, len + 0.02);
  }

  /** A heavy old door at `position`: latch and creak as it opens, a thud and the latch as it shuts. */
  door(opening, position) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const out = this._placed(position, { ref: 2.5, rolloff: 1 });
    const click = (at, level) => {
      const src = ctx.createBufferSource();
      src.buffer = this.white;
      const e = ctx.createGain();
      e.gain.setValueAtTime(level, at);
      e.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
      src.connect(this._filter('bandpass', 2600, 5)).connect(e).connect(out);
      src.start(at, Math.random() * 2, 0.05);
    };
    if (opening) {
      click(t, 0.5);
      const src = ctx.createBufferSource();
      src.buffer = this.creak;
      src.playbackRate.value = 0.85 + Math.random() * 0.3;
      const e = ctx.createGain();
      e.gain.value = 0.55;
      src.connect(this._filter('highpass', 180)).connect(e).connect(out);
      src.start(t + 0.08);
    } else {
      // the weight of the door meeting its frame, then the latch dropping
      const src = ctx.createBufferSource();
      src.buffer = this.white;
      const e = ctx.createGain();
      e.gain.setValueAtTime(1.6, t);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      src.connect(this._filter('lowpass', 220)).connect(e).connect(out);
      src.start(t, Math.random() * 2, 0.35);
      click(t + 0.06, 0.45);
    }
  }

  _setListener(camera, t) {
    const l = this.ctx.listener;
    camera.getWorldDirection(_fwd);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const p = camera.position;
    if (l.positionX) {
      const k = 0.02;
      l.positionX.setTargetAtTime(p.x, t, k);
      l.positionY.setTargetAtTime(p.y, t, k);
      l.positionZ.setTargetAtTime(p.z, t, k);
      l.forwardX.setTargetAtTime(_fwd.x, t, k);
      l.forwardY.setTargetAtTime(_fwd.y, t, k);
      l.forwardZ.setTargetAtTime(_fwd.z, t, k);
      l.upX.setTargetAtTime(_up.x, t, k);
      l.upY.setTargetAtTime(_up.y, t, k);
      l.upZ.setTargetAtTime(_up.z, t, k);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(_fwd.x, _fwd.y, _fwd.z, _up.x, _up.y, _up.z);
    }
  }

  /**
   * Call once a frame.
   * @param {object} env night, inside, dusk (0..1); birds, crickets (season, 0..1); snow,
   *   rain, windy (weather, 0..1); frozen (the fountain); speed (camera, m/s); flyby (bool)
   */
  update(dt, camera, env) {
    const { night, inside, dusk = 0, birds = 1, crickets = 1, snow = 0, rain = 0, windy = 0, frozen = 0, speed = 0, flyby = false } = env;
    this.snow = snow;
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.listener.copy(camera.position);
    this._setListener(camera, t);
    const day = 1 - night;
    const outdoors = 1 - inside;

    // wind: it comes and goes with the weather. On a still day there is next to none; on a
    // breezy one, gusts with quiet lulls between them; a strong wind never quite drops
    const lull = THREE.MathUtils.smoothstep(0.5 + 0.5 * Math.sin(t * 0.071 + 0.4) * Math.sin(t * 0.113 + 2.1) + 0.15 * Math.sin(t * 0.29), 0.3, 0.75);
    const steady = THREE.MathUtils.smoothstep(windy, 0.55, 0.9);
    const gust = (steady + (1 - steady) * lull) * (0.7 + 0.3 * Math.sin(t * 0.21) * Math.sin(t * 0.53 + 1.3));
    const wind = 0.17 * Math.pow(windy, 1.3) * gust * (0.25 + 0.75 * outdoors) * (0.6 + 0.4 * day);
    this.windGain.gain.setTargetAtTime(wind, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(380 + 260 * Math.sin(t * 0.13) + 140 * Math.sin(t * 0.37) + 300 * windy * gust, t, 0.8);
    this.howlGain.gain.setTargetAtTime(0.012 * windy * windy * gust * gust * (0.4 + 0.6 * outdoors), t, 0.6);
    this.howlFilter.frequency.setTargetAtTime(520 + 380 * gust, t, 0.6);

    this.rainGain.gain.setTargetAtTime(0.11 * rain * (0.3 + 0.7 * outdoors), t, 0.8);

    // the rush of air: only when you go fast (a flyby's quick stretches), not all the time
    const rush = THREE.MathUtils.smoothstep(speed, 5, 17) * (flyby ? 0.055 : 0.03);
    this.rushGain.gain.setTargetAtTime(rush, t, 0.25);
    this.rushFilter.frequency.setTargetAtTime(380 + speed * 45, t, 0.25);

    // the fountain (silent when frozen), muffled indoors; the clock muffled outdoors
    this.waterGain.gain.setTargetAtTime(0.5 * (1 - frozen), t, 0.5);
    this.waterMuffle.frequency.setTargetAtTime(THREE.MathUtils.lerp(9000, 700, inside), t, 0.3);
    this.clockMuffle.frequency.setTargetAtTime(THREE.MathUtils.lerp(9000, 900, outdoors), t, 0.3);
    this.clockGain.gain.setTargetAtTime(THREE.MathUtils.lerp(1, 0.35, outdoors), t, 0.3);
    if (t > this._nextTick) {
      // (no ticking from the far side of the estate)
      if (this.listener.distanceTo(this.clock) < 70) this._tick(Math.max(t, this._nextTick));
      this._nextTick = Math.max(this._nextTick + 1, t);
    }

    // crickets from dusk on, on warm nights; through the windows when you're inside
    const chorus = crickets * Math.max(night, dusk * 0.7) * (1 - 0.8 * rain);
    this.cricketGain.gain.setTargetAtTime(0.05 * chorus * (0.15 + 0.85 * outdoors), t, 1.0);
    this.shimmerGain.gain.setTargetAtTime(0.012 * chorus * (0.1 + 0.9 * outdoors), t, 1.0);
    if (chorus > 0.01) this._chirps(t);

    // birds sing in spring and summer days, not in the rain
    const song = day * birds * (1 - 0.85 * rain) * (0.35 + 0.65 * outdoors);
    if (t > this._nextBird) {
      if (day > 0.3 && song > 0.05) this._bird(t + 0.05);
      this._nextBird = t + (0.8 + Math.random() * 3.5) / Math.max(0.12, song);
    }
    if (t > this._nextOwl) {
      if (night > 0.7 && outdoors > 0.5 && rain < 0.3) this._owl(t + 0.05);
      this._nextOwl = t + 14 + Math.random() * 22;
    }
  }
}
