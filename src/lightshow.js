// The doorbell, and at Christmas the house's light show.
//
// A brass bell push beside the front door (E, or a click on it, rings it). It rings all year: the
// Westminster quarters on a tubular chime. From 1 December to Twelfth Night it also starts the show:
// the house goes dark, and then a carol plays (synthesised here, no recordings) with every Christmas
// light on the house, the gate and the trees in time with it. One score drives both, so the lights
// can't drift from the music: each frame the lights are worked out from the music's own clock.
//
// The tunes are old and out of copyright: Mykola Leontovych's "Shchedryk" (1914), the melody of
// "Carol of the Bells", arranged as it builds (bells, then strings, bass and drums, a big finish;
// the tune only, none of the English words), and James Lord Pierpont's "Jingle Bells" (1857). They
// take turns, one each ring.

import * as THREE from 'three';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------------------------
// The scores: notes in beats, { b: start, d: length, ins, p: MIDI note (or notes), v: loudness },
// `light` on the notes the lights follow, and the sections with how the lights behave in each.

/** "Carol of the Bells" (Leontovych's Shchedryk), G minor, 3/4. */
function carol() {
  const ev = [];
  const add = (b, d, ins, p, v = 1, light = false) => ev.push({ b, d, ins, p, v, light });
  const OST = [
    [0, 1, 70],
    [1, 0.5, 69],
    [1.5, 0.5, 70],
    [2, 1, 67],
  ]; // B♭ A B♭ G
  const ROOT = [43, 41, 39, 38]; // the bass falling G F E♭ D under it, a bar each
  const PAD = [
    [55, 58, 62],
    [53, 58, 62],
    [51, 55, 58],
    [50, 54, 57],
  ];
  const TOLL = [79, 77, 75, 74]; // G F E♭ D, high, a bar each
  const RUNS = [
    [74, 74, 74, 74, 72, 70],
    [72, 72, 72, 72, 70, 69],
    [70, 70, 70, 70, 69, 67],
    [69, 69, 67, 66, 62],
  ];
  const bar = (n) => n * 3;
  const ost = (n, ins, shift, v, light) => {
    for (const [b, d, p] of OST) add(bar(n) + b, d, ins, p + shift, v, light);
  };
  const runs = (n, k, ins, v, light) => {
    for (let i = 0; i < 4; i++) {
      const notes = RUNS[i];
      notes.forEach((p, j) => add(bar(n + i) + j * 0.5, j === 4 && notes.length === 5 ? 1 : 0.5, ins, p + k, v, light));
    }
  };
  const drums = (n, style, v = 1) => {
    const b0 = bar(n);
    if (style === 'rock') {
      add(b0, 0, 'kick', 0, v);
      add(b0 + 1.5, 0, 'kick', 0, 0.8 * v);
      add(b0 + 2, 0, 'snare', 0, v);
      for (let i = 0; i < 6; i++) add(b0 + i * 0.5, 0, 'hat', 0, (i % 2 ? 0.45 : 0.75) * v);
    } else if (style === 'half') {
      add(b0, 0, 'kick', 0, v);
      add(b0, 0, 'ride', 0, 0.7 * v);
      add(b0 + 1, 0, 'ride', 0, 0.45 * v);
      add(b0 + 2, 0, 'ride', 0, 0.45 * v);
      if (n % 2) add(b0 + 2, 0, 'snare', 0, 0.8 * v);
    } else if (style === 'hats') {
      for (let i = 0; i < 6; i++) add(b0 + i * 0.5, 0, 'hat', 0, (i % 2 ? 0.25 : 0.45) * v);
      add(b0, 0, 'kick', 0, 0.55 * v);
    }
  };
  const bass = (n, k, style, v = 1) => {
    const r = ROOT[n % 4] + k;
    if (style === 'long') add(bar(n), 2.9, 'bass', r, 0.8 * v);
    else if (style === 'pizz') add(bar(n), 1, 'pizz', r + 12, 0.8 * v);
    else for (let i = 0; i < 6; i++) add(bar(n) + i * 0.5, 0.45, 'bass', r, (i === 0 ? 1 : 0.75) * v);
  };
  const pad = (n, k, v) => add(bar(n), 3, 'pad', PAD[n % 4].map((p) => p + k), v);
  const guitar = (n, k, v = 1) => {
    const r = ROOT[n % 4] + k + 12;
    for (let i = 0; i < 6; i++) add(bar(n) + i * 0.5, i === 0 ? 0.9 : 0.22, 'guitar', r, i === 0 ? v : 0.7 * v);
  };

  // the intro: the bells alone (8 bars), then the bass
  for (let n = 0; n < 8; n++) {
    ost(n, 'celesta', 0, n < 4 ? 0.85 : 0.95, true);
    if (n >= 4) bass(n, 0, 'pizz', 0.8);
  }
  // A1: a second voice a third above, the strings, the bass held; the hats come in
  for (let n = 8; n < 16; n++) {
    ost(n, 'celesta', 0, 0.75, true);
    ost(n, 'bell', 4, 0.45);
    pad(n, 0, 0.55);
    bass(n, 0, 'long', 0.8);
    if (n >= 12) drums(n, 'hats', 0.7);
  }
  // A2: the glockenspiel an octave up, louder strings, a soft kick
  for (let n = 16; n < 24; n++) {
    ost(n, 'celesta', 0, 0.8, true);
    ost(n, 'bell', 4, 0.5);
    ost(n, 'glock', 12, 0.4);
    pad(n, 0, 0.75);
    bass(n, 0, 'long', 0.9);
    drums(n, 'hats', 1);
  }
  // the build: a snare roll swelling, the bells in octaves, a rising rush
  for (let n = 24; n < 28; n++) {
    ost(n, 'celesta', 0, 0.85, true);
    ost(n, 'glock', 12, 0.5);
    pad(n, 0, 0.85);
    bass(n, 0, 'long', 1);
    const steps = n < 26 ? 6 : 12;
    for (let i = 0; i < steps; i++) add(bar(n) + (i * 3) / steps, 0, 'snare', 0, 0.2 + 0.6 * ((n - 24) * steps + i) / (4 * 12));
  }
  add(bar(24), bar(4), 'riser', 0, 1);
  for (let i = 0; i < 6; i++) add(bar(27) + i * 0.5, 0, 'tom', 50 - i * 3, 0.9);
  // B: the whole band (16 bars)
  for (let n = 28; n < 44; n++) {
    if (n === 28 || n === 36) add(bar(n), 0, 'crash', 0, 1);
    ost(n, 'lead', 12, 0.75, true);
    ost(n, 'celesta', 0, 0.6);
    ost(n, 'bell', 4, 0.4);
    guitar(n, 0, 0.9);
    bass(n, 0, 'drive', 1);
    pad(n, 0, 0.6);
    drums(n, 'rock', 1);
  }
  // C: the bells tolling, high, a bar each, over the strings; the drums at half time
  for (let n = 44; n < 52; n++) {
    if (n === 44) add(bar(n), 0, 'crash', 0, 0.9);
    add(bar(n), 3, 'toll', TOLL[n % 4], 1, true);
    ost(n, 'pizz', 0, 0.7);
    pad(n, 0, 1);
    bass(n, 0, 'long', 1);
    drums(n, 'half', 1);
  }
  // D: the running quavers, twice, the band driving under them
  for (let n = 52; n < 60; n++) {
    guitar(n, 0, 0.75);
    bass(n, 0, 'drive', 0.9);
    pad(n, 0, 0.6);
    drums(n, 'rock', 0.9);
    ost(n, 'celesta', 0, 0.45);
  }
  runs(52, 0, 'lead', 0.7, true);
  runs(56, 0, 'lead', 0.75, true);
  runs(52, 12, 'glock', 0.35);
  runs(56, 12, 'glock', 0.4);
  add(bar(52), 0, 'crash', 0, 0.9);
  // the break: the bells alone in the dark, then a roll into the last part
  for (let n = 60; n < 64; n++) ost(n, 'celesta', 0, 0.8, true);
  for (let i = 0; i < 12; i++) add(bar(63) + i * 0.25, 0, 'snare', 0, 0.25 + 0.06 * i);
  add(bar(62), bar(2), 'riser', 0, 0.9);
  // E: up a tone, to A minor, everything (16 bars), the running quavers over the second half
  for (let n = 64; n < 80; n++) {
    if (n === 64 || n === 72) add(bar(n), 0, 'crash', 0, 1);
    ost(n, 'lead', 14, 0.8, n < 72);
    ost(n, 'celesta', 2, 0.6);
    ost(n, 'glock', 14, 0.35);
    guitar(n, 2, 1);
    bass(n, 2, 'drive', 1);
    pad(n, 2, 0.8);
    drums(n, 'rock', 1);
  }
  runs(72, 2, 'bell', 0.5, true);
  runs(76, 2, 'bell', 0.55, true);
  // the end: the band together on every note of the bells, then one last chord left to ring
  for (let n = 80; n < 83; n++) {
    ost(n, 'lead', 14, 0.85, true);
    ost(n, 'celesta', 2, 0.6);
    for (const [b, d, p] of OST) {
      add(bar(n) + b, d * 0.8, 'guitar', p + 2 - 24, 0.9);
      add(bar(n) + b, 0, b === 0 ? 'kick' : 'snare', 0, 0.9);
    }
    bass(n, 2, 'drive', 1);
    pad(n, 2, 0.8);
  }
  const last = bar(83);
  add(last, 0, 'crash', 0, 1);
  add(last, 0, 'kick', 0, 1);
  add(last, 6, 'toll', 69, 1, true);
  add(last, 6, 'toll', 57, 0.8);
  add(last, 6, 'pad', [57, 60, 64, 69], 1);
  add(last, 4, 'bass', 45, 1);
  add(last, 2.5, 'guitar', 45 + 12, 1);
  add(last, 5, 'celesta', 81, 0.7);
  return {
    name: 'Carol of the Bells',
    bpm: 150,
    bpb: 3,
    events: ev,
    end: last + 2, // (in beats: the last chord; the lights blaze, then the ring dies away)
    sections: [
      { from: 0, style: 'bells' },
      { from: 8, style: 'answer' },
      { from: 16, style: 'sweep' },
      { from: 24, style: 'build' },
      { from: 28, style: 'flash' },
      { from: 44, style: 'toll' },
      { from: 52, style: 'runs' },
      { from: 60, style: 'dark' },
      { from: 64, style: 'finale' },
      { from: 80, style: 'hits' },
      { from: 83, style: 'blaze' },
    ],
  };
}

