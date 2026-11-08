// Seasons at once: one camera, one picture, split down the middle into two seasons (summer |
// winter) or into four quarters (spring, summer, autumn, winter), each part showing the same view
// in its own season: its date (the leaves, the grass, the snow lying, the ice), its weather (snow
// falling in winter, a light haze in autumn) and its sun at the same hour.
//
// How: every frame each part is drawn on its own. Its season's state is put on (the shared season
// uniforms, the sky, the sun, the fog and the ambient light through TimeOfDay.update, the snow and
// rain falling, the fallen leaves, the snowman, the daffodils, the blossom, the fountain's jet) and the picture
// is drawn through the post-processing at the part's size, with the camera's view offset to that
// part of the frustum, into that part of the canvas (Quality.renderParts). Then the real state is
// put back, so nothing else ever sees a part's season. Each season has its own environment map,
// made once as the flyby starts and copied into one shared texture before its part is drawn (so
// the materials never see another texture, which would make three look at every shader again), and
// its own map of the sun's shadows: in a flyby the shadows cover the whole estate and the sun keeps
// still, so each season's is drawn once and then refreshed one part at a time, every other frame,
// instead of all of them every frame. A thin line divides the parts, and each is labelled.

import * as THREE from 'three';
import { seasonAt, seasonUniforms, dateLabel } from './season.js';
import { weatherAt } from './weather.js';

// the parts' seasons, in the order of the parts: two side by side (left, right), four quarters
// (top left, top right, bottom left, bottom right), or four upright strips side by side, the year
// from left to right ('v4'). All at two in the afternoon, the winter sun low.
const SPRING = { day: 100, hours: 14, weather: 'clouds', name: 'Spring' }; // (10 April: the daffodils out and the trees round the lawns in blossom, against the bare winter and the green summer)
const SUMMER = { day: 188, hours: 14, weather: 'clear', name: 'Summer' };
const AUTUMN = { day: 291, hours: 14, weather: 'clear', name: 'Autumn', tweak: { fog: 0.12 } }; // (a light haze)
const WINTER = { day: 22, hours: 14, weather: 'snow', name: 'Winter', tweak: { snowing: 0.55, fog: 0.1 } }; // (snow falling, the house still to be seen)
// how each is laid out: [columns, rows] ('carousel': four upright strips sliding to the left, a
// fifth coming in at the right as the first goes out at the left, each the season after the last)
const LAYOUTS = { 2: [2, 1], 4: [2, 2], v4: [4, 1], carousel: [4, 1] };
const SLIDE = 3.2; // (the carousel: seconds for a strip to slide its own width, so a year in 13 s)

export const SPLITS = {
  2: [SUMMER, WINTER],
  4: [SPRING, SUMMER, WINTER, AUTUMN],
  v4: [SPRING, SUMMER, AUTUMN, WINTER],
  carousel: [SPRING, SUMMER, AUTUMN, WINTER],
};

/** A season's state: the uniforms' values and the weather, worked out once. */
function stateOf(sc) {
  const season = seasonAt(sc.day);
  const snow = sc.weather === 'snow' ? 1 : season.snow;
  const w = { ...weatherAt(sc.day, sc.hours, snow, sc.weather), ...(sc.tweak ?? {}) };
  return {
    ...sc,
    snow,
    w,
    grass: new THREE.Color(...season.grass),
    ice: Math.max(season.ice, THREE.MathUtils.smoothstep(snow, 0.5, 0.85)),
    wet: Math.min(1, (w.rain ?? 0) * 3),
    label: `${sc.name} · ${dateLabel(sc.day)}`,
  };
}

