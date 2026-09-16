import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { applyOffline } from '../src/engine/offline.ts';
import { OFFLINE_BASE_CAP_SECONDS, OFFLINE_BASE_EFFICIENCY } from '../src/data/config.ts';

/** 10 apprentis = 1 pizza/s, sauvegardé à t = 0. */
function state(): GameState {
  const base = createTestState();
  return {
    ...base,
    lastSaved: 0,
    generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 10 } },
  };
}

describe('progression hors ligne', () => {
  it('crédite la production au rendement réduit', () => {
    const result = applyOffline(state(), 3600 * 1000); // 1 h
    expect(result.creditedSeconds).toBe(3600);
    expect(result.gained.toNumber()).toBeCloseTo(3600 * OFFLINE_BASE_EFFICIENCY, 6);
    expect(result.state.pizzas.toNumber()).toBeCloseTo(1800, 6);
    expect(result.capped).toBe(false);
  });

  it('plafonne à 8 heures', () => {
    const result = applyOffline(state(), 24 * 3600 * 1000);
    expect(result.creditedSeconds).toBe(OFFLINE_BASE_CAP_SECONDS);
    expect(result.gained.toNumber()).toBeCloseTo(OFFLINE_BASE_CAP_SECONDS * OFFLINE_BASE_EFFICIENCY, 6);
    expect(result.capped).toBe(true);
  });

  it('ne donne rien si l’horloge a reculé', () => {
    const result = applyOffline({ ...state(), lastSaved: 10_000 }, 5_000);
    expect(result.gained.toNumber()).toBe(0);
    expect(result.state.pizzas.toNumber()).toBe(0);
    expect(result.state.lastSaved).toBe(5_000);
  });

  it('ne donne rien sans production', () => {
    const result = applyOffline({ ...createTestState(), lastSaved: 0, pizzas: D(50) }, 3600 * 1000);
    expect(result.gained.toNumber()).toBe(0);
    expect(result.state.pizzas.toNumber()).toBe(50);
  });

  it('met à jour lastSaved pour ne pas créditer deux fois', () => {
    const first = applyOffline(state(), 3600 * 1000);
    const second = applyOffline(first.state, 3600 * 1000);
    expect(second.gained.toNumber()).toBe(0);
  });
});
