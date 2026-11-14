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
export const GRASS_TINT = new THREE.Color(3.4, 1.68, 1.38);
const BRICK_TINT = new THREE.Color(0.623, 0.25, 0.075);

export const TINTS = [
  [/^cm_grass$/, GRASS_TINT],
  [/^cm_brickwall/, BRICK_TINT],
  [/^cm_assault_bricks_red/, BRICK_TINT],
  [/^cm_roof$/, new THREE.Color(1.32, 1.08, 0.8), { roughness: 0.95 }],
  [/^cm_gravel$/, new THREE.Color(1.9, 1.28, 0.64)],
  // the course's crates: TRJTA's are a warm, sandy pine, not the grey-white of driftwood
  [/^cm_assault_(box_straight|box_corners|box_pulp|climb)$/, new THREE.Color(0.62, 0.43, 0.25)],
  // the stone dressings: warm sandstone, as in the renders, rather than near-white
  [/^cm_whitestone_(0|1|3|6|7|bumpy|sepia)$/, new THREE.Color(0.97, 0.88, 0.7)],
  // the hall's black and white floor: a waxed marble, not a mirror for the blue sky outside
  [/^cm_int_floor_checker$/, new THREE.Color(1, 0.98, 0.95), { roughness: 0.5, envMapIntensity: 0.45 }],
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
    if (!/^cm_(grass|water|glass)/.test(name) && !o.material.transparent) weatherShader(o.material, shellKind(name));
  });
}

// --- the house's shell (Two hundred years empty, The house going up: shell.js) -----------------
// What each of the model's materials is, for cutting the house down to a ruin or a building site:
// 1 brick and stone, 2 the roof, 3 the rooms' walls, floors and ceilings, 4 furniture and things,
// 5 the assault course, 6 window frames and the white woodwork, 7 the fountain's statue, 8 beams,
// 9 the model's own ivy, 10 doors, 11 gravel (on the ground, and on the house's flat roofs), 12 the
// ceilings, 13 the paintings and the tapestry; 0 the rest, which no mode touches.
export function shellKind(name) {
  if (name === 'cm_gravel') return 11;
  if (/^cm_int_ceiling/.test(name)) return 12;
  if (/^cm_whitestone_sepia_int|^cm_int_|^cm_pool_skylight/.test(name)) return 3;
  if (/^cm_assault_/.test(name)) return 5;
  if (/^cm_(brickwall|whitestone)/.test(name)) return 1;
  if (name === 'cm_roofpattern') return 1; // (the gabled bay's patterned gable: masonry)
  if (/^cm_roof/.test(name)) return 2;
  if (/^cm_obj_(painting|tapestry)/.test(name)) return 13; // (the pictures on the walls)
  if (/^cm_obj_/.test(name)) return 4;
  if (/^cm_(whitewood|window_grid)/.test(name)) return 6;
  if (/^cm_fishstatue/.test(name)) return 7;
  if (/^cm_wood_beam/.test(name)) return 8;
  if (/^Ivy/i.test(name)) return 9;
  if (/^cm_door_/.test(name)) return 10;
  return 0;
}

/** 0: the house as it is; 1: a ruin, two hundred years on; 2: going up; 3: a hundred years empty. */
let shellMode = 0;
const shellMaterials = new Set();
const shellDepth = new Map(); // kind -> the shadow's depth material for that kind in this mode
export function getShellMode() {
  return shellMode;
}
/** Switches the house's materials to a mode (they recompile: only the mode's code is in them). */
export function setShellMode(mode) {
  if (mode === shellMode) return;
  shellMode = mode;
  for (const m of shellMaterials) {
    // (the spaces the model never fitted out have walls of one face, seen only from outside: with
    // the roof off you see them from inside too)
    if (m.userData.shellSide === undefined) m.userData.shellSide = m.side;
    m.side = mode ? THREE.DoubleSide : m.userData.shellSide;
    m.needsUpdate = true;
  }
  for (const d of shellDepth.values()) d.dispose();
  shellDepth.clear();
}

