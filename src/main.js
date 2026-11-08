import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Walker, buildCollider, moveSphere, firstHit, meshAtFace } from './walk.js';
import { Doors } from './doors.js';
import { setupWater } from './water.js';
import { placeIvy } from './ivy.js';
import { TimeOfDay } from './sky.js';
import { Lamps } from './lamps.js';
import { Landscape, makeTerrain, makeHillHeight } from './landscape.js';
import { Garden } from './garden.js';
import { MovingIn } from './movingin.js';
import { Meteors, Murmuration, harvestMoon } from './sights.js';
import { Balloons, GardenParty } from './sights2.js';
import { Fireflies, NightClouds, Comet, Blossom, NightSnow, duskHour } from './sights3.js';
import { dressInterior, hallClock } from './interior.js';
import { installGrade } from './look.js';
import { Quality, LOOKS } from './quality.js';
import { tuneMaterials, GRASS_TINT, grassShader, TINTS, buildSkyMap, weatherShader } from './materials.js';
import { Tour, FLYBYS, SCENES, TOUR_LIGHT, checkPath } from './tour.js';
import { SplitSeasons } from './splitseasons.js';
import { Soundscape, loadSamples, MORE_SOUNDS, LATER_SOUNDS } from './sound.js';
import { seasonAt, seasonUniforms, dateLabel, Snowfall } from './season.js';
import { weatherAt, WEATHERS, Rainfall } from './weather.js';
import { LiveWeather } from './liveweather.js';
import { Snowman } from './snowman.js';
import { FallenLeaves } from './leaves.js';
import { Festive } from './festive.js';
import { Spooky } from './spooky.js';
import { Haunt, findWindows } from './haunt.js';
import { Lure } from './lure.js';
import { Graveyards } from './graves.js';
import { dressFront } from './xmasfront.js';
import { HauntInside } from './hauntin.js';
import { ChristmasInside } from './xmasin.js'; // Christmas inside the house (xmasin.js)
import { Bonfire } from './bonfire.js';
import { Storm } from './storm.js';
import { Santa } from './santa.js';
import { Rainbow } from './rainbow.js';
import { Footprints } from './footprints.js';
import { Park, wanderDay } from './park.js';
import { Aurora, auroraAt, nextAuroraNight } from './aurora.js';
import { VR } from './vr.js';
import { Lanterns } from './lanterns.js';
import { makeVideo, FORMATS, videoSupported } from './video.js';
import { setupPool, poolUniforms } from './pool.js';
import { installErrorLog, setupReport } from './report.js';
import { LoadingBar, nextFrame } from './loading.js';
import { Easter, nextEaster } from './easter.js';
import { nightLights, MyLight } from './nightlights.js';
import { Wildlife, WILD_SOUNDS } from './wildlife.js';
import { LightShow } from './lightshow.js';

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
  // (short in the panel, "30 Sep": the whole date and the season in its tooltip)
  $('season-label').textContent = dateLabel(day).replace(/^(\d+ \w{3})\w*/, '$1');
  $('season-label').title = `${dateLabel(day)}, ${season.name}`;
  refreshWeather();
  tod.update(force);
  $('time-label').textContent = tod.label();
}

