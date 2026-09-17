import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { CHALLENGES, CHALLENGES_BY_ID, FREE_RULES } from '../src/data/challenges.ts';
import {
  activeChallenge, challengeProgress, challengesUnlocked, checkChallengeCompletion,
  completedCount, currentRules, enterChallenge, exitChallenge, isCompleted,
} from '../src/engine/challenges.ts';
import { clickPower, costOfNext, costRules, generatorMultiplier, totalProduction } from '../src/engine/formulas.ts';
import { availableUpgrades, buyUpgrade, upgradeCost } from '../src/engine/upgrades.ts';
import { buyGenerator } from '../src/engine/actions.ts';
import { permanentEffects, recipeLayer } from '../src/engine/prestige.ts';
import { GENERATORS_BY_ID } from '../src/data/generators.ts';
import { UPGRADES_BY_ID } from '../src/data/upgrades.ts';
import { runFor } from '../src/engine/tick.ts';

/** Joueur ayant déjà fait trois prestiges : les défis lui sont ouverts. */
function veteran(overrides: Partial<GameState> = {}): GameState {
  const base = createTestState();
  return {
    ...base,
    pizzas: D('1e9'),
    generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 30 } },
    prestige: {
      ...base.prestige,
      layers: { ...base.prestige.layers, recipe: { currency: D(20), totalEarned: D(20), resets: 3, nodes: {} } },
    },
    ...overrides,
  };
}

function withActive(id: string): GameState {
  const state = veteran();
  return { ...state, challenges: { ...state.challenges, active: id } };
}

describe('catalogue', () => {
  it('compte huit défis, sans doublon, avec un objectif chiffré', () => {
    expect(CHALLENGES).toHaveLength(8);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(8);
    for (const c of CHALLENGES) expect(c.goal.gt(0)).toBe(true);
  });

  it('a une contrainte réelle pour chaque défi', () => {
    for (const c of CHALLENGES) {
      const rules = { ...FREE_RULES, ...c.rules };
      expect(JSON.stringify(rules)).not.toBe(JSON.stringify(FREE_RULES));
    }
  });
});

describe('déblocage', () => {
  it('exige trois prestiges', () => {
    expect(challengesUnlocked(createTestState())).toBe(false);
    expect(challengesUnlocked(veteran())).toBe(true);
  });

  it('refuse d’entrer avant le troisième prestige', () => {
    const novice = createTestState();
    expect(enterChallenge(novice, 'inflation')).toBe(novice);
  });
});

describe('entrée et sortie', () => {
  it('remet la partie à zéro en entrant, sans perdre les Étoiles méritées', () => {
    const state = { ...veteran(), stats: { ...veteran().stats, earnedPrestige: D('8e9'), earnedTotal: D('8e9') } };
    const inside = enterChallenge(state, 'inflation');

    expect(inside.challenges.active).toBe('inflation');
    expect(inside.pizzas.toNumber()).toBe(0);
    expect(inside.generators.apprenti.owned).toBe(0);
    expect(inside.stats.earnedRun.toNumber()).toBe(0);
    // 8e9 cumulés valent 2 Étoiles, dont aucune n'avait été encaissée au-delà des 20 existantes.
    expect(recipeLayer(inside).currency.gte(20)).toBe(true);
  });

  it('sort du défi et revient au monde normal', () => {
    const inside = enterChallenge(veteran(), 'inflation');
    const outside = exitChallenge(inside);
    expect(outside.challenges.active).toBeNull();
    expect(currentRules(outside)).toEqual(FREE_RULES);
  });

  it('ne fait rien si aucun défi n’est en cours', () => {
    const state = veteran();
    expect(exitChallenge(state)).toBe(state);
  });
});

