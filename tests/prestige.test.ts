import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState, type GameState } from '../src/engine/state.ts';
import {
  buyNode, canPrestige, doPrestige, hasNode, pendingStars, recipeLayer,
  starMultiplier, starsFromTotal, treeEffects,
} from '../src/engine/prestige.ts';
import { PRESTIGE_TREE } from '../src/data/prestige.ts';
import { clickPower, costOfNext, generatorCostFactor, totalProduction } from '../src/engine/formulas.ts';
import { offlineCapSeconds, offlineEfficiency } from '../src/engine/offline.ts';
import { buyUpgrade } from '../src/engine/upgrades.ts';
import { runFor } from '../src/engine/tick.ts';
import { GENERATORS_BY_ID } from '../src/data/generators.ts';

/** Partie avancée : du cumul, des cuisines, une amélioration. */
function advanced(earnedTotal = '1e12'): GameState {
  const base = createTestState();
  const withGen = {
    ...base,
    pizzas: D('1e9'),
    generators: { ...base.generators, apprenti: { ...base.generators.apprenti, owned: 30 } },
    stats: { ...base.stats, earnedPrestige: D(earnedTotal), earnedTotal: D(earnedTotal), clicksTotal: 500 },
  };
  return buyUpgrade(withGen, 'apprenti-1').state;
}

/**
 * Donne des Étoiles sans passer par un prestige, pour tester l'arbre isolément.
 * `totalEarned` est réglable : c'est lui qui détermine les Étoiles encore en attente.
 */
function withStars(
  state: GameState,
  stars: number,
  nodes: Record<string, number> = {},
  totalEarned = stars,
): GameState {
  return {
    ...state,
    prestige: {
      ...state.prestige,
      layers: {
        ...state.prestige.layers,
        recipe: { currency: D(stars), totalEarned: D(totalEarned), resets: 1, nodes },
      },
    },
  };
}

describe('calcul des Étoiles', () => {
  it('suit la racine cubique du cumul divisé par 1e9', () => {
    expect(starsFromTotal(D(0)).toNumber()).toBe(0);
    expect(starsFromTotal(D('9.9e8')).toNumber()).toBe(0);
    expect(starsFromTotal(D('1e9')).toNumber()).toBe(1);
    expect(starsFromTotal(D('8e9')).toNumber()).toBe(2);
    expect(starsFromTotal(D('1e12')).toNumber()).toBe(10);
    expect(starsFromTotal(D('1e15')).toNumber()).toBe(100);
  });

  it('reste juste sur des nombres énormes', () => {
    expect(starsFromTotal(D('1e60')).toNumber()).toBeCloseTo(1e17, -12);
  });

  it('ne compte que les Étoiles pas encore encaissées', () => {
    const state = advanced('1e12');
    expect(pendingStars(state).toNumber()).toBe(10);
    const after = doPrestige(state).state;
    expect(pendingStars(after).toNumber()).toBe(0);
    expect(canPrestige(after)).toBe(false);
  });

  it('interdit le prestige en dessous d’une Étoile', () => {
    expect(canPrestige(advanced('5e8'))).toBe(false);
    expect(canPrestige(advanced('1e9'))).toBe(true);
  });
});

describe('remise à zéro', () => {
  it('efface la partie mais garde l’essentiel', () => {
    const before = { ...advanced('1e12'), achievements: { 'stock-1': 5 }, flags: { jackpot: true as const } };
    const { state, gained } = doPrestige(before);

    expect(gained.toNumber()).toBe(10);
    // Effacé
    expect(state.pizzas.toNumber()).toBe(0);
    expect(state.generators.apprenti.owned).toBe(0);
    expect(state.upgrades).toEqual({});
    expect(state.stats.playTimeRun).toBe(0);
    expect(state.stats.earnedRun.toNumber()).toBe(0);
    // Conservé
    expect(state.achievements).toEqual({ 'stock-1': 5 });
    expect(state.flags.jackpot).toBe(true);
    expect(state.stats.earnedTotal.toString()).toBe(before.stats.earnedTotal.toString());
    expect(state.stats.earnedPrestige.toString()).toBe(before.stats.earnedPrestige.toString());
    expect(recipeLayer(state).currency.toNumber()).toBe(10);
    expect(recipeLayer(state).resets).toBe(1);
  });

  it('ne fait rien sans Étoile à gagner', () => {
    const state = advanced('1e8');
    const result = doPrestige(state);
    expect(result.gained.toNumber()).toBe(0);
    expect(result.state).toBe(state);
  });

  it('offre les cuisines de départ achetées dans l’arbre', () => {
    const state = withStars(advanced('1e12'), 50, { carnet: 1, 'apprenti-motive': 1, 'mise-de-depart': 1 }, 0);
    const after = doPrestige(state).state;
    expect(after.generators.apprenti.owned).toBe(10);
    expect(after.generators.apprenti.unlocked).toBe(true);
    expect(after.pizzas.toNumber()).toBe(1000);
  });

  it('enchaîne trois prestiges sans incohérence', () => {
    let state = createTestState();
    let previousStars = 0;

    for (let run = 1; run <= 3; run++) {
      // On simule une run en créditant du cumul, comme le ferait le jeu.
      const cumul = D('1e9').mul(Math.pow(run * 10, 3));
      state = { ...state, stats: { ...state.stats, earnedPrestige: cumul, earnedTotal: cumul } };
      expect(canPrestige(state)).toBe(true);

      const { state: after, gained } = doPrestige(state);
      state = after;

      const layer = recipeLayer(state);
      // Les Étoiles ne peuvent que monter, et le total encaissé colle à la formule.
      expect(layer.currency.toNumber()).toBeGreaterThan(previousStars);
      expect(layer.totalEarned.toString()).toBe(starsFromTotal(cumul).toString());
      expect(layer.resets).toBe(run);
      expect(gained.gt(0)).toBe(true);
      expect(pendingStars(state).toNumber()).toBe(0);
      previousStars = layer.currency.toNumber();
    }
  });
});

