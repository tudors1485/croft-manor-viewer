// Reflective water: a planar mirror for the nearest visible water surface,
// distorted by procedural ripples and blended in by a Fresnel term.
// Mirror maths after three.js's Reflector (oblique near-plane clipping).

import * as THREE from 'three';
import { seasonUniforms } from './season.js';

const RIPPLE_GLSL = /* glsl */ `
uniform sampler2D uMirror;
uniform float uMirrorOn;
uniform float uTime;
uniform float uRipple;
uniform float uDepthTint;
uniform float uIce;
uniform float uSnowOnIce;
varying vec4 vMirrorCoord;
varying vec3 vWaterWorld;

// gradient of a small sum of travelling waves plus finer cross ripples
vec2 waterSlope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 d = normalize(vec2(cos(fi * 2.39 + 0.4), sin(fi * 2.39 + 0.4)));
    float freq = 1.6 + fi * 1.7;
    float amp = 0.05 / (1.0 + fi * 0.8);
    float ph = dot(d, p) * freq + t * (0.9 + fi * 0.37);
    g += d * cos(ph) * freq * amp;
  }
  return g;
}
`;

export class WaterSurface {
  /**
   * @param {THREE.Mesh} mesh flat, horizontal water mesh from the model
   * @param {{ ripple?: number, opacity?: number }} opts
   */
  constructor(mesh, opts = {}) {
    this.mesh = mesh;
    this.box = new THREE.Box3().setFromObject(mesh);
    this.height = (this.box.min.y + this.box.max.y) / 2;
    this.centre = this.box.getCenter(new THREE.Vector3());
    this.strength = 0; // how much mirror is blended in (fades with distance)

    const mat = mesh.material.clone();
    mat.name = mesh.material.name + ' (mirror)';
    mat.transparent = true;
    mat.opacity = opts.opacity ?? 0.6;
    mat.roughness = 0.05;
    mat.metalness = 0;
    mat.depthWrite = false;
    this.uniforms = {
      uMirror: { value: null },
      uMirrorMatrix: { value: new THREE.Matrix4() },
      uMirrorOn: { value: 0 },
      uTime: { value: 0 },
      uRipple: { value: opts.ripple ?? 1 },
      uDepthTint: { value: opts.depthTint ?? 0.35 },
      // outdoor water freezes in deep winter (the indoor pool never does)
      uIce: opts.outdoor ? seasonUniforms.uIce : { value: 0 },
      uSnowOnIce: opts.outdoor ? seasonUniforms.uSnow : { value: 0 },
    };
    this.outdoor = !!opts.outdoor;
    const uniforms = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform mat4 uMirrorMatrix;\nvarying vec4 vMirrorCoord;\nvarying vec3 vWaterWorld;',
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vec4 waterWorld = modelMatrix * vec4(transformed, 1.0);
           vWaterWorld = waterWorld.xyz;
           vMirrorCoord = uMirrorMatrix * waterWorld;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + RIPPLE_GLSL)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           // ice: a cloudy blue-white sheet, frosted and snowed on in patches, with faint cracks
           float iceN = 0.0;
           if (uIce > 0.001) {
             vec2 ip = vWaterWorld.xz;
             float cell = fract(sin(dot(floor(ip * 1.7), vec2(12.9898, 78.233))) * 43758.5453);
             vec2 f = fract(ip * 1.7) - 0.5;
             float crack = smoothstep(0.47, 0.5, max(abs(f.x), abs(f.y)));
             float frost = fract(sin(dot(floor(ip * 6.3), vec2(39.3, 11.1))) * 7351.7);
             vec3 ice = vec3(0.5, 0.62, 0.7) * (0.85 + 0.25 * cell) + vec3(0.12) * crack;
             float snowed = uSnowOnIce * smoothstep(0.35, 0.75, cell * 0.6 + frost * 0.4);
             ice = mix(ice, vec3(0.8, 0.83, 0.88), snowed);
             diffuseColor.rgb = mix(diffuseColor.rgb, ice, uIce);
             iceN = snowed;
           }`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, mix(0.35, 0.8, iceN), uIce);`,
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
           vec3 ice_lit = gl_FragColor.rgb + 0.06 * texture2D(uMirror, vMirrorCoord.xy / vMirrorCoord.w).rgb;
           {
             vec3 V = normalize(cameraPosition - vWaterWorld);
             vec2 slope = waterSlope(vWaterWorld.xz, uTime) * uRipple * (1.0 - uIce);
             vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
             float cosT = clamp(dot(N, V), 0.0, 1.0);
             float fresnel = 0.03 + 0.97 * pow(1.0 - cosT, 5.0);
             vec2 muv = vMirrorCoord.xy / vMirrorCoord.w + N.xz * 0.045 * uRipple;
             vec3 mirror = texture2D(uMirror, muv).rgb;
             // looking straight down you see into the water, at a glance you see the room
             // the water itself: a clear teal that deepens away from straight down
             // the water body: tiles seen through it turn teal, more so the more water you look through
             float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
             vec3 body = vec3(0.2, 0.58, 0.66) * (0.3 + lum * 0.9);
             vec3 below = mix(gl_FragColor.rgb, body, 0.7) * (1.0 - uDepthTint * (1.0 - cosT));
             vec3 sky = gl_FragColor.rgb;
             vec3 refl = mix(sky, mirror, uMirrorOn);
             float k = mix(0.3, 1.0, fresnel) * mix(0.5, 1.0, uMirrorOn);
             gl_FragColor.rgb = mix(below, refl, k);
             // never fully clear: even straight down you can tell there is water
             // (blended in linear light behind the post effects, so it needs to be fairly opaque to read)
             gl_FragColor.a = clamp(mix(max(gl_FragColor.a, 0.74), 1.0, fresnel * 0.9), 0.0, 1.0);
             // frozen: the lit ice itself, with only a faint sheen of the sky
             if (uIce > 0.001) {
               gl_FragColor.rgb = mix(gl_FragColor.rgb, ice_lit, uIce);
               gl_FragColor.a = mix(gl_FragColor.a, 0.97, uIce);
             }
           }`,
        );
    };
    mat.customProgramCacheKey = () => 'water-mirror';
    mesh.material = mat;
    this.material = mat;
  }
}

export class WaterSystem {
  constructor(renderer, scene, surfaces) {
    this.renderer = renderer;
    this.scene = scene;
    this.surfaces = surfaces;
    this.maxDistance = 55;
    this.scale = 0.5; // mirror resolution relative to the screen
    this.enabled = true;
    this.target = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 0 });
    this.target.texture.generateMipmaps = false;
    this.mirrorCam = new THREE.PerspectiveCamera();
    this.frustum = new THREE.Frustum();
    this._m = new THREE.Matrix4();
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
    this._v = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    for (const s of surfaces) s.uniforms.uMirror.value = this.target.texture;
    this.active = null;
  }

  setSize(w, h) {
    this.target.setSize(Math.max(16, Math.round(w * this.scale)), Math.max(16, Math.round(h * this.scale)));
  }

  /** Call once a frame before the main render. */
  update(camera, time) {
    for (const s of this.surfaces) s.uniforms.uTime.value = time;
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    this._camPos.setFromMatrixPosition(camera.matrixWorld);

    // the nearest surface that is in view and below the camera
    let best = null;
    let bestDist = Infinity;
    for (const s of this.surfaces) {
      const visible = s.mesh.visible && this.frustum.intersectsBox(s.box) && this._camPos.y > s.height + 0.02;
      const d = s.box.distanceToPoint(this._camPos);
      if (this.enabled && visible && d < this.maxDistance && d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    for (const s of this.surfaces) {
      const want = s === best ? THREE.MathUtils.smoothstep(this.maxDistance - bestDist, 0, this.maxDistance * 0.35) : 0;
      // no mirror image to fade from on a surface that was not the active one, so switch it straight off
      s.strength = s === best ? want : 0;
      s.uniforms.uMirrorOn.value = s.strength;
    }
    this.active = best;
    if (best) this._renderMirror(camera, best);
  }

  _renderMirror(camera, surface) {
    const renderer = this.renderer;
    const cam = this.mirrorCam;
    const normal = this._v.set(0, 1, 0);
    const point = this._t.set(this._camPos.x, surface.height, this._camPos.z);

    // mirrored camera position and look direction
    const camPos = this._camPos;
    const view = new THREE.Vector3().subVectors(point, camPos);
    view.reflect(normal).negate().add(point);
    this._rot.extractRotation(camera.matrixWorld);
    const look = this._look.set(0, 0, -1).applyMatrix4(this._rot).add(camPos);
    const target = new THREE.Vector3().subVectors(point, look).reflect(normal).negate().add(point);
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(normal);
    cam.lookAt(target);
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    // texture matrix: world -> mirror texture coords
    const tm = surface.uniforms.uMirrorMatrix.value;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    for (const s of this.surfaces) if (s !== surface) s.uniforms.uMirrorMatrix.value.copy(tm);

    // oblique near plane so nothing under the water shows in the reflection
    const plane = this._plane.setFromNormalAndCoplanarPoint(normal, point).applyMatrix4(cam.matrixWorldInverse);
    const clip = this._clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = cam.projectionMatrix;
    const q = this._q;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0 - 0.003;
    pm.elements[14] = clip.w;

    const hidden = [];
    for (const s of this.surfaces) {
      if (s.mesh.visible) {
        s.mesh.visible = false;
        hidden.push(s.mesh);
      }
    }
    const prevTarget = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(this.scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    for (const m of hidden) m.visible = true;
  }
}

/** Finds the model's water and sets it up; returns the system (or null if there is none). */
export function setupWater(renderer, scene, model) {
  const surfaces = [];
  let jet = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name || '';
    if (name === 'cm_water_pool') {
      const b = new THREE.Box3().setFromObject(o);
      if (b.max.y - b.min.y < 0.05) {
        const small = b.max.x - b.min.x < 8;
        surfaces.push(new WaterSurface(o, { ripple: small ? 0.7 : 1.0, opacity: 0.55, outdoor: b.max.y < 2 }));
      }
    } else if (name === 'cm_fishstatue_waterjet') {
      jet = o;
    }
  });
  if (jet && jet.material.map) {
    const map = jet.material.map;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    jet.material = jet.material.clone();
    jet.material.map = map;
    jet.material.depthWrite = false;
  }
  const system = new WaterSystem(renderer, scene, surfaces);
  system.jet = jet;
  return system;
}
