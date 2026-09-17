/**
 * Bandeau du défi en cours : visible depuis n'importe quel onglet, pour que le
 * joueur n'oublie jamais qu'il joue sous contrainte.
 */
import { t } from '../../data/i18n/fr.ts';
import { activeChallenge, challengeProgress, challengeRemaining, isCompleted } from '../../engine/challenges.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { useFormat } from '../useFormat.ts';
import styles from './ChallengeBanner.module.css';

export function ChallengeBanner() {
  const state = useGameStore((s) => s.state);
  const { fmt } = useFormat();

  const challenge = activeChallenge(state);
  if (!challenge) return null;

  const done = isCompleted(state, challenge.id);
  const remaining = challengeRemaining(state);

  return (
    <div className={styles.banner} data-done={done}>
      <span className={styles.name}>{t.challenges.bannerActive(challenge.name)}</span>
      <span className={`${styles.status} num`}>
        {done || !remaining ? t.challenges.bannerDone : t.challenges.bannerRemaining(fmt(remaining))}
      </span>
      <span className={styles.track} style={{ ['--ratio' as string]: challengeProgress(state) }}>
        <span className={styles.fill} />
      </span>
    </div>
  );
}
