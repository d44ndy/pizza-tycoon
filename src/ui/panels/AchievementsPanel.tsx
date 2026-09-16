/**
 * Onglet « Hauts faits » : la collection, groupée par catégorie.
 * Les hauts faits secrets restent « ??? » tant qu'ils ne sont pas obtenus,
 * les autres sont visibles dès le départ — c'est ce qui donne des objectifs.
 */
import { t } from '../../data/i18n/fr.ts';
import {
  ACHIEVEMENTS, type AchievementCategory, type AchievementDef,
} from '../../data/achievements.ts';
import { achievementMultiplier, achievementsOwnedCount } from '../../engine/achievements.ts';
import { formatTime } from '../../engine/format.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { Picto, type PictoName } from '../icons/Picto.tsx';
import styles from './AchievementsPanel.module.css';

const ORDER: readonly AchievementCategory[] = [
  'production', 'cuisines', 'clics', 'ameliorations', 'evenements', 'collection', 'secret',
];

/**
 * Un seul pictogramme pour tous les hauts faits obtenus : le trophée.
 * Les pictos par catégorie avaient l'air de panneaux routiers à 20 px, et la
 * catégorie est déjà annoncée par le titre de section juste au-dessus.
 */
const UNLOCKED_PICTO: PictoName = 'trophy';

export function AchievementsPanel() {
  const achievements = useGameStore((s) => s.state.achievements);
  const state = useGameStore((s) => s.state);

  const owned = achievementsOwnedCount(state);
  const bonus = achievementMultiplier(state).toNumber();

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t.achievements.title}</h2>
        <div className={styles.score}>
          <span className={`${styles.count} num`}>{t.achievements.progress(owned, ACHIEVEMENTS.length)}</span>
          <span className={styles.bonus}>{t.achievements.bonus(bonus.toFixed(2))}</span>
        </div>
      </header>

      {ORDER.map((category) => {
        const list = ACHIEVEMENTS.filter((a) => a.category === category);
        if (list.length === 0) return null;
        const done = list.filter((a) => achievements[a.id] !== undefined).length;
        return (
          <div key={category} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {t.achievements.categories[category]}
              <span className={`${styles.groupCount} num`}>{done} / {list.length}</span>
            </h3>
            <div className={styles.grid}>
              {list.map((def) => (
                <Badge key={def.id} def={def} at={achievements[def.id]} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

type BadgeProps = { def: AchievementDef; at: number | undefined };

function Badge({ def, at }: BadgeProps) {
  const unlocked = at !== undefined;
  const secret = def.hidden && !unlocked;

  return (
    <div className={styles.badge} data-unlocked={unlocked} data-secret={secret}>
      <span className={styles.badgePicto}>
        <Picto name={unlocked ? UNLOCKED_PICTO : 'lock'} size={20} />
      </span>
      <span className={styles.badgeName}>{secret ? t.achievements.locked : def.name}</span>
      <span className={styles.badgeDesc}>
        {secret ? t.achievements.lockedHint : def.description}
      </span>
      {unlocked && <span className={styles.badgeAt}>{t.achievements.unlockedAt(formatTime(at))}</span>}
    </div>
  );
}
