import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState } from '../src/engine/state.ts';
import { buyGenerator } from '../src/engine/actions.ts';
import { SAVE_VERSION } from '../src/data/config.ts';
import {
  SaveError, deserialize, exportSave, fromSaveData, importSave, serialize, toSaveData,
} from '../src/engine/save.ts';
import { buyUpgrade } from '../src/engine/upgrades.ts';
import { raiseFlag } from '../src/engine/achievements.ts';

/** Partie « vécue » : des pizzas, des achats, des réglages modifiés. */
function playedState() {
  const base = { ...createTestState(), pizzas: D('1.23456e42') };
  const withGen = buyGenerator(base, 'apprenti', 10).state;
  const withUpgrade = buyUpgrade(withGen, 'apprenti-1').state;
  const withFlag = raiseFlag(withUpgrade, 'jackpot');
  return {
    ...withFlag,
    achievements: { 'stock-1': 12.5, 'clic-1': 40 },
    events: { ...withFlag.events, nextSpawnAt: 321 },
    settings: { ...withFlag.settings, notation: 'scientific' as const, bulkMode: 100 as const },
    stats: { ...withFlag.stats, clicks: 42, earnedTotal: D('9.87e99'), eventsClicked: 7 },
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
    expect(restored.upgrades['apprenti-1']).toBe(true);
    expect(restored.achievements['stock-1']).toBe(12.5);
    expect(restored.flags.jackpot).toBe(true);
    expect(restored.stats.eventsClicked).toBe(7);
    expect(restored.events.nextSpawnAt).toBe(321);
  });

  it('ne conserve ni pizza d’or affichée ni effet en cours', () => {
    // Un bonus ×7 « gelé » pendant une nuit serait injuste (dans un sens comme dans l'autre).
    const state = playedState();
    const restored = deserialize(serialize({
      ...state,
      events: { ...state.events, pending: { kind: 'bonus', bornAt: 1, x: 5, y: 5 }, buffs: [{ kind: 'bonus', endsAt: 99 }] },
    }));
    expect(restored.events.pending).toBeNull();
    expect(restored.events.buffs).toHaveLength(0);
  });

  it('migre une sauvegarde v1 (Phase 1) vers v2', () => {
    const v1 = {
      version: 1,
      pizzas: '12345',
      generators: { apprenti: { owned: 7, totalBought: 7, unlocked: true } },
      stats: {
        createdAt: 1, playTimeRun: 60, playTimeTotal: 60, clicks: 3, clicksTotal: 3,
        earnedRun: '12345', earnedPrestige: '12345', earnedTotal: '12345',
        handmadeTotal: '3', bestPizzas: '12345',
      },
      settings: { notation: 'standard', bulkMode: 1, theme: 'dark', reducedMotion: false, sound: false },
      prestige: { layers: {} },
      rng: { seed: 9 },
      lastSaved: 5000,
    };
    const restored = fromSaveData(v1);
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.pizzas.toNumber()).toBe(12345);
    expect(restored.generators.apprenti.owned).toBe(7);
    // Les nouveautés de la Phase 2 arrivent vides, sans casser la partie.
    expect(restored.upgrades).toEqual({});
    expect(restored.achievements).toEqual({});
    expect(restored.stats.eventsClicked).toBe(0);
    expect(restored.events.nextSpawnAt).toBe(0);
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
    expect(restored.upgrades).toEqual({});
    expect(restored.pizzas.toNumber()).toBe(500);
    expect(restored.generators.apprenti.owned).toBe(0);
    expect(restored.settings.notation).toBe('standard');
  });

  it('ignore des valeurs corrompues sans casser la partie', () => {
    const save = toSaveData(playedState(), 3000);
    const restored = fromSaveData({
      ...save,
      pizzas: 'pas-un-nombre',
      upgrades: ['amelioration-qui-nexiste-plus', 'apprenti-1'],
      achievements: { 'succes-inconnu': 3, 'stock-1': 8 },
      stats: { ...save.stats, clicks: Number.NaN, playTimeRun: -12 },
    });
    expect(restored.upgrades).toEqual({ 'apprenti-1': true });
    expect(restored.achievements).toEqual({ 'stock-1': 8 });
    expect(restored.pizzas.toNumber()).toBe(0);
    expect(restored.stats.clicks).toBe(0);
    expect(restored.stats.playTimeRun).toBe(0);
  });
});
