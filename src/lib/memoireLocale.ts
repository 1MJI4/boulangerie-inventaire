'use client';

// src/lib/memoireLocale.ts
// Petit réglage retenu par l'appareil : le poste du fournil, les rayons
// dépliés du manager. Rien de sensible, rien de partagé.

import { useCallback, useEffect, useState } from 'react';

export function useMemoireLocale<T>(cle: string, valeurParDefaut: T) {
  // Premier rendu identique au serveur : la vraie valeur arrive juste après,
  // sinon React signale une divergence entre les deux rendus.
  const [valeur, setValeurEtat] = useState<T>(valeurParDefaut);
  const [prete, setPrete] = useState(false);

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(cle);
      if (brut !== null) setValeurEtat(JSON.parse(brut) as T);
    } catch {
      /* navigation privée : on garde la valeur par défaut */
    }
    setPrete(true);
  }, [cle]);

  const definir = useCallback(
    (suivante: T) => {
      setValeurEtat(suivante);
      try {
        window.localStorage.setItem(cle, JSON.stringify(suivante));
      } catch {
        /* le réglage vaut au moins pour la session en cours */
      }
    },
    [cle]
  );

  return [valeur, definir, prete] as const;
}
