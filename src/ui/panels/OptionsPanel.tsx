/** Onglet Options : affichage, sauvegarde, export/import, remise à zéro. */
import { useState } from 'react';
import { t } from '../../data/i18n/fr.ts';
import type { Notation } from '../../engine/format.ts';
import { updateSettings } from '../../engine/actions.ts';
import { dispatch, exportCurrent, hardReset, importFrom, saveNow } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { playSound } from '../sound.ts';
import styles from './OptionsPanel.module.css';

const NOTATIONS: Array<[Notation, string]> = [
  ['standard', t.options.notationStandard],
  ['scientific', t.options.notationScientific],
  ['engineering', t.options.notationEngineering],
];

export function OptionsPanel() {
  const settings = useGameStore((s) => s.state.settings);
  const setToast = useGameStore((s) => s.setToast);

  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [resetStep, setResetStep] = useState(0);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  function handleExport() {
    const code = exportCurrent();
    setExported(code);
    // La copie presse-papier peut échouer (permissions) : le code reste affiché dans le champ.
    navigator.clipboard?.writeText(code).then(
      () => flash(t.options.copied),
      () => undefined,
    );
  }

  function handleImport() {
    try {
      importFrom(importText);
      setImportError('');
      setImportText('');
      flash(t.options.importOk);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleReset() {
    if (resetStep < 2) {
      setResetStep(resetStep + 1);
      return;
    }
    hardReset();
    setResetStep(0);
    flash(t.options.resetDone);
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>{t.options.title}</h2>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="notation">
          {t.options.notation}
        </label>
        <select
          id="notation"
          className={styles.select}
          value={settings.notation}
          onChange={(e) => dispatch((s) => updateSettings(s, { notation: e.target.value as Notation }))}
        >
          {NOTATIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>{t.options.theme}</span>
        <div className={styles.segmented}>
          <button
            type="button"
            data-active={settings.theme === 'dark'}
            onClick={() => dispatch((s) => updateSettings(s, { theme: 'dark' }))}
          >
            {t.options.themeDark}
          </button>
          <button
            type="button"
            data-active={settings.theme === 'light'}
            onClick={() => dispatch((s) => updateSettings(s, { theme: 'light' }))}
          >
            {t.options.themeLight}
          </button>
        </div>
      </div>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => dispatch((s) => updateSettings(s, { reducedMotion: e.target.checked }))}
        />
        {t.options.reducedMotion}
      </label>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(e) => {
            dispatch((s) => updateSettings(s, { sound: e.target.checked }));
            // Un retour sonore immédiat : la case cochée est elle-même le geste
            // qui autorise le navigateur à démarrer l'audio.
            if (e.target.checked) playSound('achievement', true);
          }}
        />
        {t.options.sound}
      </label>

      <hr className={styles.separator} />

      <div className={styles.group}>
        <span className={styles.label}>{t.options.save}</span>
        <p className={styles.help}>{t.options.autosave}</p>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            saveNow();
            flash(t.options.saved);
          }}
        >
          {t.options.saveNow}
        </button>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>{t.options.exportTitle}</span>
        <p className={styles.help}>{t.options.exportHint}</p>
        <button type="button" className={styles.button} onClick={handleExport}>
          {t.options.copy}
        </button>
        {exported && <textarea className={styles.textarea} readOnly value={exported} rows={4} />}
      </div>

      <div className={styles.group}>
        <span className={styles.label}>{t.options.importTitle}</span>
        <p className={styles.help}>{t.options.importHint}</p>
        <textarea
          className={styles.textarea}
          rows={4}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <button type="button" className={styles.button} onClick={handleImport} disabled={!importText.trim()}>
          {t.options.import}
        </button>
        {importError && <p className={styles.error}>{t.options.importError + importError}</p>}
      </div>

      <hr className={styles.separator} />

      <div className={styles.group}>
        <span className={styles.label}>{t.options.reset}</span>
        <p className={styles.help}>{t.options.resetWarning}</p>
        <div className={styles.resetRow}>
          <button type="button" className={styles.danger} onClick={handleReset}>
            {resetStep === 0 ? t.options.reset : resetStep === 1 ? t.options.resetConfirm1 : t.options.resetConfirm2}
          </button>
          {resetStep > 0 && (
            <button type="button" className={styles.button} onClick={() => setResetStep(0)}>
              {t.options.cancel}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
