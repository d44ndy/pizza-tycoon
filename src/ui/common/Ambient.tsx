/**
 * Le décor vivant : ce qui bouge en fond quand le joueur, lui, ne bouge pas.
 *
 * Trois règles pour que ça reste « Carton & tampon » et pas un économiseur d'écran :
 *   1. tout est en ARRIÈRE-PLAN (`z-index: -1`) : les panneaux, opaques, passent devant,
 *      et le décor n'apparaît que dans les marges ;
 *   2. les mouvements sont SACCADÉS (`steps()`), comme un tampon qu'on repose, jamais
 *      des glissements lisses ;
 *   3. chaque animation revient à son point de départ, donc couper les animations
 *      (option du joueur ou réglage système) fige un décor propre, pas une image à moitié
 *      sortie de l'écran.
 *
 * Les positions sont calculées UNE FOIS au chargement du module, et le composant est
 * mémoïsé : le store publie un instantané dix fois par seconde, ce décor n'en sait rien.
 */
import { memo, type CSSProperties } from 'react';
import { nextRandom, type RngState } from '../../engine/rng.ts';
import styles from './Ambient.module.css';

type Speck = {
  left: number;
  top: number;
  size: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
  round: boolean;
};

/** Semoule renversée sur le plan de travail : même graine, même décor à chaque partie. */
const SPECKS: readonly Speck[] = (() => {
  let rng: RngState = { seed: 20_250_922 };
  const random = () => {
    const draw = nextRandom(rng);
    rng = draw.next;
    return draw.value;
  };
  const list: Speck[] = [];
  for (let i = 0; i < 22; i++) {
    const a = random();
    const b = random();
    const c = random();
    const d = random();
    list.push({
      left: Math.round(a * 100),
      top: Math.round(b * 100),
      size: 2 + Math.round(c * 3),
      dx: Math.round((d - 0.5) * 90),
      dy: 30 + Math.round(random() * 90),
      duration: 26 + Math.round(random() * 34),
      delay: -Math.round(random() * 40),
      round: c > 0.55,
    });
  }
  return list;
})();

export const Ambient = memo(function Ambient() {
  return (
    <div aria-hidden="true">
      {/* Derrière les panneaux : les deux tampons du carton, posés de travers.
          Ils sont trop grands pour passer devant le texte sans le salir. */}
      <div className={`${styles.layer} ${styles.back}`}>
      <svg className={`${styles.stamp} ${styles.stampLeft}`} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" />
        <circle cx="60" cy="60" r="44" strokeDasharray="6 7" />
        <path d="M60 22v76M22 60h76" />
      </svg>
      <svg className={`${styles.stamp} ${styles.stampRight}`} viewBox="0 0 120 120">
        <path d="M60 14 108 104H12z" />
        <path d="M32 78h56M24 92h72" />
        <circle cx="60" cy="52" r="7" />
        <circle cx="46" cy="76" r="6" />
        <circle cx="76" cy="74" r="6" />
      </svg>
      </div>

      {/* Devant : la farine en suspension. Assez pâle pour passer sur un texte
          sans le gêner, assez mobile pour que la page ne soit jamais tout à fait immobile. */}
      <div className={`${styles.layer} ${styles.front}`}>
      {SPECKS.map((speck, i) => (
        <span
          key={i}
          className={`${styles.speck} ${speck.round ? styles.round : ''}`}
          style={{
            left: `${speck.left}%`,
            top: `${speck.top}%`,
            width: `${speck.size}px`,
            height: `${speck.size}px`,
            '--dx': `${speck.dx}px`,
            '--dy': `${speck.dy}px`,
            animationDuration: `${speck.duration}s`,
            animationDelay: `${speck.delay}s`,
          } as CSSProperties}
        />
      ))}
      </div>
    </div>
  );
});
