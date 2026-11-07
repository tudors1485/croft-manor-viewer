// The country around the manor, which the OBJ doesn't include: trees and bushes from
// ez-tree (instanced, real geometry near the estate), a forest of billboard impostors
// further out, rolling hills on the horizon and the drive running on past the gate.

import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { nextFrame } from './loading.js';
import { Tree } from '@dgreenheck/ez-tree';
import { seasonUniforms } from './season.js';
import { snowShader, gravelShader } from './materials.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// cheap value noise for the hills
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    s += amp * noise2(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

/** Hill height around the estate: flat within ~420 m of the centre, rolling beyond. */
export function makeHillHeight(centre) {
  return (x, z) => {
    const r = Math.hypot(x - centre.x, z - centre.z);
    const rise = THREE.MathUtils.smoothstep(r, 420, 1300);
    if (rise === 0) return 0;
    const n = fbm(x * 0.0021 + 3.1, z * 0.0021 - 7.7);
    const ridge = Math.pow(fbm(x * 0.0009 - 2.0, z * 0.0009 + 5.0), 2.0);
    return rise * (18 + 120 * n * n + 160 * ridge);
  };
}

/** Woodland mask (0..1), shared by the terrain tint and where far trees grow. */
export function woodAt(x, z) {
  return fbm(x * 0.006 + 11, z * 0.006 - 3);
}

/**
 * The fields and hills around the estate: one watertight grid out to `R` metres with a
 * hole where the estate's lawn is, fine near the walls and coarse far away.
 */
export function makeTerrain({ lawn, centre, grassMap, hillHeight, R = 3200 }) {
  const tuck = 0.8; // the lawn's edge wanders by up to 0.4 m, so the hole starts inside it
  const axis = (c, lo, hi) => {
    const out = [];
    const N = 44;
    for (let i = 0; i < N; i++) out.push(lo - (lo - (c - R)) * Math.pow(1 - i / N, 2.4));
    const M = Math.max(2, Math.ceil((hi - lo) / 6));
    for (let i = 0; i <= M; i++) out.push(lo + ((hi - lo) * i) / M);
    for (let i = 1; i <= N; i++) out.push(hi + (c + R - hi) * Math.pow(i / N, 2.4));
    return out;
  };
  const x0 = lawn.min.x + tuck;
  const x1 = lawn.max.x - tuck;
  const z0 = lawn.min.z + tuck;
  const z1 = lawn.max.z - tuck;
  const xs = axis(centre.x, x0, x1);
  const zs = axis(centre.z, z0, z1);
  const nx = xs.length;
  const pos = new Float32Array(nx * zs.length * 3);
  const uv = new Float32Array(nx * zs.length * 2);
  const col = new Float32Array(nx * zs.length * 3);
  const c = new THREE.Color();
  const field = new THREE.Color(0xd8cf8a);
  const woodC = new THREE.Color(0x6a7d56);
  const lush = new THREE.Color(0xc9e0a2);
  let k = 0;
  for (const z of zs) {
    for (const x of xs) {
      const y = hillHeight(x, z) + lawn.min.y - 0.03;
      pos.set([x, y, z], k * 3);
      uv.set([x / 5.1, -z / 5.1], k * 2);
      // plain lawn near the estate, fields and woods further out
      const far = THREE.MathUtils.smoothstep(Math.hypot(x - centre.x, z - centre.z), 90, 400);
      const n = fbm(x * 0.004, z * 0.004);
      const w = woodAt(x, z);
      c.setRGB(1, 1, 1);
      c.lerp(lush, far * THREE.MathUtils.clamp((0.55 - n) * 2, 0, 1) * 0.6);
      c.lerp(field, far * THREE.MathUtils.clamp((n - 0.6) * 3, 0, 1) * 0.7);
      c.lerp(woodC, far * THREE.MathUtils.clamp((w - 0.45) * 6, 0, 1));
      col.set([c.r, c.g, c.b], k * 3);
      k++;
    }
  }
  const idx = [];
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      if (cx > x0 && cx < x1 && cz > z0 && cz < z1) continue; // the estate
      const a = j * nx + i;
      idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // pushed back in depth, so where it tucks under the lawn's ragged edge the lawn wins
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  if (grassMap) {
    mat.map = grassMap.clone();
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.needsUpdate = true;
  } else {
    mat.color.set(0x4a5a32);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'Terrain';
  mesh.receiveShadow = true;
  return mesh;
}

function texturesReady(textures, timeout = 15000) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      const ok = textures.every((t) => !t || (t.image && (t.image.complete === undefined || t.image.complete)));
      if (ok || performance.now() - t0 > timeout) resolve(ok);
      else setTimeout(check, 50);
    };
    check();
  });
}

const WIND_GLSL = /* glsl */ `
  uniform float uWindTime;
  uniform float uWindAmp;
`;

