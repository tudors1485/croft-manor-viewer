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
 * one (whose hands are painted at ten past ten), drawn after it: a silvered chapter ring, a matted
 * brass centre with a seconds dial and the date, pierced blued-steel hands; the seconds hand steps
 * with the tick. When the clock is run (the ▶ by the time), the hands spin.
 */
export function hallClock(scene) {
  const C = new THREE.Vector3(-1.85, 1.475, -19.957); // the dial's middle, on the front of the hood
  const R = 0.118;
  // drawn as the model's own dial is (an eighteenth-century longcase dial): a silvered chapter ring
  // with Roman hours and the minutes in fives outside, a matted brass centre with a seconds dial
  // above and a date in an aperture below, two winding holes; the brass spandrels in the corners
  // are the model's own
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const K = N / 512; // (drawn on a 512 grid)
  g.scale(K, K);
  const ring = (r, w, colour) => {
    g.strokeStyle = colour;
    g.lineWidth = w;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  };
  // the brass plate, matted (a fine stipple), darker towards the edge
  const brass = g.createRadialGradient(240, 230, 10, 256, 256, 260);
  brass.addColorStop(0, '#a99566');
  brass.addColorStop(0.7, '#8c7848');
  brass.addColorStop(1, '#6a5730');
  g.fillStyle = brass;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? `rgba(60,42,10,${0.05 + v * 0.1})` : `rgba(255,236,170,${(v - 0.5) * 0.12})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.2, 1.2);
  }
  // the silvered chapter ring: from 132 to 252, a soft sheen across it
  const silver = g.createLinearGradient(80, 40, 430, 470);
  silver.addColorStop(0, '#dcd9d1');
  silver.addColorStop(0.45, '#c9c5bc');
  silver.addColorStop(0.55, '#d3cfc6');
  silver.addColorStop(1, '#b3aea3');
  g.fillStyle = silver;
  g.beginPath();
  g.arc(256, 256, 252, 0, Math.PI * 2);
  g.arc(256, 256, 132, 0, Math.PI * 2, true);
  g.fill('evenodd');
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 132 + Math.random() * 120;
    g.fillStyle = `rgba(90,85,75,${Math.random() * 0.05})`;
    g.fillRect(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 1.5, 1.5);
  }
  const ink = '#1d1b19';
  ring(252, 1.5, 'rgba(60,50,30,0.6)');
  ring(132, 1.2, 'rgba(60,50,30,0.5)');
  // the minute track: two fine circles, a tick each minute, a longer one each five
  ring(212, 1.4, ink);
  ring(198, 1.4, ink);
  g.strokeStyle = ink;
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2;
    g.lineWidth = m % 5 ? 1.3 : 2.2;
    const r0 = m % 5 ? 198 : 194;
    g.beginPath();
    g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0);
    g.lineTo(256 + Math.sin(a) * 212, 256 - Math.cos(a) * 212);
    g.stroke();
  }
  // the half hours: a small fleur between the hours, inside the track
  g.fillStyle = ink;
  for (let h = 0; h < 12; h++) {
    const a = ((h + 0.5) / 12) * Math.PI * 2;
    g.save();
    g.translate(256 + Math.sin(a) * 186, 256 - Math.cos(a) * 186);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, -6);
    g.quadraticCurveTo(4, 0, 0, 6);
    g.quadraticCurveTo(-4, 0, 0, -6);
    g.fill();
    g.restore();
  }
  // the minutes in fives, outside the track, upright as they are on the dial
  g.font = 'italic 400 21px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 1; k <= 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    g.fillText(String(k * 5), 256 + Math.sin(a) * 232, 256 - Math.cos(a) * 232);
  }
  // the Roman hours, radial (their feet towards the middle), tall and slender
  const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.font = '400 36px Georgia, "Times New Roman", serif';
  roman.forEach((t, h) => {
    const a = (h / 12) * Math.PI * 2;
    g.save();
    g.translate(256 + Math.sin(a) * 162, 256 - Math.cos(a) * 162);
    g.rotate(a);
    g.scale(0.86, 1.3);
    g.fillText(t, 0, 0);
    g.restore();
  });
  // the maker's name at the bottom of the ring, between VII and V, as such dials have
  g.font = 'italic 400 13px Georgia, serif';
  g.save();
  g.translate(256, 256);
  for (const [txt, a] of [['Croft', 0.36], ['Surrey', -0.36]]) {
    g.save();
    g.rotate(a);
    g.fillText(txt, 0, 236);
    g.restore();
  }
  g.restore();
  // the seconds dial above the middle: a small silvered ring with its own track
  const S = { x: 256, y: 184, r: 36 };
  g.fillStyle = '#cfcbc2';
  g.beginPath();
  g.arc(S.x, S.y, S.r, 0, Math.PI * 2);
  g.arc(S.x, S.y, S.r - 15, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.strokeStyle = ink;
  g.lineWidth = 1;
  for (const r of [S.r, S.r - 15]) {
    g.beginPath();
    g.arc(S.x, S.y, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    g.lineWidth = k % 5 ? 0.8 : 1.4;
    const r0 = k % 5 ? S.r - 6 : S.r - 10;
    g.beginPath();
    g.moveTo(S.x + Math.sin(a) * r0, S.y - Math.cos(a) * r0);
    g.lineTo(S.x + Math.sin(a) * S.r, S.y - Math.cos(a) * S.r);
    g.stroke();
  }
  // the winding holes, either side, a little below the middle
  for (const dx of [-58, 58]) {
    const h = g.createRadialGradient(256 + dx, 282, 1, 256 + dx, 282, 9);
    h.addColorStop(0, '#0c0a08');
    h.addColorStop(0.75, '#231a0c');
    h.addColorStop(1, 'rgba(120,95,40,0.9)');
    g.fillStyle = h;
    g.beginPath();
    g.arc(256 + dx, 282, 9, 0, Math.PI * 2);
    g.fill();
  }
  // the date aperture below the middle: a crescent opening (the date is drawn into it as the day changes)
  const D = { x: 256, y: 338 };
  const drawDate = (n) => {
    g.save();
    g.beginPath();
    g.arc(D.x, D.y - 46, 66, 0.28 * Math.PI, 0.72 * Math.PI);
    g.arc(D.x, D.y - 72, 70, 0.66 * Math.PI, 0.34 * Math.PI, true);
    g.closePath();
    g.fillStyle = '#d6d2c8';
    g.fill();
    g.strokeStyle = '#3a2c12';
    g.lineWidth = 1.5;
    g.stroke();
    g.clip();
    g.fillStyle = ink;
    g.font = '600 15px Georgia, serif';
    g.fillText(String(n), D.x, D.y + 8);
    g.restore();
  };
  drawDate(1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const group = new THREE.Group();
  group.position.copy(C);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.25 }));
  group.add(dial);
  // blued steel hands, pierced as the old ones are
  const blued = new THREE.MeshStandardMaterial({ color: 0x182038, metalness: 0.75, roughness: 0.28 });
  const u = R / 256; // (a canvas pixel, in metres)
  const shapeHand = (pts, holes = []) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * u, y * u)));
    for (const [x, y, r] of holes) {
      const h = new THREE.Path();
      h.absarc(x * u, y * u, r * u, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return new THREE.ShapeGeometry(s, 16);
  };
  // the hour hand: a spade with a round piercing, reaching the inner edge of the hours
  const hourGeo = shapeHand(
    [[-4, -24], [4, -24], [3, 58], [11, 78], [14, 98], [7, 116], [0, 132], [-7, 116], [-14, 98], [-11, 78], [-3, 58]],
    [[0, 95, 6.5]],
  );
  // the minute hand: long and slender, a small scroll near the boss, out to the minute track
  const minuteGeo = shapeHand(
    [[-6, -34], [6, -34], [4, 20], [12, 34], [3, 46], [2.5, 196], [0, 208], [-2.5, 196], [-3, 46], [-12, 34], [-4, 20]],
    [[0, 34, 4.5]],
  );
  const hour = new THREE.Mesh(hourGeo, blued);
  hour.position.z = 0.003;
  const minute = new THREE.Mesh(minuteGeo, blued);
  minute.position.z = 0.005;
  group.add(hour, minute);
  // the seconds hand on its own little dial
  const seconds = new THREE.Mesh(shapeHand([[-1.6, -8], [1.6, -8], [1, 34], [0, 37], [-1, 34]]), blued);
  seconds.position.set(0, (256 - S.y) * u, 0.004);
  group.add(seconds);
  const boss = new THREE.Mesh(new THREE.CircleGeometry(7 * u, 16), new THREE.MeshStandardMaterial({ color: 0xb8913c, metalness: 1, roughness: 0.3 }));
  boss.position.z = 0.007;
  group.add(boss);
  group.traverse((o) => o.isMesh && (o.receiveShadow = true));
  scene.add(group);
  let shownDate = 1;
  return {
    group,
    /** The hands at `hours` (the viewer's clock, with its seconds) and the date in its aperture. */
    update(hours, dateOfMonth = null) {
      const sec = ((hours * 3600) % 60 + 60) % 60;
      hour.rotation.z = -(((hours % 12) + 12) % 12 / 12) * Math.PI * 2;
      minute.rotation.z = -(((hours % 1) + 1) % 1) * Math.PI * 2;
      // (the seconds hand steps with the tick)
      seconds.rotation.z = -(Math.floor(sec) / 60) * Math.PI * 2;
      if (dateOfMonth && dateOfMonth !== shownDate) {
        shownDate = dateOfMonth;
        g.save();
        g.setTransform(K, 0, 0, K, 0, 0);
        drawDate(dateOfMonth);
        g.restore();
        tex.needsUpdate = true;
      }
    },
  };
}
