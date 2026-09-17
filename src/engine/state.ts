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
import type { EventKind } from '../data/events.ts';
import type { FlagId } from '../data/achievements.ts';
import type { Notation } from './format.ts';

/** Quantité achetée d'un coup ; 'max' = tout ce que le stock permet. */
export type BulkMode = 1 | 10 | 100 | 'max';

/** Onglets de l'interface (les suivants arriveront avec leurs phases respectives). */
export type TabId = 'game' | 'succes' | 'prestige' | 'defis' | 'stats' | 'options';

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

/** Pizza d'or actuellement affichée à l'écran. */
export type PendingEvent = {
  readonly kind: EventKind;
  /** Instant d'apparition, en secondes de jeu. */
  readonly bornAt: number;
  /** Position en pourcentage de la zone de jeu. */
  readonly x: number;
  readonly y: number;
};

/** Effet temporaire en cours (bonus de production, frénésie, malus). */
export type ActiveBuff = {
  readonly kind: EventKind;
  /** Fin de l'effet, en secondes de jeu. */
  readonly endsAt: number;
};

export type EventsState = {
  /** Prochaine apparition, en secondes de jeu (0 = pas encore planifiée). */
  nextSpawnAt: number;
  pending: PendingEvent | null;
  buffs: readonly ActiveBuff[];
  /** Fenêtre glissante pour le haut fait « 100 clics en 10 secondes ». */
  clickBurst: { count: number; since: number };
};

/**
 * Accumulateurs de l'automatisation (arbre de prestige).
 * Volontairement HORS sauvegarde : ce sont des restes de fraction de seconde,
 * les recharger n'aurait aucun sens.
 */
export type AutomationState = {
  /** Fraction de clic automatique en attente. */
  clickCredit: number;
  /** Secondes restantes avant la prochaine passe d'achat automatique. */
  buyCooldown: number;
};

/** Défis : celui en cours (s'il y en a un) et ceux déjà validés. */
export type ChallengesState = {
  /** Identifiant du défi en cours, ou null. */
  active: string | null;
  /** Identifiant -> instant de validation, en secondes de jeu. */
  completed: Record<string, number>;
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
  /** Pizzas d'or attrapées, depuis toujours. */
  eventsClicked: number;
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
  /** Améliorations achetées (identifiant -> vrai). */
  upgrades: Record<string, true>;
  /** Hauts faits obtenus (identifiant -> instant d'obtention, en secondes de jeu). */
  achievements: Record<string, number>;
  /** Faits marquants signalés par le moteur ou l'interface. */
  flags: Partial<Record<FlagId, true>>;
  events: EventsState;
  challenges: ChallengesState;
  automation: AutomationState;
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
    upgrades: {},
    achievements: {},
    flags: {},
    events: {
      nextSpawnAt: 0,
      pending: null,
      buffs: [],
      clickBurst: { count: 0, since: 0 },
    },
    challenges: { active: null, completed: {} },
    automation: { clickCredit: 0, buyCooldown: 0 },
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
      eventsClicked: 0,
    },
    settings: {
      notation: 'standard',
      bulkMode: 1,
      theme: 'light',
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
