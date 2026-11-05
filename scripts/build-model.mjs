// Converts the SketchUp OBJ export of Classic Croft Manor HD into one GLB
// the browser can load quickly: one mesh per material, textures resized and
// re-encoded as WebP, ivy and the zipline trolley kept as separate nodes.
//
//   node scripts/build-model.mjs
//
// Reads  source/Classic Croft Manor HD v2.3/  (unpacked from the RAR)
// Writes public/manor.glb

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import obj2gltf from 'obj2gltf';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  flatten,
  join,
  weld,
  prune,
  textureCompress,
  mergeDocuments,
  getBounds,
} from '@gltf-transform/functions';
import { decodeDDS } from './dds.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'source', 'Classic Croft Manor HD v2.3');
const WORK = path.join(ROOT, 'build', 'work');
const OUT = path.join(ROOT, 'public', 'manor.glb');

const COLOUR_MAX = Number(process.env.COLOUR_MAX ?? 2048);
const NORMAL_MAX = Number(process.env.NORMAL_MAX ?? 1024);

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

// 1. Working copy: DDS -> PNG, and `bump` -> `map_Bump` (obj2gltf only reads the latter).
async function prepareWork() {
  await fs.rm(WORK, { recursive: true, force: true });
  await fs.mkdir(path.dirname(WORK), { recursive: true });
  await fs.cp(SRC, WORK, { recursive: true });
  const files = await walk(WORK);
  let dds = 0;
  for (const f of files.filter((f) => f.toLowerCase().endsWith('.dds'))) {
    const { width, height, data } = decodeDDS(await fs.readFile(f));
    await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
      .png()
      .toFile(f.replace(/\.dds$/i, '.png'));
    dds++;
  }
  const exists = (p) => fs.access(p).then(() => true, () => false);
  for (const f of files.filter((f) => f.endsWith('.mtl'))) {
    const text = await fs.readFile(f, 'utf8');
    const lines = text.replace(/\.dds\b/gi, '.png').replace(/^bump /gm, 'map_Bump ').split('\n');
    // Some maps name the wrong extension (cm_door_brown.jpg is a .png): point them at what is there.
    for (const [i, line] of lines.entries()) {
      const m = line.match(/^(map_\w+) (.+?)\s*$/);
      if (!m) continue;
      const ref = path.join(path.dirname(f), m[2]);
      if (await exists(ref)) continue;
      const base = ref.replace(/\.[^.]+$/, '');
      for (const ext of ['.png', '.jpg', '.jpeg']) {
        if (await exists(base + ext)) {
          lines[i] = `${m[1]} ${m[2].replace(/\.[^.]+$/, ext)}`;
          log(`texture ${path.basename(m[2])} -> ${path.basename(base + ext)}`);
          break;
        }
      }
    }
    await fs.writeFile(f, lines.join('\n'));
  }
  log(`working copy ready, ${dds} DDS textures decoded`);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// 2. Each OBJ -> glTF document, flattened and joined by material.
async function convert(objPath, label) {
  const glb = await obj2gltf(objPath, {
    binary: true,
    checkTransparency: true,
    doubleSidedMaterial: true,
  });
  const doc = await io.readBinary(new Uint8Array(glb));
  await doc.transform(flatten(), join(), weld(), prune());
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const group = doc.createNode(label);
  for (const child of scene.listChildren()) group.addChild(child);
  scene.addChild(group);
  log(`converted ${label}: ${doc.getRoot().listMeshes().length} meshes`);
  return doc;
}

// Decide BLEND vs MASK from the texture's alpha: cut-outs (leaves, grilles)
// sort badly when blended, so anything that is mostly 0 or 255 becomes MASK.
async function alphaKind(image) {
  const { data, info } = await sharp(Buffer.from(image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let partial = 0;
  let transparent = 0;
  const n = info.width * info.height;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < 250) transparent++;
    if (a > 12 && a < 243) partial++;
  }
  if (transparent === 0) return 'OPAQUE';
  return partial / n < 0.04 ? 'MASK' : 'BLEND';
}

async function tuneMaterials(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    const name = m.getName().toLowerCase();
    m.setMetallicFactor(0);
    m.setRoughnessFactor(0.82);
    if (/glass/.test(name)) {
      m.setAlphaMode('BLEND');
      m.setRoughnessFactor(0.05);
      const c = m.getBaseColorFactor();
      m.setBaseColorFactor([c[0], c[1], c[2], Math.min(c[3], 0.35)]);
    } else if (/water/.test(name)) {
      m.setAlphaMode('BLEND');
      m.setRoughnessFactor(0.08);
      const c = m.getBaseColorFactor();
      m.setBaseColorFactor([c[0], c[1], c[2], Math.min(c[3], 0.8)]);
    } else if (/aluminium|sconcegold|metal|rustygate/.test(name)) {
      m.setMetallicFactor(0.6);
      m.setRoughnessFactor(0.45);
    } else if (/marble|ceramic|mirror|tvscreen/.test(name)) {
      m.setRoughnessFactor(0.3);
    }
    if (m.getAlphaMode() === 'BLEND' && !/glass|water/.test(name)) {
      const tex = m.getBaseColorTexture();
      const kind = tex ? await alphaKind(tex.getImage()) : 'BLEND';
      if (kind === 'MASK') {
        m.setAlphaMode('MASK');
        m.setAlphaCutoff(0.5);
      } else if (kind === 'OPAQUE') {
        m.setAlphaMode('OPAQUE');
      }
    }
  }
  const modes = {};
  for (const m of doc.getRoot().listMaterials()) modes[m.getAlphaMode()] = (modes[m.getAlphaMode()] ?? 0) + 1;
  log('materials tuned', modes);
}

