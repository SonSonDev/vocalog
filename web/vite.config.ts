import { defineConfig } from 'vite';

// In development the Vite server proxies /api to the Vocalog server (default port 3000, override with API_PORT).
export default defineConfig({
  root: import.meta.dirname,
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  server: {
    port: 5173,
    proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? '3000'}` },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
