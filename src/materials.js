// Per-material colour tweaks for the outside of the estate, so the grade itself can stay
// close to neutral (interiors look natural) while the lawns, brick and gravel match the
// colours of TRJTA's Lumion renders (measured from them: sunlit lawn about hsl(86°, 36%,
// 40%), brick about hsl(19°, 41%, 53%), gravel a warm beige).
//
// The grass also gets a shader that hides its tiling: from above, one texture repeated
// every few metres reads as a grid (the "theme park" look). Instead the lawn and the
// fields around it sample the texture in world space at two scales turned against each
// other, blend them by noise, and drift between lusher and drier greens over tens of metres.

import * as THREE from 'three';
import { seasonUniforms } from './season.js';

// Calibrated by rendering the view over the gate at 14:00, sampling the lawn, the walls
// and the gravel, and nudging each tint (in linear light) until they matched the render.
// The grass texture is a cool blue-green, so its red is lifted a long way.
export const GRASS_TINT = new THREE.Color(4.09, 1.75, 1.66);
const BRICK_TINT = new THREE.Color(0.623, 0.25, 0.075);

export const TINTS = [
  [/^cm_grass$/, GRASS_TINT],
  [/^cm_brickwall/, BRICK_TINT],
  [/^cm_assault_bricks_red/, BRICK_TINT],
  [/^cm_roof$/, new THREE.Color(1.28, 1.16, 1.0), { roughness: 0.95 }],
  [/^cm_gravel$/, new THREE.Color(1.9, 1.28, 0.64)],
];

export function tuneMaterials(model) {
  const done = new Set();
  model.traverse((o) => {
    if (!o.isMesh || done.has(o.material)) return;
    done.add(o.material);
    const name = o.material.name || '';
    for (const [re, tint, extra] of TINTS) {
      if (!re.test(name)) continue;
      o.material.color.multiply(tint);
      if (extra) Object.assign(o.material, extra);
    }
    if (name === 'cm_grass') grassShader(o.material);
    if (name === 'cm_gravel') gravelShader(o.material);
    if (/^cm_brickwall|^cm_assault_bricks_red/.test(name)) brickShader(o.material);
    // snow and rain on everything outdoors that faces the sky (the sky map keeps it off floors indoors)
    if (!/^cm_(grass|water|glass)/.test(name) && !o.material.transparent) weatherShader(o.material);
  });
}

const GRASS_GLSL = /* glsl */ `
  varying vec3 vGrassWorld;
  uniform vec3 uGrassTint;
  uniform float uSnow;
  uniform float uWet;
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
  }
  float gFbm(vec2 p) { return gNoise(p) * 0.55 + gNoise(p * 2.13 + 5.2) * 0.3 + gNoise(p * 4.7 - 2.1) * 0.15; }
`;

