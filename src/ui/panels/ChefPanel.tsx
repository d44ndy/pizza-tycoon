/**
 * « La Pizza du Chef » : le puzzle de garniture.
 *
 * Tout le calcul vit dans `engine/chefPizza.ts` ; ce composant ne fait que le montrer.
 * Deux garnitures cohabitent à l'écran : celle qu'on manipule (au centre) et celle
 * qui est au four (à droite), pour qu'essayer ne coûte jamais rien.
 */
import { useState } from 'react';
import { t } from '../../data/i18n/fr.ts';
import { GENERATORS_BY_ID } from '../../data/generators.ts';
import { TOPPINGS, TOPPINGS_BY_ID, type ToppingId, type ToppingStat } from '../../data/toppings.ts';
import { CHEF_GOLD_CAP, CHEF_SLICES } from '../../data/config.ts';
import {
  bakeCooldown, canBake, chefEffects, effectsFromTotals, evaluatePizza,
  neighbours, opposite, type PizzaEval,
} from '../../engine/chefPizza.ts';
import { formatTime } from '../../engine/format.ts';
import { doBake, doClearDraft, doCopyBaked, doPlaceTopping } from '../../store/gameLoop.ts';
import { useGameStore } from '../../store/gameStore.ts';
import { Picto } from '../icons/Picto.tsx';
import { useSound } from '../useSound.ts';
import styles from './ChefPanel.module.css';

/** Géométrie de la pizza (repère de 400 × 400). */
const C = 200;
const R_CRUST = 192;
const R_SAUCE = 168;

function point(radius: number, degrees: number): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)];
}

