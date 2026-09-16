/**
 * Les hauts faits. Chacun accorde +1 % de production globale (multiplicatif),
 * ils sont donc une vraie mécanique de progression et pas seulement une collection.
 *
 * Comme les améliorations, ce sont des DONNÉES : une condition interprétée par
 * `engine/achievements.ts`, donc rejouable par le simulateur.
 */
import type { GeneratorId } from './generators.ts';
import { GENERATORS } from './generators.ts';

/** Faits marquants que le moteur (ou l'interface) signale explicitement. */
export type FlagId =
  | 'coldPizza'     // revenu après une longue absence
  | 'nightOwl'      // joué entre 3 h et 4 h du matin
  | 'clickBurst'    // 100 clics en 10 secondes
  | 'malusClicked'  // a cliqué sur un contrôle d'hygiène
  | 'jackpot'       // a encaissé un pourboire du siècle
  | 'frenzyBuy'     // a acheté une cuisine pendant une frénésie
  | 'pineapple';    // a insisté sur le sujet qui fâche

export type AchievementCondition =
  | { readonly type: 'pizzas'; readonly amount: string }
  | { readonly type: 'earnedTotal'; readonly amount: string }
  | { readonly type: 'production'; readonly amount: string }
  | { readonly type: 'handmadeTotal'; readonly amount: string }
  | { readonly type: 'generatorOwned'; readonly id: GeneratorId; readonly count: number }
  | { readonly type: 'generatorExactly'; readonly id: GeneratorId; readonly count: number }
  | { readonly type: 'allGenerators'; readonly count: number }
  | { readonly type: 'clicksTotal'; readonly count: number }
  | { readonly type: 'upgradesOwned'; readonly count: number }
  | { readonly type: 'eventsClicked'; readonly count: number }
  | { readonly type: 'achievementsOwned'; readonly count: number }
  | { readonly type: 'flag'; readonly flag: FlagId };

export type AchievementCategory =
  | 'production' | 'cuisines' | 'clics' | 'ameliorations' | 'evenements' | 'collection' | 'secret';

export type AchievementDef = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: AchievementCategory;
  /** Affiché « ??? » tant qu'il n'est pas obtenu. */
  readonly hidden: boolean;
  readonly condition: AchievementCondition;
};

/** Petite fabrique pour les séries de paliers. */
function tiers(
  prefix: string,
  category: AchievementCategory,
  entries: ReadonlyArray<readonly [string, string, AchievementCondition]>,
): AchievementDef[] {
  return entries.map(([name, description, condition], i) => ({
    id: `${prefix}-${i + 1}`, name, description, category, hidden: false, condition,
  }));
}

const STOCK = tiers('stock', 'production', [
  ['Première fournée', 'Avoir 1 000 pizzas en stock', { type: 'pizzas', amount: '1e3' }],
  ['Le carton se remplit', 'Avoir 1 million de pizzas en stock', { type: 'pizzas', amount: '1e6' }],
  ['Stock stratégique', 'Avoir 1 milliard de pizzas en stock', { type: 'pizzas', amount: '1e9' }],
  ['Réserve nationale', 'Avoir 1 000 milliards de pizzas en stock', { type: 'pizzas', amount: '1e12' }],
  ['Entrepôt orbital', 'Avoir 1e15 pizzas en stock', { type: 'pizzas', amount: '1e15' }],
  ['Continent de mozzarella', 'Avoir 1e18 pizzas en stock', { type: 'pizzas', amount: '1e18' }],
  ['Nuage de Oort garni', 'Avoir 1e24 pizzas en stock', { type: 'pizzas', amount: '1e24' }],
  ['Pizza noire supermassive', 'Avoir 1e30 pizzas en stock', { type: 'pizzas', amount: '1e30' }],
]);

