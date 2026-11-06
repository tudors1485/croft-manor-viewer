// Fallen leaves: in autumn they gather on the grass under each tree as its crown thins (the
// same few days early or late as that tree, see the leaf shader in landscape.js), thickest
// near the trunk and drifting a little downwind. Through the winter they go brown and rot
// away, snow covers them, and by April they are gone. Each leaf is a small flat card, one of
// four shapes drawn here (oak, beech, sycamore, ash), in yellows, oranges and browns.

import * as THREE from 'three';
import { seasonUniforms } from './season.js';

/** Four leaf shapes in a 2 x 2 atlas: white with alpha (each leaf's colour multiplies it), with a darker midrib. */
function leafAtlas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const g = c.getContext('2d');
  // each shape: the outline's radius at angle a (0 points to the tip), and how wide it is
  const shapes = [
    { r: (a) => 1 + 0.2 * Math.abs(Math.sin(a * 3.5)), w: 0.55 }, // oak: round lobes
    { r: (a) => 1 - 0.25 * Math.sin(a / 2) ** 2, w: 0.6 }, // beech: an oval with a point
    { r: (a) => 0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)) ** 0.8, w: 1 }, // sycamore: five points
    { r: () => 1, w: 0.28 }, // ash: a narrow leaflet
  ];
  shapes.forEach((sh, i) => {
    const cx = (i % 2) * S + S / 2;
    const cy = Math.floor(i / 2) * S + S / 2;
    const R = S * 0.42;
    g.beginPath();
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      const r = sh.r(a) * R;
      // the tip up the card (-y), the stem down (+y)
      const x = cx + Math.sin(a) * r * sh.w;
      const y = cy - Math.cos(a) * r;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
    // the midrib and a short stalk
    g.strokeStyle = 'rgba(70, 50, 30, 0.55)';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(cx, cy - R * 0.9);
    g.lineTo(cx, cy + R * 1.08);
    g.stroke();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// autumn colours (linear albedo, as the crowns' autumn colours in landscape.js)
const COLOURS = [
  [0.62, 0.36, 0.03], // butter yellow
  [0.55, 0.24, 0.02], // orange
  [0.5, 0.13, 0.02], // orange-brown
  [0.24, 0.08, 0.02], // russet
  [0.3, 0.17, 0.06], // brown
  [0.42, 0.38, 0.05], // yellow with green still in it
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class FallenLeaves {
  /**
   * @param {THREE.Scene} scene
   * @param {{x:number, z:number, r:number, inside:boolean}[]} trees the trees (crown radius r)
   * @param {(x:number, z:number) => number|null} groundAt the ground's height
   */
  constructor(scene, trees, groundAt) {
    const R = rng(20261106);
    const list = [];
    for (const t of trees) {
      // a thick carpet under the trees you walk among, fewer under the far ones outside the walls
      const n = t.inside ? 3200 : 500;
      const spread = Math.max(2.5, t.r * 1.25);
      for (let i = 0; i < n; i++) {
        // thickest near the trunk, thinning out past the edge of the crown, drifting downwind
        const a = R() * Math.PI * 2;
        const d = 0.35 + spread * Math.pow(R(), 0.75);
        const drift = R() * R() * 1.6;
        const x = t.x + Math.cos(a) * d + drift * 0.8;
        const z = t.z + Math.sin(a) * d - drift * 0.6;
        const y = groundAt(x, z);
        // (not on top of walls or steps: only on the ground itself)
        if (y === null || Math.abs(y - (groundAt(t.x, t.z) ?? y)) > 0.35) continue;
        list.push({ x, y, z, tree: t, seed: R(), cell: Math.floor(R() * 4), size: 0.1 + R() * 0.07 * (1 + R()), colour: COLOURS[Math.floor(R() * COLOURS.length)], shade: 0.75 + R() * 0.45 });
      }
    }
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const seeds = new Float32Array(list.length);
    const cells = new Float32Array(list.length);
    const treePos = new Float32Array(list.length * 2);
    list.forEach((l, i) => {
      seeds[i] = l.seed;
      cells[i] = l.cell;
      treePos[i * 2] = l.tree.x;
      treePos[i * 2 + 1] = l.tree.z;
    });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
    geo.setAttribute('aTreePos', new THREE.InstancedBufferAttribute(treePos, 2));

    const material = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDay = seasonUniforms.uDay;
      shader.uniforms.uSnow = seasonUniforms.uSnow;
      shader.uniforms.uWet = seasonUniforms.uWet;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aSeed;
           attribute float aCell;
           attribute vec2 aTreePos;
           uniform float uDay;
           uniform float uSnow;
           varying float vAge;`,
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
           #ifdef USE_MAP
             vMapUv = vMapUv * 0.5 + vec2(mod(aCell, 2.0), 1.0 - floor(aCell / 2.0)) * 0.5;
           #endif`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           {
             // this tree's few days early or late, as its crown has them
             float early = fract(sin(dot(aTreePos, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
             float d = uDay + early * 18.0;
             // a few drop early in October, most as the crown thins through November
             float fallen = 0.1 * smoothstep(262.0, 292.0, d) + 0.9 * smoothstep(290.0, 332.0, d);
             // last year's, rotting away through the winter, gone by April
             float left = 1.0 - smoothstep(20.0, 95.0, uDay);
             float amount = uDay > 200.0 ? fallen : left;
             amount *= 1.0 - smoothstep(0.25, 0.7, uSnow); // under the snow
             if (aSeed > amount) transformed = vec3(0.0); // (not fallen yet, or gone)
             vAge = uDay > 200.0 ? 0.45 * smoothstep(300.0, 380.0, d) : 0.45 + 0.4 * smoothstep(0.0, 70.0, uDay);
           }`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uWet;\nvarying float vAge;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // older leaves go brown and dark; wet ones darker still
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.075, 0.035), vAge);
           diffuseColor.rgb *= 1.0 - 0.35 * uWet;`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, 0.45, uWet);`,
        );
    };
    material.customProgramCacheKey = () => 'fallen-leaves';

    this.mesh = new THREE.InstancedMesh(geo, material, list.length);
    this.mesh.name = 'Fallen leaves';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    list.forEach((l, i) => {
      // lying any which way, a little curled and tilted
      e.set((R() - 0.5) * 0.5, R() * Math.PI * 2, (R() - 0.5) * 0.5, 'YXZ');
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(l.x, l.y + 0.015 + R() * 0.012, l.z), q, new THREE.Vector3(l.size, 1, l.size * 1.15));
      this.mesh.setMatrixAt(i, m);
      col.setRGB(l.colour[0] * l.shade, l.colour[1] * l.shade, l.colour[2] * l.shade);
      this.mesh.setColorAt(i, col);
    });
    this.mesh.computeBoundingSphere();
    this.count = list.length;
    scene.add(this.mesh);
    this.update();
  }

  /** Hidden outright from spring to early autumn and under deep snow (nothing to draw then). */
  update() {
    const day = seasonUniforms.uDay.value;
    this.mesh.visible = (day > 255 || day < 100) && seasonUniforms.uSnow.value < 0.7;
  }
}
