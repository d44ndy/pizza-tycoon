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
  type PrestigeEffect, type PrestigeNodeDef,
} from '../data/prestige.ts';
import { OFFLINE_BASE_CAP_SECONDS, OFFLINE_BASE_EFFICIENCY } from '../data/config.ts';
import { JACKPOT_SECONDS } from '../data/events.ts';
import { CHALLENGES_BY_ID } from '../data/challenges.ts';
import { CITIES, CITY_CAPS, type CityId } from '../data/cities.ts';
import { chefEffects, NO_CHEF_EFFECTS } from './chefPizza.ts';

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

/** Couche 2 : les Contrats et les villes fondées (identifiant -> niveau). */
export function expansionLayer(state: GameState): PrestigeLayerState {
  return state.prestige.layers.expansion ?? EMPTY_LAYER;
}

/** Niveau d'une ville (0 = pas encore fondée). */
export function cityLevel(state: GameState, id: CityId): number {
  return expansionLayer(state).nodes[id] ?? 0;
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

export type PermanentEffects = {
  globalMult: Decimal;
  /** Multiplicateur réservé aux cuisines (les villes n'en profitent pas). */
  kitchenMult: Decimal;
  /** Multiplicateur réservé aux villes. */
  cityMult: Decimal;
  clickMult: Decimal;
  /** Multiplicateur appliqué au coût des cuisines (1 = prix plein). */
  generatorCost: number;
  /** Multiplicateur appliqué au coût des améliorations. */
  upgradeCost: number;
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

const DEFAULT_EFFECTS: PermanentEffects = {
  globalMult: ONE,
  kitchenMult: ONE,
  cityMult: ONE,
  clickMult: ONE,
  generatorCost: 1,
  upgradeCost: 1,
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
 * Agrège TOUS les effets permanents : nœuds de l'arbre de prestige, récompenses des
 * défis validés, villes de la couche 2 et garniture au four. Point d'entrée unique,
 * pour qu'aucune source d'effet ne puisse être oubliée par un appelant.
 *
 * Les effets « multiplicateurs » se multiplient entre eux ; les effets « valeur »
 * (rendement hors ligne, plafond, bonus par Étoile…) prennent le MEILLEUR,
 * pour qu'acheter la version supérieure remplace la précédente au lieu de s'y ajouter.
 */
export function permanentEffects(state: GameState): PermanentEffects {
  const nodes = recipeLayer(state).nodes;
  const challenges = Object.keys(state.challenges.completed);
  const sources: PrestigeEffect[] = [];
  for (const id of Object.keys(nodes)) {
    const effect = PRESTIGE_NODES_BY_ID[id]?.effect;
    if (effect) sources.push(effect);
  }
  for (const id of challenges) {
    const reward = CHALLENGES_BY_ID[id]?.reward;
    if (reward) sources.push(reward);
  }
  const cityLevels = CITIES.map((def) => [def, cityLevel(state, def.id)] as const)
    .filter(([, level]) => level > 0);

  const chef = chefEffects(state);
  const noChef = chef === NO_CHEF_EFFECTS;
  if (sources.length === 0 && cityLevels.length === 0 && noChef) return DEFAULT_EFFECTS;

  const result: PermanentEffects = { ...DEFAULT_EFFECTS, startGenerators: {} };
  for (const effect of sources) {
    switch (effect.type) {
      case 'globalMult': result.globalMult = result.globalMult.mul(effect.factor); break;
      case 'clickMult': result.clickMult = result.clickMult.mul(effect.factor); break;
      case 'generatorCost': result.generatorCost *= effect.factor; break;
      case 'upgradeCost': result.upgradeCost *= effect.factor; break;
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

  // Les villes (couche 2). Leurs effets sont proportionnels au niveau et plafonnés
  // là où ils finiraient sinon par casser l'économie.
  for (const [def, level] of cityLevels) {
    const effect = def.effect;
    switch (effect.type) {
      case 'kitchenBoost':
        result.kitchenMult = result.kitchenMult.mul(1 + (effect.percent / 100) * level);
        break;
      case 'cityBoost':
        result.cityMult = result.cityMult.mul(1 + (effect.percent / 100) * level);
        break;
      case 'clickBoost':
        result.clickMult = result.clickMult.mul(Math.pow(effect.factor, level));
        break;
      case 'cheaperKitchens':
        result.generatorCost *= Math.max(
          CITY_CAPS.cheaperKitchens,
          Math.pow(1 - effect.percent / 100, level),
        );
        break;
      case 'fasterEvents':
        result.eventFrequency *= Math.max(
          CITY_CAPS.fasterEvents,
          Math.pow(1 - effect.percent / 100, level),
        );
        break;
      case 'offlineBoost':
        result.offlineEfficiency = Math.min(
          CITY_CAPS.offlineEfficiency,
          result.offlineEfficiency + (effect.percent / 100) * level,
        );
        break;
    }
  }

  // La Pizza du Chef. Elle s'agrège ici comme tout le reste : c'est ce qui garantit
  // qu'aucun appelant ne peut l'oublier, ni la compter deux fois.
  if (!noChef) {
    result.globalMult = result.globalMult.mul(chef.production);
    result.clickMult = result.clickMult.mul(chef.click);
    result.eventFrequency *= chef.eventFrequency;
  }

  return result;
}

/** Multiplicateur apporté par les Étoiles NON dépensées. */
export function starMultiplier(state: GameState): Decimal {
  const stars = recipeLayer(state).currency;
  if (stars.lte(0)) return ONE;
  return ONE.add(stars.mul(permanentEffects(state).starBonus));
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

/**
 * Ce qu'un prestige immédiat permettrait d'acheter : les nœuds disponibles dont le prix
 * tient dans la banque PLUS les Étoiles en attente, les moins chers d'abord.
 * C'est l'aperçu affiché sous le bouton « Brûler la recette » (et la règle du simulateur).
 */
export function nodesAffordableAfterPrestige(state: GameState): PrestigeNodeDef[] {
  const budget = recipeLayer(state).currency.add(pendingStars(state));
  return PRESTIGE_TREE
    .filter((def) => isNodeAvailable(state, def) && budget.gte(def.cost))
    .sort((a, b) => a.cost - b.cost);
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
/**
 * Repart d'une partie neuve : pizzas, cuisines, améliorations et statistiques de run
 * remises à zéro, cuisines et pizzas de départ de l'arbre appliquées, Étoiles méritées
 * encaissées au passage.
 *
 * Partagé par le prestige et par l'entrée/sortie de défi, pour qu'il n'existe qu'une
 * seule définition de « recommencer une partie ».
 */
export function resetRun(state: GameState): GameState {
  const gained = pendingStars(state);
  const layer = recipeLayer(state);
  const effects = permanentEffects(state);

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
    automation: { clickCredit: 0, buyCooldown: 0 },
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
          // Une remise à zéro ne compte comme prestige que si elle rapporte une Étoile.
          resets: gained.gte(1) ? layer.resets + 1 : layer.resets,
        },
      },
    },
  };
}

export function doPrestige(state: GameState): PrestigeResult {
  const gained = pendingStars(state);
  if (gained.lt(1)) return { state, gained: ZERO };
  return { gained, state: resetRun(state) };
}

/* ------------------------------------------------------------------ */
/* Refaire l'arbre                                                     */
/* ------------------------------------------------------------------ */

/** Étoiles actuellement investies dans l'arbre (ce qu'une remise à plat rendrait). */
export function spentStars(state: GameState): number {
  return Object.keys(recipeLayer(state).nodes).reduce(
    (sum, id) => sum + (PRESTIGE_NODES_BY_ID[id]?.cost ?? 0),
    0,
  );
}

/**
 * Refaire l'arbre : toutes les Étoiles investies sont rendues, et la partie repart
 * de zéro comme après une Recette Secrète.
 *
 * La remise à zéro est le prix à payer, et c'est voulu. Sans elle, on pourrait
 * basculer vers les nœuds « hors ligne » juste avant de quitter le jeu, puis revenir
 * aux nœuds « actifs » en rentrant : une optimisation fastidieuse que personne ne
 * devrait se sentir obligé de faire à chaque session.
 */
export function respecTree(state: GameState): { state: GameState; refunded: number } {
  const refunded = spentStars(state);
  if (refunded <= 0) return { state, refunded: 0 };

  const layer = recipeLayer(state);
  const cleared: GameState = {
    ...state,
    prestige: {
      ...state.prestige,
      layers: {
        ...state.prestige.layers,
        recipe: { ...layer, currency: layer.currency.add(refunded), nodes: {} },
      },
    },
  };
  return { state: resetRun(cleared), refunded };
}
