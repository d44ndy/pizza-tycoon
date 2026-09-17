import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import { CITIES, CITIES_BY_ID, CITY_CAPS } from '../src/data/cities.ts';
import {
  canTranscend, canUpgradeCity, cityUpgradeCost, contractsFromTotal, doTranscend,
  expansionRevealed, isCityAvailable, isFounded, pendingContracts, totalCityLevels, upgradeCity,
} from '../src/engine/expansion.ts';
import { cityLevel, expansionLayer, permanentEffects, recipeLayer } from '../src/engine/prestige.ts';
import { cityProduction, clickPower, kitchenProduction, totalProduction } from '../src/engine/formulas.ts';
import { offlineEfficiency } from '../src/engine/offline.ts';
import { buyUpgrade } from '../src/engine/upgrades.ts';
import { deserialize, serialize } from '../src/engine/save.ts';

/** Joueur de fin de couche 1 : Étoiles, arbre, défis, gros cumul. */
function veteran(earnedTotal = '2e15'): GameState {
  const base = createTestState();
  const withGen = {
    ...base,
    pizzas: D('1e12'),
    generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 100 } },
    achievements: { 'stock-1': 5 },
    challenges: { active: null, completed: { bricolage: 12 } },
    stats: { ...base.stats, earnedTotal: D(earnedTotal), earnedPrestige: D(earnedTotal), clicksTotal: 500 },
    prestige: {
      layers: {
        recipe: { currency: D(40), totalEarned: D(60), resets: 7, nodes: { carnet: 1, 'pate-mere': 1 } },
      },
    },
  };
  return buyUpgrade(withGen, 'apprenti-1').state;
}

/** Donne des Contrats et éventuellement des villes déjà fondées. */
function withContracts(state: GameState, contracts: number, cities: Record<string, number> = {}): GameState {
  return {
    ...state,
    prestige: {
      ...state.prestige,
      layers: {
        ...state.prestige.layers,
        expansion: { currency: D(contracts), totalEarned: D(contracts), resets: 0, nodes: cities },
      },
    },
  };
}

describe('Contrats', () => {
  it('suit la racine cubique du cumul divisé par le diviseur', () => {
    expect(contractsFromTotal(D('1e12')).toNumber()).toBe(0);
    expect(contractsFromTotal(D('2e12')).toNumber()).toBe(1);
    expect(contractsFromTotal(D('1.6e13')).toNumber()).toBe(2);
    expect(contractsFromTotal(D('2e15')).toNumber()).toBe(10);
  });

  it('ne compte que ce qui n’a pas déjà été encaissé', () => {
    const state = veteran('2e15');
    expect(pendingContracts(state).toNumber()).toBe(10);
    const after = doTranscend(state).state;
    expect(pendingContracts(after).toNumber()).toBe(0);
    expect(canTranscend(after)).toBe(false);
  });

  it('dévoile l’onglet bien avant la première transcendance', () => {
    expect(expansionRevealed(createTestState())).toBe(false);
    expect(expansionRevealed(veteran('1e12'))).toBe(true);
  });
});

describe('transcendance', () => {
  it('efface la couche 1 et garde ce qui doit l’être', () => {
    const before = withContracts(veteran('2e15'), 0, { naples: 2 });
    const { state, gained } = doTranscend(before);

    expect(gained.toNumber()).toBe(10);
    // Effacé : la couche 1 dans son intégralité.
    expect(state.pizzas.toNumber()).toBe(0);
    expect(state.generators.apprenti.owned).toBe(0);
    expect(state.upgrades).toEqual({});
    expect(recipeLayer(state).currency.toNumber()).toBe(0);
    expect(recipeLayer(state).nodes).toEqual({});
    expect(recipeLayer(state).resets).toBe(0);
    expect(state.stats.earnedPrestige.toNumber()).toBe(0);
    // Conservé : hauts faits, défis, villes, cumul global.
    expect(state.achievements).toEqual({ 'stock-1': 5 });
    expect(state.challenges.completed).toEqual({ bricolage: 12 });
    expect(cityLevel(state, 'naples')).toBe(2);
    expect(state.stats.earnedTotal.toString()).toBe(before.stats.earnedTotal.toString());
    expect(expansionLayer(state).currency.toNumber()).toBe(10);
    expect(expansionLayer(state).resets).toBe(1);
  });

  it('ne fait rien sans Contrat à gagner', () => {
    const state = veteran('1e11');
    const result = doTranscend(state);
    expect(result.gained.toNumber()).toBe(0);
    expect(result.state).toBe(state);
  });

  it('interrompt un défi en cours', () => {
    const state = { ...veteran('2e15'), challenges: { active: 'inflation', completed: {} } };
    expect(doTranscend(state).state.challenges.active).toBeNull();
  });
});

