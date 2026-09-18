/**
 * Toutes les formules du jeu : coûts, achat groupé, paliers, production.
 * Fonctions PURES : (état, données) -> valeur. Aucune mutation, aucun effet de bord.
 */
import { D, ONE, ZERO, type Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import type { BulkMode } from './state.ts';
import { GENERATORS, GENERATORS_BY_ID, type GeneratorDef, type GeneratorId } from '../data/generators.ts';
import { UPGRADES_BY_ID } from '../data/upgrades.ts';
import { achievementMultiplier } from './achievements.ts';
import { eventClickMultiplier, eventProductionMultiplier } from './events.ts';
import { starMultiplier, permanentEffects, cityLevel } from './prestige.ts';
import { CITIES } from '../data/cities.ts';
import { currentRules, isGeneratorAllowed } from './challenges.ts';
import {
  BASE_CLICK_POWER, COST_GROWTH, MILESTONE_MULTIPLIER, UNLOCK_RATIO,
  milestonesReached, nextMilestone, previousMilestone,
} from '../data/config.ts';

/** Constante 1,15 en Decimal (évite de la reconstruire à chaque appel). */

/**
 * `Decimal.pow` passe par exp/log et perd quelques décimales (2^3 = 7,999…).
 * Tant que le résultat tient dans un flottant natif, on préfère `Math.pow`, qui est
 * exact pour les puissances de 2 et nettement plus précis pour 1,15^n.
 */
function powFast(base: number, exponent: number): Decimal {
  const value = Math.pow(base, exponent);
  return Number.isFinite(value) ? D(value) : D(base).pow(exponent);
}

/**
 * Paramètres de coût en vigueur : la réduction permanente (arbre, défis) et la
 * croissance par exemplaire, qu'un défi peut durcir (1,3 au lieu de 1,15).
 *
 * Ils sont passés explicitement aux formules pour que celles-ci restent des
 * fonctions de calcul pur, utilisables sans état (tests, simulateur).
 */
export type CostRules = { readonly factor: number; readonly growth: number };

export const DEFAULT_COST_RULES: CostRules = { factor: 1, growth: COST_GROWTH };

export function costRules(state: GameState): CostRules {
  return {
    factor: permanentEffects(state).generatorCost,
    growth: currentRules(state).costGrowth,
  };
}

/** Coût du prochain exemplaire : base × croissance^possédés × réduction. */
export function costOfNext(def: GeneratorDef, owned: number, rules: CostRules = DEFAULT_COST_RULES): Decimal {
  return def.baseCost.mul(powFast(rules.growth, owned)).mul(rules.factor);
}

/**
 * Coût de `k` exemplaires d'un coup (somme d'une suite géométrique) :
 * base × 1,15^possédés × (1,15^k − 1) / 0,15
 */
export function costOfK(
  def: GeneratorDef,
  owned: number,
  k: number,
  rules: CostRules = DEFAULT_COST_RULES,
): Decimal {
  if (k <= 0) return ZERO;
  const start = costOfNext(def, owned, rules);
  return start.mul(powFast(rules.growth, k).sub(1)).div(rules.growth - 1);
}

/**
 * Nombre maximum d'exemplaires achetables avec `money` :
 * k = floor( log_1,15( money × 0,15 / (base × 1,15^possédés) + 1 ) )
 *
 * Le logarithme passe par des flottants : on corrige ensuite d'un cran si
 * l'arrondi nous a fait viser un exemplaire de trop (ou de trop peu).
 */
export function maxAffordable(
  def: GeneratorDef,
  owned: number,
  money: Decimal,
  rules: CostRules = DEFAULT_COST_RULES,
): number {
  const start = costOfNext(def, owned, rules);
  if (money.lt(start)) return 0;

  const ratio = money.mul(rules.growth - 1).div(start).add(1);
  const raw = ratio.log10().div(Math.log10(rules.growth)).toNumber();
  if (!Number.isFinite(raw)) return Number.MAX_SAFE_INTEGER;

  let k = Math.max(0, Math.floor(raw));
  // Corrections de sécurité (au plus quelques itérations).
  let guard = 0;
  while (k > 0 && costOfK(def, owned, k, rules).gt(money) && guard++ < 8) k--;
  while (costOfK(def, owned, k + 1, rules).lte(money) && guard++ < 16) k++;
  return k;
}

/** Résout le mode d'achat courant en un couple (quantité, coût) réellement payable. */
export function resolveBulk(
  def: GeneratorDef,
  owned: number,
  money: Decimal,
  bulkMode: BulkMode,
  rules: CostRules = DEFAULT_COST_RULES,
): { count: number; cost: Decimal; affordable: boolean } {
  if (bulkMode === 'max') {
    const count = maxAffordable(def, owned, money, rules);
    return { count, cost: costOfK(def, owned, count, rules), affordable: count > 0 };
  }
  const cost = costOfK(def, owned, bulkMode, rules);
  return { count: bulkMode, cost, affordable: money.gte(cost) };
}

/**
 * Multiplicateur propre à un générateur :
 * paliers (×2 à 25, 50, 100, 150…) × améliorations dédiées × synergies.
 */
export function generatorMultiplier(state: GameState, id: GeneratorId): Decimal {
  const owned = state.generators[id].owned;
  const rules = currentRules(state);
  let mult = rules.milestonesDisabled
    ? ONE
    : powFast(MILESTONE_MULTIPLIER, milestonesReached(owned));

  // Un seul parcours des améliorations possédées : générateur ×2 et synergies.
  let synergyBonus = 0;
  for (const upgradeId of Object.keys(state.upgrades)) {
    const effect = UPGRADES_BY_ID[upgradeId]?.effect;
    if (!effect) continue;
    if (effect.type === 'generatorMult' && effect.target === id) {
      mult = mult.mul(effect.factor);
    } else if (effect.type === 'synergy' && effect.target === id) {
      synergyBonus += (effect.perUnit / 100) * state.generators[effect.source].owned;
    }
  }
  return synergyBonus > 0 ? mult.mul(1 + synergyBonus) : mult;
}

/**
 * Multiplicateur global, appliqué à TOUTE la production.
 * Pipeline unique : les phases suivantes (Étoiles de prestige, défis)
 * viendront brancher leurs sources ici, sans toucher au tick.
 */
export function globalMultiplier(state: GameState): Decimal {
  return achievementMultiplier(state)
    .mul(eventProductionMultiplier(state))
    .mul(starMultiplier(state))
    .mul(permanentEffects(state).globalMult)
    // Contrainte d'un défi en cours (« Cuisine froide » divise la production par dix).
    .mul(currentRules(state).productionFactor);
}

/** Production d'une cuisine, pizzas par seconde, tous multiplicateurs inclus. */
export function generatorProduction(state: GameState, id: GeneratorId): Decimal {
  const gs = state.generators[id];
  if (gs.owned === 0) return ZERO;
  const def = GENERATORS_BY_ID[id];
  return def.baseProduction
    .mul(gs.owned)
    .mul(generatorMultiplier(state, id))
    .mul(globalMultiplier(state))
    // Bonus réservé aux cuisines (Naples).
    .mul(permanentEffects(state).kitchenMult);
}

/** Production des cuisines seules. */
export function kitchenProduction(state: GameState): Decimal {
  let total = ZERO;
  for (const def of GENERATORS) {
    total = total.add(generatorProduction(state, def.id));
  }
  return total;
}

/**
 * Production des villes (couche 2). Elle tourne en parallèle des cuisines et
 * survit à tous les prestiges : c'est elle qui relance chaque nouvelle partie.
 */
export function cityProduction(state: GameState): Decimal {
  let base = ZERO;
  for (const def of CITIES) {
    const level = cityLevel(state, def.id);
    if (level > 0) base = base.add(def.baseProduction.mul(level));
  }
  if (base.lte(0)) return ZERO;
  return base.mul(permanentEffects(state).cityMult).mul(globalMultiplier(state));
}

/** Production totale du joueur, pizzas par seconde : cuisines + villes. */
export function totalProduction(state: GameState): Decimal {
  return kitchenProduction(state).add(cityProduction(state));
}

/**
 * Valeur d'un clic : une base multipliée (améliorations de clic, frénésie, hauts faits),
 * à laquelle s'ajoute un pourcentage de la production par seconde.
 */
export function clickPower(state: GameState): Decimal {
  // Défi « Zéro clic » : le pétrissage ne rapporte plus rien.
  if (currentRules(state).clickDisabled) return ZERO;

  let mult = ONE;
  let productionPercent = 0;
  for (const upgradeId of Object.keys(state.upgrades)) {
    const effect = UPGRADES_BY_ID[upgradeId]?.effect;
    if (!effect) continue;
    if (effect.type === 'clickMult') mult = mult.mul(effect.factor);
    else if (effect.type === 'clickFromProduction') productionPercent += effect.percent;
  }

  const base = D(BASE_CLICK_POWER)
    .mul(mult)
    .mul(globalMultiplier(state))
    .mul(permanentEffects(state).clickMult)
    .mul(eventClickMultiplier(state));

  if (productionPercent === 0) return base;
  return base.add(totalProduction(state).mul(productionPercent / 100));
}

/** Un générateur devient visible quand le joueur possède 50 % de son coût actuel. */
export function shouldUnlock(state: GameState, def: GeneratorDef): boolean {
  const gs = state.generators[def.id];
  if (gs.unlocked) return true;
  // Une cuisine interdite par un défi ne se révèle pas : elle serait invendable.
  if (!isGeneratorAllowed(currentRules(state), def)) return false;
  return state.pizzas.gte(costOfNext(def, gs.owned, costRules(state)).mul(UNLOCK_RATIO));
}

/** Progression (0 → 1) vers le prochain palier de production. */
export function milestoneProgress(owned: number): { from: number; to: number; ratio: number } {
  const from = previousMilestone(owned);
  const to = nextMilestone(owned);
  const ratio = to === from ? 0 : Math.min(1, Math.max(0, (owned - from) / (to - from)));
  return { from, to, ratio };
}

/** Part d'un générateur dans la production totale (0 → 1), pour les infobulles. */
export function productionShare(state: GameState, id: GeneratorId): number {
  const total = totalProduction(state);
  if (total.lte(0)) return 0;
  return generatorProduction(state, id).div(total).toNumber();
}

/**
 * Secondes avant de pouvoir payer `cost` au rythme actuel de production.
 * 0 si c'est déjà abordable, `null` si la production est nulle (jamais, en l'état).
 * Ne tient pas compte des achats futurs : c'est une estimation « si tu attends ».
 */
export function timeToAfford(state: GameState, cost: Decimal): number | null {
  if (state.pizzas.gte(cost)) return 0;
  const production = totalProduction(state);
  if (production.lte(0)) return null;
  const seconds = cost.sub(state.pizzas).div(production).toNumber();
  return Number.isFinite(seconds) ? seconds : null;
}
