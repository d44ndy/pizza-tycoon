import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { runFor, tick } from '../src/engine/tick.ts';
import { buyGenerator, clickDough } from '../src/engine/actions.ts';
import { totalProduction } from '../src/engine/formulas.ts';

/** État de départ : 10 apprentis (1 pizza/s) et un peu de monnaie. */
function stateWithProduction(): GameState {
  const state = createTestState();
  return {
    ...state,
    pizzas: D(0),
    generators: { ...state.generators, apprenti: { ...state.generators.apprenti, owned: 10 } },
  };
}

describe('tick', () => {
  it('produit exactement production × dt', () => {
    const state = stateWithProduction();
    expect(totalProduction(state).toNumber()).toBeCloseTo(1, 12);
    const after = tick(state, 10);
    expect(after.pizzas.toNumber()).toBeCloseTo(10, 9);
    expect(after.stats.earnedTotal.toNumber()).toBeCloseTo(10, 9);
    expect(after.stats.playTimeRun).toBeCloseTo(10, 12);
  });

  it('est déterministe : deux exécutions identiques donnent le même résultat', () => {
    const a = runFor(stateWithProduction(), 30);
    const b = runFor(stateWithProduction(), 30);
    expect(a.pizzas.toString()).toBe(b.pizzas.toString());
    expect(a.stats.playTimeRun).toBe(b.stats.playTimeRun);
  });

  it('ne dépend pas du découpage du temps', () => {
    const gros = tick(stateWithProduction(), 10);
    const fin = runFor(stateWithProduction(), 10, 0.05);
    const ecart = Math.abs(fin.pizzas.toNumber() / gros.pizzas.toNumber() - 1);
    expect(ecart).toBeLessThan(1e-9);
  });

  it('ignore un dt nul ou invalide', () => {
    const state = stateWithProduction();
    expect(tick(state, 0)).toBe(state);
    expect(tick(state, -5)).toBe(state);
    expect(tick(state, Number.NaN)).toBe(state);
  });

  it('ne modifie pas l’état d’origine (immutabilité)', () => {
    const state = stateWithProduction();
    const before = state.pizzas.toString();
    tick(state, 100);
    expect(state.pizzas.toString()).toBe(before);
  });

  it('débloque un générateur à 50 % de son coût', () => {
    let state = createTestState();
    expect(state.generators.apprenti.unlocked).toBe(false);
    state = { ...state, pizzas: D(7) };
    state = tick(state, 0.05);
    expect(state.generators.apprenti.unlocked).toBe(false);
    state = { ...state, pizzas: D(7.5) };
    state = tick(state, 0.05);
    expect(state.generators.apprenti.unlocked).toBe(true);
    // Une fois débloqué, il le reste même si le joueur dépense tout.
    state = tick({ ...state, pizzas: D(0) }, 0.05);
    expect(state.generators.apprenti.unlocked).toBe(true);
  });
});

describe('actions', () => {
  it('le clic rapporte une pizza et compte les statistiques', () => {
    const after = clickDough(createTestState());
    expect(after.pizzas.toNumber()).toBe(1);
    expect(after.stats.clicks).toBe(1);
    expect(after.stats.handmadeTotal.toNumber()).toBe(1);
  });

  it('achète un générateur et débite le bon montant', () => {
    const state = { ...createTestState(), pizzas: D(100) };
    const result = buyGenerator(state, 'apprenti', 1);
    expect(result.bought).toBe(1);
    expect(result.state.generators.apprenti.owned).toBe(1);
    expect(result.state.pizzas.toNumber()).toBeCloseTo(85, 9);
  });

  it('refuse un achat groupé non finançable (tout ou rien)', () => {
    const state = { ...createTestState(), pizzas: D(20) };
    const result = buyGenerator(state, 'apprenti', 10);
    expect(result.bought).toBe(0);
    expect(result.state).toBe(state);
  });

  it('achète le maximum possible sans jamais passer en négatif', () => {
    const state = { ...createTestState(), pizzas: D('1e6') };
    const result = buyGenerator(state, 'apprenti', 'max');
    expect(result.bought).toBeGreaterThan(0);
    expect(result.state.pizzas.gte(0)).toBe(true);
    expect(result.state.generators.apprenti.owned).toBe(result.bought);
  });
});
