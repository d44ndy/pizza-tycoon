/**
 * « dans 2 min 14 s » : le temps à attendre avant de pouvoir payer un achat,
 * au rythme de production actuel. Au-delà de trente jours, l'estimation n'a plus
 * de sens (le joueur aura acheté dix autres choses d'ici là) : on le dit plutôt.
 */
import { t } from '../../data/i18n/fr.ts';
import { formatTime } from '../../engine/format.ts';
import styles from './WaitTime.module.css';

const MAX_MEANINGFUL_SECONDS = 30 * 24 * 3600;

type Props = {
  seconds: number | null;
  /** `false` : sur sa propre ligne (cartes d'amélioration) plutôt qu'à la suite du prix. */
  inline?: boolean;
};

export function WaitTime({ seconds, inline = true }: Props) {
  const label = seconds === null || seconds > MAX_MEANINGFUL_SECONDS
    ? t.generators.never
    : t.generators.readyIn(formatTime(Math.ceil(seconds)));
  return <span className={inline ? styles.wait : styles.block}>{label}</span>;
}
