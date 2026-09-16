/** Chiffres flottants qui montent à chaque clic (feedback immédiat). */
import styles from './FloatingNumbers.module.css';

export type Pop = { id: number; text: string; x: number; y: number };

type Props = {
  pops: readonly Pop[];
  onDone: (id: number) => void;
};

export function FloatingNumbers({ pops, onDone }: Props) {
  return (
    <div className={styles.layer} aria-hidden="true">
      {pops.map((pop) => (
        <span
          key={pop.id}
          className={styles.pop}
          style={{ left: `${pop.x}%`, top: `${pop.y}%` }}
          onAnimationEnd={() => onDone(pop.id)}
        >
          {pop.text}
        </span>
      ))}
    </div>
  );
}
