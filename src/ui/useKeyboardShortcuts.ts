/**
 * Raccourcis clavier du jeu.
 *
 * Espace pétrit, 1…0 achètent les cuisines, B change la quantité, U achète toutes
 * les améliorations abordables. Les raccourcis se taisent dès qu'on tape dans un
 * champ, qu'une fenêtre de confirmation est ouverte, ou qu'une touche système est
 * enfoncée — ils ne doivent jamais voler une frappe au joueur.
 */
import { useEffect } from 'react';
import type { TabId } from '../engine/state.ts';
import { doBuyAllUpgrades, doBuyByIndex, doClick, doCycleBulk } from '../store/gameLoop.ts';
import type { SoundName } from './sound.ts';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useKeyboardShortcuts(tab: TabId, sound: (name: SoundName) => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (tab !== 'game') return;

      if (event.code === 'Space') {
        // Sur un bouton qui a le focus, Espace l'active déjà : ne pas doubler l'action.
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        // Maintenir la touche ne compte pas : pas d'auto-clic déguisé.
        if (event.repeat) return;
        doClick();
        sound('click');
        return;
      }

      if (/^Digit[0-9]$/.test(event.code)) {
        const digit = Number(event.code.slice(5));
        // 1 → 1re cuisine … 9 → 9e, 0 → 10e.
        if (doBuyByIndex(digit === 0 ? 9 : digit - 1)) sound('buy');
        return;
      }

      if (event.code === 'KeyB') {
        doCycleBulk();
        return;
      }

      if (event.code === 'KeyU' && doBuyAllUpgrades() > 0) sound('buy');
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab, sound]);
}
