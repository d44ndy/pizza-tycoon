/** Hook de confort : joue un son en tenant compte du réglage du joueur. */
import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { playSound, type SoundName } from './sound.ts';

export function useSound(): (name: SoundName) => void {
  const enabled = useGameStore((s) => s.state.settings.sound);
  return useCallback((name: SoundName) => playSound(name, enabled), [enabled]);
}
