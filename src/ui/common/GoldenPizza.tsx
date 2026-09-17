/**
 * La pizza d'or : l'élément cliquable qui traverse l'écran toutes les 2 à 5 minutes.
 *
 * Le contrôle d'hygiène (effet négatif) a une apparence NETTEMENT différente :
 * le joueur doit pouvoir décider de ne pas y toucher. Ignorer une pizza d'or ne
 * coûte jamais rien.
 */
import { useEffect, useState } from 'react';
import { EVENT_LIFETIME } from '../../data/events.ts';
import { doCatchEvent } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { useFormat } from '../useFormat.ts';
import { useSound } from '../useSound.ts';
import { PizzaMark } from '../icons/PizzaMark.tsx';
import styles from './GoldenPizza.module.css';

export function GoldenPizza() {
  const pending = useGameStore((s) => s.state.events.pending);
  const playTime = useGameStore((s) => s.state.stats.playTimeTotal);
  const pushToast = useGameStore((s) => s.pushToast);
  const { fmt } = useFormat();
  const sound = useSound();
  const [caught, setCaught] = useState<{ id: number; text: string; x: number; y: number } | null>(null);

  // Le libellé du gain s'efface tout seul.
  useEffect(() => {
    if (!caught) return;
    const timer = window.setTimeout(() => setCaught(null), 1400);
    return () => window.clearTimeout(timer);
  }, [caught]);

  if (!pending && !caught) return null;

  const remaining = pending ? Math.max(0, EVENT_LIFETIME - (playTime - pending.bornAt)) : 0;

  return (
    <>
      {pending && (
        <button
          type="button"
          className={styles.pizza}
          data-kind={pending.kind}
          style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
          onClick={() => {
            const result = doCatchEvent();
            if (!result) return;
            sound('event');
            pushToast({ kind: 'info', title: result.name, text: result.gained.gt(0) ? `+${fmt(result.gained)}` : '' });
            setCaught({ id: Date.now(), text: result.gained.gt(0) ? `+${fmt(result.gained)}` : result.name, x: pending.x, y: pending.y });
          }}
          aria-label={pending.kind === 'malus' ? "Contrôle d'hygiène" : "Pizza d'or"}
        >
          <PizzaMark size={64} className={styles.mark} />
          {/* Minuteur : la part restante avant disparition. */}
          <span className={styles.timer} style={{ ['--left' as string]: remaining / EVENT_LIFETIME }} />
        </button>
      )}

      {caught && (
        <span className={styles.caught} style={{ left: `${caught.x}%`, top: `${caught.y}%` }}>
          {caught.text}
        </span>
      )}
    </>
  );
}