/** "Jingle Bells" (Pierpont), C major then D, 4/4. */
function jingle() {
  const ev = [];
  const add = (b, d, ins, p, v = 1, light = false) => ev.push({ b, d, ins, p, v, light });
  const VERSE = [
    [[0, 1, 55], [1, 1, 64], [2, 1, 62], [3, 1, 60]],
    [[0, 3, 55], [3, 0.5, 55], [3.5, 0.5, 55]],
    [[0, 1, 55], [1, 1, 64], [2, 1, 62], [3, 1, 60]],
    [[0, 4, 57]],
    [[0, 1, 57], [1, 1, 65], [2, 1, 64], [3, 1, 62]],
    [[0, 4, 59]],
    [[0, 1, 67], [1, 1, 67], [2, 1, 65], [3, 1, 62]],
    [[0, 4, 64]],
    [[0, 1, 55], [1, 1, 64], [2, 1, 62], [3, 1, 60]],
    [[0, 4, 55]],
    [[0, 1, 55], [1, 1, 64], [2, 1, 62], [3, 1, 60]],
    [[0, 3, 57], [3, 1, 57]],
    [[0, 1, 57], [1, 1, 65], [2, 1, 64], [3, 1, 62]],
    [[0, 1, 67], [1, 1, 67], [2, 1, 67], [3, 1, 67]],
    [[0, 1, 69], [1, 1, 67], [2, 1, 65], [3, 1, 62]],
    [[0, 2, 60], [2, 2, 67]],
  ];
  const VERSE_CH = ['C', 'C', 'C', 'F', 'Dm', 'G', 'G7', 'C', 'C', 'C', 'C', 'F', 'Dm', 'G', 'G7', 'C'];
  const JB = [[0, 1, 64], [1, 1, 64], [2, 2, 64]];
  const CHORUS = [
    JB,
    JB,
    [[0, 1, 64], [1, 1, 67], [2, 1.5, 60], [3.5, 0.5, 62]],
    [[0, 4, 64]],
    [[0, 1, 65], [1, 1, 65], [2, 1.5, 65], [3.5, 0.5, 65]],
    [[0, 1, 65], [1, 1, 64], [2, 1, 64], [3, 0.5, 64], [3.5, 0.5, 64]],
    [[0, 1, 64], [1, 1, 62], [2, 1, 62], [3, 1, 64]],
    [[0, 2, 62], [2, 2, 67]],
    JB,
    JB,
    [[0, 1, 64], [1, 1, 67], [2, 1.5, 60], [3.5, 0.5, 62]],
    [[0, 4, 64]],
    [[0, 1, 65], [1, 1, 65], [2, 1.5, 65], [3.5, 0.5, 65]],
    [[0, 1, 65], [1, 1, 64], [2, 1, 64], [3, 0.5, 64], [3.5, 0.5, 64]],
    [[0, 1, 67], [1, 1, 67], [2, 1, 65], [3, 1, 62]],
    [[0, 4, 60]],
  ];
  const CHORUS_CH = ['C', 'C', 'C', 'C', 'F', 'C', 'D7', 'G7', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'];
  const CHORD = { C: [60, 64, 67], F: [60, 65, 69], Dm: [62, 65, 69], G: [59, 62, 67], G7: [59, 65, 67], D7: [60, 62, 66] };
  const ROOT = { C: 36, F: 41, Dm: 38, G: 43, G7: 43, D7: 38 };
  const FIFTH = { C: 43, F: 36, Dm: 45, G: 38, G7: 38, D7: 45 };
  const bar = (n) => n * 4;
  const melody = (n, line, k, ins, v, light) => line.forEach(([b, d, p]) => add(bar(n) + b, d, ins, p + 12 + k, v, light));
  const sleigh = (n, v = 1) => {
    for (let i = 0; i < 8; i++) add(bar(n) + i * 0.5, 0, 'sleigh', 0, (i % 2 ? 0.55 : 0.85) * v);
  };
  const band = (n, ch, k, style) => {
    const b0 = bar(n);
    const r = ROOT[ch] + k;
    if (style === 'two') {
      add(b0, 1.8, 'bass', r, 0.9);
      add(b0 + 2, 1.8, 'bass', FIFTH[ch] + k, 0.8);
    } else {
      // walking: the root, the third, the fifth and the sixth
      const walk = ch.startsWith('D') || ch === 'Dm' ? [0, 3, 7, 9] : [0, 4, 7, 9];
      walk.forEach((s, i) => add(b0 + i, 0.9, 'bass', r + s, i === 0 ? 1 : 0.8));
    }
    for (const b of [1, 3]) add(b0 + b, 0.35, 'keys', CHORD[ch].map((p) => p + k), 0.6);
    if (style !== 'two') {
      add(b0, 0, 'kick', 0, 0.95);
      add(b0 + 2, 0, 'kick', 0, 0.85);
      add(b0 + 1, 0, 'snare', 0, 0.8);
      add(b0 + 3, 0, 'snare', 0, 0.85);
    } else {
      add(b0, 0, 'kick', 0, 0.6);
      add(b0 + 2, 0, 'kick', 0, 0.5);
    }
  };
  let n = 0;
  // the intro: sleigh bells and the hook on the glockenspiel
  for (; n < 2; n++) {
    sleigh(n, 0.8);
    melody(n, JB, 12, 'glock', 0.6, true);
  }
  // the verse
  for (let i = 0; i < 16; i++, n++) {
    sleigh(n, 0.7);
    melody(n, VERSE[i], 0, 'bellLead', 0.75, true);
    band(n, VERSE_CH[i], 0, 'two');
    add(bar(n), 4, 'pad', CHORD[VERSE_CH[i]].map((p) => p - 12), 0.4);
  }
  // the chorus, twice; then up a tone, the band all in
  for (let c = 0; c < 3; c++) {
    const k = c === 2 ? 2 : 0;
    for (let i = 0; i < 16; i++, n++) {
      if (i === 0 || i === 8) add(bar(n), 0, 'crash', 0, c === 0 && i === 8 ? 0.7 : 1);
      sleigh(n, 1);
      melody(n, CHORUS[i], k, 'bellLead', 0.8, true);
      if (c > 0) melody(n, CHORUS[i], k, 'brass', 0.5);
      if (c === 2) melody(n, CHORUS[i], k + 12, 'glock', 0.3);
      band(n, CHORUS_CH[i], k, 'walk');
      add(bar(n), 4, 'pad', CHORD[CHORUS_CH[i]].map((p) => p - 12 + k), c === 0 ? 0.45 : 0.6);
      for (let h = 0; h < 8; h++) add(bar(n) + h * 0.5, 0, 'hat', 0, h % 2 ? 0.3 : 0.5);
      // "…a one-horse open sleigh, hey!": the band hits on the "hey"
      if (i === 7) add(bar(n) + 2, 0, 'crash', 0, 0.8);
    }
  }
  // the tag: "one horse open sleigh", slower, then the last chord
  const tag = [[0, 2, 67], [2, 2, 67], [4, 2, 65], [6, 2, 62]];
  for (const [b, d, p] of tag) {
    add(bar(n) + b, d, 'bellLead', p + 12 + 2, 0.85, true);
    add(bar(n) + b, d, 'brass', p + 12 + 2, 0.55);
    add(bar(n) + b, 0, 'kick', 0, 0.8);
    add(bar(n) + b, 0, 'crash', 0, 0.5);
    add(bar(n) + b, d * 0.9, 'keys', CHORD[b < 4 ? 'C' : 'G7'].map((x) => x + 2), 0.6);
  }
  add(bar(n), 8, 'bass', 43 + 2, 0.9);
  n += 2;
  const last = bar(n);
  add(last, 0, 'crash', 0, 1);
  add(last, 0, 'kick', 0, 1);
  add(last, 6, 'bellLead', 60 + 12 + 2, 0.9, true);
  add(last, 6, 'brass', [62, 66, 69, 74], 0.6);
  add(last, 6, 'pad', [50, 57, 62, 66], 1);
  add(last, 4, 'bass', 38, 1);
  add(last, 6, 'toll', 74, 0.8);
  for (let i = 0; i < 6; i++) add(last + i * 0.5, 0, 'sleigh', 0, 1 - i * 0.14);
  return {
    name: 'Jingle Bells',
    bpm: 160,
    bpb: 4,
    events: ev,
    end: last + 2,
    sections: [
      { from: 0, style: 'bells' },
      { from: 2, style: 'answer' },
      { from: 18, style: 'flash' },
      { from: 34, style: 'sweep' },
      { from: 50, style: 'finale' },
      { from: 66, style: 'hits' },
      { from: 68, style: 'blaze' },
    ],
  };
}

const TUNES = [carol(), jingle()];
for (const t of TUNES) {
  t.events.sort((a, b) => a.b - b.b);
  t.spb = 60 / t.bpm;
  t.lights = t.events.filter((e) => e.light).map((e) => ({ b: e.b, d: e.d, p: Array.isArray(e.p) ? e.p[0] : e.p }));
  t.length = t.end * t.spb;
}

// ---------------------------------------------------------------------------------------------
// The instruments: each schedules one note on a context, into `out`.

function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A generated room: stereo noise dying away over about two seconds. */
function impulse(ctx, seconds = 2.4) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / ctx.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return buf;
}

