'use client';

// src/components/fiche/useMaintenant.ts
//
// L'heure de Bruxelles, rafraîchie toutes les 30 s : une commande passe
// « En retard » d'elle-même à son heure de retrait, puis en rouge à 19h, sans
// que le vendeur recharge l'écran (propriétaire, 29/10/2026).

import { useEffect, useState } from 'react';
import { maintenantBruxelles } from '@/lib/dateProduction';

export function useMaintenant(): { date: string; minutes: number } {
  const [maintenant, setMaintenant] = useState(() => maintenantBruxelles());
  useEffect(() => {
    const minuteur = setInterval(() => setMaintenant(maintenantBruxelles()), 30_000);
    return () => clearInterval(minuteur);
  }, []);
  return maintenant;
}
