/** Onglet Stats : tout ce qui servira aussi aux succès en Phase 2. */
import { t } from '../../data/i18n/fr.ts';
import { GENERATORS } from '../../data/generators.ts';
import { formatTime } from '../../engine/format.ts';
import { clickPower } from '../../engine/formulas.ts';
import { achievementMultiplier, achievementsOwnedCount } from '../../engine/achievements.ts';
import { upgradesOwnedCount } from '../../engine/upgrades.ts';
import { recipeLayer, starMultiplier } from '../../engine/prestige.ts';
import { completedCount } from '../../engine/challenges.ts';
import { expansionLayer } from '../../engine/prestige.ts';
import { totalCityLevels } from '../../engine/expansion.ts';
import { cityProduction } from '../../engine/formulas.ts';
import { CHALLENGES } from '../../data/challenges.ts';
import { ACHIEVEMENTS } from '../../data/achievements.ts';
import { UPGRADES } from '../../data/upgrades.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { useFormat } from '../useFormat.ts';
import styles from './StatsPanel.module.css';

export function StatsPanel() {
  const state = useGameStore((s) => s.state);
  const production = useGameStore((s) => s.production);
  const { fmt, fmtInt } = useFormat();

  const owned = GENERATORS.reduce((sum, def) => sum + state.generators[def.id].owned, 0);

  const rows: Array<[string, string]> = [
    [t.stats.production, `${fmt(production)} ${t.game.currency}${t.game.perSecond}`],
    [t.stats.perHour, `${fmt(production.mul(3600))} ${t.game.currency}`],
    [t.stats.clickPower, fmt(clickPower(state))],
    [t.stats.generatorsOwned, fmtInt(owned)],
    [t.stats.upgradesOwned, `${fmtInt(upgradesOwnedCount(state))} / ${UPGRADES.length}`],
    [t.stats.achievementsOwned, `${fmtInt(achievementsOwnedCount(state))} / ${ACHIEVEMENTS.length}`],
    [t.stats.achievementBonus, `×${achievementMultiplier(state).toNumber().toFixed(2)}`],
    [t.stats.eventsClicked, fmtInt(state.stats.eventsClicked)],
    [t.stats.stars, fmt(recipeLayer(state).currency)],
    [t.stats.starBonus, `×${starMultiplier(state).toNumber().toFixed(2)}`],
    [t.stats.prestigeCount, fmtInt(recipeLayer(state).resets)],
    [t.stats.challengesDone, `${fmtInt(completedCount(state))} / ${CHALLENGES.length}`],
    [t.stats.contracts, fmt(expansionLayer(state).currency)],
    [t.stats.expansions, fmtInt(expansionLayer(state).resets)],
    [t.stats.cities, fmtInt(totalCityLevels(state))],
    [t.stats.cityProduction, `${fmt(cityProduction(state))} ${t.game.currency}${t.game.perSecond}`],
    [t.stats.earnedRun, fmt(state.stats.earnedRun)],
    [t.stats.earnedTotal, fmt(state.stats.earnedTotal)],
    [t.stats.best, fmt(state.stats.bestPizzas)],
    [t.stats.handmade, fmt(state.stats.handmadeTotal)],
    [t.stats.clicks, fmtInt(state.stats.clicks)],
    [t.stats.clicksTotal, fmtInt(state.stats.clicksTotal)],
    [t.stats.playTimeRun, formatTime(state.stats.playTimeRun)],
    [t.stats.playTimeTotal, formatTime(state.stats.playTimeTotal)],
    [t.stats.createdAt, new Date(state.stats.createdAt).toLocaleString('fr-FR')],
  ];

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>{t.stats.title}</h2>
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
