'use client';

// src/components/inventaire/SignalementsLigne.tsx
//
// Signalements d'UNE ligne d'inventaire (LOI 8), rendus par les composants
// de `design-ux`. Tout refus porte sa sortie : effacer la saisie et recompter.
// Propriétaire : `inventaire-scan`.

import { ListeSignalements } from '@/components/signalement';
import type { SignalementLigne } from '@/lib/inventaire/controles';

export function SignalementsLigne({
  signalements,
  onEffacer,
  className = '',
}: {
  signalements: readonly SignalementLigne[];
  /** Sortie des refus : vider la ligne pour la recompter. */
  onEffacer: () => void;
  className?: string;
}) {
  if (signalements.length === 0) return null;
  return (
    <ListeSignalements
      className={className}
      signalements={signalements}
      autreSortiePour={(s) =>
        s.niveau === 'bloquant' ? (
          <button
            type="button"
            onClick={onEffacer}
            className="min-h-11 rounded-lg border border-line-fort bg-surface px-3 text-sm font-medium text-ink"
          >
            Effacer et recompter
          </button>
        ) : null
      }
    />
  );
}
