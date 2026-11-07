import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Walker, buildCollider, moveSphere, firstHit, meshAtFace } from './walk.js';
import { Doors } from './doors.js';
import { setupWater } from './water.js';
import { placeIvy } from './ivy.js';
import { TimeOfDay } from './sky.js';
import { Lamps } from './lamps.js';
import { Landscape, makeTerrain, makeHillHeight } from './landscape.js';
import { installGrade } from './look.js';
import { Quality, LOOKS } from './quality.js';
import { tuneMaterials, GRASS_TINT, grassShader, TINTS, buildSkyMap } from './materials.js';
import { Tour, FLYBYS, SCENES, checkPath } from './tour.js';
import { Soundscape } from './sound.js';
import { seasonAt, seasonUniforms, dateLabel, Snowfall } from './season.js';
import { weatherAt, WEATHERS, Rainfall } from './weather.js';
import { LiveWeather } from './liveweather.js';
import { Snowman } from './snowman.js';
import { FallenLeaves } from './leaves.js';
import { Festive } from './festive.js';
import { Spooky } from './spooky.js';
import { Bonfire } from './bonfire.js';
import { Storm } from './storm.js';
import { Rainbow } from './rainbow.js';
import { Footprints } from './footprints.js';
import { Park } from './park.js';
import { Aurora, auroraAt, nextAuroraNight } from './aurora.js';
import { makeVideo, FORMATS, videoSupported } from './video.js';
import { setupPool, poolUniforms } from './pool.js';
import { installErrorLog, setupReport } from './report.js';

installErrorLog();

const $ = (id) => document.getElementById(id);
const canvas = $('view');

// Renderer and scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
installGrade(renderer);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.08, 4000);
const quality = new Quality(renderer, scene, camera);
// (the sun for the sunbeams is set once the sky exists, below)
quality.onResize = () => resizeWater();

// Sky, sun, moon and the time of day
const tod = new TimeOfDay(renderer, scene);
quality.beams.light = tod.light;
let modelCentre = new THREE.Vector3();
let modelRadius = 100;
let lamps = null;
let playing = false;

function updateSun() {
  tod.hours = Number($('time').value);
  tod.compass = THREE.MathUtils.degToRad(Number($('sun-azim').value));
  refreshWeather();
  tod.update(true);
  $('time-label').textContent = tod.label();
}

// The season: the sun's path for the day, and the trees, grass, snow and wildlife
let season = seasonAt(145);
let seasonDay = 145; // fractional while the year runs (the slider snaps to whole days)
let camSpeed = 0; // how fast the camera moves (m/s), for the rush of air
let weatherTicker = 0;
const lastCam = new THREE.Vector3();
let playingYear = false;
const snowfall = new Snowfall(scene);
function updateSeason(force = true) {
  const day = seasonDay;
  tod.day = day;
  season = seasonAt(day);
  seasonUniforms.uDay.value = day;
  seasonUniforms.uGrassTint.value.setRGB(...season.grass);
  seasonUniforms.uIce.value = season.ice;
  snowman?.update(day);
  $('season-label').textContent = dateLabel(day);
  $('season-label').title = season.name;
  refreshWeather();
  tod.update(force);
  $('time-label').textContent = tod.label();
}

// The weather: the real weather now (while the clock is live), or worked out for the date
// and hour, or chosen in the panel; a flyby can also switch it (forcedWeather)
let weather = weatherAt(145, 15, 0);
let wet = 0; // the ground stays wet for a while after the rain stops
let wind = 0.2; // eased towards the weather's wind, for the trees and the sound
const rainfall = new Rainfall(scene);
const rainbow = new Rainbow(scene); // when the sun comes out after a shower
const footprints = new Footprints(scene); // yours, in the snow
const aurora = new Aurora(scene); // the northern lights, a few clear winter nights
let storm = null; // thunder and lightning (storm.js), made once the festivals' sounds are wired up
let snowman = null;
let leaves = null; // fallen leaves under the trees in autumn (leaves.js)
let festive = null; // pumpkins at Halloween, lights at Christmas (festive.js)
let spooky = null; // Halloween night's figures and ghosts (spooky.js)
let bonfire = null; // Bonfire Night (bonfire.js)
let park = null; // deer at dawn, bats at summer dusk (park.js)
let pathProblems = null; // what the check of the camera paths found (for the console)
let forcedWeather = null;
const live = new LiveWeather(() => {
  refreshWeather();
  tod.update(true);
});
function refreshWeather() {
  const choice = forcedWeather ?? ($('weather').value || 'live');
  // the real weather is today's: now, or at the hour on the clock (noon when you arrive); on any
  // other date it is the season's
  const today = Math.floor(seasonDay) === dayOfYear(new Date());
  const real = choice === 'live' && today && live.now ? live.at(liveClock ? null : tod.hours) : null;
  const snowLies = choice === 'snow' ? 1 : real ? live.snowLies(real) : season.snow;
  weather = weatherAt(seasonDay, tod.hours, snowLies, choice, real);
  seasonUniforms.uSnow.value = snowLies;
  // with snow lying, the fountain and the pond are frozen and the jet is off (and with the
  // real weather, after a hard frost)
  const frost = real ? live.ice(real) : season.ice;
  seasonUniforms.uIce.value = Math.max(frost, THREE.MathUtils.smoothstep(snowLies, 0.5, 0.85));
  snowman?.setSnow(snowLies);
  leaves?.update();
  tod.weather = weather;
  tod.windy = weather.wind;
  const lights = auroraAt(seasonDay, tod.hours) && weather.clouds < 0.35 && weather.fog < 0.2 ? ', northern lights' : '';
  $('weather-label').textContent = (real && live.temperature(real) ? `${weather.label}, ${live.temperature(real)}` : weather.label) + lights;
  const src = $('weather-source');
  if (forcedWeather) src.textContent = '';
  else if (choice !== 'live') src.textContent = '';
  else if (real) src.innerHTML = `${liveClock ? 'Live in Surrey' : `Surrey today at ${tod.label()}`}, from <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>`;
  else if (!today) src.textContent = 'The season\'s: another day (Now brings back today\'s)';
  else src.textContent = live.failed ? 'The season\'s (the live weather did not load)' : 'Asking for the live weather…';
}

const LOOK = { exposure: 0.66 };
const BEAMS = { strength: 0.42 }; // dust in the air indoors: how strongly it scatters sunlight
const ADAPT = { indoors: 1.75 }; // how far the eye opens up when you go in by day
let roofed = 1; // 1 under a solid roof, 0 under glass (the pool hall), eased
let roofCheck = 0;
const UP = new THREE.Vector3(0, 1, 0);
function updateExposure(dt = 0) {
  // under glass the light is nearly outdoor light, so the eye opens up much less there
  roofCheck -= dt;
  if (walker && roofCheck <= 0) {
    roofCheck = 0.25;
    const hit = firstHit(walker.bvh, camera.position, UP, 30, passDoor);
    const glass = hit ? /glass/i.test(meshAtFace(walker.bvh.geometry, hit.faceIndex)?.material.name || '') : true;
    roofTarget = glass ? 0 : 1;
  }
  roofed += (roofTarget - roofed) * (1 - Math.exp(-dt * 2));
  // the eye adapts: a little at night, and indoors by day, where the light is far dimmer
  // than outside (so the sunlit patches and the windows are bright, as they look)
  const day = 1 - tod.night;
  renderer.toneMappingExposure =
    LOOK.exposure *
    (Number($('exposure').value) / 100) *
    THREE.MathUtils.lerp(1, 1.7, tod.night) *
    THREE.MathUtils.lerp(1, THREE.MathUtils.lerp(1.12, ADAPT.indoors, roofed), tod.inside * day);
}
let roofTarget = 1;

// Controls
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.screenSpacePanning = true;
orbit.maxPolarAngle = Math.PI * 0.96;

const look = new PointerLockControls(camera, canvas);
look.addEventListener('lock', () => {
  autoLook = false;
  updateLockHint();
});
look.addEventListener('unlock', () => {
  // (freed with Esc: the keys leave the mouse alone now; a click on the picture takes it again)
  autoLook = false;
  updateLockHint();
});
// Walk and Fly look round with the mouse from the start: the browser only hands the mouse over
// after a click or a key, so it is taken at the first move key (or the click on Walk or Fly),
// and until then you can press and drag on the picture to look round
let autoLook = true;
const keys = new Set();
let mode = 'orbit';

