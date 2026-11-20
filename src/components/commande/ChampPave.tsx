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
  compact = false,
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
  /** Écrans courts (colonne de paiement) : champ plus bas, chiffre plus petit. */
  compact?: boolean;
}) {
  const bord = enErreur ? 'border-bloquant bg-bloquant-doux' : ouvert ? 'border-accent bg-surface' : 'border-transparent bg-segment-fond';
  return (
    <div className={`min-w-0 ${className}`}>
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={onBasculer}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 text-left ${compact ? 'min-h-12 px-3' : 'min-h-14 px-4'} ${bord}`}
      >
        <span className="text-sm text-ink-2">{libelle}</span>
        <span className={`chiffres font-semibold ${compact ? 'text-lg' : 'text-xl'} ${valeur === null ? 'text-ink-3' : 'text-ink'}`}>
          {valeur ?? vide}
        </span>
      </button>
      {ouvert && children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
