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
 *   node sim/run.ts --no-chef                        (sans La Pizza du Chef, pour comparer)
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
  buyNode, canBuyNode, doPrestige, nodesAffordableAfterPrestige, pendingStars, recipeLayer,
} from '../src/engine/prestige.ts';
import { PRESTIGE_TREE } from '../src/data/prestige.ts';
import {
  canTranscend, canUpgradeCity, cityUpgradeCost, doTranscend, pendingContracts, totalCityLevels, upgradeCity,
} from '../src/engine/expansion.ts';
import { expansionLayer } from '../src/engine/prestige.ts';
import { CITIES } from '../src/data/cities.ts';
import { tick } from '../src/engine/tick.ts';
import { format, formatTime } from '../src/engine/format.ts';
import { clickPower } from '../src/engine/formulas.ts';
import { bakePizza, canBake } from '../src/engine/chefPizza.ts';
import type { ToppingId } from '../src/data/toppings.ts';

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
/** Le joueur utilise La Pizza du Chef (il enfourne la meilleure garniture qu'il connaît). */
const CHEF = !process.argv.includes('--no-chef');

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
/* La Pizza du Chef                                                    */
/* ------------------------------------------------------------------ */

/**
 * Les trois championnes de la recherche exhaustive. Le simulateur ne cherche pas :
 * il joue comme un joueur qui a lu les hauts faits et trouvé les records.
 */
const CHEF_CANDIDATES: ReadonlyArray<readonly ToppingId[]> = [
  ['basilic', 'tomate', 'basilic', 'tomate', 'basilic', 'tomate', 'basilic', 'tomate'],
  ['champignon', 'champignon', 'oignon', 'champignon', 'oignon', 'oignon', 'champignon', 'oignon'],
  ['ananas', 'jambon', 'ananas', 'jambon', 'ananas', 'jambon', 'ananas', 'jambon'],
];

const CHEF_SETTLE_SECONDS = 600;

/** Revenu d'un état pour ce profil de joueur : production, plus les clics s'il clique. */
function income(state: GameState, clicking: boolean): Decimal {
  const production = totalProduction(state);
  return clicking ? production.add(clickPower(state).mul(CLICKS_PER_SECOND)) : production;
}

/** Enfourne, dès que le four est prêt, la championne qui rapporte le plus à ce joueur. */
function bakeChef(state: GameState, clicking: boolean): GameState {
  if (!CHEF || state.chef.unlocked.length === 0) return state;
  // Juste après un prestige, la production est minuscule et le pétrissage domine :
  // choisir à ce moment-là enfermerait le joueur une heure avec la mauvaise pizza.
  // Il attend dix minutes que son économie redémarre, comme le ferait un humain.
  if (state.stats.playTimeRun < CHEF_SETTLE_SECONDS) return state;
  let best = state;
  let bestIncome = income(state, clicking);
  for (const layout of CHEF_CANDIDATES) {
    if (!layout.every((id) => state.chef.unlocked.includes(id))) continue;
    const trial: GameState = { ...state, chef: { ...state.chef, draft: layout } };
    if (!canBake(trial)) continue;
    const baked = bakePizza(trial).state;
    const value = income(baked, clicking);
    // 1 % de mieux au minimum : on ne relance pas le four pour une broutille.
    if (value.gt(bestIncome.mul(1.01))) {
      best = baked;
      bestIncome = value;
    }
  }
  return best;
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

/**
 * Dépense les Étoiles comme un joueur qui lit l'arbre : le nœud qui rapporte le plus
 * de revenu PAR ÉTOILE d'abord, et seulement s'il rapporte plus que les Étoiles
 * gardées en réserve (+2 % chacune). Un nœud se juge sur l'économie qu'on va
 * reconstruire (celle d'avant le prestige), pas sur la partie toute neuve où seul
 * le pétrissage rapporte encore quelque chose.
 */
function spendStars(state: GameState, reference: GameState): { state: GameState; bought: string[] } {
  let current = state;
  const bought: string[] = [];
  const probe = (s: GameState): GameState => ({ ...reference, prestige: s.prestige });
  for (let guard = 0; guard < 30; guard++) {
    const before = income(probe(current), true).max(1e-9);
    let best: (typeof PRESTIGE_TREE)[number] | null = null;
    let bestScore = 0;
    for (const node of PRESTIGE_TREE) {
      if (!canBuyNode(current, node)) continue;
      // Le revenu « après » tient compte des Étoiles qui quittent la réserve.
      const gain = income(probe(buyNode(current, node.id).state), true).div(before).toNumber();
      const score = Math.log(gain) / node.cost;
      if (score > bestScore + 1e-9) {
        best = node;
        bestScore = score;
      }
    }
    if (!best) break;
    current = buyNode(current, best.id).state;
    bought.push(`${best.name} (${best.cost})`);
  }
  return { state: current, bought };
}

/** Achète les villes abordables, la moins chère d'abord. */
function spendContracts(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 40; guard++) {
    const candidates = CITIES
      .filter((city) => canUpgradeCity(current, city))
      .sort((a, b) => cityUpgradeCost(current, a) - cityUpgradeCost(current, b));
    const cheapest = candidates[0];
    if (!cheapest) return current;
    current = upgradeCity(current, cheapest.id).state;
  }
  return current;
}

