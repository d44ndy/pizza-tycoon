/** Bandeau des effets en cours (bonus de production, frénésie, contrôle d'hygiène). */
import { EVENTS_BY_KIND } from '../../data/events.ts';
import { useGameStore } from '../../store/gameStore.ts';
import styles from './BuffBar.module.css';

export function BuffBar() {
  const buffs = useGameStore((s) => s.state.events.buffs);
  const playTime = useGameStore((s) => s.state.stats.playTimeTotal);
  if (buffs.length === 0) return null;

  return (
    <div className={styles.bar}>
      {buffs.map((buff) => {
        const def = EVENTS_BY_KIND[buff.kind];
        const remaining = Math.max(0, Math.ceil(buff.endsAt - playTime));
        return (
          <span key={`${buff.kind}-${buff.endsAt}`} className={styles.buff} data-negative={def.negative}>
            {def.name}
            <span className={`${styles.time} num`}>{remaining} s</span>
          </span>
        );
      })}
    </div>
  );
}