let walker = null; // set once the collision tree is ready
let doors = null;
let throughWalls = false; // the panel's "Go through walls"
const passDoor = (t) => doors?.passable(t) ?? false;
const sound = new Soundscape();
const tour = new Tour(
  camera,
  (text) => {
    const el = $('caption');
    el.classList.remove('show');
    if (!text) return;
    el.textContent = text;
    requestAnimationFrame(() => el.classList.add('show'));
  },
  (alpha) => {
    $('fade').style.opacity = String(alpha);
  },
);
let flybyId = null; // which flyby the 'tour' mode is playing, or null for the tour
// where you start, and where Walk mode starts if you switch to it from high up: on the drive
// just inside the gate, between the two oaks, the fountain before you and the front door
// beyond it (the view Tudor picked, 6 November 2026)
const SPAWN = { eye: new THREE.Vector3(4.1, 1.7, 17.2), look: new THREE.Vector3(1.7, 3.8, -2.7) };

function setMode(next) {
  if (next === 'walk' && !walker) {
    $('walk-status').textContent = 'Walking is still getting ready, one moment…';
    pendingWalk = true;
    return;
  }
  const prev = mode;
  mode = next;
  for (const m of ['orbit', 'walk', 'fly']) $(`mode-${m}`).classList.toggle('on', mode === m);
  $('tour').classList.toggle('on', mode === 'tour' && !flybyId);
  $('tour').textContent = mode === 'tour' && !flybyId ? 'Stop the tour' : 'Take the tour';
  document.body.classList.toggle('touring', mode === 'tour');
  document.body.classList.toggle('flyby', mode === 'tour' && !!flybyId);
  $('tour-stop').hidden = mode !== 'tour';
  $('tour-stop').textContent = flybyId ? 'Leave the flyby (Esc)' : 'Stop the tour (Esc)';
  if (mode === 'tour') showLeaveHint(`← → rewind and fast-forward · Esc, a click or W A S D ${flybyId ? 'leaves the flyby' : 'stops the tour'}`);
  for (const m of ['orbit', 'walk', 'fly']) $(`keys-${m}`).hidden = mode !== m;
  placeDock();
  orbit.enabled = mode === 'orbit';
  flight = null;
  if (mode === 'tour') {
    look.unlock();
    tour.start(flybyId);
  } else if (prev === 'tour') {
    tour.stop();
    flybyId = null;
  }
  if (mode === 'orbit') {
    look.unlock();
    camera.up.set(0, 1, 0);
    // put the orbit target a few metres in front of the camera so it carries on from here
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    orbit.target.copy(camera.position).addScaledVector(fwd, 6);
    orbit.update();
  } else {
    camera.up.set(0, 1, 0);
    velocity.set(0, 0, 0);
  }
  if (mode === 'fly' && prev !== 'fly' && camera.position.y < ABOVE.pos.y - 2) flyTo(ABOVE.pos, ABOVE.target, 2.2);
  if ((mode === 'walk' || mode === 'fly') && prev !== mode) autoLook = true;
  if (mode === 'walk' && prev !== 'walk') {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    if (walker.heightAboveFloor(camera.position) > 4) walker.placeAt(SPAWN.eye, SPAWN.look);
    else walker.placeAt(camera.position, camera.position.clone().add(fwd.setY(0)));
  }
  updateLockHint();
}
let pendingWalk = false;
for (const m of ['orbit', 'walk', 'fly']) {
  $(`mode-${m}`).onclick = (e) => {
    wakeSound();
    setMode(m);
    e.currentTarget.blur(); // so Space does not press the button again
    if ((m === 'walk' || m === 'fly') && mode === m && !look.isLocked) lockMouse();
  };
}
// The keys for the mode: under the panel if there is room for them there, else bottom right.
// (On sfatosu.com the site puts a small Credits button in the bottom left corner: both the
// panel and the keys leave room for it.)
function placeDock() {
  const dock = $('dock');
  const panel = $('panel');
  if (panel.hidden) return;
  const credits = document.querySelector('.sfx-game-credits-btn');
  document.body.classList.toggle('has-credits', !!credits);
  dock.classList.add('under-panel');
  const room = innerHeight - panel.getBoundingClientRect().bottom - 12 - 10 - (credits ? 34 : 0);
  dock.classList.toggle('under-panel', dock.offsetHeight <= room);
}
window.addEventListener('resize', placeDock);
$('video-section').addEventListener('toggle', placeDock);
// the keys in the dock work like the real ones while you hold them
for (const b of document.querySelectorAll('#dock [data-key]')) {
  const code = b.dataset.key;
  const up = () => {
    keys.delete(code);
    b.classList.remove('down');
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(code);
    b.classList.add('down');
  });
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
}
// and a held real key lights its button
const lightKey = (code, on) => document.querySelectorAll(`#dock [data-key="${code}"]`).forEach((b) => b.classList.toggle('down', on));
window.addEventListener('keydown', (e) => lightKey(e.code === 'ShiftRight' ? 'ShiftLeft' : e.code, true));
window.addEventListener('keyup', (e) => lightKey(e.code === 'ShiftRight' ? 'ShiftLeft' : e.code, false));
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => {
  if (!autoLook || photo || e.repeat || look.isLocked || !(mode === 'walk' || mode === 'fly') || !MOVE_KEYS.has(e.code)) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  lockMouse();
});
// press and drag on the picture to look round (when the mouse isn't taken)
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 0 && (mode === 'walk' || mode === 'fly') && !look.isLocked) drag = { x: e.clientX, y: e.clientY, moved: false };
});
window.addEventListener('pointermove', (e) => {
  if (!drag || look.isLocked) return;
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
  if (!drag.moved) return;
  const eu = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  eu.y -= e.movementX * 0.003;
  eu.x = THREE.MathUtils.clamp(eu.x - e.movementY * 0.003, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  camera.quaternion.setFromEuler(eu);
});
window.addEventListener('pointerup', () => {
  if (drag?.moved) dragged = performance.now();
  drag = null;
});
let dragged = 0;
// Photo mode: the panel and the keys hidden, a click to focus, a film look and a blur, then save.
// A running flyby holds still while you take it.
let photo = false;
const photoDown = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  photoDown.x = e.clientX;
  photoDown.y = e.clientY;
});
for (const [id, label] of Object.entries(LOOKS)) $('photo-look').add(new Option(label, id));
function setPhoto(on) {
  photo = on;
  quality.photo.on = on;
  document.body.classList.toggle('photo', on);
  $('photo-bar').hidden = !on;
  if (on) {
    look.unlock();
    if (mode === 'tour') tour.rate = 0;
    focusAt(innerWidth / 2, innerHeight / 2, false);
  } else if (mode === 'tour') tour.rate = 1;
  updateLockHint();
}
/** Focus on whatever is under the screen point (x, y): the house or the ground, or a tree's crown. */
function focusAt(x, y, mark) {
  const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const { origin, direction } = raycaster.ray;
  let d = walker ? (firstHit(walker.bvh, origin, direction, 3000, passDoor)?.distance ?? Infinity) : Infinity;
  // the trees: each crown as an upright cylinder
  for (const c of landscape?.crowns ?? []) {
    const ox = origin.x - c.x;
    const oz = origin.z - c.z;
    const a = direction.x * direction.x + direction.z * direction.z;
    const b = 2 * (ox * direction.x + oz * direction.z);
    const k = ox * ox + oz * oz - (c.r * 0.75) ** 2;
    const disc = b * b - 4 * a * k;
    if (a < 1e-6 || disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    const yy = origin.y + direction.y * t;
    if (t > 0 && t < d && yy > c.y0 && yy < c.y1) d = t;
  }
  quality.photo.focus = Number.isFinite(d) ? d : 2000;
  if (mark) {
    const el = $('photo-focus');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
}
$('photo').onclick = (e) => {
  e.currentTarget.blur();
  setPhoto(true);
};
$('photo-close').onclick = () => setPhoto(false);
$('photo-save').onclick = (e) => {
  e.currentTarget.blur();
  // at the full resolution, even if the frame rate had stepped it down (the next frame is drawn
  // that size, and saved)
  quality.set(quality.preset);
  wantPicture = true;
};
$('photo-look').onchange = (e) => {
  quality.photo.look = e.target.value;
  e.target.blur();
};
$('photo-blur').oninput = (e) => {
  quality.photo.aperture = Number(e.target.value) / 100;
};
quality.photo.aperture = Number($('photo-blur').value) / 100;
// (Esc leaves photo mode first, before it would leave a flyby)
window.addEventListener(
  'keydown',
  (e) => {
    if (!photo || e.code !== 'Escape') return;
    e.stopImmediatePropagation();
    setPhoto(false);
  },
  true,
);
function updateLockHint() {
  const free = (mode === 'walk' || mode === 'fly') && !photo;
  $('lock-hint').textContent = autoLook ? 'Click or press W to look around' : 'Click to look around';
  $('lock-hint').hidden = !(free && !look.isLocked);
  $('crosshair').hidden = !(free && look.isLocked);
}
// The tour and the flybys: they remember where you were (and the clock), and put you back
let tourReturn = null;
function startTour(id = null) {
  if (mode !== 'tour') {
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    tourReturn = {
      mode,
      pos: camera.position.clone(),
      look: camera.position.clone().add(fwd),
      clock: { live: liveClock, playing, playingYear, hours: Number($('time').value), day: seasonDay },
    };
  } else setMode('orbit'); // (from one flyby straight to another)
  flybyId = id;
  // (with "With seasons and weathers" ticked, any flyby cuts through the seasons as it flies)
  tour.lapseOver = id && $('flyby-scenes').checked && !FLYBYS[id].lapse?.fixed ? SCENES : null;
  const lapse = id && (tour.lapseOver ?? FLYBYS[id].lapse);
  playingLapse = lapse || null;
  // the seasons cut between their scenes in a new order each time (never the same one twice running)
  sceneOrder = lapse?.what === 'scenes' ? shuffled(lapse.scenes.length) : null;
  // (always opening on heavy snow)
  const first = lapse?.what === 'scenes' ? lapse.scenes.findIndex((sc) => sc.first) : -1;
  if (first >= 0) sceneOrder = [first, ...sceneOrder.filter((i) => i !== first)];
  sceneShown = -1;
  if (lapse) {
    // the flyby runs the clock or the calendar itself
    liveClock = false;
    setPlaying(false);
    setPlayingYear(false);
  }
  tour.rate = 1;
  setMode('tour');
  $('bar-clock').hidden = !lapse;
}
function leaveTour() {
  if (mode !== 'tour') return;
  const r = tourReturn;
  tourReturn = null;
  const lapsedNow = playingLapse;
  playingLapse = null;
  tour.lapseOver = null;
  setShow(0);
  $('bar-clock').hidden = true;
  if (forcedWeather) {
    forcedWeather = null;
    refreshWeather();
    tod.update(true);
  }
  if (r) {
    // the time and the date as they were before a time-lapse flyby
    const lapsed = flybyId && lapsedNow;
    if (lapsed) {
      $('time').value = String(r.clock.hours);
      seasonDay = r.clock.day;
      $('season').value = String(Math.floor(seasonDay));
      updateSeason();
      updateSun();
      liveClock = r.clock.live;
      setPlaying(r.clock.playing);
      setPlayingYear(r.clock.playingYear);
      if (liveClock) goToNow();
    }
    if (r.mode === 'walk' && walker) {
      // back on your feet where you left off
      setMode('orbit');
      camera.position.copy(r.pos);
      camera.lookAt(r.look);
      setMode('walk');
      walker.placeAt(r.pos, r.look);
      return;
    }
    setMode(r.mode === 'tour' ? 'orbit' : r.mode);
  } else setMode('orbit');
}
let playingLapse = null; // the time-lapse the running flyby plays (its own, or the seasons laid over it)
let sceneOrder = null;
let sceneShown = -1;
/** 0..n-1 in a random order. */
function shuffled(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/**
 * A flyby's scenes: with seasons and weathers, a cut to another season, time and weather every few
 * seconds; a holiday flyby holds its one evening (and the New Year's runs the clock through midnight).
 */
function applyLapse(l) {
  if (l.what !== 'scenes') return;
  // a cut to another season, time and weather every few seconds, all at once: the trees, the
  // light, the ground soaked or under snow in an instant
  const k = Math.floor(l.seconds / l.every);
  if (k !== sceneShown) {
    // (past the end of the order, a fresh one that doesn't start with the scene just shown)
    while (k >= sceneOrder.length) {
      const more = shuffled(l.scenes.length);
      if (more[0] === sceneOrder[sceneOrder.length - 1]) more.push(more.shift());
      sceneOrder = sceneOrder.concat(more);
    }
    sceneShown = k;
    const sc = l.scenes[sceneOrder[k]];
    seasonDay = sc.day;
    $('season').value = String(sc.day);
    $('time').value = String(sc.hours);
    tod.hours = sc.hours;
    forcedWeather = sc.weather;
    updateSeason(true);
    wet = sc.wet ?? Math.min(1, weather.rain * 3);
    rainbow.snap = true; // (a cut: a rainbow is there at once, or gone)
    $('time-label').textContent = tod.label();
    $('bar-clock').textContent = `${dateLabel(sc.day)} · ${sc.label ?? WEATHERS[sc.weather]}`;
    // a holiday flyby puts on a show: the bonfire already burning, more fireworks, the lights chasing
    setShow(sc.boost ?? 0);
    if (sc.boost && bonfire) {
      bonfire.reset();
      bonfire.prime({ day: sc.day, hours: sc.hours, level: tod.lamps, wind, camera });
      bonfire.autoYear = !sc.years;
    }
    lapseSeconds = l.seconds;
  }
  const sc = l.scenes[sceneOrder[sceneShown]];
  if (sc.run) runClock(sc, l.seconds);
  // the year written in the sky on cue (as the flyby comes up to where it is written, or flies through it)
  for (const at of sc.years ?? []) if (lapseSeconds < at && l.seconds >= at) bonfire?.writeYear();
  lapseSeconds = l.seconds;
}
let lapseSeconds = 0;
/** A holiday flyby's show (0 for none): more rockets and salvos, the ghosts back sooner, the lights chasing. */
function setShow(boost) {
  if (bonfire) {
    bonfire.boost = Math.max(1, boost);
    if (!boost) bonfire.autoYear = true;
  }
  if (spooky) spooky.boost = Math.max(1, boost);
  if (festive) festive.show = boost ? 1 : 0;
  countdown = '';
}
let countdown = ''; // the last ten seconds of the old year, in the New Year flyby
/** The clock running in real time from the scene's hour, over midnight into the next day. */
function runClock(sc, seconds) {
  let h = sc.hours + Math.max(0, seconds) / 3600;
  let day = sc.day;
  if (h >= 24) {
    h -= 24;
    day = (day + 1) % 365;
  }
  if (day !== Math.floor(seasonDay)) {
    seasonDay = day;
    $('season').value = String(day);
    updateSeason(true);
  }
  tod.hours = h;
  $('time').value = String(h);
  tod.update();
  $('time-label').textContent = tod.label();
  const left = (24 - h) * 3600;
  countdown = day === sc.day && left <= 10 ? String(Math.ceil(left)) : '';
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.floor(((h - hh) * 60 - mm) * 60);
  $('bar-clock').textContent = `${dateLabel(day)} · ${[hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':')}`;
}
$('tour').onclick = (e) => {
  wakeSound();
  const touring = mode === 'tour' && !flybyId;
  if (mode === 'tour') leaveTour();
  if (!touring) startTour(null);
  e.currentTarget.blur();
};
// (the holidays' flybys in a group of their own, after the others)
function addFlybys(select) {
  const holidays = document.createElement('optgroup');
  holidays.label = 'Holidays';
  for (const [id, f] of Object.entries(FLYBYS)) (f.holiday ? holidays : select).appendChild(new Option(f.label, id));
  select.appendChild(holidays);
}
addFlybys($('flyby'));
$('flyby').onchange = (e) => {
  const id = e.target.value;
  e.target.value = '';
  e.target.blur();
  if (id) {
    wakeSound();
    startTour(id);
  }
};
// leaving a tour or a flyby: Esc, a click on the picture, or a move key (you take over);
// ← and → rewind and fast-forward it while you hold them
const LEAVE_KEYS = new Set(['Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown']);
const SCRUB = { ArrowLeft: -4, ArrowRight: 4 };
window.addEventListener('keydown', (e) => {
  if (mode !== 'tour' || exporting || photo) return;
  if (Object.hasOwn(SCRUB, e.code)) {
    e.preventDefault();
    tour.rate = SCRUB[e.code];
  } else if (LEAVE_KEYS.has(e.code)) leaveTour();
});
window.addEventListener('keyup', (e) => {
  if (Object.hasOwn(SCRUB, e.code) && tour.rate === SCRUB[e.code]) tour.rate = 1;
});
let hintTimer = 0;
function showLeaveHint(text) {
  const el = $('leave-hint');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove('show'), 5000);
}
$('tour-stop').onclick = () => leaveTour();
$('sound').addEventListener('change', async (e) => {
  soundChosen = true;
  if (e.target.checked) await sound.enable();
  else sound.disable();
  e.target.blur();
});
// The sound comes on with the first click on a mode, a flyby, the tour, Now, the lights or a
// holiday (browsers only allow sound after a click), unless you have switched it off yourself
let soundChosen = false;
function wakeSound() {
  if (soundChosen || $('sound').checked || exporting) return;
  $('sound').checked = true;
  sound.enable();
}
// (the browser refuses the mouse for a second after Esc has freed it: then just try again)
function lockMouse() {
  try {
    const p = canvas.requestPointerLock?.();
    if (p?.catch) p.catch(() => {});
  } catch {}
}
canvas.addEventListener('click', (e) => {
  // photo mode: a click focuses there (not the end of a drag)
  if (photo) {
    if (performance.now() - dragged >= 300 && Math.hypot(e.clientX - photoDown.x, e.clientY - photoDown.y) < 6) focusAt(e.clientX, e.clientY, true);
    return;
  }
  if (mode === 'tour') return exporting ? null : leaveTour();
  if (performance.now() - dragged < 300) return; // (the end of a drag, not a click)
  if ((mode === 'walk' || mode === 'fly') && !look.isLocked) lockMouse();
});
$('lock-hint').addEventListener('click', lockMouse);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  tour.rate = 1;
});

