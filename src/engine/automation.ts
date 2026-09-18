/**
 * Automatisation débloquée par l'arbre de prestige : pétrisseur automatique,
 * commis aux achats, chef des achats.
 *
 * Tout passe par les mêmes actions que le joueur (`clickDough`, `buyGenerator`,
 * `buyUpgrade`) : aucune règle parallèle, donc aucun risque de divergence.
 */
import type { GameState } from './state.ts';
import { GENERATORS } from '../data/generators.ts';
import { buyGenerator, clickDough } from './actions.ts';
import { availableUpgrades, buyUpgrade, upgradeCost } from './upgrades.ts';
import { costOfNext, costRules, totalProduction } from './formulas.ts';
import { currentRules, isGeneratorAllowed } from './challenges.ts';
import { permanentEffects } from './prestige.ts';

/** Intervalle entre deux passes d'achat automatique, en secondes. */
const BUY_INTERVAL = 1;

/**
 * Le commis ne dépense jamais plus de la moitié du stock d'un coup : le joueur
 * doit pouvoir continuer à mettre de côté pour une grosse cuisine sans que
 * l'automatisation vide la caisse derrière lui.
 */
const AUTO_BUY_STOCK_RATIO = 0.5;

/** Achète la cuisine au meilleur rapport production/coût, si elle est abordable. */
function autoBuyGenerator(state: GameState): GameState {
  const budget = state.pizzas.mul(AUTO_BUY_STOCK_RATIO);
  const rules = costRules(state);
  const allowed = currentRules(state);
  const current = totalProduction(state);

  let bestId: (typeof GENERATORS)[number]['id'] | null = null;
  let bestRatio = 0;
  const excluded = state.settings.automation.excluded;
  for (const def of GENERATORS) {
    if (!isGeneratorAllowed(allowed, def)) continue;
    // Le joueur a retiré cette cuisine des mains du commis.
    if (excluded.includes(def.id)) continue;
    const owned = state.generators[def.id].owned;
    const cost = costOfNext(def, owned, rules);
    if (cost.gt(budget)) continue;
    const after = totalProduction({
      ...state,
      generators: { ...state.generators, [def.id]: { ...state.generators[def.id], owned: owned + 1 } },
    });
    const ratio = after.sub(current).div(cost).toNumber();
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestId = def.id;
    }
  }
  return bestId ? buyGenerator(state, bestId, 1).state : state;
}

/** Achète la première amélioration abordable (les moins chères d'abord). */
function autoBuyUpgrade(state: GameState): GameState {
  for (const def of availableUpgrades(state)) {
    // Prix réel (réduction « Bricolage » comprise), pas le prix catalogue.
    if (state.pizzas.gte(upgradeCost(state, def))) return buyUpgrade(state, def.id).state;
  }
  return state;
}

/**
 * Fait tourner l'automatisation pour `dt` secondes.
 * Les fractions de clic et le délai entre deux achats sont mémorisés dans l'état,
 * donc le résultat ne dépend pas du découpage du temps.
 */
export function runAutomation(state: GameState, dt: number): GameState {
  const effects = permanentEffects(state);
  const prefs = state.settings.automation;
  // Un automatisme ne tourne que s'il est débloqué ET que le joueur l'a laissé actif.
  const clicker = effects.autoClick > 0 && prefs.clicker;
  const generators = effects.autoBuyGenerators && prefs.generators;
  const upgrades = effects.autoBuyUpgrades && prefs.upgrades;
  if (!clicker && !generators && !upgrades) return state;

  let next = state;
  let { clickCredit, buyCooldown } = state.automation;

  // Pétrissage automatique. La marge de 1e-9 évite qu'une somme de 0,05 s
  // s'arrête à 0,999999999 et fasse perdre un clic selon le découpage du temps.
  if (clicker) {
    clickCredit += effects.autoClick * dt;
    let guard = 0;
    while (clickCredit >= 1 - 1e-9 && guard++ < 60) {
      next = clickDough(next);
      clickCredit -= 1;
    }
  }

  // Achats automatiques, une passe par seconde.
  buyCooldown -= dt;
  if (buyCooldown <= 0) {
    buyCooldown = BUY_INTERVAL;
    // Les améliorations d'abord : à prix égal elles rapportent presque toujours plus.
    if (upgrades) next = autoBuyUpgrade(next);
    if (generators) next = autoBuyGenerator(next);
  }

  return { ...next, automation: { clickCredit, buyCooldown } };
}