const CUMUL = tiers('cumul', 'production', [
  ["Chiffre d'affaires", 'Produire 10 000 pizzas en tout', { type: 'earnedTotal', amount: '1e4' }],
  ['Bilan positif', 'Produire 10 millions de pizzas en tout', { type: 'earnedTotal', amount: '1e7' }],
  ['Empire naissant', 'Produire 1e10 pizzas en tout', { type: 'earnedTotal', amount: '1e10' }],
  ['Multinationale', 'Produire 1e14 pizzas en tout', { type: 'earnedTotal', amount: '1e14' }],
  ['Monopole galactique', 'Produire 1e20 pizzas en tout', { type: 'earnedTotal', amount: '1e20' }],
  ['Unité de compte universelle', 'Produire 1e28 pizzas en tout', { type: 'earnedTotal', amount: '1e28' }],
]);

const DEBIT = tiers('debit', 'production', [
  ['Ça tourne', 'Produire 10 pizzas par seconde', { type: 'production', amount: '10' }],
  ['Cadence industrielle', 'Produire 1 000 pizzas par seconde', { type: 'production', amount: '1e3' }],
  ['Chaîne ininterrompue', 'Produire 100 000 pizzas par seconde', { type: 'production', amount: '1e5' }],
  ['Débit continental', 'Produire 1e8 pizzas par seconde', { type: 'production', amount: '1e8' }],
  ['Flux stellaire', 'Produire 1e12 pizzas par seconde', { type: 'production', amount: '1e12' }],
  ['Singularité fromagère', 'Produire 1e18 pizzas par seconde', { type: 'production', amount: '1e18' }],
]);

/** Trois paliers par cuisine : le premier exemplaire, 50, puis 150. */
const CUISINE_NAMES: Record<GeneratorId, readonly [string, string, string]> = {
  apprenti: ['Bienvenue, petit', 'Brigade complète', 'Usine à apprentis'],
  four: ['Ça chauffe', 'Rangée de fours', 'Mur de flammes'],
  scooter: ['Livraison lancée', 'Nuée de scooters', 'Embouteillage de deux-roues'],
  camion: ['Sur la route', 'Flotte en marche', 'Convoi exceptionnel'],
  pizzeria: ['Pas-de-porte', 'Quartier conquis', 'Ville conquise'],
  franchise: ['Premier franchisé', 'Réseau national', 'Réseau mondial'],
  usine: ['Production de masse', 'Complexe industriel', 'Zone industrielle'],
  robot: ['Bip bip pizza', 'Atelier robotisé', 'Armée de robots'],
  drone: ['Livraison aérienne', 'Essaim en orbite', 'Ciel saturé'],
  plasma: ['Cuisson stellaire', 'Constellation de fours', 'Ceinture de fours'],
};

const CUISINE_TIERS = [1, 50, 150] as const;

function cuisineAchievements(): AchievementDef[] {
  const list: AchievementDef[] = [];
  for (const def of GENERATORS) {
    CUISINE_TIERS.forEach((count, i) => {
      list.push({
        id: `cuisine-${def.id}-${i + 1}`,
        name: CUISINE_NAMES[def.id][i]!,
        description: `Posséder ${count} ${def.name}${count > 1 ? 's' : ''}`,
        category: 'cuisines',
        hidden: false,
        condition: { type: 'generatorOwned', id: def.id, count },
      });
    });
  }
  return list;
}

const CLICS = tiers('clic', 'clics', [
  ['Ça commence', 'Pétrir 100 fois', { type: 'clicksTotal', count: 100 }],
  ['Poignet qui chauffe', 'Pétrir 500 fois', { type: 'clicksTotal', count: 500 }],
  ['Pétrisseur confirmé', 'Pétrir 2 000 fois', { type: 'clicksTotal', count: 2000 }],
  ['Main de fer', 'Pétrir 5 000 fois', { type: 'clicksTotal', count: 5000 }],
  ['Tendinite du pizzaïolo', 'Pétrir 10 000 fois', { type: 'clicksTotal', count: 10000 }],
  ["Ce n'est plus un jeu", 'Pétrir 25 000 fois', { type: 'clicksTotal', count: 25000 }],
]);

const MAIN = tiers('main', 'clics', [
  ['Fait maison', 'Pétrir 1 000 pizzas à la main', { type: 'handmadeTotal', amount: '1e3' }],
  ['Artisanat de masse', 'Pétrir 1 million de pizzas à la main', { type: 'handmadeTotal', amount: '1e6' }],
  ['Tout à la main', 'Pétrir 1 milliard de pizzas à la main', { type: 'handmadeTotal', amount: '1e9' }],
]);