export class SplitSeasons {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {import('./quality.js').Quality} o.quality
   * @param {THREE.PerspectiveCamera} o.camera
   * @param {import('./sky.js').TimeOfDay} o.tod
   * @param {object} o.snowfall (season.js Snowfall)
   * @param {object} o.rainfall (weather.js Rainfall)
   * @param {() => object} o.world what else changes with the season, made later: { landscape,
   *   leaves, snowman, easter, blossom, water, jetAllowed: boolean, perPart?: (state) => void }
   */
  constructor({ renderer, quality, camera, tod, snowfall, rainfall, world }) {
    this.renderer = renderer;
    this.quality = quality;
    this.camera = camera;
    this.tod = tod;
    this.snowfall = snowfall;
    this.rainfall = rainfall;
    this.world = world;
    this.n = 0;
    this.states = [];
    // the dividing lines and the labels: a canvas over the whole picture, drawn in WebGL last, so a
    // video of the flyby has them too
    this.oCanvas = document.createElement('canvas');
    this.oTexture = new THREE.CanvasTexture(this.oCanvas);
    this.oTexture.colorSpace = THREE.SRGBColorSpace;
    this.oTexture.minFilter = THREE.LinearFilter;
    this.oTexture.generateMipmaps = false;
    this.oScene = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.oScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.oTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })));
    this._oKey = '';
    this._size = new THREE.Vector2();
    this._buffer = new THREE.Vector2();
  }

  get active() {
    return this.n > 0;
  }

  begin(n) {
    if (!SPLITS[n]) return;
    this.id = n;
    this.carousel = n === 'carousel';
    this.slide = 0; // (the carousel: seconds slid)
    [this.cols, this.rows] = LAYOUTS[n];
    this.n = this.cols * this.rows;
    this.states = SPLITS[n].map(stateOf);
    const t = this.tod;
    // each season's environment map, made now (TimeOfDay's own is kept aside meanwhile)
    const base = this._capture();
    const own = t.envTarget;
    t.envTarget = null;
    // (and one more, the shared one the materials see: made the same way, so it is laid out the same,
    // a cube map with its blurred levels as mipmaps)
    for (const st of [...this.states, null]) {
      const sc = st ?? this.states[0];
      t.day = sc.day;
      t.hours = sc.hours;
      t.weather = sc.w;
      t.windy = sc.w.wind;
      t.update(true);
      if (st) st.env = t.envTarget;
      else this.envShared = t.envTarget;
      t.envTarget = null;
    }
    t.envTarget = own;
    this._apply(base);
    t.scene.environment = this.envShared.texture;
    // the sun's shadows: a map per season (a little coarser than the usual one), drawn when asked
    const sh = t.light.shadow;
    this._shadow = { map: sh.map, matrix: sh.matrix.clone(), size: sh.mapSize.clone(), auto: sh.autoUpdate };
    sh.autoUpdate = false;
    sh.mapSize.set(2048, 2048);
    this.shadows = this.states.map(() => ({ map: null, matrix: new THREE.Matrix4() }));
    this.frame = 0;
    // (a video turns the adapting off for itself and back on after it: not ours to keep off then)
    this._wasAdaptive = this.quality.fixed ? true : this.quality.adaptive;
    this.quality.adaptive = false; // (the parts make the frame rate say nothing about the resolution: _adapt)
    this._ratio = this.quality.ratio;
    this._fps = { since: performance.now() + 2000, frames: 0 }; // (after the first moments, while the maps are made)
    this.quality.split = this.n;
    this.quality.splitLayout = [this.cols, this.rows];
    this.quality.apply();
    this._oKey = '';
  }

  end() {
    if (!this.n) return;
    this.n = 0;
    this.id = null;
    const t = this.tod;
    // TimeOfDay's own environment map and shadow map back; the seasons' let go
    for (const st of this.states) st.env?.dispose();
    this.envShared?.dispose();
    this.envShared = null;
    t.scene.environment = t.envTarget?.texture ?? null;
    const sh = t.light.shadow;
    for (const c of this.shadows ?? []) if (c.map && c.map !== this._shadow.map) c.map.dispose();
    this.shadows = [];
    sh.map = this._shadow.map;
    sh.matrix.copy(this._shadow.matrix);
    sh.mapSize.copy(this._shadow.size);
    sh.autoUpdate = this._shadow.auto;
    sh.needsUpdate = true;
    this.quality.split = 0;
    this.quality.splitLayout = null;
    this.quality.adaptive = !this.quality.fixed && (this._wasAdaptive ?? true);
    if (this._ratio) this.quality.ratio = this._ratio;
    this.quality.apply();
    this.camera.clearViewOffset();
  }

  /**
   * On a slow machine the resolution comes down while the parts are drawn (to as little as 0.6 of
   * the screen's), and back up when there is room; as it was once the flyby ends. (Not in a video:
   * that is drawn at its own size, frame by frame.)
   */
  _adapt() {
    const q = this.quality;
    if (q.fixed || !this._wasAdaptive) return; // (nor when the viewer's own adapting was off)
    const a = this._fps;
    const now = performance.now();
    if (now < a.since) return;
    a.frames++;
    const span = now - a.since;
    if (span < 1500) return;
    const fps = (a.frames * 1000) / span;
    a.since = now;
    a.frames = 0;
    let next = q.ratio;
    if (fps < 24 && q.ratio > 0.6) next = Math.max(0.6, q.ratio * 0.85);
    else if (fps > 45 && q.ratio < this._ratio) next = Math.min(this._ratio, q.ratio + 0.1);
    if (next !== q.ratio) {
      q.ratio = Math.round(next * 100) / 100;
      q.apply();
      this._oKey = ''; // (the lines and labels drawn again at the new size)
      a.since = now + 500;
    }
  }

  /** The parts, in CSS pixels from the top left: [{ x, y, w, h }]. */
  _regions() {
    const { x: W, y: H } = this.renderer.getSize(this._size);
    const cols = this.cols;
    const rows = this.rows;
    const w = Math.ceil(W / cols);
    const h = Math.ceil(H / rows);
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: c * w, y: r * h, w: Math.min(w, W - c * w), h: Math.min(h, H - r * h) });
    return out;
  }

  /**
   * The carousel's strips, in CSS pixels: five of a quarter of the width each, slid to the left by
   * however far they have gone (the first going out at the left, the fifth coming in at the right),
   * cut to the screen; each with its season (the next to the right of each), and where the whole
   * strip is (`left`, `width`, for its line and its label).
   */
  _carouselRegions() {
    const { x: W, y: H } = this.renderer.getSize(this._size);
    const w = W / this.cols;
    const slid = this.slide / SLIDE;
    const shift = Math.floor(slid);
    const off = (slid - shift) * w;
    const out = [];
    for (let i = 0; i <= this.cols; i++) {
      const left = i * w - off;
      const a = Math.max(0, Math.round(left));
      const b = Math.min(W, Math.round(left + w));
      if (b - a >= 1) out.push({ x: a, y: 0, w: b - a, h: H, state: (i + shift) % this.n, left, width: w });
    }
    return out;
  }

  /** Draws the picture in its parts (instead of Quality.render), each in its season. */
  render(dt, n) {
    if (this.id !== n) {
      this.end();
      this.begin(n);
    }
    const base = this._capture();
    this.quality.fisheye = 0; // (each part would bend on its own: the seams wouldn't meet)
    this.tod.scene.environment = this.envShared.texture; // (in case TimeOfDay made a new one meanwhile)
    this._adapt();
    if (this.carousel) this.slide += dt;
    const regions = this.carousel ? this._carouselRegions() : this._regions();
    const sh = this.tod.light.shadow;
    // (one season's shadows refreshed every other frame; any without its map yet, now; once a frame
    // each, though the carousel can show a season in two strips)
    const refresh = this.frame % 2 === 0 ? (this.frame / 2) % this.n : -1;
    this.frame++;
    const drawn = new Set();
    const season = (i) => regions[i].state ?? i;
    this.quality.renderParts(
      dt,
      regions,
      (i) => {
        const k = season(i);
        this._apply(this.states[k]);
        const c = this.shadows[k];
        sh.map = c.map;
        if (c.map) sh.matrix.copy(c.matrix);
        sh.needsUpdate = !c.map || (k === refresh && !drawn.has(k));
        drawn.add(k);
      },
      (i) => {
        const c = this.shadows[season(i)];
        c.map = sh.map;
        c.matrix.copy(sh.matrix);
      },
    );
    this._apply(base);
    if (this.carousel) this._drawCarouselOverlay(regions);
    else this._drawOverlay(regions);
  }

  /**
   * The carousel's lines and labels, which move every frame: drawn as small quads (a line, a label
   * made once per season) rather than by painting the whole picture's canvas again each frame. Each
   * label rides at the top left of its strip, and stays in sight at the screen's left edge until its
   * strip has nearly gone.
   */
  _drawCarouselOverlay(regions) {
    const r = this.renderer;
    const { x: W, y: H } = r.getSize(this._size);
    const buf = r.getDrawingBufferSize(this._buffer);
    const u = buf.y / 1080;
    const sx = buf.x / W;
    if (!this._co) {
      const scene = new THREE.Scene();
      const plane = new THREE.PlaneGeometry(1, 1);
      const quad = (colour, opacity, map = null) => {
        const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: colour, opacity, map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
        m.frustumCulled = false;
        scene.add(m);
        return m;
      };
      const lines = Array.from({ length: this.cols + 1 }, () => [quad(0x000000, 0.28), quad(0xfffaf0, 0.85)]);
      const labels = Array.from({ length: this.cols + 1 }, () => quad(0xffffff, 1));
      this._co = { scene, lines, labels, key: '', tex: [] };
    }
    const co = this._co;
    // the labels' pictures, at this size (again when it changes)
    const key = `${buf.x}x${buf.y}`;
    if (co.key !== key) {
      co.key = key;
      for (const t of co.tex) t.texture.dispose();
      co.tex = this.states.map((st) => {
        const c = document.createElement('canvas');
        const g = c.getContext('2d');
        const font = `600 ${Math.round(26 * u)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
        g.font = font;
        const ph = Math.round(44 * u);
        const pw = Math.round(g.measureText(st.label).width + 30 * u);
        c.width = pw;
        c.height = ph;
        g.font = font;
        g.textBaseline = 'middle';
        g.fillStyle = 'rgba(12,13,16,0.55)';
        g.beginPath();
        g.roundRect(0, 0, pw, ph, ph / 2);
        g.fill();
        g.fillStyle = 'rgba(250,246,236,0.96)';
        g.fillText(st.label, 15 * u, ph / 2 + 1 * u);
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        return { texture, pw, ph };
      });
    }
    // (from buffer pixels to the ortho camera's -1..1)
    const nx = (px) => (px / buf.x) * 2 - 1;
    const ny = (py) => 1 - (py / buf.y) * 2;
    let li = 0;
    for (const p of regions) {
      const left = p.left * sx;
      const right = (p.left + p.width) * sx;
      // the line at the strip's left edge (if it is on the screen)
      if (left > 0.5 && left < buf.x - 0.5) {
        const [shadow, light] = co.lines[li++];
        for (const [m, width] of [[shadow, 6 * u], [light, 2.2 * u]]) {
          m.visible = true;
          m.position.set(nx(left), 0, 0);
          m.scale.set((Math.max(1, width) / buf.x) * 2, 2, 1);
        }
      }
    }
    for (; li < co.lines.length; li++) for (const m of co.lines[li]) m.visible = false;
    const bar = 0.105 * buf.y;
    co.labels.forEach((m, i) => {
      const p = regions[i];
      if (!p) return void (m.visible = false);
      const t = co.tex[p.state];
      const left = p.left * sx;
      const right = (p.left + p.width) * sx;
      const x = Math.min(Math.max(left, 0), right - t.pw - 14 * u) + 7 * u;
      m.visible = true;
      m.material.map = t.texture;
      m.position.set(nx(x + t.pw / 2), ny(bar + 34 * u), 0);
      m.scale.set((t.pw / buf.x) * 2, (t.ph / buf.y) * 2, 1);
    });
    r.setRenderTarget(null);
    r.setViewport(0, 0, W, H);
    const auto = r.autoClear;
    r.autoClear = false;
    r.render(co.scene, this.oCam);
    r.autoClear = auto;
  }

  /** The real state, to be put back after the parts. */
  _capture() {
    const U = seasonUniforms;
    const t = this.tod;
    const w = this.world();
    return {
      base: true,
      day: U.uDay.value,
      snow: U.uSnow.value,
      grass: U.uGrassTint.value.clone(),
      ice: U.uIce.value,
      wet: U.uWet.value,
      todDay: t.day,
      hours: t.hours,
      w: t.weather,
      windy: t.windy,
      env: [t.lastEnvDay, t.lastEnvHours, t.lastEnvClouds, t.lastEnvOvercast],
      snowAmount: this.snowfall.material.uniforms.uAmount.value,
      snowShown: this.snowfall.points.visible,
      rainAmount: this.rainfall.material.uniforms.uAmount.value,
      rainShown: this.rainfall.lines.visible,
      jet: w.water?.jet?.visible ?? false,
      snowmanDay: w.snowman?._day,
      snowmanLying: w.snowman?._lying,
      blossomShown: w.blossom?.group.visible ?? false,
      petals: w.blossom?.petals.material.uniforms.uAmount.value ?? 0,
    };
  }

  /** Puts on a part's season (or, with a captured state, the real one back). */
  _apply(s) {
    const U = seasonUniforms;
    const t = this.tod;
    const w = this.world();
    U.uDay.value = s.day;
    U.uSnow.value = s.snow;
    U.uGrassTint.value.copy(s.grass);
    U.uIce.value = s.ice;
    U.uWet.value = s.wet;
    t.day = s.base ? s.todDay : s.day;
    t.hours = s.hours;
    t.weather = s.w;
    t.windy = s.w.wind;
    // (the environment map is not remade for a part: TimeOfDay is told it is up to date)
    if (s.base) [t.lastEnvDay, t.lastEnvHours, t.lastEnvClouds, t.lastEnvOvercast] = s.env;
    else [t.lastEnvDay, t.lastEnvHours, t.lastEnvClouds, t.lastEnvOvercast] = [t.day, t.hours, s.w.clouds, s.w.overcast];
    t.update(false);
    // (the season's environment map, into the one the materials know)
    if (!s.base && s.env && this.envShared) this._copyEnv(s.env, this.envShared);
    w.landscape?.update(0, t); // (the far woods' baked light, from the sky's)
    // snow and rain falling, in their own part only
    const snowing = s.base ? s.snowAmount : (s.w.snowing ?? 0) * (1 - t.inside);
    const raining = s.base ? s.rainAmount : (s.w.rain ?? 0) * (1 - t.inside);
    this.snowfall.material.uniforms.uAmount.value = snowing;
    this.snowfall.points.visible = s.base ? s.snowShown : snowing > 0.01;
    this.rainfall.material.uniforms.uAmount.value = raining;
    this.rainfall.lines.visible = s.base ? s.rainShown : raining > 0.01;
    w.leaves?.update(); // (fallen leaves, from the uniforms)
    if (w.snowman) {
      w.snowman._lying = s.base ? s.snowmanLying : s.snow;
      w.snowman.update(s.base ? (s.snowmanDay ?? s.day) : s.day);
    }
    w.easter?.update(0, { day: s.day, night: t.night, snow: s.snow, wind: s.w.wind ?? 0, feet: null });
    // the blossom round the lawns (sights3.js), in its own part only: at once, not eased in
    if (w.blossom) {
      const b = w.blossom;
      const bloom = s.base ? 0 : b.constructor.bloom(s.day) * (s.snow > 0.4 ? 0 : 1);
      b.group.visible = s.base ? s.blossomShown : bloom > 0.02;
      b.petals.material.uniforms.uAmount.value = s.base ? s.petals : bloom * (this.camera.position.y < 30 ? 1 : 0);
    }
    if (w.water?.jet) w.water.jet.visible = s.base ? s.jet : s.ice < 0.5 && w.jetAllowed;
    w.perPart?.(s);
  }

  /**
   * One environment map into another, face by face and level by level (three's PMREM maps are cube
   * maps with their blurred levels as mipmaps): blits between framebuffers, through three's state so
   * it keeps track of what is bound.
   */
  _copyEnv(src, dst) {
    const r = this.renderer;
    const gl = r.getContext();
    const state = r.state;
    const from = r.properties.get(src.texture).__webglTexture;
    const to = r.properties.get(dst.texture).__webglTexture;
    if (!from || !to) return;
    this._fbFrom ??= gl.createFramebuffer();
    this._fbTo ??= gl.createFramebuffer();
    const scissor = r.getScissorTest();
    r.setScissorTest(false); // (blits are clipped by the scissor too)
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, this._fbFrom);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._fbTo);
    const levels = Math.max(1, src.texture.mipmaps?.length ?? 1);
    for (let level = 0; level < levels; level++) {
      const w = Math.max(1, src.width >> level);
      for (let face = 0; face < 6; face++) {
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, from, level);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, to, level);
        gl.blitFramebuffer(0, 0, w, w, 0, 0, w, w, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      }
    }
    state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    r.setScissorTest(scissor);
  }

  /** The dividing lines and the labels, over the whole picture. */
  _drawOverlay(regions) {
    const r = this.renderer;
    const { x: W, y: H } = r.getSize(this._size);
    const buf = r.getDrawingBufferSize(this._buffer);
    const key = `${this.id}:${buf.x}x${buf.y}`;
    if (key !== this._oKey) {
      this._oKey = key;
      const c = this.oCanvas;
      // (at a new size the texture is made again: three keeps the first one's storage and would put
      // the smaller picture in a corner of it, over the old lines, so the lines seemed to jump each
      // time the resolution came down)
      if (c.width !== buf.x || c.height !== buf.y) this.oTexture.dispose();
      c.width = buf.x;
      c.height = buf.y;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      const sx = buf.x / W;
      const sy = buf.y / H;
      const u = buf.y / 1080; // (sized to read the same at any size)
      // the lines: a soft shadow under a thin light line
      g.lineCap = 'butt';
      const line = (x0, y0, x1, y1) => {
        for (const [width, colour] of [
          [6 * u, 'rgba(0,0,0,0.28)'],
          [2.2 * u, 'rgba(255,250,240,0.85)'],
        ]) {
          g.strokeStyle = colour;
          g.lineWidth = Math.max(1, width);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
        }
      };
      // (between the columns, and between the rows)
      for (let c = 1; c < this.cols; c++) line(regions[c].x * sx, 0, regions[c].x * sx, buf.y);
      for (let r = 1; r < this.rows; r++) line(0, regions[r * this.cols].y * sy, buf.x, regions[r * this.cols].y * sy);
      // each part's label at its top left (below the flyby's film bar, for the top row)
      const bar = 0.105 * buf.y;
      g.font = `600 ${Math.round(26 * u)}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
      g.textBaseline = 'middle';
      regions.forEach((p, i) => {
        const text = this.states[i]?.label ?? '';
        const x = p.x * sx + 22 * u;
        const y = (p.y === 0 ? bar : p.y * sy) + 34 * u;
        const tw = g.measureText(text).width;
        g.fillStyle = 'rgba(12,13,16,0.55)';
        const ph = 44 * u;
        const pw = tw + 30 * u;
        g.beginPath();
        g.roundRect(x - 15 * u, y - ph / 2, pw, ph, ph / 2);
        g.fill();
        g.fillStyle = 'rgba(250,246,236,0.96)';
        g.fillText(text, x, y + 1 * u);
      });
      this.oTexture.needsUpdate = true;
    }
    r.setRenderTarget(null);
    r.setViewport(0, 0, W, H);
    const auto = r.autoClear;
    r.autoClear = false;
    r.render(this.oScene, this.oCam);
    r.autoClear = auto;
  }
}
