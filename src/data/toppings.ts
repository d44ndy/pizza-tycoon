/**
 * Les neuf ingrédients de « La Pizza du Chef ».
 *
 * Le mini-jeu tient dans une règle : huit parts en cercle, chaque ingrédient a une
 * valeur de base et influence ses VOISINES (i ± 1) ou la part D'EN FACE (i + 4).
 * Les influences s'ADDITIONNENT (`valeur = base × (1 + Σ modificateurs)`) : c'est la
 * seule façon d'éviter qu'une combinaison s'emballe par multiplication.
 *
 * Ces valeurs ne sont pas choisies au doigt mouillé. Les trois versions successives
 * des règles ont été évaluées sur les **43 046 721 garnitures possibles** (9^8) avant
 * d'entrer dans le jeu : les deux premières avaient un optimum unique qui écrasait
 * tout (la pizza à l'ananas, puis l'alternance piment/champignon). Celle-ci a trois
 * championnes distinctes, une par statistique — voir CLAUDE.md.
 */
import type { GeneratorId } from './generators.ts';

export type ToppingId =
  | 'tomate' | 'basilic' | 'mozzarella' | 'champignon' | 'piment'
  | 'olive' | 'oignon' | 'jambon' | 'ananas';

/** Ce qu'une part rapporte : production, pétrissage, ou fréquence des pizzas d'or. */
export type ToppingStat = 'prod' | 'click' | 'gold';

export type ToppingDef = {
  readonly id: ToppingId;
  readonly name: string;
  /** `null` pour l'oignon, qui n'a pas de statistique propre : il copie celle d'en face. */
  readonly stat: ToppingStat | null;
  /** Règle affichée au joueur, mot pour mot ce que calcule `evaluatePizza()`. */
  readonly rule: string;
  /** Cuisine qui fait découvrir l'ingrédient (une fois découvert, il l'est pour toujours). */
  readonly unlockedBy: GeneratorId;
};

export const TOPPINGS: readonly ToppingDef[] = [
  {
    id: 'tomate', name: 'Tomate', stat: 'prod', unlockedBy: 'pizzeria',
    rule: 'Production 6. +100 % par Basilic voisin.',
  },
  {
    id: 'basilic', name: 'Basilic', stat: 'prod', unlockedBy: 'pizzeria',
    rule: 'Production 2. Double les Tomates voisines.',
  },
  {
    id: 'mozzarella', name: 'Mozzarella', stat: 'prod', unlockedBy: 'pizzeria',
    rule: 'Production 3, +3 par Mozzarella ou Tomate voisine.',
  },
  {
    id: 'champignon', name: 'Champignon', stat: 'click', unlockedBy: 'franchise',
    rule: 'Pétrissage 8, +8 par Oignon voisin.',
  },
  {
    id: 'piment', name: 'Piment', stat: 'click', unlockedBy: 'franchise',
    rule: 'Pétrissage 14. Voisines −50 %, part d’en face +50 % (sauf un piment).',
  },
  {
    id: 'olive', name: 'Olive', stat: 'gold', unlockedBy: 'usine',
    rule: 'Pizzas d’or 6, +6 si ses deux voisines sont différentes.',
  },
  {
    id: 'oignon', name: 'Oignon', stat: null, unlockedBy: 'usine',
    rule: 'Copie la valeur de base de la part d’en face.',
  },
  {
    id: 'jambon', name: 'Jambon', stat: 'prod', unlockedBy: 'robot',
    rule: 'Production 6.',
  },
  {
    id: 'ananas', name: 'Ananas', stat: 'gold', unlockedBy: 'robot',
    rule: 'Pizzas d’or 6. Voisines −50 %… sauf le Jambon : +100 %.',
  },
];

export const TOPPINGS_BY_ID: Record<ToppingId, ToppingDef> = Object.fromEntries(
  TOPPINGS.map((def) => [def.id, def]),
) as Record<ToppingId, ToppingDef>;

/** Le four s'ouvre avec la Pizzeria de quartier : avant, le joueur n'a pas de cuisine à lui. */
export const CHEF_UNLOCK_GENERATOR: GeneratorId = 'pizzeria';