const velocity = new THREE.Vector3();
const held = (...codes) => codes.some((c) => keys.has(c));

// Nothing goes below the ground, whatever Go through walls says: the estate's lawns,
// drive and ground floors are level, and beyond the walls the fields follow the hills.
const GROUND_CLEARANCE = 0.35;
function groundAt(x, z) {
  return hillHeight ? hillHeight(x, z) + lawn.min.y : 0;
}
/** Lifts a point that is below the ground (plus a clearance) back up; true if it moved. */
function keepAboveGround(p, clearance = GROUND_CLEARANCE) {
  const floor = groundAt(p.x, p.z) + clearance;
  if (p.y >= floor) return false;
  p.y = floor;
  return true;
}
function walkInput() {
  return {
    forward: (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0),
    right: (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0),
    jump: held('Space'),
    run: held('ShiftLeft', 'ShiftRight'),
  };
}
function moveFly(dt) {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const want = new THREE.Vector3();
  if (keys.has('KeyW') || keys.has('ArrowUp')) want.add(fwd);
  if (keys.has('KeyS') || keys.has('ArrowDown')) want.sub(fwd);
  if (keys.has('KeyD') || keys.has('ArrowRight')) want.add(right);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) want.sub(right);
  if (keys.has('Space') || keys.has('KeyE')) want.y += 1;
  if (keys.has('KeyC') || keys.has('KeyQ') || keys.has('ControlLeft')) want.y -= 1;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 12 : 3.5;
  if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed * flySpeedScale());
  velocity.lerp(want, 1 - Math.exp(-dt * 10));
  const next = camera.position.clone().addScaledVector(velocity, dt);
  if (!throughWalls && walker) {
    moveSphere(walker.bvh, camera.position, next, 0.3, passDoor);
    // what is left of the velocity is what you actually moved (sliding along a wall)
    if (dt > 0) velocity.subVectors(next, camera.position).divideScalar(dt);
  }
  if (keepAboveGround(next)) velocity.y = Math.max(0, velocity.y);
  camera.position.copy(next);
}
// higher up, fly faster: walking pace near the ground, a bird's pace over the roofs
function flySpeedScale() {
  const h = walker ? walker.heightAboveFloor(camera.position) : camera.position.y;
  return THREE.MathUtils.clamp(1 + (Math.min(h, 200) - 3) / 10, 1, 8);
}

