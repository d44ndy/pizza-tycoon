/**
 * Onglet « Défis ».
 *
 * Chaque défi annonce sa contrainte, son objectif et sa récompense avant d'être
 * relevé : le joueur doit pouvoir décider en connaissance de cause, puisque entrer
 * dans un défi fait repartir sa partie de zéro.
 */
import { useState } from 'react';
import { t } from '../../data/i18n/fr.ts';
import {
  CHALLENGES, CHALLENGES_UNLOCK_RESETS, type ChallengeDef,
} from '../../data/challenges.ts';
import {
  challengeProgress, challengesUnlocked, completedCount, isCompleted,
} from '../../engine/challenges.ts';
import { formatTime } from '../../engine/format.ts';
import { doEnterChallenge, doExitChallenge } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { Modal } from '../common/Modal.tsx';
import { ProgressBar } from '../common/ProgressBar.tsx';
import { Picto } from '../icons/Picto.tsx';
import { useFormat } from '../useFormat.ts';
import styles from './ChallengesPanel.module.css';

export function ChallengesPanel() {
  const state = useGameStore((s) => s.state);
  const { fmt } = useFormat();
  const [entering, setEntering] = useState<ChallengeDef | null>(null);
  const [exiting, setExiting] = useState(false);

  const unlocked = challengesUnlocked(state);
  const activeId = state.challenges.active;

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t.challenges.title}</h2>
        <span className={`${styles.count} num`}>
          {t.challenges.progress(completedCount(state), CHALLENGES.length)}
        </span>
      </header>

      <p className={styles.intro}>{t.challenges.intro}</p>

      {!unlocked && (
        <p className={styles.locked}>
          <Picto name="lock" size={16} />
          {t.challenges.locked(CHALLENGES_UNLOCK_RESETS)}
        </p>
      )}

      <div className={styles.list}>
        {CHALLENGES.map((def) => {
          const done = isCompleted(state, def.id);
          const active = activeId === def.id;
          return (
            <article
              key={def.id}
              className={styles.card}
              data-state={active ? 'active' : done ? 'done' : unlocked ? 'open' : 'locked'}
            >
              <header className={styles.cardHead}>
                <h3 className={styles.cardName}>{def.name}</h3>
                {done && <span className={styles.badgeDone}>{t.challenges.done}</span>}
                {active && <span className={styles.badgeActive}>{t.challenges.active}</span>}
              </header>

              <dl className={styles.details}>
                <div>
                  <dt>{t.challenges.constraint}</dt>
                  <dd>{def.constraint}</dd>
                </div>
                <div>
                  <dt>{t.challenges.goal}</dt>
                  <dd className="num">{t.challenges.goalValue(fmt(def.goal))}</dd>
                </div>
                <div>
                  <dt>{t.challenges.reward}</dt>
                  <dd className={styles.reward}>{def.rewardLabel}</dd>
                </div>
              </dl>

              {active && (
                <ProgressBar
                  ratio={challengeProgress(state)}
                  label={t.challenges.goal}
                  value={`${fmt(state.stats.earnedRun)} / ${fmt(def.goal)}`}
                />
              )}

              {done && state.challenges.completed[def.id] !== undefined && (
                <span className={styles.doneAt}>
                  {formatTime(state.challenges.completed[def.id]!)}
                </span>
              )}

              {unlocked && (
                <div className={styles.actions}>
                  {active ? (
                    <button type="button" className={styles.exit} onClick={() => setExiting(true)}>
                      {t.challenges.exit}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.enter}
                      onClick={() => setEntering(def)}
                      disabled={activeId !== null}
                    >
                      {t.challenges.enter}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {entering && (
        <Modal
          title={t.challenges.warnTitle}
          actionLabel={t.challenges.warnAction}
          onAction={() => {
            doEnterChallenge(entering.id);
            setEntering(null);
          }}
          cancelLabel={t.challenges.cancel}
          onCancel={() => setEntering(null)}
        >
          <strong className={styles.modalName}>{entering.name}</strong>
          <span>{entering.constraint}</span>
          <span>{t.challenges.warnBody}</span>
        </Modal>
      )}

      {exiting && (
        <Modal
          title={t.challenges.exitTitle}
          actionLabel={t.challenges.exitAction}
          onAction={() => {
            doExitChallenge();
            setExiting(false);
          }}
          cancelLabel={t.challenges.cancel}
          onCancel={() => setExiting(false)}
        >
          <span>{t.challenges.exitBody}</span>
        </Modal>
      )}
    </section>
  );
}
