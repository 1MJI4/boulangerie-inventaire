'use client';

// src/components/saisie/BasculeCotePave.tsx
//
// Petit bouton « Pavé à droite / à gauche », pour l'en-tête ou les réglages.
// Il affiche l'état ACTUEL (texte + flèche, jamais la couleur seule) et le
// change d'un geste. Mémorisé sur l'appareil (`useCotePave`).

import { useCotePave } from '@/lib/preferencesSaisie';

export type PropsBasculeCotePave = {
  className?: string;
};

export function BasculeCotePave({ className = '' }: PropsBasculeCotePave) {
  const [cote, definir] = useCotePave();
  const autre = cote === 'droite' ? 'gauche' : 'droite';

  return (
    <button
      type="button"
      onClick={() => definir(autre)}
      aria-label={`Pavé à ${cote} — toucher pour le mettre à ${autre}`}
      className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-line-fort bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-2 active:bg-surface-2 ${className}`}
    >
      <span aria-hidden className="text-lg leading-none">
        {cote === 'droite' ? '▭▮' : '▮▭'}
      </span>
      <span>Pavé à {cote}</span>
    </button>
  );
}
