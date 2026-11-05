import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');

// Renderer and scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.08, 4000);

// Sky, sun and environment light
const sky = new Sky();
sky.scale.setScalar(3000);
sky.material.uniforms.turbidity.value = 4;
sky.material.uniforms.rayleigh.value = 1.2;
sky.material.uniforms.mieCoefficient.value = 0.004;
sky.material.uniforms.mieDirectionalG.value = 0.85;
sky.material.uniforms.cloudCoverage.value = 0.35;
scene.add(sky);

const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2;
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a5040, 0.7);
scene.add(hemi);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new Sky();
envSky.scale.setScalar(1000);
envSky.material.uniforms.showSunDisc.value = 0;
envSky.material.uniforms.cloudCoverage.value = 0;
envScene.add(envSky);
let envTarget = null;

const sunDir = new THREE.Vector3();
let modelCentre = new THREE.Vector3();
let modelRadius = 100;

function updateSun() {
  const elev = THREE.MathUtils.degToRad(Number($('sun-elev').value));
  const azim = THREE.MathUtils.degToRad(Number($('sun-azim').value));
  sunDir.setFromSphericalCoords(1, Math.PI / 2 - elev, azim);
  for (const s of [sky, envSky]) {
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) {
      if (s !== sky) s.material.uniforms[k].value = sky.material.uniforms[k].value;
    }
    s.material.uniforms.sunPosition.value.copy(sunDir);
  }
  sun.position.copy(modelCentre).addScaledVector(sunDir, modelRadius * 1.5);
  sun.target.position.copy(modelCentre);
  // low sun: warmer and weaker
  const t = Math.sin(elev);
  sun.color.setHSL(0.09, 0.6 - 0.4 * t, 0.62 + 0.3 * t);
  sun.intensity = 1.3 + 2.2 * Math.min(1, t * 1.6);
  if (envTarget) envTarget.dispose();
  envTarget = pmrem.fromScene(envScene, 0, 0.1, 1000);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55 + 0.3 * t;
}

function updateExposure() {
  renderer.toneMappingExposure = 0.55 * (Number($('exposure').value) / 100);
}

// Controls
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.screenSpacePanning = true;
orbit.maxPolarAngle = Math.PI * 0.96;

const walk = new PointerLockControls(camera, canvas);
const keys = new Set();
let mode = 'orbit';

function setMode(next) {
  mode = next;
  $('mode-orbit').classList.toggle('on', mode === 'orbit');
  $('mode-walk').classList.toggle('on', mode === 'walk');
  $('help-orbit').hidden = mode !== 'orbit';
  $('help-walk').hidden = mode !== 'walk';
  orbit.enabled = mode === 'orbit';
  if (mode === 'orbit') {
    walk.unlock();
    // put the orbit target a few metres in front of the camera so it carries on from here
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    orbit.target.copy(camera.position).addScaledVector(fwd, 6);
    orbit.update();
  } else {
    camera.up.set(0, 1, 0);
  }
}
$('mode-orbit').onclick = (e) => {
  setMode('orbit');
  e.currentTarget.blur(); // so Space in walk mode does not press the button again
};
$('mode-walk').onclick = (e) => {
  setMode('walk');
  e.currentTarget.blur();
};
canvas.addEventListener('click', () => {
  if (mode === 'walk' && !walk.isLocked) walk.lock();
});
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const velocity = new THREE.Vector3();
function moveWalk(dt) {
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
  const target = mode === 'orbit' ? orbit.target : camera.position.clone().addScaledVector(fwd, 6);
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
const loader = new GLTFLoader();
loader.load(
  '/manor.glb',
  (gltf) => {
    model = gltf.scene;
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

    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -modelRadius;
    cam.right = cam.top = modelRadius;
    cam.near = 1;
    cam.far = modelRadius * 3.2;
    cam.updateProjectionMatrix();

    // Fields around the estate. The estate's lawn is a thin sheet at y = 0.04 with pits
    // below it, so the ground is a sheet just under it with the lawn's footprint cut out.
    let grassMap = null;
    const lawn = new THREE.Box3();
    model.traverse((o) => {
      if (o.isMesh && o.material.name === 'cm_grass') {
        if (o.material.map) grassMap = o.material.map;
        lawn.expandByObject(o);
      }
    });
    if (lawn.isEmpty()) lawn.copy(box);
    // pushed back in depth, so where it tucks under the lawn's ragged edge the lawn wins
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    if (grassMap) {
      groundMat.map = grassMap.clone();
      groundMat.map.wrapS = groundMat.map.wrapT = THREE.RepeatWrapping;
      groundMat.map.repeat.set(1 / 5.1, 1 / 5.1); // the model's grass tiles every 5.1 m
      groundMat.map.needsUpdate = true;
    } else {
      groundMat.color.set(0x4a5a32);
    }
    // a 3 x 3 grid of quads with the middle one left out: shared vertices, so no cracks
    const R = 1500;
    const tuck = 0.8; // the lawn's edge wanders by up to 0.4 m, so the hole starts well inside it
    const xs = [modelCentre.x - R, lawn.min.x + tuck, lawn.max.x - tuck, modelCentre.x + R];
    const zs = [modelCentre.z - R, lawn.min.z + tuck, lawn.max.z - tuck, modelCentre.z + R];
    const verts = [];
    const uvs = [];
    for (const z of zs) {
      for (const x of xs) {
        verts.push(x, 0, z);
        uvs.push(x, -z);
      }
    }
    const indices = [];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        if (i === 1 && j === 1) continue;
        const a = j * 4 + i;
        indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
      }
    }
    const groundGeo = new THREE.BufferGeometry();
    groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    groundGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    groundGeo.setIndex(indices);
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = lawn.min.y - 0.03;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.fog = new THREE.Fog(0xc9d6e2, modelRadius * 2.5, 1500);

    const overviewPos = modelCentre.clone().add(new THREE.Vector3(size.x * 0.75, size.y * 3.5 + 25, size.z * 0.65));
    viewpoints[0][1] = overviewPos;
    viewpoints[0][2] = modelCentre.clone();
    camera.position.copy(overviewPos);
    orbit.target.copy(modelCentre);
    orbit.maxDistance = modelRadius * 5;
    orbit.update();

    updateSun();
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

// Panel wiring
$('stats').innerHTML = '<span id="stats-base"></span> · <span id="stats-fps"></span>';
for (const id of ['sun-elev', 'sun-azim']) $(id).addEventListener('input', updateSun);
$('exposure').addEventListener('input', updateExposure);
$('ivy').addEventListener('change', (e) => {
  const ivy = model?.getObjectByName('Ivy');
  if (ivy) ivy.visible = e.target.checked;
});
$('shadows').addEventListener('change', (e) => {
  sun.castShadow = e.target.checked;
});
updateExposure();
loadViewpoints();

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Loop
const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;
let fpsTime = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  sky.material.uniforms.time.value += dt;
  if (mode === 'orbit') {
    stepFlight(dt);
    orbit.update();
  } else {
    moveWalk(dt);
  }
  renderer.render(scene, camera);
  frames++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    $('stats-fps').textContent = `${Math.round(frames / fpsTime)} fps · ${renderer.info.render.calls} draw calls`;
    frames = 0;
    fpsTime = 0;
  }
});

// handy from the console: window.manor.camera.position
window.manor = { THREE, scene, camera, renderer, orbit, get model() { return model; } };
