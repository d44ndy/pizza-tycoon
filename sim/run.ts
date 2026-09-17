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
 *   node sim/run.ts --challenge inflation            (un défi précis, sans aide de l'arbre)
 *   node sim/run.ts --challenges                     (les huit défis à la suite)
 */
import { D, type Decimal } from '../src/engine/decimal.ts';
import { createInitialState, type GameState } from '../src/engine/state.ts';
import { GENERATORS, type GeneratorId } from '../src/data/generators.ts';
import { costOfNext, costRules, totalProduction } from '../src/engine/formulas.ts';
import { currentRules, enterChallenge, isGeneratorAllowed } from '../src/engine/challenges.ts';
import { CHALLENGES, CHALLENGES_BY_ID } from '../src/data/challenges.ts';
import { buyGenerator, catchEvent, clickDough } from '../src/engine/actions.ts';
import { availableUpgrades, buyUpgrade, upgradesOwnedCount } from '../src/engine/upgrades.ts';
import { achievementsOwnedCount } from '../src/engine/achievements.ts';
import {
  buyNode, canBuyNode, doPrestige, pendingStars, recipeLayer,
} from '../src/engine/prestige.ts';
import { PRESTIGE_TREE } from '../src/data/prestige.ts';
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
/** Le joueur prestige dès que le gain double son stock d'Étoiles (règle du cahier des charges). */
const PRESTIGE = !process.argv.includes('--no-prestige');
const SEED = arg('seed', 20260916);
/** Pas de simulation. 1 s est fidèle ; 5 s permet de simuler plusieurs jours rapidement. */
const STEP = arg('step', 1);

/* ------------------------------------------------------------------ */
/* Stratégie gloutonne                                                 */
/* ------------------------------------------------------------------ */

type Candidate = { kind: 'generator'; id: GeneratorId } | { kind: 'upgrade'; id: string };

/** Production supplémentaire apportée par un achat, par pizza dépensée. */
function valueOf(state: GameState, candidate: Candidate, current: Decimal): { ratio: number; cost: Decimal } | null {
  if (candidate.kind === 'generator') {
    const def = GENERATORS.find((g) => g.id === candidate.id)!;
    if (!isGeneratorAllowed(currentRules(state), def)) return null;
    const cost = costOfNext(def, state.generators[candidate.id].owned, costRules(state));
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
/* Mode « défis » : chaque défi est-il terminable, et en combien de temps ? */
/* ------------------------------------------------------------------ */

function argString(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

/**
 * Rejoue un défi depuis une partie neuve, SANS aucun nœud d'arbre ni récompense :
 * si l'objectif tombe dans ces conditions, il tombera a fortiori pour un joueur
 * qui arrive après trois prestiges.
 */
function runChallenge(id: string, maxHours: number): { id: string; name: string; at: number | null; production: Decimal } {
  const def = CHALLENGES_BY_ID[id]!;
  let state = createInitialState(0, SEED);
  state = enterChallenge({ ...state, prestige: { layers: { recipe: { currency: D(0), totalEarned: D(0), resets: 3, nodes: {} } } } }, id);

  for (let t = 0; t < maxHours * 3600; t += STEP) {
    for (let c = 0; c < CLICKS_PER_SECOND * STEP; c++) state = clickDough(state);
    if (CATCH_EVENTS && state.events.pending) state = catchEvent(state).state;
    state = tick(state, STEP);
    state = spend(state);
    if (state.stats.earnedRun.gte(def.goal)) {
      return { id, name: def.name, at: t, production: totalProduction(state) };
    }
  }
  return { id, name: def.name, at: null, production: totalProduction(state) };
}

const challengeArg = argString('challenge');
if (challengeArg || process.argv.includes('--challenges')) {
  const list = challengeArg ? [CHALLENGES_BY_ID[challengeArg]!] : CHALLENGES;
  console.log(`\n=== Défis — ${CLICKS_PER_SECOND} clic/s, aucune aide de l'arbre, plafond ${HOURS} h ===\n`);
  console.log('DÉFI                 OBJECTIF      TERMINÉ EN     PRODUCTION FINALE');
  console.log('─'.repeat(74));
  for (const def of list) {
    const result = runChallenge(def.id, HOURS);
    console.log(
      `${def.name.padEnd(21)}${format(def.goal).padEnd(14)}`
      + `${(result.at === null ? 'JAMAIS' : formatTime(result.at)).padEnd(15)}${format(result.production)}/s`,
    );
  }
  console.log('');
  process.exit(0);
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

/** Étoiles en banque (dépensables). */
function stars(state: GameState): number {
  return recipeLayer(state).currency.toNumber();
}

/** Achète les nœuds d'arbre abordables, les moins chers d'abord. */
function spendStars(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 30; guard++) {
    const candidates = PRESTIGE_TREE
      .filter((node) => canBuyNode(current, node))
      .sort((a, b) => a.cost - b.cost);
    const cheapest = candidates[0];
    if (!cheapest) return current;
    current = buyNode(current, cheapest.id).state;
  }
  return current;
}

/**
 * Règle de prestige : on recommence dès que le gain double les Étoiles en banque
 * (et au moins 1 Étoile au premier passage).
 */
function shouldPrestige(state: GameState): boolean {
  const gain = pendingStars(state);
  if (gain.lt(1)) return false;
  // On compare au TOTAL d'Étoiles déjà gagnées, pas à la banque : sinon, comme
  // l'arbre vide la banque, la règle dégénère en « prestige dès la première Étoile ».
  const earned = recipeLayer(state).totalEarned;
  return earned.lte(0) ? gain.gte(1) : gain.gte(earned);
}

let state = createInitialState(0, SEED);
const timeline: Array<{
  t: number; prod: Decimal; total: Decimal; ach: number; up: number; etoiles: number; noeuds: number;
}> = [];

for (let t = 0; t < HOURS * 3600; t += STEP) {
  if (t < CLICK_MINUTES * 60) {
    for (let c = 0; c < CLICKS_PER_SECOND * STEP; c++) state = clickDough(state);
  }
  if (CATCH_EVENTS && state.events.pending) state = catchEvent(state).state;
  state = tick(state, STEP);
  state = spend(state);

  if (pendingStars(state).gte(1)) record('1re Étoile (prestige possible)', t);

  if (PRESTIGE && shouldPrestige(state)) {
    const before = recipeLayer(state).resets;
    state = doPrestige(state).state;
    state = spendStars(state);
    record(`prestige n°${before + 1}`, t);
  }

  for (const def of GENERATORS) {
    if (state.generators[def.id].unlocked) record(`débloque · ${def.name}`, t);
    if (state.generators[def.id].owned > 0) record(`achète · ${def.name}`, t);
  }
  const banque = recipeLayer(state).totalEarned.toNumber();
  if (banque >= 5) record('5 Étoiles gagnées', t);
  if (banque >= 50) record('50 Étoiles gagnées', t);
  if (banque >= 500) record('500 Étoiles gagnées', t);

  if (t % 1800 < STEP) {
    timeline.push({
      t, prod: totalProduction(state), total: state.stats.earnedTotal,
      ach: achievementsOwnedCount(state), up: upgradesOwnedCount(state),
      etoiles: recipeLayer(state).currency.toNumber(),
      noeuds: Object.keys(recipeLayer(state).nodes).length,
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
console.log('TEMPS        PRODUCTION/S        CUMUL              HAUTS FAITS   AMÉLIOR.   ÉTOILES   NŒUDS');
console.log('─'.repeat(96));
for (const row of timeline) {
  console.log(
    `${formatTime(row.t).padEnd(13)}${format(row.prod).padEnd(20)}${format(row.total).padEnd(19)}`
    + `${String(row.ach).padEnd(14)}${String(row.up).padEnd(11)}${String(row.etoiles).padEnd(10)}${row.noeuds}`,
  );
}

console.log(`\nÉtat final : ${format(state.pizzas)} pizzas en stock, ${format(totalProduction(state))}/s, `
  + `${stars(state)} Étoiles en banque (${recipeLayer(state).resets} prestiges, `
  + `${Object.keys(recipeLayer(state).nodes).length}/${PRESTIGE_TREE.length} nœuds), `
  + `${achievementsOwnedCount(state)} hauts faits, ${upgradesOwnedCount(state)} améliorations.`);
console.log(`Cuisines : ${GENERATORS.map((g) => `${g.name.split(' ')[0]} ${state.generators[g.id].owned}`).join(' · ')}\n`);
