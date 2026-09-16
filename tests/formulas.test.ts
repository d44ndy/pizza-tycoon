import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState } from '../src/engine/state.ts';
import { GENERATORS_BY_ID } from '../src/data/generators.ts';
import { milestonesReached, nextMilestone } from '../src/data/config.ts';
import {
  costOfK, costOfNext, generatorMultiplier, generatorProduction,
  maxAffordable, resolveBulk, totalProduction,
} from '../src/engine/formulas.ts';

const apprenti = GENERATORS_BY_ID.apprenti;
const four = GENERATORS_BY_ID.four;

/** Tolérance relative : les Decimal passent par des flottants. */
function closeTo(actual: ReturnType<typeof D>, expected: number, epsilon = 1e-9) {
  expect(Math.abs(actual.toNumber() / expected - 1)).toBeLessThan(epsilon);
}

describe('coûts', () => {
  it('applique la croissance de 15 % par exemplaire', () => {
    expect(costOfNext(apprenti, 0).toNumber()).toBe(15);
    closeTo(costOfNext(apprenti, 1), 17.25);
    closeTo(costOfNext(apprenti, 10), 15 * Math.pow(1.15, 10));
  });

  it('somme correctement un achat groupé', () => {
    closeTo(costOfK(apprenti, 0, 1), 15);
    closeTo(costOfK(apprenti, 0, 10), (15 * (Math.pow(1.15, 10) - 1)) / 0.15);
    // Acheter 10 d'un coup = acheter 10 fois de suite.
    let cumul = D(0);
    for (let i = 0; i < 10; i++) cumul = cumul.add(costOfNext(apprenti, i));
    closeTo(costOfK(apprenti, 0, 10), cumul.toNumber());
  });

  it('renvoie 0 pour un achat de taille nulle ou négative', () => {
    expect(costOfK(apprenti, 5, 0).toNumber()).toBe(0);
    expect(costOfK(apprenti, 5, -3).toNumber()).toBe(0);
  });
});

describe('maxAffordable', () => {
  it('ne renvoie jamais un exemplaire de trop', () => {
    const cases: Array<[number, string]> = [
      [0, '14'], [0, '15'], [0, '100'], [0, '1e6'], [3, '1234'], [57, '1e12'], [200, '1e30'],
    ];
    for (const [owned, money] of cases) {
      const m = D(money);
      const k = maxAffordable(apprenti, owned, m);
      if (k > 0) expect(costOfK(apprenti, owned, k).lte(m)).toBe(true);
      expect(costOfK(apprenti, owned, k + 1).gt(m)).toBe(true);
    }
  });

  it('renvoie 0 quand le joueur ne peut rien payer', () => {
    expect(maxAffordable(apprenti, 0, D(14))).toBe(0);
    expect(maxAffordable(apprenti, 0, D(0))).toBe(0);
  });

  it('résout les modes d’achat groupé', () => {
    const state = createTestState();
    const rich = D('1e9');
    expect(resolveBulk(apprenti, 0, rich, 10).count).toBe(10);
    expect(resolveBulk(apprenti, 0, D(15), 10).affordable).toBe(false);
    expect(resolveBulk(apprenti, 0, D(15), 1).affordable).toBe(true);
    expect(resolveBulk(apprenti, 0, D(0), 'max').count).toBe(0);
    expect(state.settings.bulkMode).toBe(1);
  });
});

describe('paliers', () => {
  it('compte les paliers atteints', () => {
    expect(milestonesReached(0)).toBe(0);
    expect(milestonesReached(24)).toBe(0);
    expect(milestonesReached(25)).toBe(1);
    expect(milestonesReached(49)).toBe(1);
    expect(milestonesReached(50)).toBe(2);
    expect(milestonesReached(99)).toBe(2);
    expect(milestonesReached(100)).toBe(3);
    expect(milestonesReached(150)).toBe(4);
    expect(milestonesReached(300)).toBe(7);
  });

  it('annonce le prochain palier', () => {
    expect(nextMilestone(0)).toBe(25);
    expect(nextMilestone(25)).toBe(50);
    expect(nextMilestone(51)).toBe(100);
    expect(nextMilestone(100)).toBe(150);
  });

  it('double la production du générateur à chaque palier', () => {
    const state = createTestState();
    state.generators.apprenti.owned = 24;
    expect(generatorMultiplier(state, 'apprenti').toNumber()).toBe(1);
    state.generators.apprenti.owned = 25;
    expect(generatorMultiplier(state, 'apprenti').toNumber()).toBe(2);
    state.generators.apprenti.owned = 100;
    expect(generatorMultiplier(state, 'apprenti').toNumber()).toBe(8);
  });
});

describe('production', () => {
  it('additionne la production de tous les générateurs', () => {
    const state = createTestState();
    state.generators.apprenti.owned = 10; // 10 × 0,1 = 1/s
    state.generators.four.owned = 3; //      3 × 1   = 3/s
    closeTo(generatorProduction(state, 'apprenti'), 1);
    closeTo(generatorProduction(state, 'four'), 3);
    closeTo(totalProduction(state), 4);
    expect(four.baseProduction.toNumber()).toBe(1);
  });

  it('inclut les paliers dans la production totale', () => {
    const state = createTestState();
    state.generators.apprenti.owned = 25; // 25 × 0,1 × 2 = 5/s
    closeTo(totalProduction(state), 5);
  });
});
