'use client';

import { useState } from 'react';
import { RAPPELS_FIN_DE_SERVICE } from '@/lib/rappelsService';

/**
 * Affiché au bas du comptage. Volontairement sans cases à cocher : c'est un
 * aide-mémoire, pas une procédure à valider. Il se déplie tout seul quand le
 * comptage est terminé, moment où le vendeur s'attaque justement à ces gestes.
 */
export function RappelsService({ comptageTermine }: { comptageTermine: boolean }) {
  const [ouvertManuellement, setOuvertManuellement] = useState<boolean | null>(null);
  const ouvert = ouvertManuellement ?? comptageTermine;

  return (
    <section className="sans-impression mt-6 rounded-xl border border-line bg-surface-2">
      <button
        type="button"
        onClick={() => setOuvertManuellement(!ouvert)}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="text-sm font-medium text-ink">Avant de partir</span>
          <span className="ml-2 text-xs text-ink-3">
            hygiène, machine à café, frigo, réassort
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-ink-3">
          {ouvert ? '▴' : '▾'}
        </span>
      </button>

      {ouvert ? (
        <div className="grid gap-5 border-t border-line px-4 py-4 sm:grid-cols-2">
          {RAPPELS_FIN_DE_SERVICE.map((groupe) => (
            <div key={groupe.titre}>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-accent">
                {groupe.titre}
              </h3>
              <ul className="space-y-1">
                {groupe.points.map((point) => (
                  <li key={point} className="flex gap-2 text-sm text-ink-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-line-fort" />
                    <span className="text-pretty">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
