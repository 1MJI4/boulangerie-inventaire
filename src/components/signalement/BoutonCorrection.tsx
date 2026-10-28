'use client';

// src/components/signalement/BoutonCorrection.tsx
//
// Le bouton de sortie : « Passer à 20 parts », « Ajouter un 2e pain »,
// « Prendre le prochain jour ouvert ». Il doit être AU MOINS aussi visible
// que le message d'erreur : c'est lui qui sauve la vente (LOI 7 et 8).
//
// Vert d'action (`--sortie`) : distinct du rouge du refus ET de l'accent des
// prix. Bouton en pilule, sobre (style Apple, 28/10/2026), cible 44 px au doigt.

import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> & {
  /** Texte du bouton, fourni par `libelleCorrection(code, params)` du domaine. */
  libelle: string;
  /** 'plein' pour un refus (sortie obligatoire), 'contour' pour un avertissement. */
  variante?: 'plein' | 'contour';
};

const VARIANTES = {
  plein: 'bg-sortie text-sortie-texte hover:bg-sortie-fort active:bg-sortie-fort',
  contour: 'bg-sortie-doux text-sortie hover:brightness-95 active:brightness-95',
} as const;

export function BoutonCorrection({ libelle, variante = 'plein', className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {libelle}
    </button>
  );
}
