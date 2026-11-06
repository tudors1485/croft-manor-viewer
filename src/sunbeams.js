// Sunbeams: sunlight scattering in the air indoors, so shafts of light show where the sun
// comes in through the windows (and the window bars show in them).
//
// For each pixel, at half resolution, it steps along the view ray from the camera to the
// first surface (at most 30 m) and asks the sun's shadow map at each step whether that bit
// of air is in sunlight. The sum, weighted to glow more when you look towards the sun
// (forward scattering, Henyey-Greenstein), is blurred and added to the picture before
// tone mapping. It uses the scene depth that the ambient-occlusion pass already renders,
// so it runs on the Balanced and High settings, and only while you are inside by day.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const STEPS = 24;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const marchShader = {
  uniforms: {
    tDepth: { value: null },
    tShadow: { value: null },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uFrame: { value: 0 },
    uMaxDist: { value: 30 },
    uBias: { value: -0.0004 },
    uBoxMin: { value: new THREE.Vector3(-1e5, -1e5, -1e5) },
    uBoxMax: { value: new THREE.Vector3(1e5, 1e5, 1e5) },
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDepth;
    uniform sampler2DShadow tShadow;
    uniform mat4 uShadowMatrix;
    uniform mat4 uProjInv;
    uniform mat4 uCamWorld;
    uniform vec3 uCamPos;
    uniform vec3 uSunDir;
    uniform float uFrame;
    uniform float uMaxDist;
    uniform float uBias;
    uniform vec3 uBoxMin;
    uniform vec3 uBoxMax;
    varying vec2 vUv;
    // interleaved gradient noise: a different start along the ray for neighbouring pixels
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      float d = texture2D(tDepth, vUv).r;
      vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      v /= v.w;
      vec3 world = (uCamWorld * v).xyz;
      vec3 dir = world - uCamPos;
      float len = min(length(dir), uMaxDist);
      dir = normalize(dir);
      float stepLen = len / float(${STEPS});
      float j = fract(ign(gl_FragCoord.xy) + uFrame * 0.618034);
      float lit = 0.0;
      for (int i = 0; i < ${STEPS}; i++) {
        vec3 p = uCamPos + dir * ((float(i) + j) * stepLen);
        vec4 sc = uShadowMatrix * vec4(p, 1.0);
        sc.xyz /= sc.w;
        // only the air in the house: sunlit air outside, seen through a window, made it glow
        bool indoors = all(greaterThan(p, uBoxMin)) && all(lessThan(p, uBoxMax));
        if (indoors && all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) {
          lit += texture(tShadow, vec3(sc.xy, sc.z + uBias));
        }
      }
      float mu = dot(dir, uSunDir);
      const float g = 0.45;
      float phase = (1.0 - g * g) / (12.566 * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
      gl_FragColor = vec4(lit / float(${STEPS}) * len * phase, 0.0, 0.0, 1.0);
    }`,
};

const blurShader = {
  uniforms: { tInput: { value: null }, uStep: { value: new THREE.Vector2() } },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tInput;
    uniform vec2 uStep;
    varying vec2 vUv;
    void main() {
      float s = texture2D(tInput, vUv).r * 0.227;
      s += (texture2D(tInput, vUv + uStep * 1.38).r + texture2D(tInput, vUv - uStep * 1.38).r) * 0.316;
      s += (texture2D(tInput, vUv + uStep * 3.23).r + texture2D(tInput, vUv - uStep * 3.23).r) * 0.07;
      gl_FragColor = vec4(s, 0.0, 0.0, 1.0);
    }`,
};

const compositeShader = {
  uniforms: { tDiffuse: { value: null }, tBeams: { value: null }, uLight: { value: new THREE.Color() } },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBeams;
    uniform vec3 uLight;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // a soft ceiling, so a room full of sunlit air (the pool under its glass roof) doesn't fog over
      float s = texture2D(tBeams, vUv).r;
      gl_FragColor = vec4(c.rgb + uLight * s / (1.0 + s * 2.5), c.a);
    }`,
};

export class SunbeamsPass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera;
    this.light = null; // the sun, a DirectionalLight with a shadow map
    this.depthTexture = null; // the scene depth (set by Quality from the ambient-occlusion pass)
    this.strength = 0; // set each frame: 0 outdoors or at night
    this.box = null; // the house: only air inside it scatters
    const rt = () => new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, format: THREE.RedFormat, depthBuffer: false });
    this.a = rt();
    this.b = rt();
    this.march = new FullScreenQuad(new THREE.ShaderMaterial(marchShader));
    this.blur = new FullScreenQuad(new THREE.ShaderMaterial(blurShader));
    this.composite = new FullScreenQuad(new THREE.ShaderMaterial(compositeShader));
    this._frame = 0;
  }

  setSize(width, height) {
    const w = Math.max(16, Math.round(width / 2));
    const h = Math.max(16, Math.round(height / 2));
    this.a.setSize(w, h);
    this.b.setSize(w, h);
  }

  get active() {
    return this.strength > 0.002 && !!this.light?.shadow?.map?.depthTexture && !!this.depthTexture;
  }

  render(renderer, writeBuffer, readBuffer) {
    const m = this.march.material.uniforms;
    const cam = this.camera;
    m.tDepth.value = this.depthTexture;
    m.tShadow.value = this.light.shadow.map.depthTexture;
    m.uShadowMatrix.value.copy(this.light.shadow.matrix);
    m.uProjInv.value.copy(cam.projectionMatrixInverse);
    m.uCamWorld.value.copy(cam.matrixWorld);
    m.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    m.uSunDir.value.copy(this.light.position).sub(this.light.target.position).normalize();
    m.uBias.value = this.light.shadow.bias;
    m.uFrame.value = this._frame++ % 64;
    if (this.box) {
      m.uBoxMin.value.copy(this.box.min);
      m.uBoxMax.value.copy(this.box.max);
    }
    renderer.setRenderTarget(this.a);
    this.march.render(renderer);

    const b = this.blur.material.uniforms;
    b.tInput.value = this.a.texture;
    b.uStep.value.set(1 / this.a.width, 0);
    renderer.setRenderTarget(this.b);
    this.blur.render(renderer);
    b.tInput.value = this.b.texture;
    b.uStep.value.set(0, 1 / this.a.height);
    renderer.setRenderTarget(this.a);
    this.blur.render(renderer);

    const c = this.composite.material.uniforms;
    c.tDiffuse.value = readBuffer.texture;
    c.tBeams.value = this.a.texture;
    c.uLight.value.copy(this.light.color).multiplyScalar(this.light.intensity * this.strength);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.composite.render(renderer);
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
    for (const q of [this.march, this.blur, this.composite]) {
      q.material.dispose();
      q.dispose();
    }
  }
}
