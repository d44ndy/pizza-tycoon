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
  AUTOSAVE_SECONDS, MAX_CATCHUP_SECONDS, TICK_SECONDS, UI_REFRESH_MS,
} from '../data/config.ts';
import type { GeneratorId } from '../data/generators.ts';
import { totalProduction } from '../engine/formulas.ts';
import { applyElapsed, applyOffline, OFFLINE_MIN_SECONDS } from '../engine/offline.ts';
import { createInitialState, type GameState } from '../engine/state.ts';
import { clearStorage, exportSave, importSave, loadFromStorage, saveToStorage } from '../engine/save.ts';
import { tick } from '../engine/tick.ts';
import { buyGenerator, clickDough } from '../engine/actions.ts';
import { useGameStore } from './gameStore.ts';

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
  current = result.state;
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

function frame(nowMs: number): void {
  const dt = (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;

  if (dt > MAX_CATCHUP_SECONDS) {
    // Onglet endormi / machine en veille : on ne rejoue pas des milliers de ticks.
    const result = applyElapsed(current, dt, Date.now());
    current = result.state;
    accumulator = 0;
    if (result.elapsedSeconds >= OFFLINE_MIN_SECONDS && result.gained.gt(0)) {
      useGameStore.getState().setOffline(result);
    }
  } else if (dt > 0) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= TICK_SECONDS && steps < 240) {
      current = tick(current, TICK_SECONDS);
      accumulator -= TICK_SECONDS;
      steps++;
    }
  }

  sinceSaveSeconds += Math.max(0, dt);
  if (sinceSaveSeconds >= AUTOSAVE_SECONDS) saveNow();

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
    current = result.state;
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

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') saveNow();
}

export function stopLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener('beforeunload', saveNow);
  document.removeEventListener('visibilitychange', onVisibilityChange);
}
