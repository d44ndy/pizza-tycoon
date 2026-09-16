import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { runFor } from '../src/engine/tick.ts';
import { catchEvent, clickDough } from '../src/engine/actions.ts';
import { clickPower, totalProduction } from '../src/engine/formulas.ts';
import { buffRemaining, clearBuffs, hasBuff, pendingRemaining } from '../src/engine/events.ts';
import { EVENT_LIFETIME, EVENT_MAX_DELAY } from '../src/data/events.ts';

/** Une partie qui produit : 10 apprentis = 1 pizza/s. */
function playing(seed = 12345): GameState {
  const base = createTestState();
  return {
    ...base,
    rng: { seed },
    pizzas: D('1e6'),
    generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 10 } },
  };
}

/** Avance jusqu'à ce qu'une pizza d'or soit affichée (ou abandonne). */
function runUntilPending(state: GameState, maxSeconds = 4000): GameState {
  let current = state;
  for (let t = 0; t < maxSeconds; t += 1) {
    current = runFor(current, 1, 1);
    if (current.events.pending) return current;
  }
  return current;
}

describe('apparition', () => {
  it('n’apparaît pas tant qu’aucune cuisine n’a été achetée', () => {
    const state = runFor(createTestState(), 2000, 1);
    expect(state.events.pending).toBeNull();
    expect(state.events.nextSpawnAt).toBe(0);
  });

  it('finit par apparaître, dans la fenêtre de délai prévue', () => {
    const state = runUntilPending(playing());
    expect(state.events.pending).not.toBeNull();
    expect(state.stats.playTimeTotal).toBeLessThanOrEqual(EVENT_MAX_DELAY + 2);
  });

  it('disparaît au bout de 12 secondes si le joueur ne clique pas', () => {
    const spotted = runUntilPending(playing());
    expect(pendingRemaining(spotted)).toBeGreaterThan(0);
    const after = runFor(spotted, EVENT_LIFETIME + 1, 1);
    expect(after.events.pending).toBeNull();
  });

  it('ne pénalise jamais le joueur qui ignore les pizzas d’or', () => {
    // Sur une longue période sans jamais cliquer, aucun effet ne doit être actif
    // et la production ne doit jamais baisser (elle peut monter : hauts faits obtenus).
    const state = runFor(playing(), 3000, 1);
    expect(state.events.buffs).toHaveLength(0);
    expect(totalProduction(state).gte(totalProduction(playing()))).toBe(true);
  });

  it('est déterministe : même graine, même scénario', () => {
    const a = runFor(playing(777), 1500, 1);
    const b = runFor(playing(777), 1500, 1);
    expect(a.events.nextSpawnAt).toBe(b.events.nextSpawnAt);
    expect(a.events.pending?.kind).toBe(b.events.pending?.kind);
  });
});

describe('effets', () => {
  /** Force une pizza d'or d'un type donné, pour tester chaque effet. */
  function withPending(kind: 'bonus' | 'frenzy' | 'jackpot' | 'malus'): GameState {
    const state = playing();
    return { ...state, events: { ...state.events, pending: { kind, bornAt: 0, x: 50, y: 50 } } };
  }

  it('la livraison de mozzarella multiplie la production par 7', () => {
    const before = totalProduction(withPending('bonus')).toNumber();
    const { state } = catchEvent(withPending('bonus'));
    expect(hasBuff(state, 'bonus')).toBe(true);
    expect(totalProduction(state).toNumber()).toBeCloseTo(before * 7, 6);
    expect(buffRemaining(state, 'bonus')).toBeCloseTo(77, 6);
  });

  it('le coup de feu multiplie le clic par 777', () => {
    const before = clickPower(withPending('frenzy')).toNumber();
    const { state } = catchEvent(withPending('frenzy'));
    expect(clickPower(state).toNumber()).toBeCloseTo(before * 777, 6);
  });

  it('le pourboire vaut 15 minutes de production, plafonné à 15 % du stock', () => {
    const state = withPending('jackpot');
    const production = totalProduction(state).toNumber(); // 1/s => 900 pizzas en 15 min
    const result = catchEvent(state);
    expect(result.gained.toNumber()).toBeCloseTo(production * 900, 6);
    expect(result.state.pizzas.toNumber()).toBeCloseTo(1e6 + production * 900, 3);

    // Stock faible : c'est le plafond de 15 % qui s'applique.
    const pauvre = { ...state, pizzas: D(100) };
    expect(catchEvent(pauvre).gained.toNumber()).toBeCloseTo(15, 6);
  });

  it('le contrôle d’hygiène ne s’applique que si on clique dessus', () => {
    const state = withPending('malus');
    expect(totalProduction(state).toNumber()).toBeCloseTo(1, 6); // rien tant qu'on ignore
    const { state: clicked } = catchEvent(state);
    expect(totalProduction(clicked).toNumber()).toBeCloseTo(0.5, 6);
    expect(clicked.flags.malusClicked).toBe(true);
  });

  it('les effets expirent', () => {
    const { state } = catchEvent(withPending('bonus'));
    const after = runFor(state, 78, 1);
    expect(hasBuff(after, 'bonus')).toBe(false);
    expect(totalProduction(after).toNumber()).toBeLessThan(2);
  });

  it('compte les pizzas d’or attrapées et marque l’achat pendant une frénésie', () => {
    const { state } = catchEvent(withPending('frenzy'));
    expect(state.stats.eventsClicked).toBe(1);
    const clicked = clickDough(state);
    expect(clicked.pizzas.gt(state.pizzas)).toBe(true);
  });

  it('cliquer dans le vide ne fait rien', () => {
    const state = playing();
    const result = catchEvent(state);
    expect(result.kind).toBeNull();
    expect(result.state).toBe(state);
  });

  it('clearBuffs nettoie tout au retour d’une absence', () => {
    const { state } = catchEvent(withPending('bonus'));
    expect(clearBuffs(state).events.buffs).toHaveLength(0);
  });
});
