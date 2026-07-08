export default defineConfig({
  base: '/GSite/',
  // ... le reste de votre config
});
import { defineConfig } from 'vite';

const NGROK_HOST = 'roulette-semicolon-battery.ngrok-free.dev';

/** Base URL pour GitHub Pages : /NomDuRepo/ */
function resolveBase(command) {
  if (command !== 'build') return '/';

  // Permet de surcharger le chemin si besoin via une variable d'environnement
  if (process.env.VITE_BASE_PATH) {
    const base = process.env.VITE_BASE_PATH;
    return base.endsWith('/') ? base : base + '/';
  }

  // Comportement par défaut pour Azure SWA (et la majorité des hébergeurs)
  return '/';
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
