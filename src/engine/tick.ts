/**
 * Cœur de la simulation.
 *
 * `tick(state, dt)` est une fonction PURE : à état et `dt` identiques, résultat identique.
 * La boucle de jeu l'appelle avec un pas FIXE (50 ms) ; le temps réel écoulé est absorbé
 * par un accumulateur côté store, jamais ici.
 */
import type { Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import { totalProduction, shouldUnlock } from './formulas.ts';
import { GENERATORS } from '../data/generators.ts';
import { TICK_SECONDS } from '../data/config.ts';

/**
 * Crédite des pizzas et met à jour les compteurs de gains.
 * `handmade` distingue les pizzas pétries au clic (utile pour les succès de Phase 2).
 */
export function addPizzas(state: GameState, amount: Decimal, handmade = false): GameState {
  if (amount.lte(0)) return state;
  const pizzas = state.pizzas.add(amount);
  return {
    ...state,
    pizzas,
    stats: {
      ...state.stats,
      earnedRun: state.stats.earnedRun.add(amount),
      earnedPrestige: state.stats.earnedPrestige.add(amount),
      earnedTotal: state.stats.earnedTotal.add(amount),
      handmadeTotal: handmade ? state.stats.handmadeTotal.add(amount) : state.stats.handmadeTotal,
      bestPizzas: pizzas.gt(state.stats.bestPizzas) ? pizzas : state.stats.bestPizzas,
    },
  };
}

/**
 * Révélation progressive : un générateur apparaît dès que le joueur possède 50 % de son coût,
 * et ne disparaît plus jamais ensuite.
 */
export function updateUnlocks(state: GameState): GameState {
  let changed = false;
  const generators = { ...state.generators };
  for (const def of GENERATORS) {
    if (!generators[def.id].unlocked && shouldUnlock(state, def)) {
      generators[def.id] = { ...generators[def.id], unlocked: true };
      changed = true;
    }
  }
  return changed ? { ...state, generators } : state;
}

/** Avance la simulation de `dt` secondes. */
export function tick(state: GameState, dt: number): GameState {
  if (!Number.isFinite(dt) || dt <= 0) return state;

  const produced = totalProduction(state).mul(dt);

  let next: GameState = {
    ...state,
    stats: {
      ...state.stats,
      playTimeRun: state.stats.playTimeRun + dt,
      playTimeTotal: state.stats.playTimeTotal + dt,
    },
  };
  next = addPizzas(next, produced);
  next = updateUnlocks(next);
  return next;
}

/**
 * Avance de `seconds` secondes par pas fixes.
 * Utilisé par les tests et par le simulateur d'équilibrage (Phase 2).
 */
export function runFor(state: GameState, seconds: number, step: number = TICK_SECONDS): GameState {
  let next = state;
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining);
    next = tick(next, dt);
    remaining -= dt;
  }
  return next;
}
