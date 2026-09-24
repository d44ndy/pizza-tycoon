/**
 * Constantes d'équilibrage du jeu.
 * Tout ce qui se règle au doigt mouillé vit ICI (et nulle part ailleurs) :
 * c'est ce fichier que le simulateur d'équilibrage (Phase 2) fera varier.
 */

/** Croissance du coût à chaque exemplaire acheté (1,15 = +15 %). */
export const COST_GROWTH = 1.15;

/** Multiplicateur de production accordé à chaque palier franchi. */
export const MILESTONE_MULTIPLIER = 2;

/** Un générateur devient visible quand le joueur possède 50 % de son coût. */
export const UNLOCK_RATIO = 0.5;

/** Pas de simulation fixe (20 ticks/s) et fréquence de publication vers l'UI (10 fps). */
export const TICK_SECONDS = 0.05;
export const UI_REFRESH_MS = 100;

/** Au-delà de ce délai entre deux images, on considère que l'onglet était endormi. */
export const MAX_CATCHUP_SECONDS = 5;

/** Sauvegarde. */
export const SAVE_KEY = 'pizza-tycoon-save';
export const SAVE_BACKUP_KEY = 'pizza-tycoon-save-corrupted';
export const SAVE_VERSION = 4;
export const AUTOSAVE_SECONDS = 30;

/** Progression hors ligne (améliorable par l'arbre de prestige en Phase 3). */
export const OFFLINE_BASE_EFFICIENCY = 0.5;
export const OFFLINE_BASE_CAP_SECONDS = 8 * 3600;

/**
 * La Pizza du Chef : huit parts, et un four qui ne se rallume qu'une fois par heure
 * de JEU. Sans ce délai, on referait sa garniture toutes les cinq minutes selon qu'on
 * clique ou qu'on s'absente — une corvée d'optimisation, pas un choix.
 */
export const CHEF_SLICES = 8;
export const CHEF_BAKE_COOLDOWN = 3600;

/**
 * Conversion des points de production et de pétrissage du chef en pourcentage de bonus.
 * 1 à l'origine : la margherita donnait +80 % dès la 14e minute, soit autant que trois
 * nœuds d'arbre, et le jeu entier s'accélérait d'environ 40 %. À 0,5 : +40 %.
 */
export const CHEF_PERCENT_PER_POINT = 0.5;

/** Plafond de la réduction du délai entre deux pizzas d'or (en %). */
export const CHEF_GOLD_CAP = 50;

/** Valeur de base d'un clic, en pizzas. */
export const BASE_CLICK_POWER = 1;

/** Haut fait caché : 100 clics en moins de 10 secondes. */
export const CLICK_BURST_COUNT = 100;
export const CLICK_BURST_WINDOW = 10;

/**
 * Paliers de production : ×2 à 25, 50, puis tous les 50 exemplaires.
 * Renvoie le nombre de paliers atteints pour `owned` exemplaires.
 */
export function milestonesReached(owned: number): number {
  if (owned < 25) return 0;
  if (owned < 50) return 1;
  if (owned < 100) return 2;
  return Math.floor(owned / 50) + 1;
}

/** Prochain palier à atteindre (utilisé pour la barre de progression). */
export function nextMilestone(owned: number): number {
  if (owned < 25) return 25;
  if (owned < 50) return 50;
  if (owned < 100) return 100;
  return (Math.floor(owned / 50) + 1) * 50;
}

/** Palier précédent (borne basse de la barre de progression). */
export function previousMilestone(owned: number): number {
  if (owned < 25) return 0;
  if (owned < 50) return 25;
  if (owned < 100) return 50;
  return Math.floor(owned / 50) * 50;
}