/** The world-space hash and noise the modes cut by: the same numbers in shell.js's JavaScript. */
export const SHELL_NOISE_GLSL = /* glsl */ `
  uniform vec4 uHoles[4];
  uniform vec4 uBreach;
  varying float vOnRoof;
  float sHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float sNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(sHash(i), sHash(i + vec2(1, 0)), u.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), u.x), u.y);
  }
  bool sInHouse(vec3 p) { return p.x > -15.8 && p.x < 29.8 && p.z > -33.3 && p.z < -8.7; }
  // how high the ruin's walls still stand here: stumps in the breaches, gables nearly whole
  float ruinTop(vec2 xz) {
    float a = smoothstep(0.2, 0.8, sNoise(xz * 0.085 + vec2(3.1, 1.7)));
    float b = sNoise(xz * 0.29 + vec2(7.7, 2.3));
    // and breaches: a few metres wide, where a stretch of wall has come down to the ground floor's windows
    float breach = smoothstep(0.6, 0.78, sNoise(xz * 0.21 + vec2(11.3, 4.1)));
    return max(0.6, 1.3 + pow(a, 1.5) * 12.5 + (b - 0.5) * 2.4 - breach * 7.0);
  }
  // how far the walls are up: the west and the middle to the eaves, the east wing a storey high,
  // racked back in steps between them
  float buildTop(vec2 xz) {
    if (xz.x < 9.5) return 40.0;
    return max(4.2, floor((9.6 - (xz.x - 9.5) * 1.25) / 0.3) * 0.3);
  }
  // a hundred years: is this inside one of the places where the roof has fallen in (scale < 1: nearer its middle)
  bool inHole(vec2 xz, float scale) {
    for (int i = 0; i < 4; i++) {
      vec4 h = uHoles[i];
      if (h.z <= 0.0) continue;
      float d = length(xz - h.xy) / (h.z * scale);
      if (d + (sNoise(xz * 1.6 + float(i) * 7.0) - 0.5) * 0.45 < 1.0) return true;
    }
    return false;
  }
  // and the corner of the house that has come down: how high the walls stand there (a bowl)
  float breachTop(vec2 xz) {
    if (uBreach.z <= 0.0) return 99.0;
    float d = length(xz - uBreach.xy) / uBreach.z;
    if (d >= 1.0) return 99.0;
    return uBreach.w + d * d * 9.0 + (sNoise(xz * 2.3) - 0.5) * 0.8;
  }
  // the grounds: the fountain broken (its rim gapped, the dolphin's top gone) and the estate's walls
  // fallen in stretches; 'how' 1 two hundred years, 0.5 a hundred
  bool groundsGone(vec3 sp, int k, float how) {
    vec2 f = sp.xz - vec2(4.59, 8.28);
    float fd = length(f);
    if (fd < 4.3 && sp.y < 5.0) {
      if (k == 7 && sp.y > mix(4.3, 3.1, (how - 0.5) * 2.0)) return true;
      if (k == 1 && sp.y > 0.22) {
        float a = atan(f.y, f.x);
        float n = sNoise(vec2(a * 2.6 + 3.0, sp.y * 1.7 + fd * 0.6));
        if (n > mix(0.8, 0.6, (how - 0.5) * 2.0)) return true;
      }
      return false;
    }
    if (k != 1 || sInHouse(sp)) return false;
    float jag = 0.25 * (sHash(vec2(floor((sp.x + sp.z) * 4.4), floor(sp.y * 13.3))) - 0.5);
    if (how > 0.75) return sp.y > 0.35 + 2.8 * smoothstep(0.28, 0.72, sNoise(sp.xz * 0.11 + vec2(1.3, 8.2))) + jag;
    return sNoise(sp.xz * 0.15 + vec2(6.1, 2.2)) > 0.76 && sp.y > 0.6 + jag;
  }
`;