/** Le secteur d'une part, en partant du haut (la part 1 est à midi). */
function slicePath(i: number): string {
  const a0 = -90 - 22.5 + i * 45;
  const [x0, y0] = point(R_SAUCE, a0);
  const [x1, y1] = point(R_SAUCE, a0 + 45);
  return `M${C} ${C}L${x0.toFixed(2)} ${y0.toFixed(2)}`
    + `A${R_SAUCE} ${R_SAUCE} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
}

const STAT_CLASS: Record<ToppingStat, string> = {
  prod: styles.prod!,
  click: styles.click!,
  gold: styles.gold!,
};

/** Un modificateur, écrit comme le joueur le lit : « +50 % », « −50 % ». */
function percent(amount: number): string {
  return `${amount > 0 ? '+' : '−'}${Math.abs(amount * 100)} %`;
}

export function ChefPanel() {
  const state = useGameStore((s) => s.state);
  const sound = useSound();

  /** Ingrédient sélectionné dans la réserve ; `null` = la gomme. */
  const [tool, setTool] = useState<ToppingId | null | undefined>(undefined);
  const [focus, setFocus] = useState(0);

  const draft = evaluatePizza(state.chef.draft);
  const baked = state.chef.baked;
  const oven = chefEffects(state);
  const draftEffects = effectsFromTotals(draft.totals);
  const cooldown = bakeCooldown(state);
  const ready = canBake(state);
  const empty = state.chef.draft.every((slice) => slice === null);

  function touchSlice(i: number) {
    setFocus(i);
    if (tool === undefined) return;
    doPlaceTopping(i, tool);
    sound('buy');
  }

  function bake() {
    if (doBake()) sound('achievement');
  }

  const [left, right] = neighbours(focus);
  const facing = opposite(focus);

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t.chef.title}</h2>
      </header>
      <p className={styles.intro}>{t.chef.intro}</p>

      <div className={styles.board}>
        {/* --- la pizza --- */}
        <div className={styles.pizzaSide}>
          <svg className={styles.pizza} viewBox="0 0 400 400" role="group" aria-label={t.chef.draftTitle}>
            <circle
              cx={C} cy={C} r={R_CRUST}
              fill="var(--crust)" stroke="var(--line)" strokeWidth="4"
            />
            {Array.from({ length: CHEF_SLICES }, (_, i) => {
              const id = state.chef.draft[i] ?? null;
              const slice = draft.slices[i]!;
              return (
                <path
                  key={i}
                  className={`${styles.slice} ${id ? '' : styles.emptySlice}`}
                  d={slicePath(i)}
                  role="button"
                  tabIndex={0}
                  aria-label={id
                    ? t.chef.sliceFilled(i + 1, TOPPINGS_BY_ID[id].name, String(Math.round(slice.value)))
                    : t.chef.sliceEmpty(i + 1)}
                  onClick={() => touchSlice(i)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    touchSlice(i);
                  }}
                />
              );
            })}

            {/* Repères de lecture, posés PAR-DESSUS la sauce : on ne change jamais la
                couleur d'une part pour la signaler, sinon ses pictos deviennent illisibles. */}
            <path className={styles.mark} d={slicePath(left)} />
            <path className={styles.mark} d={slicePath(right)} />
            <path className={`${styles.mark} ${styles.facing}`} d={slicePath(facing)} />
            <path className={styles.focusMark} d={slicePath(focus)} />

            {Array.from({ length: CHEF_SLICES }, (_, i) => {
              const id = state.chef.draft[i] ?? null;
              const slice = draft.slices[i]!;
              const mid = -90 + i * 45;
              const [px, py] = point(118, mid);
              const [vx, vy] = point(70, mid);
              return (
                <g key={i} className={styles.sliceMarks}>
                  {id ? (
                    <g transform={`translate(${(px - 21).toFixed(1)} ${(py - 21).toFixed(1)}) scale(1.75)`}>
                      <Picto name={id} size={24} />
                    </g>
                  ) : (
                    <circle cx={px} cy={py} r="4" className={styles.emptyDot} />
                  )}
                  {id && (
                    <text
                      className={`${styles.value} ${slice.stat ? STAT_CLASS[slice.stat] : ''} num`}
                      x={vx.toFixed(1)}
                      y={(vy + 7).toFixed(1)}
                    >
                      {Math.round(slice.value)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <p className={styles.legend}>{t.chef.legend}</p>

          <div className={styles.totals}>
            <Total stat="prod" value={draft.totals.prod} />
            <Total stat="click" value={draft.totals.click} />
            <Total stat="gold" value={draft.totals.gold} />
          </div>

          <div className={styles.draftActions}>
            <button type="button" className={styles.minor} onClick={doClearDraft} disabled={empty}>
              {t.chef.clear}
            </button>
            {baked && (
              <button type="button" className={styles.minor} onClick={doCopyBaked}>
                {t.chef.copyBaked}
              </button>
            )}
          </div>
        </div>

        {/* --- le four, la loupe et la réserve --- */}
        <div className={styles.side}>
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>{t.chef.ovenTitle}</h3>
            {baked ? (
              <ul className={styles.effects}>
                <li>{t.chef.effect.prod(String(Math.round((oven.production - 1) * 100)))}</li>
                <li>{t.chef.effect.click(String(Math.round((oven.click - 1) * 100)))}</li>
                <li>{t.chef.effect.gold(String(Math.round((1 - oven.eventFrequency) * 100)))}</li>
              </ul>
            ) : (
              <p className={styles.hint}>{t.chef.ovenEmpty}</p>
            )}

            <button type="button" className={styles.bake} onClick={bake} disabled={!ready}>
              {cooldown > 0 ? t.chef.bakeWait(formatTime(cooldown)) : t.chef.bake}
            </button>
            <p className={styles.hint}>
              {empty ? t.chef.bakeEmpty
                : cooldown === 0 && !ready ? t.chef.bakeSame
                  : t.chef.bakeHint}
            </p>
            {ready && (
              <p className={styles.preview}>
                {t.chef.effect.prod(String(Math.round((draftEffects.production - 1) * 100)))}
                {' · '}
                {t.chef.effect.click(String(Math.round((draftEffects.click - 1) * 100)))}
                {' · '}
                {t.chef.effect.gold(String(Math.round((1 - draftEffects.eventFrequency) * 100)))}
              </p>
            )}
          </div>

          <Lens slice={focus} layout={state.chef.draft} result={draft} />

          <div className={styles.box}>
            <h3 className={styles.boxTitle}>{t.chef.pantry}</h3>
            <div className={styles.pantry}>
              {TOPPINGS.map((def) => {
                const unlocked = state.chef.unlocked.includes(def.id);
                return (
                  <button
                    key={def.id}
                    type="button"
                    className={styles.ing}
                    data-stat={def.stat ?? 'none'}
                    aria-pressed={tool === def.id}
                    disabled={!unlocked}
                    onClick={() => setTool(def.id)}
                  >
                    <Picto name={unlocked ? def.id : 'lock'} size={22} />
                    <span className={styles.ingName}>{unlocked ? def.name : '???'}</span>
                    <span className={styles.ingRule}>
                      {unlocked ? def.rule : t.chef.lockedBy(GENERATORS_BY_ID[def.unlockedBy].name)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`${styles.ing} ${styles.eraser}`}
                data-stat="none"
                aria-pressed={tool === null}
                onClick={() => setTool(null)}
              >
                <Picto name="gomme" size={22} />
                <span className={styles.ingName}>{t.chef.eraser}</span>
                <span className={styles.ingRule}>{t.chef.eraserRule}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Une des trois colonnes de totaux, avec l'effet en jeu qu'elle représente. */
function Total({ stat, value }: { stat: ToppingStat; value: number }) {
  const rounded = Math.round(value);
  // Les pizzas d'or convertissent deux points en un pour cent, et plafonnent.
  const effect = stat === 'prod' ? t.chef.effect.prod(String(rounded))
    : stat === 'click' ? t.chef.effect.click(String(rounded))
      : t.chef.effect.gold(String(Math.round(Math.min(CHEF_GOLD_CAP, value / 2))));
  return (
    <div className={`${styles.total} ${STAT_CLASS[stat]}`}>
      <span className={styles.totalLabel}>{t.chef.stat[stat]}</span>
      <span className={`${styles.totalValue} num`}>{rounded}</span>
      <span className={styles.totalEffect}>{effect}</span>
    </div>
  );
}

/** « Sous la loupe » : le calcul d'une part, ligne par ligne. */
function Lens({ slice, layout, result }: {
  slice: number;
  layout: readonly (ToppingId | null)[];
  result: PizzaEval;
}) {
  const id = layout[slice] ?? null;
  if (!id) {
    return (
      <div className={styles.box}>
        <h3 className={styles.boxTitle}>{t.chef.lensEmpty(slice + 1)}</h3>
        <p className={styles.hint}>{t.chef.lensHint}</p>
      </div>
    );
  }

  const evaluated = result.slices[slice]!;
  const def = TOPPINGS_BY_ID[id];
  return (
    <div className={styles.box}>
      <h3 className={styles.boxTitle}>{t.chef.lensTitle(slice + 1, def.name)}</h3>
      <span className={styles.lensStat}>
        {evaluated.stat ? t.chef.stat[evaluated.stat] : t.chef.stat.none}
      </span>
      <ul className={styles.lensRows}>
        <li>
          <span>
            {id === 'oignon'
              ? (evaluated.copyOf ? t.chef.lensCopy(TOPPINGS_BY_ID[evaluated.copyOf].name) : t.chef.lensNothing)
              : t.chef.lensBase}
          </span>
          <span className="num">{Math.round(evaluated.base)}</span>
        </li>
        {evaluated.mods.map((mod, index) => (
          <li key={index}>
            <span>{t.chef.lensFrom(TOPPINGS_BY_ID[mod.topping].name, mod.from + 1)}</span>
            <span className={`num ${mod.amount > 0 ? styles.up : styles.down}`}>{percent(mod.amount)}</span>
          </li>
        ))}
        <li className={styles.lensTotal}>
          <span>{t.chef.lensTotal}</span>
          <span className="num">{Math.round(evaluated.value)}</span>
        </li>
      </ul>
    </div>
  );
}
