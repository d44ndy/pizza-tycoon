/** Une ligne de cuisine : achat, palier, infobulle détaillée. */
import { t } from '../../data/i18n/fr.ts';
import type { GeneratorDef } from '../../data/generators.ts';
import { milestonesReached } from '../../data/config.ts';
import {
  costRules, generatorMultiplier, generatorProduction, milestoneProgress,
  productionShare, resolveBulk, timeToAfford,
} from '../../engine/formulas.ts';
import { permanentEffects } from '../../engine/prestige.ts';
import { doBuy, doToggleAutoBuy } from '../../store/gameLoop.ts';
import { WaitTime } from '../common/WaitTime.tsx';
import { useGameStore } from '../../store/gameStore.ts';
import { ProgressBar } from '../common/ProgressBar.tsx';
import { Tooltip } from '../common/Tooltip.tsx';
import { Picto } from '../icons/Picto.tsx';
import { useFormat } from '../useFormat.ts';
import { useSound } from '../useSound.ts';
import styles from './GeneratorRow.module.css';

type Props = { def: GeneratorDef };

export function GeneratorRow({ def }: Props) {
  const state = useGameStore((s) => s.state);
  const { fmt, fmtInt } = useFormat();
  const sound = useSound();

  const gs = state.generators[def.id];
  const bulk = resolveBulk(def, gs.owned, state.pizzas, state.settings.bulkMode, costRules(state));
  const progress = milestoneProgress(gs.owned);
  const unitProduction = def.baseProduction.mul(generatorMultiplier(state, def.id));
  const multiplier = Math.pow(2, milestonesReached(gs.owned));
  const wait = bulk.affordable ? 0 : timeToAfford(state, bulk.cost);
  // L'interrupteur n'apparaît qu'une fois le commis aux achats débloqué.
  const commis = permanentEffects(state).autoBuyGenerators;
  const autoOn = !state.settings.automation.excluded.includes(def.id);

  return (
    <div className={styles.row} data-affordable={bulk.affordable}>
      <button
        type="button"
        className={styles.main}
        onClick={() => {
          doBuy(def.id);
          sound('buy');
        }}
        disabled={!bulk.affordable}
      >
        {/* Une cuisine qui tourne bouge un peu, chacune à son tour (décalage par rang). */}
        <span
          className={styles.picto}
          data-working={gs.owned > 0}
          style={{ animationDelay: `${def.index * 0.37}s` }}
        >
          <Picto name={def.id} size={30} />
        </span>

        <span className={styles.body}>
          <span className={styles.titleLine}>
            <span className={styles.name}>{def.name}</span>
            {gs.owned > 0 && <span className={`${styles.owned} num`}>{fmtInt(gs.owned)}</span>}
          </span>

          <span className={styles.costLine}>
            <span className={`${styles.cost} num`}>
              {fmt(bulk.cost)}
              {wait !== 0 && <WaitTime seconds={wait} />}
            </span>
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
        {commis && (
          <button
            type="button"
            className={styles.auto}
            data-on={autoOn}
            aria-pressed={autoOn}
            title={autoOn ? t.generators.autoOn : t.generators.autoOff}
            onClick={() => doToggleAutoBuy(def.id)}
          >
            {t.generators.auto}
          </button>
        )}
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
