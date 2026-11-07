// A rainbow when the sun comes out after a shower: always opposite the sun, a ring 42° from the
// point straight away from it (red outside, violet inside), a fainter second bow at about 51°
// with its colours the other way round, the sky a little brighter inside the first bow and a
// little darker between the two (Alexander's band). With the sun higher than 42° the bow is
// below the horizon, so rainbows come in the morning and the late afternoon. Drawn on a sphere
// round the camera, so it stays where it belongs however you move.

import * as THREE from 'three';

export class Rainbow {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: { uAnti: { value: new THREE.Vector3(0, -1, 0) }, uAmount: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uAnti;
        uniform float uAmount;
        varying vec3 vDir;
        // the bow's colours across its width (0 inside, violet .. 1 outside, red)
        vec3 bow(float x) {
          vec3 c = vec3(0.0);
          c += vec3(0.45, 0.1, 0.75) * exp(-pow((x - 0.06) / 0.13, 2.0));
          c += vec3(0.1, 0.25, 1.0) * exp(-pow((x - 0.24) / 0.13, 2.0));
          c += vec3(0.1, 0.85, 0.35) * exp(-pow((x - 0.46) / 0.14, 2.0));
          c += vec3(1.0, 0.9, 0.1) * exp(-pow((x - 0.64) / 0.12, 2.0));
          c += vec3(1.0, 0.45, 0.05) * exp(-pow((x - 0.78) / 0.11, 2.0));
          c += vec3(0.95, 0.1, 0.05) * exp(-pow((x - 0.92) / 0.11, 2.0));
          return c;
        }
        void main() {
          float a = degrees(acos(clamp(dot(normalize(vDir), uAnti), -1.0, 1.0)));
          vec3 c = vec3(0.0);
          // the first bow, 40.6° to 42.4°, with soft edges
          float x1 = (a - 40.4) / 2.2;
          c += bow(x1) * smoothstep(-0.15, 0.08, x1) * (1.0 - smoothstep(0.92, 1.15, x1));
          // the second, 50.2° to 53.6°, colours reversed, fainter
          float x2 = 1.0 - (a - 50.0) / 3.6;
          c += 0.38 * bow(x2) * smoothstep(-0.15, 0.08, x2) * (1.0 - smoothstep(0.92, 1.15, x2));
          // brighter inside the first bow
          c += vec3(0.05) * (1.0 - smoothstep(30.0, 40.6, a));
          // only above the horizon, fading towards it
          float up = smoothstep(-0.01, 0.06, vDir.y);
          gl_FragColor = vec4(c * uAmount * up * 0.45, 1.0);
        }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1400, 64, 32), this.material);
    this.mesh.name = 'Rainbow';
    this.mesh.renderOrder = -0.5; // after the sky and its haze, before everything near
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.amount = 0;
  }

  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Vector3} sunDir towards the sun
   * @param {number} want 0..1, how strong it should be (it comes and goes slowly)
   */
  update(dt, camera, sunDir, want) {
    this.amount = this.snap ? want : this.amount + (want - this.amount) * (1 - Math.exp(-dt * 0.6));
    this.snap = false;
    this.mesh.visible = this.amount > 0.01;
    if (!this.mesh.visible) return;
    this.mesh.position.copy(camera.position);
    this.material.uniforms.uAnti.value.copy(sunDir).negate();
    this.material.uniforms.uAmount.value = this.amount;
  }
}
