/**
 * Boucle de jeu : le seul endroit qui connaît le temps réel.
 *
 * - `requestAnimationFrame` mesure le delta réel, un ACCUMULATEUR le découpe en pas
 *   FIXES de 50 ms (20 ticks/s) → `tick()` reste déterministe.
 * - L'interface n'est rafraîchie qu'à 10 fps (publication d'un instantané dans le store).
 * - Un écart supérieur à 5 s (onglet endormi, veille machine) n'est pas rattrapé tick par
 *   tick : il est traité comme du temps hors ligne.
 * - Sauvegarde automatique toutes les 30 s, plus au `beforeunload` et quand l'onglet est caché.
 */
import {
  AUTOSAVE_SECONDS, MAX_CATCHUP_SECONDS, OFFLINE_BASE_CAP_SECONDS, TICK_SECONDS, UI_REFRESH_MS,
} from '../data/config.ts';
import type { GeneratorId } from '../data/generators.ts';
import { totalProduction } from '../engine/formulas.ts';
import { applyElapsed, applyOffline, OFFLINE_MIN_SECONDS } from '../engine/offline.ts';
import { createInitialState, type GameState } from '../engine/state.ts';
import { clearStorage, exportSave, importSave, loadFromStorage, saveToStorage } from '../engine/save.ts';
import { tick } from '../engine/tick.ts';
import {
  buyGenerator, catchEvent, clickDough, cycleBulkMode, toggleAutoBuy, updateAutomation,
} from '../engine/actions.ts';
import { GENERATORS } from '../data/generators.ts';
import type { AutomationSettings } from '../engine/state.ts';
import { buyAllUpgrades, buyUpgrade } from '../engine/upgrades.ts';
import { buyNode, doPrestige, respecTree } from '../engine/prestige.ts';
import { bakePizza, clearDraft, copyBakedToDraft, placeTopping } from '../engine/chefPizza.ts';
import type { ToppingId } from '../data/toppings.ts';
import { enterChallenge, exitChallenge } from '../engine/challenges.ts';
import { doTranscend, upgradeCity } from '../engine/expansion.ts';
import type { CityId } from '../data/cities.ts';
import type { ChallengeDef } from '../data/challenges.ts';
import { raiseFlag } from '../engine/achievements.ts';
import { clearBuffs } from '../engine/events.ts';
import type { FlagId } from '../data/achievements.ts';
import type { EventKind } from '../data/events.ts';
import type { AchievementDef } from '../data/achievements.ts';
import type { Decimal } from '../engine/decimal.ts';
import { t } from '../data/i18n/fr.ts';
import { useGameStore } from './gameStore.ts';

/** Noms affichés des pizzas d'or (le moteur, lui, ne connaît que leur type). */
const EVENT_NAMES: Record<EventKind, string> = {
  bonus: 'Livraison de mozzarella',
  frenzy: 'Coup de feu',
  jackpot: 'Pourboire du siècle',
  malus: "Contrôle d'hygiène",
};

/** État de jeu courant : vit ICI, hors de React, pour ne pas re-rendre 20 fois par seconde. */
let current: GameState = createInitialState();

let rafId: number | null = null;
let lastFrameMs = 0;
let accumulator = 0;
let lastPublishMs = 0;
let sinceSaveSeconds = 0;

/** Lecture ponctuelle de l'état (hors React). */
export function getState(): GameState {
  return current;
}