/** The cut: discards what is gone (a ruin, a hundred years on) or not built yet (going up). */
function shellCut(mode) {
  if (mode === 1)
    return /* glsl */ `
    {
      vec3 sp = vWxWorld;
      float sny = abs(normalize(cross(dFdx(sp), dFdy(sp))).y);
      int k = int(uKind + 0.5);
      if (k == 5) discard; // (the assault course: rotted away)
      if (sInHouse(sp)) {
        float top = ruinTop(sp.xz) + 0.32 * (sHash(vec2(floor((sp.x + sp.z) * 4.4), floor(sp.y * 13.3))) - 0.5);
        if (k == 2 || k == 4 || k == 6 || k == 8 || k == 10 || k == 12 || k == 13 || vOnRoof > 0.5) discard; // the roof and all on it, the furniture, the windows and doors, the beams, the ceilings: gone
        if (k == 11 && sp.y > 1.0) discard; // (and the flat roofs, gravelled)
        // the sloping ceilings under the roof and the stairs' undersides above the first steps
        if (k == 3 && sny > 0.3 && sny < 0.97 && sp.y > 1.2) discard;
        if ((k == 1 || k == 9 || k == 0) && sp.y > top) discard; // (whatever else stood up there, with the walls)
        // no floor left above the ground floor's (the stairs broken off a few steps up), nothing of the
        // rooms upstairs: the walls' inner faces no higher than their outer ones
        if (k == 3 && (sny > 0.7 ? sp.y > 1.2 : sp.y > min(top - 0.05, 3.1))) discard;
      }
      if (groundsGone(sp, k, 1.0)) discard;
    }`;
  if (mode === 2)
    return /* glsl */ `
    {
      vec3 sp = vWxWorld;
      float sny = abs(normalize(cross(dFdx(sp), dFdy(sp))).y);
      int k = int(uKind + 0.5);
      if (k == 5 || k == 9) discard; // (no assault course yet, no ivy)
      if (k == 7) discard; // (nor the fountain's dolphin)
      if (sInHouse(sp)) {
        float top = buildTop(sp.xz);
        // the top course toothed: every other brick not laid yet
        if (sp.y > top - 0.075 && sHash(vec2(floor((sp.x + sp.z) / 0.225), floor(sp.y / 0.075))) > 0.5) discard;
        if (sp.y > top) discard;
        if (k == 4 || k == 10 || k == 12 || k == 13) discard; // no furniture, no doors hung, no ceilings
        if (k == 3 && sny > 0.3 && sny < 0.97) discard; // (nor the attics' sloping ones)
        if (k == 6 && sp.x > -2.0) discard; // window frames only in at the west end
        // the roof slated at the west end only, course by course, ragged where the slaters have got to;
        // its ridge stones and copings with it
        if (k == 2 && sp.x > -2.0 + 0.7 * sHash(vec2(floor(sp.y / 0.23), 3.0))) discard;
        if (vOnRoof > 0.5 && sp.x > -2.0) discard;
        if (k == 11 && sp.y > 1.0 && sp.x > -2.0) discard; // (the flat roofs, likewise)
        // no floorboards laid upstairs, no ceilings, no partitions up there yet
        if (k == 3 && sny > 0.7 && sp.y > 2.2) discard;
        if (k == 3 && sny <= 0.3 && sp.y > 3.1) discard;
      }
    }`;
  if (mode === 3)
    return /* glsl */ `
    {
      vec3 sp = vWxWorld;
      float sny = abs(normalize(cross(dFdx(sp), dFdy(sp))).y);
      int k = int(uKind + 0.5);
      if (k == 5) discard; // (the assault course: rotted away)
      if (sInHouse(sp)) {
        if (k == 13) discard; // the paintings taken down (they are in the hall, under sheets)
        // where the roof has fallen in: the roof, what was on it, the attics' slopes; under it the
        // floors and ceilings and whatever stood on them, gone down to the ground floor
        bool hole = inHole(sp.xz, 1.0);
        if (hole && (k == 2 || vOnRoof > 0.5 || (k == 3 && sny > 0.3 && sny < 0.97) || (k == 11 && sp.y > 1.0))) discard;
        if (inHole(sp.xz, 0.85) && sp.y > 2.2 && (k == 12 || k == 4 || k == 8 || (k == 3 && sny > 0.7))) discard;
        // the corner that came down
        if (sp.y > breachTop(sp.xz) && k != 0 && k != 7) discard;
      }
      if (groundsGone(sp, k, 0.5)) discard;
    }`;
  return '';
}