// The year in a tree: each tree runs a few days early or late (from a hash of where it
// stands), comes into leaf over April and May, turns in October and drops its leaves
// through November. Each leaf has its own random number (aLeaf), so the crown thins leaf
// by leaf rather than all at once, and some leaves turn before others.
const SEASON_VERTEX = /* glsl */ `
  attribute float aLeaf;
  uniform float uDay;
  varying float vLeaf;
  varying vec4 vSeason; // leaves on the tree, autumn colour, spring freshness, this tree's autumn hue
`;
const SEASON_BEGIN = /* glsl */ `
  {
    #ifdef USE_INSTANCING
      vec2 sp = instanceMatrix[3].xz;
    #else
      vec2 sp = vec2(0.0);
    #endif
    float early = fract(sin(dot(sp, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    float d = uDay + early * 18.0;
    float grow = smoothstep(98.0, 136.0, d);
    float fall = smoothstep(292.0, 330.0, d);
    vSeason = vec4(grow * (1.0 - fall), smoothstep(262.0, 304.0, d), 1.0 - smoothstep(128.0, 172.0, d), fract(early * 31.7 + 0.5));
    vLeaf = aLeaf;
  }
`;
const SEASON_FRAGMENT = /* glsl */ `
  varying float vLeaf;
  varying vec4 vSeason;
`;
const SEASON_COLOUR = /* glsl */ `
  if (vLeaf > vSeason.x) discard;
  {
    // autumn: yellow, orange and a few russet leaves (linear albedo), keeping the
    // texture's light and shade but not its dark green
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    float shade = mix(0.45, 1.1, clamp(lum * 7.0, 0.0, 1.0));
    float turn = clamp(vSeason.y * 1.7 - vLeaf * 0.7, 0.0, 1.0);
    // some trees turn butter yellow, some orange-brown; their leaves vary around that
    float hue = clamp(vSeason.w * 0.85 + fract(vLeaf * 7.31) * 0.5 - 0.15, 0.0, 1.0);
    vec3 autumn = mix(vec3(0.62, 0.36, 0.03), vec3(0.5, 0.13, 0.02), hue);
    autumn = mix(autumn, vec3(0.24, 0.08, 0.02), step(0.82, fract(vLeaf * 3.7)));
    diffuseColor.rgb = mix(diffuseColor.rgb, autumn * shade, turn);
    // fresh, yellowish green as the leaves first open
    diffuseColor.rgb *= mix(vec3(1.0), vec3(1.18, 1.22, 0.7), vSeason.z * 0.7);
  }
`;

/**
 * The leaves move in the wind (a gentle sway of the crown, more with height, each tree in its
 * own phase, and each leaf fluttering); trunks and branches stand still (`still`). For
 * deciduous leaves, the year (above). Works on the shadow-depth material too, so bare trees
 * cast bare shadows and the shadows move with the leaves.
 */
export function addTreeShader(material, uniforms, { stiff = 1, season = false, snow = null, height = 1, still = false, crown = false } = {}) {
  material.onBeforeCompile = (shader) => {
    if (crown) {
      // the crown's light (shadeCrown): the same outward normal on both faces of a leaf, its depth
      // in the crown, and leaf-to-leaf colour (some young and yellowish, some dark)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aOcc;\nvarying float vOcc;\nvarying float vTone;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOcc = aOcc;\nvTone = fract(aLeaf * 7.13 + 0.37);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vOcc;\nvarying float vTone;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif')
        // (in a crown the light that isn't the sun's has come through and off other leaves: green,
        // not the blue of the open sky; and leaves hardly mirror it)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= vec3(0.95, 1.05, 0.55) * mix(0.75, 1.0, vOcc);\nreflectedLight.indirectSpecular *= 0.3;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           diffuseColor.rgb *= vOcc * mix(vec3(0.8, 0.92, 0.66), vec3(1.1, 1.14, 0.62), vTone);`,
        );
    }
    shader.uniforms.uWindTime = uniforms.time;
    shader.uniforms.uWindAmp = uniforms.amp;
    if (season) shader.uniforms.uDay = seasonUniforms.uDay;
    if (snow) shader.uniforms.uSnow = seasonUniforms.uSnow;
    const snowVertex = snow === 'cap' ? 'attribute float aLeaf;\nvarying float vSnowH;\nvarying float vSnowSeed;\n' : '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + WIND_GLSL + (season ? SEASON_VERTEX : '') + snowVertex)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float h = max(transformed.y, 0.0);
           #ifdef USE_INSTANCING
             float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
           #else
             float ph = 0.0;
           #endif
           float w = sin(uWindTime * 1.3 + ph + transformed.x * 0.4) * 0.6 + sin(uWindTime * 2.9 + ph * 1.7 + transformed.z * 0.9) * 0.4;
           float flutter = sin(uWindTime * (5.0 + uWindAmp * 2.0) + transformed.x * 3.1 + transformed.y * 2.3 + ph) * 0.012;
           // (the crown sways only a little, so the leaves stay on their still branches)
           float move = ${still ? '0.0' : '1.0'} * uWindAmp / ${stiff.toFixed(1)};
           transformed.x += (w * h * h * 0.00022 + flutter) * move;
           transformed.z += (w * h * h * 0.00015 + flutter) * move;
         }
         ${season ? SEASON_BEGIN : ''}
         ${snow === 'cap' ? `vSnowH = transformed.y / ${height.toFixed(2)}; vSnowSeed = aLeaf;` : ''}`,
      );
    // snow: on a shrub, over the top of the bush, leaf by leaf; on bark, wherever it faces up
    if (snow === 'cap') {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vSnowH;\nvarying float vSnowSeed;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), uSnow * smoothstep(0.3, 0.75, vSnowH + (vSnowSeed - 0.5) * 0.5) * 0.92);`,
        );
    } else if (snow === 'bark') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow;').replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         { vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), uSnow * smoothstep(0.45, 0.8, wn.y) * 0.9); }`,
      );
    }
    if (season) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SEASON_FRAGMENT)
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + SEASON_COLOUR);
    }
  };
  material.customProgramCacheKey = () => `tree-${stiff}-${season}-${snow}-${height.toFixed(1)}-${still}-${crown}-${material.type}`;
}

