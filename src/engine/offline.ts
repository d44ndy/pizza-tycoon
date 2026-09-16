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
import { OFFLINE_BASE_CAP_SECONDS, OFFLINE_BASE_EFFICIENCY } from '../data/config.ts';

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
};

/** Efficacité hors ligne — améliorable par l'arbre de prestige en Phase 3. */
export function offlineEfficiency(_state: GameState): number {
  return OFFLINE_BASE_EFFICIENCY;
}

/** Plafond de temps hors ligne, en secondes — améliorable en Phase 3. */
export function offlineCapSeconds(_state: GameState): number {
  return OFFLINE_BASE_CAP_SECONDS;
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
    };
  }

  const cap = offlineCapSeconds(state);
  const creditedSeconds = Math.min(elapsedSeconds, cap);
  const gained = totalProduction(state).mul(creditedSeconds).mul(offlineEfficiency(state));

  const credited = updateUnlocks(addPizzas({ ...state, lastSaved: now }, gained));
  return {
    state: credited,
    elapsedSeconds,
    creditedSeconds,
    gained,
    capped: elapsedSeconds > cap,
  };
}

/**
 * Progression hors ligne au chargement : la durée est déduite de `lastSaved`.
 * `now` est passé en paramètre (jamais `Date.now()` en dur) pour rester testable.
 */
export function applyOffline(state: GameState, now: number): OfflineResult {
  return applyElapsed(state, (now - state.lastSaved) / 1000, now);
}
