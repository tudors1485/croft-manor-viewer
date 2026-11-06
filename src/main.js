import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Walker, buildCollider, moveSphere } from './walk.js';
import { Doors } from './doors.js';
import { setupWater } from './water.js';
import { placeIvy } from './ivy.js';
import { TimeOfDay } from './sky.js';
import { Lamps } from './lamps.js';
import { Landscape, makeTerrain, makeHillHeight } from './landscape.js';
import { installGrade } from './look.js';
import { Quality } from './quality.js';
import { tuneMaterials, GRASS_TINT, grassShader, TINTS } from './materials.js';
import { Tour, FLYBYS, checkPath } from './tour.js';
import { Soundscape } from './sound.js';
import { seasonAt, seasonUniforms, dateLabel, Snowfall } from './season.js';

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
quality.onResize = () => resizeWater();

// Sky, sun, moon and the time of day
const tod = new TimeOfDay(renderer, scene);
let modelCentre = new THREE.Vector3();
let modelRadius = 100;
let lamps = null;
let playing = false;

function updateSun() {
  tod.hours = Number($('time').value);
  tod.compass = THREE.MathUtils.degToRad(Number($('sun-azim').value));
  tod.update(true);
  $('time-label').textContent = tod.label();
}

// The season: the sun's path for the day, and the trees, grass, snow and wildlife
let season = seasonAt(145);
let seasonDay = 145; // fractional while the year runs (the slider snaps to whole days)
let playingYear = false;
const snowfall = new Snowfall(scene);
function updateSeason(force = true) {
  const day = seasonDay;
  tod.day = day;
  season = seasonAt(day);
  seasonUniforms.uDay.value = day;
  seasonUniforms.uSnow.value = season.snow;
  seasonUniforms.uGrassTint.value.setRGB(...season.grass);
  $('season-label').textContent = dateLabel(day);
  $('season-label').title = season.name;
  tod.update(force);
  $('time-label').textContent = tod.label();
}

const LOOK = { exposure: 0.66 };
function updateExposure() {
  // the eye adapts a little at night
  renderer.toneMappingExposure = LOOK.exposure * (Number($('exposure').value) / 100) * THREE.MathUtils.lerp(1, 1.7, tod.night);
}

// Controls
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.screenSpacePanning = true;
orbit.maxPolarAngle = Math.PI * 0.96;

const look = new PointerLockControls(camera, canvas);
look.addEventListener('lock', () => updateLockHint());
look.addEventListener('unlock', () => updateLockHint());
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
// where Walk mode starts if you switch to it from high up: the drive, facing the front door
const SPAWN = { eye: new THREE.Vector3(-3, 1.7, 17), look: new THREE.Vector3(2.5, 1.8, -12) };

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
  $('tour-stop').hidden = mode !== 'tour';
  $('help-orbit').hidden = mode !== 'orbit';
  $('help-walk').hidden = mode !== 'walk';
  $('help-fly').hidden = mode !== 'fly';
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
    setMode(m);
    e.currentTarget.blur(); // so Space does not press the button again
  };
}
function updateLockHint() {
  const free = mode === 'walk' || mode === 'fly';
  $('lock-hint').hidden = !(free && !look.isLocked);
  $('crosshair').hidden = !(free && look.isLocked);
}
$('tour').onclick = (e) => {
  const touring = mode === 'tour' && !flybyId;
  if (mode === 'tour') setMode('orbit');
  flybyId = null;
  if (!touring) setMode('tour');
  e.currentTarget.blur();
};
for (const [id, f] of Object.entries(FLYBYS)) $('flyby').add(new Option(f.label, id));
$('flyby').onchange = (e) => {
  const id = e.target.value;
  e.target.value = '';
  e.target.blur();
  if (!id) return;
  if (mode === 'tour') setMode('orbit');
  flybyId = id;
  setMode('tour');
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && mode === 'tour') setMode('orbit');
});
$('tour-stop').onclick = () => setMode('orbit');
$('sound').addEventListener('change', async (e) => {
  if (e.target.checked) await sound.enable();
  else sound.disable();
  e.target.blur();
});
canvas.addEventListener('click', () => {
  if ((mode === 'walk' || mode === 'fly') && !look.isLocked) look.lock();
});
$('lock-hint').addEventListener('click', () => look.lock());
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

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
  for (const [i, [name]] of viewpoints.entries()) sel.add(new Option(name, String(i)));
  sel.onchange = () => {
    const [, pos, target] = viewpoints[Number(sel.value)];
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

    const overviewPos = modelCentre.clone().add(new THREE.Vector3(size.x * 0.75, size.y * 3.5 + 25, size.z * 0.65));
    viewpoints[0][1] = overviewPos;
    viewpoints[0][2] = modelCentre.clone();
    camera.position.copy(overviewPos);
    orbit.target.copy(modelCentre);
    orbit.maxDistance = modelRadius * 5;
    orbit.update();

    water = setupWater(renderer, scene, model);
    lamps = new Lamps(scene, model);
    console.info(`light fittings: ${lamps.count}`);
    resizeWater();
    updateSun();
    prepareWalking(ground);
    modelTris = tris;
    $('stats-base').textContent = `${Math.round(tris).toLocaleString('en-GB')} triangles`;
    $('loading').classList.add('done');
    $('panel').hidden = false;
  },
  (e) => {
    const total = e.total || 83_000_000;
    const pct = Math.min(100, (e.loaded / total) * 100);
    $('loading-bar').style.width = `${pct}%`;
    $('loading-text').textContent = `Loading the manor… ${(e.loaded / 1e6).toFixed(0)} of ${(total / 1e6).toFixed(0)} MB`;
  },
  (err) => {
    console.error(err);
    $('loading-text').textContent = 'The model did not load. Run npm run build:model first, then reload.';
  },
);

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
  const geo = await buildCollider(solid);
  walker = new Walker(camera, geo);
  doors = new Doors(scene, model, geo);
  walker.skipTriangle = passDoor;
  walker.ghost = throughWalls;
  doors.onSound = (opening, d, dist) => sound.door(opening, dist);
  console.info(`doors: ${doors.summary}`);

  lamps?.addOutdoor(geo.boundsTree);
  landscape = new Landscape({ scene, renderer, model, lawn, bvh: geo.boundsTree, hillHeight });
  landscape.build().then(async (st) => {
    walker.obstacles = landscape.obstacles;
    // the tour and the flybys must not pass through walls or trees (doors that open are fine)
    const opens = (t) => doors.triDoor[t] > 0;
    const moves = [...tour.tourMoves, ...Object.values(tour.flybyMoves)];
    const problems = await checkPath(moves, geo.boundsTree, opens, { crowns: landscape.crowns });
    if (problems.length) console.warn(`camera paths touch walls or trees at ${problems.length} points`, problems.slice(0, 30));
    else console.info('camera paths: clear of walls and trees');
    console.info(`landscape: ${st.trees} trees, ${st.bushes} bushes, ${st.billboards} far trees, ${Math.round(st.triangles / 1000)}k triangles, ${st.ms} ms`);
    $('stats-base').textContent = `${Math.round((modelTris + st.triangles) / 1000).toLocaleString('en-GB')}k triangles`;
  });
  const surfaceRay = new THREE.Raycaster();
  const surfaces = [];
  model.traverse((o) => o.isMesh && surfaces.push(o));
  walker.onFootstep = (speed) => {
    if (!sound.on) return;
    surfaceRay.set(new THREE.Vector3(walker.feet.x, walker.feet.y + 0.3, walker.feet.z), new THREE.Vector3(0, -1, 0));
    surfaceRay.far = 0.6;
    const hit = surfaceRay.intersectObjects(surfaces, false)[0];
    const name = hit?.object.material.name ?? 'cm_grass';
    const surface = /grass|sand/.test(name) ? 'grass' : /gravel/.test(name) ? 'gravel' : 'stone';
    sound.footstep(surface, speed);
  };
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.info(`collision tree ready in ${secs} s`);
  $('walk-status').textContent = '';
  if (pendingWalk) {
    pendingWalk = false;
    setMode('walk');
  }
}

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

