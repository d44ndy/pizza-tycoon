import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { buyUpgrade } from '../src/engine/upgrades.ts';
import { catchEvent } from '../src/engine/actions.ts';
import { clickPower, totalProduction } from '../src/engine/formulas.ts';
import { PRESTIGE_TREE } from '../src/data/prestige.ts';
import { EVENTS_BY_KIND } from '../src/data/events.ts';

/** Une cuisine qui tourne, et un clic qui rapporte 1 % de la production. */
function producing(): GameState {
  const base = createTestState();
  const state: GameState = {
    ...base,
    pizzas: D('1e30'),
    generators: {
      ...base.generators,
      apprenti: { ...base.generators.apprenti, owned: 100 },
      four: { ...base.generators.four, owned: 100 },
    },
    stats: { ...base.stats, clicksTotal: 100 },
  };
  return buyUpgrade(state, 'clic-prod-1').state;
}

function withNode(state: GameState, id: string): GameState {
  return {
    ...state,
    prestige: {
      ...state.prestige,
      layers: {
        ...state.prestige.layers,
        recipe: { currency: D(0), totalEarned: D(0), resets: 1, nodes: { [id]: 1 } },
      },
    },
  };
}

function nodeFactor(id: string): number {
  const effect = PRESTIGE_TREE.find((n) => n.id === id)?.effect;
  if (effect?.type !== 'clickMult') throw new Error(`${id} n'est pas un multiplicateur de clic`);
  return effect.factor;
}

describe('économie du clic', () => {
  it('la part liée à la production domine le clic une fois les cuisines lancées', () => {
    const state = producing();
    const productionPart = totalProduction(state).toNumber() * 0.01;
    expect(productionPart / clickPower(state).toNumber()).toBeGreaterThan(0.8);
  });

  it('un nœud de pétrissage multiplie le clic ENTIER, part de production comprise', () => {
    const sans = producing();
    // Bras musclés ne touche pas la production : seule la valeur du clic doit bouger.
    const avec = withNode(sans, 'bras-muscles');
    expect(totalProduction(avec).toNumber()).toBeCloseTo(totalProduction(sans).toNumber(), 6);
    expect(clickPower(avec).toNumber()).toBeCloseTo(clickPower(sans).toNumber() * nodeFactor('bras-muscles'), 6);
  });

  it('le coup de feu multiplie le clic entier', () => {
    const sans = { ...producing(), events: { ...producing().events, pending: { kind: 'frenzy' as const, bornAt: 0, x: 50, y: 50 } } };
    const avant = clickPower(sans).toNumber();
    const { state } = catchEvent(sans);
    expect(clickPower(state).toNumber()).toBeCloseTo(avant * EVENTS_BY_KIND.frenzy.multiplier, 6);
  });

  it('les améliorations de clic de la boutique ne doublent que la part fixe', () => {
    const sans = producing();
    const productionPart = totalProduction(sans).toNumber() * 0.01;
    const fixe = clickPower(sans).toNumber() - productionPart;
    const avec = buyUpgrade({ ...sans, stats: { ...sans.stats, clicksTotal: 100 } }, 'clic-1').state;
    expect(clickPower(avec).toNumber() - clickPower(sans).toNumber()).toBeCloseTo(fixe, 6);
  });
});
