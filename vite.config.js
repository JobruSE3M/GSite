import { defineConfig } from 'vite';

const NGROK_HOST = 'roulette-semicolon-battery.ngrok-free.dev';

/** @type {import('vite').UserConfig} */
export default defineConfig(({ command }) => ({
  // Dev : '/' (évite écran blanc). Prod SharePoint : chemins relatifs
  base: command === 'build' ? './' : '/',
  server: {
    port: 5173,
    strictPort: true,
    // Requis pour ngrok (sinon tunnel = endpoint offline)
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', NGROK_HOST],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
}));