/** Patches a grass material (the lawn's, or the fields') to hide its tiling. */
export function grassShader(material) {
  material.roughness = 0.96; // grass is matt: no sky sheen from above
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTint = seasonUniforms.uGrassTint;
    shader.uniforms.uSnow = seasonUniforms.uSnow;
    shader.uniforms.uWet = seasonUniforms.uWet;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrassWorld;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vGrassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + GRASS_GLSL).replace(
      '#include <map_fragment>',
      `vec2 gw = vGrassWorld.xz;
       #ifdef USE_MAP
         // the same texture at two scales, one turned, blended in blobs of a few metres;
         // each sample is divided by a blurred copy of itself (a coarse mip level) so the
         // light and dark patches inside one tile, which repeat and make the grid, flatten
         // out and only the fine blades are left
         vec2 ua = gw / 5.1;
         vec2 ub = mat2(0.8, -0.6, 0.6, 0.8) * gw / 3.4 + vec2(0.37, 0.11);
         vec3 avg = textureLod(map, ua, 12.0).rgb;
         vec4 ga = texture2D(map, ua);
         vec4 gb = texture2D(map, ub);
         ga.rgb *= avg / max(textureLod(map, ua, 7.0).rgb, vec3(0.02));
         gb.rgb *= avg / max(textureLod(map, ub, 7.0).rgb, vec3(0.02));
         float gm = smoothstep(0.3, 0.7, gFbm(gw * 0.13));
         diffuseColor *= mix(ga, gb, gm);
       #endif
       {
         // drier and lusher patches over tens of metres, and a finer mottle
         float big = gFbm(gw * 0.028 + 7.3);
         float mid = gFbm(gw * 0.21 - 3.1);
         vec3 lush = vec3(0.86, 1.04, 0.86);
         vec3 dry = vec3(1.18, 1.06, 0.7);
         diffuseColor.rgb *= mix(lush, dry, smoothstep(0.2, 0.8, big)) * (0.82 + 0.36 * mid);
         // the season's colour, then snow: patchy as it comes and goes, a blanket at its deepest
         diffuseColor.rgb *= uGrassTint * (1.0 - 0.22 * uWet);
         float cover = smoothstep(0.35, 0.55, gFbm(gw * 0.33) * 0.6 + uSnow * 0.75 - 0.15) * step(0.001, uSnow);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.81, 0.86) * (0.94 + 0.12 * mid), cover);
       }`,
    );
  };
  material.customProgramCacheKey = () => 'grass';
  material.needsUpdate = true;
}

/**
 * Gravel, like the grass: on level ground it is sampled in world space at two scales
 * turned against each other, with each tile's own light and dark patches flattened out,
 * and drifts between warmer and greyer, lighter and darker over a few metres, so the drive
 * doesn't read as a grid from above. Kerbs and edges keep their own mapping.
 */
export function gravelShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGravelWorld;\nvarying vec3 vGravelN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vGravelWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vGravelN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGravelWorld;\nvarying vec3 vGravelN;\n' + GRASS_GLSL.replace(/uniform[^;]*;|varying[^;]*;/g, ''))
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
           vec4 gt;
           if (vGravelN.y > 0.6) {
             vec2 gw = vGravelWorld.xz;
             vec2 ua = gw / 3.3;
             vec2 ub = mat2(0.8, -0.6, 0.6, 0.8) * gw / 2.2 + vec2(0.29, 0.61);
             vec3 avg = textureLod(map, ua, 12.0).rgb;
             vec4 ga = texture2D(map, ua);
             vec4 gb = texture2D(map, ub);
             ga.rgb *= avg / max(textureLod(map, ua, 6.0).rgb, vec3(0.02));
             gb.rgb *= avg / max(textureLod(map, ub, 6.0).rgb, vec3(0.02));
             gt = mix(ga, gb, smoothstep(0.3, 0.7, gFbm(gw * 0.17)));
             // warmer and greyer patches, lighter and darker ones (raked, trodden, damp)
             float warm = gFbm(gw * 0.045 + 3.7);
             float tone = gFbm(gw * 0.23 - 8.1);
             gt.rgb *= mix(vec3(0.94, 0.95, 1.0), vec3(1.06, 1.02, 0.94), smoothstep(0.25, 0.75, warm)) * (0.86 + 0.28 * tone);
           } else {
             gt = texture2D(map, vMapUv);
           }
           diffuseColor *= gt;
         #endif`,
      );
  };
  material.customProgramCacheKey = () => 'gravel';
  material.needsUpdate = true;
}

/**
 * Brick: the tint (the material's colour) goes on the brick faces only. The mortar
 * between them is grey in the texture and stays a light warm grey, so the courses still
 * read, as in the renders.
 */
export function brickShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
         vec4 bt = texture2D(map, vMapUv);
         float bmx = max(bt.r, max(bt.g, bt.b));
         float bmn = min(bt.r, min(bt.g, bt.b));
         float face = smoothstep(0.18, 0.5, (bmx - bmn) / max(bmx, 1e-3));
         diffuseColor.rgb = bt.rgb * mix(vec3(0.92, 0.86, 0.78), diffuseColor.rgb, face);
         diffuseColor.a *= bt.a;
       #endif`,
    );
  };
  material.customProgramCacheKey = () => 'brick';
  material.needsUpdate = true;
}

