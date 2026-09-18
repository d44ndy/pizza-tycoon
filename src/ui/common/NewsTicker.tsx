/**
 * « La Gazette de la Pâte » : une dépêche à la fois, renouvelée toutes les douze
 * secondes. Cliquer passe à la suivante.
 *
 * Priorité à l'actualité : ce qui se débloque pendant la session passe devant le
 * reste. Les dépêches déjà disponibles au chargement comptent comme « vues », sinon
 * chaque rechargement réciterait tout le journal dans l'ordre.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../data/i18n/fr.ts';
import { NEWS_INTERVAL_MS, type NewsDef } from '../../data/news.ts';
import { eligibleNews, pickNews } from '../../engine/news.ts';
import { getState } from '../../store/gameLoop.ts';
import styles from './NewsTicker.module.css';

export function NewsTicker() {
  const seen = useRef<Set<string> | null>(null);
  const [current, setCurrent] = useState<NewsDef | null>(null);

  const next = useCallback(() => {
    const eligible = eligibleNews(getState());
    if (!seen.current) seen.current = new Set(eligible.map((n) => n.id));
    setCurrent((previous) => {
      const pick = pickNews(eligible, seen.current!, previous?.id ?? null, Math.random());
      if (pick) seen.current!.add(pick.id);
      return pick;
    });
  }, []);

  useEffect(() => {
    next();
    const timer = window.setInterval(next, NEWS_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [next]);

  if (!current) return null;

  return (
    <button type="button" className={styles.ticker} onClick={next} title={t.news.next}>
      <span className={styles.masthead}>{t.news.label}</span>
      {/* La clé force le remontage : l'animation d'entrée rejoue à chaque dépêche. */}
      <span key={current.id} className={styles.text} aria-live="polite">
        {current.text}
      </span>
    </button>
  );
}