describe('villes', () => {
  it('se fondent dans l’ordre', () => {
    const state = withContracts(veteran(), 500);
    expect(isCityAvailable(state, CITIES_BY_ID.naples)).toBe(true);
    expect(isCityAvailable(state, CITIES_BY_ID.chicago)).toBe(false);

    const withNaples = upgradeCity(state, 'naples').state;
    expect(isFounded(withNaples, 'naples')).toBe(true);
    expect(isCityAvailable(withNaples, CITIES_BY_ID.chicago)).toBe(true);
  });

  it('coûtent de plus en plus cher à chaque niveau', () => {
    let state = withContracts(veteran(), 500);
    expect(cityUpgradeCost(state, CITIES_BY_ID.naples)).toBe(1); // fondation
    state = upgradeCity(state, 'naples').state;
    expect(cityUpgradeCost(state, CITIES_BY_ID.naples)).toBe(1); // niveau 1 -> 2
    state = upgradeCity(state, 'naples').state;
    expect(cityUpgradeCost(state, CITIES_BY_ID.naples)).toBe(2);
    expect(cityLevel(state, 'naples')).toBe(2);
    expect(totalCityLevels(state)).toBe(2);
  });

  it('refusent l’achat sans Contrats', () => {
    const pauvre = withContracts(veteran(), 0);
    expect(canUpgradeCity(pauvre, CITIES_BY_ID.naples)).toBe(false);
    expect(upgradeCity(pauvre, 'naples').bought).toBe(false);
  });

  it('produisent en parallèle des cuisines', () => {
    const sans = withContracts(veteran(), 10);
    expect(cityProduction(sans).toNumber()).toBe(0);

    const avec = withContracts(veteran(), 10, { naples: 3 });
    expect(cityProduction(avec).gt(0)).toBe(true);
    expect(totalProduction(avec).toString()).toBe(
      kitchenProduction(avec).add(cityProduction(avec)).toString(),
    );
  });

  it('continuent de produire après une transcendance', () => {
    const before = withContracts(veteran('2e15'), 0, { naples: 5 });
    const after = doTranscend(before).state;
    expect(after.generators.apprenti.owned).toBe(0);
    expect(cityProduction(after).gt(0)).toBe(true);
    expect(totalProduction(after).gt(0)).toBe(true);
  });
});

describe('effets des villes', () => {
  it('Naples booste les cuisines mais pas les villes', () => {
    const base = withContracts(veteran(), 0, { naples: 4 });
    expect(permanentEffects(base).kitchenMult.toNumber()).toBeCloseTo(1.2, 9); // 4 × 5 %
    expect(permanentEffects(base).cityMult.toNumber()).toBe(1);
  });

  it('Chicago multiplie le pétrissage', () => {
    const sans = withContracts(veteran(), 0, { naples: 1 });
    const avec = withContracts(veteran(), 0, { naples: 1, chicago: 2 });
    expect(clickPower(avec).toNumber()).toBeCloseTo(clickPower(sans).toNumber() * 1.5 * 1.5, 6);
  });

  it('la station orbitale booste toutes les villes', () => {
    const state = withContracts(veteran(), 0, { naples: 1, chicago: 1, tokyo: 1, paris: 1, saopaulo: 1, orbite: 2 });
    expect(permanentEffects(state).cityMult.toNumber()).toBeCloseTo(1.4, 9); // 2 × 20 %
  });

  it('plafonne les effets qui casseraient l’économie', () => {
    const state = withContracts(veteran(), 0, { naples: 1, chicago: 1, tokyo: 99, paris: 99, saopaulo: 99 });
    const effects = permanentEffects(state);
    expect(effects.generatorCost).toBeGreaterThanOrEqual(CITY_CAPS.cheaperKitchens);
    expect(effects.eventFrequency).toBeGreaterThanOrEqual(CITY_CAPS.fasterEvents);
    expect(effects.offlineEfficiency).toBeLessThanOrEqual(1);
    expect(offlineEfficiency(state)).toBeLessThanOrEqual(1);
  });

  it('São Paulo améliore le rendement hors ligne', () => {
    const state = withContracts(veteran(), 0, { naples: 1, chicago: 1, tokyo: 1, paris: 1, saopaulo: 3 });
    expect(offlineEfficiency(state)).toBeCloseTo(0.5 + 0.18, 9);
  });
});

describe('sauvegarde', () => {
  it('conserve Contrats et villes', () => {
    const state = withContracts(veteran(), 12, { naples: 3, chicago: 1 });
    const restored = deserialize(serialize(state, 1000));
    expect(expansionLayer(restored).currency.toNumber()).toBe(12);
    expect(cityLevel(restored, 'naples')).toBe(3);
    expect(cityLevel(restored, 'chicago')).toBe(1);
  });

  it('ignore une ville qui n’existe plus', () => {
    const state = withContracts(veteran(), 12, { naples: 3, atlantide: 9 });
    const restored = deserialize(serialize(state, 1000));
    expect(expansionLayer(restored).nodes).toEqual({ naples: 3 });
  });

  it('chaque ville a un coût strictement croissant', () => {
    for (let i = 1; i < CITIES.length; i++) {
      expect(CITIES[i]!.foundCost).toBeGreaterThan(CITIES[i - 1]!.foundCost);
      expect(CITIES[i]!.baseProduction.gt(CITIES[i - 1]!.baseProduction)).toBe(true);
    }
  });
});
