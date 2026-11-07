// The loading bar: what is loading and being done, said plainly and changed the moment each step
// is done; the megabytes as they come in; and tips underneath while you wait, as games have.
//
// Loading is a few steps: the download (measured by its bytes and how fast they come), then
// unpacking the house, laying out the grounds, the collision tree for walking, planting the
// trees, the finishing touches, and getting it all onto the graphics card (the shaders, the
// textures, the first view). Each step's share of the bar is the time it takes on this machine:
// the download's and the textures' from their own progress, the others from how long they take
// on a reference machine, scaled by how long the steps done so far took here against it.
//
// Between updates, and while the page is too busy to redraw, the bar keeps sliding towards where
// the current step should end: the slide is drawn by the compositor, which carries on when the
// page can't. When a step ends early the bar catches up at once.

// seconds each step takes on the reference machine (an Apple-silicon Mac in Chrome, measured 7 Nov)
const REFERENCE = {
  download: 0, // by its bytes and speed
  unpack: 1.6,
  house: 0.25,
  walk: 1.2, // (with the textures going up meanwhile)
  trees: 0.9,
  extras: 0.7,
  shaders: 0.25,
  textures: 1.4, // by its own progress, once under way
  frame: 1.0,
};
// steps whose own progress is steady enough to time them by
const STEADY = new Set(['download', 'textures']);

// while you wait
export const TIPS = [
  'Hold Shift to run. Press Run, and Shift walks instead.',
  'Click the picture to look around with the mouse. Esc gives it back.',
  'Doors open as you walk up to them: try the front door, and the kitchen.',
  'L turns the light of the room you are in on and off.',
  'Turn the Compass, and the whole sky turns with it.',
  'The stars and the moon are where they really are, for that date and hour.',
  'The ▶ by the time runs a day in two minutes; the one by the season, a year in a minute.',
  'Holidays takes you to Easter, Halloween, Bonfire Night, Christmas Eve or New Year.',
  'Sights: the northern lights, deer at dawn (and the hunt), a rainbow, crows in autumn.',
  'The animals come and go with the season and the hour. Not every day.',
  'On Easter weekend, a dozen eggs are hidden on the lawns.',
  'At night, Your light gives you a glow, a torch, or a flaming torch to carry.',
  'The tour is always a clear summer afternoon. Your own time and weather come back after.',
  'Tick With seasons and weathers, and a flyby changes every few seconds.',
  'Make a video records any flyby as an MP4, with its sound.',
  'Photo mode hides the panel and lets you pick a film look.',
  'Now sets today’s date and the time, and keeps time.',
  'Flying, you go faster the higher you are.',
];

export class LoadingBar {
  /**
   * @param {object} o
   * @param {HTMLElement} o.cover the part of the bar still to fill (slid off to the right)
   * @param {HTMLElement} o.text the line under the bar
   * @param {HTMLElement} [o.tip] the tip under that
   * @param {number} o.bytes the download's expected size
   */
  constructor({ cover, text, tip = null, bytes }) {
    this.cover = cover;
    this.text = text;
    this.bytes = bytes;
    this.steps = Object.keys(REFERENCE);
    this.done = {}; // step -> seconds it took
    this.step = 'download';
    this.stepAt = performance.now();
    this.t0 = this.stepAt;
    this.loaded = 0;
    this.real = null; // the current step's own progress 0..1, when it can tell
    this.shown = 0;
    this.anim = null;
    this.label = 'Downloading the house…';
    this.finished = false;
    this._timer = setInterval(() => this._draw(), 250);
    // a new tip every few seconds, starting anywhere in the list
    if (tip) {
      let k = Math.floor(Math.random() * TIPS.length);
      tip.textContent = TIPS[k];
      this._tips = setInterval(() => {
        tip.classList.add('fade');
        setTimeout(() => {
          k = (k + 1) % TIPS.length;
          tip.textContent = TIPS[k];
          tip.classList.remove('fade');
        }, 350);
      }, 6500);
    }
  }

  /** How much slower (>1) or faster than the reference machine this one is, from the steps done. */
  get speed() {
    let took = 0;
    let ref = 0;
    for (const [s, t] of Object.entries(this.done)) {
      if (STEADY.has(s)) continue;
      took += t;
      ref += REFERENCE[s];
    }
    // (before any step is done, assume the reference; a phone may be three times slower)
    return ref > 0.2 ? Math.min(6, Math.max(0.35, took / ref)) : 1;
  }

  /** The download so far. */
  downloaded(loaded, total) {
    this.loaded = loaded;
    if (total) this.bytes = total;
    this.real = this.bytes ? Math.min(1, loaded / this.bytes) : null;
    this.label = `Downloading the house: ${(loaded / 1e6).toFixed(0)} of ${(this.bytes / 1e6).toFixed(0)} MB`;
    this._draw();
  }

  /** Starts the next step (and ends the one before), with the line to show under the bar. */
  begin(step, label) {
    const now = performance.now();
    if (!this.done[this.step]) this.done[this.step] = (now - this.stepAt) / 1000;
    console.info(`loading: ${this.step} took ${this.done[this.step].toFixed(2)} s`);
    this.step = step;
    this.stepAt = now;
    this.real = null;
    if (label) this.label = label;
    this._draw();
  }

