/**
 * Sauvegarde : sérialisation, migrations versionnées, localStorage, export/import base64.
 *
 * Règle de sécurité : on n'écrase JAMAIS une sauvegarde qu'on n'a pas réussi à lire.
 * En cas de problème, le contenu brut est recopié dans une clé de secours et
 * l'interface propose au joueur de l'exporter.
 */
import { D, type Decimal } from './decimal.ts';
import { createInitialState, type GameState, type GeneratorState, type Settings } from './state.ts';
import { GENERATORS, type GeneratorId } from '../data/generators.ts';
import { UPGRADES_BY_ID } from '../data/upgrades.ts';
import { ACHIEVEMENTS_BY_ID, type FlagId } from '../data/achievements.ts';
import { PRESTIGE_NODES_BY_ID } from '../data/prestige.ts';
import { CITIES_BY_ID, type CityId } from '../data/cities.ts';
import { CHALLENGES_BY_ID } from '../data/challenges.ts';
import type { PrestigeLayerId, PrestigeLayerState } from './state.ts';
import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION } from '../data/config.ts';

/** Format sérialisé (les Decimal deviennent des chaînes). */
type SavedGenerator = { owned: number; totalBought: number; unlocked: boolean };
type SavedLayer = { currency: string; totalEarned: string; resets: number; nodes: Record<string, number> };

export type SaveData = {
  version: number;
  pizzas: string;
  generators: Partial<Record<GeneratorId, SavedGenerator>>;
  /** Améliorations achetées, sous forme de liste d'identifiants (plus compact). */
  upgrades: string[];
  /** Hauts faits obtenus : identifiant -> instant d'obtention. */
  achievements: Record<string, number>;
  flags: string[];
  /** Défi en cours et défis validés. */
  challenges: { active: string | null; completed: Record<string, number> };
  /** Prochaine pizza d'or, en secondes de jeu. Les effets en cours ne sont pas sauvegardés. */
  nextEventAt: number;
  stats: {
    createdAt: number;
    playTimeRun: number;
    playTimeTotal: number;
    clicks: number;
    clicksTotal: number;
    earnedRun: string;
    earnedPrestige: string;
    earnedTotal: string;
    handmadeTotal: string;
    bestPizzas: string;
    eventsClicked: number;
  };
  settings: Settings;
  prestige: { layers: Record<string, SavedLayer> };
  rng: { seed: number };
  lastSaved: number;
};

/**
 * Migrations : chaque entrée transforme une sauvegarde de version N en version N+1.
 * Elles sont appliquées en chaîne au chargement. (Aucune nécessaire pour l'instant.)
 */
const MIGRATIONS: Record<number, (save: SaveData) => SaveData> = {
  // v1 (Phase 1) -> v2 (Phase 2) : arrivée des améliorations, hauts faits et pizzas d'or.
  1: (save) => ({
    ...save,
    version: 2,
    upgrades: [],
    achievements: {},
    flags: [],
    nextEventAt: 0,
    stats: { ...save.stats, eventsClicked: 0 },
  }),
  // v2 (Phase 2) -> v3 (Phase 4) : arrivée des défis.
  2: (save) => ({
    ...save,
    version: 3,
    challenges: { active: null, completed: {} },
  }),
};

/* ------------------------------------------------------------------ */
/* Sérialisation                                                       */
/* ------------------------------------------------------------------ */

export function toSaveData(state: GameState, now: number = Date.now()): SaveData {
  const generators: Partial<Record<GeneratorId, SavedGenerator>> = {};
  for (const def of GENERATORS) {
    const g = state.generators[def.id];
    generators[def.id] = { owned: g.owned, totalBought: g.totalBought, unlocked: g.unlocked };
  }

  const layers: Record<string, SavedLayer> = {};
  for (const [id, layer] of Object.entries(state.prestige.layers)) {
    if (!layer) continue;
    layers[id] = {
      currency: layer.currency.toString(),
      totalEarned: layer.totalEarned.toString(),
      resets: layer.resets,
      nodes: { ...layer.nodes },
    };
  }

  return {
    version: SAVE_VERSION,
    pizzas: state.pizzas.toString(),
    generators,
    upgrades: Object.keys(state.upgrades),
    achievements: { ...state.achievements },
    flags: Object.keys(state.flags),
    challenges: {
      active: state.challenges.active,
      completed: { ...state.challenges.completed },
    },
    nextEventAt: state.events.nextSpawnAt,
    stats: {
      createdAt: state.stats.createdAt,
      playTimeRun: state.stats.playTimeRun,
      playTimeTotal: state.stats.playTimeTotal,
      clicks: state.stats.clicks,
      clicksTotal: state.stats.clicksTotal,
      earnedRun: state.stats.earnedRun.toString(),
      earnedPrestige: state.stats.earnedPrestige.toString(),
      earnedTotal: state.stats.earnedTotal.toString(),
      handmadeTotal: state.stats.handmadeTotal.toString(),
      bestPizzas: state.stats.bestPizzas.toString(),
      eventsClicked: state.stats.eventsClicked,
    },
    settings: { ...state.settings },
    prestige: { layers },
    rng: { seed: state.rng.seed },
    lastSaved: now,
  };
}