/** Même règle que pour le prestige : on transcende quand le gain double le total. */
function shouldTranscend(state: GameState): boolean {
  if (!canTranscend(state)) return false;
  const earned = expansionLayer(state).totalEarned;
  const gain = pendingContracts(state);
  return earned.lte(0) ? gain.gte(1) : gain.gte(earned);
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
  if (!(earned.lte(0) ? gain.gte(1) : gain.gte(earned))) return false;
  // Et seulement si ces Étoiles achètent un nœud qui vaut le coup : l'écran de prestige
  // affiche ce qu'on pourra s'offrir, et personne ne brûle une heure de partie pour +2 %.
  if (nodesAffordableAfterPrestige(state).length === 0) return false;
  return spendStars(doPrestige(state).state, state).bought.length > 0;
}

let state = createInitialState(0, SEED);

/**
 * Le « rebond » d'un prestige : combien de temps pour reproduire la run qu'on vient
 * de brûler. C'est ce qui fait qu'un prestige se sent, ou pas : s'il faut presque
 * aussi longtemps qu'avant pour revenir au même point, le joueur a perdu son temps.
 */
type Rebound = { n: number; at: number; runLength: number; target: Decimal; back: number | null };
const rebounds: Rebound[] = [];
let runStartedAt = 0;
const timeline: Array<{
  t: number; prod: Decimal; total: Decimal; ach: number; up: number;
  etoiles: number; noeuds: number; contrats: number; villes: number;
}> = [];

for (let t = 0; t < HOURS * 3600; t += STEP) {
  // Le profil idle clique au début de CHAQUE partie (après un prestige, il faut bien
  // pétrir de quoi racheter le premier apprenti), puis laisse tourner.
  const clicking = state.stats.playTimeRun < CLICK_MINUTES * 60;
  if (clicking) {
    for (let c = 0; c < CLICKS_PER_SECOND * STEP; c++) state = clickDough(state);
  }
  if (CATCH_EVENTS && state.events.pending) state = catchEvent(state).state;
  state = tick(state, STEP);
  state = spend(state);
  state = bakeChef(state, clicking);
  for (const r of rebounds) {
    if (r.back === null && r.n === recipeLayer(state).resets && state.stats.earnedRun.gte(r.target)) {
      r.back = t - r.at;
    }
  }
  if (CHEF && state.chef.bakedAt !== null) record('1re fournée du chef', t);

  if (pendingStars(state).gte(1)) record('1re Étoile (prestige possible)', t);

  if (pendingContracts(state).gte(1)) record('1er Contrat mérité', t);

  if (PRESTIGE && shouldTranscend(state)) {
    const before = expansionLayer(state).resets;
    state = doTranscend(state).state;
    state = spendContracts(state);
    record(`transcendance n°${before + 1}`, t);
    for (const city of CITIES) {
      if ((expansionLayer(state).nodes[city.id] ?? 0) > 0) record(`ville · ${city.name}`, t);
    }
  } else if (PRESTIGE && shouldPrestige(state)) {
    const before = recipeLayer(state).resets;
    rebounds.push({
      n: before + 1, at: t, runLength: t - runStartedAt, target: state.stats.earnedRun, back: null,
    });
    runStartedAt = t;
    const reference = state;
    state = doPrestige(state).state;
    const spent = spendStars(state, reference);
    state = spent.state;
    record(`prestige n°${before + 1} → ${spent.bought.join(', ') || 'rien'}`, t);
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
      contrats: expansionLayer(state).currency.toNumber(),
      villes: totalCityLevels(state),
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
  + `(${profilClics}, pizzas d'or ${CATCH_EVENTS ? 'attrapées' : 'ignorées'}, `
  + `${CHEF ? 'avec' : 'sans'} Pizza du Chef, graine ${SEED}) ===\n`);

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

console.log('\nPRESTIGES : temps pour reproduire la run brûlée');
console.log('N°   À            RUN BRÛLÉE    NIVEAU RETROUVÉ EN   RAPPORT');
console.log('─'.repeat(96));
for (const r of rebounds) {
  const ratio = r.back === null ? 'jamais' : `${Math.round((r.back / r.runLength) * 100)} %`;
  console.log(`${String(r.n).padEnd(5)}${formatTime(r.at).padEnd(13)}${formatTime(r.runLength).padEnd(14)}`
    + `${(r.back === null ? '—' : formatTime(r.back)).padEnd(21)}${ratio}`);
}

console.log('\nPROGRESSION');
console.log('TEMPS        PRODUCTION/S        CUMUL              H.FAITS  AMÉL.  ÉTOILES  NŒUDS  CONTRATS  NIV. VILLES');
console.log('─'.repeat(96));
for (const row of timeline) {
  console.log(
    `${formatTime(row.t).padEnd(13)}${format(row.prod).padEnd(20)}${format(row.total).padEnd(19)}`
    + `${String(row.ach).padEnd(9)}${String(row.up).padEnd(7)}${String(row.etoiles).padEnd(9)}`
    + `${String(row.noeuds).padEnd(7)}${String(row.contrats).padEnd(10)}${row.villes}`,
  );
}

console.log(`\nÉtat final : ${format(state.pizzas)} pizzas en stock, ${format(totalProduction(state))}/s, `
  + `${stars(state)} Étoiles en banque (${recipeLayer(state).resets} prestiges, `
  + `${Object.keys(recipeLayer(state).nodes).length}/${PRESTIGE_TREE.length} nœuds), `
  + `${achievementsOwnedCount(state)} hauts faits, ${upgradesOwnedCount(state)} améliorations, `
  + `${expansionLayer(state).resets} transcendances, ${totalCityLevels(state)} niveaux de ville.`);
console.log(`Cuisines : ${GENERATORS.map((g) => `${g.name.split(' ')[0]} ${state.generators[g.id].owned}`).join(' · ')}\n`);
