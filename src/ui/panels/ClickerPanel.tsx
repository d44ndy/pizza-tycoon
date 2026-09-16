/**
 * Colonne de gauche : le compteur et la pizza sur laquelle on tape.
 * C'est le seul élément visible au tout premier lancement (révélation progressive).
 */
import { useRef, useState, type MouseEvent } from 'react';
import { t } from '../../data/i18n/fr.ts';
import { clickPower } from '../../engine/formulas.ts';
import { doClick } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { FloatingNumbers, type Pop } from '../common/FloatingNumbers.tsx';
import { PizzaMark } from '../icons/PizzaMark.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './ClickerPanel.module.css';

export function ClickerPanel() {
  const pizzas = useGameStore((s) => s.state.pizzas);
  const production = useGameStore((s) => s.production);
  const state = useGameStore((s) => s.state);
  const { fmt } = useFormat();

  const [pops, setPops] = useState<readonly Pop[]>([]);
  const nextId = useRef(0);

  const hasStarted = state.stats.clicksTotal > 0 || pizzas.gt(0);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const gain = clickPower(state);
    doClick();

    const rect = event.currentTarget.getBoundingClientRect();
    const id = nextId.current++;
    setPops((list) => [
      ...list,
      {
        id,
        text: `+${fmt(gain)}`,
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
      },
    ]);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.counter}>
        <span className={`${styles.amount} num`}>{fmt(pizzas)}</span>
        <span className={styles.unit}>{pizzas.eq(1) ? t.game.currencyOne : t.game.currency}</span>
      </div>

      {production.gt(0) && (
        <div className={styles.rateBox}>
          <span className={styles.rateLabel}>{t.game.production}</span>
          <span className={`${styles.rate} num`}>
            {fmt(production)} {t.game.perSecond}
          </span>
        </div>
      )}

      <div className={styles.clickZone}>
        <button type="button" className={styles.pizzaButton} onClick={handleClick} aria-label={t.game.clickButton}>
          <PizzaMark className={styles.pizza} />
        </button>
        <FloatingNumbers pops={pops} onDone={(id) => setPops((list) => list.filter((p) => p.id !== id))} />
      </div>

      <div className={styles.action}>{t.game.clickButton}</div>
      {!hasStarted && <p className={styles.hint}>{t.game.clickHint}</p>}
    </section>
  );
}
