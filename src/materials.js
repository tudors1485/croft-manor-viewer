// Per-material colour tweaks for the outside of the estate, so the grade itself can stay
// close to neutral (interiors look natural) while the lawns, brick and roofs get the
// warm, saturated look of the Lumion renders.

import * as THREE from 'three';

export const GRASS_TINT = new THREE.Color(0.93, 1.05, 0.74);

const TINTS = [
  [/^cm_grass$/, GRASS_TINT],
  [/^cm_brickwall/, new THREE.Color(1.1, 0.93, 0.84)],
  [/^cm_assault_bricks/, new THREE.Color(1.08, 0.94, 0.86)],
  [/^cm_roof$/, new THREE.Color(1.28, 1.16, 1.0), { roughness: 0.95 }],
  [/^cm_gravel$/, new THREE.Color(1.06, 1.0, 0.9)],
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
  });
}
