// Report a bug: a short form, plus the details that help find it (the version, the
// browser and graphics card, where you were, the time, the date and the weather in the
// viewer, the quality setting and frame rate, and the last errors the page hit). It can
// open a GitHub issue with all of it filled in, open an email (once an address is set in
// credits.js), or copy the report to paste anywhere.

import { CREDITS } from './credits.js';

const recent = [];
function remember(text) {
  recent.push(`${new Date().toISOString().slice(11, 19)} ${String(text).slice(0, 300)}`);
  if (recent.length > 12) recent.shift();
}

/** Keeps the last few errors the page hits, for the report. Call it first thing. */
export function installErrorLog() {
  window.addEventListener('error', (e) => remember(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => remember(`unhandled: ${e.reason?.message ?? e.reason}`));
  const original = console.error.bind(console);
  console.error = (...args) => {
    remember(args.map((a) => (a instanceof Error ? a.message : typeof a === 'object' ? safeJSON(a) : String(a))).join(' '));
    original(...args);
  };
}

function safeJSON(v) {
  try {
    return JSON.stringify(v).slice(0, 200);
  } catch {
    return String(v);
  }
}

function graphicsCard(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch {
    return 'unknown';
  }
}

/**
 * Wires up the form.
 * @param {() => object} details what to say about this moment (version, mode, place, time…)
 */
export function setupReport(details, renderer) {
  const $ = (id) => document.getElementById(id);
  const open = () => {
    $('report-panel').hidden = false;
    $('report-text').focus();
    $('report-sent').textContent = '';
    $('report-email').hidden = !CREDITS.reportEmail;
  };
  const close = () => ($('report-panel').hidden = true);
  $('report-bug').onclick = (e) => {
    e.currentTarget.blur();
    open();
  };
  $('report-close').onclick = close;
  $('report-panel').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation(); // typing here doesn't walk you about
  });
  $('report-panel').addEventListener('keyup', (e) => e.stopPropagation());

  const compose = () => {
    const what = $('report-text').value.trim() || '(no description)';
    const who = $('report-from').value.trim();
    const d = details();
    const lines = [
      what,
      '',
      who ? `From: ${who}` : '',
      '---',
      `Viewer: ${d.version}`,
      `Where: ${d.mode}, camera at ${d.camera}, looking at ${d.target}`,
      `In the viewer: ${d.date}, ${d.time}, ${d.weather}`,
      `Quality: ${d.quality}, ${d.fps}`,
      `Browser: ${navigator.userAgent}`,
      `Graphics: ${graphicsCard(renderer)}`,
      `Screen: ${innerWidth} x ${innerHeight} at ${devicePixelRatio}x`,
      `Reported: ${new Date().toString()}`,
      recent.length ? `Recent errors:\n${recent.join('\n')}` : 'Recent errors: none',
    ].filter((l) => l !== '');
    const title = `Bug: ${what.split('\n')[0].slice(0, 70)}`;
    return { title, body: lines.join('\n') };
  };

  $('report-github').onclick = () => {
    const { title, body } = compose();
    const url = `${CREDITS.issues}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, 6000))}`;
    window.open(url, '_blank', 'noopener');
    $('report-sent').textContent = 'A GitHub issue opened in a new tab, filled in: check it and press Submit.';
  };
  $('report-email').onclick = () => {
    const { title, body } = compose();
    location.href = `mailto:${CREDITS.reportEmail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
    $('report-sent').textContent = 'Your email app should have opened with the report in it.';
  };
  $('report-copy').onclick = async () => {
    const { title, body } = compose();
    try {
      await navigator.clipboard.writeText(`${title}\n\n${body}`);
      $('report-sent').textContent = 'Copied. Paste it wherever suits you.';
    } catch {
      $('report-sent').textContent = 'Copying was blocked by the browser.';
    }
  };
  return { open, compose };
}
