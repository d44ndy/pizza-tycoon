/**
 * Enveloppe autour de break_eternity.js.
 *
 * Toute la logique de jeu manipule des `Decimal` (nombres pouvant dépasser 1e308,
 * indispensable dès les premiers prestiges). Règle d'or : un `Decimal` est traité
 * comme IMMUABLE — on ne réutilise jamais une instance en la modifiant, chaque
 * opération renvoie une nouvelle valeur.
 */
import Decimal from 'break_eternity.js';

export { Decimal };
export type DecimalSource = Decimal | number | string;

/** Raccourci de construction : `D(15)`, `D('1e30')`, `D(autreDecimal)`. */
export function D(value: DecimalSource): Decimal {
  return new Decimal(value);
}

export const ZERO = D(0);
export const ONE = D(1);

/** Somme d'une liste de Decimal (0 si la liste est vide). */
export function sum(values: readonly Decimal[]): Decimal {
  let total = ZERO;
  for (const v of values) total = total.add(v);
  return total;
}

/** Plus grand des deux. */
export function maxD(a: Decimal, b: Decimal): Decimal {
  return a.gt(b) ? a : b;
}

/** Plus petit des deux. */
export function minD(a: Decimal, b: Decimal): Decimal {
  return a.lt(b) ? a : b;
}
