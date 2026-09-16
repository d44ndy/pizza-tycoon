/** Fenêtre modale minimale (popup hors ligne, sauvegarde illisible). */
import type { ReactNode } from 'react';
import styles from './Modal.module.css';

type Props = {
  title: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
};

export function Modal({ title, children, actionLabel, onAction }: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.box}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.content}>{children}</div>
        <button type="button" className={styles.action} onClick={onAction} autoFocus>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
