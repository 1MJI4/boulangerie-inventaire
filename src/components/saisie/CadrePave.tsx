'use client';

// src/components/saisie/CadrePave.tsx
//
// Habillage commun des pavés : libellé, afficheur (pas d'<input> : jamais le
// clavier du système), clavier, bouton de validation. Interne à `saisie/`.

import type { KeyboardEvent, ReactNode } from 'react';
import { ClavierPave } from './ClavierPave';
import { effacerDernier, toucheDepuisClavier, type JeuTouches } from './mecanique';

export type PropsCommunesPave = {
  /** Libellé du champ ou du produit, tel qu'au catalogue (LOI 5). */
  libelle: string;
  /** Texte du bouton de validation (défaut « Valider »). */
  libelleValider?: string;
  /** État erreur : cadre de l'afficheur en couleur de refus (le message vient d'un `Signalement`). */
  enErreur?: boolean;
  desactive?: boolean;
  /** `aria-describedby` de l'afficheur (id du `Signalement` lié). */
  decritPar?: string;
};

type PropsCadre = PropsCommunesPave & {
  sousTitre?: string;
  libelleAccessible: string;
  texte: string;
  /** Unité affichée en gros à droite (« kg », « € », « parts »). */
  suffixe?: ReactNode;
  /** Ligne d'aide sous l'afficheur (« = 1,250 kg »). Absente → pas de ligne. */
  aide?: string;
  jeu: JeuTouches;
  /** Remplace le texte (effacer, vider). */
  onTexte: (texte: string) => void;
  /** Applique une touche (chiffre, virgule, +, espace). */
  onTouche: (touche: string) => void;
  /** Présent → bouton de validation. */
  onValider?: () => void;
  /** Le domaine accepte-t-il la saisie ? Sinon « Valider » est désactivé. */
  valeurValide: boolean;
};

export function CadrePave({
  libelle,
  sousTitre,
  libelleAccessible,
  texte,
  suffixe,
  aide,
  jeu,
  onTexte,
  onTouche,
  onValider,
  valeurValide,
  libelleValider = 'Valider',
  enErreur = false,
  desactive = false,
  decritPar,
}: PropsCadre) {
  function valider() {
    if (onValider && valeurValide && !desactive) onValider();
  }

  function auClavier(e: KeyboardEvent<HTMLDivElement>) {
    if (desactive) return;
    const t = toucheDepuisClavier(e.key, jeu);
    if (t === null) return;
    e.preventDefault();
    if (t === 'effacer') onTexte(effacerDernier(texte));
    else if (t === 'valider') valider();
    else onTouche(t);
  }

  const cadre = enErreur ? 'border-2 border-bloquant bg-bloquant-doux' : 'border-2 border-line-fort bg-surface-2';

  return (
    <div className="w-full max-w-md" onKeyDown={auClavier}>
      <div className="mb-3 min-w-0">
        <div className="truncate text-base font-medium text-ink">{libelle}</div>
        {sousTitre ? <div className="text-sm text-ink-2">{sousTitre}</div> : null}
      </div>

      <div
        role="textbox"
        aria-readonly
        tabIndex={desactive ? -1 : 0}
        aria-label={libelleAccessible}
        aria-invalid={enErreur || undefined}
        aria-describedby={decritPar}
        className={`mb-3 flex items-baseline justify-end gap-2 rounded-xl px-4 py-2 ${cadre}`}
      >
        <span className="chiffres min-w-0 truncate text-5xl font-semibold text-ink">{texte === '' ? '—' : texte}</span>
        {suffixe}
      </div>
      {aide !== undefined ? (
        <div className="chiffres -mt-2 mb-3 min-h-5 text-right text-sm text-ink-2" aria-live="polite">
          {aide}
        </div>
      ) : null}

      <ClavierPave
        jeu={jeu}
        desactive={desactive}
        onTouche={onTouche}
        onEffacer={() => onTexte(effacerDernier(texte))}
        onVider={() => onTexte('')}
      />

      {onValider ? (
        <button
          type="button"
          onClick={valider}
          disabled={desactive || !valeurValide}
          className="mt-2 h-14 w-full rounded-xl bg-accent text-base font-semibold text-white active:bg-accent-fort disabled:bg-ink-3 disabled:opacity-60"
        >
          {libelleValider}
        </button>
      ) : null}
    </div>
  );
}
