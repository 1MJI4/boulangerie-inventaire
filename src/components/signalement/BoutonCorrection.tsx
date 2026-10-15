'use client';

// src/components/signalement/BoutonCorrection.tsx
//
// Le bouton de sortie : « Passer à 20 parts », « Ajouter un 2e pain »,
// « Prendre le prochain jour ouvert ». Il doit être AU MOINS aussi visible
// que le message d'erreur : c'est lui qui sauve la vente (LOI 7 et 8).
//
// Vert d'action (`--sortie`) : distinct du cramoisi du refus ET du
// rouge-orangé des prix. Cible 56 px (action répétée, au pouce).

import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> & {
  /** Texte du bouton, fourni par `libelleCorrection(code, params)` du domaine. */
  libelle: string;
  /** 'plein' pour un refus (sortie obligatoire), 'contour' pour un avertissement. */
  variante?: 'plein' | 'contour';
};

const VARIANTES = {
  plein: 'bg-sortie text-sortie-texte hover:bg-sortie-fort active:bg-sortie-fort',
  contour: 'border-2 border-sortie bg-surface text-sortie hover:bg-sortie-doux active:bg-sortie-doux',
} as const;

export function BoutonCorrection({ libelle, variante = 'plein', className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-5 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      <span>{libelle}</span>
      <span aria-hidden className="text-xl leading-none">
        →
      </span>
    </button>
  );
}