// The weather: the real weather now (while the clock is live), or worked out for the date
// and hour, or chosen in the panel; a flyby can also switch it (forcedWeather)
let weather = weatherAt(145, 15, 0);
let wet = 0; // the ground stays wet for a while after the rain stops
let wind = 0.2; // eased towards the weather's wind, for the trees and the sound
let coldness = 0; // 0 a warm day .. 1 a cold one (refreshWeather): smoke from the chimneys
let hauntIn = null; // Halloween night inside: the kitchen, the zombies' party at the red pool, the bedroom, the attic (hauntin.js)
let xmasIn = null; // Christmas inside the house: the trees, the garlands, the dinner (xmasin.js)
let lure = null; // Halloween night outside: the figure who lures you to the graveyard, and the decorations (lure.js)
let haunt = null; // Halloween night: the rooms behind every window, and the candle-bearer (haunt.js)
let clockHands = null; // the great hall's clock keeping the viewer's time (interior.js)
let graves = null; // Halloween night: more graveyards, and the dead climbing out (graves.js)
let xmasFront = null; // more of Christmas at the front of the house (xmasfront.js)
/** The day of the month for a day of the year (the clock's date aperture). */
const dateOfMonth = (() => {
  let last = -1;
  let n = 1;
  return (day) => {
    const d = Math.floor(day);
    if (d !== last) {
      last = d;
      n = new Date(Date.UTC(2026, 0, 1 + d)).getUTCDate();
    }
    return n;
  };
})();
let moving = null; // Moving in (Sights): crates in the hall (movingin.js)
let garden = null; // hedges, shrub borders, long grass, clipped evergreens, chimney smoke (garden.js)
const rainfall = new Rainfall(scene);
const rainbow = new Rainbow(scene); // when the sun comes out after a shower
const footprints = new Footprints(scene); // yours, in the snow
const aurora = new Aurora(scene); // the northern lights, a few clear winter nights
// other visitors as lanterns (lanterns.js): only where the site has the server for it, and off until ticked
const lanterns = new Lanterns(scene);
Lanterns.available().then((ok) => (document.getElementById('visitors-row').hidden = !ok));
lanterns.onCount = (n) => (document.getElementById('visitors-count').textContent = n ? `(${n} out walking)` : '');
let storm = null; // thunder and lightning (storm.js), made once the festivals' sounds are wired up
let snowman = null;
let leaves = null; // fallen leaves under the trees in autumn (leaves.js)
let festive = null; // pumpkins at Halloween, lights at Christmas (festive.js)
let lightShow = null; // the doorbell, and at Christmas the light show it starts (lightshow.js)
let spooky = null; // Halloween evening: the figure at a window, the one in the gateway, the candle, the lights failing (spooky.js)
let frontDoor = null; // (Halloween leaves it ajar)
let easter = null; // daffodils in spring, the eggs and the bells at Easter (easter.js)
// the village church, across the fields to the south-east (its bells ring on Easter morning)
const myLight = new MyLight(scene); // your own light at night: a glow, a torch or a flaming torch (nightlights.js)
let running = false; // Run: walking at a run, Shift to walk
let courseLeds = null; // the LED strips on the assault course's crates (nightlights.js)
let courseLedSwitch = null; // and the light they go on and off with
let courseLedSand = null; // and their light on the sand
let bonfire = null; // Bonfire Night (bonfire.js)
let park = null; // deer at dawn, bats at summer dusk (park.js)
let wildlife = null; // crows, the kite, pigeons, a robin, magpies, rabbits, a fox, a cat, ducks (wildlife.js)
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
  let snowLies = choice === 'snow' ? 1 : real ? live.snowLies(real) : season.snow;
  weather = weatherAt(seasonDay, tod.hours, snowLies, choice, real);
  // hoar frost: a light white over everything open to the sky (as a thin snow would lie), on a
  // frosty morning chosen, or on the season's clear, cold winter mornings until the sun is up a while
  {
    const h = Number($('time').value);
    const t = 10.5 - 6.5 * Math.cos((2 * Math.PI * (seasonDay - 25)) / 365) - 3.5 * Math.cos((2 * Math.PI * (h - 4)) / 24);
    const frosty = weather.frost ? 1 : !real && (weather.clouds ?? 1) < 0.35 && h > 4 && h < 11 ? THREE.MathUtils.smoothstep(2.5 - t, 0, 3) * (1 - THREE.MathUtils.smoothstep(h, 9, 11)) : 0;
    snowLies = Math.max(snowLies, (weather.frost ? 0.5 : 0.32) * frosty);
  }
  seasonUniforms.uSnow.value = snowLies;
  // with snow lying, the fountain and the pond are frozen and the jet is off (and with the
  // real weather, after a hard frost)
  const frost = real ? live.ice(real) : season.ice;
  seasonUniforms.uIce.value = Math.max(frost, THREE.MathUtils.smoothstep(snowLies, 0.5, 0.85));
  snowman?.setSnow(snowLies);
  leaves?.update();
  tod.weather = weather;
  tod.windy = weather.wind;
  // how cold it is (fires lit, smoke from the chimneys): the real temperature, or the season's and
  // the hour's (Surrey: about 4 °C in January, 17 °C in July, coldest before dawn)
  {
    const h = Number($('time').value);
    const t = real?.temperature_2m ?? 10.5 - 6.5 * Math.cos((2 * Math.PI * (seasonDay - 25)) / 365) - 3.5 * Math.cos((2 * Math.PI * (h - 4)) / 24);
    coldness = Math.max(THREE.MathUtils.smoothstep(13 - t, 0, 9), snowLies, weather.snowing ?? 0);
  }
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
const BEAMS = { strength: 0.55 }; // dust in the air indoors: how strongly it scatters sunlight
const ADAPT = { indoors: 1.75 }; // how far the eye opens up when you go in by day
let roofed = 1; // 1 under a solid roof, 0 under glass (the pool hall), eased
let roofCheck = 0;
const UP = new THREE.Vector3(0, 1, 0);
function updateExposure(dt = 0) {
  if (!Number.isFinite(dt)) dt = 0;
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
// Where you start: under the tree by the gate, the porch ahead and the great stone horse that stands
// in the fountain's place in this view on the right, through a longer lens (the picture of the front
// Tudor liked); it eases back to the usual lens as soon as you move, still looking at the house
const SPAWN = { eye: new THREE.Vector3(-2.4, 1.6, 17.2), look: new THREE.Vector3(6, 6.2, -12) };
const OPENING_LENS = 42;

function setMode(next) {
  if (next === 'walk' && !walker) {
    $('walk-status').textContent = 'Walking is still getting ready, one moment…';
    pendingWalk = true;
    return;
  }
  const prev = mode;
  mode = next;
  for (const m of ['orbit', 'walk', 'fly']) $(`mode-${m}`).classList.toggle('on', mode === m && !(m === 'walk' && running));
  $('mode-run').classList.toggle('on', mode === 'walk' && running);
  $('shift-does').textContent = running ? 'walk' : 'run';
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
for (const m of ['orbit', 'walk', 'fly', 'run']) {
  $(`mode-${m}`).onclick = (e) => {
    wakeSound();
    // (Run is walking at a run: Shift walks instead)
    if (m === 'run' || m === 'walk') running = m === 'run';
    const to = m === 'run' ? 'walk' : m;
    setMode(to);
    e.currentTarget.blur(); // so Space does not press the button again
    if ((to === 'walk' || to === 'fly') && mode === to && !look.isLocked) lockMouse();
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
  panel.style.maxHeight = '';
  const room = innerHeight - panel.getBoundingClientRect().bottom - 12 - 10 - (credits ? 34 : 0);
  dock.classList.toggle('under-panel', dock.offsetHeight <= room);
  // on a narrow screen the keys in the corner would sit over the panel: the panel stops above them (and scrolls)
  if (!dock.classList.contains('under-panel') && !dock.hidden) {
    const p = panel.getBoundingClientRect();
    const d = dock.getBoundingClientRect();
    if (d.width && d.left < p.right && d.top < p.bottom) panel.style.maxHeight = `${Math.max(160, d.top - p.top - 10)}px`;
  }
}
window.addEventListener('resize', placeDock);
$('video-section').addEventListener('toggle', placeDock);
$('settings-section').addEventListener('toggle', placeDock);
// The panel folds away to its title (kept for your next visit; folded at first on a small screen)
function foldPanel(folded) {
  $('panel').classList.toggle('folded', folded);
  const b = $('panel-fold');
  b.setAttribute('aria-expanded', String(!folded));
  b.title = folded ? 'Open the panel' : 'Fold the panel away';
  b.setAttribute('aria-label', b.title);
  placeDock();
}
{
  let folded = innerWidth < 600 || innerHeight < 500;
  try {
    const saved = localStorage.getItem('croft-panel');
    if (saved) folded = saved === 'folded';
  } catch {}
  foldPanel(folded);
}
$('panel-fold').onclick = (e) => {
  e.currentTarget.blur();
  const folded = !$('panel').classList.contains('folded');
  try {
    localStorage.setItem('croft-panel', folded ? 'folded' : 'open');
  } catch {}
  foldPanel(folded);
};
// (a click on the title opens a folded panel too)
document.querySelector('#panel .title').addEventListener('click', () => $('panel').classList.contains('folded') && $('panel-fold').click());
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
// VR (vr.js): the button only appears when the browser says there's a headset
const vr = new VR(renderer, camera, {
  hit: (origin, dir, far) => (walker ? firstHit(walker.bvh, origin, dir, far, passDoor) : null),
  slide: (from, to, r) => walker && !throughWalls && moveSphere(walker.bvh, from, to, r, passDoor),
});
vr.check().then((ok) => ($('vr').hidden = !ok));
$('vr').onclick = async (e) => {
  e.currentTarget.blur();
  wakeSound();
  if (photo) setPhoto(false);
  if (mode === 'tour') leaveTour();
  // stand where you are (on the floor under you), or on the drive if you are up in the air
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  let feet;
  if (mode === 'walk' && walker) feet = walker.feet.clone().setY(walker.feet.y - 0.02);
  else {
    const below = walker && firstHit(walker.bvh, camera.position, new THREE.Vector3(0, -1, 0), 3, passDoor);
    feet = below ? below.point.clone() : SPAWN.eye.clone().setY(SPAWN.eye.y - 1.62);
    if (!below) fwd.subVectors(SPAWN.look, SPAWN.eye);
  }
  try {
    await vr.enter(feet, Math.atan2(-fwd.x, -fwd.z));
    document.body.classList.add('in-vr');
  } catch (err) {
    console.warn('VR did not start:', err.message);
  }
};
vr.onEnd = () => {
  document.body.classList.remove('in-vr');
  camera.updateProjectionMatrix();
  quality.apply();
  // back on your feet where you took the headset off
  if (walker) {
    const fwd = camera.getWorldDirection(new THREE.Vector3()).setY(0);
    setMode('walk');
    walker.placeAt(camera.position.clone(), camera.position.clone().add(fwd));
  }
};

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
  setOakScene(false);
  showScene(-1);
  sound.stopMusic();
  endSight();
  $('viewpoint').value = '';
  if (lens) {
    // (a flyby has its own lens)
    lens = null;
    camera.fov = LENS;
    camera.updateProjectionMatrix();
  }
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
  // (with "With seasons and weathers" ticked, any flyby cuts through the seasons as it flies, or
  // through its own, if it has them)
  tour.lapseOver = id && $('flyby-scenes').checked && !FLYBYS[id].lapse?.fixed ? (FLYBYS[id].seasons ?? SCENES) : null;
  const lapse = id && (tour.lapseOver ?? FLYBYS[id].lapse);
  playingLapse = lapse || null;
  // the seasons cut between their scenes in a new order each time (never the same one twice
  // running), or in their own order at their own moments
  sceneOrder = lapse?.what === 'scenes' ? (lapse.script ? lapse.scenes.map((_, i) => i) : shuffled(lapse.scenes.length)) : null;
  // (always opening on heavy snow)
  const first = lapse?.what === 'scenes' ? lapse.scenes.findIndex((sc) => sc.first) : -1;
  if (first >= 0) sceneOrder = [first, ...sceneOrder.filter((i) => i !== first)];
  sceneShown = -1;
  if (lapse || !id) {
    // the flyby runs the clock or the calendar itself
    liveClock = false;
    setPlaying(false);
    setPlayingYear(false);
  }
  // the tour: a clear midsummer afternoon, whatever the time, date and weather were (they come back after)
  if (!id) {
    playingLapse = { what: 'scenes', scenes: [TOUR_LIGHT] };
    applyScene(TOUR_LIGHT);
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
    const lapsed = lapsedNow;
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
  // (a scripted one: the last scene whose moment has come)
  const k = l.script ? Math.max(0, l.scenes.findLastIndex((sc) => sc.at <= l.seconds)) : Math.floor(l.seconds / l.every);
  if (k !== sceneShown) {
    // (past the end of the order, a fresh one that doesn't start with the scene just shown)
    while (k >= sceneOrder.length) {
      const more = shuffled(l.scenes.length);
      if (more[0] === sceneOrder[sceneOrder.length - 1]) more.push(more.shift());
      sceneOrder = sceneOrder.concat(more);
    }
    sceneShown = k;
    const sc = l.scenes[sceneOrder[k]];
    applyScene(sc);
    $('bar-clock').textContent = sc.title ?? `${dateLabel(sc.day)} · ${sc.label ?? WEATHERS[sc.weather]}`;

    // a holiday flyby puts on a show: the bonfire already burning, more fireworks, the lights chasing
    setShow(sc.boost ?? 0);
    // the Halloween flyby: the candle upstairs, one figure at a window ahead, the lights failing
    if (spooky) {
      spooky.flight = !!sc.halloween;
      if (sc.halloween) {
        spooky.reset();
        haunt?.reset();
        lure?.reset();
      }
    }
    // the Santa's sleigh flyby: you ride with him
    santa.ride = !!sc.santa;
    if (sc.santa) Object.assign(santa, { nextBells: 0.3, nextHo: 3.5 });
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
  // lightning on cue, close by (the gate flyby's storm in the hall), by the flyby's own clock (so a video has it too)
  for (const after of sc.strikes ?? []) if (lapseSeconds < (sc.at ?? 0) + after && l.seconds >= (sc.at ?? 0) + after) storm.strike(modelCentre, 160 + Math.random() * 120, true, true);
  lapseSeconds = l.seconds;
}
let lapseSeconds = 0;
/** A cut to a scene: its date, time and weather all at once (the trees, the light, the ground soaked or under snow). */
function applyScene(sc) {
  seasonDay = sc.day;
  $('season').value = String(sc.day);
  $('time').value = String(sc.hours);
  tod.hours = sc.hours;
  forcedWeather = sc.weather;
  updateSeason(true);
  wet = sc.wet ?? Math.min(1, weather.rain * 3);
  rainbow.snap = true; // (a cut: a rainbow is there at once, or gone)
  $('time-label').textContent = tod.label();
}
/** A holiday flyby's show (0 for none): more rockets and salvos, the ghosts back sooner, the lights chasing. */
function setShow(boost) {
  if (!boost && spooky) spooky.flight = false;
  if (!boost) santa.ride = false;
  if (bonfire) {
    bonfire.boost = Math.max(1, boost);
    if (!boost) bonfire.autoYear = true;
  }
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
// Sound: it comes on with the first click on a mode, a flyby, the tour, Now, the lights, a place or
// a scene (browsers only allow sound after a click), unless you have muted it. The volume, and
// whether you muted it, are kept for your next visit.
let soundOn = false;
let soundChosen = false;
try {
  const v = localStorage.getItem('croft-volume');
  if (v !== null && Number.isFinite(Number(v))) $('volume').value = String(Math.min(100, Math.max(0, Number(v))));
  soundChosen = localStorage.getItem('croft-muted') === '1';
} catch {}
sound.setVolume(Number($('volume').value) / 100);
function showSound() {
  const v = Number($('volume').value);
  const b = $('sound');
  const silent = !soundOn || v === 0;
  b.classList.toggle('muted', silent);
  b.classList.toggle('quiet', v < 45);
  b.setAttribute('aria-pressed', String(!soundOn));
  b.title = soundOn ? 'Mute' : 'Sound on';
  b.setAttribute('aria-label', b.title);
  $('volume-label').textContent = `${v}%`;
  b.parentElement.classList.toggle('muted', !soundOn);
}
function setSound(on) {
  soundOn = on;
  showSound();
  if (on) sound.enable();
  else sound.disable();
}
function chooseSound(on) {
  soundChosen = true;
  try {
    localStorage.setItem('croft-muted', on ? '0' : '1');
  } catch {}
  setSound(on);
}
$('sound').onclick = (e) => {
  e.currentTarget.blur();
  // (unmuted at no volume: half way up)
  if (!soundOn && Number($('volume').value) === 0) {
    $('volume').value = '50';
    sound.setVolume(0.5);
  }
  chooseSound(!soundOn);
};
$('volume').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  sound.setVolume(v / 100);
  try {
    localStorage.setItem('croft-volume', String(v));
  } catch {}
  if (!soundOn && v > 0) chooseSound(true); // (turning it up unmutes)
  else showSound();
});
$('volume').addEventListener('change', (e) => e.target.blur());
showSound();
function wakeSound() {
  if (soundChosen || soundOn || exporting) return;
  setSound(true);
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
    run: running !== held('ShiftLeft', 'ShiftRight'),
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
    if (res.ok)
      for (const v of await res.json()) {
        const pos = new THREE.Vector3(...v.pos);
        const target = new THREE.Vector3(...v.target);
        viewpoints.push([v.name, pos, target, v]);
        // a place high up has another just after it, a little higher still (and further back, so
        // it looks at the same thing; at most 30 m further, or the haze takes it)
        if (pos.y >= 12) {
          const far = pos.distanceTo(target);
          const up = target.clone().add(pos.clone().sub(target).multiplyScalar(Math.min(1.45, 1 + 30 / far)));
          viewpoints.push([`${v.name}, a little higher`, up, target.clone(), v]);
        }
      }
  } catch {}
  const sel = $('viewpoint');
  sel.innerHTML = '';
  sel.add(new Option('Choose…', ''));
  // (the places matching TRJTA's renders of the house, each with the day, the hour and the lens of
  // its picture, together under their own heading)
  const pictures = document.createElement('optgroup');
  pictures.label = 'As in TRJTA\'s pictures';
  for (const [i, [name, , , v]] of viewpoints.entries()) (v?.group === 'pictures' ? pictures : sel).appendChild(new Option(name, String(i)));
  if (pictures.children.length) sel.appendChild(pictures);
  sel.onchange = () => {
    if (sel.value === '') return;
    const i = Number(sel.value);
    sel.blur();
    wakeSound();
    goToPlace(i);
  };
  // ‹ and ›: the place before and after the last one you went to, round the list
  const step = (d) => {
    wakeSound();
    const n = viewpoints.length;
    goToPlace((((placeAt < 0 ? (d > 0 ? -1 : 0) : placeAt) + d) % n + n) % n, true);
  };
  $('place-prev').onclick = (e) => {
    e.currentTarget.blur();
    step(-1);
  };
  $('place-next').onclick = (e) => {
    e.currentTarget.blur();
    step(1);
  };
}
let placeAt = -1; // the last place gone to (for ‹ and ›)
function goToPlace(i, named = false) {
  {
    placeAt = i;
    $('viewpoint').value = String(i);
    showScene(-1);
    sound.stopMusic();
    endSight();
    const [name, pos, target, v] = viewpoints[i];
    setOakScene(name === 'Under the oak');
    tod.moonBig = 1;
    if (named) toast(name);
    if (v?.scene) {
      wakeSound();
      setDate(v.scene.day);
      setTime(v.scene.hours);
      $('weather').value = v.scene.weather;
      refreshWeather();
      tod.update(true);
    }
    // (a place in the air is seen in Orbit: on foot you would land on the drive)
    if (mode === 'walk' && walker && walker.heightAboveFloor(pos) > 4) setMode('orbit');
    if (mode === 'tour') leaveTour();
    flyTo(pos, target);
    if (v?.fov) holdLens(v.fov);
    else if (lens) {
      lens = null;
      camera.fov = LENS;
      camera.updateProjectionMatrix();
    }
  }
}

// A place's own lens (a longer one, as in the picture it matches): held until you move, then it
// eases back to the usual one while you keep looking at the same thing.
const LENS = 55;
let lens = null;
function holdLens(fov) {
  camera.fov = fov;
  camera.updateProjectionMatrix();
  lens = { held: true };
}
function releaseLens() {
  if (lens) lens.held = false;
  if (mode !== 'tour') $('viewpoint').value = '';
}
function stepLens(dt) {
  if (!lens || lens.held) return;
  camera.fov += (LENS - camera.fov) * (1 - Math.exp(-dt * 2.2));
  if (Math.abs(camera.fov - LENS) < 0.05) {
    camera.fov = LENS;
    lens = null;
  }
  camera.updateProjectionMatrix();
}
{
  const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyQ', 'KeyE']);
  window.addEventListener('keydown', (e) => moveKeys.has(e.code) && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) && releaseLens());
  for (const ev of ['pointerdown', 'wheel', 'touchstart']) renderer.domElement.addEventListener(ev, releaseLens, { passive: true });
  document.querySelectorAll('#dock [data-key]').forEach((b) => b.addEventListener('pointerdown', releaseLens));
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
// (the intro film stays on its still for anyone who has asked for less motion)
if (matchMedia('(prefers-reduced-motion: reduce)').matches) $('intro')?.pause();
// the loading bar, at the real pace (loading.js); nothing is drawn behind it until everything is in
const loadingBar = new LoadingBar({ cover: $('loading-cover'), text: $('loading-text'), tip: $('loading-tip'), bytes: 55_000_000 });
let ready = false;
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder); // (the house's geometry is meshopt-compressed: a third smaller to download)
loader.load(
  '/manor.glb',
  (gltf) => {
    loadingBar.begin('house', 'Laying out the grounds, the water and the lights');
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
    // you start on your feet on the drive, facing the house: the loading screen stays up
    // until walking is ready, so nothing moves under you
    setMode('walk');
  },
  (e) => {
    loadingBar.downloaded(e.loaded, e.total || 83_000_000);
    if (e.total && e.loaded >= e.total && loadingBar.step === 'download') loadingBar.begin('unpack', `Unpacking the house: ${Math.round(e.total / 1e6)} MB of rooms and textures`);
  },
  (err) => {
    console.error(err);
    loadingBar.fail('The model did not load. Run npm run build:model first, then reload.');
  },
);

/**
 * The view from under the oak (where you start): there, a great rearing horse in stone stands where
 * the fountain is, on a round stepped plinth as wide as the fountain's basin; anywhere else, the
 * fountain. "Horse Statue 01" by Rico Cilliers (Poly Haven, CC0), a porcelain figurine made a
 * monument, in the dolphin's weathered stone.
 */
let statue = null;
let fountainParts = null; // the fountain's meshes, and the brick drum's triangles (hidden in the oak's scene)
let oakScene = false;
function addStatue() {
  const at = new THREE.Vector3(4.59, 0, 8.28); // the fountain's middle
  // the fountain: the dolphin, its jet, the stone rim and the water; the brick drum of the basin is
  // part of the estate's one brick mesh, so its triangles there are left out of that mesh's index
  fountainParts = { meshes: [], bricks: [] };
  // (whatever stands within 4 m of its middle and below 1.5 m, but the lawn and the gravel under it)
  const v = new THREE.Vector3();
  const inDrum = (p) => Math.hypot(p.x - at.x, p.z - at.z) < 4 && p.y < 1.5 && p.y > -0.6;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material.name || '';
    if (/^cm_fishstatue/.test(n)) fountainParts.meshes.push(o);
    else if (!/^cm_(grass|gravel)$/.test(n) && o.geometry.index) {
      const idx = o.geometry.index.array;
      const pos = o.geometry.attributes.position;
      const keep = [];
      let cut = 0;
      for (let t = 0; t < idx.length; t += 3) {
        let inside = true;
        for (let k = 0; k < 3; k++) if (!inDrum(v.fromBufferAttribute(pos, idx[t + k]).applyMatrix4(o.matrixWorld))) inside = false;
        if (inside) cut++;
        else keep.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      if (cut) fountainParts.bricks.push({ mesh: o, all: o.geometry.index, without: new THREE.BufferAttribute(idx.length > 65535 * 3 || pos.count > 65535 ? new Uint32Array(keep) : new Uint16Array(keep), 1) });
    }
  });
  const pond = water?.surfaces.find((w) => w.outdoor && w.box.containsPoint(at.clone().setY(w.box.min.y)));
  if (pond) fountainParts.meshes.push(pond.mesh);
  loader.load('/models/horse-statue.glb', (gltf) => {
    const horse = gltf.scene;
    const box = new THREE.Box3().setFromObject(horse);
    horse.scale.setScalar(3.4 / (box.max.y - box.min.y));
    box.setFromObject(horse);
    const c = box.getCenter(new THREE.Vector3());
    horse.position.set(-c.x, -box.min.y, -c.z);
    const named = (n) => {
      let m = null;
      model.traverse((o) => o.isMesh && o.material.name === n && (m = o.material));
      return m;
    };
    const stone = named('cm_fishstatue')?.clone() ?? new THREE.MeshStandardMaterial({ color: 0x6f6a5c, roughness: 0.85 });
    weatherShader(stone); // (a clone doesn't keep the snow and the rain)
    horse.traverse((o) => {
      if (!o.isMesh) return;
      const normalMap = o.material.normalMap;
      o.material = stone;
      if (normalMap && !stone.normalMap) stone.normalMap = normalMap;
      o.castShadow = o.receiveShadow = true;
    });
    // (a sandstone of its own: the model's stones are atlases, with brick in them)
    const dressed = new THREE.MeshStandardMaterial({ map: sandstone(), color: 0xd2bf9c, roughness: 0.86, envMapIntensity: 0.6 });
    weatherShader(dressed);
    const g = new THREE.Group();
    // a round plinth on one step (sunk a little into the lawn)
    let y = -0.08;
    for (const [r0, r1, h] of [
      [2.3, 2.3, 0.38],
      [1.25, 1.35, 1.35],
      [1.48, 1.48, 0.12],
    ]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 48).translate(0, y + h / 2, 0), dressed);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      y += h;
    }
    // the lawn has a hole where the basin was: grass over it, in the lawn's own material (its shader
    // works in world space, so the patch doesn't show)
    let grass = null;
    model.traverse((o) => o.isMesh && o.material.name === 'cm_grass' && (grass = o.material));
    if (grass) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48).rotateX(-Math.PI / 2), grass);
      patch.position.y = 0.006;
      patch.receiveShadow = true;
      g.add(patch);
    }
    // (rearing towards the gate and the drive, turned a little to the porch)
    const holder = new THREE.Group();
    holder.add(horse);
    holder.position.y = y;
    holder.rotation.y = -Math.PI / 2 + 0.5;
    g.add(holder);
    // the lawn's height round the basin (the basin's hidden rim still stands in the collision mesh,
    // so it's measured outside it): the lowest of eight points
    let lawn = Infinity;
    for (let k = 0; k < 8; k++) {
      const h = landscape.groundHeight(at.x + 4.7 * Math.cos((k * Math.PI) / 4), at.z + 4.7 * Math.sin((k * Math.PI) / 4));
      if (h != null && h < lawn) lawn = h;
    }
    g.position.set(at.x, Number.isFinite(lawn) ? lawn : 0, at.z);
    g.visible = oakScene;
    scene.add(g);
    statue = g;
  });
}
/** Sandstone blocks, weathered: for the horse's plinth (wrapped round it, so it tiles across). */
function sandstone() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cfc2a6';
  g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.random() * 70;
    g.fillStyle = `rgba(${v + 30},${v + 20},${v},${0.06 + Math.random() * 0.1})`;
    g.fillRect(Math.random() * 512, Math.random() * 128, 2 + Math.random() * 10, 1 + Math.random() * 5);
  }
  // the joints between the blocks
  g.strokeStyle = 'rgba(90,78,60,0.55)';
  g.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** The oak's scene (the horse in the fountain's place) on or off. */
