/**
 * Améliorations : déblocage, achat, et lecture des effets possédés.
 * Fonctions pures, comme le reste du moteur.
 */
import { ZERO, type Decimal } from './decimal.ts';
import type { GameState } from './state.ts';
import { UPGRADES, UPGRADES_BY_ID, type UpgradeCondition, type UpgradeDef } from '../data/upgrades.ts';

/** Évalue la condition de déblocage d'une amélioration. */
export function conditionMet(state: GameState, condition: UpgradeCondition): boolean {
  switch (condition.type) {
    case 'generatorOwned':
      return state.generators[condition.id].owned >= condition.count;
    case 'clicksTotal':
      return state.stats.clicksTotal >= condition.count;
    case 'achievementsOwned':
      return Object.keys(state.achievements).length >= condition.count;
    case 'both':
      return conditionMet(state, condition.a) && conditionMet(state, condition.b);
  }
}

export function isOwned(state: GameState, id: string): boolean {
  return state.upgrades[id] === true;
}

/** Une amélioration est visible quand sa condition est remplie et qu'elle n'est pas déjà achetée. */
export function isAvailable(state: GameState, def: UpgradeDef): boolean {
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
  if (!def || isOwned(state, id) || !conditionMet(state, def.unlock) || state.pizzas.lt(def.cost)) {
    return { state, bought: false, spent: ZERO };
  }
  return {
    state: {
      ...state,
      pizzas: state.pizzas.sub(def.cost),
      upgrades: { ...state.upgrades, [id]: true },
    },
    bought: true,
    spent: def.cost,
  };
}
