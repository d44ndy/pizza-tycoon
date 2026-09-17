import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` : les chemins d'assets sont relatifs, ce qui rend le build déployable
// aussi bien à la racine d'un domaine que dans un sous-dossier GitHub Pages (/nom-du-repo/).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pizza Tycoon',
        short_name: 'Pizza Tycoon',
        description: 'Du garage à la galaxie : bâtis ton empire de la pizza.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#e9dcc3',
        theme_color: '#b8372a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le jeu tient entièrement dans le bundle : tout est précaché, y compris
        // les polices auto-hébergées. Aucune requête réseau une fois installé.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
