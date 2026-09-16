/**
 * Actions du joueur : chacune prend un état et renvoie un NOUVEL état.
 * C'est la seule façon de modifier la partie (le store ne fait que les appeler).
 */
import { ZERO, type Decimal } from './decimal.ts';
import type { BulkMode, GameState, Settings, TabId } from './state.ts';
import { GENERATORS_BY_ID, type GeneratorId } from '../data/generators.ts';
import { clickPower, resolveBulk } from './formulas.ts';
import { addPizzas, updateUnlocks } from './tick.ts';

/** Pétrir la pâte : +1 pizza (multiplicateurs inclus). */
export function clickDough(state: GameState): GameState {
  const gain = clickPower(state);
  const next = addPizzas(
    {
      ...state,
      stats: {
        ...state.stats,
        clicks: state.stats.clicks + 1,
        clicksTotal: state.stats.clicksTotal + 1,
      },
    },
    gain,
    true,
  );
  return updateUnlocks(next);
}

export type BuyResult = {
  state: GameState;
  /** Nombre réellement acheté (0 si le joueur n'avait pas les moyens). */
  bought: number;
  spent: Decimal;
};

/**
 * Achète des exemplaires d'un générateur selon le mode d'achat courant.
 * En mode x10/x100, l'achat est tout-ou-rien : soit on peut payer les 10, soit rien.
 */
export function buyGenerator(state: GameState, id: GeneratorId, mode?: BulkMode): BuyResult {
  const bulkMode = mode ?? state.settings.bulkMode;
  const def = GENERATORS_BY_ID[id];
  const gs = state.generators[id];
  const { count, cost, affordable } = resolveBulk(def, gs.owned, state.pizzas, bulkMode);

  if (!affordable || count <= 0) {
    return { state, bought: 0, spent: ZERO };
  }

  const next: GameState = {
    ...state,
    pizzas: state.pizzas.sub(cost),
    generators: {
      ...state.generators,
      [id]: { ...gs, owned: gs.owned + count, totalBought: gs.totalBought + count },
    },
  };
  return { state: updateUnlocks(next), bought: count, spent: cost };
}

/** Réglages (persistés dans la sauvegarde). */
export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function setBulkMode(state: GameState, bulkMode: BulkMode): GameState {
  return updateSettings(state, { bulkMode });
}

export function setTab(state: GameState, tab: TabId): GameState {
  return { ...state, ui: { ...state.ui, tab } };
}