export function serialize(state: GameState, now?: number): string {
  return JSON.stringify(toSaveData(state, now));
}

/* ------------------------------------------------------------------ */
/* Désérialisation + validation                                        */
/* ------------------------------------------------------------------ */

export class SaveError extends Error {}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function dec(value: unknown, fallback = 0): Decimal {
  if (typeof value === 'string' || typeof value === 'number') {
    const d = D(value);
    if (!d.isNan()) return d;
  }
  return D(fallback);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Applique les migrations nécessaires pour amener la sauvegarde à la version courante. */
function migrate(save: SaveData): SaveData {
  let current = save;
  let guard = 0;
  while (current.version < SAVE_VERSION && guard++ < 100) {
    const step = MIGRATIONS[current.version];
    if (!step) throw new SaveError(`Migration manquante depuis la version ${current.version}`);
    current = step(current);
  }
  return current;
}

/** Reconstruit un GameState complet à partir d'une sauvegarde (champs manquants = valeurs par défaut). */
export function fromSaveData(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null) throw new SaveError('Sauvegarde illisible');
  const save = raw as Partial<SaveData>;
  if (typeof save.version !== 'number' || !Number.isFinite(save.version)) {
    throw new SaveError('Version de sauvegarde absente');
  }
  if (save.version > SAVE_VERSION) {
    throw new SaveError(`Sauvegarde trop récente (v${save.version}) pour cette version du jeu`);
  }
  const migrated = migrate(save as SaveData);

  const base = createInitialState(num(migrated.lastSaved, Date.now()), num(migrated.rng?.seed, 1));
  const generators = { ...base.generators };
  for (const def of GENERATORS) {
    const saved = migrated.generators?.[def.id];
    if (!saved) continue;
    const owned = Math.max(0, Math.floor(num(saved.owned, 0)));
    const gen: GeneratorState = {
      id: def.id,
      owned,
      totalBought: Math.max(owned, Math.floor(num(saved.totalBought, owned))),
      unlocked: bool(saved.unlocked, owned > 0),
    };
    generators[def.id] = gen;
  }

  // On ignore silencieusement les identifiants inconnus : une sauvegarde d'une version
  // où une amélioration existait encore ne doit pas empêcher de charger la partie.
  const upgrades: Record<string, true> = {};
  for (const id of Array.isArray(migrated.upgrades) ? migrated.upgrades : []) {
    if (UPGRADES_BY_ID[id]) upgrades[id] = true;
  }
  const achievements: Record<string, number> = {};
  for (const [id, at] of Object.entries(migrated.achievements ?? {})) {
    if (ACHIEVEMENTS_BY_ID[id]) achievements[id] = num(at, 0);
  }
  const flags: Partial<Record<FlagId, true>> = {};
  for (const flag of Array.isArray(migrated.flags) ? migrated.flags : []) {
    flags[flag as FlagId] = true;
  }

  // Couches de prestige : les identifiants de nœuds inconnus sont ignorés.
  const layers: Partial<Record<PrestigeLayerId, PrestigeLayerState>> = {};
  for (const [id, saved] of Object.entries(migrated.prestige?.layers ?? {})) {
    if (id !== 'recipe' && id !== 'expansion') continue;
    // Chaque couche a son propre catalogue : nœuds d'arbre pour « recipe »,
    // villes pour « expansion ». Un identifiant inconnu est ignoré.
    const known = (nodeId: string) => (id === 'recipe'
      ? PRESTIGE_NODES_BY_ID[nodeId] !== undefined
      : CITIES_BY_ID[nodeId as CityId] !== undefined);
    const nodes: Record<string, number> = {};
    for (const [nodeId, level] of Object.entries(saved?.nodes ?? {})) {
      if (known(nodeId)) nodes[nodeId] = Math.max(1, Math.floor(num(level, 1)));
    }
    layers[id] = {
      currency: dec(saved?.currency),
      totalEarned: dec(saved?.totalEarned),
      resets: Math.max(0, Math.floor(num(saved?.resets, 0))),
      nodes,
    };
  }

