// The viewer's version: the panel shows the release number from package.json, and
// whether the code you are looking at is exactly that release or has changes since it.
// In development /version.json asks git on every request; a build writes it once.

import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const readVersion = () => JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

function versionInfo() {
  const git = (args) => {
    try {
      return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  };
  const version = readVersion();
  const describe = git('describe --tags --dirty --always');
  return { version, describe, exact: describe === `v${version}`, date: git(`log -1 --format=%cs v${version}`) };
}

export default defineConfig({
  define: { 'import.meta.env.APP_VERSION': JSON.stringify(readVersion()) },
  plugins: [
    {
      name: 'version-json',
      configureServer(server) {
        server.middlewares.use('/version.json', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(versionInfo()));
        });
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(versionInfo()) });
      },
    },
  ],
});