/** A random number per leaf (each leaf is two crossed quads of four vertices, in order). */
function addLeafSeeds(geo, perLeaf) {
  const n = geo.attributes.position.count;
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const leaf = Math.floor(i / perLeaf);
    const x = Math.sin(leaf * 12.9898 + 4.1) * 43758.5453;
    seeds[i] = x - Math.floor(x);
  }
  geo.setAttribute('aLeaf', new THREE.BufferAttribute(seeds, 1));
}

/**
 * A crown lit as a crown: ez-tree's leaves are flat cards, each lit by its own facing, so a
 * tree reads as a heap of bright and dark tiles. In the renders a crown is a volume: bright on
 * the sunny side, dark underneath and inside. So each leaf's normal leans out from the
 * crown's middle (an ellipsoid round the leaves), and each leaf gets how deep in the crown it
 * is (aOcc: dark in the middle and low down, bright at the outside and the top).
 */
function shadeCrown(geo, perLeaf) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  // (the crown starts above the bare trunk: the lowest leaves)
  const c = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const occ = new Float32Array(pos.count);
  const leaf = new THREE.Vector3();
  const out = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += perLeaf) {
    leaf.set(0, 0, 0);
    const k = Math.min(perLeaf, pos.count - i);
    for (let j = 0; j < k; j++) leaf.x += pos.getX(i + j), leaf.y += pos.getY(i + j), leaf.z += pos.getZ(i + j);
    leaf.multiplyScalar(1 / k);
    out.subVectors(leaf, c).divide(half);
    const r = out.length();
    const h = (leaf.y - box.min.y) / Math.max(1e-3, box.max.y - box.min.y);
    // deep inside, little light gets in; low down, less than at the top
    const o = THREE.MathUtils.lerp(0.42, 1, THREE.MathUtils.smoothstep(r, 0.25, 0.95)) * THREE.MathUtils.lerp(0.72, 1.06, h);
    out.normalize();
    for (let j = 0; j < k; j++) {
      n.set(nor.getX(i + j), nor.getY(i + j), nor.getZ(i + j));
      // (the card's own facing keeps a little of the sparkle of single leaves)
      n.multiplyScalar(0.3).addScaledVector(out, 0.85).normalize();
      nor.setXYZ(i + j, n.x, n.y, n.z);
      occ[i + j] = o;
    }
  }
  nor.needsUpdate = true;
  geo.setAttribute('aOcc', new THREE.BufferAttribute(occ, 1));
}