// Double-click in orbit mode: look at the clicked surface
const raycaster = new THREE.Raycaster();
canvas.addEventListener('dblclick', (e) => {
  if (mode !== 'orbit' || !model) return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(model, true).find((h) => h.object.visible);
  if (hit) flyTo(camera.position.clone().lerp(hit.point, 0.5), hit.point);
});

let flight = null;
function flyTo(pos, target, seconds = 1.2) {
  if (mode === 'walk') {
    if (walker.heightAboveFloor(pos) > 4) walker.placeAt(SPAWN.eye, SPAWN.look);
    else walker.placeAt(pos, target);
    return;
  }
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  flight = {
    t: 0,
    seconds,
    fromPos: camera.position.clone(),
    fromTarget: mode === 'orbit' ? orbit.target.clone() : camera.position.clone().addScaledVector(fwd, 10),
    toPos: pos.clone(),
    toTarget: target.clone(),
    look: new THREE.Vector3(),
  };
  velocity.set(0, 0, 0);
}
/** A viewpoint jump (it may pass through walls on purpose). Returns true while flying. */
function stepFlight(dt) {
  if (!flight) return false;
  flight.t = Math.min(1, flight.t + dt / flight.seconds);
  const k = flight.t * flight.t * (3 - 2 * flight.t);
  camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
  keepAboveGround(camera.position); // over a hill, a straight line between two places can dip under it
  flight.look.lerpVectors(flight.fromTarget, flight.toTarget, k);
  if (mode === 'orbit') orbit.target.copy(flight.look);
  else camera.lookAt(flight.look);
  if (flight.t >= 1) flight = null;
  return true;
}
// Fly starts with the view from above: over the gate, looking up the drive at the house
const ABOVE = { pos: new THREE.Vector3(4.5, 26, 70), target: new THREE.Vector3(4, 3, -10) };

// Viewpoints: [label, camera position, look-at point]. The first is filled in from the model's bounds.
const viewpoints = [['Overview', null, null]];
async function loadViewpoints() {
  try {
    const res = await fetch('/viewpoints.json');
    if (res.ok) for (const v of await res.json()) viewpoints.push([v.name, new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target)]);
  } catch {}
  const sel = $('viewpoint');
  sel.innerHTML = '';
  sel.add(new Option('Go to a place…', ''));
  for (const [i, [name]] of viewpoints.entries()) sel.add(new Option(name, String(i)));
  sel.onchange = () => {
    if (sel.value === '') return;
    const [, pos, target] = viewpoints[Number(sel.value)];
    sel.value = '';
    flyTo(pos, target);
    sel.blur();
  };
}

$('copy-view').onclick = async () => {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  const target = mode === 'orbit' ? orbit.target.clone() : camera.position.clone().addScaledVector(fwd, 6);
  const r = (v) => v.toArray().map((n) => Math.round(n * 100) / 100);
  const text = JSON.stringify({ name: 'New place', pos: r(camera.position), target: r(target) });
  try {
    await navigator.clipboard.writeText(text);
    $('copy-view').textContent = 'Copied';
  } catch {
    $('copy-view').textContent = text;
  }
  setTimeout(() => ($('copy-view').textContent = 'Copy this view'), 2500);
};

// Load the model
let model = null;
let water = null;
let lawn = null;
let hillHeight = null;
let landscape = null;
let modelTris = 0;
const drawSize = new THREE.Vector2();
function resizeWater() {
  if (!water) return;
  renderer.getDrawingBufferSize(drawSize);
  water.setSize(drawSize.x, drawSize.y);
}
const loader = new GLTFLoader();
loader.load(
  '/manor.glb',
  (gltf) => {
    model = gltf.scene;
    console.info(`ivy pieces placed: ${placeIvy(model)}`);
    tuneMaterials(model);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    let tris = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const blended = mats.some((m) => m.transparent);
      o.castShadow = !blended;
      o.receiveShadow = true;
      for (const m of mats) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
          if (m[key]) m[key].anisotropy = aniso;
        }
        if (m.alphaTest > 0) m.shadowSide = THREE.DoubleSide;
      }
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    box.getCenter(modelCentre);
    modelRadius = size.length() / 2;

    tod.setBounds(modelCentre, modelRadius);

    // Fields and hills around the estate (the OBJ stops at its walls)
    let grassMap = null;
    lawn = new THREE.Box3();
    model.traverse((o) => {
      if (o.isMesh && o.material.name === 'cm_grass') {
        if (o.material.map) grassMap = o.material.map;
        lawn.expandByObject(o);
      }
    });
    if (lawn.isEmpty()) lawn.copy(box);
    hillHeight = makeHillHeight(lawn.getCenter(new THREE.Vector3()));
    const ground = makeTerrain({ lawn, centre: lawn.getCenter(new THREE.Vector3()), grassMap, hillHeight });
    ground.material.color.copy(GRASS_TINT);
    grassShader(ground.material);
    scene.add(ground);
    // where the sky reaches, for snow and rain (not on floors under a roof)
    const skyMeshes = [];
    model.traverse((o) => o.isMesh && !/water/i.test(o.material.name || '') && skyMeshes.push(o));
    buildSkyMap(renderer, scene, skyMeshes, lawn.clone().expandByVector(new THREE.Vector3(10, 0, 10)));

    const overviewPos = modelCentre.clone().add(new THREE.Vector3(size.x * 0.75, size.y * 3.5 + 25, size.z * 0.65).multiplyScalar(0.78));
    viewpoints[0][1] = overviewPos;
    viewpoints[0][2] = modelCentre.clone();
    // you start on the drive, looking past the fountain at the house (on foot once walking is ready)
    camera.position.copy(SPAWN.eye);
    camera.lookAt(SPAWN.look);
    orbit.target.copy(SPAWN.look);
    orbit.maxDistance = modelRadius * 5;

    water = setupWater(renderer, scene, model);
    lamps = new Lamps(scene, model);
    quality.beams.box = lamps.houseBox;
    // the pool: caustics, the light off the water, and a light under it for the evening
    const pool = setupPool(model, water);
    if (pool) {
      lamps.fixtures.push({ pos: pool.light.position.clone(), kind: 'pool', power: 7 });
      console.info(`pool light on ${pool.materials} materials`);
    }
    console.info(`light fittings: ${lamps.count}`);
    resizeWater();
    updateSun();
    prepareWalking(ground).catch((err) => {
      // (orbit and fly still work without the collision tree)
      console.error(err);
      $('walk-status').textContent = 'Walking could not be set up here: Orbit and Fly still work.';
      pendingWalk = false;
      doneLoading();
      setMode('orbit');
    });
    modelTris = tris;
    $('stats-base').textContent = `${Math.round(tris).toLocaleString('en-GB')} triangles`;
    setLoading(0.88, 'Getting ready to walk…');
    // you start on your feet on the drive, facing the house: the loading screen stays up
    // until walking is ready, so nothing moves under you
    setMode('walk');
  },
  (e) => {
    const total = e.total || 83_000_000;
    setLoading(0.85 * Math.min(1, e.loaded / total), `The manor: ${(e.loaded / 1e6).toFixed(0)} of ${(total / 1e6).toFixed(0)} MB`);
  },
  (err) => {
    console.error(err);
    $('loading-text').textContent = 'The model did not load. Run npm run build:model first, then reload.';
  },
);