/**
 * Where the sky reaches: renders the estate once from straight above, keeping the height
 * of the highest surface at each point (2048 x 2048, a few centimetres a texel). A surface
 * is out in the open when it is that highest surface, so snow and rain land on roofs, wall
 * caps, the gate and the ground, but not on floors under a roof, in the porch or under the
 * pool's glass.
 */
export function buildSkyMap(renderer, scene, meshes, box) {
  const S = 2048;
  const rt = new THREE.WebGLRenderTarget(S, S, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const cam = new THREE.OrthographicCamera(box.min.x, box.max.x, -box.min.z, -box.max.z, 0.1, 400);
  cam.position.set(0, 200, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  const LAYER = 7;
  cam.layers.set(LAYER);
  for (const m of meshes) m.layers.enable(LAYER);
  const height = new THREE.ShaderMaterial({
    vertexShader: 'varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying float vY; void main() { gl_FragColor = vec4(vY, 0.0, 0.0, 1.0); }',
    side: THREE.DoubleSide,
  });
  const prev = { target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), shadow: renderer.shadowMap.autoUpdate, override: scene.overrideMaterial, bg: scene.background, fog: scene.fog };
  renderer.shadowMap.autoUpdate = false;
  scene.overrideMaterial = height;
  scene.background = null;
  scene.fog = null;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(new THREE.Color(-1000, 0, 0), 1);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev.target);
  renderer.setClearColor(prev.clear, prev.alpha);
  renderer.shadowMap.autoUpdate = prev.shadow;
  scene.overrideMaterial = prev.override;
  scene.background = prev.bg;
  scene.fog = prev.fog;
  for (const m of meshes) m.layers.disable(LAYER);
  height.dispose();
  seasonUniforms.uSkyMap.value = rt.texture;
  seasonUniforms.uSkyBox.value.set(box.min.x, box.max.z, box.max.x - box.min.x, box.max.z - box.min.z);
  return rt;
}

const WEATHER_GLSL = /* glsl */ `
  uniform float uSnow;
  uniform float uWet;
  uniform sampler2D uSkyMap;
  uniform vec4 uSkyBox;
  varying vec3 vWxWorld;
  /** 1 where this point is open to the sky (no roof, porch or glass above it). */
  float skyOpen(vec3 p) {
    vec2 suv = vec2((p.x - uSkyBox.x) / uSkyBox.z, (uSkyBox.y - p.z) / uSkyBox.w);
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) return 1.0;
    return smoothstep(-0.35, -0.08, p.y - texture2D(uSkyMap, suv).r);
  }
`;

/**
 * Weather on a surface: snow where it faces up and the sky reaches it (none on walls,
 * less on steep roof slopes), and in the rain, darker and glossier where it is wet.
 */
export function weatherShader(material) {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    for (const k of ['uSnow', 'uWet', 'uSkyMap', 'uSkyBox']) shader.uniforms[k] = seasonUniforms[k];
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + WEATHER_GLSL).replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       if (uSnow + uWet > 0.001) {
         vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
         float open = skyOpen(vWxWorld);
         float wet = uWet * open * smoothstep(-0.2, 0.5, wn.y);
         diffuseColor.rgb *= 1.0 - 0.32 * wet;
         roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.3, wet);
         float cover = uSnow * open * smoothstep(0.45, 0.8, wn.y);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), cover);
         roughnessFactor = mix(roughnessFactor, 0.75, cover);
       }`,
    );
  };
  const key = material.customProgramCacheKey?.call(material) ?? '';
  material.customProgramCacheKey = () => `${key}+weather`;
  material.needsUpdate = true;
}

// (the name it had when it only did snow)
export const snowShader = weatherShader;
