/**
 * La pizza elle-même : l'élément héros sur lequel le joueur tape.
 * Dessinée à plat, deux couleurs et un trait d'encre franc, comme une sérigraphie
 * sur un carton — surtout pas un dégradé.
 *
 * Quand une Pizza du Chef est au four, c'est ELLE qui garnit la pizza héros, part par
 * part, avec les mêmes pictos que dans l'onglet du chef : le mini-jeu se voit depuis
 * l'écran principal, et la pizza change avec les choix du joueur.
 */
import type { ToppingId } from '../../data/toppings.ts';
import { Picto } from './Picto.tsx';
import styles from './PizzaMark.module.css';

type Props = {
  size?: number;
  className?: string | undefined;
  /** Garniture au four (une case par part, en partant de midi). Absente = la pizza d'origine. */
  toppings?: readonly (ToppingId | null)[] | null | undefined;
};

/** Centre d'une part, sur un cercle de rayon `radius` (la part 1 est à midi). */
function slicePoint(i: number, count: number, radius: number): [number, number] {
  const rad = ((-90 + (i * 360) / count) * Math.PI) / 180;
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
}

export function PizzaMark({ size = 200, className, toppings }: Props) {
  const garnished = toppings?.some((slice) => slice !== null) ?? false;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
    >
      {/* Croûte */}
      <circle cx="100" cy="100" r="92" fill="var(--crust)" stroke="var(--line)" strokeWidth="4" />
      {/* Sauce */}
      <circle cx="100" cy="100" r="76" fill="var(--sauce)" stroke="var(--line)" strokeWidth="3" />
      {/* Découpe en huit parts. Avec une garniture du chef, la découpe est décalée d'un
          demi-part pour que chaque picto tombe AU MILIEU de sa part, pas sur un trait. */}
      <g
        stroke="var(--line)"
        strokeWidth="2"
        strokeOpacity=".35"
        transform={garnished ? 'rotate(22.5 100 100)' : undefined}
      >
        <path d="M100 24v152M24 100h152M46 46l108 108M154 46 46 154" />
      </g>

      {garnished && toppings ? (
        <g className={styles.chef}>
          {toppings.map((id, i) => {
            if (!id) return null;
            const [x, y] = slicePoint(i, toppings.length, 50);
            return (
              <g key={i} transform={`translate(${(x - 13.2).toFixed(1)} ${(y - 13.2).toFixed(1)}) scale(1.1)`}>
                <Picto name={id} size={24} />
              </g>
            );
          })}
        </g>
      ) : (
        <>
          {/* Garniture */}
          <g fill="var(--topping)" stroke="var(--line)" strokeWidth="2.5">
            <circle cx="72" cy="66" r="11" />
            <circle cx="131" cy="78" r="9" />
            <circle cx="62" cy="118" r="9.5" />
            <circle cx="103" cy="106" r="12" />
            <circle cx="136" cy="134" r="10" />
            <circle cx="88" cy="146" r="8.5" />
          </g>
          {/* Basilic */}
          <g fill="var(--herb)" stroke="var(--line)" strokeWidth="2">
            <path d="M118 52c7-6 16-6 21-2-1 7-7 13-14 13-4 0-7-4-7-11z" />
            <path d="M52 92c-7-5-9-13-6-19 7-1 14 3 16 10 1 4-3 8-10 9z" />
            <path d="M124 160c-3 8-11 12-17 10-2-6 1-14 8-16 4-1 8 2 9 6z" />
          </g>
        </>
      )}
    </svg>
  );
}
