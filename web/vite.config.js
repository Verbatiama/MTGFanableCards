import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Frontend build (T-C2, D27). `npm run web:build` writes web/dist/, which the
 * API serves at /; `npm run web:dev` serves the UI with hot reload and proxies
 * the API and the font and symbol files to `npm start` on port 3000.
 */
const api = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Not "assets": /assets/ is where the API serves fonts and symbols.
    assetsDir: 'static',
  },
  server: {
    proxy: { '/api': api, '/assets/fonts': api, '/assets/symbols': api },
  },
});