const AMELIORATIONS = tiers('amelio', 'ameliorations', [
  ['Premiers investissements', 'Acheter 5 améliorations', { type: 'upgradesOwned', count: 5 }],
  ['Bon gestionnaire', 'Acheter 15 améliorations', { type: 'upgradesOwned', count: 15 }],
  ['Optimiseur', 'Acheter 30 améliorations', { type: 'upgradesOwned', count: 30 }],
  ['Rien ne se perd', 'Acheter 50 améliorations', { type: 'upgradesOwned', count: 50 }],
  ['Catalogue complet', 'Acheter 68 améliorations', { type: 'upgradesOwned', count: 68 }],
]);

const EVENEMENTS = tiers('event', 'evenements', [
  ['Coup de chance', "Attraper une pizza d'or", { type: 'eventsClicked', count: 1 }],
  ['Habitué', "Attraper 10 pizzas d'or", { type: 'eventsClicked', count: 10 }],
  ["Chasseur de pizzas d'or", "Attraper 50 pizzas d'or", { type: 'eventsClicked', count: 50 }],
  ['Radar à pizzas', "Attraper 150 pizzas d'or", { type: 'eventsClicked', count: 150 }],
]);

const PANOPLIE = tiers('panoplie', 'cuisines', [
  ['Panoplie complète', 'Posséder au moins une cuisine de chaque type', { type: 'allGenerators', count: 1 }],
  ['Vingt-cinq partout', 'Posséder 25 cuisines de chaque type', { type: 'allGenerators', count: 25 }],
  ['Centurion', 'Posséder 100 cuisines de chaque type', { type: 'allGenerators', count: 100 }],
]);

const COLLECTION = tiers('collection', 'collection', [
  ['Vitrine à trophées', 'Débloquer 25 hauts faits', { type: 'achievementsOwned', count: 25 }],
  ['Collectionneur', 'Débloquer 50 hauts faits', { type: 'achievementsOwned', count: 50 }],
  ['Mur de tampons', 'Débloquer 75 hauts faits', { type: 'achievementsOwned', count: 75 }],
]);

/** Les cachés : affichés « ??? » tant qu'ils ne sont pas obtenus. */
const SECRETS: readonly AchievementDef[] = [
  {
    id: 'secret-froide', name: 'Pizza froide', description: 'Revenir après plus de 8 heures d\'absence',
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'coldPizza' },
  },
  {
    id: 'secret-nuit', name: '3 h du matin', description: 'Jouer entre 3 h et 4 h du matin',
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'nightOwl' },
  },
  {
    id: 'secret-crampe', name: 'Crampe', description: 'Pétrir 100 fois en 10 secondes',
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'clickBurst' },
  },
  {
    id: 'secret-brule', name: 'Ça sentait le brûlé', description: "Cliquer sur un contrôle d'hygiène",
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'malusClicked' },
  },
  {
    id: 'secret-pourboire', name: 'Le gros pourboire', description: 'Encaisser un pourboire du siècle',
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'jackpot' },
  },
  {
    id: 'secret-frenesie', name: "Tant qu'à faire", description: 'Acheter une cuisine pendant une frénésie',
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'frenzyBuy' },
  },
  {
    id: 'secret-42', name: 'La réponse', description: 'Posséder exactement 42 fours à bois',
    category: 'secret', hidden: true, condition: { type: 'generatorExactly', id: 'four', count: 42 },
  },
  {
    id: 'secret-ananas', name: 'Ananas ? Vraiment ?', description: 'Insister sur le sujet qui fâche',
    category: 'secret', hidden: true, condition: { type: 'flag', flag: 'pineapple' },
  },
];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ...STOCK, ...CUMUL, ...DEBIT,
  ...cuisineAchievements(), ...PANOPLIE,
  ...CLICS, ...MAIN,
  ...AMELIORATIONS, ...EVENEMENTS, ...COLLECTION,
  ...SECRETS,
];

export const ACHIEVEMENTS_BY_ID: Readonly<Record<string, AchievementDef>> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Bonus de production accordé par haut fait (multiplicatif). */
export const ACHIEVEMENT_BONUS = 0.01;
