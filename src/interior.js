// The house's finer things, as TRJTA's renders show them: the chandeliers and sconces polished gilt
// metal that catches the room (the model's gold is a flat texture), and the paintings varnished, each
// in a gilt frame of its own (the model's are flat pictures on the wall).

import * as THREE from 'three';

/** The connected pieces of a mesh (triangles sharing vertices, welded by position), in world space. */
function pieces(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const v = new THREE.Vector3();
  const key = new Map();
  const id = new Int32Array(pos.count);
  const world = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    world.push(v.clone());
    const k = `${Math.round(v.x * 200)},${Math.round(v.y * 200)},${Math.round(v.z * 200)}`;
    if (!key.has(k)) key.set(k, key.size);
    id[i] = key.get(k);
  }
  const parent = Array.from({ length: key.size }, (_, i) => i);
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  for (let t = 0; t < idx.length; t += 3) {
    const a = find(id[idx[t]]);
    parent[find(id[idx[t + 1]])] = a;
    parent[find(id[idx[t + 2]])] = a;
  }
  const groups = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(id[idx[t]]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return [...groups.values()].map((tris) => tris.map((i) => world[i]));
}

/** A gilt frame round a picture: four mitred-looking bars, a raised lip inside. */
function frameAround(pts, gilt) {
  // the picture's plane: its normal from the biggest triangle, its sides horizontal and vertical
  let n = new THREE.Vector3();
  let best = 0;
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) {
    e1.subVectors(pts[i + 1], pts[i]);
    e2.subVectors(pts[i + 2], pts[i]);
    const c = e1.clone().cross(e2);
    if (c.length() > best) {
      best = c.length();
      n = c.normalize();
    }
  }
  if (best < 1e-6 || Math.abs(n.y) > 0.5) return null; // (not hanging on a wall)
  n.y = 0;
  n.normalize();
  const u = new THREE.Vector3(-n.z, 0, n.x);
  let u0 = Infinity;
  let u1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let d = 0;
  for (const p of pts) {
    const s = p.dot(u);
    u0 = Math.min(u0, s);
    u1 = Math.max(u1, s);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
    d += p.dot(n);
  }
  d /= pts.length;
  const w = u1 - u0;
  const h = y1 - y0;
  if (w < 0.15 || h < 0.15 || w > 6 || h > 5) return null;
  const t = THREE.MathUtils.clamp(Math.min(w, h) * 0.07, 0.04, 0.13); // the frame's width
  const depth = t * 0.6;
  const group = new THREE.Group();
  const bar = (len, thick, along, at) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(along === 'u' ? len : thick, along === 'u' ? thick : len, depth), gilt);
    m.position.copy(at);
    return m;
  };
  const c = new THREE.Vector3(0, 0, 0);
  // outer bars (the frame sits round the picture, overlapping its edge a little)
  group.add(bar(w + 2 * t, t, 'u', new THREE.Vector3(0, h / 2 + t / 2 - t * 0.25, 0)));
  group.add(bar(w + 2 * t, t, 'u', new THREE.Vector3(0, -h / 2 - t / 2 + t * 0.25, 0)));
  group.add(bar(h + 2 * t, t, 'v', new THREE.Vector3(-w / 2 - t / 2 + t * 0.25, 0, 0)));
  group.add(bar(h + 2 * t, t, 'v', new THREE.Vector3(w / 2 + t / 2 - t * 0.25, 0, 0)));
  // the lip: thinner, standing a little proud, just inside
  const lipT = t * 0.28;
  const lip = (len, along, at) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(along === 'u' ? len : lipT, along === 'u' ? lipT : len, depth * 1.4), gilt);
    m.position.copy(at);
    return m;
  };
  group.add(lip(w, 'u', new THREE.Vector3(0, h / 2 - lipT / 2 + t * 0.2, 0)), lip(w, 'u', new THREE.Vector3(0, -h / 2 + lipT / 2 - t * 0.2, 0)));
  group.add(lip(h, 'v', new THREE.Vector3(-w / 2 + lipT / 2 - t * 0.2, 0, 0)), lip(h, 'v', new THREE.Vector3(w / 2 - lipT / 2 + t * 0.2, 0, 0)));
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  // placed on the picture, facing out of the wall
  const centre = u.clone().multiplyScalar((u0 + u1) / 2).add(n.clone().multiplyScalar(d + depth / 2 - 0.004)).setY((y0 + y1) / 2);
  group.position.copy(centre).add(c);
  group.lookAt(centre.clone().add(n));
  return group;
}

