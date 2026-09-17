/**
 * Prestige couche 2 — « Expansion Mondiale ».
 *
 * Transcender efface TOUT ce que la couche 1 avait construit (pizzas, cuisines,
 * améliorations, Étoiles, arbre) et rapporte des Contrats. Les Contrats fondent des
 * villes, qui produisent en parallèle et ne sont JAMAIS remises à zéro : c'est la
 * mécanique nouvelle, pas un simple multiplicateur de plus.
 *
 * Ce qui survit à une transcendance : hauts faits, défis relevés, villes, statistiques
 * globales et réglages.
 */
import { D, ZERO, type Decimal } from './decimal.ts';
import type { GameState, PrestigeLayerState } from './state.ts';
import { CITIES, CITIES_BY_ID, CONTRACT_DIVISOR, EXPANSION_REVEAL, type CityDef, type CityId } from '../data/cities.ts';
import { cityLevel, expansionLayer, resetRun } from './prestige.ts';

/**
 * Contrats mérités : racine cubique du cumul de pizzas de TOUTE la partie
 * (celui-là ne repart jamais à zéro), divisé par 1e15.
 */
export function contractsFromTotal(total: Decimal): Decimal {
  const scaled = total.div(CONTRACT_DIVISOR);
  if (scaled.lt(1)) return ZERO;
  const asNumber = scaled.toNumber();
  if (Number.isFinite(asNumber) && asNumber < 1e15) return D(Math.floor(Math.cbrt(asNumber)));
  return scaled.pow(1 / 3).floor();
}

/** Contrats que rapporterait une transcendance immédiate. */
export function pendingContracts(state: GameState): Decimal {
  const merited = contractsFromTotal(state.stats.earnedTotal);
  const already = expansionLayer(state).totalEarned;
  const pending = merited.sub(already);
  return pending.gt(0) ? pending : ZERO;
}

export function canTranscend(state: GameState): boolean {
  return pendingContracts(state).gte(1);
}

/** Cumul de pizzas nécessaire pour mériter `contracts` Contrats. */
export function totalForContracts(contracts: Decimal): Decimal {
  return contracts.pow(3).mul(CONTRACT_DIVISOR);
}

/** L'onglet Expansion se dévoile bien avant la première transcendance. */
export function expansionRevealed(state: GameState): boolean {
  return expansionLayer(state).resets > 0
    || expansionLayer(state).currency.gt(0)
    || state.stats.earnedTotal.gte(EXPANSION_REVEAL);
}

/* ------------------------------------------------------------------ */
/* Les villes                                                          */
/* ------------------------------------------------------------------ */

export function isFounded(state: GameState, id: CityId): boolean {
  return cityLevel(state, id) > 0;
}

/** Coût du prochain niveau : fondation, puis `levelCost × niveau actuel`. */
export function cityUpgradeCost(state: GameState, def: CityDef): number {
  const level = cityLevel(state, def.id);
  return level === 0 ? def.foundCost : def.levelCost * level;
}

/** Une ville ne se fonde que si la précédente l'a déjà été. */
export function isCityAvailable(state: GameState, def: CityDef): boolean {
  if (isFounded(state, def.id)) return true;
  const index = CITIES.findIndex((c) => c.id === def.id);
  if (index <= 0) return true;
  return isFounded(state, CITIES[index - 1]!.id);
}

export function canUpgradeCity(state: GameState, def: CityDef): boolean {
  return isCityAvailable(state, def)
    && expansionLayer(state).currency.gte(cityUpgradeCost(state, def));
}

/** Fonde une ville ou lui ajoute un niveau. */
export function upgradeCity(state: GameState, id: CityId): { state: GameState; bought: boolean } {
  const def = CITIES_BY_ID[id];
  if (!def || !canUpgradeCity(state, def)) return { state, bought: false };

  const layer = expansionLayer(state);
  const cost = cityUpgradeCost(state, def);
  return {
    bought: true,
    state: {
      ...state,
      prestige: {
        ...state.prestige,
        layers: {
          ...state.prestige.layers,
          expansion: {
            ...layer,
            currency: layer.currency.sub(cost),
            nodes: { ...layer.nodes, [id]: cityLevel(state, id) + 1 },
          },
        },
      },
    },
  };
}

/** Somme des niveaux de toutes les villes (sert d'indicateur de progression). */
export function totalCityLevels(state: GameState): number {
  return CITIES.reduce((sum, def) => sum + cityLevel(state, def.id), 0);
}

/* ------------------------------------------------------------------ */
/* La transcendance                                                    */
/* ------------------------------------------------------------------ */

export type TranscendResult = { state: GameState; gained: Decimal };

/**
 * Efface la couche 1 dans son intégralité et crédite les Contrats.
 * Les hauts faits, les défis relevés et les villes ne bougent pas.
 */
export function doTranscend(state: GameState): TranscendResult {
  const gained = pendingContracts(state);
  if (gained.lt(1)) return { state, gained: ZERO };

  const layer = expansionLayer(state);
  const nextLayer: PrestigeLayerState = {
    ...layer,
    currency: layer.currency.add(gained),
    totalEarned: layer.totalEarned.add(gained),
    resets: layer.resets + 1,
  };

  // On repart d'une partie neuve SANS Étoiles ni arbre : on efface la couche 1 d'abord,
  // pour que resetRun ne distribue pas les cuisines de départ de l'ancien arbre.
  const wiped: GameState = {
    ...state,
    prestige: { layers: { expansion: nextLayer } },
    challenges: { ...state.challenges, active: null },
    stats: { ...state.stats, earnedPrestige: ZERO },
  };

  return { gained, state: resetRun(wiped) };
}
