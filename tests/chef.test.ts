import { describe, expect, it } from 'vitest';
import { createTestState, type GameState } from '../src/engine/state.ts';
import type { ToppingId } from '../src/data/toppings.ts';
import { CHEF_BAKE_COOLDOWN, CHEF_PERCENT_PER_POINT } from '../src/data/config.ts';
import {
  bakeCooldown, bakePizza, canBake, chefEffects, chefUnlocked, clearDraft, copyBakedToDraft,
  effectsFromTotals, evaluatePizza, placeTopping, revealToppings,
} from '../src/engine/chefPizza.ts';
import { permanentEffects, resetRun } from '../src/engine/prestige.ts';
import { clickPower, totalProduction } from '../src/engine/formulas.ts';
import { deserialize, serialize } from '../src/engine/save.ts';

/** Raccourci d'écriture : une garniture se note comme dans le chercheur exhaustif. */
const LETTERS: Record<string, ToppingId | null> = {
  T: 'tomate', B: 'basilic', M: 'mozzarella', C: 'champignon', P: 'piment',
  O: 'olive', N: 'oignon', J: 'jambon', A: 'ananas', '.': null,
};

function layout(text: string): (ToppingId | null)[] {
  return [...text].map((letter) => LETTERS[letter] ?? null);
}

function totals(text: string) {
  return evaluatePizza(layout(text)).totals;
}

/** Un chef installé : four ouvert, tous les ingrédients découverts. */
function chef(state: GameState = createTestState()): GameState {
  return {
    ...state,
    chef: {
      ...state.chef,
      unlocked: ['tomate', 'basilic', 'mozzarella', 'champignon', 'piment', 'olive', 'oignon', 'jambon', 'ananas'],
    },
  };
}

describe('La Pizza du Chef — les règles', () => {
  it('donne 80 à la margherita, le maximum de production des 43 millions de garnitures', () => {
    expect(totals('BTBTBTBT').prod).toBe(80);
  });

  it('donne 160 aux champignons et oignons, le maximum de pétrissage', () => {
    expect(totals('CCNCNNCN').click).toBe(160);
  });

  it('laisse la hawaïenne championne des chasseurs de pizzas d’or', () => {
    const t = totals('AJAJAJAJ');
    expect(t.prod).toBe(72);
    expect(t.gold).toBe(24);
  });

  it('additionne les modificateurs au lieu de les multiplier', () => {
    // Une tomate entre deux basilics : +100 % + 100 % = ×3, jamais ×4.
    const slice = evaluatePizza(layout('BTB.....')).slices[1]!;
    expect(slice.base).toBe(6);
    expect(slice.bonus).toBe(2);
    expect(slice.value).toBe(18);
  });

  it('ne laisse jamais une part descendre sous zéro', () => {
    // Deux piments voisins : −50 % − 50 % = −100 %, et pas −150 % plus bas.
    expect(totals('PPPPPPPP').click).toBe(0);
    expect(evaluatePizza(layout('PTP.....')).slices[1]!.value).toBe(0);
  });

  it('interdit au piment de pimenter le piment', () => {
    // Les deux piments se font face : aucun des deux ne booste l'autre.
    const t = totals('P...P...');
    expect(t.click).toBe(28);
  });

  it('fait copier à l’oignon la valeur DE BASE d’en face', () => {
    const result = evaluatePizza(layout('N...T...'));
    expect(result.slices[0]!.base).toBe(6);
    expect(result.slices[0]!.stat).toBe('prod');
    expect(result.totals.prod).toBe(12);
  });

  it('ne donne rien à deux oignons qui se regardent', () => {
    const result = evaluatePizza(layout('N...N...'));
    expect(result.slices[0]!.stat).toBeNull();
    expect(result.totals).toEqual({ prod: 0, click: 0, gold: 0 });
  });

  it('accepte les parts nues sans rien casser', () => {
    expect(totals('........')).toEqual({ prod: 0, click: 0, gold: 0 });
    expect(totals('T.......').prod).toBe(6);
  });

  it('explique chaque part : base, influences reçues, total', () => {
    const slice = evaluatePizza(layout('BTP.....')).slices[1]!;
    expect(slice.mods.map((m) => m.amount)).toEqual([1, -0.5]);
    expect(slice.value).toBe(9); // 6 × (1 + 1 − 0,5)
  });
});

