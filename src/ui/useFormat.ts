/** Hook de formatage : applique la notation choisie par le joueur. */
import { useCallback } from 'react';
import { format, formatDecimal, formatInt, formatMultiplier } from '../engine/format.ts';
import type { DecimalSource } from '../engine/decimal.ts';
import { useGameStore } from '../store/gameStore.ts';

export type Formatters = {
  fmt: (v: DecimalSource) => string;
  fmtInt: (v: number) => string;
  /** Décimales fixes à la française : 1,36. */
  fmtDec: (v: number, digits?: number) => string;
  /** Multiplicateur : ×1,36. */
  fmtMult: (v: number, digits?: number) => string;
};

export function useFormat(): Formatters {
  const notation = useGameStore((s) => s.state.settings.notation);
  const fmt = useCallback((v: DecimalSource) => format(v, notation), [notation]);
  const fmtInt = useCallback((v: number) => formatInt(v, notation), [notation]);
  const fmtDec = useCallback((v: number, digits = 2) => formatDecimal(v, digits, notation), [notation]);
  const fmtMult = useCallback((v: number, digits = 2) => formatMultiplier(v, digits, notation), [notation]);
  return { fmt, fmtInt, fmtDec, fmtMult };
}
