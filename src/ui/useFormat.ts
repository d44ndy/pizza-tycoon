/** Hook de formatage : applique la notation choisie par le joueur. */
import { useCallback } from 'react';
import { format, formatInt } from '../engine/format.ts';
import type { DecimalSource } from '../engine/decimal.ts';
import { useGameStore } from '../store/gameStore.ts';

export function useFormat(): { fmt: (v: DecimalSource) => string; fmtInt: (v: number) => string } {
  const notation = useGameStore((s) => s.state.settings.notation);
  const fmt = useCallback((v: DecimalSource) => format(v, notation), [notation]);
  const fmtInt = useCallback((v: number) => formatInt(v, notation), [notation]);
  return { fmt, fmtInt };
}
