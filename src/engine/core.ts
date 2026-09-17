/**
 * Mutations de base partagées par le tick et les actions.
 *
 * Ce module existe pour casser un cycle d'imports : `tick.ts` a besoin des actions
 * (automatisation de la Phase 3) et les actions ont besoin de ces deux fonctions.
 */
import type { Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import { shouldUnlock } from './formulas.ts';
import { GENERATORS } from '../data/generators.ts';

/**
 * Crédite des pizzas et met à jour les compteurs de gains.
 * `handmade` distingue les pizzas pétries au clic (utile pour les hauts faits).
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
 * Révélation progressive : une cuisine apparaît dès que le joueur possède 50 % de son
 * coût, et ne disparaît plus jamais ensuite.
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
