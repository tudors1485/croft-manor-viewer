// The loading bar, moving at the pace the loading really goes: steadily, from the start to the
// end, without racing ahead and then waiting.
//
// Loading is a few steps: the download (measured by its bytes and how fast they come), then
// unpacking the house, the collision tree for walking, planting the trees, and getting it all
// onto the graphics card. Each step's share of the bar is the time it takes on this machine:
// the download's from its speed so far, the others from how long they take on a reference
// machine, scaled by how long the steps done so far took here against it. So the bar's speed is
// the real speed, and the time left is the real time left.
//
// Between updates, and while the page is too busy to redraw (unpacking blocks it for a few
// seconds), the bar keeps sliding towards where the current step should end: the slide is
// drawn by the compositor, which carries on when the page can't.

// seconds each step takes on the reference machine (an Apple-silicon Mac in Chrome, measured)
const REFERENCE = {
  download: 0, // by its bytes and speed
  unpack: 1.3,
  house: 0.25,
  walk: 0.9,
  trees: 2.1,
  extras: 1.3,
  gpu: 4.2,
};

export class LoadingBar {
  /**
   * @param {object} o
   * @param {HTMLElement} o.cover the part of the bar still to fill (slid off to the right)
   * @param {HTMLElement} o.text the line under the bar
   * @param {number} o.bytes the download's expected size
   */
  constructor({ cover, text, bytes }) {
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
    this.label = 'The manor…';
    this.finished = false;
    this._timer = setInterval(() => this._draw(), 250);
  }

  /** How much slower (>1) or faster than the reference machine this one is, from the steps done. */
  get speed() {
    let took = 0;
    let ref = 0;
    for (const [s, t] of Object.entries(this.done)) {
      if (s === 'download') continue;
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
    this.label = `The manor: ${(loaded / 1e6).toFixed(0)} of ${(this.bytes / 1e6).toFixed(0)} MB`;
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

  /** The current step's own progress, when it knows it (0..1). */
  progress(f, label) {
    this.real = Math.max(0, Math.min(1, f));
    if (label) this.label = label;
    this._draw();
  }

  /** Seconds the current step is expected to take, all told. */
  _expected(elapsed) {
    let e;
    if (this.step === 'download') {
      // from the speed so far (until enough has come in to tell, a guess of 6 MB/s)
      const frac = this.real ?? 0;
      e = frac > 0.03 && elapsed > 0.5 ? elapsed / frac : elapsed + (this.bytes - this.loaded) / 6e6;
    } else {
      // (a step's own progress isn't steady enough to time it by: the collision tree reaches 80% in
      // a third of its time, so the time comes from the reference and this machine's speed)
      e = (REFERENCE[this.step] ?? 0) * this.speed;
    }
    // running late: it is still going, so the bar keeps creeping (more slowly) rather than stopping
    return Math.max(e, elapsed * 1.12 + 0.1);
  }

  /** Where the bar should be now, and where it should be when this step ends; and the time left. */
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
      left: Math.max(0, expected - elapsed + after),
      stepLeft: Math.max(0.05, expected - elapsed),
    };
  }

  _draw() {
    if (this.finished) return;
    const p = this._plan();
    // never backwards, and no jumps: from wherever the bar is, it slides to where this step should
    // end, by the time it should end (catching up if the estimate moved on, slowing if it moved back)
    const at = Math.max(this.shown, this._animated());
    const end = Math.max(at, Math.min(p.end, 0.995));
    this.shown = at;
    // (one slide a step, changed only when the estimate moves: a busy page draws few frames, and a
    // slide restarted every quarter-second would never get going)
    const a = this.anim;
    if (!a || a._step !== this.step || a.playState === 'finished' || Math.abs(a._to - end) > 0.02) this._slide(at, end, p.stepLeft);
    const left = p.left > 9.5 ? Math.ceil(p.left / 5) * 5 : Math.ceil(p.left);
    const tail = performance.now() - this.t0 > 1500 && left >= 3 ? ` · about ${left} s left` : '';
    this.text.textContent = this.label + tail;
  }

  /** Where the compositor's slide has got to. */
  _animated() {
    const a = this.anim;
    if (!a) return 0;
    // (by the clock, not the animation's own time: after the page has been busy, that lags until
    // the next frame, while the compositor's slide carried on)
    return a._from + (a._to - a._from) * Math.min(1, (performance.now() - a._t0) / a._ms);
  }

  _slide(from, to, seconds) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || !(seconds > 0)) return;
    this.anim?.cancel();
    const tx = (f) => `translateX(${(f * 100).toFixed(2)}%)`;
    this.anim = this.cover.animate([{ transform: tx(from) }, { transform: tx(to) }], { duration: seconds * 1000, easing: 'linear', fill: 'forwards' });
    this.anim._from = from;
    this.anim._to = to;
    this.anim._ms = seconds * 1000;
    this.anim._t0 = performance.now();
    this.anim._step = this.step;
  }

  /** All done: the bar runs to the end. */
  finish(label = 'Ready') {
    clearInterval(this._timer);
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
    this.finished = true;
    this.anim?.pause();
    this.text.textContent = message;
  }
}

/** Lets the page draw (the bar and its line) before the next piece of work. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