/** The glass and leading of the windows inside a box, by triangle (a flyby may pass through them). */
function windowPanes(geo, box) {
  const out = new Set();
  // (the collision tree reorders the triangles, not the vertices: find a triangle's mesh by its first vertex)
  const ranges = (geo.userData.parts ?? []).filter((p) => /glass|window_grid/i.test(p.mesh.material.name || '')).map((p) => [p.start, p.start + p.count]);
  const pos = geo.attributes.position;
  const index = geo.index;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let t = 0; t < index.count / 3; t++) {
    const first = index.getX(t * 3);
    if (!ranges.some(([a, b]) => first >= a && first < b)) continue;
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, index.getX(t * 3 + k)));
    if (box.containsPoint(c.divideScalar(3))) out.add(t);
  }
  return out;
}

/** The loading bar (0..1) and the line under it. */
function setLoading(f, text) {
  $('loading-bar').style.clipPath = `inset(0 ${(100 - f * 100).toFixed(1)}% 0 0)`;
  $('loading-text').textContent = text;
}
function doneLoading() {
  setLoading(1, 'Ready');
  $('loading').classList.add('done');
  $('panel').hidden = false;
  placeDock();
}

// Walking: everything solid in the estate plus the fields, but not the ivy or the water.
// Doors are in it too: the usable ones let you through once they have swung open.
async function prepareWalking(ground) {
  const t0 = performance.now();
  $('walk-status').textContent = 'Getting walking ready…';
  const ivy = model.getObjectByName('Ivy');
  const solid = [ground];
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p === ivy) return;
    const name = o.material.name || '';
    if (/water/i.test(name)) return;
    if (o.material.transparent && !/glass/i.test(name)) return;
    solid.push(o);
  });
  setLoading(0.92, 'Getting ready to walk…');
  const geo = await buildCollider(solid);
  walker = new Walker(camera, geo);
  doors = new Doors(scene, model, geo);
  walker.skipTriangle = passDoor;
  walker.ghost = throughWalls;
  doors.onSound = (opening, d) => {
    if (exporting) videoDoorEvents.push({ opening, at: d.centre.clone() });
    else sound.door(opening, d.centre);
  };
  console.info(`doors: ${doors.summary}`);

  lamps?.addOutdoor(geo.boundsTree);
  console.info(`lights: ${lamps?.lightCount} point lights for ${lamps?.count} fittings`);
  landscape = new Landscape({ scene, renderer, model, lawn, bvh: geo.boundsTree, hillHeight });
  setLoading(0.95, 'Planting the trees…');
  landscape.build().then(async (st) => {
    walker.obstacles = landscape.obstacles;
    // the snowman: on the front lawn, west of the fountain, looking towards the gate
    const spot = [
      [-5.5, 5.5],
      [-6.5, 7],
      [-4.5, 8],
      [11, 5],
    ].find(([x, z]) => landscape._grassAt(x, z));
    if (spot) {
      snowman = new Snowman(scene, new THREE.Vector3(spot[0], lawn.min.y, spot[1]), 0.5);
      landscape.obstacles.push(snowman.obstacle);
      snowman.update(seasonDay);
      snowman.setSnow(seasonUniforms.uSnow.value);
    }
    leaves = new FallenLeaves(scene, landscape.treeSpots, (x, z) => landscape.groundHeight(x, z));
    // Halloween's pumpkins by the front door, Christmas lights on the house, the gate and the two oaks inside it
    const front = doors.usable.find((d) => d.centre.z > -12 && d.centre.z < -8 && Math.abs(d.centre.x + 1.85) < 1.5);
    const oaks = landscape.gate ? landscape.treeSpots.filter((t) => Math.abs(t.z - (landscape.gate.z - 6.5)) < 1 && Math.abs(Math.abs(t.x - landscape.gate.x) - 5.4) < 1) : [];
    festive = new Festive(scene, { bvh: geo.boundsTree, door: front, oaks, gate: landscape.gate });
    for (const pk of festive.pumpkins) landscape.obstacles.push({ x: pk.position.x, z: pk.position.z, r: 0.3, when: () => festive.halloween.visible });
    spooky = new Spooky(scene, { bvh: geo.boundsTree, materialAt: (fi) => meshAtFace(geo, fi)?.material.name || '', isLawn: (x, z) => landscape._grassAt(x, z), houseBox: lamps.houseBox, sound: festSound });
    // the bonfire: on open lawn in front of the house, clear of the trees and shrubs
    const fireSpot = [
      [16, 12],
      [17.5, 9],
      [-10, 12],
      [13, 15],
      [-12, 8],
    ].find(([x, z]) => landscape._grassAt(x, z) && landscape.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > Math.max(4, (o.r ?? 0) + 3.5)));
    if (fireSpot) {
      const [x, z] = fireSpot;
      bonfire = new Bonfire(scene, new THREE.Vector3(x, landscape.groundHeight(x, z) ?? 0, z), festSound);
      landscape.obstacles.push({ x, z, r: 1.4, when: () => Bonfire.on(seasonDay) });
    }
    // the fountain's and the pool's reflections leave out the shrubs and the fallen leaves (costly, too small to see there)
    water?.notMirrored.push(...landscape.shrubs, leaves.mesh);
    // everything is in place: off with the loading screen
    doneLoading();
    // the tour and the flybys must not pass through walls or trees (doors that open are fine)
    const frontWindow = new THREE.Box3(new THREE.Vector3(-3.3, 4.3, -9.8), new THREE.Vector3(-0.4, 6.9, -9.0));
    const panes = windowPanes(geo, frontWindow);
    const opens = (t) => doors.triDoor[t] > 0 || panes.has(t);
    const moves = [...tour.tourMoves, ...Object.values(tour.flybyMoves)];
    const problems = await checkPath(moves, geo.boundsTree, opens, { crowns: landscape.crowns, allow: [frontWindow] });
    pathProblems = problems;
    // the wildlife: the deer keep clear of wherever a camera path passes low
    const low = [];
    for (const mv of moves) for (let i = 0; i <= 300; i++) {
      const pt = mv.pos.getPointAt(i / 300);
      if (pt.y < 14) low.push(pt);
    }
    park = new Park(scene, { ground: groundAt, avoid: low });
    park.load().catch((err) => console.warn('the deer did not load:', err.message));
    if (problems.length) console.warn(`camera paths touch walls or trees at ${problems.length} points`, JSON.stringify(problems.slice(0, 12)));
    else console.info('camera paths: clear of walls and trees');
    console.info(`landscape: ${st.trees} trees, ${st.bushes} bushes, ${st.billboards} far trees, ${Math.round(st.triangles / 1000)}k triangles, ${st.ms} ms`);
    $('stats-base').textContent = `${Math.round((modelTris + st.triangles) / 1000).toLocaleString('en-GB')}k triangles`;
  }).catch((err) => {
    console.error(err);
    doneLoading(); // (the house without its trees, rather than no house)
  });
  const surfaceRay = new THREE.Raycaster();
  const surfaces = [];
  model.traverse((o) => o.isMesh && surfaces.push(o));
  // what you are standing on: water (wading in the fountain, the moat or the pool), ice when they
  // are frozen, grass, gravel or stone
  const underFeet = () => {
    const f = walker.feet;
    const pond = water?.surfaces.find((w) => f.x > w.box.min.x - 0.05 && f.x < w.box.max.x + 0.05 && f.z > w.box.min.z - 0.05 && f.z < w.box.max.z + 0.05 && f.y < w.box.max.y + 0.03 && f.y > w.box.max.y - 3);
    if (pond) return pond.outdoor && seasonUniforms.uIce.value > 0.5 ? 'ice' : 'water';
    surfaceRay.set(new THREE.Vector3(f.x, f.y + 0.3, f.z), new THREE.Vector3(0, -1, 0));
    surfaceRay.far = 0.6;
    const hit = surfaceRay.intersectObjects(surfaces, false)[0];
    const name = hit?.object.material.name ?? 'cm_grass';
    return /grass|sand/.test(name) ? 'grass' : /gravel/.test(name) ? 'gravel' : 'stone';
  };
  walker.onFootstep = (speed) => {
    const surface = underFeet();
    if (sound.on) sound.footstep(surface, speed);
    // a footprint, outdoors, where snow lies (not in the water or on the ice)
    if (seasonUniforms.uSnow.value > 0.35 && !lamps?.houseBox.containsPoint(walker.feet) && surface !== 'water' && surface !== 'ice') {
      const fwd = camera.getWorldDirection(new THREE.Vector3());
      footprints.step(walker.feet, Math.atan2(-fwd.x, -fwd.z));
    }
  };
  walker.onJump = () => sound.on && sound.jump(underFeet());
  walker.onLand = (air) => sound.on && sound.land(underFeet(), air);
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.info(`collision tree ready in ${secs} s`);
  $('walk-status').textContent = '';
  if (pendingWalk) {
    pendingWalk = false;
    setMode('walk');
  }
}

