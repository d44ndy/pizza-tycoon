/**
 * Les 10 générateurs de « Pizza Tycoon », du garage à l'orbite.
 * `baseCost` = coût du tout premier exemplaire, `baseProduction` = pizzas/s par exemplaire.
 *
 * Table ajustée au simulateur (`npm run sim`). Les valeurs d'origine (celles de
 * Cookie Clicker) faisaient payer 14 à 16 fois le prix de la cuisine précédente pour
 * seulement 5,6 fois sa production : les quatre dernières cuisines devenaient
 * inatteignables dans une première partie. Le rapport est désormais d'environ
 * 10 pour 6,5 sur le haut de la table.
 */
import { D, type Decimal } from '../engine/decimal.ts';

export type GeneratorId =
  | 'apprenti' | 'four' | 'scooter' | 'camion' | 'pizzeria'
  | 'franchise' | 'usine' | 'robot' | 'drone' | 'plasma';

export type GeneratorDef = {
  readonly id: GeneratorId;
  readonly index: number;
  readonly name: string;
  readonly emoji: string;
  readonly description: string;
  readonly baseCost: Decimal;
  readonly baseProduction: Decimal;
};

export const GENERATORS: readonly GeneratorDef[] = [
  {
    id: 'apprenti', index: 0, name: 'Apprenti pizzaïolo', emoji: '🙋',
    description: "Il pétrit lentement, mais il pétrit avec le cœur.",
    baseCost: D(15), baseProduction: D(0.1),
  },
  {
    id: 'four', index: 1, name: 'Four à bois', emoji: '🔥',
    description: "Trois minutes à 450 °C. Le secret, c'est la braise.",
    baseCost: D(100), baseProduction: D(1),
  },
  {
    id: 'scooter', index: 2, name: 'Scooter de livraison', emoji: '🛵',
    description: "Livrée chaude, ou presque. Surtout presque.",
    baseCost: D(1100), baseProduction: D(8),
  },
  {
    id: 'camion', index: 3, name: 'Camion pizza', emoji: '🚚',
    description: "La pizzeria vient au client. Génie.",
    baseCost: D(12000), baseProduction: D(55),
  },
  {
    id: 'pizzeria', index: 4, name: 'Pizzeria de quartier', emoji: '🏪',
    description: "Nappe à carreaux, bougie dans la bouteille, tradition.",
    baseCost: D(130000), baseProduction: D(320),
  },
  {
    id: 'franchise', index: 5, name: 'Franchise', emoji: '🏢',
    description: "Le même goût partout. C'est ça, la modernité.",
    baseCost: D(1.4e6), baseProduction: D(1900),
  },
  {
    id: 'usine', index: 6, name: 'Usine à pâte', emoji: '🏭',
    description: "Douze tonnes de farine à l'heure. Portez un masque.",
    baseCost: D(14e6), baseProduction: D(12000),
  },
  {
    id: 'robot', index: 7, name: 'Robot pizzaïolo', emoji: '🤖',
    description: "Il ne dort jamais et ne se plaint jamais de l'ananas.",
    baseCost: D(130e6), baseProduction: D(78000),
  },
  {
    id: 'drone', index: 8, name: 'Drone-livreur orbital', emoji: '🛰️',
    description: "Livraison en 30 minutes, n'importe où sur la planète.",
    baseCost: D(1.3e9), baseProduction: D(520000),
  },
  {
    id: 'plasma', index: 9, name: 'Four à plasma orbital', emoji: '☀️',
    description: "Cuisson en 0,004 seconde. Croûte parfaite garantie.",
    baseCost: D(13e9), baseProduction: D(3.4e6),
  },
] as const;

/** Accès rapide par identifiant. */
export const GENERATORS_BY_ID: Readonly<Record<GeneratorId, GeneratorDef>> = Object.fromEntries(
  GENERATORS.map((g) => [g.id, g]),
) as Record<GeneratorId, GeneratorDef>;
