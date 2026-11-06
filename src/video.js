// Making a video of a flyby: an MP4 (H.264 picture, AAC sound) for YouTube (1920 x 1080)
// or an Instagram reel (1080 x 1920), with the flyby's film bars, a title, the credits and
// links, and an end card.
//
// It renders frame by frame at a steady 30 a second, however long each frame takes to draw,
// so the video is smooth on any computer: every frame goes through the browser's own video
// encoder (WebCodecs). The sound is rendered afterwards on an offline audio context, from
// the same camera path frame by frame (the doors that opened included), so it is in step
// with the picture, then encoded and put in the same file (mp4-muxer).

import * as THREE from 'three';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { Soundscape } from './sound.js';
import { CREDITS } from './credits.js';

export const FORMATS = {
  youtube: { label: 'YouTube, 16:9', w: 1920, h: 1080, fov: 68, bar: 0.105 },
  portrait: { label: 'Instagram reel, 9:16', w: 1080, h: 1920, fov: 96, bar: 0.085 },
};

const FPS = 30;
const END_CARD = 5; // seconds
const TITLE = 4; // seconds the title shows at the start

export function videoSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
}

async function pickVideoCodec(w, h) {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    const config = { codec, width: w, height: h, bitrate: 12_000_000, framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } };
    if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
  }
  throw new Error('This browser cannot encode H.264 video.');
}

async function pickAudioCodec(sampleRate) {
  for (const [codec, mux] of [
    ['mp4a.40.2', 'aac'],
    ['opus', 'opus'],
  ]) {
    const config = { codec, sampleRate, numberOfChannels: 2, bitrate: 192_000 };
    if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux };
  }
  throw new Error('This browser cannot encode the sound.');
}

/** Text in the film bars, the title at the start, the end card at the end. */
function drawOverlay(g, W, H, f, frame, flyFrames, label) {
  const bar = Math.round(H * f.bar);
  const portrait = H > W;
  const t = frame / FPS;
  const u = Math.min(W, H) / 1080; // type scales with the short side
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, bar);
  g.fillRect(0, H - bar, W, bar);
  g.textBaseline = 'middle';
  const serif = `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
  const sans = `system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

  // the title, in the top bar, for the first few seconds
  if (t < TITLE) {
    const a = Math.min(1, t / 0.8, (TITLE - t) / 0.8);
    g.globalAlpha = Math.max(0, a);
    g.fillStyle = '#f3e7c9';
    g.textAlign = 'center';
    g.font = `500 ${Math.round(34 * u)}px ${serif}`;
    g.fillText(`${CREDITS.title.toUpperCase()}  ·  ${label}`, W / 2, bar / 2);
    g.globalAlpha = 1;
  }

  // the links and the credit, in the bottom bar, all the way through
  g.fillStyle = 'rgba(243, 231, 201, 0.92)';
  g.font = `500 ${Math.round(19 * u)}px ${sans}`;
  if (portrait) {
    g.textAlign = 'center';
    g.fillText(CREDITS.site, W / 2, H - bar + bar * 0.3);
    g.fillText(`${CREDITS.githubCall}: ${CREDITS.github}`, W / 2, H - bar + bar * 0.55);
    g.fillStyle = 'rgba(243, 231, 201, 0.6)';
    g.font = `400 ${Math.round(15 * u)}px ${sans}`;
    g.fillText(`${CREDITS.free} · ${CREDITS.model.replace('Model: ', '')}`, W / 2, H - bar + bar * 0.8);
  } else {
    g.textAlign = 'left';
    g.fillText(CREDITS.site, bar * 0.6, H - bar / 2);
    g.textAlign = 'right';
    g.fillText(`${CREDITS.githubCall}: ${CREDITS.github}`, W - bar * 0.6, H - bar / 2);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(243, 231, 201, 0.6)';
    g.font = `400 ${Math.round(15 * u)}px ${sans}`;
    g.fillText(`${CREDITS.free} · ${CREDITS.model.replace('Model: ', '')}`, W / 2, H - bar / 2);
  }

  // the end card: the picture fades to black, then the links and the credits
  if (frame >= flyFrames) {
    const e = (frame - flyFrames) / FPS;
    g.fillStyle = `rgba(0, 0, 0, ${Math.min(1, e / 0.8)})`;
    g.fillRect(0, 0, W, H);
    const a = Math.max(0, Math.min(1, (e - 0.6) / 0.8));
    g.globalAlpha = a;
    g.textAlign = 'center';
    const lines = [
      [CREDITS.title, `500 ${Math.round(78 * u)}px ${serif}`, '#f3e7c9', 0],
      [CREDITS.siteCall, `400 ${Math.round(26 * u)}px ${sans}`, 'rgba(243,231,201,0.75)', 1.9],
      [CREDITS.site, `600 ${Math.round(40 * u)}px ${sans}`, '#d9b45a', 2.6],
      [`${CREDITS.githubCall}`, `400 ${Math.round(26 * u)}px ${sans}`, 'rgba(243,231,201,0.75)', 3.9],
      [CREDITS.github, `600 ${Math.round(30 * u)}px ${sans}`, '#d9b45a', 4.5],
      [CREDITS.free, `500 ${Math.round(22 * u)}px ${sans}`, 'rgba(243,231,201,0.85)', 6.0],
      [`${CREDITS.model} · ${CREDITS.viewer}`, `400 ${Math.round(17 * u)}px ${sans}`, 'rgba(243,231,201,0.6)', 6.7],
      [CREDITS.rights, `400 ${Math.round(17 * u)}px ${sans}`, 'rgba(243,231,201,0.6)', 7.25],
    ];
    const step = 46 * u;
    const top = H / 2 - step * 3.6;
    for (const [text, font, colour, row] of lines) {
      g.font = font;
      g.fillStyle = colour;
      // long lines wrap on a portrait screen
      const maxW = W * 0.86;
      if (g.measureText(text).width > maxW) {
        const words = text.split(' ');
        let line = '';
        let yy = top + row * step;
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (g.measureText(test).width > maxW && line) {
            g.fillText(line, W / 2, yy);
            line = w;
            yy += step * 0.55;
          } else line = test;
        }
        g.fillText(line, W / 2, yy);
      } else g.fillText(text, W / 2, top + row * step);
    }
    g.globalAlpha = 1;
  }
}

