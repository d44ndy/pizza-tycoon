/** Une ligne de cuisine : achat, palier, infobulle détaillée. */
import { t } from '../../data/i18n/fr.ts';
import type { GeneratorDef } from '../../data/generators.ts';
import { milestonesReached } from '../../data/config.ts';
import {
  generatorCostFactor, generatorMultiplier, generatorProduction, milestoneProgress,
  productionShare, resolveBulk,
} from '../../engine/formulas.ts';
import { doBuy } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { ProgressBar } from '../common/ProgressBar.tsx';
import { Tooltip } from '../common/Tooltip.tsx';
import { Picto } from '../icons/Picto.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './GeneratorRow.module.css';

type Props = { def: GeneratorDef };

export function GeneratorRow({ def }: Props) {
  const state = useGameStore((s) => s.state);
  const { fmt, fmtInt } = useFormat();

  const gs = state.generators[def.id];
  const bulk = resolveBulk(def, gs.owned, state.pizzas, state.settings.bulkMode, generatorCostFactor(state));
  const progress = milestoneProgress(gs.owned);
  const unitProduction = def.baseProduction.mul(generatorMultiplier(state, def.id));
  const multiplier = Math.pow(2, milestonesReached(gs.owned));

  return (
    <div className={styles.row} data-affordable={bulk.affordable}>
      <button
        type="button"
        className={styles.main}
        onClick={() => doBuy(def.id)}
        disabled={!bulk.affordable}
      >
        <span className={styles.picto}>
          <Picto name={def.id} size={30} />
        </span>

        <span className={styles.body}>
          <span className={styles.titleLine}>
            <span className={styles.name}>{def.name}</span>
            {gs.owned > 0 && <span className={`${styles.owned} num`}>{fmtInt(gs.owned)}</span>}
          </span>

          <span className={styles.costLine}>
            <span className={`${styles.cost} num`}>{fmt(bulk.cost)}</span>
            <span className={`${styles.count} num`}>
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

      <span className={styles.info}>
        <Tooltip
          content={
            <>
              <strong className={styles.tipName}>{def.name}</strong>
              <div className={styles.tipDesc}>{def.description}</div>
              <div>
                {t.generators.tooltipUnit} : <span className="num">{fmt(unitProduction)}{t.game.perSecond}</span>
              </div>
              <div>
                {t.generators.tooltipTotal} :{' '}
                <span className="num">{fmt(generatorProduction(state, def.id))}{t.game.perSecond}</span>
              </div>
              <div>
                {t.generators.tooltipShare} :{' '}
                <span className="num">{(productionShare(state, def.id) * 100).toFixed(1)} %</span>
              </div>
              <div>
                {t.generators.tooltipMultiplier} : <span className="num">×{multiplier}</span>
              </div>
              <div className={styles.tipDesc}>{t.generators.milestoneHint(progress.to)}</div>
            </>
          }
        >
          i
        </Tooltip>
      </span>
    </div>
  );
}
