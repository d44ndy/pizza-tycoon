/**
 * Composant racine : démarre la boucle de jeu, applique le thème et assemble les panneaux.
 *
 * Révélation progressive : au tout premier lancement, seul le bouton de clic est visible.
 * Les onglets, la liste des cuisines et la colonne des améliorations apparaissent
 * au fur et à mesure que le joueur débloque le contenu correspondant.
 */
import { useEffect } from 'react';
import { t } from '../data/i18n/fr.ts';
import { GENERATORS } from '../data/generators.ts';
import { formatTime } from '../engine/format.ts';
import { OFFLINE_BASE_EFFICIENCY } from '../data/config.ts';
import { startLoop } from '../store/gameLoop.ts';
import { useGameStore } from '../store/gameStore.ts';
import { Tabs } from './Tabs.tsx';
import { Modal } from './common/Modal.tsx';
import { ClickerPanel } from './panels/ClickerPanel.tsx';
import { GeneratorList } from './panels/GeneratorList.tsx';
import { OptionsPanel } from './panels/OptionsPanel.tsx';
import { StatsPanel } from './panels/StatsPanel.tsx';
import { UpgradesPanel } from './panels/UpgradesPanel.tsx';
import { useFormat } from './useFormat.ts';
import styles from './App.module.css';

export function App() {
  const tab = useGameStore((s) => s.state.ui.tab);
  const theme = useGameStore((s) => s.state.settings.theme);
  const reducedMotion = useGameStore((s) => s.state.settings.reducedMotion);
  const generators = useGameStore((s) => s.state.generators);
  const offline = useGameStore((s) => s.offline);
  const corrupted = useGameStore((s) => s.corrupted);
  const toast = useGameStore((s) => s.toast);
  const setOffline = useGameStore((s) => s.setOffline);
  const setCorrupted = useGameStore((s) => s.setCorrupted);
  const { fmt } = useFormat();

  // Démarrage de la boucle de jeu (chargement de la partie + hors ligne inclus).
  useEffect(() => startLoop(), []);

  // Le thème et la réduction d'animations vivent sur <html> : tout le CSS en découle.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  const anyUnlocked = GENERATORS.some((def) => generators[def.id].unlocked);

  return (
    <div className={styles.app}>
      <header className={styles.brand}>
        <h1 className={styles.logo}>
          <span aria-hidden="true">🍕</span> {t.game.title}
        </h1>
      </header>

      {anyUnlocked && (
        <div className={styles.nav}>
          <Tabs />
        </div>
      )}

      {tab === 'game' && (
        <main className={styles.layout}>
          <div className={styles.left}>
            <ClickerPanel />
          </div>
          <div className={styles.center}>
            <GeneratorList />
          </div>
          {anyUnlocked && (
            <div className={styles.right}>
              <UpgradesPanel />
            </div>
          )}
        </main>
      )}

      {tab === 'stats' && (
        <main className={styles.single}>
          <StatsPanel />
        </main>
      )}

      {tab === 'options' && (
        <main className={styles.single}>
          <OptionsPanel />
        </main>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {offline && (
        <Modal title={t.offline.title} actionLabel={t.offline.close} onAction={() => setOffline(null)}>
          <span>{t.offline.away(formatTime(offline.elapsedSeconds))}</span>
          <strong className={styles.offlineGain}>{t.offline.gained(fmt(offline.gained))}</strong>
          <span>{t.offline.efficiency(Math.round(OFFLINE_BASE_EFFICIENCY * 100))}</span>
          {offline.capped && <span>{t.offline.capped(formatTime(offline.creditedSeconds))}</span>}
        </Modal>
      )}

      {corrupted && (
        <Modal
          title={t.save.corruptedTitle}
          actionLabel={t.save.corruptedContinue}
          onAction={() => setCorrupted(null)}
        >
          <span>{t.save.corruptedBody}</span>
          <textarea className={styles.rawSave} readOnly rows={5} value={corrupted} />
        </Modal>
      )}
    </div>
  );
}
