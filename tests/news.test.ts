import { describe, expect, it } from 'vitest';
import { D } from '../src/engine/decimal.ts';
import { createTestState } from '../src/engine/state.ts';
import { NEWS, NEWS_BY_ID } from '../src/data/news.ts';
import { eligibleNews, newsConditionMet, pickNews } from '../src/engine/news.ts';

describe('catalogue', () => {
  it('compte une cinquantaine de dépêches sans doublon', () => {
    expect(NEWS.length).toBeGreaterThanOrEqual(45);
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
  });

  it('a toujours quelque chose à dire, dès le début', () => {
    expect(eligibleNews(createTestState()).length).toBeGreaterThan(3);
  });
});

describe('conditions', () => {
  it('les brèves du garage disparaissent quand l’empire grandit', () => {
    const debut = createTestState();
    const riche = { ...debut, stats: { ...debut.stats, earnedTotal: D('1e9') } };
    expect(newsConditionMet(debut, NEWS_BY_ID['garage-mamie']!.condition)).toBe(true);
    expect(newsConditionMet(riche, NEWS_BY_ID['garage-mamie']!.condition)).toBe(false);
    expect(newsConditionMet(riche, NEWS_BY_ID['empire-banque']!.condition)).toBe(true);
  });

  it('suit les cuisines, les villes et les drapeaux', () => {
    const base = createTestState();
    expect(eligibleNews(base).some((n) => n.id === 'cuisine-drone')).toBe(false);

    const avecDrone = { ...base, generators: { ...base.generators, drone: { ...base.generators.drone, owned: 1 } } };
    expect(eligibleNews(avecDrone).some((n) => n.id === 'cuisine-drone')).toBe(true);

    const avecNaples = {
      ...base,
      prestige: { layers: { expansion: { currency: D(0), totalEarned: D(1), resets: 1, nodes: { naples: 1 } } } },
    };
    expect(eligibleNews(avecNaples).some((n) => n.id === 'ville-naples')).toBe(true);

    const ananas = { ...base, flags: { pineapple: true as const } };
    expect(eligibleNews(ananas).some((n) => n.id === 'secret-ananas')).toBe(true);
  });

  it('garde les dépêches de prestige après une transcendance', () => {
    const base = createTestState();
    const transcende = {
      ...base,
      prestige: { layers: { expansion: { currency: D(0), totalEarned: D(1), resets: 1, nodes: {} } } },
    };
    expect(newsConditionMet(transcende, NEWS_BY_ID['prestige-10']!.condition)).toBe(true);
  });
});

describe('choix de la dépêche', () => {
  const eligible = NEWS.slice(0, 5);

  it('montre d’abord ce qui vient d’être débloqué, le plus avancé en premier', () => {
    const seen = new Set(eligible.slice(0, 3).map((n) => n.id));
    expect(pickNews(eligible, seen, null, 0.5)?.id).toBe(eligible[4]!.id);
  });

  it('tire ensuite au hasard, sans répéter la dernière', () => {
    const seen = new Set(eligible.map((n) => n.id));
    for (let i = 0; i < 20; i++) {
      const pick = pickNews(eligible, seen, eligible[2]!.id, i / 20);
      expect(pick?.id).not.toBe(eligible[2]!.id);
    }
  });

  it('se contente de la seule dépêche disponible', () => {
    const only = [NEWS[0]!];
    expect(pickNews(only, new Set([only[0]!.id]), only[0]!.id, 0.9)?.id).toBe(only[0]!.id);
  });

  it('ne renvoie rien sans dépêche', () => {
    expect(pickNews([], new Set(), null, 0.5)).toBeNull();
  });
});
