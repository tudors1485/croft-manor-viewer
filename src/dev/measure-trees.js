import * as THREE from 'three';
import { Tree } from '@dgreenheck/ez-tree';
export function measure() {
  const out = [];
  for (const name of ['Oak Large', 'Oak Medium', 'Ash Large', 'Ash Medium', 'Aspen Large', 'Aspen Medium', 'Pine Large', 'Pine Medium', 'Bush 1', 'Bush 2', 'Bush 3']) {
    const t0 = performance.now();
    const tree = new Tree();
    try { tree.loadPreset(name); } catch (e) { out.push(name + ' preset error ' + e.message); continue; }
    tree.generate();
    const b = new THREE.Box3().setFromObject(tree);
    const s = b.getSize(new THREE.Vector3());
    const bt = tree.branchesMesh.geometry.index ? tree.branchesMesh.geometry.index.count / 3 : 0;
    const lt = tree.leavesMesh.geometry.index ? tree.leavesMesh.geometry.index.count / 3 : tree.leavesMesh.geometry.attributes.position.count / 3;
    out.push(`${name}: branches ${bt} tris, leaves ${lt} tris, size ${s.x.toFixed(1)} x ${s.y.toFixed(1)} x ${s.z.toFixed(1)}, ${(performance.now() - t0).toFixed(0)} ms, leaf mat ${tree.leavesMesh.material.type} alphaTest ${tree.leavesMesh.material.alphaTest} map ${!!tree.leavesMesh.material.map}`);
  }
  return out.join('\n');
}
