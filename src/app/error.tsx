'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Frontière d'erreur de l'application. Sans ce fichier, une erreur de rendu
 * laissait l'utilisateur devant un écran blanc, sans moyen de repartir.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold text-ink">Cet écran n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-sm text-ink-2 text-pretty">
        Les saisies déjà enregistrées sont intactes, et celles en cours restent
        conservées sur cet appareil.
      </p>

      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-fort"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-line-fort px-4 text-sm font-medium text-ink hover:bg-surface-2"
        >
          Accueil
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-6 text-xs text-ink-3">Référence technique : {error.digest}</p>
      ) : null}
    </div>
  );
}
