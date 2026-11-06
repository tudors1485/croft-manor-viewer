// Rendering quality: ambient occlusion (N8AO), anti-aliasing (SMAA), and an adaptive
// resolution that steps down when the frame rate drops (this matters on a Retina screen
// with an integrated GPU) and back up when there is headroom.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { N8AOPass } from 'n8ao';
import { SunbeamsPass } from './sunbeams.js';

// A slight fisheye for the flybys: barrel distortion that keeps the corners in the corners
// (so the middle is magnified a little; the flyby widens its lens to make up for it).
const Fisheye = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      p.x *= uAspect;
      float k = 0.055 * uStrength;
      float corner = uAspect * uAspect + 1.0;
      vec2 q = p * (1.0 + k * dot(p, p)) / (1.0 + k * corner);
      q.x /= uAspect;
      gl_FragColor = texture2D(tDiffuse, q * 0.5 + 0.5);
    }`,
};

// Light sharpening for a picture drawn below the screen's own resolution (the adaptive
// resolution steps down on a busy scene, and the browser then stretches it to fit): each pixel
// is pushed away from the average of its four neighbours, less where the contrast is already
// high, so edges firm up without ringing.
const Sharpen = {
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uAmount: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb;
      vec3 w = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb;
      vec3 mn = min(c.rgb, min(min(n, s), min(e, w)));
      vec3 mx = max(c.rgb, max(max(n, s), max(e, w)));
      // contrast-adaptive: full strength on soft detail, little on edges that are already hard
      float k = uAmount * (1.0 - smoothstep(0.08, 0.45, dot(mx - mn, vec3(0.333))));
      vec3 sharp = c.rgb + (c.rgb - 0.25 * (n + s + e + w)) * k;
      gl_FragColor = vec4(clamp(sharp, mn * 0.9, mx * 1.1 + 0.02), c.a);
    }`,
};

export const PRESETS = {
  high: { label: 'High', ao: true, halfRes: false, maxRatio: 2 },
  balanced: { label: 'Balanced', ao: true, halfRes: true, maxRatio: 1.5 },
  fast: { label: 'Fast', ao: false, halfRes: true, maxRatio: 1 },
};

export class Quality {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.preset = 'balanced';
    this.ratio = Math.min(window.devicePixelRatio, PRESETS.balanced.maxRatio);
    this.minRatio = 0.65;
    this.adaptive = true;
    this._frames = 0;
    this._time = 0;
    this._cooldown = 2;
    this.onResize = null; // called after the drawing buffer changes size