function setOakScene(on) {
  oakScene = on;
  if (statue) statue.visible = on;
  if (fountainParts) {
    for (const m of fountainParts.meshes) m.visible = !on;
    for (const b of fountainParts.bricks) b.mesh.geometry.setIndex(on ? b.without : b.all);
  }
  sound.fountainOff = on ? 1 : 0;
}

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

/** A short line at the top of the screen for a few seconds. */
let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function doneLoading() {
  if (ready) return;
  ready = true;
  if (camera.position.distanceTo(SPAWN.eye) < 0.5) {
    holdLens(OPENING_LENS);
  }
  loadingBar.finish();
  $('loading').classList.add('done');
  // the intro film: stopped once the loading screen has faded, and let go (its decoder and memory)
  setTimeout(() => {
    const v = $('intro');
    if (!v) return;
    v.pause();
    v.removeAttribute('poster');
    for (const s of v.querySelectorAll('source')) s.remove();
    v.load();
  }, 900);
  $('panel').hidden = false;
  placeDock();
}

/**
 * Everything onto the graphics card before the loading screen goes: the shaders compiled (in the
 * background where the browser can), the textures uploaded a few at a time, and a first frame
 * drawn. Otherwise the first seconds after loading stutter while it all happens then.
 */
async function warmUp() {
  loadingBar.begin('shaders', 'Preparing the shaders');
  await nextFrame();
  try {
    await renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('shaders compiled on first use instead:', err.message);
  }
  const all = sceneTextures();
  const left = all.filter((t) => !uploaded.has(t));
  const label = () => `Sending the textures to the graphics card: ${all.length - left.length + sent} of ${all.length}`;
  let sent = 0;
  loadingBar.begin('textures', label());
  // (progress by the pixels sent, which is steady: a 2048 × 2048 texture takes far longer than a small one)
  const size = (t) => (t.image?.width ?? 256) * (t.image?.height ?? 256);
  const total = left.reduce((a, t) => a + size(t), 0) || 1;
  let done = 0;
  await uploadTextures({
    list: left,
    onEach: (t) => {
      sent++;
      done += size(t);
      loadingBar.progress(done / total, label());
    },
  });
  loadingBar.begin('frame', 'Drawing the first view');
  await nextFrame();
  // the first frame in full: the water's reflections, the sunbeams, the ambient occlusion
  step(1 / 60);
}

