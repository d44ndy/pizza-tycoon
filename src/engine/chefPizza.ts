/**
 * « La Pizza du Chef » : le puzzle de garniture et ses effets sur la partie.
 *
 * Module PUR, comme le reste de `engine/` : il ne connaît ni React, ni l'horloge
 * système. Le seul temps qu'il regarde est `stats.playTimeTotal` (secondes de jeu),
 * pour que le simulateur puisse le rejouer.
 *
 * Deux garnitures coexistent volontairement :
 *   - `draft`  : celle que le joueur manipule, sans conséquence ;
 *   - `baked`  : celle qui est au four, et la SEULE qui donne des bonus.
 * On peut donc essayer cent combinaisons sans jamais perdre ce qu'on avait.
 */
import type { GameState } from './state.ts';
import { TOPPINGS, TOPPINGS_BY_ID, type ToppingId, type ToppingStat } from '../data/toppings.ts';
import { CHEF_BAKE_COOLDOWN, CHEF_GOLD_CAP, CHEF_PERCENT_PER_POINT, CHEF_SLICES } from '../data/config.ts';

/** Une garniture : une case par part, `null` pour une part nue. */
export type Layout = readonly (ToppingId | null)[];

/** Une influence reçue par une part : d'où elle vient, et combien elle pèse. */
export type SliceMod = {
  /** Index de la part responsable. */
  readonly from: number;
  readonly topping: ToppingId;
  /** 0,5 = +50 %, −0,5 = −50 %. */
  readonly amount: number;
};

export type SliceEval = {
  /** Valeur avant influence des autres parts. */
  base: number;
  /** Somme des modificateurs (0,5 = +50 %). */
  bonus: number;
  /** Valeur finale : `base × max(0, 1 + bonus)`. */
  value: number;
  /** Statistique alimentée (celle d'en face pour un oignon). */
  stat: ToppingStat | null;
  /** Pour un oignon : l'ingrédient d'en face qu'il recopie. */
  copyOf: ToppingId | null;
  /** Détail des influences reçues, pour que l'interface puisse expliquer le calcul. */
  mods: readonly SliceMod[];
};

export type PizzaTotals = Record<ToppingStat, number>;

export type PizzaEval = {
  slices: readonly SliceEval[];
  totals: PizzaTotals;
};

/** Garniture vide (huit parts nues). */
export function emptyLayout(): (ToppingId | null)[] {
  return Array.from({ length: CHEF_SLICES }, () => null);
}

/** Les deux parts voisines. */
export function neighbours(i: number): [number, number] {
  return [(i + CHEF_SLICES - 1) % CHEF_SLICES, (i + 1) % CHEF_SLICES];
}

/** La part diamétralement opposée. */
export function opposite(i: number): number {
  return (i + CHEF_SLICES / 2) % CHEF_SLICES;
}

/**
 * Évalue une garniture. Trois passes, dans cet ordre exact :
 *   1. valeur de base de chaque part (qui peut déjà dépendre des voisines) ;
 *   2. l'oignon copie la valeur DE BASE d'en face (jamais une valeur déjà boostée,
 *      sinon deux oignons face à face se renverraient la balle) ;
 *   3. les modificateurs, qui s'additionnent avant d'être appliqués.
 */
