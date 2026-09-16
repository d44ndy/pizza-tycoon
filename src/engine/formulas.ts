/**
 * Toutes les formules du jeu : coûts, achat groupé, paliers, production.
 * Fonctions PURES : (état, données) -> valeur. Aucune mutation, aucun effet de bord.
 */
import { D, ONE, ZERO, type Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import type { BulkMode } from './state.ts';
import { GENERATORS, GENERATORS_BY_ID, type GeneratorDef, type GeneratorId } from '../data/generators.ts';
import {
  BASE_CLICK_POWER, COST_GROWTH, MILESTONE_MULTIPLIER, UNLOCK_RATIO,
  milestonesReached, nextMilestone, previousMilestone,
} from '../data/config.ts';

/** Constante 1,15 en Decimal (évite de la reconstruire à chaque appel). */
const LOG10_GROWTH = Math.log10(COST_GROWTH);

/**
 * `Decimal.pow` passe par exp/log et perd quelques décimales (2^3 = 7,999…).
 * Tant que le résultat tient dans un flottant natif, on préfère `Math.pow`, qui est
 * exact pour les puissances de 2 et nettement plus précis pour 1,15^n.
 */
function powFast(base: number, exponent: number): Decimal {
  const value = Math.pow(base, exponent);
  return Number.isFinite(value) ? D(value) : D(base).pow(exponent);
}

/** Coût du prochain exemplaire : base × 1,15^possédés. */
export function costOfNext(def: GeneratorDef, owned: number): Decimal {
  return def.baseCost.mul(powFast(COST_GROWTH, owned));
}

/**
 * Coût de `k` exemplaires d'un coup (somme d'une suite géométrique) :
 * base × 1,15^possédés × (1,15^k − 1) / 0,15
 */
export function costOfK(def: GeneratorDef, owned: number, k: number): Decimal {
  if (k <= 0) return ZERO;
  const start = costOfNext(def, owned);
  return start.mul(powFast(COST_GROWTH, k).sub(1)).div(COST_GROWTH - 1);
}

/**
 * Nombre maximum d'exemplaires achetables avec `money` :
 * k = floor( log_1,15( money × 0,15 / (base × 1,15^possédés) + 1 ) )
 *
 * Le logarithme passe par des flottants : on corrige ensuite d'un cran si
 * l'arrondi nous a fait viser un exemplaire de trop (ou de trop peu).
 */
export function maxAffordable(def: GeneratorDef, owned: number, money: Decimal): number {
  const start = costOfNext(def, owned);
  if (money.lt(start)) return 0;

  const ratio = money.mul(COST_GROWTH - 1).div(start).add(1);
  const raw = ratio.log10().div(LOG10_GROWTH).toNumber();
  if (!Number.isFinite(raw)) return Number.MAX_SAFE_INTEGER;

  let k = Math.max(0, Math.floor(raw));
  // Corrections de sécurité (au plus quelques itérations).
  let guard = 0;
  while (k > 0 && costOfK(def, owned, k).gt(money) && guard++ < 8) k--;
  while (costOfK(def, owned, k + 1).lte(money) && guard++ < 16) k++;
  return k;
}

/** Résout le mode d'achat courant en un couple (quantité, coût) réellement payable. */
export function resolveBulk(
  def: GeneratorDef,
  owned: number,
  money: Decimal,
  bulkMode: BulkMode,
): { count: number; cost: Decimal; affordable: boolean } {
  if (bulkMode === 'max') {
    const count = maxAffordable(def, owned, money);
    return { count, cost: costOfK(def, owned, count), affordable: count > 0 };
  }
  const cost = costOfK(def, owned, bulkMode);
  return { count: bulkMode, cost, affordable: money.gte(cost) };
}

/** Multiplicateur propre à un générateur : paliers (×2 à 25, 50, 100, 150…). */
export function generatorMultiplier(state: GameState, id: GeneratorId): Decimal {
  const owned = state.generators[id].owned;
  return powFast(MILESTONE_MULTIPLIER, milestonesReached(owned));
  // Phase 2 : × upgrades du générateur, × synergies.
}

/**
 * Multiplicateur global, appliqué à TOUTE la production.
 * Pipeline unique : les phases suivantes (succès, Étoiles de prestige, défis)
 * viendront brancher leurs sources ici, sans toucher au tick.
 */
export function globalMultiplier(_state: GameState): Decimal {
  return ONE;
}

/** Production d'un générateur, pizzas par seconde, tous multiplicateurs inclus. */
export function generatorProduction(state: GameState, id: GeneratorId): Decimal {
  const gs = state.generators[id];
  if (gs.owned === 0) return ZERO;
  const def = GENERATORS_BY_ID[id];
  return def.baseProduction
    .mul(gs.owned)
    .mul(generatorMultiplier(state, id))
    .mul(globalMultiplier(state));
}

/** Production totale du joueur, pizzas par seconde. */
export function totalProduction(state: GameState): Decimal {
  let total = ZERO;
  for (const def of GENERATORS) {
    total = total.add(generatorProduction(state, def.id));
  }
  return total;
}

/** Valeur d'un clic (Phase 2 : + un pourcentage de la production/s). */
export function clickPower(state: GameState): Decimal {
  return D(BASE_CLICK_POWER).mul(globalMultiplier(state));
}

/** Un générateur devient visible quand le joueur possède 50 % de son coût actuel. */
export function shouldUnlock(state: GameState, def: GeneratorDef): boolean {
  const gs = state.generators[def.id];
  if (gs.unlocked) return true;
  return state.pizzas.gte(costOfNext(def, gs.owned).mul(UNLOCK_RATIO));
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