/** Every texture in the scene. */
function sceneTextures() {
  const set = new Set();
  scene.traverse((o) => {
    for (const m of [o.material ?? []].flat()) for (const v of Object.values(m)) if (v?.isTexture) set.add(v);
  });
  return [...set];
}

/**
 * Textures onto the graphics card a few at a time, letting the page draw in between (each is
 * sent once: later calls skip those already sent). Stops early when `until()` says so.
 */
const uploaded = new WeakSet();
async function uploadTextures({ list = sceneTextures(), until = () => false, onEach = null } = {}) {
  let since = performance.now();
  for (const tex of list) {
    if (until()) return;
    if (uploaded.has(tex)) continue;
    renderer.initTexture(tex);
    uploaded.add(tex);
    onEach?.(tex);
    if (performance.now() - since > 30) {
      await new Promise((r) => setTimeout(r, 0));
      since = performance.now();
    }
  }
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
  loadingBar.begin('walk', 'Mapping the walls and floors, for walking');
  await nextFrame();
  // (the collision tree is built in a worker, leaving the page free: the house's textures go up to
  // the graphics card meanwhile, a few at a time)
  let built = false;
  const building = buildCollider(solid, (p) => loadingBar.progress(p)).finally(() => {
    built = true;
  });
  await uploadTextures({ until: () => built });
  const geo = await building;
  walker = new Walker(camera, geo);
  doors = new Doors(scene, model, geo);
  walker.skipTriangle = passDoor;
  walker.ghost = throughWalls;
  doors.onSound = (opening, d) => {
    if (exporting) videoDoorEvents.push({ opening, at: d.centre.clone() });
    else sound.door(opening, d.centre);
  };
  console.info(`doors: ${doors.summary}`);
  loadingBar.begin('trees', 'Growing the trees');
  await nextFrame();

  lamps?.addOutdoor(geo.boundsTree);
  console.info(`lights: ${lamps?.lightCount} point lights for ${lamps?.count} fittings`);
  landscape = new Landscape({ scene, renderer, model, lawn, bvh: geo.boundsTree, hillHeight });
  landscape.build((p) => loadingBar.progress(p)).then(async (st) => {
    loadingBar.begin('extras', 'Scattering the autumn leaves');
    await nextFrame();
    // (each part named as it starts, the page drawn between them)
    const part = async (f, label) => {
      loadingBar.progress(f, label);
      await nextFrame();
    };
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
    addStatue();
    console.info('interior', dressInterior(scene, model));
    clockHands = hallClock(scene);
    moving = new MovingIn(scene, model, landscape.obstacles);
    await part(0.4, 'Clipping the hedges and planting the borders');
    garden = new Garden(scene, { landscape, bvh: geo.boundsTree, gate: landscape.gate, materialAt: (fi) => meshAtFace(geo, fi)?.material.name || '', doors: doors.usable });
    console.info('garden', garden.build());
    await part(0.5, 'Putting up the lights at the gate and the fountain');
    // lights at the gateway, in the fountain and on the assault course (before the first frame: new lights recompile every shader)
    {
      const pond = water?.surfaces.filter((w) => w.outdoor).sort((a, b) => a.box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(4.6, 0, 5)) - b.box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(4.6, 0, 5)))[0];
      const crateMeshes = [];
      model.traverse((o) => o.isMesh && /assault_box/.test(o.material.name || '') && crateMeshes.push(o));
      const night = nightLights({ bvh: geo.boundsTree, gate: landscape.gate, fountain: pond?.box ?? null, crateMeshes });
      scene.add(night.group);
      lamps.addMore(night.fixtures);
      courseLeds = night.ledMat;
      courseLedSwitch = lamps.fixtureLight(lamps.fixtures.length - night.fixtures.length + night.courseLight);
      courseLedSand = night.bandMat;
      console.info(`night lights: ${night.fixtures.length}; on the assault course ${night.crates} crates, ${night.strips} LED strips, ${night.glows} glows; ${lamps.lightCount} lights in all`);
    }
    await part(0.6, 'Planting the daffodils');
    easter = new Easter(scene, { isLawn: (x, z) => landscape._grassAt(x, z), ground: (x, z) => landscape.groundHeight(x, z), obstacles: landscape.obstacles, gate: landscape.gate, drive: landscape.drive, lawnEdge: lawn.max.z, crowns: landscape.crowns, box: lawn });
    easter.onFound = (n, total) => {
      sound.chime();
      toast(n === total ? `All ${total} Easter eggs found` : `Easter eggs found: ${n} of ${total}`);
    };
    await part(0.7, 'Decorating for the holidays');
    // Halloween's pumpkins by the front door, Christmas lights on the house, the gate and the two oaks inside it
    const front = doors.usable.find((d) => d.centre.z > -12 && d.centre.z < -8 && Math.abs(d.centre.x + 1.85) < 1.5);
    const oaks = landscape.gate ? landscape.treeSpots.filter((t) => Math.abs(t.z - (landscape.gate.z - 6.5)) < 1 && Math.abs(Math.abs(t.x - landscape.gate.x) - 5.4) < 1) : [];
    frontDoor = front ?? null;
    festive = new Festive(scene, { bvh: geo.boundsTree, door: front, oaks, gate: landscape.gate, materialAt: (fi) => meshAtFace(geo, fi)?.material.name || '' });
    for (const pk of festive.pumpkins) landscape.obstacles.push({ x: pk.position.x, z: pk.position.z, r: 0.3, when: () => festive.halloween.visible });
    // The doorbell and the Christmas light show (lightshow.js): a bell push beside the front door,
    // rung with E or a click on it; at Christmas the house plays a carol with its lights in time
    if (front) {
      lightShow = new LightShow(scene, { sound, bvh: geo.boundsTree, door: front, christmas: (d) => Festive.isChristmas(d) });
      // (music never carries on into another scene, a place, a flyby or the tour: the show stops with it)
      sound.onStopMusic?.add(() => lightShow.stop());
      const ringBell = () => {
        wakeSound();
        lightShow.ring({ day: seasonDay, exporting, listener: camera.position });
      };
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyE' || e.repeat || mode === 'tour' || !lightShow.inReach) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
        ringBell();
      });
      canvas.addEventListener('click', (e) => {
        if (mode === 'tour' || photo || performance.now() - dragged < 300) return;
        // (with the mouse held for looking, a click is where the crosshair is)
        const x = look.isLocked ? innerWidth / 2 : e.clientX;
        const y = look.isLocked ? innerHeight / 2 : e.clientY;
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
        if (lightShow.hit(rc.ray, mode === 'orbit' ? 14 : 3.2)) ringBell();
      });
    }
    // (the end of the doorbell's block)
    // (the figure in the gateway is the lure's now: lure.js)
    spooky = new Spooky(scene, { bvh: geo.boundsTree, materialAt: (fi) => meshAtFace(geo, fi)?.material.name || '', houseBox: lamps.houseBox, gate: null, door: front?.centre ?? null, ground: (x, z) => landscape.groundHeight(x, z) });
    hauntIn = new HauntInside(scene, { bvh: geo.boundsTree, houseBox: lamps.houseBox, poolUniforms: water?.surfaces.find((w) => !w.outdoor)?.uniforms ?? null, sound: wildSound, say: (text) => toast(text) });
    // Christmas inside the house (xmasin.js)
    xmasIn = new ChristmasInside(scene, { bvh: geo.boundsTree, materialAt: (fi) => meshAtFace(geo, fi)?.material.name || '', model, houseBox: lamps.houseBox, light: hauntIn?.light ?? null });
    // (end of Christmas inside)
    {
      // (the ground under the figure: looked for from just above the gravel, not from high up, which
      // finds the top of the gate's arch)
      const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
      const lowGround = (x, z) => {
        const h = hillHeight(x, z);
        ray.origin.set(x, h + 2.2, z);
        return geo.boundsTree.raycastFirst(ray, THREE.DoubleSide, 0, 6)?.point.y ?? h;
      };
      lure = new Lure(scene, { gate: landscape.gate, ground: lowGround, bvh: geo.boundsTree, landscape, door: front, sound: wildSound });
      // more graveyards about the estate on Halloween night, and the dead climbing out (graves.js):
      // each on open ground (no tree, wall, hedge, drive or the woods' far trees within r)
      const far = [];
      landscape.group.traverse((o) => {
        if (!o.isInstancedMesh || !o.material.uniforms?.uMap) return;
        const m = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          far.push(new THREE.Vector3().setFromMatrixPosition(m));
        }
      });
      const down = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
      const clear = (x, z, r) => {
        if (landscape.crowns.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r)) return false;
        if (landscape.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r ?? 0) + r)) return false;
        if (far.some((p) => Math.hypot(p.x - x, p.z - z) < r + 3)) return false;
        for (let dx = -r; dx <= r; dx += 2) {
          for (let dz = -r; dz <= r; dz += 2) {
            if (dx * dx + dz * dz > r * r) continue;
            const h = hillHeight(x + dx, z + dz);
            down.origin.set(x + dx, h + 8, z + dz);
            const hit = geo.boundsTree.raycastFirst(down, THREE.DoubleSide, 0, 12);
            if (hit && (hit.point.y - h > 0.35 || /gravel/.test(meshAtFace(geo, hit.faceIndex)?.material.name || ''))) return false;
          }
        }
        return true;
      };
      graves = new Graveyards(scene, { ground: lowGround, clear, sound: wildSound });
      console.info('graveyards', graves.yards.map((y) => `(${y.c.x}, ${y.c.z})`).join(' '));
    }
    // the rooms behind every window on Halloween night, and the one who walks them with a candle
    {
      const bw = spooky.bay?.window;
      haunt = new Haunt(scene, {
        windows: findWindows(geo.boundsTree, (fi) => meshAtFace(geo, fi)?.material.name || ''),
        bvh: geo.boundsTree,
        houseBox: lamps.houseBox,
        sound: wildSound,
        bay: bw ? new THREE.Vector3(bw.cx, (bw.top + bw.bottom) / 2, bw.z) : null,
      });
      console.info('haunting', haunt.stats);
    }
    // Christmas Eve's dressing: the windows' lights and candles, fairy lights in the trees round the
    // lawns (not the gate's oaks, lit already), and the big tree on open lawn east of the fountain
    {
      const oak = (c) => oaks.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 1);
      const crowns = landscape.crowns.filter((c) => !oak(c) && Math.hypot(c.x - 5, c.z - 2) < 45);
      const clear = (x, z) => landscape._grassAt(x, z) && landscape.crowns.every((c) => Math.hypot(c.x - x, c.z - z) - c.r > 2) && landscape.obstacles.every((o) => o.when || Math.hypot(o.x - x, o.z - z) > (o.r ?? 0) + 2.5);
      const spot = [
        [14.5, 6],
        [15, 9],
        [-10, 9],
        [-9, 4],
      ].find(([x, z]) => clear(x, z));
      const treeAt = spot ? new THREE.Vector3(spot[0], landscape.groundHeight(spot[0], spot[1]) ?? 0, spot[1]) : null;
      festive.decorate({ windows: haunt?.rooms.map((r) => r.w) ?? [], crowns, treeAt });
      if (treeAt) landscape.obstacles.push({ x: treeAt.x, z: treeAt.z, r: 1.8, when: () => !!festive.eve?.visible });
      // more of Christmas at the front: the porch's garland, lanterns along the drive, the fountain
      // dressed, wreaths in the windows, presents under the tree, reindeer of lights (xmasfront.js)
      xmasFront = dressFront(festive, {
        bvh: geo.boundsTree,
        door: frontDoor,
        gate: landscape.gate,
        treeAt,
        windows: haunt?.rooms.map((r) => r.w) ?? [],
        ground: (x, z) => landscape.groundHeight(x, z) ?? 0,
        clear: (x, z) => clear(x, z) && (!treeAt || Math.hypot(treeAt.x - x, treeAt.z - z) > 3.5),
      });
      for (const d of xmasFront.deer ?? []) landscape.obstacles.push({ x: d.group.position.x, z: d.group.position.z, r: 0.9, when: () => !!festive.eve?.visible });
    }
    await part(0.9, 'Building the bonfire');
    // the bonfire: on open lawn in front of the house, clear of the trees and shrubs
    // (well clear of the trees' crowns: a big fire under an oak looks wrong)
    const crownGap = (x, z) => Math.min(...landscape.crowns.map((c) => Math.hypot(c.x - x, c.z - z) - c.r));
    const fireSpot = [
      [20, 10],
      [21, 13],
      [17.5, 9],
      [-10, 12],
      [16, 12],
    ].find(([x, z]) => landscape._grassAt(x, z) && crownGap(x, z) > 4 && landscape.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > Math.max(5, (o.r ?? 0) + 4.5)));
    // the garden party: on the east lawn, clear of the trees and the shrubs
    {
      const spot = [
        [16, 3],
        [14, 2],
        [18, 4],
        [-13, -2],
      ].find(([x, z]) => landscape._grassAt(x, z) && crownGap(x, z) > 6 && landscape.obstacles.every((o) => o.when || Math.hypot(o.x - x, o.z - z) - (o.r ?? 0) > 6.5));
      if (spot) party = new GardenParty(scene, { at: new THREE.Vector3(spot[0], 0, spot[1]), ground: (x, z) => landscape.groundHeight(x, z) ?? 0, sound: wildSound, obstacles: landscape.obstacles, isGrass: (x, z) => landscape._grassAt(x, z) });
    }
    // Five more sights (sights3.js): the glow-worms in the long grass and the blossom round the lawns
    fireflies = new Fireflies(scene, { ground: (x, z) => landscape.groundHeight(x, z) });
    blossom = new Blossom(scene, { crowns: landscape.crowns, lawn: landscape.lawn, ground: (x, z) => landscape.groundHeight(x, z) });
    // (end of the five more sights' block)
    if (fireSpot) {
      const [x, z] = fireSpot;
      bonfire = new Bonfire(scene, new THREE.Vector3(x, landscape.groundHeight(x, z) ?? 0, z), festSound, { groundAt });
      landscape.obstacles.push({ x, z, r: 1.6, when: () => Bonfire.on(seasonDay) });
    }
    // the fountain's and the pool's reflections leave out the shrubs and the fallen leaves (costly, too small to see there)
    water?.notMirrored.push(...landscape.shrubs, leaves.mesh);
    // everything is in place: onto the graphics card, then off with the loading screen
    await warmUp();
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
    const fountainBox = (water?.surfaces ?? []).filter((w) => w.outdoor).sort((a, b) => a.box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(4.6, 0, 5)) - b.box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(4.6, 0, 5)))[0]?.box ?? null;
    park = new Park(scene, { ground: groundAt, avoid: low, gate: landscape.gate, fountain: fountainBox, door: frontDoor?.centre ?? null, sound: wildSound });
    wildlife = new Wildlife(scene, {
      ground: groundAt,
      isLawn: (x, z) => landscape._grassAt(x, z),
      bvh: geo.boundsTree,
      houseBox: lamps.houseBox,
      waters: (water?.surfaces ?? []).filter((w) => w.outdoor).map((w) => w.mesh).filter(Boolean),
      sound: wildSound,
    });
    wildlife.load().catch((err) => console.warn('the wildlife did not load:', err.message));
    loadSamples([...WILD_SOUNDS, ...MORE_SOUNDS]).then((n) => console.info(`recorded sounds: ${n} of ${WILD_SOUNDS.length + MORE_SOUNDS.length}`));
    park.load().catch((err) => console.warn('the deer did not load:', err.message));
    santa.load().catch((err) => console.warn('the sleigh did not load:', err.message));
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
$('my-light').onchange = (e) => {
  myLight.set(e.target.value);
  try {
    localStorage.setItem('croft-my-light', myLight.kind);
  } catch {}
  e.target.blur();
};
{
  let saved = null;
  try {
    saved = localStorage.getItem('croft-my-light');
  } catch {}
  if (saved && [...$('my-light').options].some((o) => o.value === saved)) myLight.set(($('my-light').value = saved));
}
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
// the outdoor lights: the same, for the lamps, floodlights and lanterns outside
$('lights-outdoor').onclick = (e) => {
  wakeSound();
  const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on);
  e.currentTarget.blur();
  if (!lamps) return;
  if (tod.lamps < 0.6) {
    lamps.setOutdoor(true);
    setTime(21.5);
    clearTimeout(outdoorTimer);
    outdoorTimer = setTimeout(() => lamps.setOutdoor(on), 1600);
  } else lamps.setOutdoor(on);
};
let outdoorTimer = 0;
// Reset: back to the start (the first view, on foot), today's date and the time now, the real weather
$('reset').onclick = (e) => {
  e.currentTarget.blur();
  wakeSound();
  if (mode === 'tour') leaveTour();
  endSight();
  flight = null;
  moving?.set(false);
  setOakScene(false);
  showScene(-1);
  sound.stopMusic();
  $('viewpoint').value = '';
  $('weather').value = 'live';
  forcedWeather = null;
  goToNow();
  refreshWeather();
  tod.update(true);
  camera.position.copy(SPAWN.eye);
  camera.lookAt(SPAWN.look);
  orbit.target.copy(SPAWN.look);
  if (walker) {
    setMode('walk');
    walker.placeAt(SPAWN.eye, SPAWN.look);
  }
  holdLens(OPENING_LENS);
};
/** Moves the clock (off the real time). */
function setTime(h) {
  setPlaying(false);
  garden?.clearSmoke();
  $('time').value = String(h);
  clockMoved();
  updateSun();
}
/** Moves the calendar (off the real date). */
function setDate(day) {
  setPlayingYear(false);
  garden?.clearSmoke();
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
  // Easter Sunday morning: daffodils along the drive, eggs hidden on the lawns, the church bells ringing
  easter: { day: () => nextEaster(), hours: 10.25, weather: 'clear', pos: [4.6, 1.7, 19.2], look: [3, 0.6, 10] },
  // dusk in a storm and fog: pumpkins by the door left ajar, the house dark (stay by the door a while…)
  halloween: { day: 303, hours: 16.6, weather: 'eerie', pos: [-1.85, 1.7, -7.6], look: [-1.85, 1.3, -12] },
  // the bonfire in front of you, the house behind it, the fireworks over the roof
  bonfire: { day: 308, hours: 19.75, weather: 'clear', pos: () => [bonfireAt().x - 1.5, 1.7, bonfireAt().z + 6], look: () => [bonfireAt().x - 5, 4.5, bonfireAt().z - 18] },
  // the lights, and snow falling
  christmas: { day: 357, hours: 16, weather: 'snow', pos: [4.6, 1.7, 19.2], look: [2.5, 5, -6] },
  // the light show: Christmas Eve at six, on the drive by the fountain, the front ahead, as if
  // someone had rung the bell (lightshow.js)
  lightshow: {
    day: 357,
    hours: 18,
    weather: 'clear',
    pos: [6.5, 1.7, 19.5],
    look: [8, 4.2, -12],
    then: () => {
      releaseLens(); // (the usual lens, wide enough for the house and the big tree)
      lightShow?.ringWhenReady({ listener: new THREE.Vector3(6.5, 1.7, 19.5) });
    },
  },
  // just after midnight, on the drive: the fireworks bursting over the house, and the new year
  // written in the sky above it
  newyear: { day: 0, hours: 0.02, weather: 'clear', pos: [4.6, 1.7, 19.2], look: [4.5, 18, -20] },
  // the next night with the northern lights: up over the gate, looking north over the house at
  // them (they hang low; on the ground the gate and the house hide most of them)
  aurora: { day: () => nextAuroraNight(dayOfYear(new Date())), hours: 22, weather: 'clear', pos: [4.5, 24, 64], look: [4, 12, -30], orbit: true },
  // a May morning, the herd grazing in the low sun, seen from high above the drive; then the hunt:
  // a shot, the deer bolt, the hounds come home to the house (park.js), the camera following them
  deer: { day: () => wanderDay(), hours: 7.0, weather: 'clear', pos: [5, 11, 74], look: [-17, 0.8, 67], orbit: true, then: () => startHunt() },
  // an April evening, the sun out after a shower, looking east, away from it
  rainbow: { day: 118, hours: 18.2, weather: 'clear', wet: 1, pos: [-8, 1.7, 12], look: [50, 9, 10] },
  // the Perseids at their best: the small hours of 13 August, lying back on the lawn looking up to
  // the north-east, a busier sky for a few minutes
  // (from the front lawn, the roofline dark against the north-east sky where they come from)
  perseids: { day: 224, hours: 1.2, weather: 'clear', pos: [-2, 1.5, 15], look: [16, 15, -30], orbit: true, then: () => (meteors.boost = 240) },
  // a starling murmuration over the woods just west of the house, at dusk late in November, seen
  // from the east lawn with the house's front alongside
  murmuration: { day: 328, hours: 16.25, weather: 'clear', pos: [17, 2.2, 9], look: [-30, 14, -14], orbit: true, then: () => (murmuration.always = true) },
  // the harvest moon risen huge and orange over the woods, across the front lawn (this year's: the
  // full moon nearest the autumn equinox)
  harvestmoon: {
    day: () => harvestMoon(new Date().getFullYear()).day,
    hours: () => harvestMoon(new Date().getFullYear()).hours,
    weather: 'clear',
    orbit: true,
    // (from over the woods on the far side: the house's roofline below, the moon just above it)
    // (a spot on the lawns with a clear line to the moon, and the house beside it in the frame)
    pos: () => harvestView().pos,
    look: () => harvestView().look,
    then: () => {
      tod.moonBig = 2.4;
      tod.update(true);
      setTimeout(() => holdLens(38), 0);
    },
  },
  // hot-air balloons drifting low over the estate on a still June morning, from the lawn
  balloons: { day: 172, hours: 6.2, weather: 'clear', pos: [22, 2, 4], look: [-15, 30, -36], orbit: true, then: () => (balloons.always = true) },
  // a summer garden party on the east lawn late on a June evening: the lights strung over the lawn
  // and the marquee glowing, under the luminous midsummer sky that never quite goes dark, with
  // night-shining clouds low in the north over the house (the sun 9° below the horizon)
  party: {
    day: 181,
    hours: () => duskHour(181, 9),
    weather: 'clear',
    orbit: true,
    pos: () => (party ? [party.at.x + 11, 5, party.at.z + 20] : [27, 5, 23]),
    look: () => (party ? [party.at.x - 13, 6.5, party.at.z - 40] : [3, 6.5, -37]),
    then: () => {
      if (party) {
        party.mode = 'evening';
        party.always = true;
      }
      nightClouds.always = true;
    },
  },
  // the same party by day, in full swing on a July afternoon: bunting, parasols, the bar, the cake,
  // picnics, deckchairs, croquet, a string quartet
  partyday: {
    day: 197,
    hours: 15.2,
    weather: 'clear',
    orbit: true,
    pos: () => (party ? [party.at.x + 9, 7.5, party.at.z + 19] : [25, 7.5, 22]),
    look: () => (party ? [party.at.x, 0.5, party.at.z - 1] : [16, 0.5, 2]),
    then: () => {
      if (party) {
        party.mode = 'day';
        party.always = true;
      }
    },
  },
  // a hard frost on a late November morning: the lawns and the hedges white with it, a mist lifting,
  // the low sun coming through
  frost: { day: 330, hours: 8.6, weather: 'frost', pos: [16, 1.6, 12], look: [-4, 2.5, -8] },
  // (the five more sights: sights3.js)
  // glow-worms in the long grass of the meadow behind the house, on a warm June night, low down
  fireflies: { day: 177, hours: 23.4, weather: 'clear', pos: [9, 1.1, -65], look: [7, 2.6, -40], orbit: true, then: () => fireflies && (fireflies.always = true) },
  // night-shining clouds low in the north over the roofs, late on a June night, from the drive
  // (from above the drive outside the gate, level with the roofs, through a longer lens: the
  // roofline against them; on the ground the gate, the trees and the house hide them)
  nlc: { day: 176, hours: 23.0, weather: 'clear', pos: [4.6, 10, 50], look: [3.5, 11.5, -40], orbit: true, then: () => {
    nightClouds.always = true;
    setTimeout(() => holdLens(40), 0);
  } },
  // a comet low in the west-north-west in the deep dusk of late March, from the east lawn
  comet: { day: 83, hours: () => duskHour(83, 10), weather: 'clear', pos: [38, 1.8, 8], look: [-40, 14, -22], orbit: true, then: () => (comet.always = true) },
  // blossom round the lawns on an April morning, the petals coming down
  blossom: { day: 102, hours: 9.8, weather: 'clouds', pos: [6, 1.7, 14], look: [-22, 4.5, -6], then: () => blossom && (blossom.always = true) },
  // snow falling on a still December night, through the floodlights up the front
  snownight: { day: 352, hours: 21.5, weather: 'snownight', pos: [5, 1.7, 3], look: [-1.5, 3.5, -11], then: () => (nightSnow.always = true) },
  // the great hall's clock in a time-lapse: a February day from half past seven, the clock run (a
  // day in two minutes), the hands spinning and the sun's patches crossing the floor and the walls
  timelapse: { day: 50, hours: 7.5, weather: 'clear', pos: [-1.35, 1.35, -18.3], look: [-1.85, 1.05, -19.96], then: () => {
    setPlaying(true);
    playRate = 2; // (a day in a minute: half past seven to six in about 25 seconds)
    playUntil = 18;
  } },
  // Moving in: the hall on the day the crates came (a spring morning, the sun in at the windows)
  moving: { day: 100, hours: 10.5, weather: 'clear', pos: [-1.85, 1.7, -12.9], look: [-1.85, 3.0, -24], then: () => moving?.set(true) },
  // an autumn afternoon, the crows going over to roost
  crows: { day: 300, hours: 15.6, weather: 'clear', pos: [4.6, 3, 3.5], look: [5.5, 32, -40], orbit: true, then: () => wildlife?.crowsNow() },
};
const bonfireAt = () => bonfire?.at ?? new THREE.Vector3(20, 0, 10);

