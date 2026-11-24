'use client';

// La journée de production affichée par les écrans du fournil, avec les jours
// fermés lus sur /api/calendrier (LOI 3 : une DONNÉE, jamais une constante).
//
// Au premier affichage, journée « d'origine » (jour calendaire) : aucun temps
// d'attente. Dès que les fermetures arrivent, on passe au prochain jour OUVERT
// (lundi soir, mardi fermé → mercredi) — sauf si la personne a déjà choisi un
// autre jour : on ne lui change jamais sa journée sous les doigts. Si le
// calendrier ne répond pas (réseau faible), on garde la journée d'origine.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JourFerme } from '@/domaine/calendrier';
import { journeeProduction, type DateISO } from '@/lib/dateProduction';

export function useJourneeProduction(): [DateISO, (date: DateISO) => void] {
  const [date, setDateEtat] = useState<DateISO>(() => journeeProduction());
  const choisie = useRef(false);

  useEffect(() => {
    let vivant = true;
    fetch('/api/calendrier', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { joursFermes?: JourFerme[] } | null) => {
        if (!vivant || choisie.current || !c || !Array.isArray(c.joursFermes)) return;
        setDateEtat(journeeProduction(new Date(), c.joursFermes));
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  const setDate = useCallback((d: DateISO) => {
    choisie.current = true;
    setDateEtat(d);
  }, []);

  return [date, setDate];
}
