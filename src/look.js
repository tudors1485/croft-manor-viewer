// The grade: three's Neutral tone mapping with a warmer white balance and a little
// more saturation, as a custom tone-mapping curve so every material gets it for free
// (no extra render pass). `uniforms` are live: change them and the next frame uses them.

import * as THREE from 'three';

export const grade = {
  saturation: 1.04,
  warmth: 0.03, // + warmer, - cooler
  contrast: 1.04,
};

export function installGrade(renderer) {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  const hook = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (!chunk.includes(hook)) {
    console.warn('custom tone mapping hook not found; using Neutral');
    renderer.toneMapping = THREE.NeutralToneMapping;
    return;
  }
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(
    hook,
    /* glsl */ `
vec3 CustomToneMapping( vec3 color ) {
  // white balance and saturation in linear light, before the curve
  color *= vec3( 1.0 + ${grade.warmth.toFixed(3)}, 1.0, 1.0 - ${(grade.warmth * 1.6).toFixed(3)} );
  float l = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
  color = max( mix( vec3( l ), color, ${grade.saturation.toFixed(3)} ), 0.0 );
  vec3 c = NeutralToneMapping( color );
  // gentle S-curve around mid grey
  c = clamp( ( c - 0.5 ) * ${grade.contrast.toFixed(3)} + 0.5, 0.0, 1.0 );
  return c;
}`,
  );
  renderer.toneMapping = THREE.CustomToneMapping;
}
