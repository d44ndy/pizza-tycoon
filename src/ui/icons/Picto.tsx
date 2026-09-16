/**
 * Pictogrammes maison, dessinés au trait dans une grille de 24×24.
 *
 * Aucun emoji dans l'interface : les emoji ont l'air « posés là » et changent de style
 * d'une plateforme à l'autre. Ici, tout le jeu partage la même épaisseur de trait et
 * la même couleur (`currentColor`), donc le thème pilote entièrement le rendu.
 */
import type { GeneratorId } from '../../data/generators.ts';

export type PictoName =
  | GeneratorId | 'click' | 'synergy' | 'recette' | 'event' | 'sparkle' | 'trophy' | 'lock';

const PATHS: Record<PictoName, string> = {
  // --- les dix cuisines ---
  apprenti:
    '<path d="M6.5 13.6a3.6 3.6 0 1 1 2.4-6.3 3.7 3.7 0 0 1 6.2 0 3.6 3.6 0 1 1 2.4 6.3v3.2h-11z"/>'
    + '<rect x="5.6" y="16.8" width="12.8" height="3.6" rx=".8"/>',
  four:
    '<path d="M3.5 20.5h17"/><path d="M5 20.5v-5.8a7 7 0 0 1 14 0v5.8"/>'
    + '<path d="M9.4 20.5v-3a2.6 2.6 0 0 1 5.2 0v3"/>'
    + '<path d="M12 19.9c-.75-.45-1.05-1.05-.75-1.65.15-.3.45-.6.6-1 .25.4.5.6.8.95.3.4.35.85.1 1.25-.2.3-.45.45-.75.45z" fill="currentColor" stroke="none"/>',
  scooter:
    '<circle cx="6" cy="16.6" r="3.2"/><circle cx="18" cy="16.6" r="3.2"/><path d="M9.2 16.6h5.6"/>'
    + '<path d="M9.6 13.2h3.9l1.3-4.3"/><rect x="4.6" y="9.6" width="5" height="3.6" rx=".7"/>'
    + '<path d="M18 13.4 16.4 9"/><path d="M14.8 8.4h3.4"/>',
  camion:
    '<path d="M2.5 16.4V8.6a1 1 0 0 1 1-1H13v8.8"/><path d="M13 10.6h3.9l3.6 3.5v2.3H13z"/>'
    + '<circle cx="7" cy="18.2" r="2"/><circle cx="17" cy="18.2" r="2"/>'
    + '<rect x="4.6" y="10" width="5.4" height="3.4" rx=".6"/>',
  pizzeria:
    '<path d="M4.5 20.5v-8.6h15v8.6"/><path d="M3 11.9 4.7 7.6h14.6L21 11.9z"/>'
    + '<path d="M9.8 20.5v-5.2h4.4v5.2"/><path d="M2.5 20.5h19"/>',
  franchise:
    '<path d="M5 20.5V4.6h8.6v15.9"/><path d="M13.6 20.5v-8.6H19v8.6"/>'
    + '<path d="M7.6 7.8h1.4M11 7.8h1.4M7.6 11.2h1.4M11 11.2h1.4M7.6 14.6h1.4M11 14.6h1.4M15.6 14.9h1.4"/>'
    + '<path d="M3 20.5h18"/>',
  usine:
    '<path d="M2.5 20.5h19"/><path d="M3.2 20.5v-7.2l4.2-2.6v2.6l4.2-2.6v2.6l4.2-2.6v9.8"/>'
    + '<path d="M15.8 20.5V6.4h3.9v14.1"/><path d="M6 17.4h1.6M10.2 17.4h1.6"/>',
  robot:
    '<rect x="5.6" y="8.6" width="12.8" height="9.8" rx="2.2"/><path d="M12 8.6V5.8"/>'
    + '<circle cx="12" cy="4.5" r="1.3"/><circle cx="9.4" cy="12.4" r="1.1"/><circle cx="14.6" cy="12.4" r="1.1"/>'
    + '<path d="M9.8 15.6h4.4"/><path d="M3.4 11.8v3.4M20.6 11.8v3.4"/>',
  drone:
    '<path d="M4 8.4h16"/><ellipse cx="5.6" cy="8.4" rx="2.6" ry=".9"/><ellipse cx="18.4" cy="8.4" rx="2.6" ry=".9"/>'
    + '<rect x="9.2" y="9.8" width="5.6" height="3.6" rx="1.1"/><path d="M9.6 9.9 7.4 8.6M14.4 9.9l2.2-1.3"/>'
    + '<path d="M12 13.4v1.6"/><rect x="10.1" y="15" width="3.8" height="3.4" rx=".5"/>',
  plasma:
    '<circle cx="12" cy="12" r="4.3"/><ellipse cx="12" cy="12" rx="9.6" ry="3.7" transform="rotate(-24 12 12)"/>'
    + '<path d="M12 4.2V2.4M19.8 7.2l1.4-1M4.2 16.8l-1.4 1M12 19.8v1.8"/>',

  // --- pictos de service ---
  click:
    '<path d="M8.5 11.2V6.4a1.6 1.6 0 0 1 3.2 0v4.2"/><path d="M11.7 10.6V5.2a1.6 1.6 0 0 1 3.2 0v5.4"/>'
    + '<path d="M14.9 10.8V7.6a1.6 1.6 0 0 1 3.2 0v6.2a6 6 0 0 1-6 6h-1a5 5 0 0 1-3.55-1.47L4.8 15a1.7 1.7 0 0 1 2.4-2.4l1.3 1.3"/>',
  synergy:
    '<path d="M4.2 9.6A8 8 0 0 1 17.4 6.4"/><path d="M19.8 14.4A8 8 0 0 1 6.6 17.6"/>'
    + '<path d="M17.6 3.2v3.6h-3.6M6.4 20.8v-3.6H10"/>',
  recette:
    '<path d="M5 4.6h10.8a2 2 0 0 1 2 2v12.8H7a2 2 0 0 1-2-2z"/><path d="M5 17.4a2 2 0 0 1 2-2h10.8"/>'
    + '<path d="M8.8 8.4h5.2M8.8 11.4h5.2"/>',
  event:
    '<path d="M12 3.4 20.4 19a1 1 0 0 1-1.15 1.42L12 18.9l-7.25 1.52A1 1 0 0 1 3.6 19z"/>'
    + '<circle cx="10.4" cy="13" r="1" fill="currentColor" stroke="none"/>'
    + '<circle cx="13.9" cy="15.6" r="1" fill="currentColor" stroke="none"/>'
    + '<circle cx="11.2" cy="17" r="1" fill="currentColor" stroke="none"/>',
  sparkle:
    '<path d="M12 2.8c1.15 5.2 3.25 7.3 8.45 8.45C15.25 12.4 13.15 14.5 12 19.7c-1.15-5.2-3.25-7.3-8.45-8.45C8.75 10.1 10.85 8 12 2.8z"/>'
    + '<path d="M18.6 16.4c.45 2 1.25 2.8 3.25 3.25-2 .45-2.8 1.25-3.25 3.25-.45-2-1.25-2.8-3.25-3.25 2-.45 2.8-1.25 3.25-3.25z"/>',
  trophy:
    '<circle cx="12" cy="9.4" r="5.4"/><path d="M8.7 14 7 21.2l5-2.4 5 2.4-1.7-7.2"/>'
    + '<path d="M12 6.6l.9 1.9 2 .3-1.45 1.45.35 2.05L12 11.3l-1.8 1 .35-2.05L9.1 8.8l2-.3z"/>',
  lock:
    '<rect x="5" y="10.4" width="14" height="9.6" rx="1.6"/><path d="M8.5 10.4V7.7a3.5 3.5 0 0 1 7 0v2.7"/>',
};

type Props = {
  name: PictoName;
  /** Taille en pixels (le trait s'épaissit légèrement sur les petites tailles). */
  size?: number;
  className?: string | undefined;
};

export function Picto({ name, size = 24, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 18 ? 1.8 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
