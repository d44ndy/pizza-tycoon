/**
 * Barre d'onglets : en haut sur desktop, fixée en bas sur mobile (voir le CSS).
 * Les onglets Succès / Prestige / Défis viendront s'ajouter ici aux phases suivantes.
 */
import { t } from '../data/i18n/fr.ts';
import { setTab } from '../engine/actions.ts';
import type { TabId } from '../engine/state.ts';
import { dispatch } from '../store/gameLoop.ts';
import { useGameStore } from '../store/gameStore.ts';
import styles from './Tabs.module.css';

const TABS: Array<[TabId, string, string]> = [
  ['game', t.tabs.game, '🍕'],
  ['stats', t.tabs.stats, '📊'],
  ['options', t.tabs.options, '⚙️'],
];

export function Tabs() {
  const tab = useGameStore((s) => s.state.ui.tab);

  return (
    <nav className={styles.tabs} aria-label="Navigation">
      {TABS.map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          className={styles.tab}
          data-active={id === tab}
          aria-current={id === tab}
          onClick={() => dispatch((s) => setTab(s, id))}
        >
          <span className={styles.icon}>{icon}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
