/**
 * Les défis — Phase 4.
 *
 * Un défi est une partie normale avec une CONTRAINTE et un objectif chiffré.
 * L'objectif atteint accorde une récompense PERMANENTE, valable dans toutes les
 * parties suivantes (y compris les autres défis).
 *
 * Les récompenses réutilisent volontairement le même type d'effet que l'arbre de
 * prestige : il n'existe qu'une seule fonction d'agrégation des effets permanents
 * (`permanentEffects`), donc aucun risque qu'une source soit oubliée quelque part.
 */
import { D, type Decimal } from '../engine/decimal.ts';
import type { GeneratorId } from './generators.ts';
import type { PrestigeEffect } from './prestige.ts';

/** Nombre de prestiges nécessaires avant que les défis apparaissent. */
export const CHALLENGES_UNLOCK_RESETS = 3;

/**
 * Contrainte appliquée pendant un défi. Tous les champs sont obligatoires :
 * un défi décrit explicitement son monde, il n'y a pas de valeur « implicite ».
 */
export type ChallengeRules = {
  /** Croissance du coût par exemplaire (1,15 en temps normal). */
  readonly costGrowth: number;
  /** Cuisines interdites à l'achat. */
  readonly bannedGenerators: readonly GeneratorId[];
  /** Seules les N premières cuisines sont disponibles (10 = aucune restriction). */
  readonly maxGenerators: number;
  /** Le pétrissage ne rapporte plus rien. */
  readonly clickDisabled: boolean;
  /** Aucune amélioration ne peut être achetée. */
  readonly upgradesDisabled: boolean;
  /** Multiplicateur appliqué à la production passive. */
  readonly productionFactor: number;
  /** Les paliers ×2 (25, 50, 100…) ne s'appliquent plus. */
  readonly milestonesDisabled: boolean;
  /**
   * Mise de départ offerte en entrant dans le défi.
   * Indispensable pour « Zéro clic » : sans clic ET sans pizzas, le joueur ne peut
   * jamais acheter sa première cuisine — le défi serait mathématiquement impossible.
   */
  readonly startPizzas: number;
};

/** Monde normal : c'est la base sur laquelle chaque défi écrit ses contraintes. */
export const FREE_RULES: ChallengeRules = {
  costGrowth: 1.15,
  bannedGenerators: [],
  maxGenerators: 10,
  clickDisabled: false,
  upgradesDisabled: false,
  productionFactor: 1,
  milestonesDisabled: false,
  startPizzas: 0,
};

export type ChallengeDef = {
  readonly id: string;
  readonly name: string;
  /** La contrainte, en une phrase pour le joueur. */
  readonly constraint: string;
  /** Ce que la récompense change, en une phrase. */
  readonly rewardLabel: string;
  /** Pizzas à produire PENDANT la run pour valider le défi. */
  readonly goal: Decimal;
  readonly rules: Partial<ChallengeRules>;
  readonly reward: PrestigeEffect;
};

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'inflation',
    name: 'Inflation',
    constraint: 'Chaque exemplaire coûte 30 % de plus que le précédent, au lieu de 15 %',
    rewardLabel: 'Toutes les cuisines coûtent 5 % de moins, pour toujours',
    goal: D('3e7'),
    rules: { costGrowth: 1.3 },
    reward: { type: 'generatorCost', factor: 0.95 },
  },
  {
    id: 'sans-apprenti',
    name: 'Sans apprenti',
    constraint: 'Les apprentis pizzaïolos refusent de travailler',
    rewardLabel: 'Toute la production ×1,15, pour toujours',
    goal: D('2e8'),
    rules: { bannedGenerators: ['apprenti'] },
    reward: { type: 'globalMult', factor: 1.15 },
  },
  {
    id: 'zero-clic',
    name: 'Zéro clic',
    constraint: 'Le pétrissage ne rapporte plus rien (1 000 pizzas offertes pour démarrer)',
    rewardLabel: 'Un pétrisseur automatique gratuit (1 clic par seconde)',
    goal: D('2e7'),
    rules: { clickDisabled: true, startPizzas: 1000 },
    reward: { type: 'autoClick', perSecond: 1 },
  },
  {
    id: 'petit-joueur',
    name: 'Petit joueur',
    constraint: 'Seules les cinq premières cuisines sont disponibles',
    rewardLabel: 'Toute la production ×1,2, pour toujours',
    goal: D('5e8'),
    rules: { maxGenerators: 5 },
    reward: { type: 'globalMult', factor: 1.2 },
  },
  {
    id: 'bricolage',
    name: 'Bricolage',
    constraint: 'Aucune amélioration ne peut être achetée',
    rewardLabel: 'Les améliorations coûtent 20 % de moins, pour toujours',
    goal: D('3e7'),
    rules: { upgradesDisabled: true },
    reward: { type: 'upgradeCost', factor: 0.8 },
  },
  {
    id: 'sans-livraison',
    name: 'Sans livraison',
    constraint: 'Scooters, camions et drones restent au garage',
    rewardLabel: 'Les pizzas d’or arrivent 15 % plus vite, pour toujours',
    goal: D('3e8'),
    rules: { bannedGenerators: ['scooter', 'camion', 'drone'] },
    reward: { type: 'eventFrequency', factor: 0.85 },
  },
  {
    id: 'cuisine-froide',
    name: 'Cuisine froide',
    constraint: 'Les cuisines tournent cinq fois moins vite : tout repose sur tes mains',
    rewardLabel: 'Le pétrissage rapporte 5 fois plus, pour toujours',
    goal: D('2e6'),
    rules: { productionFactor: 0.2 },
    reward: { type: 'clickMult', factor: 5 },
  },
  {
    id: 'pate-pure',
    name: 'Pâte pure',
    constraint: 'Les paliers de production (×2 à 25, 50, 100…) ne s’appliquent plus',
    rewardLabel: 'Toute la production ×1,3, pour toujours',
    goal: D('4e8'),
    rules: { milestonesDisabled: true },
    reward: { type: 'globalMult', factor: 1.3 },
  },
];

export const CHALLENGES_BY_ID: Readonly<Record<string, ChallengeDef>> = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c]),
);
