/**
 * Composant racine : démarre la boucle de jeu, applique le thème et assemble les panneaux.
 *
 * Révélation progressive : au tout premier lancement, seule la pizza est visible.
 * Les cuisines, les améliorations, les onglets et la collection apparaissent
 * au fur et à mesure que le joueur débloque le contenu correspondant.
 */
import { useEffect, useRef } from 'react';
import { t } from '../data/i18n/fr.ts';
import { GENERATORS } from '../data/generators.ts';
import { formatTime } from '../engine/format.ts';
import { OFFLINE_BASE_EFFICIENCY } from '../data/config.ts';
import { availableUpgrades, upgradesOwnedCount } from '../engine/upgrades.ts';
import { achievementsOwnedCount } from '../engine/achievements.ts';
import { canPrestige, recipeLayer } from '../engine/prestige.ts';
import { challengesUnlocked } from '../engine/challenges.ts';
import { doRaiseFlag, startLoop } from '../store/gameLoop.ts';
import { useGameStore } from '../store/gameStore.ts';
import { Tabs } from './Tabs.tsx';
import { BuffBar } from './common/BuffBar.tsx';
import { ChallengeBanner } from './common/ChallengeBanner.tsx';
import { GoldenPizza } from './common/GoldenPizza.tsx';
import { Modal } from './common/Modal.tsx';
import { Toasts } from './common/Toasts.tsx';
import { AchievementsPanel } from './panels/AchievementsPanel.tsx';
import { ClickerPanel } from './panels/ClickerPanel.tsx';
import { GeneratorList } from './panels/GeneratorList.tsx';
import { OptionsPanel } from './panels/OptionsPanel.tsx';
import { PrestigePanel } from './panels/PrestigePanel.tsx';
import { ChallengesPanel } from './panels/ChallengesPanel.tsx';
import { StatsPanel } from './panels/StatsPanel.tsx';
import { UpgradesPanel } from './panels/UpgradesPanel.tsx';
import { useFormat } from './useFormat.ts';
import styles from './App.module.css';

export function App() {
  const state = useGameStore((s) => s.state);
  const theme = useGameStore((s) => s.state.settings.theme);
  const reducedMotion = useGameStore((s) => s.state.settings.reducedMotion);
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

  const tab = state.ui.tab;
  const anyGenerator = GENERATORS.some((def) => state.generators[def.id].unlocked);
  const anyUpgrade = upgradesOwnedCount(state) > 0 || availableUpgrades(state).length > 0;
  const anyAchievement = achievementsOwnedCount(state) > 0;
  // L'onglet Recette Secrète apparaît dès la première Étoile à portée, et reste ensuite.
  const prestigeReady = canPrestige(state);
  const showPrestige = prestigeReady || recipeLayer(state).resets > 0;
  /**
   * La barre d'onglets ne disparaît plus une fois apparue. Sans ça, un prestige
   * reverrouille toutes les cuisines et le joueur se retrouve enfermé dans l'onglet
   * où il se trouvait, sans moyen de revenir au jeu.
   */
  const showChallenges = challengesUnlocked(state);
  const showTabs = anyGenerator || anyAchievement || showPrestige || showChallenges;

  // Œuf de Pâques : insister sur le sujet qui fâche.
  const titleClicks = useRef(0);
  function pokeTitle() {
    titleClicks.current += 1;
    if (titleClicks.current >= 10) doRaiseFlag('pineapple');
  }

  return (
    <div className={styles.app}>
      <header className={styles.brand}>
        <h1 className={styles.logo}>
          <button type="button" className={styles.logoButton} onClick={pokeTitle}>
            {t.game.title}
          </button>
        </h1>
        <ChallengeBanner />
        <BuffBar />
      </header>

      {showTabs && (
        <div className={styles.nav}>
          <Tabs
            showAchievements={anyAchievement}
            showPrestige={showPrestige}
            showChallenges={showChallenges}
            prestigeReady={prestigeReady}
          />
        </div>
      )}

      {tab === 'game' && (
        <main
          className={styles.layout}
          data-columns={1 + (anyGenerator ? 1 : 0) + (anyUpgrade ? 1 : 0)}
        >
          <div className={styles.left}>
            <ClickerPanel />
          </div>
          {anyGenerator && (
            <div className={styles.center}>
              <GeneratorList />
            </div>
          )}
          {anyUpgrade && (
            <div className={styles.right}>
              <UpgradesPanel />
            </div>
          )}
        </main>
      )}

      {tab === 'succes' && <main className={styles.single}><AchievementsPanel /></main>}
      {tab === 'prestige' && <main className={styles.single}><PrestigePanel /></main>}
      {tab === 'defis' && <main className={styles.single}><ChallengesPanel /></main>}
      {tab === 'stats' && <main className={styles.single}><StatsPanel /></main>}
      {tab === 'options' && <main className={styles.single}><OptionsPanel /></main>}

      <GoldenPizza />
      <Toasts />
      {toast && <div className={styles.flash}>{toast}</div>}

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
