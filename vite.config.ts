import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` : les chemins d'assets sont relatifs, ce qui rend le build déployable
// aussi bien à la racine d'un domaine que dans un sous-dossier GitHub Pages (/nom-du-repo/).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