describe('La Pizza du Chef — les effets', () => {
  it('convertit les points selon CHEF_PERCENT_PER_POINT, deux points = 1 % pour les pizzas d’or', () => {
    const effects = effectsFromTotals({ prod: 80, click: 160, gold: 24 });
    expect(effects.production).toBeCloseTo(1 + 0.8 * CHEF_PERCENT_PER_POINT);
    expect(effects.click).toBeCloseTo(1 + 1.6 * CHEF_PERCENT_PER_POINT);
    expect(effects.eventFrequency).toBeCloseTo(0.88);
  });

  it('plafonne la réduction du délai des pizzas d’or à la moitié', () => {
    expect(effectsFromTotals({ prod: 0, click: 0, gold: 400 }).eventFrequency).toBe(0.5);
  });

  it('ne donne rien tant que rien n’est au four', () => {
    const state = chef();
    expect(chefEffects(state).production).toBe(1);
    expect(permanentEffects(state).globalMult.toNumber()).toBe(1);
  });

  it('booste production et pétrissage une fois la pizza enfournée', () => {
    const base = {
      ...chef(),
      generators: {
        ...createTestState().generators,
        apprenti: { id: 'apprenti' as const, owned: 10, totalBought: 10, unlocked: true },
      },
    };
    const before = { production: totalProduction(base), click: clickPower(base) };

    const baked: GameState = { ...base, chef: { ...base.chef, baked: layout('BTBTBTBT'), bakedAt: 0 } };
    expect(totalProduction(baked).div(before.production).toNumber()).toBeCloseTo(1 + 0.8 * CHEF_PERCENT_PER_POINT);
    // Le clic profite de la production ET de son propre multiplicateur : ici, seulement
    // la production, puisque la margherita ne donne pas de pétrissage.
    expect(clickPower(baked).div(before.click).toNumber()).toBeCloseTo(1 + 0.8 * CHEF_PERCENT_PER_POINT);
  });
});

describe('La Pizza du Chef — le four', () => {
  it('refuse d’enfourner une pizza nue', () => {
    expect(canBake(chef())).toBe(false);
  });

  it('refuse d’enfourner la garniture déjà au four', () => {
    const state = { ...chef(), chef: { ...chef().chef, draft: layout('BTBTBTBT'), baked: layout('BTBTBTBT'), bakedAt: null } };
    expect(canBake(state)).toBe(false);
  });

  it('enfourne, puis impose une heure de jeu avant la fournée suivante', () => {
    let state = chef();
    state = placeTopping(state, 0, 'tomate');
    expect(canBake(state)).toBe(true);

    const first = bakePizza(state);
    expect(first.baked).toBe(true);
    expect(first.state.chef.baked?.[0]).toBe('tomate');
    expect(bakeCooldown(first.state)).toBe(CHEF_BAKE_COOLDOWN);

    const again = placeTopping(first.state, 1, 'basilic');
    expect(canBake(again)).toBe(false);

    // Une heure de jeu plus tard, le four est prêt.
    const later = { ...again, stats: { ...again.stats, playTimeTotal: CHEF_BAKE_COOLDOWN } };
    expect(bakeCooldown(later)).toBe(0);
    expect(canBake(later)).toBe(true);
  });

  it('laisse essayer sans rien risquer : la garniture au four ne bouge pas', () => {
    const baked = bakePizza(placeTopping(chef(), 0, 'tomate')).state;
    const tinkered = clearDraft(placeTopping(baked, 3, 'piment'));
    expect(tinkered.chef.baked?.[0]).toBe('tomate');
    expect(tinkered.chef.draft.every((slice) => slice === null)).toBe(true);
    expect(copyBakedToDraft(tinkered).chef.draft[0]).toBe('tomate');
  });

  it('refuse un ingrédient pas encore découvert', () => {
    const state = createTestState();
    expect(placeTopping(state, 0, 'ananas').chef.draft[0]).toBeNull();
  });
});

describe('La Pizza du Chef — découverte et sauvegarde', () => {
  it('découvre les ingrédients avec leur cuisine, et ne les reprend jamais', () => {
    const base = createTestState();
    expect(chefUnlocked(base)).toBe(false);

    const withPizzeria: GameState = {
      ...base,
      generators: { ...base.generators, pizzeria: { ...base.generators.pizzeria, owned: 1 } },
    };
    const revealed = revealToppings(withPizzeria);
    expect(revealed.chef.unlocked).toEqual(['tomate', 'basilic', 'mozzarella']);
    expect(chefUnlocked(revealed)).toBe(true);

    // Un prestige remet les cuisines à zéro : la mémoire du chef, non.
    const afterPrestige = resetRun(revealed);
    expect(afterPrestige.generators.pizzeria.owned).toBe(0);
    expect(afterPrestige.chef.unlocked).toEqual(['tomate', 'basilic', 'mozzarella']);
  });

  it('garde la garniture, le four et les ingrédients dans la sauvegarde', () => {
    const state = bakePizza(placeTopping(chef(), 0, 'tomate')).state;
    const reloaded = deserialize(serialize(state));
    expect(reloaded.chef.baked).toEqual(state.chef.baked);
    expect(reloaded.chef.draft).toEqual(state.chef.draft);
    expect(reloaded.chef.bakedAt).toBe(state.chef.bakedAt);
    expect(reloaded.chef.unlocked).toEqual(state.chef.unlocked);
  });

  it('ouvre un four vide aux sauvegardes d’avant le mini-jeu', () => {
    const old = JSON.parse(serialize(createTestState()));
    delete old.chef;
    old.version = 3;
    const migrated = deserialize(JSON.stringify(old));
    expect(migrated.chef.baked).toBeNull();
    expect(migrated.chef.unlocked).toEqual([]);
    expect(migrated.chef.draft).toHaveLength(8);
  });
});
