import { describe, expect, it } from 'vitest';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { D } from '../src/engine/decimal.ts';
import { applyElapsed } from '../src/engine/offline.ts';
import { bakeCooldown } from '../src/engine/chefPizza.ts';
import { checkAchievements } from '../src/engine/achievements.ts';
import { formatDecimal, formatMultiplier } from '../src/engine/format.ts';
import { useGameStore } from '../src/store/gameStore.ts';
import { CHEF_BAKE_COOLDOWN } from '../src/data/config.ts';
import type { ToppingId } from '../src/data/toppings.ts';

const LETTERS: Record<string, ToppingId> = {
  T: 'tomate', B: 'basilic', C: 'champignon', N: 'oignon', J: 'jambon', A: 'ananas',
};
const layout = (text: string) => [...text].map((l) => LETTERS[l] ?? null);

function withBaked(text: string): GameState {
  const base = createTestState();
  return { ...base, chef: { ...base.chef, baked: layout(text), bakedAt: 0 } };
}

describe('Hors ligne', () => {
  it('annonce le vrai rendement, pas celui de départ', () => {
    const state = createTestState();
    const boosted: GameState = {
      ...state,
      prestige: {
        layers: { recipe: { currency: D(0), totalEarned: D(0), resets: 1, nodes: { carnet: 1, 'pate-qui-leve': 1 } } },
      },
    };
    expect(applyElapsed(state, 600, 0).efficiency).toBe(0.5);
    expect(applyElapsed(boosted, 600, 0).efficiency).toBe(0.65);
  });

  it('laisse le four du chef refroidir pendant l’absence', () => {
    const baked = withBaked('TBTBTBTB');
    expect(bakeCooldown(baked)).toBe(CHEF_BAKE_COOLDOWN);
    const back = applyElapsed(baked, 2 * 3600, 0).state;
    expect(bakeCooldown(back)).toBe(0);
    // Le temps de jeu, lui, ne bouge pas : il règle les pizzas d'or et les statistiques.
    expect(back.stats.playTimeTotal).toBe(baked.stats.playTimeTotal);
  });

  it('compte l’absence entière pour le four, même au-delà du plafond', () => {
    const back = applyElapsed(withBaked('TBTBTBTB'), 30 * 3600, 0).state;
    expect(bakeCooldown(back)).toBe(0);
  });
});

describe('Hauts faits du chef', () => {
  const ids = (state: GameState) => checkAchievements(state, D(0)).unlocked.map((a) => a.id);

  it('récompense la première fournée', () => {
    expect(ids(withBaked('T.......'))).toContain('chef-1');
  });

  it('récompense chacun des trois records, et seulement eux', () => {
    expect(ids(withBaked('BTBTBTBT'))).toContain('chef-2');
    expect(ids(withBaked('CCNCNNCN'))).toContain('chef-3');
    expect(ids(withBaked('AJAJAJAJ'))).toContain('chef-4');
    expect(ids(withBaked('BTBTBTTT'))).not.toContain('chef-2');
  });

  it('ne donne rien sans pizza au four', () => {
    expect(ids(createTestState()).filter((id) => id.startsWith('chef'))).toEqual([]);
  });
});

describe('Nombres à la française', () => {
  it('écrit les décimales avec une virgule', () => {
    expect(formatDecimal(1.3647)).toBe('1,36');
    expect(formatDecimal(12.5, 1)).toBe('12,5');
    expect(formatMultiplier(1.06)).toBe('×1,06');
  });
});

describe('Notifications de hauts faits', () => {
  it('regroupe les hauts faits qui arrivent ensemble', () => {
    const store = useGameStore.getState();
    for (const name of ['A', 'B', 'C', 'D']) {
      store.pushToast({ kind: 'achievement', title: 'Haut fait !', text: name, names: [name] });
    }
    const toasts = useGameStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.names).toEqual(['A', 'B', 'C', 'D']);
  });
});
