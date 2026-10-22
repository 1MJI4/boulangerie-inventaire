'use client';

// src/components/saisie/CadrePave.tsx
//
// Habillage commun des pavés : libellé, afficheur (pas d'<input> : jamais le
// clavier du système), clavier, bouton de validation. Interne à `saisie/`.

import type { KeyboardEvent, ReactNode } from 'react';
import { ClavierPave } from './ClavierPave';
import { effacerDernier, toucheDepuisClavier, type JeuTouches } from './mecanique';
import { useTaillePave, type TaillePave } from './taillePave';

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
  /**
   * « compact » : touches de 48 px, afficheur sur une ligne, pour tenir à côté
   * du contenu. Défaut : celui de `DispositionAvecPave` (compact), sinon « normal ».
   */
  taille?: TaillePave;
};

type PropsCadre = PropsCommunesPave & {
  sousTitre?: string;
  libelleAccessible: string;
  texte: string;
  /** Le nombre affiché sera remplacé par le premier chiffre tapé : on le montre surligné. */
  aRemplacer?: boolean;
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
  aRemplacer = false,
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
  taille: tailleDemandee,
}: PropsCadre) {
  const compact = useTaillePave(tailleDemandee) === 'compact';
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

  const afficheur = (
    <div
      role="textbox"
      aria-readonly
      tabIndex={desactive ? -1 : 0}
      aria-label={libelleAccessible}
      aria-invalid={enErreur || undefined}
      aria-describedby={decritPar}
      className={`flex min-w-0 items-baseline justify-end gap-2 rounded-xl ${
        compact ? 'h-12 px-3' : 'mb-3 px-4 py-2'
      } ${cadre}`}
    >
      <span className={`chiffres min-w-0 truncate font-semibold text-ink ${
        compact ? (texte.length > 8 ? 'text-xl' : 'text-3xl') : 'text-5xl'
      } ${aRemplacer && texte !== '' ? 'rounded-md bg-accent-doux px-1.5 text-accent' : ''}`}>
        {texte === '' ? '—' : texte}
      </span>
      {suffixe}
    </div>
  );

  if (compact) {
    // Une seule ligne au-dessus des touches : libellé à gauche, afficheur à droite.
    // L'aide (« = 1,250 kg ») et le sous-titre passent en petite ligne dessous.
    return (
      <div className="w-full max-w-xs" onKeyDown={auClavier}>
        <div className="mb-1.5 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2">
          <div className="min-w-0 truncate text-base font-medium leading-tight text-ink" title={libelle}>
            {libelle}
          </div>
          {afficheur}
        </div>
        {sousTitre !== undefined || aide !== undefined ? (
          <div className="mb-1.5 flex min-h-5 items-baseline justify-between gap-2 text-sm text-ink-2">
            <span className="min-w-0 truncate">{sousTitre}</span>
            {aide !== undefined ? (
              <span className="chiffres shrink-0" aria-live="polite">
                {aide}
              </span>
            ) : null}
          </div>
        ) : null}

        <ClavierPave
          jeu={jeu}
          taille="compact"
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
            className="mt-1.5 h-12 w-full rounded-xl bg-accent text-base font-semibold text-white active:bg-accent-fort disabled:bg-ink-3 disabled:opacity-60"
          >
            {libelleValider}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md" onKeyDown={auClavier}>
      <div className="mb-3 min-w-0">
        <div className="truncate text-base font-medium text-ink">{libelle}</div>
        {sousTitre ? <div className="text-sm text-ink-2">{sousTitre}</div> : null}
      </div>

      {afficheur}
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
