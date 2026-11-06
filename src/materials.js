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
    if (/^cm_brickwall|^cm_assault_bricks_red/.test(name)) brickShader(o.material);
    if (/^(cm_gravel|cm_roof|cm_roofpattern|cm_assault_gripfloor|cm_assault_sand)$/.test(name)) snowShader(o.material);
  });
}

const GRASS_GLSL = /* glsl */ `
  varying vec3 vGrassWorld;
  uniform vec3 uGrassTint;
  uniform float uSnow;
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
         diffuseColor.rgb *= uGrassTint;
         float cover = smoothstep(0.35, 0.55, gFbm(gw * 0.33) * 0.6 + uSnow * 0.75 - 0.15) * step(0.001, uSnow);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.81, 0.86) * (0.94 + 0.12 * mid), cover);
       }`,
    );
  };
  material.customProgramCacheKey = () => 'grass';
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
 * Snow on surfaces that face the sky (roofs, gravel, the assault course floor): white
 * where the surface is near level, less on steep roof slopes, none on walls.
 */
export function snowShader(material) {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    shader.uniforms.uSnow = seasonUniforms.uSnow;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
           float cover = uSnow * smoothstep(0.45, 0.8, wn.y);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), cover);
           roughnessFactor = mix(roughnessFactor, 0.7, cover);
         }`,
      );
  };
  const key = material.customProgramCacheKey?.call(material) ?? '';
  material.customProgramCacheKey = () => `${key}+snow`;
  material.needsUpdate = true;
}
