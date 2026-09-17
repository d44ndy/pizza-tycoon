/**
 * Onglet « Expansion Mondiale » — le prestige de couche 2.
 *
 * Transcender efface tout ce que la Recette Secrète a construit, y compris les Étoiles
 * et l'arbre. En échange : des Contrats, et des villes qui produisent en parallèle
 * sans jamais repartir de zéro.
 */
import { useState } from 'react';
import { t } from '../../data/i18n/fr.ts';
import { CITIES, type CityDef } from '../../data/cities.ts';
import {
  canTranscend, canUpgradeCity, cityUpgradeCost, contractsFromTotal, isCityAvailable,
  isFounded, pendingContracts, totalForContracts,
} from '../../engine/expansion.ts';
import { cityLevel, expansionLayer, permanentEffects } from '../../engine/prestige.ts';
import { cityProduction } from '../../engine/formulas.ts';
import { doTranscendNow, doUpgradeCity } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { Modal } from '../common/Modal.tsx';
import { ProgressBar } from '../common/ProgressBar.tsx';
import { Picto } from '../icons/Picto.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './ExpansionPanel.module.css';

export function ExpansionPanel() {
  const state = useGameStore((s) => s.state);
  const setToast = useGameStore((s) => s.setToast);
  const { fmt } = useFormat();
  const [confirming, setConfirming] = useState(false);

  const layer = expansionLayer(state);
  const pending = pendingContracts(state);
  const ready = canTranscend(state);

  // Progression vers le Contrat suivant.
  const merited = contractsFromTotal(state.stats.earnedTotal);
  const floor = totalForContracts(merited);
  const ceiling = totalForContracts(merited.add(1));
  const span = ceiling.sub(floor);
  const ratio = span.lte(0) ? 0 : state.stats.earnedTotal.sub(floor).div(span).toNumber();

  function confirmTranscend() {
    const gained = doTranscendNow();
    setConfirming(false);
    if (gained) {
      setToast(t.expansion.done);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t.expansion.title}</h2>
        <div className={styles.score}>
          <span className={`${styles.contracts} num`}>{fmt(layer.currency)} ⛨</span>
          <span className={styles.scoreLabel}>{t.expansion.inBank}</span>
        </div>
      </header>

      <p className={styles.intro}>{t.expansion.intro}</p>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span>{t.expansion.totalEarned}</span>
          <span className="num">{fmt(layer.totalEarned)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t.expansion.resets}</span>
          <span className="num">{layer.resets}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t.expansion.cityProduction}</span>
          <span className="num">{fmt(cityProduction(state))} /s</span>
        </div>
      </div>

      <div className={styles.action}>
        <button type="button" className={styles.transcend} disabled={!ready} onClick={() => setConfirming(true)}>
          {t.expansion.button}
        </button>
        <span className={styles.pendingLabel}>
          {ready ? t.expansion.pending(fmt(pending)) : t.expansion.pendingNone}
        </span>
        <ProgressBar
          ratio={ratio}
          label={t.expansion.currency}
          value={t.expansion.progress(fmt(state.stats.earnedTotal), fmt(ceiling))}
        />
      </div>

      <h3 className={styles.citiesTitle}>{t.expansion.citiesTitle}</h3>
      <div className={styles.cities}>
        {CITIES.map((def) => (
          <City key={def.id} def={def} />
        ))}
      </div>

      {confirming && (
        <Modal
          title={t.expansion.confirmTitle}
          actionLabel={t.expansion.confirmAction}
          onAction={confirmTranscend}
          cancelLabel={t.expansion.cancel}
          onCancel={() => setConfirming(false)}
        >
          <span>{t.expansion.confirmBody(fmt(pending))}</span>
        </Modal>
      )}
    </section>
  );
}

function City({ def }: { def: CityDef }) {
  const state = useGameStore((s) => s.state);
  const { fmt } = useFormat();

  const level = cityLevel(state, def.id);
  const founded = isFounded(state, def.id);
  const available = isCityAvailable(state, def);
  const affordable = canUpgradeCity(state, def);
  const cost = cityUpgradeCost(state, def);

  const previous = CITIES[CITIES.findIndex((c) => c.id === def.id) - 1];
  const output = def.baseProduction.mul(level).mul(permanentEffects(state).cityMult);

  return (
    <article className={styles.city} data-state={founded ? 'founded' : available ? 'open' : 'locked'}>
      <header className={styles.cityHead}>
        <h4 className={styles.cityName}>{def.name}</h4>
        <span className={`${styles.cityLevel} num`}>
          {founded ? t.expansion.level(level) : t.expansion.notFounded}
        </span>
      </header>

      <p className={styles.cityDesc}>{def.description}</p>
      <p className={styles.cityEffect}>{cityEffectLabel(def)}</p>

      {founded && <p className={`${styles.cityOutput} num`}>{t.expansion.cityOutput(fmt(output))}</p>}

      {available ? (
        <button
          type="button"
          className={styles.cityButton}
          disabled={!affordable}
          onClick={() => doUpgradeCity(def.id)}
        >
          {founded ? t.expansion.upgrade : t.expansion.found}
          <span className={`${styles.cityCost} num`}>{t.expansion.cost(cost)}</span>
        </button>
      ) : (
        <p className={styles.cityLocked}>
          <Picto name="lock" size={13} />
          {t.expansion.locked(previous?.name ?? '')}
        </p>
      )}
    </article>
  );
}

/** Traduit l'effet d'une ville en une phrase, par niveau. */
function cityEffectLabel(def: CityDef): string {
  switch (def.effect.type) {
    case 'kitchenBoost': return `+${def.effect.percent} % de production des cuisines par niveau`;
    case 'clickBoost': return `Pétrissage ×${def.effect.factor} par niveau`;
    case 'cheaperKitchens': return `Cuisines ${def.effect.percent} % moins chères par niveau`;
    case 'fasterEvents': return `Pizzas d’or ${def.effect.percent} % plus fréquentes par niveau`;
    case 'offlineBoost': return `+${def.effect.percent} points de rendement hors ligne par niveau`;
    case 'cityBoost': return `+${def.effect.percent} % de production de TOUTES les villes par niveau`;
  }
}
