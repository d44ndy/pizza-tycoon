/**
 * Prestige couche 1 : calcul des Étoiles, arbre de compétences, remise à zéro.
 *
 * Ce module ne dépend que des données et de l'état : il est volontairement en amont
 * de `formulas.ts` (qui, lui, consomme les effets de l'arbre) pour éviter tout cycle.
 */
import { D, ONE, ZERO, type Decimal } from './decimal.ts';
import type { GameState, PrestigeLayerState } from './state.ts';
import { GENERATORS, type GeneratorId } from '../data/generators.ts';
import {
  PRESTIGE_NODES_BY_ID, PRESTIGE_TREE, STAR_BASE_BONUS, STAR_DIVISOR,
  type PrestigeNodeDef,
} from '../data/prestige.ts';
import { OFFLINE_BASE_CAP_SECONDS, OFFLINE_BASE_EFFICIENCY } from '../data/config.ts';
import { JACKPOT_SECONDS } from '../data/events.ts';

/** Couche de prestige vide, utilisée tant que le joueur n'a jamais prestigé. */
export const EMPTY_LAYER: PrestigeLayerState = {
  currency: ZERO,
  totalEarned: ZERO,
  resets: 0,
  nodes: {},
};

export function recipeLayer(state: GameState): PrestigeLayerState {
  return state.prestige.layers.recipe ?? EMPTY_LAYER;
}

/* ------------------------------------------------------------------ */
/* Étoiles                                                             */
/* ------------------------------------------------------------------ */

/**
 * Étoiles totales méritées : racine cubique du cumul de pizzas divisé par 1e9.
 * On passe par `Math.cbrt` tant que le nombre tient dans un flottant : la racine
 * cubique de break_eternity passe par exp/log et perd des décimales.
 */
export function starsFromTotal(total: Decimal): Decimal {
  const scaled = total.div(STAR_DIVISOR);
  if (scaled.lt(1)) return ZERO;
  const asNumber = scaled.toNumber();
  if (Number.isFinite(asNumber) && asNumber < 1e15) return D(Math.floor(Math.cbrt(asNumber)));
  return scaled.pow(1 / 3).floor();
}

/** Étoiles que rapporterait un prestige immédiat. */
export function pendingStars(state: GameState): Decimal {
  const merited = starsFromTotal(state.stats.earnedPrestige);
  const already = recipeLayer(state).totalEarned;
  const pending = merited.sub(already);
  return pending.gt(0) ? pending : ZERO;
}

export function canPrestige(state: GameState): boolean {
  return pendingStars(state).gte(1);
}

/** Pizzas cumulées nécessaires pour mériter `stars` Étoiles (pour la barre de progression). */
export function totalForStars(stars: Decimal): Decimal {
  return stars.pow(3).mul(STAR_DIVISOR);
}

/* ------------------------------------------------------------------ */
/* Effets de l'arbre                                                   */
/* ------------------------------------------------------------------ */

export type TreeEffects = {
  globalMult: Decimal;
  clickMult: Decimal;
  /** Multiplicateur appliqué au coût des cuisines (1 = prix plein). */
  generatorCost: number;
  /** Bonus de production par Étoile non dépensée. */
  starBonus: number;
  offlineEfficiency: number;
  offlineCapSeconds: number;
  /** Multiplicateur du délai entre deux pizzas d'or (< 1 = plus fréquentes). */
  eventFrequency: number;
  eventDuration: number;
  jackpotSeconds: number;
  startGenerators: Partial<Record<GeneratorId, number>>;
  startPizzas: number;
  autoClick: number;
  autoBuyGenerators: boolean;
  autoBuyUpgrades: boolean;
};

const DEFAULT_EFFECTS: TreeEffects = {
  globalMult: ONE,
  clickMult: ONE,
  generatorCost: 1,
  starBonus: STAR_BASE_BONUS,
  offlineEfficiency: OFFLINE_BASE_EFFICIENCY,
  offlineCapSeconds: OFFLINE_BASE_CAP_SECONDS,
  eventFrequency: 1,
  eventDuration: 1,
  jackpotSeconds: JACKPOT_SECONDS,
  startGenerators: {},
  startPizzas: 0,
  autoClick: 0,
  autoBuyGenerators: false,
  autoBuyUpgrades: false,
};

/**
 * Agrège les effets des nœuds possédés.
 *
 * Les effets « multiplicateurs » se multiplient entre eux ; les effets « valeur »
 * (rendement hors ligne, plafond, bonus par Étoile…) prennent le MEILLEUR nœud,
 * pour qu'acheter la version supérieure remplace la précédente au lieu de s'y ajouter.
 */