/** One ez-tree, scaled to `height` metres with its base at y = 0, with PBR materials. */
export function makeVariant(preset, seed, height, wind, { tint, leafCount, leafSize, evergreen = false } = {}) {
  const tree = new Tree();
  tree.loadPreset(preset);
  tree.options.seed = seed;
  if (tint !== undefined) tree.options.leaves.tint = tint;
  if (leafCount) tree.options.leaves.count = leafCount;
  if (leafSize) tree.options.leaves.size *= leafSize;
  tree.generate();
  tree.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tree);
  const s = height / (box.max.y - box.min.y);
  const bGeo = tree.branchesMesh.geometry.clone().translate(0, -box.min.y, 0).scale(s, s, s);
  const lGeo = tree.leavesMesh.geometry.clone().translate(0, -box.min.y, 0).scale(s, s, s);
  const ob = tree.branchesMesh.material;
  const ol = tree.leavesMesh.material;
  const bark = new THREE.MeshStandardMaterial({
    name: `${preset} bark`,
    color: ob.color,
    map: ob.map,
    normalMap: ob.normalMap,
    roughness: 0.92,
    metalness: 0,
  });
  const leaves = new THREE.MeshStandardMaterial({
    name: `${preset} leaves`,
    color: ol.color,
    map: ol.map,
    alphaTest: ol.alphaTest,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0,
    // (a crown's leaves see the sky only at its top: lit by the whole blue dome they go grey-blue)
    envMapIntensity: 0.35,
  });
  const season = !evergreen;
  const perLeaf = tree.options.leaves.billboard === 'double' ? 8 : 4;
  addLeafSeeds(lGeo, perLeaf);
  shadeCrown(lGeo, perLeaf);
  addTreeShader(leaves, wind, { stiff: 1, season, snow: evergreen ? 'cap' : null, height, crown: true });
  addTreeShader(bark, wind, { stiff: 3, snow: 'bark', still: true });
  // the shadow of the leaves: same sway, same leaves (none in winter)
  const leavesDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ol.map, alphaTest: ol.alphaTest, side: THREE.DoubleSide });
  addTreeShader(leavesDepth, wind, { stiff: 1, season });
  const size = new THREE.Box3().setFromBufferAttribute(lGeo.attributes.position).getSize(new THREE.Vector3());
  return { preset, height, bGeo, lGeo, bark, leaves, leavesDepth, width: Math.max(size.x, size.z), tree, season };
}

/** Renders a variant from the side into a texture, for distant billboards (bare: branches only). */
function makeImpostor(renderer, v, bare = false) {
  const W = 256;
  const H = Math.round((W * v.height) / v.width);
  const target = new THREE.WebGLRenderTarget(W, Math.min(512, H), { samples: 4 });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x4a5a30, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const b = new THREE.Mesh(v.bGeo, v.bark);
  const l = new THREE.Mesh(v.lGeo, v.leaves);
  scene.add(b);
  if (!bare) scene.add(l);
  const half = v.width / 2;
  const cam = new THREE.OrthographicCamera(-half, half, v.height, 0, -100, 100);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevTone = renderer.toneMapping;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.toneMapping = prevTone;
  return target.texture;
}

/**
 * Far trees: camera-facing quads with a picture of the tree, in leaf (uMap) or bare
 * (uMapBare). They follow the year like the near trees: each one a few days early or late,
 * green leaves turning, and bare from late autumn to spring.
 */
function billboardMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uMap: { value: null }, uMapBare: { value: null }, uLight: { value: new THREE.Color(1, 1, 1) }, uSnow: seasonUniforms.uSnow },
    ]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uDay;
      varying vec2 vUv;
      varying vec3 vSeason; // in leaf, autumn colour, this tree's own random number
      void main() {
        vUv = uv;
        vec3 base = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);
        vec3 toCam = cameraPosition - base;
        toCam.y = 0.0;
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4))));
        vec3 world = base + right * position.x * sx + vec3(0.0, position.y * sy, 0.0);
        float r = fract(sin(dot(base.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float d = uDay + (r - 0.5) * 18.0;
        vSeason = vec3(smoothstep(98.0, 136.0, d) * (1.0 - smoothstep(292.0, 330.0, d)), smoothstep(262.0, 304.0, d), fract(r * 17.13));
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uMap;
      uniform sampler2D uMapBare;
      uniform vec3 uLight;
      uniform float uSnow;
      varying vec2 vUv;
      varying vec3 vSeason;
      void main() {
        bool inLeaf = vSeason.z < vSeason.x;
        vec4 t = inLeaf ? texture2D(uMap, vUv) : texture2D(uMapBare, vUv);
        if (t.a < 0.5) discard;
        if (inLeaf) {
          // green pixels are leaves: turn them with the season
          float leafy = smoothstep(0.0, 0.05, t.g - t.r);
          float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
          vec3 autumn = mix(vec3(0.62, 0.36, 0.03), vec3(0.5, 0.15, 0.02), vSeason.z) * mix(0.45, 1.1, clamp(lum * 4.0, 0.0, 1.0));
          t.rgb = mix(t.rgb, autumn, vSeason.y * leafy);
        }
        // (snow on the branches and the crowns, more on the upper parts)
        t.rgb = mix(t.rgb, vec3(0.62, 0.64, 0.68), uSnow * (0.35 + 0.45 * vUv.y));
        gl_FragColor = vec4(t.rgb * uLight * vec3(1.45, 1.55, 1.3), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

export class Landscape {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {THREE.Object3D} o.model
   * @param {THREE.Box3} o.lawn the estate's lawn bounds
   * @param {import('three-mesh-bvh').MeshBVH} o.bvh collision tree, for finding open lawn
   */
  constructor({ scene, renderer, model, lawn, bvh, hillHeight }) {
    this.scene = scene;
    this.renderer = renderer;
    this.model = model;
    this.lawn = lawn.clone();
    this.bvh = bvh;
    this.centre = lawn.getCenter(new THREE.Vector3());
    this.hillHeight = hillHeight;
    this.group = new THREE.Group();
    this.group.name = 'Landscape';
    scene.add(this.group);
    this.wind = { time: { value: 0 }, amp: { value: 1 } };
    this.obstacles = []; // trunks, for walking
    this.crowns = []; // tree crowns: { x, z, r, y0, y1 }
    this.treeSpots = []; // the real trees (not the far billboards): { x, z, r, inside }, for the fallen leaves
    this.shrubs = []; // the shrubs' meshes (left out of the water's reflection)
    this.billboards = [];
    this.stats = { trees: 0, bushes: 0, billboards: 0, triangles: 0 };
  }

  _ground(x, z) {
    // open, ground-level spot on the estate? (nothing above it, close to y = 0)
    const ray = new THREE.Ray(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0));
    const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 60);
    return hit ? hit.point.y : null;
  }

  _clearLawn(x, z, radius) {
    if (!this._grassAt(x, z)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const y = this._ground(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
      if (y === null || y > 0.25 || y < -0.2) return false;
    }
    const y = this._ground(x, z);
    return y !== null && y < 0.25 && y > -0.2;
  }

  _grassAt(x, z) {
    if (!this._ray) {
      this._ray = new THREE.Raycaster();
      this._ray.firstHitOnly = true;
      this._down = new THREE.Vector3(0, -1, 0);
      this._from = new THREE.Vector3();
      // (a search tree for the lawn and the gravel: asked thousands of times while loading, for the
      // trees, the daffodils and the wildlife, testing every triangle took seconds; indirect, so
      // the meshes' own triangles keep their order)
      for (const m of this._surfaces) {
        m.geometry.boundsTree ??= new MeshBVH(m.geometry, { indirect: true, maxDepth: 64 });
        m.raycast = acceleratedRaycast;
      }
    }
    this._ray.set(this._from.set(x, 20, z), this._down);
    this._ray.far = 40;
    const hits = this._ray.intersectObjects(this._surfaces, false);
    return hits.length > 0 && hits[0].object.material.name === 'cm_grass';
  }

  /** Plants it all. `onProgress(0..1)` as it goes (it lets the page draw between the trees). */
  async build(onProgress = null) {
    const t0 = performance.now();
    let made = 0;
    const grown = async (v) => {
      onProgress?.(Math.min(0.85, ++made / 9));
      await nextFrame();
      return v;
    };
    this._surfaces = [];
    this.model.traverse((o) => {
      if (o.isMesh && /^(cm_grass|cm_gravel)$/.test(o.material.name)) this._surfaces.push(o);
    });

    // English parkland: oaks and ashes with full, dark crowns
    const full = { leafCount: 16, leafSize: 1.2 };
    const variants = [
      await grown(makeVariant('Oak Large', 11, 17, this.wind, { ...full, tint: 0x9fb478 })),
      await grown(makeVariant('Oak Medium', 23, 12, this.wind, { ...full, tint: 0x94ad6c })),
      await grown(makeVariant('Ash Large', 37, 19, this.wind, { ...full, tint: 0xa6bc7c })),
      await grown(makeVariant('Ash Medium', 41, 14, this.wind, { ...full, tint: 0x9db374 })),
      await grown(makeVariant('Oak Large', 77, 15, this.wind, { ...full, tint: 0x8ea666 })),
    ];
    // shrubs: ez-tree's bush with twice its leaves, and bigger ones, so they read as dense,
    // round shrubs (they are the costly part of the planting, so not more than that)
    const bushes = [
      await grown(makeVariant('Bush 1', 61, 1.8, this.wind, { tint: 0x8aa463, leafCount: 20, leafSize: 2.3, evergreen: true })),
      await grown(makeVariant('Bush 1', 71, 1.2, this.wind, { tint: 0x7d9a58, leafCount: 22, leafSize: 2.6, evergreen: true })),
    ];
    // the two trees inside the gate in TRJTA's renders: full, round oaks
    const entrance = [
      await grown(makeVariant('Oak Medium', 91, 12.5, this.wind, { tint: 0xa8c07c, leafCount: 34, leafSize: 1.3 })),
      await grown(makeVariant('Oak Large', 53, 15, this.wind, { tint: 0x9fb478, leafCount: 26, leafSize: 1.15 })),
    ];
    const R = rng(20261105);

    // --- real trees: some on the lawns, a belt outside the walls ---
    const spots = []; // [variant, x, z, scale, rot]
    const taken = [];
    const free = (x, z, d) => taken.every(([tx, tz, td]) => Math.hypot(tx - x, tz - z) > Math.max(d, td));
    const L = this.lawn;
    const inLawn = (x, z, m = 0) => x > L.min.x - m && x < L.max.x + m && z > L.min.z - m && z < L.max.z + m;

    // the entrance first, so the other trees keep clear of it
    this.drive = this._findDrive();
    this.gate = this._findGate();
    const entranceSpots = [];
    if (this.gate) {
      for (const side of [-1, 1]) {
        // close in, either side of the gateway, their crowns over the wall (TRJTA's view over the
        // gate): the nearest lawn to that, clear of the path and the wall
        let best = null;
        for (let dx = 5.0; dx <= 8; dx += 0.5) {
          for (let dz = 2.5; dz <= 7; dz += 0.5) {
            const x = this.gate.x + side * dx;
            const z = this.gate.z - dz;
            if (!this._clearLawn(x, z, 1.2)) continue;
            // (not too close to the path: the camera comes through the gate under their crowns)
            const d = Math.hypot(dx - 5.6, dz - 3.4);
            if (!best || d < best[2]) best = [x, z, d];
          }
        }
        if (!best) continue;
        entranceSpots.push([0, best[0], best[1], 1, side > 0 ? 0.8 : 2.3]);
        taken.push([best[0], best[1], 12]);
      }
    }

    // an oak on the west of the front lawn, its crown over where you start: the picture of the
    // front Tudor liked, the house seen from under a tree (main.js: the opening view)
    this.frontOak = null;
    for (const [x, z] of [[-7.5, 13.5], [-8, 12.5], [-10.5, 15], [-11, 13.5], [-11.5, 12]]) {
      if (!this._clearLawn(x, z, 1.6)) continue;
      entranceSpots.push([1, x, z, 1, 4.1]);
      taken.push([x, z, 9]);
      this.frontOak = new THREE.Vector3(x, 0, z);
      break;
    }

    // inside the walls: open lawn, clear of paths and buildings by a few metres
    let tries = 0;
    let inside = 0;
    while (inside < 16 && tries++ < 900) {
      const x = THREE.MathUtils.lerp(L.min.x + 5, L.max.x - 5, R());
      const z = THREE.MathUtils.lerp(L.min.z + 5, L.max.z - 5, R());
      if (!free(x, z, 13)) continue;
      if (!this._clearLawn(x, z, 4.5)) continue;
      const v = Math.floor(R() * variants.length);
      spots.push([v, x, z, 0.75 + R() * 0.3, R() * Math.PI * 2]);
      taken.push([x, z, 13]);
      inside++;
    }

    // the drive carries on south of the gate; keep trees off it
    const onDrive = (x, z) => this.drive && z > L.max.z - 2 && x > this.drive.x0 - 4 && x < this.drive.x1 + 4;

    // outside: woods close behind the side and back walls (as in TRJTA's renders: the estate sits
    // in a clearing), and fewer, parkland trees in front, south of the wall
    const around = (depth) => {
      const side = R();
      if (side < 0.32) return [L.min.x - depth, THREE.MathUtils.lerp(L.min.z - 40, L.max.z + 30, R())];
      if (side < 0.64) return [L.max.x + depth, THREE.MathUtils.lerp(L.min.z - 40, L.max.z + 30, R())];
      if (side < 0.88) return [THREE.MathUtils.lerp(L.min.x - 40, L.max.x + 40, R()), L.min.z - depth];
      return [THREE.MathUtils.lerp(L.min.x - 40, L.max.x + 40, R()), L.max.z + depth + 6];
    };
    tries = 0;
    let outside = 0;
    while (outside < 58 && tries++ < 6000) {
      const [x, z] = around(4 + Math.pow(R(), 1.7) * 38);
      if (inLawn(x, z, 3) || onDrive(x, z) || !free(x, z, 8.5)) continue;
      const v = Math.floor(R() * variants.length);
      spots.push([v, x, z, 0.85 + R() * 0.4, R() * Math.PI * 2]);
      taken.push([x, z, 8.5]);
      outside++;
    }
    this._around = around;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const addInstanced = (vList, list, cast = true, { bark = true, into = null } = {}) => {
      vList.forEach((v, vi) => {
        const mine = list.filter((s) => s[0] === vi);
        if (!mine.length) return;
        for (const [geo, mat, depth] of [
          ...(bark ? [[v.bGeo, v.bark, null]] : []),
          [v.lGeo, v.leaves, v.leavesDepth],
        ]) {
          const im = new THREE.InstancedMesh(geo, mat, mine.length);
          if (depth) im.customDepthMaterial = depth;
          mine.forEach(([, x, z, s, rot], i) => {
            q.setFromAxisAngle(up, rot);
            m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
            im.setMatrixAt(i, m);
          });
          im.castShadow = cast;
          im.receiveShadow = true;
          im.computeBoundingSphere();
          this.group.add(im);
          into?.push(im);
          this.stats.triangles += (geo.index.count / 3) * mine.length;
        }
      });
    };
    addInstanced(variants, spots);
    addInstanced(entrance, entranceSpots);
    this.stats.trees = spots.length + entranceSpots.length;
    for (const [list, vs] of [
      [spots, variants],
      [entranceSpots, entrance],
    ]) {
      for (const [v, x, z, s] of list) {
        this.obstacles.push({ x, z, r: 0.35 * s * (vs[v].height / 14) });
        // the crown, roughly, for keeping camera paths out of the leaves (the trees by the gate and
        // the front lawn's oak are lifted clear of the head, as parkland trees are)
        const lifted = list === entranceSpots ? 0.3 : 0.22;
        this.crowns.push({ x, z, r: (vs[v].width * s) / 2, y0: vs[v].height * s * lifted, y1: vs[v].height * s });
        this.treeSpots.push({ x, z, r: (vs[v].width * s) / 2, inside: inLawn(x, z) });
      }
    }

    // --- bushes at the foot of the house and by the walls ---
    const bushSpots = [];
    const ray = new THREE.Ray();
    // a close row along the front and back of the house, in its planting strips
    for (const [x0, x1, faceZ] of [
      [-13, 28, 5],
      [-13, 28, -45],
    ]) {
      for (let x = x0; x <= x1; x += 1.9 + R() * 0.8) {
        if (faceZ > 0 && x > -4.5 && x < 1.5) continue; // the porch
        ray.origin.set(x, 0.6, faceZ);
        ray.direction.set(0, 0, faceZ > 0 ? -1 : 1);
        const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 30);
        if (!hit) continue;
        const z = hit.point.z + (faceZ > 0 ? 0.9 : -0.9);
        if (this._ground(x, z) === null || this._ground(x, z) > 0.25) continue;
        if (R() < 0.12) continue;
        bushSpots.push([0, x, z, 0.75 + R() * 0.35, R() * Math.PI * 2]);
      }
    }
    // outside the front wall: clumps of low shrubs, thick by the gate and thinning away from it
    if (this.gate) {
      for (let x = L.min.x + 4; x <= L.max.x - 4; x += 1.6 + R() * 1.6) {
        const fromGate = Math.abs(x - this.gate.x);
        if (fromGate < 3.4) continue; // the gateway and the drive
        if (R() < THREE.MathUtils.lerp(0.05, 0.7, Math.min(1, fromGate / 30))) continue;
        ray.origin.set(x, 0.6, this.gate.z + 12);
        ray.direction.set(0, 0, -1);
        // (the wall angles back from the gate towards the corners)
        const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 45);
        if (!hit || hit.point.y > 3) continue;
        const z = hit.point.z + 0.8 + R() * 0.7;
        if (!this._grassAt(x, z)) continue;
        bushSpots.push([1, x, z, 0.8 + R() * 0.6, R() * Math.PI * 2]);
      }
    }
    // no sun shadows from shrubs: the ambient occlusion grounds them, and it halves their cost.
    // Nor their twigs: the evergreen leaves hide them all year, and they were half the shrubs'
    // triangles (355k of 700k)
    addInstanced(bushes, bushSpots, false, { bark: false, into: this.shrubs });
    this.stats.bushes = bushSpots.length;
    // you can't walk through a shrub
    for (const [v, x, z, s] of bushSpots) this.obstacles.push({ x, z, r: (bushes[v].width * s) / 2 * 0.6 });

    // --- distant forest: billboards of the same trees, once their textures have loaded ---
    await texturesReady(variants.flatMap((v) => [v.leaves.map, v.bark.map]));
    onProgress?.(0.9);
    await nextFrame();
    // baked in full leaf, whatever the season slider says right now
    const day = seasonUniforms.uDay.value;
    seasonUniforms.uDay.value = 190;
    const impostors = variants.map((v) => makeImpostor(this.renderer, v));
    const bareImpostors = variants.map((v) => makeImpostor(this.renderer, v, true));
    seasonUniforms.uDay.value = day;
    const bbSpots = variants.map(() => []);
    let bb = 0;
    // the woods behind the belt of real trees: thick, from just behind them out to the fields
    tries = 0;
    while (bb < 1500 && tries++ < 20000) {
      const [x, z] = this._around(14 + Math.pow(R(), 1.3) * 110);
      if (inLawn(x, z, 10) || onDrive(x, z)) continue;
      // (in front of the house, a few clumps; the sides and the back, solid)
      if (z > L.max.z + 4 && R() > 0.25) continue;
      if (!taken.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > 5)) continue;
      const vi = Math.floor(R() * variants.length);
      bbSpots[vi].push([x, this.hillHeight(x, z) - 0.3, z, 0.8 + R() * 0.5]);
      bb++;
    }
    tries = 0;
    while (bb < 3300 && tries++ < 30000) {
      const a = R() * Math.PI * 2;
      // more trees near, and in woods (noise) further out
      const r = 120 + Math.pow(R(), 0.8) * 900;
      const x = this.centre.x + Math.cos(a) * r;
      const z = this.centre.z + Math.sin(a) * r;
      if (inLawn(x, z, 60) || onDrive(x, z)) continue;
      const wood = woodAt(x, z);
      if (wood < 0.47 && R() > 0.12) continue;
      const vi = Math.floor(R() * variants.length);
      const s = 0.8 + R() * 0.5;
      bbSpots[vi].push([x, this.hillHeight(x, z) - 0.3, z, s]);
      bb++;
    }
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    variants.forEach((v, vi) => {
      const list = bbSpots[vi];
      if (!list.length) return;
      const mat = billboardMaterial();
      mat.uniforms.uMap.value = impostors[vi];
      mat.uniforms.uMapBare.value = bareImpostors[vi];
      mat.uniforms.uDay = seasonUniforms.uDay;
      const im = new THREE.InstancedMesh(quad, mat, list.length);
      list.forEach(([x, y, z, s], i) => {
        m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(v.width * s, v.height * s, 1));
        im.setMatrixAt(i, m);
      });
      im.frustumCulled = false;
      this.group.add(im);
      this.billboards.push(mat);
    });
    this.stats.billboards = bb;

    if (this.drive) this.group.add(this._makeDriveOn());
    // (the leaf pictures, for the garden's shrubs: garden.js)
    this.leafMaps = { oak: variants[0].leaves.map, ash: variants[2].leaves.map, bush: bushes[0].leaves.map };

    this.stats.ms = Math.round(performance.now() - t0);
    for (const v of [...variants, ...bushes, ...entrance]) v.tree.clear();
    return this.stats;
  }

  /** The height of the ground (or whatever lies on it) at x, z, or null if there is none. */
  groundHeight(x, z) {
    const top = this.hillHeight(x, z) + 6;
    this._gRay = this._gRay ?? new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    this._gRay.origin.set(x, top, z);
    const hit = this.bvh.raycastFirst(this._gRay, THREE.DoubleSide, 0, 14);
    return hit ? hit.point.y : null;
  }

  /** The front gate: where the drive meets the front wall. */
  _findGate() {
    if (!this.drive) return null;
    const x = (this.drive.x0 + this.drive.x1) / 2;
    // the wall beside the gateway, found from outside
    const ray = new THREE.Ray(new THREE.Vector3(x + 3.6, 1, this.lawn.max.z), new THREE.Vector3(0, 0, -1));
    const hit = this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, 80);
    return hit ? { x, z: hit.point.z } : null;
  }

  _findDrive() {
    // where the gravel meets the south edge of the estate
    const z = this.lawn.max.z - 0.4;
    let x0 = null;
    let x1 = null;
    const rc = new THREE.Raycaster();
    const gravel = this._surfaces.filter((o) => o.material.name === 'cm_gravel');
    for (let x = this.lawn.min.x; x <= this.lawn.max.x; x += 0.25) {
      rc.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
      if (rc.intersectObjects(gravel, false).length) {
        if (x0 === null) x0 = x;
        x1 = x;
      }
    }
    return x0 === null ? null : { x0, x1, z, material: gravel[0]?.material };
  }

  _makeDriveOn() {
    const d = this.drive;
    const len = 1600;
    const geo = new THREE.PlaneGeometry(d.x1 - d.x0 + 0.3, len, 1, 64).rotateX(-Math.PI / 2);
    geo.translate((d.x0 + d.x1) / 2, 0, d.z + len / 2 - 0.2);
    // follow the hills, and use metres for the texture
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, this.hillHeight(p.getX(i), p.getZ(i)) + 0.03);
      uv.setXY(i, p.getX(i) / 4, -p.getZ(i) / 4);
    }
    geo.computeVertexNormals();
    const mat = d.material.clone();
    if (mat.map) {
      mat.map = mat.map.clone();
      mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
      mat.map.needsUpdate = true;
    }
    mat.normalMap = null;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    // (a clone doesn't keep the gravel's shader patches)
    gravelShader(mat);
    snowShader(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'Drive';
    return mesh;
  }

  update(dt, tod) {
    this.wind.time.value += dt;
    // billboards carry baked daylight: dim them with the sky
    const k = THREE.MathUtils.clamp(tod.hemi.intensity * 1.1 + tod.light.intensity * 0.12, 0.03, 1.15);
    for (const m of this.billboards) m.uniforms.uLight.value.setScalar(k);
  }
}
