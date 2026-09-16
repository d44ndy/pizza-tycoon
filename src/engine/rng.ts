/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * L'aléatoire du jeu (apparition des événements en Phase 2, etc.) doit être
 * reproductible : la graine est stockée dans le GameState et avance avec lui,
 * ce qui garde `tick()` parfaitement déterministe.
 */

export type RngState = { seed: number };

/** Crée une graine à partir de l'horloge (uniquement à la première partie). */
export function createSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Tire un nombre dans [0, 1) et renvoie la graine suivante.
 * Fonction pure : ne modifie pas l'état passé en argument.
 */
export function nextRandom(state: RngState): { value: number; next: RngState } {
  let a = (state.seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next: { seed: a } };
}

/** Tire un entier dans [min, max] inclus. */
export function nextInt(state: RngState, min: number, max: number): { value: number; next: RngState } {
  const { value, next } = nextRandom(state);
  return { value: min + Math.floor(value * (max - min + 1)), next };
}

/** Tire un réel dans [min, max). */
export function nextRange(state: RngState, min: number, max: number): { value: number; next: RngState } {
  const { value, next } = nextRandom(state);
  return { value: min + value * (max - min), next };
}
