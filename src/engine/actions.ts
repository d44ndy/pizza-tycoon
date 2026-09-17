/**
 * Actions du joueur : chacune prend un état et renvoie un NOUVEL état.
 * C'est la seule façon de modifier la partie (le store ne fait que les appeler).
 */
import { ZERO, type Decimal } from './decimal.ts';
import type { BulkMode, GameState, Settings, TabId } from './state.ts';
import { GENERATORS_BY_ID, type GeneratorId } from '../data/generators.ts';
import { clickPower, costRules, resolveBulk, totalProduction } from './formulas.ts';
import { currentRules, isGeneratorAllowed } from './challenges.ts';
import { addPizzas, updateUnlocks } from './tick.ts';
import { clickPendingEvent, hasBuff, type EventClickResult } from './events.ts';
import { raiseFlag } from './achievements.ts';
import { CLICK_BURST_COUNT, CLICK_BURST_WINDOW } from '../data/config.ts';

/** Pétrir la pâte : +1 pizza (multiplicateurs inclus). */
export function clickDough(state: GameState): GameState {
  const gain = clickPower(state);

  // Fenêtre glissante de 10 secondes, pour le haut fait « 100 clics en 10 secondes ».
  const now = state.stats.playTimeTotal;
  const burst = now - state.events.clickBurst.since > CLICK_BURST_WINDOW
    ? { count: 1, since: now }
    : { count: state.events.clickBurst.count + 1, since: state.events.clickBurst.since };

  let next: GameState = {
    ...state,
    events: { ...state.events, clickBurst: burst },
    stats: {
      ...state.stats,
      clicks: state.stats.clicks + 1,
      clicksTotal: state.stats.clicksTotal + 1,
    },
  };
  if (burst.count >= CLICK_BURST_COUNT) next = raiseFlag(next, 'clickBurst');

  return updateUnlocks(addPizzas(next, gain, true));
}

/** Attraper la pizza d'or affichée à l'écran. */
export function catchEvent(state: GameState): EventClickResult {
  const result = clickPendingEvent(state, totalProduction(state));
  if (result.gained.gt(0)) {
    return { ...result, state: updateUnlocks(addPizzas(result.state, result.gained)) };
  }
  return result;
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
  // Un défi peut interdire certaines cuisines : l'achat est refusé, pas seulement masqué.
  if (!isGeneratorAllowed(currentRules(state), def)) return { state, bought: 0, spent: ZERO };

  const { count, cost, affordable } = resolveBulk(def, gs.owned, state.pizzas, bulkMode, costRules(state));

  if (!affordable || count <= 0) {
    return { state, bought: 0, spent: ZERO };
  }

  let next: GameState = {
    ...state,
    pizzas: state.pizzas.sub(cost),
    generators: {
      ...state.generators,
      [id]: { ...gs, owned: gs.owned + count, totalBought: gs.totalBought + count },
    },
  };
  // Haut fait caché : profiter d'une frénésie pour investir.
  if (hasBuff(state, 'frenzy')) next = raiseFlag(next, 'frenzyBuy');

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
