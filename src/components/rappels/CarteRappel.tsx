'use client';

// src/components/rappels/CarteRappel.tsx
//
// Visuel d'un rappel équipe. Volontairement DISTINCT des trois niveaux de
// signalement (LOI 8) : fond crème de la marque, pas d'icône de niveau, pas de
// bordure épaisse colorée. Ce n'est ni un refus, ni un avertissement, ni une
// information de saisie : c'est un clin d'œil.
//
// Lisible en 3 s : un emoji, un titre court en gras, une phrase.
// Aucune animation (rien à respecter côté prefers-reduced-motion).

import type { ReactNode } from 'react';
import type { Rappel } from './rappels';

export function CarteRappel({
  rappel,
  action,
  compacte = false,
}: {
  rappel: Rappel;
  /** Bouton de fermeture éventuel. */
  action?: ReactNode;
  /** Variante pour un état de chargement (moins d'espace). */
  compacte?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-line bg-accent-doux text-ink ${
        compacte ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <span aria-hidden className={`${compacte ? 'text-2xl' : 'text-3xl'} leading-none`}>
        {rappel.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Petit rappel</p>
        <p className="text-base font-semibold leading-snug">{rappel.titre}</p>
        <p className="text-base leading-snug text-ink">{rappel.texte}</p>
      </div>
      {action}
    </div>
  );
}
