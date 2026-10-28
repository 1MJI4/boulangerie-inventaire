'use client';

// src/app/connexion/FormulaireConnexion.tsx
// Saisie du code de tablette, une seule fois à l'installation.
// Propriétaire : agent `securite`.

import { useActionState } from 'react';
import { installerTablette, type EtatConnexion } from './actions';
import { typographier } from '@/domaine/messages';

const ETAT_INITIAL: EtatConnexion = { message: null };

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, envoyer, enCours] = useActionState(installerTablette, ETAT_INITIAL);

  return (
    <form action={envoyer} className="mt-6 space-y-4">
      <input type="hidden" name="suite" value={suite} />

      <label className="block">
        <span className="text-sm font-medium text-ink">Code de la tablette</span>
        <input
          name="code"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={256}
          autoFocus
          className="mt-1 block min-h-12 w-full rounded-lg border border-line-fort bg-surface px-3 text-base tracking-widest text-ink"
        />
      </label>

      {etat.message ? (
        <p role="alert" className="rounded-lg border border-line-fort bg-surface-2 p-3 text-sm text-ink">
          {typographier(etat.message)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enCours}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-4 text-base font-medium text-white hover:bg-accent-fort disabled:opacity-60"
      >
        {enCours ? 'Vérification…' : 'Installer la tablette'}
      </button>
    </form>
  );
}
