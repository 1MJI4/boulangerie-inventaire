'use client';

// src/lib/useRestesVeille.ts
//
// Les RESTES du dernier comptage avant la journée qu'on planifie (propriétaire,
// 20/11/2026 : « l'information importante, c'est les restes »). Le comptage du
// restant est ce qui se fait tous les soirs ; c'est lui qui dit quoi produire.
// Pour planifier le jour D, on lit le comptage du jour D-1.
// Un produit pas compté reste absent de la table : jamais un zéro (« pas
// compté » n'est pas « il n'en reste plus »).

import { useEffect, useState } from 'react';
import { decalerJours, type DateISO } from '@/lib/dateProduction';

export type RestesVeille = {
  /** Journée comptée (D-1). */
  jour: DateISO;
  /** produitId → quantité restante, en pièces ou en grammes (produit au kilo). */
  parProduit: Map<number, number>;
};

export function useRestesVeille(date: DateISO): RestesVeille {
  const jour = decalerJours(date, -1);
  const [parProduit, setParProduit] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const reponse = await fetch(`/api/inventaires?date=${jour}&limit=2000`);
        if (!reponse.ok) throw new Error('restes indisponibles');
        const lignes: { produitId: number; quantiteRestante: number | null }[] = await reponse.json();
        if (annule) return;
        const table = new Map<number, number>();
        for (const l of lignes) if (typeof l.quantiteRestante === 'number') table.set(l.produitId, l.quantiteRestante);
        setParProduit(table);
      } catch {
        // Une aide, jamais un blocage : sans restes, l'écran se lit comme avant.
        if (!annule) setParProduit(new Map());
      }
    })();
    return () => {
      annule = true;
    };
  }, [jour]);

  return { jour, parProduit };
}