describe('arbre de compétences', () => {
  it('exige les prérequis et les Étoiles', () => {
    const riche = withStars(createTestState(), 100);
    // « Pâte mère » exige « Le carnet du chef ».
    expect(buyNode(riche, 'pate-mere').bought).toBe(false);
    const withRoot = buyNode(riche, 'carnet').state;
    expect(hasNode(withRoot, 'carnet')).toBe(true);
    expect(buyNode(withRoot, 'pate-mere').bought).toBe(true);

    const pauvre = withStars(createTestState(), 0);
    expect(buyNode(pauvre, 'carnet').bought).toBe(false);
  });

  it('débite les Étoiles et ne s’achète qu’une fois', () => {
    const state = buyNode(withStars(createTestState(), 10), 'carnet').state;
    expect(recipeLayer(state).currency.toNumber()).toBe(9);
    expect(buyNode(state, 'carnet').bought).toBe(false);
  });

  it('n’a que des prérequis qui existent', () => {
    const ids = new Set(PRESTIGE_TREE.map((n) => n.id));
    for (const node of PRESTIGE_TREE) {
      for (const req of node.requires) expect(ids.has(req)).toBe(true);
    }
  });
});

describe('effets de l’arbre', () => {
  it('les Étoiles non dépensées augmentent la production', () => {
    const base = advanced();
    const avec = withStars(base, 10);
    expect(starMultiplier(avec).toNumber()).toBeCloseTo(1.2, 9); // 10 × 2 %
    expect(totalProduction(avec).toNumber()).toBeCloseTo(totalProduction(base).toNumber() * 1.2, 6);
  });

  it('« Étoile montante » remplace le bonus au lieu de s’y ajouter', () => {
    const state = withStars(advanced(), 10, { carnet: 1, 'pate-mere': 1, 'deuxieme-fournee': 1, 'etoile-montante': 1 });
    expect(treeEffects(state).starBonus).toBe(0.03);
    expect(starMultiplier(state).toNumber()).toBeCloseTo(1.3, 9);
  });

  it('multiplie la production et le pétrissage', () => {
    const base = advanced();
    const avec = withStars(base, 0, { carnet: 1, 'pate-mere': 1 });
    expect(totalProduction(avec).toNumber()).toBeCloseTo(totalProduction(base).toNumber() * 1.1 * 1.25, 6);
    const clic = withStars(base, 0, { carnet: 1, 'bras-muscles': 1 });
    expect(clickPower(clic).toNumber()).toBeCloseTo(clickPower(base).toNumber() * 1.1 * 3, 6);
  });

  it('réduit le coût des cuisines', () => {
    const state = withStars(advanced(), 0, { carnet: 1, 'pate-mere': 1, 'achats-groupes': 1 });
    expect(generatorCostFactor(state)).toBeCloseTo(0.95, 9);
    const def = GENERATORS_BY_ID.four;
    expect(costOfNext(def, 0, generatorCostFactor(state)).toNumber()).toBeCloseTo(95, 9);
  });

  it('améliore la progression hors ligne', () => {
    const base = advanced();
    expect(offlineEfficiency(base)).toBe(0.5);
    expect(offlineCapSeconds(base)).toBe(8 * 3600);

    const avec = withStars(base, 0, { carnet: 1, 'pate-qui-leve': 1, levain: 1, 'four-chaud': 1 });
    expect(offlineEfficiency(avec)).toBe(0.8);
    expect(offlineCapSeconds(avec)).toBe(12 * 3600);
  });
});

describe('automatisation', () => {
  it('le pétrisseur automatique pétrit tout seul', () => {
    const state = withStars(advanced(), 0, { carnet: 1, 'apprenti-motive': 1, 'petrisseur-auto': 1 });
    const after = runFor(state, 10, 1);
    expect(after.stats.clicksTotal).toBe(state.stats.clicksTotal + 10);
  });

  it('ne dépend pas du découpage du temps', () => {
    const state = withStars(advanced(), 0, { carnet: 1, 'apprenti-motive': 1, 'petrisseur-auto': 1 });
    const gros = runFor(state, 10, 1).stats.clicksTotal;
    const fin = runFor(state, 10, 0.05).stats.clicksTotal;
    expect(fin).toBe(gros);
  });

  it('le commis achète des cuisines sans vider la caisse', () => {
    const state = withStars(
      { ...advanced(), pizzas: D('1e6') },
      0,
      { carnet: 1, 'apprenti-motive': 1, commis: 1 },
    );
    const after = runFor(state, 5, 1);
    const achats = after.generators.apprenti.owned + after.generators.four.owned;
    expect(achats).toBeGreaterThan(state.generators.apprenti.owned);
    expect(after.pizzas.gt(0)).toBe(true);
  });

  it('ne fait rien tant que l’arbre n’est pas acheté', () => {
    const state = advanced();
    const after = runFor(state, 10, 1);
    expect(after.stats.clicksTotal).toBe(state.stats.clicksTotal);
  });
});
