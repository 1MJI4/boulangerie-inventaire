'use client';

// src/components/saisie/ClavierPave.tsx
//
// Grille de touches commune à tous les pavés (entier, kg, euros, téléphone).
// Mêmes classes que `PaveNumerique` (touches de 56 px, chiffres tabulaires,
// retour visuel à l'appui sans animation) pour que les pavés se ressemblent.
// Interne au dossier `saisie/`. Aucun <input> : le clavier du système ne
// s'ouvre jamais.

import type { JeuTouches } from './mecanique';

export const CLASSE_TOUCHE =
  'chiffres h-14 rounded-xl border border-line bg-surface text-xl font-medium text-ink active:bg-accent-doux active:text-accent disabled:opacity-40';
export const CLASSE_TOUCHE_SECONDAIRE =
  'h-14 rounded-xl border border-line text-sm font-medium text-ink-2 active:bg-surface-2 disabled:opacity-40';

const CHIFFRES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function ClavierPave({
  jeu,
  onTouche,
  onEffacer,
  onVider,
  desactive = false,
}: {
  /** entier : « Vider » en bas à gauche · decimal : virgule · telephone : « + » et « Espace ». */
  jeu: JeuTouches;
  onTouche: (touche: string) => void;
  onEffacer: () => void;
  onVider: () => void;
  desactive?: boolean;
}) {
  const toucheSpeciale = jeu === 'decimal' ? ',' : jeu === 'telephone' ? '+' : null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {CHIFFRES.map((c) => (
        <button key={c} type="button" disabled={desactive} onClick={() => onTouche(c)} className={CLASSE_TOUCHE}>
          {c}
        </button>
      ))}

      {toucheSpeciale ? (
        <button
          type="button"
          disabled={desactive}
          onClick={() => onTouche(toucheSpeciale)}
          aria-label={toucheSpeciale === ',' ? 'Virgule' : 'Plus (indicatif international)'}
          className={`${CLASSE_TOUCHE} text-3xl font-bold`}
        >
          {toucheSpeciale}
        </button>
      ) : (
        <button type="button" disabled={desactive} onClick={onVider} className={CLASSE_TOUCHE_SECONDAIRE}>
          Vider
        </button>
      )}

      <button type="button" disabled={desactive} onClick={() => onTouche('0')} className={CLASSE_TOUCHE}>
        0
      </button>

      <button
        type="button"
        disabled={desactive}
        onClick={onEffacer}
        aria-label="Effacer le dernier caractère"
        className="h-14 rounded-xl border border-line text-xl text-ink-2 active:bg-surface-2 disabled:opacity-40"
      >
        <span aria-hidden>⌫</span>
      </button>

      {jeu === 'telephone' ? (
        <button
          type="button"
          disabled={desactive}
          onClick={() => onTouche(' ')}
          className={`col-span-2 ${CLASSE_TOUCHE_SECONDAIRE}`}
        >
          Espace
        </button>
      ) : null}

      {toucheSpeciale ? (
        <button
          type="button"
          disabled={desactive}
          onClick={onVider}
          className={`${jeu === 'telephone' ? '' : 'col-span-3'} ${CLASSE_TOUCHE_SECONDAIRE}`}
        >
          Vider
        </button>
      ) : null}
    </div>
  );
}
