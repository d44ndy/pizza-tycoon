/**
 * Définition de l'état de jeu et de son état initial.
 *
 * `GameState` est un objet **pur** (aucune référence au DOM, à React ou au temps réel)
 * et **sérialisable** : c'est lui qu'on sauvegarde, qu'on rejoue dans les tests et
 * qu'on fera tourner dans le simulateur d'équilibrage.
 */
import { ZERO, type Decimal } from './decimal.ts';
import { createSeed, type RngState } from './rng.ts';
import { GENERATORS, type GeneratorId } from '../data/generators.ts';
import { SAVE_VERSION } from '../data/config.ts';
import type { Notation } from './format.ts';

/** Quantité achetée d'un coup ; 'max' = tout ce que le stock permet. */
export type BulkMode = 1 | 10 | 100 | 'max';

/** Onglets de l'interface (les suivants arriveront avec leurs phases respectives). */
export type TabId = 'game' | 'stats' | 'options';

export type GeneratorState = {
  readonly id: GeneratorId;
  /** Exemplaires actuellement possédés. */
  owned: number;
  /** Cumul acheté sur la run (statistique, sert aux succès en Phase 2). */
  totalBought: number;
  /** Devenu visible : une fois vrai, le reste (on ne re-cache jamais un générateur). */
  unlocked: boolean;
};

/**
 * Couches de prestige. Le dictionnaire est vide en Phase 1 mais la structure existe déjà :
 * la Phase 3 ajoutera 'recipe' (Recette Secrète / ⭐ Étoiles) et la Phase 5 'expansion'.
 */
export type PrestigeLayerId = 'recipe' | 'expansion';

export type PrestigeLayerState = {
  /** Monnaie de prestige non dépensée. */
  currency: Decimal;
  /** Cumul historique gagné sur cette couche. */
  totalEarned: Decimal;
  /** Nombre de resets effectués sur cette couche. */
  resets: number;
  /** Nœuds d'arbre achetés (id -> niveau). */
  nodes: Record<string, number>;
};

export type Stats = {
  /** Horodatage de création de la partie. */
  createdAt: number;
  /** Temps de jeu (secondes) sur la run en cours / depuis toujours. */
  playTimeRun: number;
  playTimeTotal: number;
  /** Clics sur la run en cours / depuis toujours. */
  clicks: number;
  clicksTotal: number;
  /** Pizzas gagnées : run en cours, depuis la dernière transcendance, depuis toujours. */
  earnedRun: Decimal;
  earnedPrestige: Decimal;
  earnedTotal: Decimal;
  /** Pizzas produites à la main (au clic), depuis toujours. */
  handmadeTotal: Decimal;
  /** Plus gros stock atteint sur la run. */
  bestPizzas: Decimal;
};

export type Settings = {
  notation: Notation;
  bulkMode: BulkMode;
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  sound: boolean;
};

export type GameState = {
  /** Version du format de sauvegarde (voir engine/save.ts). */
  version: number;
  /** Stock de pizzas. */
  pizzas: Decimal;
  generators: Record<GeneratorId, GeneratorState>;
  stats: Stats;
  settings: Settings;
  ui: { tab: TabId };
  prestige: { layers: Partial<Record<PrestigeLayerId, PrestigeLayerState>> };
  rng: RngState;
  /** Horodatage (ms) de la dernière sauvegarde — base du calcul hors ligne. */
  lastSaved: number;
};

/** État initial d'une nouvelle partie. */
export function createInitialState(now: number = Date.now(), seed: number = createSeed()): GameState {
  const generators = {} as Record<GeneratorId, GeneratorState>;
  for (const def of GENERATORS) {
    generators[def.id] = {
      id: def.id,
      owned: 0,
      totalBought: 0,
      // Révélation progressive : tout est caché au départ (voir updateUnlocks dans tick.ts).
      unlocked: false,
    };
  }

  return {
    version: SAVE_VERSION,
    pizzas: ZERO,
    generators,
    stats: {
      createdAt: now,
      playTimeRun: 0,
      playTimeTotal: 0,
      clicks: 0,
      clicksTotal: 0,
      earnedRun: ZERO,
      earnedPrestige: ZERO,
      earnedTotal: ZERO,
      handmadeTotal: ZERO,
      bestPizzas: ZERO,
    },
    settings: {
      notation: 'standard',
      bulkMode: 1,
      theme: 'dark',
      reducedMotion: false,
      sound: false,
    },
    ui: { tab: 'game' },
    prestige: { layers: {} },
    rng: { seed },
    lastSaved: now,
  };
}

/** Raccourci utilisé par les tests : un état neuf, déterministe. */
export function createTestState(): GameState {
  return createInitialState(0, 12345);
}
