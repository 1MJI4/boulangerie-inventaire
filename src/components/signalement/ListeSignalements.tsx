'use client';

// src/components/signalement/ListeSignalements.tsx
//
// Plusieurs signalements : bloquants d'abord, puis avertissements, puis
// informations ; doublons (code + champ) retirés. Le tri est dans `trier.ts`
// (fonction pure, testée).

import type { ReactNode } from 'react';
import { Signalement } from './Signalement';
import { cleSignalement, trierSignalements, type SignalementAffichable } from './trier';

export type PropsListeSignalements = {
  signalements: readonly SignalementAffichable[];
  /** Libellé du bouton de sortie pour un signalement (via `libelleCorrection` du domaine). */
  libelleCorrectionPour?: (s: SignalementAffichable) => string | undefined;
  /** Appelé avec le signalement corrigé et sa `valeurProposee`. */
  onCorriger?: (s: SignalementAffichable, valeurProposee: unknown) => void;
  /** Sortie alternative pour un signalement sans valeur proposée. */
  autreSortiePour?: (s: SignalementAffichable) => ReactNode;
  /** Préfixe des `id` (`${prefixeId}-${code}-${champ}`) pour `aria-describedby`. */
  prefixeId?: string;
  className?: string;
};

export function ListeSignalements({
  signalements,
  libelleCorrectionPour,
  onCorriger,
  autreSortiePour,
  prefixeId,
  className = '',
}: PropsListeSignalements) {
  const tries = trierSignalements(signalements);
  if (tries.length === 0) return null;

  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {tries.map((s) => {
        const cle = cleSignalement(s);
        return (
          <li key={cle}>
            <Signalement
              signalement={s}
              id={prefixeId ? idSignalement(prefixeId, s) : undefined}
              libelleCorrection={libelleCorrectionPour?.(s)}
              onCorriger={onCorriger ? (v) => onCorriger(s, v) : undefined}
              autreSortie={autreSortiePour?.(s)}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Id stable d'un signalement, à mettre dans `aria-describedby` du champ fautif. */
export function idSignalement(prefixe: string, s: { code: string; champ?: string }): string {
  return `${prefixe}-${s.code}-${s.champ ?? 'general'}`.replace(/[^A-Za-z0-9_-]/g, '_');
}
