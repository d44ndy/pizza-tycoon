import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState } from '../src/engine/state.ts';
import { buyGenerator } from '../src/engine/actions.ts';
import { SAVE_VERSION } from '../src/data/config.ts';
import {
  SaveError, deserialize, exportSave, fromSaveData, importSave, serialize, toSaveData,
} from '../src/engine/save.ts';

/** Partie « vécue » : des pizzas, des achats, des réglages modifiés. */
function playedState() {
  const base = { ...createTestState(), pizzas: D('1.23456e42') };
  const withGen = buyGenerator(base, 'apprenti', 10).state;
  return {
    ...withGen,
    settings: { ...withGen.settings, notation: 'scientific' as const, bulkMode: 100 as const },
    stats: { ...withGen.stats, clicks: 42, earnedTotal: D('9.87e99') },
  };
}

describe('sauvegarde', () => {
  it('fait un aller-retour sans perte', () => {
    const state = playedState();
    const restored = deserialize(serialize(state, 1000));
    expect(restored.pizzas.toString()).toBe(state.pizzas.toString());
    expect(restored.generators.apprenti.owned).toBe(state.generators.apprenti.owned);
    expect(restored.stats.clicks).toBe(42);
    expect(restored.stats.earnedTotal.toString()).toBe(state.stats.earnedTotal.toString());
    expect(restored.settings.notation).toBe('scientific');
    expect(restored.settings.bulkMode).toBe(100);
    expect(restored.lastSaved).toBe(1000);
  });

  it('survit à l’export/import en base64', () => {
    const state = playedState();
    const restored = importSave(exportSave(state, 2000));
    expect(restored.pizzas.toString()).toBe(state.pizzas.toString());
    expect(restored.generators.apprenti.owned).toBe(state.generators.apprenti.owned);
  });

  it('refuse un JSON invalide', () => {
    expect(() => deserialize('ceci n’est pas du json')).toThrow(SaveError);
    expect(() => importSave('@@@ pas du base64 @@@')).toThrow(SaveError);
  });

  it('refuse une sauvegarde sans version ou venue du futur', () => {
    expect(() => fromSaveData({ pizzas: '10' })).toThrow(SaveError);
    expect(() => fromSaveData({ version: SAVE_VERSION + 5, pizzas: '10' })).toThrow(SaveError);
  });

  it('complète les champs manquants au lieu de planter', () => {
    const restored = fromSaveData({ version: SAVE_VERSION, pizzas: '500' });
    expect(restored.pizzas.toNumber()).toBe(500);
    expect(restored.generators.apprenti.owned).toBe(0);
    expect(restored.settings.notation).toBe('standard');
  });

  it('ignore des valeurs corrompues sans casser la partie', () => {
    const save = toSaveData(playedState(), 3000);
    const restored = fromSaveData({
      ...save,
      pizzas: 'pas-un-nombre',
      stats: { ...save.stats, clicks: Number.NaN, playTimeRun: -12 },
    });
    expect(restored.pizzas.toNumber()).toBe(0);
    expect(restored.stats.clicks).toBe(0);
    expect(restored.stats.playTimeRun).toBe(0);
  });
});