/**
 * Where to stand for the harvest moon: on the lawns, where nothing (no tree's crown, no wall) is
 * between you and the moon for 300 m, and the house is 12 to 30 degrees to one side of it, so both
 * are in the long lens's frame; looking between them, a little nearer the moon.
 */
let harvestPick = null;
function harvestView() {
  const m = tod.moonDir.clone();
  if (harvestPick && harvestPick.dir.distanceTo(m) < 0.01) return harvestPick;
  const house = new THREE.Vector3(6, 7, -21);
  const ray = new THREE.Ray();
  // (a margin below the moon too: drawn big, its disc must clear the roofline)
  const below = m.clone().add(new THREE.Vector3(0, -0.07, 0)).normalize();
  const clear = (from) => {
    for (const d of [m, below]) {
      ray.set(from, d);
      if (walker?.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 300)) return false;
    }
    for (let d = 2; d < 300; d += 2) {
      const p = from.clone().addScaledVector(m, d);
      for (const c of landscape?.crowns ?? []) if (p.y > c.y0 && p.y < c.y1 + 1 && Math.hypot(p.x - c.x, p.z - c.z) < c.r) return false;
      if (p.y > 25) break;
    }
    return true;
  };
  let best = null;
  for (let x = -40; x <= 50; x += 2) {
    for (let z = -50; z <= 18; z += 2) {
      if (!landscape?._grassAt(x, z)) continue;
      const eye = new THREE.Vector3(x, (landscape.groundHeight(x, z) ?? 0) + 1.7, z);
      const toHouse = house.clone().sub(eye);
      const dist = toHouse.length();
      const angle = THREE.MathUtils.radToDeg(toHouse.normalize().angleTo(m));
      if (angle < 8 || angle > 32 || dist < 28) continue;
      if (!clear(eye)) continue;
      // (the house not too far, the angle near 20°)
      const score = Math.abs(angle - 18) + Math.abs(dist - 40) * 0.2;
      if (!best || score < best.score) best = { eye, score, toHouse };
    }
  }
  if (!best) {
    const eye = new THREE.Vector3(4.6, 1.7, 12);
    harvestPick = { dir: m, pos: eye.toArray(), look: eye.clone().addScaledVector(m, 100).toArray() };
    return harvestPick;
  }
  const look = best.eye.clone().addScaledVector(m.clone().multiplyScalar(0.62).addScaledVector(best.toHouse, 0.38).normalize(), 100);
  harvestPick = { dir: m, pos: best.eye.toArray(), look: look.toArray() };
  return harvestPick;
}