/**
 * Makes the video. `app` is the viewer: begin(format) / end() set it up and put it back,
 * step(dt) draws a frame, canvas is the WebGL canvas, camera the camera, inside() and
 * speed() describe this moment, soundEnv() the rest of what the sound needs, takeDoorEvents()
 * the doors that sounded during the last frame, duration the flyby's length.
 * @returns {Promise<Blob>}
 */
export async function makeVideo(app, formatId, { onProgress, preview, signal } = {}) {
  const f = FORMATS[formatId];
  const W = f.w;
  const H = f.h;
  const videoConfig = await pickVideoCodec(W, H);
  const sampleRate = 48000;
  const audio = await pickAudioCodec(sampleRate);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    audio: { codec: audio.mux, numberOfChannels: 2, sampleRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (failure = e) });
  venc.configure(videoConfig);

  const out = preview ?? document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');

  const label = app.begin(f);
  const flyFrames = Math.ceil(app.duration * FPS);
  const total = flyFrames + END_CARD * FPS;
  const frames = []; // what the sound needs, frame by frame
  let last = null;
  try {
    // 1. the picture
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      if (failure) throw failure;
      if (i < flyFrames) {
        // draw the frame and copy it in the same moment (the WebGL canvas is cleared after)
        app.step(1 / FPS);
        g.drawImage(app.canvas, 0, 0, W, H);
        frames.push({ pos: app.camera.position.clone(), quat: app.camera.quaternion.clone(), inside: app.inside(), speed: app.speed(), doors: app.takeDoorEvents() });
        if (i === flyFrames - 1) last = g.getImageData(0, 0, W, H); // the end card fades from this
      } else {
        g.putImageData(last, 0, 0);
      }
      drawOverlay(g, W, H, f, i, flyFrames, label);
      const frame = new VideoFrame(out, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
      if (i % 3 === 0) {
        onProgress?.(0.85 * (i / total), `Drawing frame ${i + 1} of ${total}`);
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    await venc.flush();
    venc.close();
  } finally {
    app.end();
  }

  // 2. the sound, on an offline context, following the same camera frame by frame
  onProgress?.(0.86, 'Making the sound');
  const seconds = total / FPS;
  const actx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const sound = new Soundscape({ context: actx });
  await sound.enable();
  const cam = new THREE.PerspectiveCamera();
  const env = app.soundEnv();
  const apply = (i) => {
    const fr = frames[i];
    cam.position.copy(fr.pos);
    cam.quaternion.copy(fr.quat);
    cam.updateMatrixWorld();
    sound.update(1 / FPS, cam, { ...env, inside: fr.inside, speed: fr.speed, flyby: true });
    for (const d of fr.doors) sound.door(d.opening, d.at);
  };
  apply(0);
  for (let i = 1; i < frames.length; i++) {
    actx.suspend(i / FPS).then(() => {
      apply(i);
      actx.resume();
    });
  }
  // the sound fades out over the end card
  sound.master.gain.setValueAtTime(0.9, flyFrames / FPS);
  sound.master.gain.linearRampToValueAtTime(0, flyFrames / FPS + 3);
  const rendered = await actx.startRendering();

  // 3. encode the sound
  onProgress?.(0.95, 'Encoding the sound');
  const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => (failure = e) });
  aenc.configure(audio.config);
  const L = rendered.getChannelData(0);
  const R = rendered.getChannelData(1);
  const block = 1024;
  for (let s = 0; s < rendered.length; s += block) {
    const n = Math.min(block, rendered.length - s);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(s, s + n), 0);
    data.set(R.subarray(s, s + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((s / sampleRate) * 1e6), data });
    aenc.encode(ad);
    ad.close();
  }
  await aenc.flush();
  aenc.close();
  if (failure) throw failure;

  muxer.finalize();
  onProgress?.(1, 'Done');
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
