import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { timeToAfford, totalProduction } from '../src/engine/formulas.ts';
import { availableUpgrades, buyAllUpgrades, upgradeCost } from '../src/engine/upgrades.ts';
import { cycleBulkMode, toggleAutoBuy, updateAutomation } from '../src/engine/actions.ts';
import { recipeLayer, respecTree, spentStars } from '../src/engine/prestige.ts';
import { runFor } from '../src/engine/tick.ts';
import { deserialize, fromSaveData, serialize, toSaveData } from '../src/engine/save.ts';

/** 10 apprentis = 1 pizza/s. */
function producing(pizzas = '0'): GameState {
  const base = createTestState();
  return {
    ...base,
    pizzas: D(pizzas),
    generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 10 } },
  };
}

/** Joueur ayant débloqué des nœuds d'arbre donnés. */
function withNodes(state: GameState, nodes: Record<string, number>, stars = 0): GameState {
  return {
    ...state,
    prestige: {
      ...state.prestige,
      layers: {
        ...state.prestige.layers,
        recipe: { currency: D(stars), totalEarned: D(500), resets: 4, nodes },
      },
    },
  };
}

describe('temps avant de pouvoir payer', () => {
  it('vaut 0 quand c’est déjà abordable', () => {
    expect(timeToAfford(producing('100'), D(50))).toBe(0);
  });

  it('divise le manque par la production', () => {
    const state = producing('40');
    expect(totalProduction(state).toNumber()).toBeCloseTo(1, 9);
    expect(timeToAfford(state, D(100))).toBeCloseTo(60, 6);
  });

  it('renvoie null sans production', () => {
    expect(timeToAfford(createTestState(), D(15))).toBeNull();
  });
});

describe('tout acheter', () => {
  it('achète toutes les améliorations abordables, sans passer en négatif', () => {
    const base = producing('1e9');
    const state = {
      ...base,
      generators: {
        ...base.generators,
        apprenti: { ...base.generators.apprenti, owned: 100 },
        four: { ...base.generators.four, owned: 60 },
      },
      stats: { ...base.stats, clicksTotal: 700 },
    };
    const before = availableUpgrades(state).filter((u) => state.pizzas.gte(upgradeCost(state, u))).length;
    const { state: after, bought } = buyAllUpgrades(state);
    expect(bought).toBeGreaterThan(5);
    expect(bought).toBeLessThanOrEqual(before);
    expect(after.pizzas.gte(0)).toBe(true);
  });

  it('ne fait rien quand rien n’est abordable', () => {
    const state = producing('0');
    const result = buyAllUpgrades(state);
    expect(result.bought).toBe(0);
    expect(result.state).toBe(state);
  });
});

describe('réglages d’automatisation', () => {
  const clickerTree = { carnet: 1, 'apprenti-motive': 1, 'petrisseur-auto': 1 };
  const buyerTree = { carnet: 1, 'apprenti-motive': 1, commis: 1 };

  it('le pétrisseur s’arrête quand le joueur le coupe', () => {
    const on = withNodes(producing(), clickerTree);
    expect(runFor(on, 10, 1).stats.clicksTotal).toBe(10);
    const off = updateAutomation(on, { clicker: false });
    expect(runFor(off, 10, 1).stats.clicksTotal).toBe(0);
  });

  it('le commis n’achète jamais une cuisine retirée', () => {
    const base = withNodes(producing('1e6'), buyerTree);
    // On lui retire toutes les cuisines sauf le four.
    let state = base;
    for (const id of ['apprenti', 'scooter', 'camion', 'pizzeria', 'franchise', 'usine', 'robot', 'drone', 'plasma'] as const) {
      state = toggleAutoBuy(state, id);
    }
    const after = runFor(state, 20, 1);
    expect(after.generators.apprenti.owned).toBe(10);
    expect(after.generators.four.owned).toBeGreaterThan(0);
  });

  it('rendre une cuisine au commis la retire de la liste', () => {
    const state = toggleAutoBuy(toggleAutoBuy(createTestState(), 'four'), 'four');
    expect(state.settings.automation.excluded).toEqual([]);
  });

  it('le chef des achats respecte le prix réduit par « Bricolage »', () => {
    const tree = { ...buyerTree, 'chef-des-achats': 1 };
    const base = withNodes(producing('125'), tree);
    // 125 pizzas : assez pour « Tablier propre » à 120 (−20 %), pas à 150.
    const state = {
      ...updateAutomation(base, { generators: false }),
      challenges: { active: null, completed: { bricolage: 1 } },
    };
    expect(runFor(state, 1, 1).upgrades['apprenti-1']).toBe(true);
  });
});

describe('mode d’achat', () => {
  it('fait le tour ×1 → ×10 → ×100 → Max → ×1', () => {
    let state = createTestState();
    const seen = [state.settings.bulkMode];
    for (let i = 0; i < 4; i++) {
      state = cycleBulkMode(state);
      seen.push(state.settings.bulkMode);
    }
    expect(seen).toEqual([1, 10, 100, 'max', 1]);
  });
});

describe('refaire l’arbre', () => {
  it('rend toutes les Étoiles investies et vide l’arbre', () => {
    // carnet (1) + pâte mère (2) + bras musclés (2) = 5 Étoiles investies.
    const state = withNodes(producing('5e6'), { carnet: 1, 'pate-mere': 1, 'bras-muscles': 1 }, 3);
    expect(spentStars(state)).toBe(5);
    const { state: after, refunded } = respecTree(state);
    expect(refunded).toBe(5);
    expect(recipeLayer(after).nodes).toEqual({});
    expect(recipeLayer(after).currency.toNumber()).toBe(8);
  });

  it('coûte une remise à zéro de la partie', () => {
    const state = withNodes(producing('5e6'), { carnet: 1 }, 0);
    const after = respecTree(state).state;
    expect(after.pizzas.toNumber()).toBe(0);
    expect(after.generators.apprenti.owned).toBe(0);
  });

  it('ne fait rien sur un arbre vide', () => {
    const state = producing('100');
    const result = respecTree(state);
    expect(result.refunded).toBe(0);
    expect(result.state).toBe(state);
  });
});

describe('sauvegarde des nouveaux réglages', () => {
  it('conserve fil d’actualité et automatisation', () => {
    const state = toggleAutoBuy(updateAutomation(producing(), { upgrades: false }), 'drone');
    const restored = deserialize(serialize({ ...state, settings: { ...state.settings, newsTicker: false } }));
    expect(restored.settings.newsTicker).toBe(false);
    expect(restored.settings.automation).toEqual({
      clicker: true, generators: true, upgrades: false, excluded: ['drone'],
    });
  });

  it('donne les valeurs par défaut à une sauvegarde qui ne les connaît pas', () => {
    const save = toSaveData(producing(), 1) as unknown as Record<string, unknown>;
    const oldSettings = { notation: 'standard', bulkMode: 1, theme: 'light', reducedMotion: false, sound: false };
    const restored = fromSaveData({ ...save, settings: oldSettings });
    expect(restored.settings.newsTicker).toBe(true);
    expect(restored.settings.automation).toEqual({ clicker: true, generators: true, upgrades: true, excluded: [] });
  });

  it('ignore une cuisine inconnue dans les exclusions', () => {
    const save = toSaveData(producing(), 1);
    const restored = fromSaveData({
      ...save,
      settings: { ...save.settings, automation: { ...save.settings.automation, excluded: ['four', 'fusee'] } },
    });
    expect(restored.settings.automation.excluded).toEqual(['four']);
  });
});