class Band {
  /** @param {BaseAudioContext} ctx @param {AudioNode} dest */
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.noise = noiseBuffer(ctx);
    this.out = ctx.createGain();
    this.out.gain.value = 0.85;
    // a little room: the reverb on a send
    this.verb = ctx.createConvolver();
    this.verb.buffer = impulse(ctx);
    this.send = ctx.createGain();
    this.send.gain.value = 0.22;
    this.out.connect(dest);
    this.out.connect(this.send).connect(this.verb).connect(dest);
    // the guitar: every note through one overdrive, so a power chord rings together
    this.drive = ctx.createGain();
    this.drive.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 6) * 0.6;
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const cab = this._filter('lowpass', 3000, 0.8);
    const body = this._filter('peaking', 900, 1);
    body.gain.value = 4;
    const lowCut = this._filter('highpass', 90, 0.7);
    this.drive.connect(lowCut).connect(shaper).connect(body).connect(cab).connect(this.out);
  }

  _filter(type, f, q = 0.7) {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    return n;
  }

  _env(t, peak, attack, decay, hold = 0, end = null) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end ?? t + attack + hold + decay);
    return g;
  }

  _osc(type, f, t, stop) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start(t);
    o.stop(stop);
    return o;
  }

  _noise(t, stop) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 0.8);
    s.stop(stop);
    return s;
  }

  play(e, t, spb) {
    const dur = e.d * spb;
    const v = e.v;
    const fn = this[`_${e.ins}`];
    if (!fn) return;
    if (Array.isArray(e.p)) for (const p of e.p) fn.call(this, t, p, dur, v / Math.sqrt(e.p.length));
    else fn.call(this, t, e.p, dur, v);
  }

  /** An FM bell: a modulator at an odd ratio clangs at the strike and dies away to the hum. */
  _fmBell(t, f, v, { ratio = 3.5, index = 2.2, decay = 2.5, level = 0.16, out = this.out }) {
    const end = t + decay;
    const car = this._osc('sine', f, t, end + 0.05);
    const mod = this._osc('sine', f * ratio, t, end + 0.05);
    const mg = this.ctx.createGain();
    mg.gain.setValueAtTime(f * index * v, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.02, t + decay * 0.45);
    mod.connect(mg).connect(car.frequency);
    const g = this._env(t, level * v, 0.003, decay);
    car.connect(g).connect(out);
  }

  _celesta(t, p, d, v) {
    const f = mtof(p);
    this._fmBell(t, f, v, { ratio: 4, index: 1.1, decay: 1.4, level: 0.16 });
    const o = this._osc('sine', f * 2, t, t + 0.5);
    o.connect(this._env(t, 0.025 * v, 0.002, 0.45)).connect(this.out);
  }

  _glock(t, p, d, v) {
    const f = mtof(p);
    this._fmBell(t, f, v, { ratio: 2.76, index: 0.9, decay: 1.6, level: 0.09 });
  }

  _bell(t, p, d, v) {
    this._fmBell(t, mtof(p), v, { ratio: 3.5, index: 2.6, decay: 2.6, level: 0.1 });
  }

  /** A big church-like bell: the strike, the hum an octave below, the long ring. */
  _toll(t, p, d, v) {
    const f = mtof(p);
    this._fmBell(t, f, v, { ratio: 2.4, index: 3, decay: Math.max(3, d + 1.5), level: 0.13 });
    this._fmBell(t, f / 2, v, { ratio: 1.41, index: 1.2, decay: Math.max(4, d + 2.5), level: 0.1 });
    const tierce = this._osc('sine', f * 1.2, t, t + 2.2);
    tierce.connect(this._env(t, 0.02 * v, 0.004, 2)).connect(this.out);
  }

  /** The doorbell: a tubular chime. */
  _chime(t, p, d, v, out = this.out) {
    const f = mtof(p);
    this._fmBell(t, f, v, { ratio: 1.4, index: 2.2, decay: 3.2, level: 0.16, out });
    const o = this._osc('sine', f * 2.76, t, t + 1.2);
    o.connect(this._env(t, 0.03 * v, 0.002, 1.1)).connect(out);
  }

  /** A lead for the band: two detuned saws and a square, filtered, with a bell's strike on top. */
  _lead(t, p, d, v) {
    const f = mtof(p);
    const end = t + d + 0.25;
    const flt = this._filter('lowpass', 2400, 1.2);
    flt.frequency.setValueAtTime(5200, t);
    flt.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    const g = this._env(t, 0.045 * v, 0.008, 0.25, Math.max(0, d - 0.1));
    for (const det of [-6, 6]) {
      const o = this._osc('sawtooth', f, t, end);
      o.detune.value = det;
      o.connect(flt);
    }
    this._osc('square', f / 2, t, end).connect(flt);
    flt.connect(g).connect(this.out);
    this._fmBell(t, f, v * 0.7, { ratio: 3.5, index: 1.5, decay: 0.9, level: 0.06 });
  }

  /** The tune's voice in Jingle Bells: a bright bell with a little sustain. */
  _bellLead(t, p, d, v) {
    const f = mtof(p);
    this._fmBell(t, f, v, { ratio: 2, index: 1.6, decay: Math.max(0.7, d * 1.2), level: 0.12 });
    const o = this._osc('triangle', f, t, t + d + 0.2);
    o.connect(this._env(t, 0.05 * v, 0.01, 0.2, Math.max(0, d - 0.15))).connect(this.out);
  }

  _brass(t, p, d, v) {
    const f = mtof(p);
    const end = t + d + 0.2;
    const flt = this._filter('lowpass', 900, 2);
    flt.frequency.setValueAtTime(600, t);
    flt.frequency.linearRampToValueAtTime(2600, t + 0.06);
    flt.frequency.exponentialRampToValueAtTime(1400, t + 0.35);
    for (const det of [-8, 0, 8]) {
      const o = this._osc('sawtooth', f, t, end);
      o.detune.value = det;
      o.connect(flt);
    }
    flt.connect(this._env(t, 0.03 * v, 0.03, 0.18, Math.max(0, d - 0.1))).connect(this.out);
  }

  _keys(t, p, d, v) {
    const f = mtof(p);
    const flt = this._filter('lowpass', 2200, 0.7);
    this._osc('triangle', f, t, t + d + 0.2).connect(flt);
    const s = this._osc('sawtooth', f, t, t + d + 0.2);
    s.detune.value = 4;
    s.connect(flt);
    flt.connect(this._env(t, 0.04 * v, 0.004, 0.25, Math.max(0, d - 0.1))).connect(this.out);
  }

  /** Strings: detuned saws, slow to swell, softly filtered. */
  _pad(t, p, d, v) {
    const f = mtof(p);
    const end = t + d + 0.9;
    const flt = this._filter('lowpass', 1500, 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.028 * v, t + Math.min(0.5, d * 0.4));
    g.gain.setValueAtTime(0.028 * v, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const det of [-9, 0, 9]) {
      const o = this._osc('sawtooth', f, t, end + 0.05);
      o.detune.value = det + (Math.random() - 0.5) * 4;
      o.connect(flt);
    }
    flt.connect(g).connect(this.out);
  }

  _pizz(t, p, d, v) {
    const f = mtof(p);
    const flt = this._filter('lowpass', 1800, 2);
    flt.frequency.setValueAtTime(2600, t);
    flt.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    this._osc('sawtooth', f, t, t + 0.6).connect(flt);
    flt.connect(this._env(t, 0.06 * v, 0.003, 0.5)).connect(this.out);
  }

  _bass(t, p, d, v) {
    const f = mtof(p);
    const end = t + d + 0.1;
    const flt = this._filter('lowpass', 600, 3);
    flt.frequency.setValueAtTime(1400, t);
    flt.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    this._osc('sawtooth', f, t, end).connect(flt);
    const sub = this._osc('sine', f, t, end);
    const g = this._env(t, 0.11 * v, 0.006, 0.08, Math.max(0, d - 0.08));
    flt.connect(g);
    sub.connect(g);
    g.connect(this.out);
  }

  /** A power chord through the overdrive: the root, the fifth and the octave. */
  _guitar(t, p, d, v) {
    const f = mtof(p);
    const end = t + d + 0.1;
    const g = this._env(t, 0.05 * v, 0.004, 0.06, Math.max(0, d - 0.05));
    for (const [m, det] of [
      [1, -5],
      [1.4983, 4],
      [2, 0],
    ]) {
      const o = this._osc('sawtooth', f * m, t, end);
      o.detune.value = det;
      o.connect(g);
    }
    g.connect(this.drive);
  }

  _kick(t, p, d, v) {
    const o = this._osc('sine', 150, t, t + 0.45);
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(this._env(t, 0.55 * v, 0.002, 0.38)).connect(this.out);
    const n = this._noise(t, t + 0.02);
    n.connect(this._filter('highpass', 3000)).connect(this._env(t, 0.08 * v, 0.001, 0.012)).connect(this.out);
  }

  _snare(t, p, d, v) {
    const n = this._noise(t, t + 0.25);
    n.connect(this._filter('bandpass', 1900, 0.7)).connect(this._env(t, 0.28 * v, 0.002, 0.18)).connect(this.out);
    const o = this._osc('triangle', 190, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    o.connect(this._env(t, 0.16 * v, 0.002, 0.09)).connect(this.out);
  }

  _hat(t, p, d, v) {
    const n = this._noise(t, t + 0.06);
    n.connect(this._filter('highpass', 7500, 0.7)).connect(this._env(t, 0.06 * v, 0.001, 0.045)).connect(this.out);
  }

  _ride(t, p, d, v) {
    const n = this._noise(t, t + 0.9);
    n.connect(this._filter('bandpass', 6500, 1.5)).connect(this._env(t, 0.05 * v, 0.002, 0.8)).connect(this.out);
    const o = this._osc('square', 2350, t, t + 0.6);
    o.connect(this._filter('bandpass', 4700, 6)).connect(this._env(t, 0.012 * v, 0.002, 0.5)).connect(this.out);
  }

  _crash(t, p, d, v) {
    const n = this._noise(t, t + 2.4);
    n.connect(this._filter('highpass', 3200, 0.5)).connect(this._env(t, 0.16 * v, 0.003, 2.2)).connect(this.out);
    n.connect(this._filter('bandpass', 5600, 3)).connect(this._env(t, 0.05 * v, 0.003, 1.4)).connect(this.out);
  }

  _tom(t, p, d, v) {
    const f = mtof(p);
    const o = this._osc('sine', f * 1.6, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
    o.connect(this._env(t, 0.32 * v, 0.002, 0.35)).connect(this.out);
  }

  /** Sleigh bells: a cluster of tiny high jingles. */
  _sleigh(t, p, d, v) {
    const n = this._noise(t, t + 0.12);
    const flt = this._filter('bandpass', 8200, 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 5; k++) {
      const at = t + k * 0.011 + Math.random() * 0.004;
      g.gain.setValueAtTime(0.09 * v * (1 - k * 0.15), at);
      g.gain.exponentialRampToValueAtTime(0.002, at + 0.009);
    }
    g.gain.setValueAtTime(0.0001, t + 0.1);
    n.connect(flt).connect(g).connect(this.out);
    const ring = this._osc('sine', 5300 + Math.random() * 800, t, t + 0.12);
    ring.connect(this._env(t, 0.006 * v, 0.002, 0.1)).connect(this.out);
  }

  /** A rush of noise rising under a build. */
  _riser(t, p, d, v) {
    const end = t + d;
    const n = this._noise(t, end + 0.05);
    const flt = this._filter('bandpass', 400, 2);
    flt.frequency.setValueAtTime(300, t);
    flt.frequency.exponentialRampToValueAtTime(7000, end);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * v, end - 0.02);
    g.gain.linearRampToValueAtTime(0, end);
    n.connect(flt).connect(g).connect(this.out);
  }
}

