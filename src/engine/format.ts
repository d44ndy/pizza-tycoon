/**
 * Formatage des nombres — UN SEUL point d'entrée pour tout le jeu : `format()`.
 *
 * Trois notations au choix du joueur :
 *  - standard    : 1,23 K / 4,56 M / 7,89 Md …
 *  - scientific  : 1,23e45
 *  - engineering : 123e42  (exposant toujours multiple de 3)
 *
 * Convention française : la virgule est le séparateur décimal.
 */
import { D, type DecimalSource, Decimal } from './decimal.ts';

export type Notation = 'standard' | 'scientific' | 'engineering';

/**
 * Suffixes de l'échelle courte française.
 * Index i => 10^(3*(i+1)). Au-delà de la table, on bascule en scientifique.
 */
const SUFFIXES = [
  'K', 'M', 'Md', 'Bn', 'Brd', 'Tn', 'Trd', 'Qa', 'Qad', 'Qi', 'Qid',
  'Sx', 'Sxd', 'Sp', 'Spd', 'Oc', 'Ocd', 'No', 'Nod', 'Dc', 'Dcd',
] as const;

/** Remplace le point décimal par une virgule et supprime les zéros inutiles (1,20 -> 1,2 ; 1,00 -> 1). */
function tidy(n: number, decimals: number): string {
  let s = n.toFixed(decimals);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

/** Vrai si la mantisse, une fois arrondie pour l'affichage, atteint la limite du palier. */
function roundsUpTo(mantissa: number, limit: number): boolean {
  return Number(mantissa.toFixed(decimalsFor(mantissa))) >= limit;
}

/** Nombre de décimales selon la taille de la mantisse, pour garder une largeur stable. */
function decimalsFor(mantissa: number): number {
  const abs = Math.abs(mantissa);
  if (abs >= 100) return 0;
  if (abs >= 10) return 1;
  return 2;
}

/**
 * Exposant décimal entier de `value`, ou `null` si le nombre est si grand
 * que son exposant lui-même dépasse les capacités d'un `number`.
 */
function exponentOf(value: Decimal): number | null {
  const log = value.log10().toNumber();
  if (!Number.isFinite(log)) return null;
  return Math.floor(log);
}

export function format(input: DecimalSource, notation: Notation = 'standard'): string {
  const value = D(input);

  if (value.isNan()) return '—';
  if (value.sign < 0) return '-' + format(value.neg(), notation);
  if (value.lt(0.001) && value.gt(0)) {
    // Très petit mais non nul : on évite d'afficher « 0 » qui ferait croire à un bug.
    return notation === 'standard' ? value.toExponential(2).replace('.', ',') : formatExponential(value, notation);
  }
  if (value.eq(0)) return '0';
  if (value.lt(1000)) return tidy(value.toNumber(), decimalsFor(value.toNumber()));

  if (notation === 'standard') {
    const exp = exponentOf(value);
    if (exp === null) return value.toString();
    let tier = Math.floor(exp / 3);
    let suffix = SUFFIXES[tier - 1];
    if (suffix === undefined) return formatExponential(value, 'scientific');

    let mantissa = value.div(D(10).pow(tier * 3)).toNumber();
    // Garde-fou : après arrondi, 999 999 doit s'afficher « 1 M » et non « 1000 K ».
    if (roundsUpTo(mantissa, 1000)) {
      tier += 1;
      const nextSuffix = SUFFIXES[tier - 1];
      if (nextSuffix === undefined) return formatExponential(value, 'scientific');
      suffix = nextSuffix;
      mantissa /= 1000;
    }
    return `${tidy(mantissa, decimalsFor(mantissa))} ${suffix}`;
  }

  return formatExponential(value, notation);
}

/** Notations scientifique (1,23e45) et ingénieur (exposant multiple de 3). */
function formatExponential(value: Decimal, notation: Notation): string {
  const exp = exponentOf(value);
  if (exp === null) return value.toString(); // format « ee123 » de break_eternity

  const targetExp = notation === 'engineering' ? Math.floor(exp / 3) * 3 : exp;
  let mantissa = value.div(D(10).pow(targetExp)).toNumber();
  const limit = notation === 'engineering' ? 1000 : 10;
  let finalExp = targetExp;
  if (roundsUpTo(mantissa, limit)) {
    const step = notation === 'engineering' ? 3 : 1;
    mantissa /= Math.pow(10, step);
    finalExp += step;
  }
  return `${tidy(mantissa, decimalsFor(mantissa))}e${finalExp}`;
}

/** Entiers « humains » (compteurs de stats) : 1 234, puis bascule sur `format()` au-delà du million. */
export function formatInt(value: number, notation: Notation = 'standard'): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e6) {
    return Math.floor(value).toLocaleString('fr-FR').replace(/ | /g, ' ');
  }
  return format(Math.floor(value), notation);
}

/** Durée lisible : « 3 j 4 h », « 2 h 13 min », « 45 s ». */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${secs} s`;
  return `${secs} s`;
}