export function evaluatePizza(layout: Layout): PizzaEval {
  const base = new Array<number>(CHEF_SLICES).fill(0);
  const bonus = new Array<number>(CHEF_SLICES).fill(0);
  const stat = new Array<ToppingStat | null>(CHEF_SLICES).fill(null);
  const copyOf = new Array<ToppingId | null>(CHEF_SLICES).fill(null);
  const mods: SliceMod[][] = Array.from({ length: CHEF_SLICES }, () => []);

  // 1. Valeurs de base.
  for (let i = 0; i < CHEF_SLICES; i++) {
    const id = layout[i] ?? null;
    if (!id) continue;
    const [left, right] = neighbours(i);
    const count = (target: ToppingId) =>
      (layout[left] === target ? 1 : 0) + (layout[right] === target ? 1 : 0);

    stat[i] = TOPPINGS_BY_ID[id].stat;
    switch (id) {
      case 'tomate': base[i] = 6; break;
      case 'basilic': base[i] = 2; break;
      case 'mozzarella': base[i] = 3 + 3 * count('mozzarella') + 3 * count('tomate'); break;
      case 'champignon': base[i] = 8 + 8 * count('oignon'); break;
      case 'piment': base[i] = 14; break;
      // L'olive n'aime pas la monotonie : il lui faut deux voisines différentes.
      case 'olive': base[i] = 6 + (layout[left] !== layout[right] ? 6 : 0); break;
      case 'jambon': base[i] = 6; break;
      case 'ananas': base[i] = 6; break;
      case 'oignon': base[i] = 0; break;
    }
  }

  // 2. L'oignon, caméléon : il prend la base ET la statistique de la part d'en face.
  for (let i = 0; i < CHEF_SLICES; i++) {
    if (layout[i] !== 'oignon') continue;
    const o = opposite(i);
    const facing = layout[o] ?? null;
    if (!facing || facing === 'oignon') continue;
    base[i] = base[o]!;
    stat[i] = stat[o]!;
    copyOf[i] = facing;
  }

  // 3. Modificateurs. Ils s'ajoutent entre eux : jamais de produit, jamais d'emballement.
  for (let i = 0; i < CHEF_SLICES; i++) {
    const id = layout[i] ?? null;
    if (!id) continue;
    const [left, right] = neighbours(i);
    const apply = (j: number, amount: number) => {
      bonus[j]! += amount;
      mods[j]!.push({ from: i, topping: id, amount });
    };
    if (id === 'basilic') {
      for (const j of [left, right]) if (layout[j] === 'tomate') apply(j, 1);
    }
    if (id === 'piment') {
      for (const j of [left, right]) apply(j, -0.5);
      // Le piment ne pimente pas le piment : sans cette exception, une alternance
      // de piments devenait la seule garniture à jouer.
      if (layout[opposite(i)] !== 'piment') apply(opposite(i), 0.5);
    }
    if (id === 'ananas') {
      for (const j of [left, right]) apply(j, layout[j] === 'jambon' ? 1 : -0.5);
    }
  }

  const totals: PizzaTotals = { prod: 0, click: 0, gold: 0 };
  const slices: SliceEval[] = [];
  for (let i = 0; i < CHEF_SLICES; i++) {
    const value = base[i]! * Math.max(0, 1 + bonus[i]!);
    slices.push({
      base: base[i]!, bonus: bonus[i]!, value, stat: stat[i]!,
      copyOf: copyOf[i]!, mods: mods[i]!,
    });
    if (stat[i]) totals[stat[i]!] += value;
  }
  return { slices, totals };
}

/* ------------------------------------------------------------------ */
/* Effets sur la partie                                                */
/* ------------------------------------------------------------------ */

export type ChefEffects = {
  /** Multiplicateur de production (1 = aucune pizza au four). */
  production: number;
  /** Multiplicateur de pétrissage. */
  click: number;
  /** Multiplicateur du délai entre deux pizzas d'or (< 1 = plus fréquentes). */
  eventFrequency: number;
  totals: PizzaTotals;
};

export const NO_CHEF_EFFECTS: ChefEffects = {
  production: 1,
  click: 1,
  eventFrequency: 1,
  totals: { prod: 0, click: 0, gold: 0 },
};

/** Conversion des totaux en effets : 1 point = 1 % (la moitié pour les pizzas d'or). */
export function effectsFromTotals(totals: PizzaTotals): ChefEffects {
  const goldPercent = Math.min(CHEF_GOLD_CAP, totals.gold / 2);
  return {
    production: 1 + (totals.prod * CHEF_PERCENT_PER_POINT) / 100,
    click: 1 + (totals.click * CHEF_PERCENT_PER_POINT) / 100,
    eventFrequency: 1 - goldPercent / 100,
    totals,
  };
}

