// The indoor pool's light. Under the water the floor and walls of the basin catch moving
// caustics (the bright net of light a rippling surface focuses onto the bottom) and take
// on a blue-green tint that deepens with depth. Above it, the light the water throws back
// plays faintly on the walls and the ceiling round the pool. At night an underwater light
// lights the pool from below. It is one shader patch, on every material in the pool hall,
// limited to the hall by position (the same materials are used elsewhere in the house).

import * as THREE from 'three';

export const poolUniforms = {
  uPoolTime: { value: 0 },
  uPoolWater: { value: new THREE.Vector4(0, 0, 0, 0) }, // basin min x, min z, max x, max z
  uPoolLevel: { value: 0 }, // the water's height
  uPoolFloor: { value: 0 }, // the floor of the basin
  uPoolHall: { value: new THREE.Vector4(0, 0, 0, 0) }, // the hall round it: min x, min z, max x, max z
  uPoolLight: { value: 1 }, // how much light is falling on the water (daylight, or the pool light at night)
  uPoolDebug: { value: 0 }, // 1: draw the caustic itself, unlit (for checking it)
};

const POOL_GLSL = /* glsl */ `
  uniform float uPoolTime;
  uniform vec4 uPoolWater;
  uniform float uPoolLevel;
  uniform float uPoolFloor;
  uniform vec4 uPoolHall;
  uniform float uPoolLight;
  uniform float uPoolDebug;
  varying vec3 vPoolWorld;
  float poolDbg = -1.0;
  // a water caustic: the bright web of light a rippling surface focuses onto the bottom.
  // Made from the edges of drifting cells (the distance to the nearest point and the next
  // nearest are nearly equal along an edge), wobbled a little so the lines wave.
  vec2 poolHash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float poolNet(vec2 q, float t) {
    q += 0.16 * vec2(sin(q.y * 2.1 + t * 1.3), cos(q.x * 1.9 - t * 1.1));
    vec2 g = floor(q);
    vec2 f = fract(q);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 h = poolHash(g + o);
        vec2 pt = o + 0.5 + 0.4 * sin(t * (0.5 + 0.7 * h) + 6.2831 * h);
        float d = length(pt - f);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
    }
    return pow(1.0 - smoothstep(0.0, 0.2, d2 - d1), 2.5);
  }
  float poolCaustic(vec2 q, float t) {
    return clamp(poolNet(q, t) * 0.85 + poolNet(q * 1.43 + 5.3, t * 1.27 + 2.0) * 0.3, 0.0, 1.0);
  }
`;

const POOL_FRAGMENT = /* glsl */ `
  {
    vec3 pp = vPoolWorld;
    bool inHall = pp.x > uPoolHall.x && pp.x < uPoolHall.z && pp.z > uPoolHall.y && pp.z < uPoolHall.w && pp.y > uPoolFloor - 0.2 && pp.y < uPoolLevel + 9.0;
    if (inHall) {
      vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
      bool inBasin = pp.x > uPoolWater.x - 0.05 && pp.x < uPoolWater.z + 0.05 && pp.z > uPoolWater.y - 0.05 && pp.z < uPoolWater.w + 0.05;
      float t = uPoolTime * 0.55;
      if (inBasin && pp.y < uPoolLevel - 0.01) {
        // under the water: deeper is bluer, and the caustics (sharper in the shallows)
        float depth = clamp((uPoolLevel - pp.y) / max(uPoolLevel - uPoolFloor, 0.5), 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.74, 0.84), 0.35 + 0.5 * depth);
        // on the floor the pattern lies flat; on the walls it is drawn out down the tiles
        vec2 cp = abs(wn.y) > 0.5 ? pp.xz * 2.1 : vec2(pp.x + pp.z, pp.y * 0.6) * 2.1;
        // (two nets at different scales and speeds, as a real pool's surface makes)
        float c = poolCaustic(cp, t);
        poolDbg = c;
        // the light is focused into the lines: bright lines, the floor between them dimmer
        float L = clamp(uPoolLight, 0.0, 1.2);
        float k = (1.0 - 0.45 * depth) * L;
        diffuseColor.rgb = diffuseColor.rgb * (mix(1.0, 0.45, min(L, 1.0)) + c * 1.8 * k) + vec3(0.7, 0.88, 0.92) * c * 0.5 * k;
      } else if (pp.y > uPoolLevel - 0.02) {
        // above it: the light thrown back by the water, on walls facing the pool and on the ceiling
        vec2 nearest = clamp(pp.xz, uPoolWater.xy, uPoolWater.zw);
        vec3 toWater = vec3(nearest.x, uPoolLevel, nearest.y) - pp;
        float dist = length(toWater);
        float faces = max(dot(wn, normalize(toWater + vec3(0.0, 0.001, 0.0))), 0.0);
        float near = 1.0 - smoothstep(0.5, 7.5, dist);
        float c = poolCaustic(pp.xz * 1.2 + pp.y * 0.4, t * 0.8);
        diffuseColor.rgb *= 1.0 + c * 1.5 * near * faces * uPoolLight;
      }
    }
  }
`;

/** Puts the pool light on a material (it only acts inside the pool hall). */
export function poolShader(material) {
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    Object.assign(shader.uniforms, poolUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPoolWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPoolWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + POOL_GLSL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + POOL_FRAGMENT)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uPoolDebug > 0.5 && poolDbg >= 0.0) gl_FragColor = vec4(vec3(poolDbg), 1.0);');
  };
  const key = material.customProgramCacheKey?.call(material) ?? '';
  material.customProgramCacheKey = () => `${key}+pool`;
  material.needsUpdate = true;
}

/**
 * Finds the pool from its water, sets the uniforms, patches the materials in the hall and
 * adds the underwater light (on with the lamps). Returns the light, or null if there is no pool.
 */
export function setupPool(model, water) {
  const surface = water?.surfaces.find((s) => !s.outdoor);
  if (!surface) return null;
  const b = surface.box;
  poolUniforms.uPoolWater.value.set(b.min.x, b.min.z, b.max.x, b.max.z);
  poolUniforms.uPoolLevel.value = b.max.y;
  // the floor: straight down from the middle of the water
  const meshes = [];
  model.traverse((o) => o.isMesh && !/water/i.test(o.material.name || '') && meshes.push(o));
  const centre = b.getCenter(new THREE.Vector3());
  const hit = new THREE.Raycaster(new THREE.Vector3(centre.x, b.max.y - 0.05, centre.z), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes, false)[0];
  poolUniforms.uPoolFloor.value = hit ? hit.point.y : b.max.y - 2.4;
  // the hall round it
  const hall = new THREE.Box3(new THREE.Vector3(b.min.x - 4.5, b.max.y - 3, b.min.z - 3.2), new THREE.Vector3(b.max.x + 4.5, b.max.y + 9, b.max.z + 3.2));
  poolUniforms.uPoolHall.value.set(hall.min.x, hall.min.z, hall.max.x, hall.max.z);
  const done = new Set();
  const v = new THREE.Vector3();
  for (const m of meshes) {
    if (done.has(m.material) || m.material.transparent) continue;
    const p = m.geometry.attributes.position;
    m.updateWorldMatrix(true, false);
    for (let i = 0; i < p.count; i += 7) {
      if (hall.containsPoint(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld))) {
        done.add(m.material);
        poolShader(m.material);
        break;
      }
    }
  }
  // a light under the water, for the evening
  const light = new THREE.PointLight(0x7fe6ff, 0, 10, 2);
  light.position.set(centre.x, poolUniforms.uPoolFloor.value + 0.6, centre.z);
  return { light, materials: done.size };
}
