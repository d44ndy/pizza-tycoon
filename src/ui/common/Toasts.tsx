/** Notifications empilées en bas de l'écran (hauts faits, pizzas d'or attrapées). */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore.ts';
import { Picto } from '../icons/Picto.tsx';
import { useSound } from '../useSound.ts';
import styles from './Toasts.module.css';

const LIFETIME_MS = 4200;

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  const sound = useSound();

  // Un son quand une notification arrive (et pas quand une autre disparaît).
  const lastId = useRef(0);
  useEffect(() => {
    const newest = toasts[toasts.length - 1];
    if (!newest || newest.id <= lastId.current) return;
    lastId.current = newest.id;
    sound(newest.kind === 'achievement' ? 'achievement' : 'event');
  }, [toasts, sound]);

  // Une seule minuterie pour la plus ancienne : elles s'effacent dans l'ordre.
  useEffect(() => {
    const oldest = toasts[0];
    if (!oldest) return;
    const timer = window.setTimeout(() => dismiss(oldest.id), LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className={styles.toast} onClick={() => dismiss(toast.id)}>
          <span className={styles.picto}>
            <Picto name={toast.kind === 'achievement' ? 'trophy' : 'sparkle'} size={20} />
          </span>
          <span className={styles.body}>
            <span className={styles.title}>{toast.title}</span>
            {toast.text && <span className={styles.text}>{toast.text}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
