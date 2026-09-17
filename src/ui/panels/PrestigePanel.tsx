/**
 * Onglet « Recette Secrète » : le prestige et son arbre de compétences.
 *
 * Le bouton de prestige affiche en permanence ce que le joueur gagnerait s'il
 * recommençait maintenant, et reste désactivé tant qu'il n'y a pas une Étoile à prendre.
 */
import { useState } from 'react';
import { t } from '../../data/i18n/fr.ts';
import {
  PRESTIGE_BRANCHES, PRESTIGE_TREE, type PrestigeBranch, type PrestigeNodeDef,
} from '../../data/prestige.ts';
import {
  canBuyNode, hasNode, isNodeAvailable, pendingStars, recipeLayer,
  starMultiplier, starsFromTotal, totalForStars, treeEffects,
} from '../../engine/prestige.ts';
import { doBuyNode, doPrestigeNow } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { Modal } from '../common/Modal.tsx';
import { ProgressBar } from '../common/ProgressBar.tsx';
import { Picto } from '../icons/Picto.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './PrestigePanel.module.css';

const BRANCH_ORDER: readonly PrestigeBranch[] = ['fournil', 'salle', 'nuit', 'brigade'];

export function PrestigePanel() {
  const state = useGameStore((s) => s.state);
  const setToast = useGameStore((s) => s.setToast);
  const { fmt } = useFormat();
  const [confirming, setConfirming] = useState(false);

  const layer = recipeLayer(state);
  const pending = pendingStars(state);
  const ready = pending.gte(1);

  // Progression vers l'Étoile suivante : entre le seuil atteint et le seuil suivant.
  const merited = starsFromTotal(state.stats.earnedPrestige);
  const nextStar = merited.add(1);
  const floor = totalForStars(merited);
  const ceiling = totalForStars(nextStar);
  const span = ceiling.sub(floor);
  const ratio = span.lte(0) ? 0 : state.stats.earnedPrestige.sub(floor).div(span).toNumber();

  function confirmPrestige() {
    const gained = doPrestigeNow();
    setConfirming(false);
    if (gained) {
      setToast(t.prestige.done);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t.prestige.title}</h2>
        <div className={styles.score}>
          <span className={`${styles.stars} num`}>{fmt(layer.currency)} ⭐</span>
          <span className={styles.scoreLabel}>{t.prestige.inBank}</span>
        </div>
      </header>

      <p className={styles.intro}>{t.prestige.intro}</p>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span>{t.prestige.totalEarned}</span>
          <span className="num">{fmt(layer.totalEarned)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t.prestige.resets}</span>
          <span className="num">{layer.resets}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t.prestige.bonus((treeEffects(state).starBonus * 100).toFixed(0))}</span>
          <span className="num">×{starMultiplier(state).toNumber().toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.action}>
        <button
          type="button"
          className={styles.burn}
          disabled={!ready}
          onClick={() => setConfirming(true)}
        >
          {t.prestige.button}
        </button>
        <span className={styles.pendingLabel}>
          {ready ? t.prestige.pending(fmt(pending)) : t.prestige.pendingNone}
        </span>
        <ProgressBar
          ratio={ratio}
          label={t.prestige.currency}
          value={t.prestige.progress(fmt(state.stats.earnedPrestige), fmt(ceiling))}
        />
      </div>

      <h3 className={styles.treeTitle}>{t.prestige.treeTitle}</h3>
      <div className={styles.root}>
        {PRESTIGE_TREE.filter((n) => n.branch === 'racine').map((def) => (
          <Node key={def.id} def={def} />
        ))}
      </div>

      <div className={styles.branches}>
        {BRANCH_ORDER.map((branch) => (
          <div key={branch} className={styles.branch}>
            <h4 className={styles.branchTitle}>
              {PRESTIGE_BRANCHES[branch].name}
              <span className={styles.branchDesc}>{PRESTIGE_BRANCHES[branch].description}</span>
            </h4>
            <div className={styles.nodes}>
              {PRESTIGE_TREE.filter((n) => n.branch === branch).map((def) => (
                <Node key={def.id} def={def} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {confirming && (
        <Modal
          title={t.prestige.confirmTitle}
          actionLabel={t.prestige.confirmAction}
          onAction={confirmPrestige}
          onCancel={() => setConfirming(false)}
          cancelLabel={t.prestige.cancel}
        >
          <span>{t.prestige.confirmBody(fmt(pending))}</span>
        </Modal>
      )}
    </section>
  );
}

function Node({ def }: { def: PrestigeNodeDef }) {
  const state = useGameStore((s) => s.state);
  const owned = hasNode(state, def.id);
  const available = isNodeAvailable(state, def);
  const affordable = canBuyNode(state, def);

  const requirements = def.requires
    .map((id) => PRESTIGE_TREE.find((n) => n.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      className={styles.node}
      data-state={owned ? 'owned' : available ? 'available' : 'locked'}
      disabled={!affordable}
      onClick={() => doBuyNode(def.id)}
      title={owned ? t.prestige.nodeOwned : affordable ? '' : t.prestige.cantAfford}
    >
      <span className={styles.nodeTop}>
        <span className={styles.nodeName}>{def.name}</span>
        <span className={`${styles.nodeCost} num`}>
          {owned ? t.prestige.nodeOwned : t.prestige.nodeCost(def.cost)}
        </span>
      </span>
      <span className={styles.nodeDesc}>{def.description}</span>
      {!owned && !available && (
        <span className={styles.nodeLock}>
          <Picto name="lock" size={13} />
          {t.prestige.nodeRequires(requirements)}
        </span>
      )}
    </button>
  );
}
