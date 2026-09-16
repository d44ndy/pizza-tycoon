/**
 * Simulateur d'équilibrage — `npm run sim`
 *
 * Fait tourner le moteur SANS interface, avec une stratégie gloutonne :
 * à chaque seconde le joueur clique N fois, attrape les pizzas d'or, et achète
 * systématiquement ce qui offre le meilleur gain de production par pizza dépensée
 * (cuisines et améliorations confondues).
 *
 * Options :
 *   node sim/run.ts --hours 12 --clicks 3 --no-events
 *   node sim/run.ts --hours 8 --click-minutes 2      (joueur idle : il lance la partie puis laisse tourner)
 */
import type { Decimal } from '../src/engine/decimal.ts';
import { createInitialState, type GameState } from '../src/engine/state.ts';
import { GENERATORS, type GeneratorId } from '../src/data/generators.ts';
import { costOfNext, totalProduction } from '../src/engine/formulas.ts';
import { buyGenerator, catchEvent, clickDough } from '../src/engine/actions.ts';
import { availableUpgrades, buyUpgrade, upgradesOwnedCount } from '../src/engine/upgrades.ts';
import { achievementsOwnedCount } from '../src/engine/achievements.ts';
import { tick } from '../src/engine/tick.ts';
import { format, formatTime } from '../src/engine/format.ts';

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

const HOURS = arg('hours', 12);
const CLICKS_PER_SECOND = arg('clicks', 3);
/** Le joueur ne clique que pendant les N premières minutes (profil « idle »). */
const CLICK_MINUTES = arg('click-minutes', HOURS * 60);
const CATCH_EVENTS = !process.argv.includes('--no-events');
const SEED = arg('seed', 20260916);
const STEP = 1; // seconde

/* ------------------------------------------------------------------ */
/* Stratégie gloutonne                                                 */
/* ------------------------------------------------------------------ */

type Candidate = { kind: 'generator'; id: GeneratorId } | { kind: 'upgrade'; id: string };

/** Production supplémentaire apportée par un achat, par pizza dépensée. */
function valueOf(state: GameState, candidate: Candidate, current: Decimal): { ratio: number; cost: Decimal } | null {
  if (candidate.kind === 'generator') {
    const def = GENERATORS.find((g) => g.id === candidate.id)!;
    const cost = costOfNext(def, state.generators[candidate.id].owned);
    if (cost.gt(state.pizzas)) return null;
    const after = totalProduction({
      ...state,
      generators: {
        ...state.generators,
        [candidate.id]: { ...state.generators[candidate.id], owned: state.generators[candidate.id].owned + 1 },
      },
    });
    return { ratio: after.sub(current).div(cost).toNumber(), cost };
  }

  const result = buyUpgrade(state, candidate.id);
  if (!result.bought) return null;
  const after = totalProduction(result.state);
  return { ratio: after.sub(current).div(result.spent).toNumber(), cost: result.spent };
}

/** Achète en boucle le meilleur rapport production/coût tant que c'est finançable. */
function spend(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 60; guard++) {
    const production = totalProduction(current);
    const candidates: Candidate[] = [
      ...GENERATORS.map((g) => ({ kind: 'generator' as const, id: g.id })),
      ...availableUpgrades(current).slice(0, 12).map((u) => ({ kind: 'upgrade' as const, id: u.id })),
    ];

    let best: { candidate: Candidate; ratio: number } | null = null;
    for (const candidate of candidates) {
      const value = valueOf(current, candidate, production);
      if (!value) continue;
      // Les améliorations de clic n'ajoutent pas de production : on les prend quand elles
      // sont peu chères, sinon la stratégie gloutonne les ignorerait pour toujours.
      const ratio = value.ratio > 0 ? value.ratio : (current.pizzas.gt(value.cost.mul(20)) ? 1e-12 : 0);
      if (ratio > 0 && (!best || ratio > best.ratio)) best = { candidate, ratio };
    }
    if (!best) return current;

    current = best.candidate.kind === 'generator'
      ? buyGenerator(current, best.candidate.id, 1).state
      : buyUpgrade(current, best.candidate.id).state;
  }
  return current;
}

/* ------------------------------------------------------------------ */
/* Boucle de simulation                                                */
/* ------------------------------------------------------------------ */

type Milestone = { label: string; at: number };

const milestones: Milestone[] = [];
const seen = new Set<string>();

function record(label: string, at: number): void {
  if (seen.has(label)) return;
  seen.add(label);
  milestones.push({ label, at });
}

