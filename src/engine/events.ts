/**
 * Pizzas d'or : apparition, expiration, effets temporaires.
 *
 * L'horloge utilisée est `stats.playTimeTotal` (secondes de jeu) et non l'horloge système :
 * le moteur reste pur et déterministe, et le simulateur peut rejouer les événements.
 */
import { ONE, ZERO, type Decimal } from './decimal.ts';
import type { ActiveBuff, EventsState, GameState } from './state.ts';
import { nextRange } from './rng.ts';
import { GENERATORS } from '../data/generators.ts';
import {
  EVENTS, EVENTS_BY_KIND, EVENT_LIFETIME, EVENT_MAX_DELAY, EVENT_MIN_DELAY,
  JACKPOT_SECONDS, JACKPOT_STOCK_RATIO, type EventKind,
} from '../data/events.ts';

const TOTAL_WEIGHT = EVENTS.reduce((sum, e) => sum + e.weight, 0);

/** Tire un type d'événement selon les poids définis dans les données. */
function pickKind(roll: number): EventKind {
  let threshold = roll * TOTAL_WEIGHT;
  for (const def of EVENTS) {
    threshold -= def.weight;
    if (threshold <= 0) return def.kind;
  }
  return EVENTS[EVENTS.length - 1]!.kind;
}

/** Les pizzas d'or n'apparaissent qu'une fois la première cuisine achetée. */
function eventsEnabled(state: GameState): boolean {
  return GENERATORS.some((def) => state.generators[def.id].owned > 0);
}

/** Multiplicateur de production apporté par les effets en cours. */
export function eventProductionMultiplier(state: GameState): Decimal {
  let mult = ONE;
  for (const buff of state.events.buffs) {
    const def = EVENTS_BY_KIND[buff.kind];
    if (buff.kind === 'bonus' || buff.kind === 'malus') mult = mult.mul(def.multiplier);
  }
  return mult;
}

/** Multiplicateur de clic apporté par les effets en cours (frénésie). */
export function eventClickMultiplier(state: GameState): Decimal {
  let mult = ONE;
  for (const buff of state.events.buffs) {
    if (buff.kind === 'frenzy') mult = mult.mul(EVENTS_BY_KIND.frenzy.multiplier);
  }
  return mult;
}

export function hasBuff(state: GameState, kind: EventKind): boolean {
  return state.events.buffs.some((b) => b.kind === kind);
}

/**
 * Fait vivre les événements : expiration des effets, disparition de la pizza
 * non attrapée, et nouvelle apparition le moment venu.
 */
export function updateEvents(state: GameState): GameState {
  const now = state.stats.playTimeTotal;
  let events: EventsState = state.events;
  let changed = false;
  let rng = state.rng;

  // 1. Effets terminés.
  if (events.buffs.length > 0) {
    const alive = events.buffs.filter((b) => b.endsAt > now);
    if (alive.length !== events.buffs.length) {
      events = { ...events, buffs: alive };
      changed = true;
    }
  }

  // 2. Pizza d'or non attrapée : elle disparaît au bout de 12 secondes.
  if (events.pending && now - events.pending.bornAt >= EVENT_LIFETIME) {
    events = { ...events, pending: null };
    changed = true;
  }

  if (!eventsEnabled(state)) return changed ? { ...state, events } : state;

  // 3. Première planification (ou apparition due).
  if (events.nextSpawnAt <= 0) {
    const delay = nextRange(rng, EVENT_MIN_DELAY, EVENT_MAX_DELAY);
    rng = delay.next;
    events = { ...events, nextSpawnAt: now + delay.value };
    changed = true;
  } else if (now >= events.nextSpawnAt && !events.pending) {
    const kindRoll = nextRange(rng, 0, 1);
    const xRoll = nextRange(kindRoll.next, 8, 92);
    const yRoll = nextRange(xRoll.next, 10, 85);
    const delay = nextRange(yRoll.next, EVENT_MIN_DELAY, EVENT_MAX_DELAY);
    rng = delay.next;
    events = {
      ...events,
      pending: { kind: pickKind(kindRoll.value), bornAt: now, x: xRoll.value, y: yRoll.value },
      nextSpawnAt: now + delay.value,
    };
    changed = true;
  }

  if (!changed) return state;
  return { ...state, events, rng };
}

export type EventClickResult = {
  state: GameState;
  kind: EventKind | null;
  /** Pizzas gagnées immédiatement (pourboire du siècle). */
  gained: Decimal;
};

/**
 * Le joueur attrape la pizza d'or affichée.
 * C'est le SEUL moment où un effet (bonus comme malus) peut s'appliquer :
 * ignorer une pizza d'or ne coûte jamais rien.
 */
export function clickPendingEvent(state: GameState, production: Decimal): EventClickResult {
  const pending = state.events.pending;
  if (!pending) return { state, kind: null, gained: ZERO };

  const def = EVENTS_BY_KIND[pending.kind];
  const now = state.stats.playTimeTotal;
  let next: GameState = {
    ...state,
    events: { ...state.events, pending: null },
    stats: { ...state.stats, eventsClicked: state.stats.eventsClicked + 1 },
  };

  let gained = ZERO;
  if (pending.kind === 'jackpot') {
    const fromProduction = production.mul(JACKPOT_SECONDS);
    const cap = state.pizzas.mul(JACKPOT_STOCK_RATIO);
    gained = fromProduction.lt(cap) ? fromProduction : cap;
    next = { ...next, flags: { ...next.flags, jackpot: true } };
  } else {
    const buff: ActiveBuff = { kind: pending.kind, endsAt: now + def.duration };
    next = { ...next, events: { ...next.events, buffs: [...next.events.buffs, buff] } };
    if (pending.kind === 'malus') next = { ...next, flags: { ...next.flags, malusClicked: true } };
  }

  return { state: next, kind: pending.kind, gained };
}

/** Temps restant (en secondes) avant la fin d'un effet, 0 s'il n'est pas actif. */
export function buffRemaining(state: GameState, kind: EventKind): number {
  const buff = state.events.buffs.find((b) => b.kind === kind);
  return buff ? Math.max(0, buff.endsAt - state.stats.playTimeTotal) : 0;
}

/** Temps restant avant la disparition de la pizza d'or affichée. */
export function pendingRemaining(state: GameState): number {
  const pending = state.events.pending;
  if (!pending) return 0;
  return Math.max(0, EVENT_LIFETIME - (state.stats.playTimeTotal - pending.bornAt));
}

/** Vide les effets en cours (au retour d'une absence : ils auraient expiré depuis longtemps). */
export function clearBuffs(state: GameState): GameState {
  if (state.events.buffs.length === 0 && !state.events.pending) return state;
  return { ...state, events: { ...state.events, buffs: [], pending: null } };
}

