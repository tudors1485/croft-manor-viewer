// Footprints in the snow: while snow lies, every step you take outdoors in Walk leaves a boot
// print (left, right, left...) pressed into it, turned the way you were walking. They fade after
// a couple of minutes, sooner while snow is falling (it fills them in), and go when the snow does.

import * as THREE from 'three';

const MAX = 600;

/** A boot sole seen from above: a rounded front, a waist and a heel, darker where it pressed hardest. */
function soleTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 160;
  const g = c.getContext('2d');
  g.filter = 'blur(3px)';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(32, 46, 22, 36, 0, 0, Math.PI * 2); // the front of the foot
  g.fill();
  g.beginPath();
  g.ellipse(32, 124, 17, 24, 0, 0, Math.PI * 2); // the heel
  g.fill();
  g.fillRect(19, 70, 26, 40); // the waist between them
  // the tread: a few bars pressed deeper
  g.filter = 'blur(1.5px)';
  g.fillStyle = 'rgba(255,255,255,1)';
  for (let y = 22; y < 80; y += 11) g.fillRect(14, y, 36, 4);
  for (let y = 110; y < 145; y += 10) g.fillRect(18, y, 28, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class Footprints {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(0.12, 0.3).rotateX(-Math.PI / 2);
    this.born = new THREE.InstancedBufferAttribute(new Float32Array(MAX).fill(-1e9), 1);
    geo.setAttribute('aBorn', this.born);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: soleTexture() }, uTime: { value: 0 }, uLife: { value: 120 }, uSnow: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: /* glsl */ `
        attribute float aBorn;
        uniform float uTime;
        uniform float uLife;
        varying vec2 vUv;
        varying float vAge;
        void main() {
          vUv = uv;
          vAge = (uTime - aBorn) / uLife;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uSnow;
        uniform vec3 uLight;
        varying vec2 vUv;
        varying float vAge;
        void main() {
          float a = texture2D(uMap, vUv).r * (1.0 - smoothstep(0.55, 1.0, vAge)) * step(0.0, vAge) * uSnow;
          if (a < 0.01) discard;
          // the shadow in a dent in the snow: blue-grey, lit by the sky
          gl_FragColor = vec4(vec3(0.42, 0.47, 0.58) * uLight, a * 0.5);
        }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX);
    this.mesh.name = 'Footprints';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.next = 0;
    this.left = true;
    this.time = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  /** A step at `feet` (the point between your feet, on the ground) heading `heading` radians (0 = towards -z). */
  step(feet, heading) {
    const side = this.left ? -1 : 1;
    this.left = !this.left;
    // a little to the side of the line you walk, toes out a touch
    this._p.set(feet.x + Math.cos(heading) * 0.11 * side, feet.y - 0.012, feet.z - Math.sin(heading) * 0.11 * side); // (the walker's feet are 2 cm up)
    this._q.setFromAxisAngle(this._up, heading - side * 0.06);
    this._m.compose(this._p, this._q, this._s);
    const i = this.next;
    this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.born.array[i] = this.time;
    this.born.needsUpdate = true;
    this.next = (i + 1) % MAX;
    this.mesh.count = Math.max(this.mesh.count, i + 1);
  }

  /**
   * @param {number} snow how much snow lies, 0..1
   * @param {number} snowing how hard it is snowing, 0..1 (fills them in sooner)
   * @param {number} light how lit the snow is (dim at night)
   */
  update(dt, snow, snowing, light) {
    this.time += dt * (1 + 2.5 * snowing);
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uSnow.value = THREE.MathUtils.smoothstep(snow, 0.35, 0.7);
    u.uLight.value.setScalar(light);
    this.mesh.visible = u.uSnow.value > 0.01 && this.mesh.count > 0;
  }
}
