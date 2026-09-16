/**
 * Infobulle : s'affiche au survol et au focus clavier (desktop),
 * et se fige au clic (indispensable sur mobile où il n'y a pas de survol).
 */
import { useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

type Props = {
  content: ReactNode;
  children: ReactNode;
};

export function Tooltip({ content, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const visible = hovered || pinned;

  return (
    <span
      className={styles.anchor}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={visible}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
      >
        {children}
      </button>
      {visible && <span className={styles.bubble}>{content}</span>}
    </span>
  );
}
