/**
 * Barre d'onglets : en haut sur desktop, fixée en bas sur mobile (voir le CSS).
 * Un onglet n'apparaît que lorsqu'il a quelque chose à montrer.
 */
import { t } from '../data/i18n/fr.ts';
import { setTab } from '../engine/actions.ts';
import type { TabId } from '../engine/state.ts';
import { dispatch } from '../store/gameLoop.ts';
import { useGameStore } from '../store/gameStore.ts';
import { Picto, type PictoName } from './icons/Picto.tsx';
import styles from './Tabs.module.css';

type Props = {
  showAchievements: boolean;
  showPrestige: boolean;
  showChallenges: boolean;
  prestigeReady: boolean;
};

const TABS: Array<[TabId, string, PictoName]> = [
  ['game', t.tabs.game, 'four'],
  ['succes', t.tabs.succes, 'trophy'],
  ['prestige', t.tabs.prestige, 'sparkle'],
  ['defis', t.tabs.defis, 'trophy'],
  ['stats', t.tabs.stats, 'recette'],
  ['options', t.tabs.options, 'synergy'],
];

export function Tabs({ showAchievements, showPrestige, showChallenges, prestigeReady }: Props) {
  const tab = useGameStore((s) => s.state.ui.tab);
  const visible = TABS.filter(([id]) => {
    if (id === 'succes') return showAchievements;
    if (id === 'prestige') return showPrestige;
    if (id === 'defis') return showChallenges;
    return true;
  });

  return (
    <nav className={styles.tabs} aria-label="Navigation">
      {visible.map(([id, label, picto]) => (
        <button
          key={id}
          type="button"
          className={styles.tab}
          data-active={id === tab}
          data-ready={id === 'prestige' && prestigeReady && id !== tab}
          aria-current={id === tab}
          onClick={() => dispatch((s) => setTab(s, id))}
        >
          <Picto name={picto} size={17} />
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