// ---------------------------------------------------------------------------------------------
// The lights: each frame, from the place in the score, how bright and what colour each set of
// lights is. The sets: the roofline, the icicles, the window frames, the candles on the sills, the
// trees (the two oaks, the fairy lights, the gate's pillars, the small trees and the big one) and
// the star on the big tree.

const RED = [1, 0.1, 0.06];
const GREEN = [0.12, 0.95, 0.25];
const GOLD = [1, 0.66, 0.14];
const BLUE = [0.22, 0.42, 1];
const WHITE = [1, 0.84, 0.58];
const ICE = [0.72, 0.86, 1];
const PURPLE = [0.75, 0.22, 1];
const PALETTE = [RED, GREEN, GOLD, BLUE, WHITE, PURPLE];
const ROLES = ['roof', 'icicles', 'windows', 'candles', 'trees', 'star'];
// the house runs from x -14.4 (west) to 29.2 (east); a note's pitch picks its place along it
const X0 = -14.5;
const X1 = 29.5;
const MID = (X0 + X1) / 2;
const pitchX = (p) => X0 + THREE.MathUtils.clamp((p - 60) / 26, 0, 1) * (X1 - X0);

const blank = () => ({ level: 0, colour: WHITE, mix: 1, sweepX: MID, sweepW: 60, sweepAmt: 0, halfL: 1, halfR: 1, sparkle: 0, chase: 0, chaseAmt: 0 });