export function treeEffects(state: GameState): TreeEffects {
  const nodes = recipeLayer(state).nodes;
  const ids = Object.keys(nodes);
  if (ids.length === 0) return DEFAULT_EFFECTS;

  const result: TreeEffects = { ...DEFAULT_EFFECTS, startGenerators: {} };
  for (const id of ids) {
    const effect = PRESTIGE_NODES_BY_ID[id]?.effect;
    if (!effect) continue;
    switch (effect.type) {
      case 'globalMult': result.globalMult = result.globalMult.mul(effect.factor); break;
      case 'clickMult': result.clickMult = result.clickMult.mul(effect.factor); break;
      case 'generatorCost': result.generatorCost *= effect.factor; break;
      case 'starBonus': result.starBonus = Math.max(result.starBonus, effect.perStar); break;
      case 'offlineEfficiency': result.offlineEfficiency = Math.max(result.offlineEfficiency, effect.value); break;
      case 'offlineCap': result.offlineCapSeconds = Math.max(result.offlineCapSeconds, effect.hours * 3600); break;
      case 'eventFrequency': result.eventFrequency *= effect.factor; break;
      case 'eventDuration': result.eventDuration = Math.max(result.eventDuration, effect.factor); break;
      case 'jackpotSeconds': result.jackpotSeconds = Math.max(result.jackpotSeconds, effect.value); break;
      case 'startPizzas': result.startPizzas = Math.max(result.startPizzas, effect.amount); break;
      case 'autoClick': result.autoClick = Math.max(result.autoClick, effect.perSecond); break;
      case 'autoBuyGenerators': result.autoBuyGenerators = true; break;
      case 'autoBuyUpgrades': result.autoBuyUpgrades = true; break;
      case 'startGenerators':
        result.startGenerators[effect.id] = Math.max(result.startGenerators[effect.id] ?? 0, effect.count);
        break;
    }
  }
  return result;
}

/** Multiplicateur apporté par les Étoiles NON dépensées. */
export function starMultiplier(state: GameState): Decimal {
  const stars = recipeLayer(state).currency;
  if (stars.lte(0)) return ONE;
  return ONE.add(stars.mul(treeEffects(state).starBonus));
}

/* ------------------------------------------------------------------ */
/* Achat de nœuds                                                      */
/* ------------------------------------------------------------------ */

export function hasNode(state: GameState, id: string): boolean {
  return (recipeLayer(state).nodes[id] ?? 0) > 0;
}

/** Un nœud est disponible quand tous ses prérequis sont acquis. */
export function isNodeAvailable(state: GameState, def: PrestigeNodeDef): boolean {
  return !hasNode(state, def.id) && def.requires.every((req) => hasNode(state, req));
}

export function canBuyNode(state: GameState, def: PrestigeNodeDef): boolean {
  return isNodeAvailable(state, def) && recipeLayer(state).currency.gte(def.cost);
}

export function buyNode(state: GameState, id: string): { state: GameState; bought: boolean } {
  const def = PRESTIGE_NODES_BY_ID[id];
  if (!def || !canBuyNode(state, def)) return { state, bought: false };

  const layer = recipeLayer(state);
  return {
    state: {
      ...state,
      prestige: {
        ...state.prestige,
        layers: {
          ...state.prestige.layers,
          recipe: {
            ...layer,
            currency: layer.currency.sub(def.cost),
            nodes: { ...layer.nodes, [id]: 1 },
          },
        },
      },
    },
    bought: true,
  };
}

/** Nœuds affichés : acquis, disponibles, ou verrouillés dont un prérequis est acquis. */
export function visibleNodes(state: GameState): PrestigeNodeDef[] {
  return PRESTIGE_TREE.filter(
    (def) => hasNode(state, def.id) || def.requires.every((req) => hasNode(state, req)) || def.requires.length > 0,
  );
}

/* ------------------------------------------------------------------ */
/* La remise à zéro                                                    */
/* ------------------------------------------------------------------ */

export type PrestigeResult = { state: GameState; gained: Decimal };

/**
 * Brûle l'empire et repart avec une meilleure recette.
 *
 * Remis à zéro : pizzas, cuisines, améliorations, statistiques de la run, pizzas d'or.
 * Conservé : hauts faits, drapeaux, statistiques globales, Étoiles et arbre, réglages.
 */
export function doPrestige(state: GameState): PrestigeResult {
  const gained = pendingStars(state);
  if (gained.lt(1)) return { state, gained: ZERO };

  const layer = recipeLayer(state);
  const effects = treeEffects(state);

  const generators = {} as GameState['generators'];
  for (const def of GENERATORS) {
    const start = effects.startGenerators[def.id] ?? 0;
    generators[def.id] = {
      id: def.id,
      owned: start,
      totalBought: start,
      unlocked: start > 0,
    };
  }

  return {
    gained,
    state: {
      ...state,
      pizzas: D(effects.startPizzas),
      generators,
      upgrades: {},
      events: {
        nextSpawnAt: 0,
        pending: null,
        buffs: [],
        clickBurst: { count: 0, since: 0 },
      },
      stats: {
        ...state.stats,
        playTimeRun: 0,
        clicks: 0,
        earnedRun: D(effects.startPizzas),
        bestPizzas: D(effects.startPizzas),
      },
      prestige: {
        ...state.prestige,
        layers: {
          ...state.prestige.layers,
          recipe: {
            ...layer,
            currency: layer.currency.add(gained),
            totalEarned: layer.totalEarned.add(gained),
            resets: layer.resets + 1,
          },
        },
      },
    },
  };
}