/** Effets de la garniture actuellement AU FOUR (celle en cours d'édition ne compte pas). */
export function chefEffects(state: GameState): ChefEffects {
  const baked = state.chef.baked;
  if (!baked) return NO_CHEF_EFFECTS;
  return effectsFromTotals(evaluatePizza(baked).totals);
}

/* ------------------------------------------------------------------ */
/* Four : disponibilité et cuisson                                     */
/* ------------------------------------------------------------------ */

/** Le four s'ouvre avec la Pizzeria de quartier et ne se referme jamais. */
export function chefUnlocked(state: GameState): boolean {
  return state.chef.unlocked.length > 0;
}

/** Secondes de jeu restantes avant de pouvoir enfourner (0 = le four est prêt). */
export function bakeCooldown(state: GameState): number {
  if (state.chef.bakedAt === null) return 0;
  const elapsed = state.stats.playTimeTotal - state.chef.bakedAt;
  return Math.max(0, CHEF_BAKE_COOLDOWN - elapsed);
}

export function canBake(state: GameState): boolean {
  if (!chefUnlocked(state) || bakeCooldown(state) > 0) return false;
  // Une pizza nue n'a rien à faire au four ; une garniture identique non plus.
  if (state.chef.draft.every((slice) => slice === null)) return false;
  return !sameLayout(state.chef.draft, state.chef.baked);
}

function sameLayout(a: Layout, b: Layout | null): boolean {
  if (!b) return false;
  return a.every((slice, i) => slice === (b[i] ?? null));
}

/** Pose (ou retire, avec `null`) un ingrédient sur une part de la garniture en cours. */
export function placeTopping(state: GameState, slice: number, topping: ToppingId | null): GameState {
  if (slice < 0 || slice >= CHEF_SLICES) return state;
  // On ne peut poser qu'un ingrédient déjà découvert.
  if (topping !== null && !state.chef.unlocked.includes(topping)) return state;
  if ((state.chef.draft[slice] ?? null) === topping) return state;

  const draft = [...state.chef.draft];
  draft[slice] = topping;
  return { ...state, chef: { ...state.chef, draft } };
}

/** Vide la garniture en cours d'édition (la pizza au four n'y perd rien). */
export function clearDraft(state: GameState): GameState {
  if (state.chef.draft.every((slice) => slice === null)) return state;
  return { ...state, chef: { ...state.chef, draft: emptyLayout() } };
}

/** Recopie la garniture au four dans l'éditeur, pour partir d'elle plutôt que de rien. */
export function copyBakedToDraft(state: GameState): GameState {
  const baked = state.chef.baked;
  if (!baked) return state;
  return { ...state, chef: { ...state.chef, draft: [...baked] } };
}

/** Enfourne la garniture en cours : elle remplace la précédente et relance le délai. */
export function bakePizza(state: GameState): { state: GameState; baked: boolean } {
  if (!canBake(state)) return { state, baked: false };
  return {
    state: {
      ...state,
      chef: {
        ...state.chef,
        baked: [...state.chef.draft],
        bakedAt: state.stats.playTimeTotal,
      },
    },
    baked: true,
  };
}

/* ------------------------------------------------------------------ */
/* Découverte des ingrédients                                          */
/* ------------------------------------------------------------------ */

/**
 * Révèle les ingrédients dont la cuisine est possédée. Un ingrédient découvert
 * l'est POUR TOUJOURS : un prestige remet les cuisines à zéro, pas la mémoire du chef.
 */
export function revealToppings(state: GameState): GameState {
  let found: ToppingId[] | null = null;
  for (const def of TOPPINGS) {
    if (state.chef.unlocked.includes(def.id)) continue;
    if (state.generators[def.unlockedBy].owned <= 0) continue;
    (found ??= []).push(def.id);
  }
  if (!found) return state;
  return { ...state, chef: { ...state.chef, unlocked: [...state.chef.unlocked, ...found] } };
}

/** Ingrédients découverts, dans l'ordre du catalogue. */
export function unlockedToppings(state: GameState) {
  return TOPPINGS.filter((def) => state.chef.unlocked.includes(def.id));
}