describe('contraintes', () => {
  it('« Inflation » fait grimper les coûts de 30 % par exemplaire', () => {
    const state = withActive('inflation');
    expect(costRules(state).growth).toBe(1.3);
    const def = GENERATORS_BY_ID.apprenti;
    expect(costOfNext(def, 1, costRules(state)).toNumber()).toBeCloseTo(15 * 1.3, 9);
  });

  it('« Sans apprenti » interdit l’achat de la première cuisine', () => {
    const state = withActive('sans-apprenti');
    expect(buyGenerator(state, 'apprenti', 1).bought).toBe(0);
    expect(buyGenerator(state, 'four', 1).bought).toBe(1);
  });

  it('« Petit joueur » ne laisse que les cinq premières cuisines', () => {
    const state = withActive('petit-joueur');
    expect(buyGenerator(state, 'pizzeria', 1).bought).toBe(1);
    expect(buyGenerator(state, 'franchise', 1).bought).toBe(0);
  });

  it('« Zéro clic » annule la valeur du pétrissage', () => {
    expect(clickPower(withActive('zero-clic')).toNumber()).toBe(0);
    expect(clickPower(veteran()).toNumber()).toBeGreaterThan(0);
  });

  it('« Bricolage » rend toute amélioration inachetable', () => {
    const state = withActive('bricolage');
    expect(availableUpgrades(state)).toHaveLength(0);
    expect(buyUpgrade(state, 'apprenti-1').bought).toBe(false);
  });

  it('« Cuisine froide » divise la production par cinq', () => {
    const libre = veteran();
    const froid = withActive('cuisine-froide');
    expect(totalProduction(froid).toNumber()).toBeCloseTo(totalProduction(libre).toNumber() / 5, 9);
  });

  it('« Pâte pure » supprime les paliers', () => {
    const base = veteran();
    const avec25 = { ...base, generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 50 } } };
    expect(generatorMultiplier(avec25, 'apprenti').toNumber()).toBe(4);
    const pur = { ...avec25, challenges: { ...avec25.challenges, active: 'pate-pure' } };
    expect(generatorMultiplier(pur, 'apprenti').toNumber()).toBe(1);
  });

  it('les contraintes disparaissent à la sortie', () => {
    const inside = withActive('cuisine-froide');
    const outside = exitChallenge(inside);
    expect(currentRules(outside).productionFactor).toBe(1);
  });
});

describe('validation et récompenses', () => {
  it('valide le défi dès que l’objectif est produit', () => {
    const challenge = CHALLENGES_BY_ID['cuisine-froide']!;
    const state = withActive('cuisine-froide');
    expect(challengeProgress(state)).toBe(0);

    const presque = { ...state, stats: { ...state.stats, earnedRun: challenge.goal.div(2) } };
    expect(checkChallengeCompletion(presque).completed).toBeNull();
    expect(challengeProgress(presque)).toBeCloseTo(0.5, 6);

    const atteint = { ...state, stats: { ...state.stats, earnedRun: challenge.goal } };
    const result = checkChallengeCompletion(atteint);
    expect(result.completed?.id).toBe('cuisine-froide');
    expect(isCompleted(result.state, 'cuisine-froide')).toBe(true);
  });

  it('ne valide qu’une fois', () => {
    const challenge = CHALLENGES_BY_ID['cuisine-froide']!;
    const state = { ...withActive('cuisine-froide'), stats: { ...veteran().stats, earnedRun: challenge.goal } };
    const first = checkChallengeCompletion(state);
    const second = checkChallengeCompletion(first.state);
    expect(second.completed).toBeNull();
    expect(second.state).toBe(first.state);
  });

  it('la récompense est permanente et survit à la sortie', () => {
    const state = { ...veteran(), challenges: { active: null, completed: { 'cuisine-froide': 10 } } };
    // « Cuisine froide » offre un pétrissage ×5.
    expect(permanentEffects(state).clickMult.toNumber()).toBe(5);
    expect(clickPower(state).toNumber()).toBeCloseTo(clickPower(veteran()).toNumber() * 5, 6);
  });

  it('les récompenses se cumulent avec l’arbre de prestige', () => {
    const base = veteran();
    const withBoth: GameState = {
      ...base,
      challenges: { active: null, completed: { 'petit-joueur': 1, 'pate-pure': 2 } },
      prestige: {
        ...base.prestige,
        layers: { ...base.prestige.layers, recipe: { currency: D(0), totalEarned: D(20), resets: 3, nodes: { carnet: 1 } } },
      },
    };
    // 1,2 (Petit joueur) × 1,3 (Pâte pure) × 1,1 (carnet du chef)
    expect(permanentEffects(withBoth).globalMult.toNumber()).toBeCloseTo(1.2 * 1.3 * 1.1, 9);
  });

  it('« Bricolage » rend les améliorations 20 % moins chères', () => {
    const state = { ...veteran(), challenges: { active: null, completed: { bricolage: 1 } } };
    const def = UPGRADES_BY_ID['apprenti-1']!;
    expect(upgradeCost(state, def).toNumber()).toBeCloseTo(def.cost.toNumber() * 0.8, 9);
    expect(buyUpgrade(state, 'apprenti-1').spent.toNumber()).toBeCloseTo(120, 9);
  });

  it('« Zéro clic » offre un pétrisseur automatique', () => {
    const state = { ...veteran(), challenges: { active: null, completed: { 'zero-clic': 1 } } };
    expect(permanentEffects(state).autoClick).toBe(1);
    const after = runFor(state, 10, 1);
    expect(after.stats.clicksTotal).toBe(10);
  });

  it('compte les défis validés', () => {
    const state = { ...veteran(), challenges: { active: null, completed: { bricolage: 1, 'zero-clic': 2 } } };
    expect(completedCount(state)).toBe(2);
    expect(activeChallenge(state)).toBeNull();
  });
});
