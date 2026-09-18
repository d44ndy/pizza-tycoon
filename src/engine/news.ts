/**
 * La Gazette de la Pâte : quelles dépêches sont disponibles, et laquelle afficher.
 *
 * Le choix de la dépêche est cosmétique, donc le tirage aléatoire vient de
 * l'interface ; il est passé en paramètre pour que cette logique reste pure et testable.
 */
import type { GameState } from './state.ts';
import { NEWS, type NewsCondition, type NewsDef } from '../data/news.ts';
import { achievementsOwnedCount } from './achievements.ts';
import { completedCount } from './challenges.ts';
import { cityLevel, expansionLayer, recipeLayer } from './prestige.ts';

export function newsConditionMet(state: GameState, condition: NewsCondition): boolean {
  switch (condition.type) {
    case 'always': return true;
    case 'before': return state.stats.earnedTotal.lt(condition.amount);
    case 'earnedTotal': return state.stats.earnedTotal.gte(condition.amount);
    case 'generatorOwned': return state.generators[condition.id].owned >= condition.count;
    case 'clicksTotal': return state.stats.clicksTotal >= condition.count;
    case 'eventsClicked': return state.stats.eventsClicked >= condition.count;
    case 'achievementsOwned': return achievementsOwnedCount(state) >= condition.count;
    case 'flag': return state.flags[condition.flag] === true;
    // Une transcendance remet les prestiges à zéro : on compte donc aussi les expansions,
    // pour que les dépêches déjà méritées ne disparaissent pas.
    case 'prestiges': return recipeLayer(state).resets >= condition.count || expansionLayer(state).resets > 0;
    case 'challengeActive': return state.challenges.active !== null;
    case 'challengesCompleted': return completedCount(state) >= condition.count;
    case 'cityFounded': return cityLevel(state, condition.id) > 0;
    case 'transcendences': return expansionLayer(state).resets >= condition.count;
  }
}

/** Dépêches disponibles dans l'état actuel. */
export function eligibleNews(state: GameState): NewsDef[] {
  return NEWS.filter((def) => newsConditionMet(state, def.condition));
}

/**
 * Choisit la prochaine dépêche.
 *
 * Priorité à l'actualité : une dépêche débloquée pendant la session (absente de
 * `seen`) passe devant les autres, la plus avancée d'abord. Sinon, tirage au hasard
 * parmi les disponibles, sans répéter la dernière affichée.
 */
export function pickNews(
  eligible: readonly NewsDef[],
  seen: ReadonlySet<string>,
  lastId: string | null,
  random: number,
): NewsDef | null {
  if (eligible.length === 0) return null;

  for (let i = eligible.length - 1; i >= 0; i--) {
    const def = eligible[i]!;
    if (!seen.has(def.id)) return def;
  }

  const pool = eligible.length > 1 ? eligible.filter((def) => def.id !== lastId) : eligible;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))] ?? null;
}
