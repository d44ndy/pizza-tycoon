/**
 * Infobulle : s'affiche au survol et au focus clavier (desktop),
 * et se fige au clic (indispensable sur mobile, où il n'y a pas de survol).
 */
import { useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

type Props = {
  content: ReactNode;
  children: ReactNode;
  /** 'info' = petite pastille « i » ; 'plain' = case carrée (pictogramme). */
  variant?: 'info' | 'plain';
  align?: 'left' | 'right';
};

export function Tooltip({ content, children, variant = 'info', align = 'right' }: Props) {
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
        className={variant === 'info' ? styles.trigger : styles.triggerPlain}
        aria-expanded={visible}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
      >
        {children}
      </button>
      {visible && <span className={align === 'right' ? styles.bubble : styles.bubbleLeft}>{content}</span>}
    </span>
  );
}
