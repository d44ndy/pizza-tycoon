/**
 * Colonne centrale : la liste des cuisines.
 * Un générateur n'apparaît que lorsqu'il a été débloqué (50 % de son coût atteint).
 */
import { t } from '../../data/i18n/fr.ts';
import { GENERATORS } from '../../data/generators.ts';
import type { BulkMode } from '../../engine/state.ts';
import { setBulkMode } from '../../engine/actions.ts';
import { dispatch } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { GeneratorRow } from './GeneratorRow.tsx';
import styles from './GeneratorList.module.css';

const BULK_MODES: readonly BulkMode[] = [1, 10, 100, 'max'];

export function GeneratorList() {
  const generators = useGameStore((s) => s.state.generators);
  const bulkMode = useGameStore((s) => s.state.settings.bulkMode);

  const unlocked = GENERATORS.filter((def) => generators[def.id].unlocked);
  if (unlocked.length === 0) return null;

  const ownsSomething = unlocked.some((def) => generators[def.id].owned > 0);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t.generators.title}</h2>
        <div className={styles.bulk} role="group" aria-label={t.generators.bulk}>
          {BULK_MODES.map((mode) => (
            <button
              key={String(mode)}
              type="button"
              className={styles.bulkButton}
              data-active={mode === bulkMode}
              onClick={() => dispatch((s) => setBulkMode(s, mode))}
            >
              {mode === 'max' ? t.generators.max : `×${mode}`}
            </button>
          ))}
        </div>
      </header>

      {!ownsSomething && <p className={styles.hint}>{t.generators.hint}</p>}

      <div className={styles.list}>
        {unlocked.map((def) => (
          <GeneratorRow key={def.id} def={def} />
        ))}
      </div>
    </section>
  );
}
