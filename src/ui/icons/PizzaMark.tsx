/**
 * La pizza elle-même : l'élément héros sur lequel le joueur tape.
 * Dessinée à plat, deux couleurs et un trait d'encre franc, comme une sérigraphie
 * sur un carton — surtout pas un dégradé.
 */
type Props = { size?: number; className?: string | undefined };

export function PizzaMark({ size = 200, className }: Props) {
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
      {/* Découpe en huit parts */}
      <g stroke="var(--line)" strokeWidth="2" strokeOpacity=".35">
        <path d="M100 24v152M24 100h152M46 46l108 108M154 46 46 154" />
      </g>
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
    </svg>
  );
}
