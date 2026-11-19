'use client';

// src/lib/usePartCommandee.ts
//
// R72 — part des commandes clients pour une journée de production, lue sur
// /api/inventaires/commandes (qui recalcule et enregistre). Aucune règle ici.
// En cas d'échec (réseau), l'écran garde la dernière valeur connue : cette
// part est une aide, elle ne doit jamais empêcher de saisir.

import { useEffect, useState } from 'react';
import type { PartCommandeeJournee, PartFournil } from '@/lib/serveur/partCommandee';

/** Les commandes arrivent pendant que l'écran reste ouvert. */
const INTERVALLE_MS = 60_000;

export function usePartCommandee(journee: string) {
  const [donnees, setDonnees] = useState<PartCommandeeJournee | null>(null);

  useEffect(() => {
    let vivant = true;
    const charger = () => {
      fetch(`/api/inventaires/commandes?date=${journee}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((lu: PartCommandeeJournee | null) => {
          if (vivant && lu) setDonnees(lu);
        })
        .catch(() => {});
    };
    charger();
    const tic = setInterval(() => {
      if (document.visibilityState === 'visible') charger();
    }, INTERVALLE_MS);
    return () => {
      vivant = false;
      clearInterval(tic);
    };
  }, [journee]);

  // Une réponse d'une autre journée (changement de date en cours) est écartée.
  const valide = donnees && donnees.journee === journee ? donnees : null;
  const parProduit = new Map<number, PartFournil>((valide?.bases ?? []).map((b) => [b.produitId, b]));
  return { parProduit, resumes: valide?.resumes ?? [] };
}
