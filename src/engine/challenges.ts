/**
 * Défis : règles en vigueur, entrée, sortie et validation.
 *
 * Entrer dans un défi ou en sortir revient à faire un prestige : la run repart de
 * zéro et les Étoiles méritées sont encaissées au passage. Le joueur ne perd donc
 * jamais sa progression en essayant un défi.
 */
import type { Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import {
  CHALLENGES, CHALLENGES_BY_ID, CHALLENGES_UNLOCK_RESETS, FREE_RULES,
  type ChallengeDef, type ChallengeRules,
} from '../data/challenges.ts';
import type { GeneratorDef } from '../data/generators.ts';
import { recipeLayer, resetRun } from './prestige.ts';

/** Les défis apparaissent après le troisième prestige. */
export function challengesUnlocked(state: GameState): boolean {
  return recipeLayer(state).resets >= CHALLENGES_UNLOCK_RESETS;
}

export function activeChallenge(state: GameState): ChallengeDef | null {
  const id = state.challenges.active;
  return id ? CHALLENGES_BY_ID[id] ?? null : null;
}

export function isCompleted(state: GameState, id: string): boolean {
  return state.challenges.completed[id] !== undefined;
}

export function completedCount(state: GameState): number {
  return Object.keys(state.challenges.completed).length;
}

/** Règles en vigueur : celles du défi en cours, ou le monde normal. */
export function currentRules(state: GameState): ChallengeRules {
  const challenge = activeChallenge(state);
  return challenge ? { ...FREE_RULES, ...challenge.rules } : FREE_RULES;
}

/** Une cuisine est-elle achetable dans les règles en cours ? */
export function isGeneratorAllowed(rules: ChallengeRules, def: GeneratorDef): boolean {
  if (def.index >= rules.maxGenerators) return false;
  return !rules.bannedGenerators.includes(def.id);
}

/** Progression dans le défi en cours, entre 0 et 1. */
export function challengeProgress(state: GameState): number {
  const challenge = activeChallenge(state);
  if (!challenge) return 0;
  return Math.min(1, state.stats.earnedRun.div(challenge.goal).toNumber());
}

/** Pizzas restant à produire pour valider le défi en cours. */
export function challengeRemaining(state: GameState): Decimal | null {
  const challenge = activeChallenge(state);
  if (!challenge) return null;
  const remaining = challenge.goal.sub(state.stats.earnedRun);
  return remaining.gt(0) ? remaining : null;
}

/**
 * Entre dans un défi : remise à zéro de la run (les Étoiles méritées sont encaissées),
 * puis activation de la contrainte.
 */
export function enterChallenge(state: GameState, id: string): GameState {
  const challenge = CHALLENGES_BY_ID[id];
  if (!challenge || !challengesUnlocked(state) || state.challenges.active === id) return state;

  const reset = resetRun(state);
  const rules = { ...FREE_RULES, ...challenge.rules };
  return {
    ...reset,
    // La mise de départ est une avance, pas de la production : elle ne compte pas
    // dans l'objectif du défi.
    pizzas: reset.pizzas.add(rules.startPizzas),
    challenges: { ...reset.challenges, active: id },
  };
}

/** Quitte le défi en cours (validé ou non) : nouvelle remise à zéro. */
export function exitChallenge(state: GameState): GameState {
  if (!state.challenges.active) return state;
  const reset = resetRun(state);
  return { ...reset, challenges: { ...reset.challenges, active: null } };
}

/**
 * Valide le défi en cours dès que l'objectif est atteint.
 * La récompense est acquise immédiatement : le joueur reste libre de continuer
 * la run sous contrainte ou de sortir quand il veut.
 */
export function checkChallengeCompletion(state: GameState): { state: GameState; completed: ChallengeDef | null } {
  const challenge = activeChallenge(state);
  if (!challenge || isCompleted(state, challenge.id)) return { state, completed: null };
  if (state.stats.earnedRun.lt(challenge.goal)) return { state, completed: null };

  return {
    completed: challenge,
    state: {
      ...state,
      challenges: {
        ...state.challenges,
        completed: { ...state.challenges.completed, [challenge.id]: state.stats.playTimeTotal },
      },
    },
  };
}

/** Défis validés, dans l'ordre du catalogue. */
export function completedChallenges(state: GameState): ChallengeDef[] {
  return CHALLENGES.filter((c) => isCompleted(state, c.id));
}
