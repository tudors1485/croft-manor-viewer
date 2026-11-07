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

// Recorded sounds (the wildlife's calls, public/sounds): decoded once and shared by every sound
// context, the page's and a video's
export const SAMPLES = {};
export async function loadSamples(names, base = '') {
  const ctx = new OfflineAudioContext(1, 1, 32000);
  await Promise.all(
    names.map(async (n) => {
      try {
        const r = await fetch(`${base}sounds/${n}.mp3`);
        if (r.ok) SAMPLES[n] = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch {}
    }),
  );
  return Object.keys(SAMPLES).length;
}

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
    // a limiter last of all: fireworks bursting together (and thunder) would clip without it
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 16;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.25;
    this.master.connect(this.limiter).connect(ctx.destination);

    const brown = (this.brown = this._noiseBuffer(4, true));
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
   * A heavy oak door on old iron hinges: not a squeak but a low, slow groan. The hinge sticks
   * and slips a few dozen times a second (a grainy texture rather than a whistle), and each slip
   * rings the door's wood low down, with only a little of the hinge's metal above it.
   */
  _creakBuffer() {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.round(sr * 1.3);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const ring = (i0, amp, pitch) => {
      for (let i = 0; i < sr * 0.05 && i0 + i < len; i++) {
        const s = i / sr;
        d[i0 + i] +=
          amp *
          (Math.sin(2 * Math.PI * 165 * pitch * s) * Math.exp(-s * 55) +
            0.7 * Math.sin(2 * Math.PI * 310 * pitch * s) * Math.exp(-s * 110) +
            0.35 * Math.sin(2 * Math.PI * 520 * pitch * s) * Math.exp(-s * 220) +
            0.08 * Math.sin(2 * Math.PI * 1150 * pitch * s) * Math.exp(-s * 600));
      }
    };
    let t = 0.03;
    let n = 0;
    while (t < 1.2) {
      const u = t / 1.2;
      // slow at first, quickening as the door gets going, slowing as it stops
      const rate = 16 + 34 * Math.sin(u * Math.PI) ** 1.5 + 6 * Math.sin(u * 17 + n * 0.21);
      const amp = Math.sin(u * Math.PI) ** 0.8 * (0.55 + 0.45 * Math.random());
      ring(Math.round(t * sr), amp, 0.94 + 0.12 * Math.sin(u * 5.3));
      t += 1 / Math.max(12, rate);
      n++;
    }
    // the air the door pushes: a soft sigh under it
    for (let i = 0, lp = 0; i < len; i++) {
      const u = i / len;
      lp += ((Math.random() * 2 - 1) - lp) * 0.04;
      d[i] += lp * 2.2 * Math.sin(Math.min(1, u * 1.1) * Math.PI) ** 2;
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= peak || 1;
    return buf;
  }

  /** A splash: bright noise with a bubbling flutter, and the slosh of the water under it. */
  _splash(t, level, len = 0.35) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 16 + Math.random() * 16;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(am.gain);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(level, t + 0.015);
    e.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(this._filter('bandpass', 1400 + Math.random() * 1000, 0.9)).connect(am).connect(e).connect(this.master);
    src.start(t, Math.random() * 2, len + 0.05);
    lfo.start(t);
    lfo.stop(t + len + 0.05);
    const slosh = ctx.createBufferSource();
    slosh.buffer = this.white;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0, t);
    e2.gain.linearRampToValueAtTime(level * 1.5, t + 0.05);
    e2.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.35);
    slosh.connect(this._filter('lowpass', 420, 1.2)).connect(e2).connect(this.master);
    slosh.start(t, Math.random() * 2, len * 1.35 + 0.05);
  }

  /** The bonfire: a low roar and the crackle of the wood, at `position` (level 0 puts it out). */
  setBonfire(position, level) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (!position || level < 0.01) {
      this._fireGain?.gain.setTargetAtTime(0, t, 0.4);
      return;
    }
    if (!this._fireGain) {
      this._fireOut = this._placed(position, { ref: 3, rolloff: 1 });
      this._fireGain = this.ctx.createGain();
      this._fireGain.gain.value = 0;
      this._loop(this.brown).connect(this._filter('lowpass', 420, 0.8)).connect(this._fireGain).connect(this._fireOut);
    }
    this._fireGain.gain.setTargetAtTime(0.5 * level, t, 0.4);
    if (t > (this._nextCrackle ?? 0)) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.white;
      const e = this.ctx.createGain();
      e.gain.setValueAtTime(0.25 * level * (0.4 + Math.random()), t);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.03);
      src.connect(this._filter('bandpass', 1800 + Math.random() * 2600, 2)).connect(e).connect(this._fireOut);
      src.start(t, Math.random() * 2, 0.06);
      this._nextCrackle = t + 0.02 + Math.random() * (Math.random() < 0.2 ? 0.02 : 0.2);
    }
  }

  /** A rocket going up from `position`: a rising whistle over `time` seconds, and its rush. */
  rocket(position, time) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this._placed(position, { ref: 20, rolloff: 0.7, max: 600 });
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(700 + Math.random() * 300, t);
    o.frequency.exponentialRampToValueAtTime(2200 + Math.random() * 900, t + time);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(Math.random() < 0.5 ? 0.025 : 0, t + 0.1);
    e.gain.linearRampToValueAtTime(0.0001, t + time);
    o.connect(e).connect(out);
    o.start(t);
    o.stop(t + time + 0.05);
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0.12, t);
    e2.gain.exponentialRampToValueAtTime(0.0001, t + time * 0.7);
    src.connect(this._filter('bandpass', 1400, 0.8)).connect(e2).connect(out);
    src.start(t, Math.random() * 2, time);
  }

  /** A burst at `position`, `distance` metres away: heard that much later, a deep boom and a crack, and sometimes a crackle. */
  bang(position, distance) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + distance / 343;
    const out = this._placed(position, { ref: 30, rolloff: 0.6, max: 800 });
    const boom = ctx.createBufferSource();
    boom.buffer = this.brown;
    const e = ctx.createGain();
    e.gain.setValueAtTime(1.6, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    boom.connect(this._filter('lowpass', 200, 0.9)).connect(e).connect(out);
    boom.start(t, Math.random() * 2, 1.5);
    const crack = ctx.createBufferSource();
    crack.buffer = this.white;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0.5, t);
    e2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    crack.connect(this._filter('highpass', 900)).connect(e2).connect(out);
    crack.start(t, Math.random() * 2, 0.15);
    if (Math.random() < 0.35) {
      for (let k = 0; k < 24; k++) {
        const c = ctx.createBufferSource();
        c.buffer = this.white;
        const at = t + 0.4 + Math.random() * 1.4;
        const ce = ctx.createGain();
        ce.gain.setValueAtTime(0.08 + Math.random() * 0.1, at);
        ce.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
        c.connect(this._filter('bandpass', 2500 + Math.random() * 3000, 3)).connect(ce).connect(out);
        c.start(at, Math.random() * 2, 0.05);
      }
    }
  }

  /**
   * Thunder from a strike at `position`, `distance` metres away, arriving that much later: close
   * (`bolt` and under half a kilometre) a sharp crack, then a boom; far, a long low roll that
   * swells and grumbles away. Far thunder loses its highs, so the further, the lower and softer.
   */
  thunder(position, distance, bolt = 1) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + distance / 343;
    const out = this._placed(position, { ref: 800, rolloff: 0.6, max: 6000 }); // (thunder carries)
    const close = bolt ? THREE.MathUtils.clamp(1 - (distance - 150) / 400, 0, 1) : 0;
    const far = THREE.MathUtils.clamp(distance / 3000, 0, 1);
    const len = 3 + 4 * far + Math.random() * 2.5;
    // the roll: brown noise, low-passed lower the further it has come, in a few swells
    const roll = ctx.createBufferSource();
    roll.buffer = this.brown;
    roll.loop = true;
    const e = ctx.createGain();
    const peak = 1.4 * (0.5 + 0.5 * close) * (1 - 0.45 * far);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(peak, t + 0.08 + 0.5 * far);
    let at = t + 0.3 + 0.5 * far;
    while (at < t + len - 0.8) {
      // a grumble now and then as the sound comes back from further along the strike
      e.gain.linearRampToValueAtTime(peak * (0.3 + 0.6 * Math.random()) * (1 - (at - t) / len), at);
      at += 0.25 + Math.random() * 0.7;
    }
    e.gain.linearRampToValueAtTime(0.0001, t + len);
    roll.connect(this._filter('lowpass', 420 - 300 * far, 0.7)).connect(e).connect(out);
    roll.start(t, Math.random() * 3);
    roll.stop(t + len + 0.1);
    if (close > 0) {
      // the crack of a near strike: bright, sudden, a little ragged
      const crack = ctx.createBufferSource();
      crack.buffer = this.white;
      const ce = ctx.createGain();
      ce.gain.setValueAtTime(0.0001, t);
      ce.gain.linearRampToValueAtTime(1.1 * close, t + 0.006);
      ce.gain.exponentialRampToValueAtTime(0.25 * close, t + 0.09);
      ce.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      crack.connect(this._filter('highpass', 700)).connect(ce).connect(out);
      crack.start(t, Math.random() * 2, 0.75);
      const boom = ctx.createBufferSource();
      boom.buffer = this.brown;
      const be = ctx.createGain();
      be.gain.setValueAtTime(0.0001, t + 0.02);
      be.gain.linearRampToValueAtTime(2 * close, t + 0.06);
      be.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      boom.connect(this._filter('lowpass', 160, 0.9)).connect(be).connect(out);
      boom.start(t + 0.02, Math.random() * 2, 2.3);
    }
  }

  /** Leaving the ground: a harder push-off on whatever you stand on, and the swish of moving. */
  jump(surface = 'stone') {
    if (!this.on) return;
    this.footstep(surface, 4.6);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.035, t + 0.05);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(this._filter('lowpass', 700, 0.8)).connect(e).connect(this.master);
    src.start(t, Math.random() * 2, 0.25);
  }

  /** Coming down: the thud of landing (heavier after a longer fall), and the surface. */
  land(surface = 'stone', air = 0.5) {
    if (!this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const k = Math.min(1.6, 0.6 + air);
    if (surface === 'water') return this._splash(t, 0.16 * k, 0.55);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.22 * k, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(e).connect(this.master);
    o.start(t);
    o.stop(t + 0.18);
    this.footstep(surface, 5 * k);
  }

  /**
   * A church bell struck at `time` (the bell's partials: hum, prime, tierce, quint, nominal and
   * above, the low ones ringing longest), heard from `position` far off across the fields.
   */
  bell(position, nominal, time = this.ctx?.currentTime ?? 0, level = 1) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const out = this._placed(position, { ref: 500, rolloff: 0.7, max: 5000 });
    const far = this._filter('lowpass', 1800, 0.5);
    far.connect(out);
    const PARTIALS = [
      [0.5, 0.5, 4.5],
      [1, 0.7, 3],
      [1.2, 0.55, 2.4],
      [1.5, 0.3, 2],
      [2, 1, 2.2],
      [2.5, 0.35, 1.2],
      [3, 0.25, 0.9],
      [4, 0.15, 0.6],
    ];
    for (const [ratio, amp, decay] of PARTIALS) {
      const o = ctx.createOscillator();
      o.frequency.value = (nominal / 2) * ratio * (1 + (Math.random() - 0.5) * 0.002);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.05 * amp * level, time + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      o.connect(g).connect(far);
      o.start(time);
      o.stop(time + decay + 0.05);
    }
  }

  /** A recorded sound (SAMPLES) at `position` (or everywhere, if null). */
  sample(name, position, { ref = 10, rolloff = 1, max = 400, gain = 1, rate = 1 } = {}) {
    if (!this.on || !this.ctx || !Object.hasOwn(SAMPLES, name)) return;
    const src = this.ctx.createBufferSource();
    src.buffer = SAMPLES[name];
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = Math.max(0, Math.min(2, gain));
    src.connect(g).connect(position ? this._placed(position, { ref, rolloff, max }) : this.master);
    src.start();
  }

  /** A little chime (an Easter egg found): two bright notes and a sparkle. */
  chime() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [1568, 2093, 2637].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const at = t + i * 0.09;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.05, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
      o.connect(g).connect(this.master);
      o.start(at);
      o.stop(at + 0.75);
    });
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
    // wading: a splash with every step
    if (surface === 'water') return this._splash(t, 0.075 * Math.min(1.4, speed / 3), 0.32);
    // ice: a hard, glassy tap
    if (surface === 'ice') surface = 'stone';
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
      // an iron latch: a dull clack, not a tick
      src.connect(this._filter('bandpass', 1300, 3)).connect(e).connect(out);
      src.start(at, Math.random() * 2, 0.05);
    };
    if (opening) {
      click(t, 0.35);
      const src = ctx.createBufferSource();
      src.buffer = this.creak;
      src.playbackRate.value = 0.92 + Math.random() * 0.12;
      const e = ctx.createGain();
      e.gain.value = 0.5;
      src.connect(this._filter('highpass', 60)).connect(this._filter('lowpass', 2400)).connect(e).connect(out);
      src.start(t + 0.1);
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
    // (every level is a number between 0 and 1, speed at least 0: one bad value would otherwise
    // stop every sound with an error, frame after frame)
    const unit = (v, d = 0) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
    const night = unit(env.night);
    const inside = unit(env.inside);
    const dusk = unit(env.dusk);
    const birds = unit(env.birds, 1);
    const crickets = unit(env.crickets, 1);
    const snow = unit(env.snow);
    const rain = unit(env.rain);
    const windy = unit(env.windy);
    const frozen = unit(env.frozen);
    const speed = Number.isFinite(env.speed) ? Math.max(0, env.speed) : 0;
    const flyby = !!env.flyby;
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