// The lights: the room you are in, and the whole house
let roomTicker = 0;
let room = [];
function updateRoomButton() {
  room = lamps && walker && mode !== 'tour' ? lamps.roomGroups(camera, walker.bvh, passDoor) : [];
  const b = $('lights-room');
  b.disabled = !room.length;
  b.classList.toggle('on', room.length > 0 && room.some((i) => lamps.lit(i)));
  b.title = room.length ? `The lights of the room you are in (L): ${room.length} light${room.length > 1 ? 's' : ''}` : 'Go into the house to switch a room\'s lights';
}
function toggleRoom() {
  updateRoomButton();
  if (!room.length) return;
  const anyOn = room.some((i) => lamps.lit(i));
  lamps.setGroups(room, !anyOn);
  roomTicker = 0;
}
$('lights-room').onclick = (e) => {
  wakeSound();
  toggleRoom();
  e.currentTarget.blur();
};
// The house: every light inside goes out (or comes on) at once, the outdoor lights stay; by day
// the clock moves on to the evening first, so you can see it
$('lights-house').onclick = (e) => {
  wakeSound();
  const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on);
  e.currentTarget.blur();
  roomTicker = 0;
  if (!lamps) return;
  if (tod.lamps < 0.6) {
    lamps.setHouse(true); // (lit, so there is something to see go out)
    setTime(21.5);
    clearTimeout(houseTimer);
    houseTimer = setTimeout(() => lamps.setHouse(on), 1600);
  } else lamps.setHouse(on);
};
let houseTimer = 0;
/** Moves the clock (off the real time). */
function setTime(h) {
  setPlaying(false);
  $('time').value = String(h);
  clockMoved();
  updateSun();
}
/** Moves the calendar (off the real date). */
function setDate(day) {
  setPlayingYear(false);
  seasonDay = day;
  $('season').value = String(day);
  clockMoved();
  updateSeason();
}
// The holidays: Halloween night at the front door, and Christmas Eve in the snow from the drive
function goTo(pos, look) {
  if (mode === 'tour') leaveTour();
  if (mode === 'walk' && walker) walker.placeAt(pos, look);
  else flyTo(pos, look, 1.6);
}
// The holidays, from the menu: the date, the time and the weather for each, and a good place to stand
const HOLIDAYS = {
  // pumpkins at the door, figures at the windows, ghosts in the fog
  halloween: { day: 303, hours: 22.5, weather: 'fog', pos: [-1.85, 1.7, -2.4], look: [-1.85, 0.7, -9] },
  // the bonfire in front of you, the house behind it, the fireworks over the roof
  bonfire: { day: 308, hours: 19.75, weather: 'clear', pos: () => [bonfireAt().x - 1.5, 1.7, bonfireAt().z + 6], look: () => [bonfireAt().x - 5, 4.5, bonfireAt().z - 18] },
  // the lights, and snow falling
  christmas: { day: 357, hours: 18.5, weather: 'snow', pos: [4.6, 1.7, 19.2], look: [2.5, 5, -6] },
  // just after midnight: fireworks, and the new year written in the sky
  newyear: { day: 0, hours: 0.02, weather: 'clear', pos: [4.6, 1.7, 19.2], look: [4.5, 16, -20] },
  // the next night with the northern lights: up over the gate, looking north over the house at
  // them (they hang low; on the ground the gate and the house hide most of them)
  aurora: { day: () => nextAuroraNight(dayOfYear(new Date())), hours: 22, weather: 'clear', pos: [4.5, 24, 64], look: [4, 12, -30], orbit: true },
};
const bonfireAt = () => bonfire?.at ?? new THREE.Vector3(16, 0, 12);
// L switches the room's lights (and the on-screen L key)
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyL' || e.repeat || mode === 'tour') return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  toggleRoom();
});
document.querySelector('#dock [data-key="KeyL"]')?.addEventListener('pointerdown', () => toggleRoom());
{
  // each holiday's flyby, from the same menu
  const fly = document.createElement('optgroup');
  fly.label = 'Flybys';
  for (const [id, f] of Object.entries(FLYBYS)) if (f.holiday) fly.appendChild(new Option(f.label, `fly:${id}`));
  $('holiday').appendChild(fly);
}
$('holiday').onchange = (e) => {
  const value = e.target.value;
  const h = Object.hasOwn(HOLIDAYS, value) ? HOLIDAYS[value] : null;
  e.target.value = '';
  e.target.blur();
  const flyby = value.startsWith('fly:') ? value.slice(4) : null;
  if (flyby && Object.hasOwn(FLYBYS, flyby) && FLYBYS[flyby].holiday) {
    wakeSound();
    startTour(flyby);
    return;
  }
  if (!h) return;
  wakeSound();
  setDate(typeof h.day === 'function' ? h.day() : h.day);
  setTime(h.hours);
  $('weather').value = h.weather;
  refreshWeather();
  tod.update(true);
  const v = (x) => new THREE.Vector3(...(typeof x === 'function' ? x() : x));
  if (h.orbit && mode !== 'orbit') {
    if (mode === 'tour') leaveTour();
    setMode('orbit');
  }
  goTo(v(h.pos), v(h.look));
};

// Which version this is: the release number, and whether there are changes since it
let appVersion = 'v' + (import.meta.env.APP_VERSION ?? '');
fetch('/version.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((v) => {
    if (!v) return;
    appVersion = v.describe || `v${v.version}`;
    $('version').textContent = v.exact ? `v${v.version}` : `v${v.version} + changes`;
    $('version').title = v.exact ? `Release v${v.version}, ${v.date}` : `Changes since release v${v.version} (${v.describe})`;
  })
  .catch(() => {});

// Report a bug: what to say about this moment
const report = setupReport(() => {
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const target = mode === 'orbit' ? orbit.target : camera.position.clone().addScaledVector(fwd, 6);
  const r = (v) => `(${v.toArray().map((n) => n.toFixed(2)).join(', ')})`;
  return {
    version: appVersion,
    mode: mode === 'tour' ? (flybyId ? `flyby ${flybyId}` : 'tour') : mode,
    camera: r(camera.position),
    target: r(target),
    date: dateLabel(seasonDay),
    time: tod.label(),
    weather: `${$('weather').value || 'auto'} (${weather.label})`,
    quality: `${quality.preset} at ${quality.ratio.toFixed(2)}x`,
    fps: $('stats-fps').textContent,
  };
}, renderer);