/** The look of what is left: earth and moss on the ruin's floors; bare brick and earth going up. */
function shellLook(mode) {
  if (mode === 1 || mode === 3)
    return /* glsl */ `
    if (sInHouse(vWxWorld)) {
      vec3 sp = vWxWorld;
      int k = int(uKind + 0.5);
      vec3 sn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
      float n1 = sNoise(sp.xz * 1.3);
      float n2 = sNoise(sp.xz * 5.1 + 2.0);
      float how = ${mode === 1 ? '1.0' : '0.45'};
      // the ground floor gone to earth, moss and nettles${mode === 3 ? ' (a hundred years: only where the roof is open over it)' : ''}
      if (k == 3 && sn.y > 0.7 && sp.y < 2.2 ${mode === 3 ? '&& inHole(sp.xz, 1.1)' : ''}) diffuseColor.rgb = mix(vec3(0.17, 0.13, 0.08), vec3(0.11, 0.15, 0.05), smoothstep(0.3, 0.7, n1)) * (0.75 + 0.5 * n2);
      // everything left: black-green, lichen in blotches
      diffuseColor.rgb *= 1.0 - how * (0.22 - 0.2 * n2);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.14, 0.05) * (0.8 + 0.4 * n2), how * 0.35 * smoothstep(0.4, 0.8, sNoise(sp.xz * 0.6 + sp.y * 0.4)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.57, 0.45), how * 0.25 * smoothstep(0.72, 0.9, sNoise(sp.xz * 3.0 + sp.y * 2.3)));
    }`;
  if (mode === 2)
    return /* glsl */ `
    if (int(uKind + 0.5) == 11) roughnessFactor = 1.0; // (the drive is mud, not a sheen)
    if (sInHouse(vWxWorld)) {
      vec3 sp = vWxWorld;
      int k = int(uKind + 0.5);
      vec3 sn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
      if (k == 3) {
        if (sn.y > 0.7) {
          // the ground floor: trodden earth, sand and sawdust
          float n = sNoise(sp.xz * 1.7);
          diffuseColor.rgb = mix(vec3(0.3, 0.22, 0.14), vec3(0.55, 0.46, 0.32), smoothstep(0.35, 0.75, n)) * (0.8 + 0.3 * sNoise(sp.xz * 9.0));
        } else if (sn.y > -0.7) {
          // the rooms' walls: bare brick in lime mortar, not plastered yet
          float along = dot(sp.xz, vec2(abs(sn.z), abs(sn.x)));
          float row = floor(sp.y / 0.075);
          float bx = fract((along + mod(row, 2.0) * 0.1125) / 0.225);
          float by = fract(sp.y / 0.075);
          float mortar = max(step(bx, 0.03), step(by, 0.1));
          float h = sHash(vec2(floor((along + mod(row, 2.0) * 0.1125) / 0.225), row));
          vec3 brick = mix(vec3(0.2, 0.06, 0.03), vec3(0.34, 0.12, 0.06), h) * (0.8 + 0.3 * sNoise(sp.xz * 3.0 + sp.y));
          diffuseColor.rgb = mix(brick, vec3(0.45, 0.4, 0.33), mortar * 0.85);
          // (far off, where a pixel spans several bricks, their average, not a shimmer)
          float aa = clamp(max(fwidth(along / 0.225), fwidth(sp.y / 0.075)) * 1.5 - 0.3, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.13, 0.07), aa);
          roughnessFactor = 0.95;
        }
      }
      // lime splashed up the foot of the walls
      if (k == 1) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.47, 0.42), (1.0 - smoothstep(0.0, 0.35, sp.y)) * 0.35 * smoothstep(0.45, 0.75, sNoise(sp.xz * 4.0 + sp.y * 3.0)));
    }`;
  return '';
}

/** The shell's uniforms, shared by every material that cuts. */
function shellUniforms(shader, kind) {
  shader.uniforms.uKind = { value: kind };
  shader.uniforms.uHoles = seasonUniforms.uHoles;
  shader.uniforms.uBreach = seasonUniforms.uBreach;
}
const ON_ROOF_VERTEX = ['#include <common>', '#include <common>\nattribute float aOnRoof;\nvarying float vOnRoof;'];

/**
 * The shadow's depth material for a kind in the mode now: the same cut, so the walls that are gone
 * cast no shadow. (None while the house is whole.)
 */
export function shellDepthMaterial(kind) {
  if (!shellMode || !kind) return undefined;
  let d = shellDepth.get(kind);
  if (d) return d;
  const mode = shellMode;
  d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  d.onBeforeCompile = (shader) => {
    shellUniforms(shader, kind);
    shader.vertexShader = shader.vertexShader
      .replace(ON_ROOF_VERTEX[0], ON_ROOF_VERTEX[1] + '\nvarying vec3 vWxWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvOnRoof = aOnRoof;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxWorld;\nuniform float uKind;\n' + SHELL_NOISE_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + shellCut(mode));
  };
  d.customProgramCacheKey = () => `shell-depth-${mode}`;
  shellDepth.set(kind, d);
  return d;
}