  // Défis : on ignore les identifiants inconnus, et un défi en cours qui n'existe
  // plus se solde par un retour au monde normal plutôt que par un blocage.
  const completedChallenges: Record<string, number> = {};
  for (const [id, at] of Object.entries(migrated.challenges?.completed ?? {})) {
    if (CHALLENGES_BY_ID[id]) completedChallenges[id] = num(at, 0);
  }
  const activeChallengeId = migrated.challenges?.active;
  const active = typeof activeChallengeId === 'string' && CHALLENGES_BY_ID[activeChallengeId]
    ? activeChallengeId
    : null;

  const s = migrated.stats;
  const state: GameState = {
    ...base,
    version: SAVE_VERSION,
    pizzas: dec(migrated.pizzas),
    generators,
    upgrades,
    achievements,
    flags,
    events: {
      ...base.events,
      nextSpawnAt: Math.max(0, num(migrated.nextEventAt, 0)),
    },
    challenges: { active, completed: completedChallenges },
    stats: {
      createdAt: num(s?.createdAt, base.stats.createdAt),
      playTimeRun: Math.max(0, num(s?.playTimeRun, 0)),
      playTimeTotal: Math.max(0, num(s?.playTimeTotal, 0)),
      clicks: Math.max(0, num(s?.clicks, 0)),
      clicksTotal: Math.max(0, num(s?.clicksTotal, 0)),
      earnedRun: dec(s?.earnedRun),
      earnedPrestige: dec(s?.earnedPrestige),
      earnedTotal: dec(s?.earnedTotal),
      handmadeTotal: dec(s?.handmadeTotal),
      bestPizzas: dec(s?.bestPizzas),
      eventsClicked: Math.max(0, num(s?.eventsClicked, 0)),
    },
    settings: {
      notation: migrated.settings?.notation ?? base.settings.notation,
      bulkMode: migrated.settings?.bulkMode ?? base.settings.bulkMode,
      theme: migrated.settings?.theme ?? base.settings.theme,
      reducedMotion: bool(migrated.settings?.reducedMotion, base.settings.reducedMotion),
      sound: bool(migrated.settings?.sound, base.settings.sound),
    },
    prestige: { layers },
    rng: { seed: num(migrated.rng?.seed, base.rng.seed) },
    lastSaved: num(migrated.lastSaved, Date.now()),
  };

  return state;
}

export function deserialize(json: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SaveError('JSON invalide');
  }
  return fromSaveData(parsed);
}

/* ------------------------------------------------------------------ */
/* Export / import texte (base64)                                      */
/* ------------------------------------------------------------------ */

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportSave(state: GameState, now?: number): string {
  return toBase64(serialize(state, now));
}

export function importSave(text: string): GameState {
  let json: string;
  try {
    json = fromBase64(text);
  } catch {
    throw new SaveError('Code de sauvegarde illisible (base64 invalide)');
  }
  return deserialize(json);
}

/* ------------------------------------------------------------------ */
/* localStorage                                                        */
/* ------------------------------------------------------------------ */

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // navigation privée / stockage bloqué
  }
}

export function saveToStorage(state: GameState, now?: number): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(SAVE_KEY, serialize(state, now));
  } catch {
    // Quota dépassé : on ne casse pas la partie en cours.
  }
}

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; state: GameState }
  | { status: 'corrupted'; raw: string; error: string };

/** Charge la partie. Une sauvegarde illisible est mise de côté, jamais écrasée. */
export function loadFromStorage(): LoadResult {
  const ls = storage();
  if (!ls) return { status: 'empty' };
  const raw = ls.getItem(SAVE_KEY);
  if (!raw) return { status: 'empty' };
  try {
    return { status: 'ok', state: deserialize(raw) };
  } catch (error) {
    try {
      ls.setItem(SAVE_BACKUP_KEY, raw);
      ls.removeItem(SAVE_KEY);
    } catch {
      /* on ignore : l'important est de ne pas perdre `raw`, renvoyé ci-dessous */
    }
    return { status: 'corrupted', raw, error: error instanceof Error ? error.message : String(error) };
  }
}

export function clearStorage(): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(SAVE_KEY);
  } catch {
    /* rien à faire */
  }
}