// Panel wiring
$('stats').innerHTML = '<span id="stats-base"></span> · <span id="stats-fps"></span>';
for (const id of ['time', 'sun-azim']) $(id).addEventListener('input', updateSun);
$('time').addEventListener('input', () => {
  setPlaying(false);
  clockMoved();
});
// It opens on today's date and the time now, and keeps time with the real clock until you
// move the time or the season; "Now" goes back to it.
let liveClock = true;
let liveTicker = 0;
function dayOfYear(d) {
  return Math.min(364, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5));
}
function goToNow() {
  const now = new Date();
  liveClock = true;
  setPlaying(false);
  setPlayingYear(false);
  $('time').value = String(now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600);
  seasonDay = dayOfYear(now);
  $('season').value = String(seasonDay);
  updateSeason();
  updateSun();
}
/** Where you arrive: today, at noon (Now then jumps to the time now, and keeps time). */
function goToNoon() {
  goToNow();
  liveClock = false;
  $('time').value = '12';
  updateSun();
}
// (moving the time or the date off "now" turns the real weather into the season's)
function clockMoved() {
  liveClock = false;
  refreshWeather();
}
$('now').onclick = (e) => {
  wakeSound();
  goToNow();
  e.currentTarget.blur();
};
function setPlaying(on) {
  playing = on;
  $('play').textContent = on ? '❚❚' : '▶';
  $('play').title = on ? 'Stop the clock' : 'Run the clock: a day in two minutes';
}
$('play').onclick = (e) => {
  setPlaying(!playing);
  e.currentTarget.blur();
};
for (const [id, label] of Object.entries(WEATHERS)) $('weather').add(new Option(label, id));
$('weather').value = 'live';
$('weather').addEventListener('change', (e) => {
  refreshWeather();
  tod.update(true);
  e.target.blur();
});
$('season').addEventListener('input', () => {
  setPlayingYear(false);
  clockMoved();
  seasonDay = Number($('season').value);
  updateSeason();
});
function setPlayingYear(on) {
  playingYear = on;
  $('play-year').textContent = on ? '❚❚' : '▶';
  $('play-year').title = on ? 'Stop the year' : 'Run the year: a year in a minute';
}
$('play-year').onclick = (e) => {
  setPlayingYear(!playingYear);
  e.currentTarget.blur();
};
$('exposure').addEventListener('input', updateExposure);
$('ivy').addEventListener('change', (e) => {
  const ivy = model?.getObjectByName('Ivy');
  if (ivy) ivy.visible = e.target.checked;
});
$('quality').addEventListener('change', (e) => {
  quality.set(e.target.value);
  e.target.blur();
});
$('walls').addEventListener('change', (e) => {
  throughWalls = e.target.checked;
  if (walker) walker.ghost = throughWalls;
  e.target.blur();
});
$('shadows').addEventListener('change', (e) => {
  tod.light.castShadow = e.target.checked;
});
updateExposure();
loadViewpoints();
quality.set($('quality').value);
goToNoon();
live.start();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  quality.apply();
});

// Loop
const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;
let fpsTime = 0;
let elapsed = 0;
let wantPicture = false;
let countdownShown = '';
$('picture').onclick = (e) => {
  wantPicture = true;
  e.currentTarget.blur();
};
/**
 * One frame: the sky, the weather, the lamps, the camera (whatever mode it is in), the
 * water, then the picture. `exporting` is a video being made: the clock stands still, the
 * live sound is left alone (the video's is rendered separately) and the flyby isn't ended here.
 */
function step(dt, exporting = false) {
  tod.tick(dt);
  if (exporting) {
    // (nothing moves the clock or the year while a video is being made)
  } else if (playing) {
    let h = Number($('time').value) + dt * (24 / 120);
    if (h >= 24) h -= 24;
    $('time').value = String(h);
    tod.hours = h;
    tod.update();
    $('time-label').textContent = tod.label();
  }
  if (liveClock && !playing && !playingYear && !exporting) {
    // the real clock: refresh the sun every few seconds (the date rolls over at midnight)
    liveTicker += dt;
    if (liveTicker > 5) {
      liveTicker = 0;
      const now = new Date();
      $('time').value = String(now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600);
      if (dayOfYear(now) !== Math.floor(seasonDay)) {
        seasonDay = dayOfYear(now);
        $('season').value = String(seasonDay);
        updateSeason(false);
      }
      tod.hours = Number($('time').value);
      tod.update();
      $('time-label').textContent = tod.label();
    }
  }
  if (playingYear && !exporting) {
    seasonDay += dt * (365 / 60);
    if (seasonDay >= 365) seasonDay -= 365;
    $('season').value = String(Math.floor(seasonDay));
    updateSeason(false);
  }
  weatherTicker += dt;
  if (weatherTicker > 0.5) {
    weatherTicker = 0;
    const before = weather.label;
    refreshWeather();
    if (weather.label !== before) tod.update();
  }
  // the wind: the trees and the sound follow the weather's, easing between days and hours
  wind = THREE.MathUtils.clamp(wind + ((weather.wind ?? 0) - wind) * (1 - Math.exp(-Math.max(0, dt) * 0.5)), 0, 1);
  if (landscape) landscape.wind.amp.value = 0.15 + 1.5 * wind;
  // wet ground: soaked quickly in the rain, drying slowly after
  const wantWet = Math.min(1, weather.rain * 3);
  wet += (wantWet - wet) * (1 - Math.exp(-dt * (wantWet > wet ? 0.8 : 0.05)));
  seasonUniforms.uWet.value = wet;
  snowfall.update(dt, camera, weather.snowing * (1 - tod.inside), renderer.getPixelRatio());
  rainfall.update(dt, camera, weather.rain * (1 - tod.inside));
  // a rainbow: the ground still wet, the rain easing off, the sun out and lower than 42°
  const sunDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(tod.sunDir.y, -1, 1)));
  const afterRain = THREE.MathUtils.smoothstep(wet, 0.2, 0.6) * (1 - THREE.MathUtils.smoothstep(weather.rain, 0.25, 0.6));
  const sunOut = THREE.MathUtils.smoothstep(sunDeg, 0.5, 4) * (1 - THREE.MathUtils.smoothstep(weather.overcast, 0.45, 0.85)) * (1 - weather.fog) * (1 - weather.snowing) * (1 - (weather.storm ?? 0));
  rainbow.update(dt, camera, tod.sunDir, afterRain * sunOut * (1 - THREE.MathUtils.smoothstep(sunDeg, 39, 42)) * (1 - tod.inside));
  footprints.update(dt, seasonUniforms.uSnow.value, weather.snowing, THREE.MathUtils.lerp(1, 0.3, tod.night));
  // the northern lights: on their nights, in the dark, while the sky is clear
  const auroraUp = auroraAt(seasonDay, tod.hours) ? 1 : 0;
  aurora.update(dt, camera, auroraUp * THREE.MathUtils.smoothstep(tod.night, 0.6, 0.95) * (1 - THREE.MathUtils.smoothstep(weather.clouds, 0.25, 0.5)) * (1 - weather.fog) * (1 - weather.rain));
  // lightning: its flash lights the sky, the fog and the house (sky.js), its thunder comes late
  tod.flash = storm.update(dt, { storm: weather.storm ?? 0, centre: modelCentre, inside: tod.inside });
  updateExposure(dt);
  if (lamps) {
    lamps.update(camera, tod.lamps, dt, renderer, tod.hours);
    if (festive) {
      festive.update(dt, tod.lamps, seasonDay, tod.hours, true);
      festive.setScale(lamps.glowMat.uniforms.uScale.value);
    }
    spooky?.update(dt, camera, seasonDay, tod.night);
    park?.update(dt, { sunDeg, hours: tod.hours, day: seasonDay, camera, onFoot: mode === 'walk' });
    if (bonfire) {
      bonfire.update(dt, { day: seasonDay, hours: tod.hours, level: tod.lamps, wind, camera, exporting });
      bonfire.setScale(lamps.glowMat.uniforms.uScale.value);
    }
    roomTicker -= dt;
    if (roomTicker <= 0) {
      roomTicker = 0.4;
      updateRoomButton();
    }
    const inside = lamps.houseBox.containsPoint(camera.position) ? 1 : 0;
    tod.inside += (inside - tod.inside) * (1 - Math.exp(-dt * 3));
    tod.applyAmbient();
  }
  if (landscape) landscape.update(dt, tod);
  if (doors) doors.update(camera, dt);
  camSpeed += ((dt > 0 ? camera.position.distanceTo(lastCam) / dt : 0) - camSpeed) * (1 - Math.exp(-dt * 6));
  if (camSpeed > 60) camSpeed = 0; // a jump to a place, not flight
  lastCam.copy(camera.position);
  if (!exporting) sound.update(dt, camera, soundEnv());
  if (mode === 'tour') {
    if (!tour.update(dt) && !exporting) leaveTour();
    else if (tour.lapse) applyLapse(tour.lapse);
  } else if (mode === 'orbit') {
    const before = camera.position.clone();
    const jumping = stepFlight(dt);
    orbit.update();
    // turning and zooming stop at walls (a jump to a place is allowed through)
    if (!jumping && !throughWalls && walker && before.distanceToSquared(camera.position) > 1e-10) {
      moveSphere(walker.bvh, before, camera.position, 0.25, passDoor);
    }
    keepAboveGround(orbit.target, 0);
    keepAboveGround(camera.position);
  } else if (mode === 'walk') {
    if (walker.update(dt, walkInput()) === 'fell') walker.placeAt(SPAWN.eye, SPAWN.look);
  } else if (!stepFlight(dt)) {
    moveFly(dt);
  }
  elapsed += dt;
  // the pool: caustics move, brighter by day (the sun through the glass roof), the pool light by night
  poolUniforms.uPoolTime.value += dt;
  const daylight = THREE.MathUtils.smoothstep(tod.sunDir.y, -0.05, 0.3) * (1 - 0.5 * weather.overcast);
  poolUniforms.uPoolLight.value = Math.max(0.35 + 0.9 * daylight, tod.lamps * 0.75) * (1 - tod.night * (1 - tod.lamps));
  if (water) {
    const indoor = water.surfaces.find((s) => !s.outdoor);
    if (indoor) indoor.uniforms.uGlow.value = tod.lamps * tod.night * 0.8;
    water.update(camera, elapsed);
    if (water.jet) {
      water.jet.material.map.offset.y -= dt * 1.4;
      water.jet.visible = seasonUniforms.uIce.value < 0.5; // the fountain is turned off when it freezes
    }
  }
  quality.fisheye = mode === 'tour' ? tour.fisheye : 0;
  if (countdownShown !== countdown) {
    countdownShown = countdown;
    $('countdown').textContent = countdown;
    $('countdown').classList.toggle('show', !!countdown);
  }
  // sunbeams indoors by day: they fade in as you go inside and with the sun's height
  const sunUp = THREE.MathUtils.smoothstep(tod.sunDir.y, 0.02, 0.2) * (1 - tod.night);
  quality.beams.strength = BEAMS.strength * tod.inside * sunUp * Number($('sunbeams').checked);
  quality.render(dt);
}

