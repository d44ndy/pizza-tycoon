/**
 * Store Zustand : il ne contient QUE le dernier instantané publié par la boucle de jeu.
 * Aucune logique de jeu ici — c'est une vitrine pour React.
 */
import { create } from 'zustand';
import { ZERO, type Decimal } from '../engine/decimal.ts';
import { createInitialState, type GameState } from '../engine/state.ts';
import type { OfflineResult } from '../engine/offline.ts';

export type Snapshot = {
  /** État de jeu (immuable) au moment de la publication. */
  state: GameState;
  /** Production totale en pizzas/s, calculée une fois par publication. */
  production: Decimal;
};

export type GameStore = Snapshot & {
  /** Résultat hors ligne à afficher dans une popup (null = rien à montrer). */
  offline: OfflineResult | null;
  /** Contenu brut d'une sauvegarde illisible, à proposer à l'export. */
  corrupted: string | null;
  /** Message éphémère (« Copié ! », « Partie sauvegardée ! »…). */
  toast: string | null;
  publish: (snapshot: Snapshot) => void;
  setOffline: (offline: OfflineResult | null) => void;
  setCorrupted: (raw: string | null) => void;
  setToast: (message: string | null) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  state: createInitialState(),
  production: ZERO,
  offline: null,
  corrupted: null,
  toast: null,
  publish: (snapshot) => set(snapshot),
  setOffline: (offline) => set({ offline }),
  setCorrupted: (corrupted) => set({ corrupted }),
  setToast: (toast) => set({ toast }),
}));

/* Sélecteurs pratiques (évitent de re-rendre tout l'écran pour une broutille). */
export const selectState = (s: GameStore): GameState => s.state;
export const selectSettings = (s: GameStore) => s.state.settings;
export const selectTab = (s: GameStore) => s.state.ui.tab;
export const selectPizzas = (s: GameStore) => s.state.pizzas;
export const selectProduction = (s: GameStore) => s.production;
