// Minimal DDS reader: top mip level of DXT1, DXT3 or DXT5, returned as RGBA8.
// Enough for the ivy leaf textures, which SketchUp exported as DXT5.

function rgb565(c) {
  const r = (c >> 11) & 31;
  const g = (c >> 5) & 63;
  const b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function colourBlock(buf, o, out, w, x0, y0, forceFour) {
  const c0 = buf.readUInt16LE(o);
  const c1 = buf.readUInt16LE(o + 2);
  const p0 = rgb565(c0);
  const p1 = rgb565(c1);
  const pal = [p0, p1];
  if (c0 > c1 || forceFour) {
    pal.push(p0.map((v, i) => Math.round((2 * v + p1[i]) / 3)));
    pal.push(p0.map((v, i) => Math.round((v + 2 * p1[i]) / 3)));
  } else {
    pal.push(p0.map((v, i) => Math.round((v + p1[i]) / 2)));
    pal.push(null); // transparent black (DXT1 only)
  }
  const bits = buf.readUInt32LE(o + 4);
  for (let i = 0; i < 16; i++) {
    const x = x0 + (i & 3);
    const y = y0 + (i >> 2);
    const idx = (bits >>> (2 * i)) & 3;
    const p = pal[idx];
    const d = (y * w + x) * 4;
    if (p === null) {
      out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0;
    } else {
      out[d] = p[0];
      out[d + 1] = p[1];
      out[d + 2] = p[2];
      out[d + 3] = 255;
    }
  }
}

function alphaBlockDXT5(buf, o, out, w, x0, y0) {
  const a0 = buf[o];
  const a1 = buf[o + 1];
  const pal = [a0, a1];
  if (a0 > a1) {
    for (let i = 1; i < 7; i++) pal.push(Math.round(((7 - i) * a0 + i * a1) / 7));
  } else {
    for (let i = 1; i < 5; i++) pal.push(Math.round(((5 - i) * a0 + i * a1) / 5));
    pal.push(0, 255);
  }
  // 48 bits of 3-bit indices
  let bits = 0n;
  for (let i = 0; i < 6; i++) bits |= BigInt(buf[o + 2 + i]) << BigInt(8 * i);
  for (let i = 0; i < 16; i++) {
    const idx = Number((bits >> BigInt(3 * i)) & 7n);
    const x = x0 + (i & 3);
    const y = y0 + (i >> 2);
    out[(y * w + x) * 4 + 3] = pal[idx];
  }
}

function alphaBlockDXT3(buf, o, out, w, x0, y0) {
  for (let i = 0; i < 16; i++) {
    const byte = buf[o + (i >> 1)];
    const a4 = i & 1 ? byte >> 4 : byte & 15;
    const x = x0 + (i & 3);
    const y = y0 + (i >> 2);
    out[(y * w + x) * 4 + 3] = a4 * 17;
  }
}

export function decodeDDS(buf) {
  if (buf.toString('ascii', 0, 4) !== 'DDS ') throw new Error('not a DDS file');
  const height = buf.readUInt32LE(12);
  const width = buf.readUInt32LE(16);
  const fourCC = buf.toString('ascii', 84, 88);
  const bw = Math.max(1, (width + 3) >> 2);
  const bh = Math.max(1, (height + 3) >> 2);
  const pw = bw * 4;
  const ph = bh * 4;
  const out = new Uint8Array(pw * ph * 4);
  let o = 128;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const x0 = bx * 4;
      const y0 = by * 4;
      if (fourCC === 'DXT1') {
        colourBlock(buf, o, out, pw, x0, y0, false);
        o += 8;
      } else if (fourCC === 'DXT3' || fourCC === 'DXT5') {
        colourBlock(buf, o + 8, out, pw, x0, y0, true);
        if (fourCC === 'DXT5') alphaBlockDXT5(buf, o, out, pw, x0, y0);
        else alphaBlockDXT3(buf, o, out, pw, x0, y0);
        o += 16;
      } else {
        throw new Error(`unsupported DDS format ${fourCC}`);
      }
    }
  }
  // crop padding if the size was not a multiple of 4
  if (pw === width && ph === height) return { width, height, data: out };
  const cropped = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    cropped.set(out.subarray(y * pw * 4, y * pw * 4 + width * 4), y * width * 4);
  }
  return { width, height, data: cropped };
}