/** Publie un instantané dans le store (c'est ce que voit React). */
function publish(): void {
  useGameStore.getState().publish({ state: current, production: totalProduction(current) });
  lastPublishMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Applique une action pure à l'état courant et rafraîchit l'UI immédiatement. */
export function dispatch(action: (state: GameState) => GameState): void {
  current = action(current);
  publish();
}

/* ------------------------------------------------------------------ */
/* Actions exposées à l'interface                                      */
/* ------------------------------------------------------------------ */

export function doClick(): void {
  dispatch(clickDough);
}

export function doBuy(id: GeneratorId): void {
  dispatch((state) => buyGenerator(state, id).state);
}

export function doBuyUpgrade(id: string): void {
  dispatch((state) => buyUpgrade(state, id).state);
}

/** Achète toutes les améliorations abordables ; renvoie le nombre d'achats. */
export function doBuyAllUpgrades(): number {
  const result = buyAllUpgrades(current);
  if (result.bought > 0) {
    current = result.state;
    publish();
  }
  return result.bought;
}

/** Achète la n-ième cuisine (raccourcis 1 à 0) ; ne fait rien si elle est cachée. */
export function doBuyByIndex(index: number): boolean {
  const def = GENERATORS[index];
  if (!def || !current.generators[def.id].unlocked) return false;
  const result = buyGenerator(current, def.id);
  if (result.bought === 0) return false;
  current = result.state;
  publish();
  return true;
}

export function doCycleBulk(): void {
  dispatch(cycleBulkMode);
}

export function doToggleAutoBuy(id: GeneratorId): void {
  dispatch((state) => toggleAutoBuy(state, id));
}

export function doSetAutomation(patch: Partial<AutomationSettings>): void {
  dispatch((state) => updateAutomation(state, patch));
}

/** Remet l'arbre à plat (avec remise à zéro de la partie). Sauvegarde aussitôt. */
export function doRespec(): number {
  const result = respecTree(current);
  if (result.refunded <= 0) return 0;
  current = result.state;
  saveNow();
  publish();
  return result.refunded;
}

/** Attrape la pizza d'or affichée ; renvoie le gain immédiat éventuel. */
export function doCatchEvent(): { gained: Decimal; name: string } | null {
  const result = catchEvent(current);
  if (!result.kind) return null;
  current = result.state;
  publish();
  return { gained: result.gained, name: EVENT_NAMES[result.kind] };
}

/** Brûle la recette : remise à zéro contre des Étoiles. Sauvegarde aussitôt. */
export function doPrestigeNow(): Decimal | null {
  const result = doPrestige(current);
  if (result.gained.lte(0)) return null;
  current = result.state;
  saveNow();
  publish();
  return result.gained;
}

export function doBuyNode(id: string): void {
  dispatch((state) => buyNode(state, id).state);
  saveNow();
}

/** Transcende : efface toute la couche 1 contre des Contrats. Sauvegarde aussitôt. */
export function doTranscendNow(): Decimal | null {
  const result = doTranscend(current);
  if (result.gained.lte(0)) return null;
  current = result.state;
  saveNow();
  publish();
  return result.gained;
}

export function doUpgradeCity(id: CityId): void {
  dispatch((state) => upgradeCity(state, id).state);
  saveNow();
}

/* --- La Pizza du Chef --- */

/** Pose (ou retire, avec `null`) un ingrédient sur une part de la garniture en cours. */
export function doPlaceTopping(slice: number, topping: ToppingId | null): void {
  dispatch((state) => placeTopping(state, slice, topping));
}

export function doClearDraft(): void {
  dispatch(clearDraft);
}

export function doCopyBaked(): void {
  dispatch(copyBakedToDraft);
}

/** Enfourne la garniture en cours. Renvoie faux si le four n'est pas prêt. */
export function doBake(): boolean {
  const result = bakePizza(current);
  if (!result.baked) return false;
  current = result.state;
  saveNow();
  publish();
  return true;
}

export function doEnterChallenge(id: string): void {
  dispatch((state) => enterChallenge(state, id));
  saveNow();
}

export function doExitChallenge(): void {
  dispatch(exitChallenge);
  saveNow();
}

/** Déclenche un fait marquant depuis l'interface (œuf de Pâques, horloge système…). */
export function doRaiseFlag(flag: FlagId): void {
  dispatch((state) => raiseFlag(state, flag));
}

export function saveNow(): void {
  const now = Date.now();
  saveToStorage(current, now);
  current = { ...current, lastSaved: now };
  sinceSaveSeconds = 0;
}

export function exportCurrent(): string {
  return exportSave(current, Date.now());
}

/** Importe une sauvegarde texte. Lève une erreur si le code est invalide. */
export function importFrom(text: string): void {
  const imported = importSave(text);
  const result = applyOffline(imported, Date.now());
  current = afterOffline(result.state, result.elapsedSeconds);
  if (result.elapsedSeconds >= OFFLINE_MIN_SECONDS && result.gained.gt(0)) {
    useGameStore.getState().setOffline(result);
  }
  saveNow();
  publish();
}

/** Remise à zéro complète (double confirmation demandée côté UI). */
export function hardReset(): void {
  clearStorage();
  current = createInitialState(Date.now());
  saveNow();
  publish();
}

/* ------------------------------------------------------------------ */
/* Boucle                                                              */
/* ------------------------------------------------------------------ */

/** Notifie l'interface des hauts faits fraîchement obtenus. */
function announce(unlocked: AchievementDef[]): void {
  const store = useGameStore.getState();
  for (const def of unlocked) {
    store.pushToast({ kind: 'achievement', title: t.achievements.toast, text: def.name });
  }
}

/** Notifie l'interface qu'un défi vient d'être relevé. */
function announceChallenge(challenge: ChallengeDef): void {
  useGameStore.getState().pushToast({
    kind: 'achievement',
    title: t.challenges.toast,
    text: challenge.name,
  });
}

/** Haut fait caché : jouer entre 3 h et 4 h du matin (l'heure système, pas le temps de jeu). */
function checkWallClock(): void {
  if (new Date().getHours() === 3 && current.flags.nightOwl !== true) {
    current = raiseFlag(current, 'nightOwl');
  }
}

function frame(nowMs: number): void {
  const dt = (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;

  if (dt > MAX_CATCHUP_SECONDS) {
    // Onglet endormi / machine en veille : on ne rejoue pas des milliers de ticks.
    const result = applyElapsed(current, dt, Date.now());
    current = afterOffline(result.state, result.elapsedSeconds);
    accumulator = 0;
    if (result.elapsedSeconds >= OFFLINE_MIN_SECONDS && result.gained.gt(0)) {
      useGameStore.getState().setOffline(result);
    }
  } else if (dt > 0) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= TICK_SECONDS && steps < 240) {
      current = tick(current, TICK_SECONDS, announce, announceChallenge);
      accumulator -= TICK_SECONDS;
      steps++;
    }
  }

  sinceSaveSeconds += Math.max(0, dt);
  if (sinceSaveSeconds >= AUTOSAVE_SECONDS) {
    saveNow();
    checkWallClock();
  }

  if (nowMs - lastPublishMs >= UI_REFRESH_MS) publish();

  rafId = requestAnimationFrame(frame);
}

