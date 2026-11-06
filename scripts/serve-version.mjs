// Runs an earlier release next to the current one, to compare or to go back to.
//
//   npm run versions                       lists the releases
//   npm run serve:version -- v0.8.0        serves v0.8.0 on http://localhost:5191
//   npm run serve:version -- v0.8.0 5192   ...on another port
//
// Each release is checked out once into ../CroftManorViewer-versions/<tag> (outside this
// folder, so the main dev server doesn't watch it), with node_modules cloned (a quick
// copy-on-write on this Mac's disk; a link would stop the collision worker loading) and
// the built model linked in.

import { execSync, spawn } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const [tag, portArg] = process.argv.slice(2);

if (!tag || tag === '--list') {
  for (const t of sh('git tag --sort=-v:refname').split('\n').filter(Boolean)) {
    const [date, subject] = sh(`git log -1 --format=%cs%x09%s ${t}`).split('\t');
    const what = subject.replace(/^v[\d.]+: */, '');
    console.log(`${t.padEnd(8)} ${date}  ${what.length > 100 ? what.slice(0, 99) + '…' : what}`);
  }
  console.log('\nRun one with: npm run serve:version -- <tag> [port]');
  process.exit(0);
}
if (!sh('git tag').split('\n').includes(tag)) {
  console.error(`No release called ${tag}. npm run versions lists them.`);
  process.exit(1);
}

const dir = path.resolve(root, '..', 'CroftManorViewer-versions', tag);
if (!existsSync(dir)) {
  mkdirSync(path.dirname(dir), { recursive: true });
  console.log(`Checking out ${tag} into ${dir}…`);
  sh(`git worktree add --detach "${dir}" ${tag}`);
  sh(`cp -c -R "${path.join(root, 'node_modules')}" "${path.join(dir, 'node_modules')}" || cp -R "${path.join(root, 'node_modules')}" "${path.join(dir, 'node_modules')}"`);
  execSync(`rm -rf "${path.join(dir, 'node_modules', '.vite')}"`);
}
const glb = path.join(dir, 'public', 'manor.glb');
if (!existsSync(glb)) {
  const src = path.join(root, 'public', 'manor.glb');
  if (!existsSync(src)) {
    console.error('public/manor.glb is missing here too: run npm run build:model first.');
    process.exit(1);
  }
  try {
    linkSync(src, glb);
  } catch {
    copyFileSync(src, glb);
  }
}

const port = portArg || '5191';
console.log(`${tag} on http://localhost:${port} (Ctrl-C stops it; the current version stays on :5190)`);
spawn('npx', ['vite', '--port', port, '--strictPort'], { cwd: dir, stdio: 'inherit' });