    this.composer = new EffectComposer(renderer);
    this.ao = new N8AOPass(scene, camera, innerWidth, innerHeight);
    patchN8AO(this.ao);
    this.failed = false;
    const c = this.ao.configuration;
    c.aoRadius = 1.2;
    c.distanceFalloff = 1.0;
    c.intensity = 4;
    c.color = new THREE.Color(0x000000);
    c.gammaCorrection = false;
    c.transparencyAware = false;
    // N8AO otherwise turns transparency mode back on every frame whenever any material is
    // transparent (glass, water). That mode draws the scene twice more with the solid objects
    // hidden, which also redraws the sun's shadow map with nothing in it: the sunbeams then
    // saw no shadows at all, and it cost two extra scene renders a frame.
    this.ao.autoDetectTransparency = false;
    this.ao.setQualityMode('Low');
    this.output = new OutputPass();
    this.smaa = new SMAAPass(innerWidth, innerHeight);
    this.plain = new RenderPass(scene, camera); // when there is no ambient occlusion but a fisheye
    this.fisheyePass = new ShaderPass(Fisheye);
    this.sharpenPass = new ShaderPass(Sharpen);
    this.sharpenPass.enabled = false;
    this.fisheye = 0; // 0..1, set by the flybys
    this.beams = new SunbeamsPass(camera); // needs the scene depth, which the occlusion pass renders
    this.beams.enabled = false;
    this.composer.addPass(this.plain);
    this.composer.addPass(this.ao);
    this.composer.addPass(this.beams);
    this.composer.addPass(this.output);
    this.composer.addPass(this.fisheyePass);
    this.composer.addPass(this.smaa);
    this.composer.addPass(this.sharpenPass);
    this.apply();
  }

  set(preset) {
    if (!PRESETS[preset]) return;
    this.preset = preset;
    this.ratio = Math.min(window.devicePixelRatio, PRESETS[preset].maxRatio);
    this.apply();
  }

  apply() {
    const p = PRESETS[this.preset];
    this.ao.configuration.halfRes = p.halfRes;
    if (this.fixed) {
      // a video: exactly this many pixels, whatever the window
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.fixed.w, this.fixed.h, false);
      this.composer.setPixelRatio(1);
      this.composer.setSize(this.fixed.w, this.fixed.h);
    } else {
      this.renderer.setPixelRatio(this.ratio);
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setPixelRatio(this.ratio);
      this.composer.setSize(innerWidth, innerHeight);
      this.sharpenPass.uniforms.uTexel.value.set(1 / (innerWidth * this.ratio), 1 / (innerHeight * this.ratio));
    }
    this.onResize?.();
  }

  /** Render at a fixed size (for a video), or back to the window with null. */
  setFixedSize(w, h) {
    this.fixed = w ? { w, h } : null;
    this.adaptive = !this.fixed;
    this.apply();
  }

  get aspect() {
    return this.fixed ? this.fixed.w / this.fixed.h : innerWidth / innerHeight;
  }

  render(dt) {
    const ao = PRESETS[this.preset].ao && !this.failed;
    const bend = this.fisheye > 0.001;
    if (ao || bend) {
      this.ao.enabled = ao;
      this.plain.enabled = !ao;
      this.beams.depthTexture = this.ao.beautyRenderTarget?.depthTexture ?? null;
      this.beams.enabled = ao && this.beams.active;
      this.fisheyePass.enabled = bend;
      // sharpen when the picture is drawn smaller than the screen and then stretched
      const stretch = this.fixed ? 1 : window.devicePixelRatio / this.ratio;
      this.sharpenPass.enabled = stretch > 1.15;
      this.sharpenPass.uniforms.uAmount.value = THREE.MathUtils.clamp((stretch - 1) * 0.35, 0, 0.5);
      this.fisheyePass.uniforms.uStrength.value = this.fisheye;
      this.fisheyePass.uniforms.uAspect.value = this.aspect;
      try {
        this.composer.render(dt);
      } catch (err) {
        // never leave the page blank: draw directly from now on
        console.error('post-processing failed, drawing without it', err);
        this.failed = true;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      }
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this._adapt(dt);
  }

  _adapt(dt) {
    if (!this.adaptive) return;
    this._cooldown -= dt;
    // (a single long frame, a cut in a flyby or a shader being prepared, says nothing about the
    // frame rate: leave it out)
    if (dt > 0.2) return;
    this._frames++;
    this._time += dt;
    if (this._time < 1) return;
    const fps = this._frames / this._time;
    this._frames = 0;
    this._time = 0;
    if (this._cooldown > 0 || document.hidden) return;
    const max = Math.min(window.devicePixelRatio, PRESETS[this.preset].maxRatio);
    let next = this.ratio;
    // far too slow (a flyby over the whole estate, say): one big step, sized to the shortfall
    if (fps < 26 && this.ratio > this.minRatio) next = Math.max(this.minRatio, this.ratio * THREE.MathUtils.clamp(Math.sqrt(fps / 45), 0.6, 0.88));
    else if (fps < 38 && this.ratio > this.minRatio) next = Math.max(this.minRatio, this.ratio - 0.15);
    else if (fps > 57 && this.ratio < max) next = Math.min(max, this.ratio + 0.1);
    if (next !== this.ratio) {
      this._cooldown = next < this.ratio ? 1.5 : 2.5;
      this.ratio = Math.round(next * 100) / 100;
      this.apply();
    }
  }
}

/**
 * N8AO 2.0.1's half-resolution depth target overrides `texture` to return the whole
 * texture array, which three r187 no longer expects (it reads `texture.mipmaps`).
 * N8AO itself only uses `.textures[0]` and `.textures[1]`, so give that one target
 * back three's normal getter.
 */
function patchN8AO(pass) {
  const fix = () => {
    const t = pass.depthDownsampleTarget;
    if (t && Array.isArray(t.texture)) {
      Object.defineProperty(t, 'texture', {
        configurable: true,
        get() {
          return this.textures[0];
        },
      });
    }
  };
  const original = pass.configureHalfResTargets.bind(pass);
  pass.configureHalfResTargets = () => {
    original();
    fix();
  };
  fix();
}