/** The last light note at or before beat b (binary search). */
function lastNote(list, b) {
  let lo = 0;
  let hi = list.length - 1;
  let at = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (list[m].b <= b + 1e-6) {
      at = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return at;
}

function lightsAt(tune, b) {
  const g = Object.fromEntries(ROLES.map((r) => [r, blank()]));
  const spb = tune.spb;
  const bar = Math.floor(b / tune.bpb);
  const inBar = b - bar * tune.bpb;
  const sec = tune.sections.findLast((s) => bar >= s.from) ?? tune.sections[0];
  const next = tune.sections[tune.sections.indexOf(sec) + 1];
  const local = bar - sec.from;
  const i = lastNote(tune.lights, b);
  const note = i >= 0 ? tune.lights[i] : null;
  const since = note ? (b - note.b) * spb : 99; // seconds since the last light note
  const flash = Math.exp(-since * 5.5);
  const glow = Math.exp(-since * 2.2);
  const beatSince = (inBar % 1) * spb;
  const beat = Math.exp(-beatSince * 7);
  const barColour = PALETTE[bar % PALETTE.length];
  const nx = note ? pitchX(note.p) : MID;
  const toEnd = next ? (next.from * tune.bpb - b) * spb : 99;
  let house = 0.55; // the house's own lights, dimmed for the show
  const set = (role, o) => Object.assign(g[role], o);
  switch (sec.style) {
    case 'bells': {
      // the bells alone: each note lights the windows where its pitch falls along the house; the
      // roofline glows low and warm; the star waits
      set('roof', { level: 0.18 + 0.25 * glow, colour: WHITE });
      set('icicles', { level: 0.12 + 0.6 * flash, colour: ICE, sweepX: nx, sweepW: 7, sweepAmt: 1 });
      set('windows', { level: 1.4 * glow, colour: WHITE, sweepX: nx, sweepW: 6, sweepAmt: 1 });
      set('candles', { level: 0.5 + 0.5 * glow, colour: GOLD });
      set('trees', { level: 0.1, colour: WHITE, sparkle: 0.6 });
      set('star', { level: 0.6 + 0.4 * glow, colour: GOLD });
      break;
    }
    case 'answer': {
      // the two halves of the house answer each other, bar by bar, in red and green
      const left = bar % 2 === 0;
      const c = left ? RED : GREEN;
      const l = 0.35 + 1.2 * flash;
      set('roof', { level: l, colour: c, halfL: left ? 1 : 0.08, halfR: left ? 0.08 : 1 });
      set('icicles', { level: 0.25 + 0.8 * flash, colour: ICE, halfL: left ? 1 : 0.1, halfR: left ? 0.1 : 1 });
      set('windows', { level: 0.3 + 1.1 * glow, colour: left ? GREEN : RED, halfL: left ? 0.15 : 1, halfR: left ? 1 : 0.15 });
      set('candles', { level: 0.8, colour: GOLD });
      set('trees', { level: 0.25 + 0.5 * glow, colour: c, mix: 0.6 });
      set('star', { level: 0.8 + 0.4 * flash, colour: GOLD });
      break;
    }
    case 'sweep': {
      // a sweep across the house, west to east, every bar, a new colour each bar
      const s = inBar / tune.bpb;
      const x = X0 - 6 + s * (X1 - X0 + 12);
      set('roof', { level: 1.5, colour: barColour, sweepX: x, sweepW: 7, sweepAmt: 1 });
      set('icicles', { level: 1.2, colour: ICE, sweepX: x - 3, sweepW: 6, sweepAmt: 1 });
      set('windows', { level: 0.4 + 1.1 * flash, colour: barColour, sweepX: nx, sweepW: 8, sweepAmt: 0.8 });
      set('candles', { level: 0.8, colour: GOLD });
      set('trees', { level: 0.4, colour: barColour, mix: 0.5, sparkle: 0.4 });
      set('star', { level: 1, colour: GOLD });
      break;
    }
    case 'build': {
      // the chase speeding up, everything brightening, sparkling more
      const k = THREE.MathUtils.clamp((local * tune.bpb + inBar) / (4 * tune.bpb), 0, 1);
      const chase = b * (1.5 + 6 * k * k);
      set('roof', { level: 0.5 + k, colour: PALETTE[Math.floor(chase / 3) % 3], chase, chaseAmt: 1 });
      set('icicles', { level: 0.4 + k, colour: ICE, sparkle: k });
      set('windows', { level: 0.3 + 0.9 * k + 0.5 * flash, colour: WHITE });
      set('candles', { level: 0.8, colour: GOLD });
      set('trees', { level: 0.3 + 0.8 * k, colour: WHITE, mix: 0.3, sparkle: 0.3 + 0.7 * k });
      set('star', { level: 1 + k, colour: GOLD });
      if (toEnd < 0.25) for (const r of ROLES) g[r].level *= toEnd / 0.25; // a beat of dark before the band
      break;
    }
    case 'flash':
    case 'finale': {
      // everything on the beat: the whole house on the bar's first beat, then its west half, then
      // its east half; a colour a bar (in the finale, a chase through the colours on top)
      const k = Math.floor(inBar);
      const halfL = k === 0 || k === 2 ? 1 : 0.12;
      const halfR = k === 0 || k === 1 ? 1 : 0.12;
      const fin = sec.style === 'finale';
      const c = fin ? PALETTE[(bar * 2 + k) % PALETTE.length] : barColour;
      set('roof', { level: 0.35 + 1.4 * beat, colour: c, halfL: tune.bpb === 3 ? halfL : k % 2 ? 0.15 : 1, halfR: tune.bpb === 3 ? halfR : k % 2 ? 1 : 0.15, chase: fin ? b * 4 : 0, chaseAmt: fin ? 0.5 : 0 });
      set('icicles', { level: 0.3 + 1.2 * flash, colour: ICE, sweepX: nx, sweepW: 9, sweepAmt: 0.7 });
      set('windows', { level: 0.3 + 1.3 * flash, colour: PALETTE[(bar + 1) % PALETTE.length], sweepX: nx, sweepW: 10, sweepAmt: 0.6 });
      set('candles', { level: 0.6 + 0.6 * beat, colour: GOLD });
      set('trees', { level: 0.45 + 0.9 * beat, colour: PALETTE[(bar + 2) % PALETTE.length], mix: 0.7, sparkle: fin ? 0.6 : 0.25 });
      set('star', { level: 1 + 1.2 * beat, colour: GOLD });
      break;
    }
    case 'toll': {
      // a bell a bar: a big wash of one colour that dies away with it
      const c = [RED, GOLD, GREEN, BLUE][bar % 4];
      const wash = Math.exp(-since * 0.9);
      set('roof', { level: 0.2 + 1.5 * wash, colour: c, chase: b * 0.8, chaseAmt: 0.35 });
      set('icicles', { level: 0.3 + 1.1 * wash, colour: ICE });
      set('windows', { level: 0.2 + 1.3 * wash, colour: c });
      set('candles', { level: 0.9, colour: GOLD });
      set('trees', { level: 0.3 + 1.1 * wash, colour: c, mix: 0.85 });
      set('star', { level: 1.2 + wash, colour: GOLD });
      house = 0.7;
      break;
    }
    case 'runs': {
      // the running quavers: a narrow band of light runs along the house with the tune
      set('roof', { level: 0.15 + 1.6 * flash, colour: barColour, sweepX: nx, sweepW: 4.5, sweepAmt: 1 });
      set('icicles', { level: 0.2 + 1.2 * flash, colour: ICE, sweepX: nx, sweepW: 4, sweepAmt: 1 });
      set('windows', { level: 0.2 + 1.4 * flash, colour: WHITE, sweepX: nx, sweepW: 5, sweepAmt: 1 });
      set('candles', { level: 0.7, colour: GOLD });
      set('trees', { level: 0.5, colour: WHITE, mix: 0.4, sparkle: 1 });
      set('star', { level: 1.2 + flash, colour: GOLD });
      break;
    }
    case 'dark': {
      // the house dark, but for the star and the candles, and the bells in the windows
      set('windows', { level: 0.9 * flash, colour: ICE, sweepX: nx, sweepW: 4, sweepAmt: 1 });
      set('candles', { level: 0.35, colour: GOLD });
      set('star', { level: 0.9 + 0.5 * glow, colour: GOLD });
      house = 1;
      break;
    }
    case 'hits': {
      // the band together on every note: the whole house on each, a colour each
      const c = PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
      set('roof', { level: 0.2 + 1.8 * flash, colour: c });
      set('icicles', { level: 0.2 + 1.5 * flash, colour: ICE });
      set('windows', { level: 0.2 + 1.6 * flash, colour: c });
      set('candles', { level: 0.6 + 0.8 * flash, colour: GOLD });
      set('trees', { level: 0.3 + 1.4 * flash, colour: c, mix: 0.8 });
      set('star', { level: 1.2 + flash, colour: GOLD });
      house = 0.85;
      break;
    }
    case 'blaze':
    default: {
      // the last chord: every light at once, warm white, and the house lit
      const k = Math.exp(-since * 0.35);
      for (const r of ROLES) set(r, { level: 0.9 + 1.2 * k, colour: r === 'icicles' ? ICE : r === 'trees' ? WHITE : r === 'star' ? GOLD : WHITE, mix: r === 'trees' ? 0.35 : 0.9, sparkle: r === 'trees' ? 0.3 : 0 });
      house = 0;
      break;
    }
  }
  return { groups: g, house };
}

// ---------------------------------------------------------------------------------------------

export class LightShow {
  /**
   * @param {THREE.Scene} scene
   * @param {object} o
   * @param {import('./sound.js').Sound} o.sound the viewer's sound (its context and master)
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh the collision tree, to find the wall by the door
   * @param {{centre: THREE.Vector3, normal: THREE.Vector3, width: number, y0: number, wide: string}} o.door the front door
   * @param {(day: number) => boolean} o.christmas whether a day has the Christmas lights up
   */
  constructor(scene, { sound, bvh, door, christmas }) {
    this.sound = sound;
    this.christmas = christmas;
    this.tuneAt = 0; // the next tune to play
    this.tune = null; // the one playing
    this.inReach = false;
    this.houseCut = 0; // how far the show dims the house's own lights (0 none .. 1 dark)
    this.sync = null; // what the show tells the Christmas lights (festive.sync)
    this._band = null;
    this._timer = 0;
    this._fade = 0; // after the end: the lights handing back over 3 s
    // the bell push: beside the door, on the right as you face it, on the wall
    const out = door.normal.clone();
    if (out.z < 0) out.negate();
    const right = new THREE.Vector3(-out.z, 0, out.x); // (facing the door from outside)
    const halfWidth = (door.width ?? 1.8) / 2;
    const ray = new THREE.Ray();
    let at = null;
    let normal = out.clone();
    for (const s of [0.42, 0.55, 0.32, 0.7]) {
      const from = door.centre.clone().addScaledVector(right, halfWidth + s).setY((door.y0 ?? 0) + 1.42).addScaledVector(out, 1.4);
      ray.set(from, out.clone().negate());
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 3);
      if (hit && hit.distance > 0.6 && Math.abs(hit.face.normal.dot(out)) > 0.8) {
        at = hit.point;
        break;
      }
    }
    if (!at) at = door.centre.clone().addScaledVector(right, halfWidth + 0.42).setY((door.y0 ?? 0) + 1.42).addScaledVector(out, 0.05);
    this.at = at.clone().addScaledVector(normal, 0.004);
    this.normal = normal;
    this.mesh = this._makeBell();
    this.mesh.position.copy(this.at);
    this.mesh.lookAt(this.at.clone().add(normal));
    scene.add(this.mesh);
    this._pressed = 0;
  }

  _makeBell() {
    const g = new THREE.Group();
    g.name = 'Doorbell';
    const brass = new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 1, roughness: 0.32 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.05, 0.012, 32).rotateX(Math.PI / 2).translate(0, 0, 0.006), brass);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 28).translate(0, 0, 0.013), brass);
    this.buttonMat = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.25, emissive: 0xffb050, emissiveIntensity: 0.25 });
    this.button = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 12).scale(1, 1, 0.55).translate(0, 0, 0.014), this.buttonMat);
    for (const m of [plate, ring, this.button]) {
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }

  get playing() {
    return !!this.tune;
  }

  /** Is the bell in reach (within 3 m, in front of it, looking at it)? */
  reach(camera) {
    const to = this.at.clone().sub(camera.position);
    const d = to.length();
    if (d > 3 || to.dot(this.normal) > 0) return false;
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    return fwd.dot(to.normalize()) > Math.cos(THREE.MathUtils.degToRad(38));
  }

  /** Does a ray (from a click) hit the bell, within `range` m? */
  hit(ray, range) {
    if (ray.origin.distanceTo(this.at) > range) return false;
    return ray.intersectsSphere(new THREE.Sphere(this.at, 0.2));
  }

  /** The audio clock, if the sound is running (else null: the lights keep their own). */
  _audio() {
    const ctx = this.sound?.ctx;
    return ctx && ctx.state === 'running' && this.sound.master ? ctx : null;
  }

  _bandFor(ctx) {
    if (!this._band || this._band.ctx !== ctx) this._band = new Band(ctx, this.sound.master);
    return this._band;
  }

  /**
   * Ring the bell: the chime, and at Christmas the show after it.
   * @param {{ day: number, exporting?: boolean, listener?: THREE.Vector3 }} o
   */
  ring({ day, exporting = false, listener = null } = {}) {
    if (exporting) return;
    this._pressed = 0.25;
    const ctx = this._audio() ?? this.sound?.ctx ?? null;
    const startIn = 2.9;
    if (ctx && this.sound.master) {
      // (heard from the door: quieter the further you are)
      const far = listener ? listener.distanceTo(this.at) : 2;
      const band = this._bandFor(ctx);
      const g = ctx.createGain();
      g.gain.value = 1.4 / (1 + far / 9);
      g.connect(this.sound.master);
      const t = ctx.currentTime + 0.12;
      // the first Westminster quarter: E C D G
      [76, 72, 74, 67].forEach((p, i) => band._chime(t + i * 0.62, p, 0.6, 0.9, g));
    }
    if (this.playing || !this.christmas(day)) return;
    this.start(startIn);
  }

  /**
   * Ring the bell once the picture runs smoothly again (a scene's first frames can stall for a
   * second or two while the lights' shaders compile, and the music is scheduled from this thread).
   */
  ringWhenReady(o) {
    this._waiting = { o, calm: 0 };
  }

  /** Start the show in `delay` seconds (the next tune). */
  start(delay = 0.4) {
    this.stop(true);
    this.tune = TUNES[this.tuneAt % TUNES.length];
    this.tuneAt++;
    this._next = 0;
    this._fade = 0;
    const ctx = this._audio();
    if (ctx) {
      this._ctx = ctx;
      this._t0 = ctx.currentTime + delay;
      this._clock = 'audio';
    } else {
      this._ctx = null;
      this._t0 = performance.now() / 1000 + delay;
      this._clock = 'own';
    }
    this._pump();
    this._timer = setInterval(() => this._pump(), 40);
  }

  /** Stop the show (the lights hand back gently, unless `now`). */
  stop(now = false) {
    this._waiting = null;
    clearInterval(this._timer);
    this._timer = 0;
    if (this.tune && !now) this._fade = 1;
    this.tune = null;
    if (this._ctx && this._band) {
      // let what is sounding die away quickly
      const out = this._band.out;
      const t = this._ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.08);
      this._band = null;
    }
    this._ctx = null;
  }

  /** Seconds into the tune (negative before it starts), on the clock it is kept by. */
  get pos() {
    if (!this.tune) return -1;
    if (this._clock === 'audio') {
      const lat = this._ctx.outputLatency || this._ctx.baseLatency || 0;
      return this._ctx.currentTime - this._t0 - lat;
    }
    return performance.now() / 1000 - this._t0;
  }

  /** Schedule the notes due in the next moment (and switch to the audio clock if the sound came on). */
  _pump() {
    const tune = this.tune;
    if (!tune) return;
    if (this._clock === 'own') {
      const ctx = this._audio();
      if (!ctx) return;
      // the sound came on mid-show: carry on from here, in step
      const pos = this.pos;
      this._ctx = ctx;
      this._t0 = ctx.currentTime - pos;
      this._clock = 'audio';
      this._next = tune.events.findIndex((e) => e.b * tune.spb >= pos);
      if (this._next < 0) this._next = tune.events.length;
    }
    const ctx = this._ctx;
    const band = this._bandFor(ctx);
    const horizon = ctx.currentTime - this._t0 + 0.3;
    const evs = tune.events;
    if (!(this._next >= 0)) this._next = 0;
    while (this._next < evs.length && evs[this._next].b * tune.spb < horizon) {
      const e = evs[this._next++];
      const when = this._t0 + e.b * tune.spb;
      if (when < ctx.currentTime - 0.05) continue; // (missed: a tab in the background)
      band.play(e, Math.max(when, ctx.currentTime), tune.spb);
    }
  }

  /**
   * Each frame: the lights from the music's clock, the hint, the end.
   * @param {number} dt
   * @param {{ camera: THREE.Camera, day: number, exporting?: boolean, listener?: THREE.Vector3 }} o
   */
  update(dt, { camera, day, exporting = false }) {
    this.inReach = !exporting && this.reach(camera);
    if (this._waiting) {
      // (three quarters of a second without a stall, then ring; or after five seconds whatever)
      const w = this._waiting;
      w.calm = dt < 0.2 ? w.calm + dt : 0;
      w.all = (w.all ?? 0) + Math.min(dt, 0.5);
      if (w.calm > 0.75 || w.all > 5) {
        const o = this._waiting.o;
        this._waiting = null;
        this.ring({ ...o, day, exporting });
      }
    }
    // the button glows a little, and goes in when pressed
    this._pressed = Math.max(0, this._pressed - dt);
    this.button.position.z = this._pressed > 0 ? -0.006 : 0;
    if (this.tune && (exporting || !this.christmas(day))) this.stop();
    if (this.tune) {
      const pos = this.pos;
      const b = pos / this.tune.spb;
      if (pos >= this.tune.length + 3.5) {
        this.stop();
      } else if (pos < 0) {
        // before the first note: the house goes dark
        const k = THREE.MathUtils.clamp(1 + pos / 0.9, 0, 1);
        this.sync = { amount: k, groups: Object.fromEntries(ROLES.map((r) => [r, { ...blank(), level: r === 'star' ? 0.7 : 0 }])) };
        this.houseCut = 0.55 * k;
      } else {
        const { groups, house } = lightsAt(this.tune, b);
        // after the last chord the ring dies away and the lights hand back over three seconds
        const after = pos - this.tune.length;
        const amount = after > 0 ? THREE.MathUtils.clamp(1 - after / 3.5, 0, 1) : 1;
        this.sync = { amount, groups };
        this.houseCut = house * amount;
      }
    } else if (this._fade > 0) {
      this._fade = Math.max(0, this._fade - dt / 1.5);
      if (this.sync) this.sync.amount = Math.min(this.sync.amount, this._fade);
      this.houseCut *= this._fade;
      if (this._fade === 0) this.sync = null;
    } else {
      this.sync = null;
      this.houseCut = 0;
    }
  }

  /** The score of a tune (for tests: render it offline). */
  static tunes() {
    return TUNES;
  }

  /** Render a whole tune into an OfflineAudioContext (for checking the mix): the notes go in a
   * second at a time as it renders, as they do live (thousands of waiting nodes would slow it to a
   * crawl). Call before startRendering. */
  static render(ctx, dest, index = 0) {
    const tune = TUNES[index % TUNES.length];
    const band = new Band(ctx, dest);
    const evs = tune.events;
    let next = 0;
    const upTo = (until) => {
      while (next < evs.length && 0.1 + evs[next].b * tune.spb < until) {
        const e = evs[next++];
        band.play(e, 0.1 + e.b * tune.spb, tune.spb);
      }
    };
    upTo(1.5);
    const end = ctx.length / ctx.sampleRate;
    for (let t = 1; t < end - 0.05; t += 1) {
      ctx.suspend(t).then(() => {
        upTo(t + 1.5);
        ctx.resume();
      });
    }
    return tune;
  }

  /** The lights at a moment of a tune (for tests). */
  static lightsAt(index, seconds) {
    const tune = TUNES[index % TUNES.length];
    return lightsAt(tune, seconds / tune.spb);
  }
}
