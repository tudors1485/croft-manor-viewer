import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Walker, buildCollider } from './walk.js';
import { setupWater } from './water.js';
import { placeIvy } from './ivy.js';
import { TimeOfDay } from './sky.js';
import { Lamps } from './lamps.js';
import { Landscape, makeTerrain, makeHillHeight } from './landscape.js';
import { installGrade } from './look.js';
import { Quality } from './quality.js';
import { tuneMaterials, GRASS_TINT } from './materials.js';

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
  $('help-orbit').hidden = mode !== 'orbit';
  $('help-walk').hidden = mode !== 'walk';
  $('help-fly').hidden = mode !== 'fly';
  orbit.enabled = mode === 'orbit';
  flight = null;
  if (mode === 'orbit') {
    look.unlock();
    // put the orbit target a few metres in front of the camera so it carries on from here
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    orbit.target.copy(camera.position).addScaledVector(fwd, 6);
    orbit.update();
  } else {
    camera.up.set(0, 1, 0);
    velocity.set(0, 0, 0);
  }
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
  $('lock-hint').hidden = !(mode !== 'orbit' && !look.isLocked);
  $('crosshair').hidden = !(mode !== 'orbit' && look.isLocked);
}
canvas.addEventListener('click', () => {
  if (mode !== 'orbit' && !look.isLocked) look.lock();
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
  if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
  velocity.lerp(want, 1 - Math.exp(-dt * 10));
  camera.position.addScaledVector(velocity, dt);
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
  if (mode === 'fly') {
    camera.position.copy(pos);
    camera.lookAt(target);
    velocity.set(0, 0, 0);
    return;
  }
  flight = {
    t: 0,
    seconds,
    fromPos: camera.position.clone(),
    fromTarget: orbit.target.clone(),
    toPos: pos.clone(),
    toTarget: target.clone(),
  };
}
function stepFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / flight.seconds);
  const k = flight.t * flight.t * (3 - 2 * flight.t);
  camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
  orbit.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
  if (flight.t >= 1) flight = null;
}

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

// Walking: everything solid in the estate plus the fields, but not the ivy, the water or the doors
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
    // every door in the model is a closed panel, so doors let you through
    if (/door/i.test(name)) return;
    if (o.material.transparent && !/glass/i.test(name)) return;
    solid.push(o);
  });
  const geo = await buildCollider(solid);
  walker = new Walker(camera, geo);
  lamps?.addOutdoor(geo.boundsTree);
  landscape = new Landscape({ scene, renderer, model, lawn, bvh: geo.boundsTree, hillHeight });
  landscape.build().then((st) => {
    walker.obstacles = landscape.obstacles;
    console.info(`landscape: ${st.trees} trees, ${st.bushes} bushes, ${st.billboards} far trees, ${Math.round(st.triangles / 1000)}k triangles, ${st.ms} ms`);
    $('stats-base').textContent = `${Math.round((modelTris + st.triangles) / 1000).toLocaleString('en-GB')}k triangles`;
  });
  walker.onFootstep = (speed) => window.dispatchEvent(new CustomEvent('footstep', { detail: { speed } }));
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.info(`collision tree ready in ${secs} s`);
  $('walk-status').textContent = '';
  if (pendingWalk) {
    pendingWalk = false;
    setMode('walk');
  }
}

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
$('exposure').addEventListener('input', updateExposure);
$('ivy').addEventListener('change', (e) => {
  const ivy = model?.getObjectByName('Ivy');
  if (ivy) ivy.visible = e.target.checked;
});
$('quality').addEventListener('change', (e) => {
  quality.set(e.target.value);
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
  updateExposure();
  if (lamps) {
    lamps.update(camera, tod.lamps, dt, renderer);
    const inside = lamps.houseBox.containsPoint(camera.position) ? 1 : 0;
    tod.inside += (inside - tod.inside) * (1 - Math.exp(-dt * 3));
    tod.applyAmbient();
  }
  if (landscape) landscape.update(dt, tod);
  if (mode === 'orbit') {
    stepFlight(dt);
    orbit.update();
  } else if (mode === 'walk') {
    if (walker.update(dt, walkInput()) === 'fell') walker.placeAt(SPAWN.eye, SPAWN.look);
  } else {
    moveFly(dt);
  }
  elapsed += dt;
  if (water) {
    water.update(camera, elapsed);
    if (water.jet) water.jet.material.map.offset.y -= dt * 1.4;
  }
  quality.render(dt);
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
  tod,
  LOOK,
  quality,
  dev: {
    measureTrees: () => import('./dev/measure-trees.js').then((m) => m.measure()),
  },
};
