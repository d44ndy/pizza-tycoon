/** Point d'entrée : monte React et démarre la boucle de jeu. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
// Typographies auto-hébergées (licence OFL) : indispensable pour que le jeu
// reste identique hors ligne, quand il deviendra une PWA en Phase 5.
import '@fontsource/alfa-slab-one/400.css';
import '@fontsource-variable/archivo';
import './ui/styles/tokens.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
