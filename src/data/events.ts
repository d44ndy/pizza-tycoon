/**
 * Les « pizzas d'or » : un élément cliquable apparaît régulièrement à l'écran.
 *
 * Règle de conception : le joueur n'est JAMAIS pénalisé s'il ne clique pas.
 * Le contrôle d'hygiène (le seul effet négatif) ne s'applique donc que si le joueur
 * clique dessus — il est visuellement distinct, c'est un piège assumé, pas une punition.
 */
export type EventKind = 'bonus' | 'frenzy' | 'jackpot' | 'malus';

export type EventDef = {
  readonly kind: EventKind;
  readonly name: string;
  readonly description: string;
  /** Poids de tirage (relatif à la somme des poids). */
  readonly weight: number;
  /** Multiplicateur appliqué pendant `duration` secondes (1 = aucun). */
  readonly multiplier: number;
  readonly duration: number;
  readonly negative: boolean;
};

export const EVENTS: readonly EventDef[] = [
  {
    kind: 'bonus', name: 'Livraison de mozzarella', description: 'Production ×7 pendant 77 secondes',
    weight: 40, multiplier: 7, duration: 77, negative: false,
  },
  {
    kind: 'frenzy', name: 'Coup de feu', description: 'Pétrissage ×777 pendant 13 secondes',
    weight: 25, multiplier: 777, duration: 13, negative: false,
  },
  {
    kind: 'jackpot', name: 'Pourboire du siècle', description: 'Gain immédiat : 15 minutes de production',
    weight: 25, multiplier: 1, duration: 0, negative: false,
  },
  {
    kind: 'malus', name: "Contrôle d'hygiène", description: 'Production ÷2 pendant 30 secondes',
    weight: 10, multiplier: 0.5, duration: 30, negative: true,
  },
];

export const EVENTS_BY_KIND: Readonly<Record<EventKind, EventDef>> = Object.fromEntries(
  EVENTS.map((e) => [e.kind, e]),
) as Record<EventKind, EventDef>;

/** Délai aléatoire entre deux apparitions, et durée de présence à l'écran. */
export const EVENT_MIN_DELAY = 120;
export const EVENT_MAX_DELAY = 300;
export const EVENT_LIFETIME = 12;

/** Le pourboire vaut 15 minutes de production, plafonné à 15 % du stock. */
export const JACKPOT_SECONDS = 15 * 60;
export const JACKPOT_STOCK_RATIO = 0.15;