// A sight's own camera (Deer at dawn): where it is over time, looking at what is happening, until
// you take over (any drag of the view)
let sight = null;
function startHunt() {
  if (!park) return;
  park.hunt(seasonDay);
  // (east of the field, the low sun behind you lighting the herd; then wide of the trees, after
  // the hounds, to the front of the house)
  const keys = [
    [0, [5, 11, 74]],
    [8, [7, 10.5, 75]],
    [13, [22, 11, 62]],
    [19, [22, 8, 34]],
    [25, [19, 5, 12]],
    [31, [12, 4, 0]],
  ];
  const door = (frontDoor?.centre ?? new THREE.Vector3(-1.85, 0, -11.85)).clone().setY(1);
  sight = {
    t: 0,
    pos: (t) => {
      let i = 0;
      while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
      const [t0, a] = keys[i];
      const [t1, b] = keys[i + 1];
      const k = THREE.MathUtils.smoothstep(t, t0, t1);
      return new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), k);
    },
    look: (t) => (t > 26 && park.hounds.every((h) => h.arrived || !h.route || h.route.length <= 1) ? door : park.huntFocus),
    end: 40,
  };
}
orbit.addEventListener('start', () => {
  sight = null; // (you have taken over)
});
/** Another scene, place or flyby: the sight's camera lets go, and its hunt is called off. */
function endSight() {
  sight = null;
  if (park) park.huntDay = null;
}
function stepSight(dt) {
  if (!sight || mode !== 'orbit' || flight) return;
  sight.t += dt;
  if (sight.t > sight.end) {
    sight = null;
    return;
  }
  camera.position.lerp(sight.pos(sight.t), 1 - Math.exp(-dt * 1.6));
  orbit.target.lerp(sight.look(sight.t), 1 - Math.exp(-dt * 1.8));
}
// L switches the room's lights (and the on-screen L key)
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyL' || e.repeat || mode === 'tour') return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  toggleRoom();
});
document.querySelector('#dock [data-key="KeyL"]')?.addEventListener('pointerdown', () => toggleRoom());
// The scenes, in the menu's order (the holidays' flybys are in the Flybys menu)
const sceneIds = [...$('holiday').options].map((o) => o.value).filter((v) => Object.hasOwn(HOLIDAYS, v));
let sceneAt = -1; // the last scene chosen (for ‹ and ›)
/** The scenes menu shows scene i (or "Choose a scene…" for -1); the arrows go on from the last. */
function showScene(i) {
  if (i >= 0) sceneAt = i;
  $('holiday').value = i >= 0 ? sceneIds[i] : '';
}
$('holiday').onchange = (e) => {
  e.target.blur();
  const i = sceneIds.indexOf(e.target.value);
  if (i >= 0) playScene(i);
};
for (const [id, d] of [
  ['scene-prev', -1],
  ['scene-next', 1],
]) {
  $(id).onclick = (e) => {
    e.currentTarget.blur();
    const n = sceneIds.length;
    playScene((((sceneAt < 0 ? (d > 0 ? -1 : 0) : sceneAt) + d) % n + n) % n, true);
  };
}
function playScene(i, named = false) {
  const h = HOLIDAYS[sceneIds[i]];
  if (named) toast([...$('holiday').options].find((o) => o.value === sceneIds[i]).textContent);
  showScene(i);
  $('viewpoint').value = '';
  sound.stopMusic(); // (the last scene's music doesn't carry on into this one)
  wakeSound();
  moving?.set(false); // (another holiday or sight: the crates go)
  setOakScene(false);
  setDate(typeof h.day === 'function' ? h.day() : h.day);
  setTime(typeof h.hours === 'function' ? h.hours() : h.hours);
  murmuration.always = false;
  balloons.always = false;
  meteors.boost = 0; // (the Perseids' busier sky, not carried into the next night)
  if (party) party.always = false;
  for (const sight of [fireflies, nightClouds, comet, blossom, nightSnow]) if (sight) sight.always = false; // (sights3.js)
  // (a scene's own lens, as the night-shining clouds' or the harvest moon's, is not carried into the next)
  if (lens) {
    lens = null;
    camera.fov = LENS;
    camera.updateProjectionMatrix();
  }
  tod.moonBig = 1;
  $('weather').value = h.weather;
  refreshWeather();
  // (the ground as the scene has it: still wet from a shower, or as its weather makes it, not the last scene's)
  wet = h.wet ?? Math.min(1, weather.rain * 3);
  rainbow.snap = true; // (a new scene: its rainbow there at once, or none, not the last one's fading)
  tod.update(true);
  endSight(); // (the deer's camera, still following the hounds, would pull this scene's view back to them)
  h.then?.();
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
  showScene(-1);
  goToNow();
  e.currentTarget.blur();
};
let playRate = 1; // (the time-lapse runs the clock faster, and stops it at an hour)
let playUntil = null;
function setPlaying(on) {
  playing = on;
  if (!on) {
    playRate = 1;
    playUntil = null;
  }
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
  showScene(-1); // (another day: no longer the scene's)
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
$('exposure').addEventListener('input', () => updateExposure(0)); // (not the event as the time step: that turned the picture black)
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
$('visitors').addEventListener('change', (e) => {
  lanterns.setOn(e.target.checked);
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
    let h = Number($('time').value) + dt * (24 / 120) * playRate;
    if (h >= 24) h -= 24;
    if (playUntil !== null && h >= playUntil) {
      h = playUntil;
      setPlaying(false);
    }
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
  // (and above freezing: no rainbow on a frosty morning or over snow)
  const thawed = (1 - (weather.frost ?? 0)) * (1 - THREE.MathUtils.smoothstep(seasonUniforms.uSnow.value, 0.05, 0.3));
  rainbow.update(dt, camera, tod.sunDir, afterRain * sunOut * thawed * (1 - THREE.MathUtils.smoothstep(sunDeg, 39, 42)) * (1 - tod.inside));
  footprints.update(dt, seasonUniforms.uSnow.value, weather.snowing, THREE.MathUtils.lerp(1, 0.3, tod.night));
  // the northern lights: on their nights, in the dark, while the sky is clear
  const auroraUp = auroraAt(seasonDay, tod.hours) ? 1 : 0;
  aurora.update(dt, camera, auroraUp * THREE.MathUtils.smoothstep(tod.night, 0.6, 0.95) * (1 - THREE.MathUtils.smoothstep(weather.clouds, 0.25, 0.5)) * (1 - weather.fog) * (1 - weather.rain), tod.compass);
  // lightning: its flash lights the sky, the fog and the house (sky.js), its thunder comes late
  tod.flash = storm.update(dt, { storm: weather.storm ?? 0, centre: modelCentre, inside: tod.inside });
  tod.flashKey = storm.key;
  tod.flashDir = storm.keyDir;
  updateExposure(dt);
  if (lamps) {
    lamps.flicker = Spooky.isOn(seasonDay, tod.night) ? 1 : 0; // (Halloween night: the lamps outside falter)
    lamps.update(camera, tod.lamps, dt, renderer, tod.hours);
    if (festive) {
      festive.update(dt, tod.lamps, seasonDay, tod.hours, true);
      xmasFront?.update(dt, seasonDay);
      festive.setScale(lamps.glowMat.uniforms.uScale.value);
    }
    if (spooky) {
      spooky.update(dt, camera, seasonDay, tod.night, tod.flash);
      haunt?.update(dt, { on: Spooky.isOn(seasonDay, tod.night), camera, flash: tod.flash, flight: spooky.flight, candlesOut: spooky.candlesOut });
      hauntIn?.update(dt, { on: Spooky.isOn(seasonDay, tod.night), camera });
      xmasIn?.update(dt, { day: seasonDay, hours: tod.hours, camera, houseOn: lamps.houseOn !== false && !lamps.dark, scale: lamps.glowMat.uniforms.uScale.value }); // Christmas inside the house (xmasin.js)
      lure?.update(dt, { on: Spooky.isOn(seasonDay, tod.night), flight: mode === 'tour', camera, flash: tod.flash, level: tod.lamps, strike: () => storm.strike(modelCentre, 160 + Math.random() * 120, true, true), scale: lamps.glowMat.uniforms.uScale.value });
      // (after the lure: it borrows its graveyard's light when that is dark)
      graves?.update(dt, { on: Spooky.isOn(seasonDay, tod.night), rise: mode !== 'tour', camera, scale: lamps.glowMat.uniforms.uScale.value, light: lure?.graveLight, lightHome: lure?.graveHome, lightFree: !!lure && lure.moment <= 0 });
      // Halloween evening: the house dark, the lights outside failing in the storm, the front door ajar (and stirring in the wind)
      const hallowe = Spooky.isOn(seasonDay, tod.night);
      lamps.dark = hallowe;
      lamps.cut = spooky.cut;
      // (0.27 of the way is about 16°: the swing eases in, so the first part of it is small)
      if (frontDoor) frontDoor.ajar = hallowe ? 0.27 + 0.03 * Math.sin(elapsed * 0.6) * Math.sin(elapsed * 0.23 + 1) * (0.4 + wind) : 0;
      if (spooky.wantStrike) {
        spooky.wantStrike = false;
        storm.strike(modelCentre, 230 + Math.random() * 150, true, true);
      }
    }
    // the doorbell and the Christmas light show: the lights from the music's clock (festive.js reads
    // them next frame), the house's own lights dimmed for it, the hint by the bell
    if (lightShow) {
      lightShow.update(dt, { camera, day: seasonDay, exporting });
      if (festive) festive.sync = lightShow.sync;
      if (lightShow.playing || lightShow.houseCut > 0) {
        lamps.cut = Math.max(lamps.cut, lightShow.houseCut);
        for (const m of lamps.glass) m.emissiveIntensity *= 1 - lightShow.houseCut; // (the lit windows too)
      }
      const hint = lightShow.inReach && mode !== 'tour' && !photo;
      if (hint !== !!lightShow.hintShown) {
        lightShow.hintShown = hint;
        const el = $('leave-hint');
        if (hint) {
          el.textContent = 'E rings the bell';
          el.classList.add('show');
        } else if (el.textContent === 'E rings the bell') el.classList.remove('show');
      }
    }
    // your lantern at hand height while you walk (and in the headset)
    const walking = (mode === 'walk' && walker) || vr.presenting;
    const hand = walking ? (vr.presenting ? camera.position.clone().setY(camera.position.y - 0.65) : walker.feet.clone().setY(walker.feet.y + 0.95)) : null;
    lanterns.update(dt, hand, tod.night, lamps.glowMat.uniforms.uScale.value);
    // your own light: while you walk, once it is getting dark (or under a dark sky indoors)
    myLight.update(dt, camera, mode === 'walk' && !!walker, THREE.MathUtils.smoothstep(tod.night, 0.25, 0.7), lamps?.glowMat.uniforms.uScale.value ?? 800);
    if (courseLeds) {
      const on = (courseLedSwitch?.on ?? 0) * (1 - lamps.cut);
      courseLeds.color.setRGB(0.04 + 1.7 * on, 0.045 + 1.95 * on, 0.05 + 2.2 * on);
      courseLedSand.opacity = on;
    }
    park?.update(dt, { sunDeg, hours: tod.hours, day: seasonDay, camera, onFoot: mode === 'walk' });
    wildlife?.update(dt, { day: seasonDay, hours: tod.hours, sunDeg, camera, feet: mode === 'walk' && walker ? walker.feet : null, weather, inside: tod.inside, frozen: seasonUniforms.uIce.value });
    easter?.update(dt, { day: seasonDay, night: tod.night, snow: seasonUniforms.uSnow.value, wind: weather.wind, feet: mode === 'walk' && walker ? walker.feet : null });
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
  // the sun's shadows: close round you inside, the ground ahead on foot, the estate from above
  tod.fitShadow(camera, { inside: lamps?.houseBox.containsPoint(camera.position) ? 1 : 0, low: camera.position.y < 9, whole: (mode === 'tour' && !lamps?.houseBox.containsPoint(camera.position)) || exporting, house: lamps?.houseBox });
  if (landscape) landscape.update(dt, tod);
  garden?.update(dt, { cold: coldness, wind, night: tod.night, scale: lamps?.glowMat.uniforms.uScale.value });
  clockHands?.update(Number($('time').value), dateOfMonth(seasonDay));
  stepLens(dt);
  if (doors) doors.update(camera, dt);
  camSpeed += ((dt > 0 ? camera.position.distanceTo(lastCam) / dt : 0) - camSpeed) * (1 - Math.exp(-dt * 6));
  if (camSpeed > 60) camSpeed = 0; // a jump to a place, not flight
  lastCam.copy(camera.position);
  if (!exporting) sound.update(dt, camera, soundEnv());
  if (vr.presenting) {
    vr.update(dt); // (the headset moves the camera; the sticks move you)
  } else if (mode === 'tour') {
    if (!tour.update(dt) && !exporting) leaveTour();
    else if (tour.lapse) applyLapse(tour.lapse);
  } else if (mode === 'orbit') {
    const before = camera.position.clone();
    const jumping = stepFlight(dt);
    stepSight(dt);
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
  // (after the camera has moved: riding in the sleigh, it must not lag a frame behind)
  santa.update(dt, { day: seasonDay, night: tod.night, camera, scale: lamps?.glowMat.uniforms.uScale.value ?? 800 });
  meteors.update(dt, { day: seasonDay, night: tod.night, clouds: weather.clouds ?? 0, compass: Number($('sun-azim').value), camera });
  balloons.update(dt, { day: seasonDay, hours: tod.hours, wind, camera });
  party?.update(dt, { day: seasonDay, hours: tod.hours, rain: weather.rain ?? 0, dusk: tod.lamps, camera, scale: lamps?.glowMat.uniforms.uScale.value });
  murmuration.update(dt, { day: seasonDay, sunDeg: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(tod.sunDir.y, -1, 1))), clouds: weather.clouds ?? 0, rain: weather.rain ?? 0, scale: lamps?.glowMat.uniforms.uScale.value });
  // (the five more sights: sights3.js)
  {
    const scale = lamps?.glowMat.uniforms.uScale.value;
    fireflies?.update(dt, { day: seasonDay, hours: tod.hours, night: tod.night, rain: weather.rain ?? 0 });
    nightClouds.update(dt, { day: seasonDay, sunDir: tod.sunDir, clouds: weather.clouds ?? 0, compass: tod.compass });
    comet.update(dt, { sunDir: tod.sunDir, clouds: weather.clouds ?? 0, fog: weather.fog ?? 0, compass: tod.compass });
    blossom?.update(dt, { day: seasonDay, wind, snow: seasonUniforms.uSnow.value, daylight: THREE.MathUtils.smoothstep(tod.sunDir.y, -0.05, 0.25), camera, scale });
    nightSnow.update(dt, { snowing: weather.snowing ?? 0, night: tod.night, inside: tod.inside, camera, lamps, scale });
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
      water.jet.visible = seasonUniforms.uIce.value < 0.5 && !oakScene; // the fountain is turned off when it freezes (and gone in the oak's scene)
    }
  }
  quality.fisheye = mode === 'tour' ? tour.fisheye : 0;
  if (!exporting) sound.setWhine(mode === 'tour' && tour.fpv ? 1 : 0, tour.speed ?? 0); // (the FPV drone's motors)
  if (countdownShown !== countdown) {
    countdownShown = countdown;
    $('countdown').textContent = countdown;
    $('countdown').classList.toggle('show', !!countdown);
  }
  // sunbeams indoors by day: they fade in as you go inside and with the sun's height
  const sunUp = THREE.MathUtils.smoothstep(tod.sunDir.y, 0.02, 0.2) * (1 - tod.night);
  quality.beams.strength = BEAMS.strength * tod.inside * sunUp * Number($('sunbeams').checked);
  // (in the headset, drawn straight, two eyes; the post-processing is for the screen)
  if (vr.presenting) renderer.render(scene, camera);
  else if (mode === 'tour' && flybyId && FLYBYS[flybyId]?.split) splitSeasons.render(dt, FLYBYS[flybyId].split);
  else {
    splitSeasons.end();
    quality.render(dt);
  }
}

// The seasons-at-once flybys (splitseasons.js): the picture in two or four parts, each in its season
const splitSeasons = new SplitSeasons({
  renderer,
  quality,
  camera,
  tod,
  snowfall,
  rainfall,
  world: () => ({ landscape, leaves, snowman, easter, blossom, water, jetAllowed: !oakScene }),
});

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
    // how high above the ground you are: from 25 m up the ground's sounds fade, gone by 80 m
    aloft: THREE.MathUtils.smoothstep(camera.position.y - (hillHeight ? hillHeight(camera.position.x, camera.position.z) : 0), 25, 80),
  };
}

