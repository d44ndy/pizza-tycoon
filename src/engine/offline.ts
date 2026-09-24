/**
 * Progression hors ligne.
 *
 * Au chargement, on crédite au joueur une partie de ce qu'il aurait produit pendant
 * son absence : temps écoulé plafonné (8 h), efficacité réduite (50 %).
 * Anti-triche basique : si l'horloge du système a reculé, le gain est nul.
 */
import { ZERO, type Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import { totalProduction } from './formulas.ts';
import { addPizzas, updateUnlocks } from './tick.ts';
import { permanentEffects } from './prestige.ts';

/** En deçà de ce délai, on ne dérange pas le joueur avec une popup. */
export const OFFLINE_MIN_SECONDS = 60;

export type OfflineResult = {
  state: GameState;
  /** Temps réellement écoulé (secondes). */
  elapsedSeconds: number;
  /** Temps retenu après plafonnement. */
  creditedSeconds: number;
  /** Pizzas créditées. */
  gained: Decimal;
  /** Vrai si le plafond a rogné le gain (message « tu as atteint la limite »). */
  capped: boolean;
  /** Rendement appliqué (0,5 au départ, davantage avec l'arbre et les villes). */
  efficiency: number;
};

/** Rendement hors ligne : 50 % au départ, jusqu'à 100 % via l'arbre de prestige. */
export function offlineEfficiency(state: GameState): number {
  return permanentEffects(state).offlineEfficiency;
}

/** Plafond de temps hors ligne : 8 h au départ, jusqu'à 24 h via l'arbre. */
export function offlineCapSeconds(state: GameState): number {
  return permanentEffects(state).offlineCapSeconds;
}

/**
 * Calcule et applique un gain hors ligne pour une durée donnée.
 * Utilisé au chargement (temps écoulé depuis la sauvegarde) et au réveil d'un onglet
 * resté caché longtemps.
 */
export function applyElapsed(state: GameState, elapsedSeconds: number, now: number): OfflineResult {
  // Horloge reculée (ou sauvegarde venue du futur) : aucun gain, mais on repart proprement.
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return {
      state: { ...state, lastSaved: now },
      elapsedSeconds: Math.max(0, elapsedSeconds || 0),
      creditedSeconds: 0,
      gained: ZERO,
      capped: false,
      efficiency: offlineEfficiency(state),
    };
  }

  const cap = offlineCapSeconds(state);
  const efficiency = offlineEfficiency(state);
  const creditedSeconds = Math.min(elapsedSeconds, cap);
  const gained = totalProduction(state).mul(creditedSeconds).mul(efficiency);

  const credited = updateUnlocks(addPizzas({ ...coolOven(state, elapsedSeconds), lastSaved: now }, gained));
  return {
    state: credited,
    elapsedSeconds,
    creditedSeconds,
    gained,
    capped: elapsedSeconds > cap,
    efficiency,
  };
}

/**
 * Le four du chef refroidit aussi pendant l'absence, et sur TOUTE sa durée (pas
 * seulement la part plafonnée) : enfourner avant de partir puis retrouver le four
 * encore chaud le lendemain serait une pénalité pour avoir quitté le jeu.
 *
 * On recule l'instant de cuisson plutôt que d'avancer le temps de jeu, qui règle
 * aussi les pizzas d'or et les statistiques : eux n'ont pas à bouger.
 */
function coolOven(state: GameState, elapsedSeconds: number): GameState {
  if (state.chef.bakedAt === null) return state;
  return { ...state, chef: { ...state.chef, bakedAt: state.chef.bakedAt - elapsedSeconds } };
}

/**
 * Progression hors ligne au chargement : la durée est déduite de `lastSaved`.
 * `now` est passé en paramètre (jamais `Date.now()` en dur) pour rester testable.
 */
export function applyOffline(state: GameState, now: number): OfflineResult {
  return applyElapsed(state, (now - state.lastSaved) / 1000, now);
}