const GRASS_GLSL = /* glsl */ `
  varying vec3 vGrassWorld;
  uniform vec3 uGrassTint;
  uniform float uSnow;
  uniform float uWet;
  uniform float uDecay;
  uniform float uBuild;
  uniform float uRuin;
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
    shader.uniforms.uDecay = seasonUniforms.uDecay;
    shader.uniforms.uBuild = seasonUniforms.uBuild;
    shader.uniforms.uRuin = seasonUniforms.uRuin;
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
         // fifty years unmown: rank grass gone to seed, straw and dark tussocks in big drifts
         if (uDecay > 0.001) {
           float rank = smoothstep(0.25, 0.75, gFbm(gw * 0.07 + 1.7));
           vec3 seed = mix(vec3(0.7, 0.76, 0.58), vec3(0.98, 0.9, 0.68), rank) * (0.8 + 0.3 * gFbm(gw * 0.9 + 4.0));
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * seed, uDecay);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(1.0, 0.97, 0.8) * 0.9, 0.35 * uDecay * (1.0 - 0.8 * uRuin));
           // two hundred years: a wood floor, green in summer, dark under the trees
           diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.72, 0.5) * (0.8 + 0.4 * gFbm(gw * 0.4)), uRuin);
         }
         // going up: the ground round the house churned to mud by carts and boots, ruts and puddles,
         // trampled grass further out, the fields beyond as they were
         if (uBuild > 0.001) {
           float d = length((gw - vec2(4.0, -21.0)) / vec2(1.0, 1.25));
           float site = 1.0 - smoothstep(22.0, 44.0, d + (gFbm(gw * 0.08) - 0.5) * 18.0);
           float mudN = gFbm(gw * 0.5 + 3.0);
           // (linear light: a wet brown-grey, drying paler in patches)
           vec3 mud = mix(vec3(0.075, 0.055, 0.038), vec3(0.17, 0.13, 0.085), smoothstep(0.3, 0.75, mudN)) * (0.75 + 0.45 * gFbm(gw * 3.1));
           mud = mix(mud, vec3(0.045, 0.04, 0.032), smoothstep(0.62, 0.75, gFbm(gw * 0.9 + 5.0)) * 0.7); // (puddled, darker)
           // ruts: the carts' wheels, two lines down from the gate and round the house
           float rut = smoothstep(0.08, 0.0, abs(fract((gw.x + sin(gw.y * 0.05) * 4.0) / 1.6) - 0.5) - 0.38) * step(abs(gw.x - 4.5), 4.0);
           mud *= 1.0 - 0.35 * rut;
           float bare = site * smoothstep(0.35, 0.7, gFbm(gw * 0.21 + 9.0) * 0.6 + site * 0.45);
           diffuseColor.rgb = mix(diffuseColor.rgb * mix(vec3(1.0), vec3(1.05, 0.95, 0.75), site), mud, bare * uBuild);
         }
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
    shader.uniforms.uBuild = seasonUniforms.uBuild;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGravelWorld;\nvarying vec3 vGravelN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vGravelWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vGravelN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGravelWorld;\nvarying vec3 vGravelN;\nuniform float uBuild;\n' + GRASS_GLSL.replace(/uniform[^;]*;|varying[^;]*;/g, ''))
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
             // going up: no gravel laid yet, a track of trodden mud
             gt.rgb = mix(gt.rgb, mix(vec3(0.11, 0.085, 0.06), vec3(0.24, 0.19, 0.13), smoothstep(0.3, 0.7, tone)) * (0.8 + 0.35 * gFbm(gw * 2.7)), uBuild);
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
  uniform float uDecay;
  uniform float uRuin;
  uniform float uKind;
  varying vec3 vWxWorld;
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1, 0)), u.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), u.x), u.y);
  }
  float wFbm(vec2 p) { return wNoise(p) * 0.55 + wNoise(p * 2.13 + 5.2) * 0.3 + wNoise(p * 4.7 - 2.1) * 0.15; }
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
export function weatherShader(material, kind = 0) {
  const before = material.onBeforeCompile;
  if (kind) {
    shellMaterials.add(material);
    material.userData.shellKind = kind;
  }
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    for (const k of ['uSnow', 'uWet', 'uSkyMap', 'uSkyBox', 'uDecay', 'uRuin']) shader.uniforms[k] = seasonUniforms[k];
    const mode = kind ? shellMode : 0;
    shellUniforms(shader, kind);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxWorld;' + (mode ? '\nattribute float aOnRoof;\nvarying float vOnRoof;' : ''))
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;' + (mode ? '\nvOnRoof = aOnRoof;' : ''));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + WEATHER_GLSL + (mode ? SHELL_NOISE_GLSL : ''))
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + shellCut(mode))
      .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       ${shellLook(mode)}
       if (uSnow + uWet > 0.001) {
         vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
         float open = skyOpen(vWxWorld);
         float wet = uWet * open * smoothstep(-0.2, 0.5, wn.y);
         diffuseColor.rgb *= 1.0 - 0.32 * wet;
         roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.3, wet);
         float cover = uSnow * open * smoothstep(0.45, 0.8, wn.y);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), cover);
         roughnessFactor = mix(roughnessFactor, 0.75, cover);
       }
       if (uDecay > 0.001) {
         // Fifty years empty (abandoned.js): grime over everything, darker in blotches; outside,
         // black streaks run down the walls from the sills and copings, green damp climbs from the
         // ground and moss and lichen sit on whatever faces the sky
         vec3 dn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
         vec3 dp = vWxWorld;
         float outside = skyOpen(dp + dn * 0.7);
         // (the ruin has no roof: inside its walls is outside too)
         if (uRuin > 0.5 && dp.x > -15.8 && dp.x < 29.8 && dp.z > -33.3 && dp.z < -8.7) outside = 1.0;
         float blot = wFbm(dp.xz * 0.35 + dp.y * 0.21);
         float grey = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(grey) * vec3(0.96, 0.97, 0.86), 0.5 * uDecay);
         diffuseColor.rgb *= 1.0 - uDecay * (0.22 + 0.3 * blot);
         float wall = 1.0 - smoothstep(0.35, 0.7, abs(dn.y));
         float along = dot(dp.xz, vec2(abs(dn.z), abs(dn.x)));
         float streak = wNoise(vec2(along * 2.6, dp.y * 0.16)) * wNoise(vec2(along * 0.6 + 3.1, dp.y * 0.35 + 1.7));
         diffuseColor.rgb *= 1.0 - uDecay * wall * outside * smoothstep(0.1, 0.45, streak) * 0.62;
         float damp = (1.0 - smoothstep(0.05, 1.3 + blot * 1.6, dp.y)) * wall * outside;
         float up = smoothstep(0.35, 0.75, dn.y) * skyOpen(dp);
         diffuseColor.rgb *= 1.0 - uDecay * 0.3 * up;
         float tops = up * smoothstep(0.45, 0.7, wFbm(dp.xz * 2.4 + 2.0) * 0.6 + wFbm(dp.xz * 0.5 - 1.0) * 0.4);
         float moss = max(damp * (0.55 + 0.45 * wNoise(dp.xz * 3.0 + dp.y)), tops);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.16, 0.055) * (0.75 + 0.6 * wNoise(dp.xz * 7.0 + dp.y * 3.0)), uDecay * moss * 0.8);
         // indoors: dust over the floors and every ledge, the colours gone dull
         float indoors = 1.0 - outside;
         float dust = indoors * smoothstep(0.6, 0.9, dn.y) * (0.55 + 0.35 * wFbm(dp.xz * 1.7));
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.33, 0.29) * (0.8 + 0.3 * blot), uDecay * dust);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.95, 0.9, 0.82), uDecay * indoors * 0.3);
         roughnessFactor = mix(roughnessFactor, 1.0, uDecay * 0.6);
       }`,
    );
  };
  const key = material.customProgramCacheKey?.call(material) ?? '';
  material.customProgramCacheKey = () => `${key}+weather${kind ? '-shell' + shellMode : ''}`;
  material.needsUpdate = true;
}

// (the name it had when it only did snow)
export const snowShader = weatherShader;