let exporting = false;
let videoDoorEvents = []; // doors that open during a video frame, for its sound
let videoSoundEvents = []; // the festivals' sounds during a video frame: [what, ...its arguments]
// the wildlife's calls: played, or noted down for the video's soundtrack
// the long recordings (music) load the first time something asks for one
const laterLoading = new Set();
function wantSound(name) {
  if (sound.has(name) || laterLoading.has(name) || !LATER_SOUNDS.includes(name)) return;
  laterLoading.add(name);
  loadSamples([name]).catch(() => {});
}
const wildSound = {
  sample: (name, p, opts) => (exporting ? videoSoundEvents.push(['sample', name, p?.clone() ?? null, opts]) : sound.sample(name, p, opts)),
  has: (name) => {
    wantSound(name);
    return sound.has(name);
  },
  duration: (name) => sound.duration(name),
  voice: () => (sound.on && !exporting ? sound.level() : 0),
  onStopMusic: (f) => sound.onStopMusic.add(f),
};
// The festivals' sounds (the bonfire, rockets and bangs, the thunder): played as they happen, or,
// while a video is being made, noted down frame by frame for its soundtrack (video.js plays them back)
const festSound = {
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
// Father Christmas over the estate on Christmas Eve, and the ride with him (santa.js)
// (he lands on the ridge of the front range's roof: its stone cap, 11.35 m up, z -19.9, the sleigh
// at the west end and the team along it to the east, short of the chimneys)
const meteors = new Meteors(scene); // the Perseids (sights.js)
const murmuration = new Murmuration(scene, wildSound); // starlings at a winter dusk (sights.js)
const balloons = new Balloons(scene, wildSound); // hot-air balloons on still summer mornings (sights2.js)
let party = null; // a summer garden party on the east lawn (sights2.js)
// Five more sights (sights3.js): glow-worms in the long grass, night-shining clouds, a comet, the
// blossom in April, and snow falling at night lit by the lamps (the first and the blossom once the
// grounds are laid out)
const nightClouds = new NightClouds(scene);
const comet = new Comet(scene);
const nightSnow = new NightSnow(scene);
let fireflies = null;
let blossom = null;
// (end of the five more sights' block)
const santa = new Santa(scene, wildSound, { roof: { at: new THREE.Vector3(-6.6, 11.36, -19.9), dir: new THREE.Vector3(1, 0, 0) } });

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
  // (nothing runs behind the loading screen: the first frame is drawn once everything is in, in warmUp)
  if (!ready) return;
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
  meshAtFace,
  get modelCentre() {
    return modelCentre;
  },
  scene,
  camera,
  renderer,
  get splitSeasons() {
    return splitSeasons;
  },
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
  get garden() {
    return garden;
  },
  get moving() {
    return moving;
  },
  meteors,
  murmuration,
  // (sights3.js)
  nightClouds,
  comet,
  nightSnow,
  get fireflies() {
    return fireflies;
  },
  get blossom() {
    return blossom;
  },
  get haunt() {
    return haunt;
  },
  get graves() {
    return graves;
  },
  get lure() {
    return lure;
  },
  get hauntIn() {
    return hauntIn;
  },
  get xmasIn() {
    return xmasIn;
  },
  get statue() {
    return statue;
  },
  get lens() {
    return lens;
  },
  get coldness() {
    return coldness;
  },
  get spooky() {
    return spooky;
  },
  get bonfire() {
    return bonfire;
  },
  get lightShow() {
    return lightShow;
  },
  get festive() {
    return festive;
  },
  get easter() {
    return easter;
  },
  get wildlife() {
    return wildlife;
  },
  get storm() {
    return storm;
  },
  get park() {
    return park;
  },
  santa,
  get sight() {
    return sight;
  },
  rainbow,
  footprints,
  aurora,
  setPhoto,
  focusAt,
  vr,
  lanterns,
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
    // the intro film (dev/diorama.js): frames drawn one at a time while the live loop stands aside
    hold(on) {
      exporting = on;
    },
    frame(dt) {
      step(dt, true);
    },
    diorama: () => import('./dev/diorama.js'),
  },
};
