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

// Photo mode: depth of field. Each pixel gathers its neighbours on a golden-angle spiral out to
// its own blur size, from how far it is from the focus (the scene's depth, from the occlusion
// pass); a sharper sample behind a blurred one is held back so the background doesn't bleed into
// the foreground. In the scene's own light (before tone mapping), so bright lights bloom into
// round highlights as in a real lens.
const DepthOfField = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
    uFocus: { value: 10 },
    uMaxBlur: { value: 12 },
    uAperture: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear;
    uniform float uFar;
    uniform float uFocus;
    uniform float uMaxBlur;
    uniform float uAperture;
    varying vec2 vUv;
    float distanceAt(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      return (uNear * uFar) / ((uFar - uNear) * z - uFar) * -1.0;
    }
    float blurAt(float d) {
      return clamp(abs(d - uFocus) / max(d, 0.01) * uAperture * 1.6, 0.0, 1.0) * uMaxBlur;
    }
    void main() {
      vec4 centre = texture2D(tDiffuse, vUv);
      float cd = distanceAt(vUv);
      float cs = blurAt(cd);
      vec3 colour = centre.rgb;
      float total = 1.0;
      float radius = 0.5;
      float angle = 0.0;
      for (int i = 0; i < 180; i++) {
        if (radius >= uMaxBlur) break;
        angle += 2.39996323;
        vec2 uv = vUv + vec2(cos(angle), sin(angle)) * uTexel * radius;
        vec3 c = texture2D(tDiffuse, uv).rgb;
        float d = distanceAt(uv);
        float size = blurAt(d);
        if (d > cd) size = clamp(size, 0.0, cs * 2.0);
        float m = smoothstep(radius - 0.5, radius + 0.5, size);
        colour += mix(colour / total, c, m);
        total += 1.0;
        radius += 1.0 / radius;
      }
      gl_FragColor = vec4(colour / total, centre.a);
    }`,
};

// Photo mode: a film look over the finished picture (colour, grain and a vignette).
export const LOOKS = { natural: 'Natural', warm: 'Warm film', faded: 'Faded print', teal: 'Teal and orange', mono: 'Black and white', sepia: 'Sepia' };
const LOOK_IDS = Object.keys(LOOKS);
const FilmLook = {
  uniforms: { tDiffuse: { value: null }, uLook: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform int uLook;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 curve(vec3 c, float k) { return mix(c, c * c * (3.0 - 2.0 * c), k); } // an S-curve: more contrast
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      float grain = 0.0;
      float vig = 0.0;
      if (uLook == 1) { // warm film: warmer, soft blacks, a little more contrast
        c = curve(c, 0.35) * vec3(1.06, 1.0, 0.88) + vec3(0.025, 0.018, 0.0);
        grain = 0.035; vig = 0.35;
      } else if (uLook == 2) { // a faded print: lifted blacks, cool shadows, warm highlights, less colour
        c = mix(vec3(l), c, 0.78);
        c = vec3(0.07, 0.08, 0.1) + c * 0.86;
        c += vec3(0.04, 0.0, -0.03) * smoothstep(0.4, 1.0, l) + vec3(-0.02, 0.01, 0.04) * (1.0 - smoothstep(0.0, 0.4, l));
        grain = 0.03; vig = 0.3;
      } else if (uLook == 3) { // teal and orange: teal shadows, orange skin-tone highlights
        c = curve(c, 0.4);
        c = mix(c, c * vec3(0.8, 1.0, 1.08), 1.0 - smoothstep(0.0, 0.5, l));
        c = mix(c, c * vec3(1.12, 1.0, 0.84), smoothstep(0.45, 1.0, l));
        grain = 0.02; vig = 0.4;
      } else if (uLook == 4) { // black and white, contrasty
        c = curve(vec3(dot(c, vec3(0.25, 0.65, 0.1))), 0.55);
        grain = 0.06; vig = 0.45;
      } else if (uLook == 5) { // sepia, an old print
        float m = curve(vec3(l), 0.3).x;
        c = vec3(0.04, 0.03, 0.01) + m * vec3(1.07, 0.9, 0.68) * 0.94;
        grain = 0.05; vig = 0.55;
      }
      vec2 q = vUv - 0.5;
      c *= 1.0 - vig * smoothstep(0.25, 0.95, dot(q, q) * 2.2);
      c += (hash(floor(vUv * uRes) + fract(uTime) * 91.7) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
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
    // photo mode (main.js): depth of field and a film look, and the settings for them
    this.dof = new ShaderPass(DepthOfField);
    this.dof.enabled = false;
    this.look = new ShaderPass(FilmLook);
    this.look.enabled = false;
    this.photo = { on: false, focus: 10, aperture: 0.5, look: 'natural' };
    this.composer.addPass(this.plain);
    this.composer.addPass(this.ao);
    this.composer.addPass(this.beams);
    this.composer.addPass(this.dof);
    this.composer.addPass(this.output);
    this.composer.addPass(this.fisheyePass);
    this.composer.addPass(this.smaa);
    this.composer.addPass(this.sharpenPass);
    this.composer.addPass(this.look);
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
    const photo = this.photo.on && !this.failed;
    // (photo mode needs the scene's depth for its blur, which the occlusion pass renders)
    const ao = (PRESETS[this.preset].ao || photo) && !this.failed;
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
      // photo mode: the blur from the focus distance, and the film look
      const depth = this.ao.beautyRenderTarget?.depthTexture ?? null;
      this.dof.enabled = photo && ao && !!depth && this.photo.aperture > 0.01;
      if (this.dof.enabled) {
        const u = this.dof.uniforms;
        const size = this.renderer.getDrawingBufferSize(this._size ?? (this._size = new THREE.Vector2()));
        u.tDepth.value = depth;
        u.uTexel.value.set(1 / size.x, 1 / size.y);
        u.uNear.value = this.camera.near;
        u.uFar.value = this.camera.far;
        u.uFocus.value = this.photo.focus;
        u.uAperture.value = this.photo.aperture;
        u.uMaxBlur.value = 14 * (size.y / 1080);
      }
      const look = LOOK_IDS.indexOf(this.photo.look);
      this.look.enabled = photo && look > 0;
      if (this.look.enabled) {
        const u = this.look.uniforms;
        u.uLook.value = look;
        u.uTime.value = (u.uTime.value + dt) % 100;
        this.renderer.getDrawingBufferSize(u.uRes.value);
      }
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
