/**
 * Colonne de droite : les améliorations.
 * Seules celles dont la condition est remplie apparaissent ; les achetées
 * partent dans la bande « Acquises », en bas.
 */
import { t } from '../../data/i18n/fr.ts';
import type { UpgradeDef } from '../../data/upgrades.ts';
import { availableUpgrades, ownedUpgrades, upgradeCost } from '../../engine/upgrades.ts';
import { timeToAfford } from '../../engine/formulas.ts';
import { permanentEffects } from '../../engine/prestige.ts';
import { doBuyAllUpgrades, doBuyUpgrade, doSetAutomation } from '../../store/gameLoop.ts';
import { WaitTime } from '../common/WaitTime.tsx';
import { useGameStore } from '../../store/gameStore.ts';
import { Tooltip } from '../common/Tooltip.tsx';
import { Picto } from '../icons/Picto.tsx';
import { useFormat } from '../useFormat.ts';
import { useSound } from '../useSound.ts';
import styles from './UpgradesPanel.module.css';

export function UpgradesPanel() {
  const state = useGameStore((s) => s.state);
  const setToast = useGameStore((s) => s.setToast);
  const { fmt } = useFormat();
  const sound = useSound();

  const available = availableUpgrades(state);
  const owned = ownedUpgrades(state);
  const anyAffordable = available.some((def) => state.pizzas.gte(upgradeCost(state, def)));
  const chefUnlocked = permanentEffects(state).autoBuyUpgrades;
  const chefOn = state.settings.automation.upgrades;

  function buyAll() {
    const count = doBuyAllUpgrades();
    if (count === 0) return;
    sound('buy');
    setToast(t.upgrades.buyAllDone(count));
    window.setTimeout(() => setToast(null), 1800);
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t.upgrades.title}</h2>
        <button type="button" className={styles.buyAll} disabled={!anyAffordable} onClick={buyAll}>
          {t.upgrades.buyAll}
        </button>
      </header>

      {chefUnlocked && (
        <button
          type="button"
          className={styles.chef}
          data-on={chefOn}
          aria-pressed={chefOn}
          onClick={() => doSetAutomation({ upgrades: !chefOn })}
        >
          {t.upgrades.chef} : <strong>{chefOn ? t.upgrades.chefOn : t.upgrades.chefOff}</strong>
        </button>
      )}

      {available.length === 0 && <p className={styles.empty}>{t.upgrades.none}</p>}

      <div className={styles.list}>
        {available.map((def) => (
          <UpgradeCard
            key={def.id}
            def={def}
            affordable={state.pizzas.gte(upgradeCost(state, def))}
            cost={fmt(upgradeCost(state, def))}
            wait={timeToAfford(state, upgradeCost(state, def))}
          />
        ))}
      </div>

      {owned.length > 0 && (
        <>
          <h3 className={styles.subtitle}>
            {t.upgrades.owned} <span className="num">{owned.length}</span>
          </h3>
          <div className={styles.ownedGrid}>
            {owned.map((def) => (
              <Tooltip
                key={def.id}
                variant="plain"
                align="left"
                content={
                  <>
                    <strong className={styles.tipName}>{def.name}</strong>
                    <div>{def.description}</div>
                  </>
                }
              >
                <Picto name={def.icon} size={18} />
              </Tooltip>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

type CardProps = { def: UpgradeDef; affordable: boolean; cost: string; wait: number | null };

function UpgradeCard({ def, affordable, cost, wait }: CardProps) {
  const sound = useSound();
  return (
    <button
      type="button"
      className={styles.card}
      data-affordable={affordable}
      disabled={!affordable}
      onClick={() => {
        doBuyUpgrade(def.id);
        sound('buy');
      }}
      title={affordable ? t.upgrades.buy : t.upgrades.cantAfford}
    >
      <span className={styles.cardPicto}>
        <Picto name={def.icon} size={22} />
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTop}>
          <span className={styles.cardName}>{def.name}</span>
          <span className={`${styles.cardCost} num`}>{cost}</span>
        </span>
        <span className={styles.cardDesc}>{def.description}</span>
        {!affordable && <WaitTime seconds={wait} inline={false} />}
        <span className={styles.cardTag}>{t.upgrades.categories[def.category]}</span>
      </span>
    </button>
  );
}
