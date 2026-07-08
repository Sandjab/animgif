import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // chemins relatifs → fonctionne sur GitHub Pages quel que soit le nom du repo
  optimizeDeps: { exclude: ['gifski-wasm'] },
});
