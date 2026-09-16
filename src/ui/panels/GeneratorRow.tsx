/** Une ligne de générateur : achat, paliers, infobulle détaillée. */
import { t } from '../../data/i18n/fr.ts';
import type { GeneratorDef } from '../../data/generators.ts';
import { milestonesReached } from '../../data/config.ts';
import {
  generatorMultiplier, generatorProduction, milestoneProgress, productionShare, resolveBulk,
} from '../../engine/formulas.ts';
import { doBuy } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { ProgressBar } from '../common/ProgressBar.tsx';
import { Tooltip } from '../common/Tooltip.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './GeneratorRow.module.css';

type Props = { def: GeneratorDef };

export function GeneratorRow({ def }: Props) {
  const state = useGameStore((s) => s.state);
  const { fmt, fmtInt } = useFormat();

  const gs = state.generators[def.id];
  const bulk = resolveBulk(def, gs.owned, state.pizzas, state.settings.bulkMode);
  const progress = milestoneProgress(gs.owned);
  // Production d'UN exemplaire : utile aussi quand le joueur n'en possède encore aucun.
  const unitProduction = def.baseProduction.mul(generatorMultiplier(state, def.id));
  const share = productionShare(state, def.id);
  const multiplier = Math.pow(2, milestonesReached(gs.owned));

  return (
    <div className={styles.row} data-affordable={bulk.affordable}>
      <button
        type="button"
        className={styles.main}
        onClick={() => doBuy(def.id)}
        disabled={!bulk.affordable}
        title={bulk.affordable ? `${t.generators.buy} ×${bulk.count}` : t.generators.cantAfford}
      >
        <span className={styles.emoji}>{def.emoji}</span>

        <span className={styles.body}>
          <span className={styles.titleLine}>
            <span className={styles.name}>{def.name}</span>
            {gs.owned > 0 && <span className={styles.owned}>×{fmtInt(gs.owned)}</span>}
          </span>

          <span className={styles.costLine}>
            <span className={styles.cost}>🍕 {fmt(bulk.cost)}</span>
            <span className={styles.count}>
              +{fmtInt(bulk.count)}
              {multiplier > 1 && <span className={styles.boost}> ×{multiplier}</span>}
            </span>
          </span>

          {gs.owned > 0 && (
            <ProgressBar
              ratio={progress.ratio}
              label={t.generators.milestone}
              value={`${fmtInt(gs.owned)} / ${fmtInt(progress.to)}`}
            />
          )}
        </span>
      </button>

      <span className={styles.tooltip}>
        <Tooltip
          content={
            <>
              <strong>{def.name}</strong>
              <div className={styles.tipDesc}>{def.description}</div>
              <div>
                {t.generators.tooltipUnit} : {fmt(unitProduction)}
                {t.game.perSecond}
              </div>
              <div>
                {t.generators.tooltipTotal} : {fmt(generatorProduction(state, def.id))}
                {t.game.perSecond}
              </div>
              <div>
                {t.generators.tooltipShare} : {(share * 100).toFixed(1)} %
              </div>
              <div>
                {t.generators.tooltipMultiplier} : ×{multiplier}
              </div>
              <div className={styles.tipDesc}>{t.generators.milestoneHint(progress.to)}</div>
            </>
          }
        >
          ℹ️
        </Tooltip>
      </span>
    </div>
  );
}
