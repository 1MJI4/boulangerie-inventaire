'use client';

// src/components/commande/ChampPave.tsx
//
// Un champ chiffré de la commande, fermé : un gros bouton qui affiche la
// valeur. Touché, il ouvre le pavé de l'application (src/components/saisie) —
// jamais le clavier du système (R37). Un seul pavé ouvert à la fois : c'est
// l'écran qui décide lequel (`ouvert`). Sans `children`, le pavé s'affiche
// ailleurs (colonne du pavé, `DispositionAvecPave`) ; avec, juste en dessous.

import type { ReactNode } from 'react';

export function ChampPave({
  libelle,
  valeur,
  vide = 'Toucher pour saisir',
  ouvert,
  onBasculer,
  enErreur = false,
  children,
  className = '',
}: {
  libelle: string;
  /** Valeur déjà formatée (« 20 parts », un montant, un poids), ou null. */
  valeur: string | null;
  vide?: string;
  ouvert: boolean;
  onBasculer: () => void;
  enErreur?: boolean;
  /** Contenu déplié sous le champ quand `ouvert` (sinon le pavé vit dans la colonne du pavé). */
  children?: ReactNode;
  className?: string;
}) {
  const bord = enErreur ? 'border-bloquant bg-bloquant-doux' : ouvert ? 'border-accent' : 'border-line-fort';
  return (
    <div className={`min-w-0 ${className}`}>
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={onBasculer}
        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 bg-surface px-4 text-left ${bord}`}
      >
        <span className="text-sm text-ink-2">{libelle}</span>
        <span className={`chiffres text-xl font-semibold ${valeur === null ? 'text-ink-3' : 'text-ink'}`}>
          {valeur ?? vide}
        </span>
      </button>
      {ouvert && children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