export function dressInterior(scene, model) {
  const gilt = new THREE.MeshStandardMaterial({ color: 0xd2a84e, metalness: 1, roughness: 0.3, envMapIntensity: 2.6 });
  const done = new Set();
  let frames = 0;
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    const name = m.name || '';
    if (/^cm_obj_sconcegold$/.test(name) && !done.has(m)) {
      // polished gilt: the room in it, bright where the light catches
      done.add(m);
      m.metalness = 1;
      m.roughness = 0.24;
      m.envMapIntensity = 2.6;
      m.color.setRGB(1, 0.86, 0.6);
    }
    if (/^cm_obj_painting_/.test(name)) {
      if (!done.has(m)) {
        done.add(m);
        m.roughness = 0.42; // (varnished: a soft sheen)
      }
      o.userData.frames = [];
      for (const pts of pieces(o)) {
        const f = frameAround(pts, gilt);
        if (!f) continue;
        scene.add(f);
        o.userData.frames.push(f);
        frames++;
      }
    }
  });
  return { frames };
}

/**
 * The grandfather clock in the great hall keeping the viewer's time: a dial laid over its painted
 * one (whose hands are painted at ten past ten), an enamel chapter ring with Roman numerals round a
 * brass centre, and blued-steel hands; a seconds hand with the tick. When the clock is run (the ▶ by
 * the time), the hands spin.
 */
export function hallClock(scene) {
  const C = new THREE.Vector3(-1.85, 1.475, -19.957); // the dial's middle, on the front of the hood
  const R = 0.118;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  // the brass dial plate, engraved, with the enamel chapter ring on it
  const brass = g.createRadialGradient(256, 230, 20, 256, 256, 256);
  brass.addColorStop(0, '#e7c977');
  brass.addColorStop(1, '#9a7a34');
  g.fillStyle = brass;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(80,55,15,0.35)';
  for (let r = 40; r < 140; r += 9) {
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#f2ede0';
  g.beginPath();
  g.arc(256, 256, 250, 0, Math.PI * 2);
  g.arc(256, 256, 160, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.strokeStyle = '#2a2420';
  g.lineWidth = 2;
  for (const r of [250, 228, 160]) {
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  // the minute track, and the hours in Roman numerals
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2;
    const r0 = m % 5 ? 236 : 230;
    g.lineWidth = m % 5 ? 2 : 4;
    g.beginPath();
    g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0);
    g.lineTo(256 + Math.sin(a) * 248, 256 - Math.cos(a) * 248);
    g.stroke();
  }
  const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#1e1a16';
  g.font = '600 44px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  roman.forEach((t, h) => {
    const a = (h / 12) * Math.PI * 2;
    g.save();
    g.translate(256 + Math.sin(a) * 194, 256 - Math.cos(a) * 194);
    g.rotate(a);
    g.fillText(t, 0, 0);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const group = new THREE.Group();
  group.position.copy(C);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.1 }));
  group.add(dial);
  const steel = new THREE.MeshStandardMaterial({ color: 0x14182a, metalness: 0.7, roughness: 0.3 });
  // a hand: a tapering blade from the middle, with a tail
  const hand = (len, width, z) => {
    const s = new THREE.Shape();
    s.moveTo(-width * 0.5, -len * 0.18);
    s.lineTo(width * 0.5, -len * 0.18);
    s.lineTo(width * 0.32, len * 0.7);
    s.lineTo(0, len);
    s.lineTo(-width * 0.32, len * 0.7);
    s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), steel);
    m.position.z = z;
    group.add(m);
    return m;
  };
  const hour = hand(R * 0.55, R * 0.11, 0.003);
  const minute = hand(R * 0.86, R * 0.075, 0.005);
  const second = hand(R * 0.9, R * 0.02, 0.007);
  second.material = new THREE.MeshStandardMaterial({ color: 0x5a1610, metalness: 0.4, roughness: 0.4 });
  const boss = new THREE.Mesh(new THREE.CircleGeometry(R * 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.3 }));
  boss.position.z = 0.009;
  group.add(boss);
  group.traverse((o) => o.isMesh && (o.receiveShadow = true));
  scene.add(group);
  return {
    group,
    /** The hands at `hours` (the viewer's clock, with its seconds). */
    update(hours) {
      const s = ((hours * 3600) % 60 + 60) % 60;
      hour.rotation.z = -(((hours % 12) + 12) % 12 / 12) * Math.PI * 2;
      minute.rotation.z = -(((hours % 1) + 1) % 1) * Math.PI * 2;
      // (the seconds hand steps with the tick)
      second.rotation.z = -(Math.floor(s) / 60) * Math.PI * 2;
    },
  };
}
