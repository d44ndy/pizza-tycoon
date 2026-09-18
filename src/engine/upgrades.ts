/**
 * Améliorations : déblocage, achat, et lecture des effets possédés.
 * Fonctions pures, comme le reste du moteur.
 */
import { ZERO, type Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import { UPGRADES, UPGRADES_BY_ID, type UpgradeCondition, type UpgradeDef } from '../data/upgrades.ts';
import { currentRules } from './challenges.ts';
import { permanentEffects } from './prestige.ts';

/** Évalue la condition de déblocage d'une amélioration. */
export function conditionMet(state: GameState, condition: UpgradeCondition): boolean {
  switch (condition.type) {
    case 'generatorOwned':
      return state.generators[condition.id].owned >= condition.count;
    case 'clicksTotal':
      return state.stats.clicksTotal >= condition.count;
    case 'both':
      return conditionMet(state, condition.a) && conditionMet(state, condition.b);
  }
}

export function isOwned(state: GameState, id: string): boolean {
  return state.upgrades[id] === true;
}

/** Prix réel d'une amélioration : le défi « Bricolage » les rend 20 % moins chères. */
export function upgradeCost(state: GameState, def: UpgradeDef): Decimal {
  const factor = permanentEffects(state).upgradeCost;
  return factor === 1 ? def.cost : def.cost.mul(factor);
}

/**
 * Une amélioration est visible quand sa condition est remplie et qu'elle n'est pas
 * déjà achetée — sauf pendant un défi qui interdit les améliorations.
 */
export function isAvailable(state: GameState, def: UpgradeDef): boolean {
  if (currentRules(state).upgradesDisabled) return false;
  return !isOwned(state, def.id) && conditionMet(state, def.unlock);
}

/** Améliorations proposées à l'achat, les moins chères d'abord. */
export function availableUpgrades(state: GameState): UpgradeDef[] {
  return UPGRADES.filter((def) => isAvailable(state, def)).sort((a, b) => (a.cost.lt(b.cost) ? -1 : 1));
}

/** Améliorations déjà achetées (onglet « acquises »). */
export function ownedUpgrades(state: GameState): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  for (const id of Object.keys(state.upgrades)) {
    const def = UPGRADES_BY_ID[id];
    if (def) list.push(def);
  }
  return list;
}

export function upgradesOwnedCount(state: GameState): number {
  return Object.keys(state.upgrades).length;
}

export type BuyUpgradeResult = { state: GameState; bought: boolean; spent: Decimal };

export function buyUpgrade(state: GameState, id: string): BuyUpgradeResult {
  const def = UPGRADES_BY_ID[id];
  if (!def || !isAvailable(state, def)) return { state, bought: false, spent: ZERO };

  const cost = upgradeCost(state, def);
  if (state.pizzas.lt(cost)) return { state, bought: false, spent: ZERO };

  return {
    state: {
      ...state,
      pizzas: state.pizzas.sub(cost),
      upgrades: { ...state.upgrades, [id]: true },
    },
    bought: true,
    spent: cost,
  };
}

/**
 * Achète toutes les améliorations abordables, les moins chères d'abord.
 * Renvoie le nombre d'achats effectués (0 si rien n'était abordable).
 */
export function buyAllUpgrades(state: GameState): { state: GameState; bought: number } {
  let current = state;
  let bought = 0;
  for (const def of availableUpgrades(state)) {
    const result = buyUpgrade(current, def.id);
    if (!result.bought) continue;
    current = result.state;
    bought++;
  }
  return { state: current, bought };
}