// Panel wiring
$('stats').innerHTML = '<span id="stats-base"></span> · <span id="stats-fps"></span>';
for (const id of ['time', 'sun-azim']) $(id).addEventListener('input', updateSun);
$('time').addEventListener('input', () => setPlaying(false));
function setPlaying(on) {
  playing = on;
  $('play').textContent = on ? '❚❚' : '▶';
  $('play').title = on ? 'Stop the clock' : 'Run the clock: a day in two minutes';
}
$('play').onclick = (e) => {
  setPlaying(!playing);
  e.currentTarget.blur();
};
$('season').addEventListener('input', () => {
  setPlayingYear(false);
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
$('picture').onclick = (e) => {
  wantPicture = true;
  e.currentTarget.blur();
};
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  tod.tick(dt);
  if (playing) {
    let h = Number($('time').value) + dt * (24 / 120);
    if (h >= 24) h -= 24;
    $('time').value = String(h);
    tod.hours = h;
    tod.update();
    $('time-label').textContent = tod.label();
  }
  if (playingYear) {
    seasonDay += dt * (365 / 60);
    if (seasonDay >= 365) seasonDay -= 365;
    $('season').value = String(Math.floor(seasonDay));
    updateSeason(false);
  }
  snowfall.update(dt, camera, THREE.MathUtils.smoothstep(season.snow, 0.55, 0.9) * (1 - tod.inside), renderer.getPixelRatio());
  updateExposure();
  if (lamps) {
    lamps.update(camera, tod.lamps, dt, renderer);
    const inside = lamps.houseBox.containsPoint(camera.position) ? 1 : 0;
    tod.inside += (inside - tod.inside) * (1 - Math.exp(-dt * 3));
    tod.applyAmbient();
  }
  if (landscape) landscape.update(dt, tod);
  if (doors) doors.update(camera, dt);
  sound.update(dt, camera, { night: tod.night, inside: tod.inside, birds: season.birds, crickets: season.crickets, snow: season.snow, dusk: tod.lamps });
  if (mode === 'tour') {
    if (!tour.update(dt)) setMode('orbit');
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
  if (water) {
    water.update(camera, elapsed);
    if (water.jet) water.jet.material.map.offset.y -= dt * 1.4;
  }
  quality.fisheye = mode === 'tour' ? tour.fisheye : 0;
  quality.render(dt);
  if (wantPicture) {
    // read the canvas in the same task as the render, before the browser clears it
    wantPicture = false;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `croft-manor-${dateLabel(seasonDay).replace(' ', '-')}-${tod.label().replace(':', '')}-${appVersion}.png`;
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
  TINTS,
  get season() {
    return season;
  },
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
