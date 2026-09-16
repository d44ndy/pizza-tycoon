/**
 * Colonne de droite : réservée aux améliorations (Phase 2).
 * Elle n'apparaît qu'une fois le jeu lancé, pour ne pas encombrer le premier écran.
 */
import { t } from '../../data/i18n/fr.ts';
import styles from './UpgradesPanel.module.css';

export function UpgradesPanel() {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>{t.upgrades.title}</h2>
      <p className={styles.soon}>{t.upgrades.soon}</p>
    </section>
  );
}
