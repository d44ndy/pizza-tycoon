import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { UPGRADES, UPGRADES_BY_ID } from '../src/data/upgrades.ts';
import { availableUpgrades, buyUpgrade, isAvailable, upgradesOwnedCount } from '../src/engine/upgrades.ts';
import { clickPower, generatorMultiplier, totalProduction } from '../src/engine/formulas.ts';

function withGenerators(counts: Partial<Record<string, number>>, pizzas = '1e30'): GameState {
  const base = createTestState();
  const generators = { ...base.generators };
  for (const [id, owned] of Object.entries(counts)) {
    const key = id as keyof typeof generators;
    generators[key] = { ...generators[key], owned: owned ?? 0 };
  }
  return { ...base, pizzas: D(pizzas), generators };
}

describe('catalogue', () => {
  it('contient 50 améliorations de cuisine, 9 synergies et 9 de clic', () => {
    expect(UPGRADES.filter((u) => u.category === 'generator')).toHaveLength(50);
    expect(UPGRADES.filter((u) => u.category === 'synergy')).toHaveLength(9);
    expect(UPGRADES.filter((u) => u.category === 'click')).toHaveLength(9);
  });

  it('n’a aucun identifiant en double', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });

  it('utilise les seuils du cahier des charges', () => {
    // 25, 50 et 100 sont AUSSI des paliers de production : à ces trois seuils, le
    // joueur encaisse un saut ×4. C'est voulu (c'est le comportement de Cookie Clicker).
    const seuils = new Set(
      UPGRADES.filter((u) => u.category === 'generator')
        .map((u) => (u.unlock.type === 'generatorOwned' ? u.unlock.count : -1)),
    );
    expect([...seuils].sort((a, b) => a - b)).toEqual([1, 5, 25, 50, 100]);
  });
});

describe('déblocage et achat', () => {
  it('n’apparaît qu’une fois la condition remplie', () => {
    const vide = createTestState();
    const premier = UPGRADES_BY_ID['apprenti-1']!;
    expect(isAvailable(vide, premier)).toBe(false);
    expect(isAvailable(withGenerators({ apprenti: 1 }), premier)).toBe(true);
  });

  it('débite le coût et s’achète une seule fois', () => {
    const state = withGenerators({ apprenti: 1 }, '1000');
    const first = buyUpgrade(state, 'apprenti-1');
    expect(first.bought).toBe(true);
    expect(first.state.pizzas.toNumber()).toBe(1000 - 150);
    expect(upgradesOwnedCount(first.state)).toBe(1);

    const second = buyUpgrade(first.state, 'apprenti-1');
    expect(second.bought).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('refuse un achat trop cher', () => {
    const state = withGenerators({ apprenti: 1 }, '10');
    expect(buyUpgrade(state, 'apprenti-1').bought).toBe(false);
  });

  it('propose les améliorations de la moins chère à la plus chère', () => {
    const list = availableUpgrades(withGenerators({ apprenti: 300, four: 300 }));
    for (let i = 1; i < list.length; i++) {
      expect(list[i]!.cost.gte(list[i - 1]!.cost)).toBe(true);
    }
  });
});

describe('effets', () => {
  it('double la production de la cuisine visée', () => {
    const state = withGenerators({ apprenti: 10 });
    const avant = generatorMultiplier(state, 'apprenti').toNumber();
    const apres = generatorMultiplier(buyUpgrade(state, 'apprenti-1').state, 'apprenti').toNumber();
    expect(apres).toBeCloseTo(avant * 2, 9);
  });

  it('applique les synergies : +1 % par exemplaire de la cuisine précédente', () => {
    const state = withGenerators({ apprenti: 50, four: 10 });
    const avant = generatorMultiplier(state, 'four').toNumber();
    const apres = generatorMultiplier(buyUpgrade(state, 'synergie-four').state, 'four').toNumber();
    expect(apres).toBeCloseTo(avant * 1.5, 9); // 50 apprentis => +50 %
  });

  it('multiplie la valeur du clic', () => {
    const state = { ...createTestState(), pizzas: D('1e6'), stats: { ...createTestState().stats, clicksTotal: 100 } };
    const avant = clickPower(state).toNumber();
    const apres = clickPower(buyUpgrade(state, 'clic-1').state).toNumber();
    expect(apres).toBeCloseTo(avant * 2, 9);
  });

  it('ajoute au clic un pourcentage de la production', () => {
    const base = withGenerators({ apprenti: 100, four: 1 });
    const state = { ...base, stats: { ...base.stats, clicksTotal: 100 } };
    const production = totalProduction(state).toNumber();
    const avant = clickPower(state).toNumber();
    const apres = clickPower(buyUpgrade(state, 'clic-prod-1').state).toNumber();
    expect(apres - avant).toBeCloseTo(production * 0.01, 6);
  });
});
