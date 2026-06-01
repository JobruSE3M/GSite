import { defineConfig } from 'vite';

const NGROK_HOST = 'roulette-semicolon-battery.ngrok-free.dev';

/** Base URL pour GitHub Pages : /NomDuRepo/ */
function resolveBase(command) {
  if (command !== 'build') return '/';

  if (process.env.VITE_BASE_PATH) {
    const base = process.env.VITE_BASE_PATH;
    return base.endsWith('/') ? base : base + '/';
  }

  // En CI GitHub Actions : déduit le nom du repo (ex. /GSite/)
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repo}/`;
  }

  // SharePoint / dossier local : chemins relatifs
  return './';
}

/** @type {import('vite').UserConfig} */
export default defineConfig(({ command }) => ({
  base: resolveBase(command),
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', NGROK_HOST],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
}));