/** What the sound needs to know about this moment. */
function soundEnv() {
  return {
    night: tod.night,
    inside: tod.inside,
    dusk: tod.lamps,
    birds: season.birds,
    crickets: season.crickets,
    snow: season.snow,
    windy: wind,
    rain: weather.rain,
    frozen: seasonUniforms.uIce.value,
    speed: camSpeed,
    flyby: mode === 'tour' && !!flybyId,
  };
}

let exporting = false;
let videoDoorEvents = []; // doors that open during a video frame, for its sound
let videoSoundEvents = []; // the festivals' sounds during a video frame: [what, ...its arguments]
// The festivals' sounds (ghosts' moans, the bonfire, rockets and bangs): played as they happen, or,
// while a video is being made, noted down frame by frame for its soundtrack (video.js plays them back)
const festSound = {
  moan: (p) => (exporting ? videoSoundEvents.push(['moan', p.clone()]) : sound.moan(p)),
  rocket: (p, time) => (exporting ? videoSoundEvents.push(['rocket', p.clone(), time]) : sound.rocket(p, time)),
  bang: (p, distance) => (exporting ? videoSoundEvents.push(['bang', p.clone(), distance]) : sound.bang(p, distance)),
  thunder: (p, distance, bolt) => (exporting ? videoSoundEvents.push(['thunder', p.clone(), distance, bolt]) : sound.thunder(p, distance, bolt)),
  setBonfire: (p, level) => {
    if (!exporting) return sound.setBonfire(p, level);
    // (once a frame: only the last one counts)
    videoSoundEvents = videoSoundEvents.filter((e) => e[0] !== 'setBonfire');
    videoSoundEvents.push(['setBonfire', p?.clone() ?? null, level]);
  },
};

storm = new Storm(scene, festSound);

// Making a video of a flyby (video.js): the viewer, as the video maker sees it
const videoApp = {
  flyby: 'estate',
  rate: 1, // 2 for a video at twice the speed
  camera,
  get canvas() {
    return canvas;
  },
  get duration() {
    return tour.flybyMoves[this.flyby].duration / this.rate;
  },
  begin(f) {
    this._saved = { live: liveClock, sound: sound.on };
    exporting = true; // the live loop stands aside
    liveClock = false;
    if (sound.on) sound.disable(); // (the video's sound is made separately)
    quality.setFixedSize(f.w, f.h);
    camera.aspect = f.w / f.h;
    startTour(this.flyby);
    tour.rate = this.rate;
    this._lapsed = !!playingLapse;
    camera.fov = f.fov; // a portrait frame needs a taller lens to see as much
    camera.updateProjectionMatrix();
    videoDoorEvents = [];
    videoSoundEvents = [];
    lastCam.copy(camera.position);
    camSpeed = 0;
    return FLYBYS[this.flyby].label;
  },
  step(dt) {
    step(dt, true);
  },
  inside: () => tod.inside,
  speed: () => camSpeed,
  soundEnv,
  takeDoorEvents() {
    const e = videoDoorEvents;
    videoDoorEvents = [];
    return e;
  },
  takeSoundEvents() {
    const e = videoSoundEvents;
    videoSoundEvents = [];
    return e;
  },
  /** The countdown to midnight in the New Year flyby (10 .. 1), or ''. */
  countdown: () => countdown,
  /** What the top bar says on this frame: the time or the date in a time-lapse flyby. */
  clock() {
    const l = tour.lapse;
    return l ? $('bar-clock').textContent : '';
  },
  end() {
    leaveTour();
    quality.setFixedSize(null);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (!this._lapsed) liveClock = this._saved.live;
    if (this._saved.sound) sound.enable();
    exporting = false;
  },
};
addFlybys($('video-flyby'));
let videoFormat = 'youtube';
for (const b of document.querySelectorAll('#video-format [data-format]')) {
  b.onclick = (e) => {
    videoFormat = b.dataset.format;
    for (const o of document.querySelectorAll('#video-format [data-format]')) {
      o.classList.toggle('on', o === b);
      o.setAttribute('aria-checked', String(o === b));
    }
    e.currentTarget.blur();
  };
}
let videoAbort = null;
$('make-video').onclick = async (e) => {
  e.currentTarget.blur();
  if (!videoSupported()) {
    $('make-video').textContent = 'This browser cannot make videos (try Chrome)';
    return;
  }
  videoApp.flyby = $('video-flyby').value;
  videoApp.rate = $('video-fast').checked ? 2 : 1;
  const formatId = videoFormat;
  videoAbort = new AbortController();
  $('video-panel').hidden = false;
  $('video-status').textContent = 'Getting ready…';
  $('video-bar').style.width = '0%';
  const t0 = performance.now();
  try {
    const blob = await makeVideo(videoApp, formatId, {
      preview: $('video-preview'),
      signal: videoAbort.signal,
      onProgress: (p, text) => {
        $('video-bar').style.width = `${(p * 100).toFixed(1)}%`;
        $('video-status').textContent = text;
      },
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `croft-manor-${videoApp.flyby}-${formatId}${videoApp.rate > 1 ? '-2x' : ''}-${appVersion}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    $('video-status').textContent = `Saved ${a.download} (${(blob.size / 1e6).toFixed(1)} MB, made in ${Math.round((performance.now() - t0) / 1000)} s)`;
    window.manor.lastVideo = { name: a.download, size: blob.size, blob };
  } catch (err) {
    $('video-status').textContent = err.name === 'AbortError' ? 'Stopped.' : `The video failed: ${err.message}`;
    console.error(err);
  }
  $('video-cancel').textContent = 'Close';
  videoAbort = null;
};
$('video-cancel').onclick = () => {
  if (videoAbort) videoAbort.abort();
  else {
    $('video-panel').hidden = true;
    $('video-cancel').textContent = 'Stop';
  }
};
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  if (exporting) return; // the video maker draws the frames itself
  step(dt);
  if (wantPicture) {
    // read the canvas in the same task as the render, before the browser clears it
    wantPicture = false;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const looked = photo && quality.photo.look !== 'natural' ? `-${quality.photo.look}` : '';
      a.download = `croft-manor-${dateLabel(seasonDay).replace(' ', '-')}-${tod.label().replace(':', '')}${looked}-${appVersion}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  }
  frames++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    $('stats-fps').textContent = `${Math.round(frames / fpsTime)} fps at ${quality.ratio.toFixed(2)}× resolution`;
    frames = 0;
    fpsTime = 0;
  }
});

// handy from the console: window.manor.camera.position
window.manor = {
  THREE,
  scene,
  camera,
  renderer,
  orbit,
  keys,
  setMode,
  get model() {
    return model;
  },
  get walker() {
    return walker;
  },
  get water() {
    return water;
  },
  get lamps() {
    return lamps;
  },
  get landscape() {
    return landscape;
  },
  get doors() {
    return doors;
  },
  get throughWalls() {
    return throughWalls;
  },
  tod,
  LOOK,
  ADAPT,
  BEAMS,
  TINTS,
  get season() {
    return season;
  },
  get weather() {
    return weather;
  },
  pool: poolUniforms,
  reportPreview: () => {
    const { title, body } = report.compose();
    return `${title}\n${body}`;
  },
  get snowman() {
    return snowman;
  },
  get leaves() {
    return leaves;
  },
  get spooky() {
    return spooky;
  },
  get bonfire() {
    return bonfire;
  },
  get festive() {
    return festive;
  },
  get storm() {
    return storm;
  },
  rainbow,
  footprints,
  aurora,
  setPhoto,
  focusAt,
  get park() {
    return park;
  },
  get pathProblems() {
    return pathProblems;
  },
  live,
  /** Jump to a day of the year (0 = 1 January). */
  setDay(day) {
    seasonDay = day;
    $('season').value = String(Math.floor(day));
    updateSeason();
  },
  quality,
  tour,
  sound,
  dev: {
    measureTrees: () => import('./dev/measure-trees.js').then((m) => m.measure()),
  },
};