  /** The current step's own progress, when it knows it (0..1), and what it is doing now. */
  progress(f, label) {
    this.real = Math.max(0, Math.min(1, f));
    if (label) this.label = label;
    this._draw();
  }

  /** Seconds the current step is expected to take, all told. */
  _expected(elapsed) {
    let e;
    const frac = this.real ?? 0;
    if (this.step === 'download') {
      // from the speed so far (until enough has come in to tell, a guess of 6 MB/s)
      e = frac > 0.03 && elapsed > 0.5 ? elapsed / frac : elapsed + (this.bytes - this.loaded) / 6e6;
    } else if (STEADY.has(this.step) && frac > 0.15 && elapsed > 0.2) {
      e = elapsed / frac;
    } else {
      // (most steps' own progress isn't steady enough to time them by: the collision tree reaches
      // 80% in a third of its time, so the time comes from the reference and this machine's speed)
      e = (REFERENCE[this.step] ?? 0) * this.speed;
    }
    // running late: it is still going, so the bar keeps creeping (more slowly) rather than stopping
    return Math.max(e, elapsed * 1.12 + 0.1);
  }

  /** Where the bar should be now, and where it should be when this step ends. */
  _plan() {
    const now = performance.now();
    const elapsed = (now - this.stepAt) / 1000;
    let before = 0;
    let after = 0;
    let passed = false;
    for (const s of this.steps) {
      if (s === this.step) passed = true;
      else if (!passed) before += this.done[s] ?? 0;
      else after += REFERENCE[s] * this.speed;
    }
    const expected = this._expected(elapsed);
    const total = before + expected + after;
    return {
      now: (before + elapsed) / total,
      end: (before + expected) / total,
      stepLeft: Math.max(0.05, expected - elapsed),
    };
  }

  _draw() {
    if (this.finished) return;
    const p = this._plan();
    // never backwards: from wherever the bar is, it slides to where this step should end, by the
    // time it should end; if it has fallen behind (a step ended early), it catches up first
    const at = Math.max(this.shown, this._animated());
    const end = Math.max(at, Math.min(p.end, 0.995));
    this.shown = at;
    const a = this.anim;
    if (at < p.now - 0.02) {
      // (behind: a quick catch-up to where it should be, then on from there)
      if (!a || a._step !== this.step || !a._catchUp || a.playState === 'finished') this._slide(at, Math.min(p.now, end), 0.25, true);
    } else if (!a || a._step !== this.step || a.playState === 'finished' || a._catchUp || Math.abs(a._to - end) > 0.02) {
      // (one slide a step, changed only when the estimate moves: a busy page draws few frames, and
      // a slide restarted every quarter-second would never get going)
      this._slide(at, end, p.stepLeft);
    }
    if (this.text.textContent !== this.label) this.text.textContent = this.label;
  }

  /** Where the compositor's slide has got to. */
  _animated() {
    const a = this.anim;
    if (!a) return 0;
    // (by the clock, not the animation's own time: after the page has been busy, that lags until
    // the next frame, while the compositor's slide carried on)
    const f = Math.min(1, (performance.now() - a._t0) / a._ms);
    return a._from + (a._to - a._from) * (a._catchUp ? 1 - (1 - f) * (1 - f) : f);
  }

  _slide(from, to, seconds, catchUp = false) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || !(seconds > 0)) return;
    this.anim?.cancel();
    const tx = (f) => `translateX(${(f * 100).toFixed(2)}%)`;
    // (the catch-up eases out, as the reading of it above assumes)
    this.anim = this.cover.animate([{ transform: tx(from) }, { transform: tx(to) }], { duration: seconds * 1000, easing: catchUp ? 'cubic-bezier(0.33, 0.67, 0.67, 1)' : 'linear', fill: 'forwards' });
    this.anim._from = from;
    this.anim._to = to;
    this.anim._ms = seconds * 1000;
    this.anim._t0 = performance.now();
    this.anim._step = this.step;
    this.anim._catchUp = catchUp;
  }

  /** All done: the bar runs to the end. */
  finish(label = 'Ready') {
    clearInterval(this._timer);
    clearInterval(this._tips);
    this.finished = true;
    this.done[this.step] = (performance.now() - this.stepAt) / 1000;
    console.info(`loading: ${this.step} took ${this.done[this.step].toFixed(2)} s`);
    const from = Math.max(this.shown, this._animated());
    this._slide(from, 1, 0.15);
    this.text.textContent = label;
    const took = (performance.now() - this.t0) / 1000;
    console.info(`loading: ready in ${took.toFixed(1)} s (this machine ${this.speed.toFixed(2)}× the reference's time)`);
  }

  /** It went wrong: stop the bar where it is and say so. */
  fail(message) {
    clearInterval(this._timer);
    clearInterval(this._tips);
    this.finished = true;
    this.anim?.pause();
    this.text.textContent = message;
  }
}

/** Lets the page draw (the bar and its line) before the next piece of work. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
