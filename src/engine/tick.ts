/**
 * Cœur de la simulation.
 *
 * `tick(state, dt)` est une fonction PURE : à état et `dt` identiques, résultat identique.
 * La boucle de jeu l'appelle avec un pas FIXE (50 ms) ; le temps réel écoulé est absorbé
 * par un accumulateur côté store, jamais ici.
 */
import type { GameState } from './state.ts';
import { totalProduction } from './formulas.ts';
import { addPizzas, updateUnlocks } from './core.ts';
import { checkAchievements } from './achievements.ts';
import { updateEvents } from './events.ts';
import { runAutomation } from './automation.ts';
import { TICK_SECONDS } from '../data/config.ts';
import type { AchievementDef } from '../data/achievements.ts';


// Ré-exportées ici : le reste du code les importait déjà depuis ce module.
export { addPizzas, updateUnlocks };

/**
 * Avance la simulation de `dt` secondes.
 * `onAchievement` permet à l'interface d'afficher une notification sans que
 * le moteur ait à connaître React (il reste pur : c'est un simple rappel).
 */
export function tick(
  state: GameState,
  dt: number,
  onAchievement?: (achievements: AchievementDef[]) => void,
): GameState {
  if (!Number.isFinite(dt) || dt <= 0) return state;

  const production = totalProduction(state);

  let next: GameState = {
    ...state,
    stats: {
      ...state.stats,
      playTimeRun: state.stats.playTimeRun + dt,
      playTimeTotal: state.stats.playTimeTotal + dt,
    },
  };
  next = addPizzas(next, production.mul(dt));
  next = updateUnlocks(next);
  next = updateEvents(next);
  next = runAutomation(next, dt);

  const checked = checkAchievements(next, production);
  if (checked.unlocked.length > 0 && onAchievement) onAchievement(checked.unlocked);
  return checked.state;
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