/** Charge la partie, applique le hors ligne et démarre la boucle. Renvoie une fonction d'arrêt. */
export function startLoop(): () => void {
  if (rafId !== null) return stopLoop;

  const store = useGameStore.getState();
  const loaded = loadFromStorage();
  if (loaded.status === 'ok') {
    const result = applyOffline(loaded.state, Date.now());
    current = afterOffline(result.state, result.elapsedSeconds);
    if (result.elapsedSeconds >= OFFLINE_MIN_SECONDS && result.gained.gt(0)) {
      store.setOffline(result);
    }
  } else {
    if (loaded.status === 'corrupted') store.setCorrupted(loaded.raw);
    current = createInitialState(Date.now());
  }

  lastFrameMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  lastPublishMs = 0;
  accumulator = 0;
  sinceSaveSeconds = 0;
  publish();

  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', onVisibilityChange);
  rafId = requestAnimationFrame(frame);
  return stopLoop;
}

/**
 * Retour d'absence : les effets en cours sont purgés (un bonus ×7 « gelé » toute la
 * nuit n'aurait aucun sens) et l'absence longue débloque son haut fait caché.
 */
function afterOffline(state: GameState, elapsedSeconds: number): GameState {
  const cleaned = clearBuffs(state);
  return elapsedSeconds >= OFFLINE_BASE_CAP_SECONDS ? raiseFlag(cleaned, 'coldPizza') : cleaned;
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') saveNow();
}

export function stopLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener('beforeunload', saveNow);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}