async function main() {
  await prepareWork();

  const main = await convert(path.join(WORK, 'Classic Croft Manor HD.obj'), 'Manor');
  const trolley = await convert(path.join(WORK, 'Zipline Trolley.obj'), 'Zipline Trolley');
  const ivyDir = path.join(WORK, 'Classic Manor HD Ivy');
  const ivyFiles = (await fs.readdir(ivyDir)).filter((f) => f.endsWith('.obj')).sort();
  const ivyDocs = [];
  for (const f of ivyFiles) ivyDocs.push(await convert(path.join(ivyDir, f), `Ivy: ${f.replace(/^\d+\.\s*Ivy - |\.obj$/g, '')}`));

  // 3. Merge into one document, under one scene.
  const doc = main;
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  doc.getRoot().setDefaultScene(scene);
  const ivyGroup = doc.createNode('Ivy');
  scene.addChild(ivyGroup);
  for (const [i, src] of [trolley, ...ivyDocs].entries()) {
    const map = mergeDocuments(doc, src);
    for (const s of src.getRoot().listScenes()) {
      const copy = map.get(s);
      for (const child of copy.listChildren()) (i === 0 ? scene : ivyGroup).addChild(child);
      copy.dispose();
    }
  }
  // mergeDocuments leaves one buffer per source; glb wants one.
  const buffers = doc.getRoot().listBuffers();
  for (const accessor of doc.getRoot().listAccessors()) accessor.setBuffer(buffers[0]);
  for (const b of buffers.slice(1)) b.dispose();
  log('merged');

  await doc.transform(dedup(), prune());
  await tuneMaterials(doc);

  // 4. Textures: normal maps smaller, everything to WebP.
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normalTexture$/, resize: [NORMAL_MAX, NORMAL_MAX], quality: 85 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!normalTexture$).*/, resize: [COLOUR_MAX, COLOUR_MAX], quality: 82 }),
  );
  log('textures compressed');

  const bounds = getBounds(scene);
  let tris = 0;
  let prims = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      prims++;
      const idx = p.getIndices();
      tris += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
  }
  // texcoord range, to decide whether geometry quantisation is safe later
  let uvMin = Infinity;
  let uvMax = -Infinity;
  for (const a of doc.getRoot().listAccessors()) {
    if (a.getType() !== 'VEC2') continue;
    for (const v of [...a.getMin([0, 0]), ...a.getMax([0, 0])]) {
      uvMin = Math.min(uvMin, v);
      uvMax = Math.max(uvMax, v);
    }
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await io.write(OUT, doc);
  const size = (await fs.stat(OUT)).size;
  log(`wrote ${path.relative(ROOT, OUT)}: ${(size / 1e6).toFixed(1)} MB`);
  log(`triangles ${Math.round(tris)}, primitives (draw calls) ${prims}, materials ${doc.getRoot().listMaterials().length}, textures ${doc.getRoot().listTextures().length}`);
  log('bounds', JSON.stringify(bounds));
  log(`uv range ${uvMin.toFixed(2)} .. ${uvMax.toFixed(2)}`);
  const texBytes = doc.getRoot().listTextures().reduce((s, t) => s + t.getImage().byteLength, 0);
  log(`textures ${(texBytes / 1e6).toFixed(1)} MB, geometry ${((size - texBytes) / 1e6).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
