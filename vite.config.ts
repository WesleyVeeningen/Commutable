/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre 6 loads its worker by URL relative to its own module; pre-bundling breaks that.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // MapLibre alone is ~1 MB minified; it's needed on first paint anyway.
  build: { chunkSizeWarningLimit: 1800 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
