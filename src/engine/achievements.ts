/**
 * Hauts faits : évaluation des conditions et bonus de production.
 * Chaque haut fait obtenu accorde +1 % de production globale, de façon multiplicative.
 */
import { D, ONE, type Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import { GENERATORS } from '../data/generators.ts';
import {
  ACHIEVEMENTS, ACHIEVEMENT_BONUS, type AchievementCondition, type AchievementDef, type FlagId,
} from '../data/achievements.ts';
import { upgradesOwnedCount } from './upgrades.ts';

/**
 * Évalue une condition de haut fait.
 * `production` est passée en paramètre pour éviter de la recalculer 80 fois par tick.
 */
export function achievementMet(state: GameState, condition: AchievementCondition, production: Decimal): boolean {
  switch (condition.type) {
    case 'pizzas':
      return state.pizzas.gte(condition.amount);
    case 'earnedTotal':
      return state.stats.earnedTotal.gte(condition.amount);
    case 'production':
      return production.gte(condition.amount);
    case 'handmadeTotal':
      return state.stats.handmadeTotal.gte(condition.amount);
    case 'generatorOwned':
      return state.generators[condition.id].owned >= condition.count;
    case 'generatorExactly':
      return state.generators[condition.id].owned === condition.count;
    case 'allGenerators':
      return GENERATORS.every((def) => state.generators[def.id].owned >= condition.count);
    case 'clicksTotal':
      return state.stats.clicksTotal >= condition.count;
    case 'upgradesOwned':
      return upgradesOwnedCount(state) >= condition.count;
    case 'eventsClicked':
      return state.stats.eventsClicked >= condition.count;
    case 'achievementsOwned':
      return Object.keys(state.achievements).length >= condition.count;
    case 'flag':
      return state.flags[condition.flag] === true;
  }
}

export function hasAchievement(state: GameState, id: string): boolean {
  return state.achievements[id] !== undefined;
}

export function achievementsOwnedCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

/** Multiplicateur global accordé par la collection : 1,01^(nombre de hauts faits). */
export function achievementMultiplier(state: GameState): Decimal {
  const count = achievementsOwnedCount(state);
  if (count === 0) return ONE;
  return D(Math.pow(1 + ACHIEVEMENT_BONUS, count));
}

/**
 * Débloque les hauts faits dont la condition vient d'être remplie.
 * Renvoie l'état mis à jour et la liste des nouveaux hauts faits (pour les notifications).
 */
export function checkAchievements(
  state: GameState,
  production: Decimal,
): { state: GameState; unlocked: AchievementDef[] } {
  let unlocked: AchievementDef[] | null = null;
  let achievements = state.achievements;

  for (const def of ACHIEVEMENTS) {
    if (achievements[def.id] !== undefined) continue;
    if (!achievementMet({ ...state, achievements }, def.condition, production)) continue;
    if (!unlocked) {
      unlocked = [];
      achievements = { ...achievements };
    }
    achievements[def.id] = state.stats.playTimeTotal;
    unlocked.push(def);
  }

  if (!unlocked) return { state, unlocked: [] };
  return { state: { ...state, achievements }, unlocked };
}

/** Marque un fait marquant (idempotent). */
export function raiseFlag(state: GameState, flag: FlagId): GameState {
  if (state.flags[flag] === true) return state;
  return { ...state, flags: { ...state.flags, [flag]: true } };
}
