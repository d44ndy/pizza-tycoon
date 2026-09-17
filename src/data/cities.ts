/**
 * Prestige couche 2 — « Expansion Mondiale ».
 *
 * La transcendance ne donne pas seulement des multiplicateurs : elle ouvre des VILLES.
 * Une ville produit en parallèle de tes cuisines et, surtout, **elle ne repart jamais
 * de zéro** — ni au prestige, ni en entrant dans un défi. C'est le plancher qui rend
 * chaque nouvelle partie plus rapide que la précédente.
 */
import { D, type Decimal } from '../engine/decimal.ts';

/**
 * Contrats gagnés = racine cubique du cumul de pizzas de toute la partie, divisé par ceci.
 *
 * Valeur choisie après mesure : avec 1e15, la première transcendance ne rapportait
 * qu'UN Contrat en échange de deux jours de jeu — personne n'accepterait ce marché.
 * À 2e12, le premier grand saut en rapporte une poignée, de quoi ouvrir deux villes.
 */
export const CONTRACT_DIVISOR = 2e12;

/** Cumul de pizzas (toutes runs) à partir duquel l'onglet Expansion se dévoile. */
export const EXPANSION_REVEAL = D('5e11');

export type CityId = 'naples' | 'chicago' | 'tokyo' | 'paris' | 'saopaulo' | 'orbite';

/** Effet passif d'une ville, proportionnel à son niveau. */
export type CityEffect =
  /** +X % de production sur les cuisines, par niveau. */
  | { readonly type: 'kitchenBoost'; readonly percent: number }
  /** Le pétrissage est multiplié par X, par niveau. */
  | { readonly type: 'clickBoost'; readonly factor: number }
  /** Les cuisines coûtent X % de moins, par niveau (plafonné). */
  | { readonly type: 'cheaperKitchens'; readonly percent: number }
  /** Les pizzas d'or arrivent X % plus vite, par niveau (plafonné). */
  | { readonly type: 'fasterEvents'; readonly percent: number }
  /** +X points de rendement hors ligne, par niveau (plafonné à 100 %). */
  | { readonly type: 'offlineBoost'; readonly percent: number }
  /** +X % de production sur TOUTES les villes, par niveau. */
  | { readonly type: 'cityBoost'; readonly percent: number };

export type CityDef = {
  readonly id: CityId;
  readonly name: string;
  readonly description: string;
  /** Contrats nécessaires pour fonder la ville. */
  readonly foundCost: number;
  /** Contrats du premier niveau ; chaque niveau coûte `levelCost × niveau`. */
  readonly levelCost: number;
  /** Pizzas par seconde et par niveau, avant multiplicateurs. */
  readonly baseProduction: Decimal;
  readonly effect: CityEffect;
};

export const CITIES: readonly CityDef[] = [
  {
    id: 'naples',
    name: 'Naples',
    description: 'La ville mère. On y sait ce qu’est une vraie pâte.',
    foundCost: 1,
    levelCost: 1,
    baseProduction: D(2e4),
    effect: { type: 'kitchenBoost', percent: 5 },
  },
  {
    id: 'chicago',
    name: 'Chicago',
    description: 'Deep dish, gros bras, portions déraisonnables.',
    foundCost: 3,
    levelCost: 2,
    baseProduction: D(1e5),
    effect: { type: 'clickBoost', factor: 1.5 },
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    description: 'Logistique au millimètre : tout coûte moins cher.',
    foundCost: 8,
    levelCost: 4,
    baseProduction: D(6e5),
    effect: { type: 'cheaperKitchens', percent: 3 },
  },
  {
    id: 'paris',
    name: 'Paris',
    description: 'On y fait la queue pour être vu en train de faire la queue.',
    foundCost: 20,
    levelCost: 9,
    baseProduction: D(4e6),
    effect: { type: 'fasterEvents', percent: 8 },
  },
  {
    id: 'saopaulo',
    name: 'São Paulo',
    description: 'La ville ne dort jamais, tes fours non plus.',
    foundCost: 50,
    levelCost: 22,
    baseProduction: D(3e7),
    effect: { type: 'offlineBoost', percent: 6 },
  },
  {
    id: 'orbite',
    name: 'Station orbitale',
    description: 'Techniquement pas une ville. Techniquement, on s’en moque.',
    foundCost: 120,
    levelCost: 55,
    baseProduction: D(2e8),
    effect: { type: 'cityBoost', percent: 20 },
  },
];

export const CITIES_BY_ID: Readonly<Record<CityId, CityDef>> = Object.fromEntries(
  CITIES.map((c) => [c.id, c]),
) as Record<CityId, CityDef>;

/** Plafonds des effets qui, sans garde-fou, finiraient par tout casser. */
export const CITY_CAPS = {
  /** Réduction de coût maximale cumulée (0,4 = 60 % de réduction). */
  cheaperKitchens: 0.4,
  /** Délai minimal entre deux pizzas d'or (0,35 = trois fois plus fréquentes). */
  fasterEvents: 0.35,
  /** Rendement hors ligne maximal. */
  offlineEfficiency: 1,
} as const;
