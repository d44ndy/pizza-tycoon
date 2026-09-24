/** Notifications empilées en bas de l'écran (hauts faits, pizzas d'or attrapées). */
import { useEffect, useRef } from 'react';
import { t } from '../../data/i18n/fr.ts';
import { useGameStore, type Toast } from '../../store/gameStore.ts';
import { Picto } from '../icons/Picto.tsx';
import { useSound } from '../useSound.ts';
import styles from './Toasts.module.css';

const LIFETIME_MS = 4200;

/** Une notification groupée annonce le nombre, puis les deux derniers noms. */
function titleOf(toast: Toast): string {
  const count = toast.names?.length ?? 1;
  return count > 1 ? t.achievements.toastMany(count) : toast.title;
}

function textOf(toast: Toast): string {
  const names = toast.names;
  if (!names || names.length <= 1) return toast.text;
  const shown = names.slice(-2).reverse().join(' · ');
  return names.length > 2 ? shown + t.achievements.toastMore(names.length - 2) : shown;
}

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
            <span className={styles.title}>{titleOf(toast)}</span>
            {toast.text && <span className={styles.text}>{textOf(toast)}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