/** Étoiles de prestige disponibles : floor(cbrt(pizzas cumulées / 1e9)). */
function stars(state: GameState): number {
  return Math.floor(Math.cbrt(state.stats.earnedTotal.div(1e9).toNumber()));
}

let state = createInitialState(0, SEED);
const timeline: Array<{ t: number; prod: Decimal; total: Decimal; ach: number; up: number }> = [];

for (let t = 0; t < HOURS * 3600; t += STEP) {
  if (t < CLICK_MINUTES * 60) {
    for (let c = 0; c < CLICKS_PER_SECOND; c++) state = clickDough(state);
  }
  if (CATCH_EVENTS && state.events.pending) state = catchEvent(state).state;
  state = tick(state, STEP);
  state = spend(state);

  for (const def of GENERATORS) {
    if (state.generators[def.id].unlocked) record(`débloque · ${def.name}`, t);
    if (state.generators[def.id].owned > 0) record(`achète · ${def.name}`, t);
  }
  const s = stars(state);
  if (s >= 1) record('1re Étoile (prestige possible)', t);
  if (s >= 5) record('5 Étoiles', t);
  if (s >= 10) record('10 Étoiles', t);
  if (s >= 50) record('50 Étoiles', t);

  if (t % 1800 === 0) {
    timeline.push({
      t, prod: totalProduction(state), total: state.stats.earnedTotal,
      ach: achievementsOwnedCount(state), up: upgradesOwnedCount(state),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Rapport                                                             */
/* ------------------------------------------------------------------ */

/**
 * Repères indicatifs du cahier des charges. Le rythme retenu est celui de
 * Cookie Clicker (partie longue, sur plusieurs semaines) : ces valeurs sont
 * affichées pour information, pas comme un verdict.
 */
const REPERES: Record<string, [number, number]> = {
  'débloque · Four à plasma orbital': [45 * 60, 90 * 60],
  '1re Étoile (prestige possible)': [30 * 60, 60 * 60],
};

const profilClics = CLICK_MINUTES >= HOURS * 60
  ? `${CLICKS_PER_SECOND} clic/s`
  : `${CLICKS_PER_SECOND} clic/s pendant ${CLICK_MINUTES} min puis plus rien`;
console.log(`\n=== Pizza Tycoon — simulation sur ${HOURS} h `
  + `(${profilClics}, pizzas d'or ${CATCH_EVENTS ? 'attrapées' : 'ignorées'}, graine ${SEED}) ===\n`);

console.log('JALON                                     TEMPS        ÉCART AU PRÉCÉDENT   REPÈRE DOC');
console.log('─'.repeat(96));
let previous = 0;
for (const m of milestones.sort((a, b) => a.at - b.at)) {
  const gap = m.at - previous;
  // Un « mur » : un jalon qui prend plus de trois fois le temps du précédent.
  const wall = previous > 60 && gap > previous * 3 ? '  ⚠ MUR' : '';
  const repere = REPERES[m.label];
  const verdict = repere ? `  (doc : ${formatTime(repere[0])}–${formatTime(repere[1])})` : '';
  console.log(`${m.label.padEnd(42)}${formatTime(m.at).padEnd(13)}${(formatTime(gap) + wall).padEnd(22)}${verdict}`);
  previous = m.at;
}

for (const [label, [min, max]] of Object.entries(REPERES)) {
  if (!seen.has(label)) {
    console.log(`${label.padEnd(42)}${'pas atteint'.padEnd(13)}${''.padEnd(22)}  (doc : ${formatTime(min)}–${formatTime(max)})`);
  }
}

console.log('\nPROGRESSION');
console.log('TEMPS        PRODUCTION/S        CUMUL              HAUTS FAITS   AMÉLIORATIONS');
console.log('─'.repeat(96));
for (const row of timeline) {
  console.log(
    `${formatTime(row.t).padEnd(13)}${format(row.prod).padEnd(20)}${format(row.total).padEnd(19)}`
    + `${String(row.ach).padEnd(14)}${row.up}`,
  );
}

console.log(`\nÉtat final : ${format(state.pizzas)} pizzas en stock, ${format(totalProduction(state))}/s, `
  + `${stars(state)} Étoiles, ${achievementsOwnedCount(state)} hauts faits, ${upgradesOwnedCount(state)} améliorations.`);
console.log(`Cuisines : ${GENERATORS.map((g) => `${g.name.split(' ')[0]} ${state.generators[g.id].owned}`).join(' · ')}\n`);
