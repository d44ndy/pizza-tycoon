import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { ACHIEVEMENTS } from '../src/data/achievements.ts';
import {
  achievementMultiplier, achievementsOwnedCount, checkAchievements, hasAchievement, raiseFlag,
} from '../src/engine/achievements.ts';
import { totalProduction } from '../src/engine/formulas.ts';
import { clickDough } from '../src/engine/actions.ts';
import { runFor } from '../src/engine/tick.ts';

function check(state: GameState) {
  return checkAchievements(state, totalProduction(state));
}

describe('catalogue', () => {
  it('compte au moins 80 hauts faits, sans doublon', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('a des cachés et des visibles', () => {
    expect(ACHIEVEMENTS.some((a) => a.hidden)).toBe(true);
    expect(ACHIEVEMENTS.some((a) => !a.hidden)).toBe(true);
  });
});

describe('déblocage', () => {
  it('débloque sur le stock de pizzas', () => {
    const { state, unlocked } = check({ ...createTestState(), pizzas: D('1e3') });
    expect(unlocked.some((a) => a.id === 'stock-1')).toBe(true);
    expect(hasAchievement(state, 'stock-1')).toBe(true);
  });

  it('ne débloque jamais deux fois le même', () => {
    const first = check({ ...createTestState(), pizzas: D('1e3') });
    const second = check(first.state);
    expect(second.unlocked).toHaveLength(0);
    expect(second.state).toBe(first.state);
  });

  it('enchaîne les hauts faits en cascade (collection incluse)', () => {
    // Beaucoup de pizzas => plusieurs paliers de stock et de cumul d'un coup.
    const riche: GameState = {
      ...createTestState(),
      pizzas: D('1e30'),
      stats: { ...createTestState().stats, earnedTotal: D('1e30'), clicksTotal: 30000 },
    };
    const { state } = check(riche);
    expect(achievementsOwnedCount(state)).toBeGreaterThan(15);
  });

  it('gère la condition « exactement 42 »', () => {
    const base = createTestState();
    const avec42 = { ...base, generators: { ...base.generators, four: { ...base.generators.four, owned: 42 } } };
    expect(check(avec42).unlocked.some((a) => a.id === 'secret-42')).toBe(true);
    const avec43 = { ...base, generators: { ...base.generators, four: { ...base.generators.four, owned: 43 } } };
    expect(check(avec43).unlocked.some((a) => a.id === 'secret-42')).toBe(false);
  });

  it('se déclenche sur un drapeau', () => {
    const state = raiseFlag(createTestState(), 'coldPizza');
    expect(check(state).unlocked.some((a) => a.id === 'secret-froide')).toBe(true);
  });
});

describe('bonus de production', () => {
  it('accorde +1 % multiplicatif par haut fait', () => {
    const state = createTestState();
    expect(achievementMultiplier(state).toNumber()).toBe(1);
    const { state: avecUn } = check({ ...state, pizzas: D('1e3') });
    expect(achievementMultiplier(avecUn).toNumber()).toBeCloseTo(Math.pow(1.01, achievementsOwnedCount(avecUn)), 9);
  });

  it('augmente réellement la production', () => {
    const base = createTestState();
    const avec = { ...base, generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 10 } } };
    const avant = totalProduction(avec).toNumber();
    const apres = totalProduction(check(avec).state).toNumber();
    expect(apres).toBeGreaterThan(avant);
  });
});

describe('haut fait caché « 100 clics en 10 secondes »', () => {
  it('se déclenche sur une rafale', () => {
    let state = createTestState();
    for (let i = 0; i < 100; i++) state = clickDough(state);
    expect(state.flags.clickBurst).toBe(true);
  });

  it('ne se déclenche pas si les clics sont étalés', () => {
    let state = createTestState();
    for (let i = 0; i < 100; i++) {
      state = clickDough(state);
      state = runFor(state, 0.5, 0.5); // 50 secondes au total
    }
    expect(state.flags.clickBurst).toBeUndefined();
  });
});
