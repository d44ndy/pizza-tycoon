/** Barre de progression générique (paliers de générateurs, etc.). */
import styles from './ProgressBar.module.css';

type Props = {
  /** Avancement entre 0 et 1. */
  ratio: number;
  label?: string;
  value?: string;
};

export function ProgressBar({ ratio, label, value }: Props) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className={styles.wrapper}>
      {(label || value) && (
        <div className={styles.legend}>
          <span>{label}</span>
          <span className={styles.value}>{value}</span>
        </div>
      )}
      {/* La largeur passe par une variable CSS : aucune classe à générer dynamiquement. */}
      <div className={styles.track} style={{ ['--ratio' as string]: clamped }}>
        <div className={styles.fill} />
      </div>
    </div>
  );
}
