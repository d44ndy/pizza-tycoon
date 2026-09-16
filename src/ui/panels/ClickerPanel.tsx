/**
 * Colonne de gauche : stock, production et le gros bouton « Pétrir la pâte ».
 * C'est le seul élément visible au tout premier lancement (révélation progressive).
 */
import { useRef, useState, type MouseEvent } from 'react';
import { t } from '../../data/i18n/fr.ts';
import { clickPower } from '../../engine/formulas.ts';
import { doClick } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { FloatingNumbers, type Pop } from '../common/FloatingNumbers.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './ClickerPanel.module.css';

export function ClickerPanel() {
  const pizzas = useGameStore((s) => s.state.pizzas);
  const production = useGameStore((s) => s.production);
  const state = useGameStore((s) => s.state);
  const { fmt } = useFormat();

  const [pops, setPops] = useState<readonly Pop[]>([]);
  const nextId = useRef(0);

  const hasStarted = state.stats.clicks > 0 || pizzas.gt(0);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const gain = clickPower(state);
    doClick();

    // Position du chiffre flottant, en % du bouton, là où le joueur a cliqué.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const id = nextId.current++;
    setPops((list) => [...list, { id, text: `+${fmt(gain)}`, x, y }]);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.counter}>
        <span className={styles.amount}>{fmt(pizzas)}</span>
        <span className={styles.unit}>{pizzas.eq(1) ? t.game.currencyOne : t.game.currency}</span>
        {production.gt(0) && (
          <span className={styles.rate}>
            {fmt(production)} {t.game.currency}
            {t.game.perSecond}
          </span>
        )}
      </div>

      <div className={styles.clickZone}>
        <button type="button" className={styles.bigButton} onClick={handleClick}>
          <span className={styles.pizza}>🍕</span>
          <span className={styles.label}>{t.game.clickButton}</span>
        </button>
        <FloatingNumbers pops={pops} onDone={(id) => setPops((list) => list.filter((p) => p.id !== id))} />
      </div>

      {!hasStarted && <p className={styles.hint}>{t.game.clickHint}</p>}
    </section>
  );
}
