'use client';

// src/components/rappels/RappelChargement.tsx
//
// Rappel affiché DANS un état de chargement qui existe déjà (skeleton,
// spinner). Il ne crée aucun chargement et ne retarde rien :
//   - rien pendant les ~400 premières ms (un chargement rapide ne clignote pas) ;
//   - disparaît avec l'état de chargement (le parent le démonte à l'arrivée
//     des données) — aucun délai de lecture imposé.
//
// Usage : {chargement ? <div>…skeleton…<RappelChargement /></div> : contenu}

import { useEffect, useState } from 'react';
import { CarteRappel } from './CarteRappel';
import { lireVus, memoriserVu } from './memoire';
import { choisirRappel, type Rappel } from './rappels';
import { RAPPELS } from './source';

export type PropsRappelChargement = {
  /** Délai avant apparition, en ms (défaut 400). */
  delai?: number;
  /** Liste de rappels (défaut : `data/rappels-equipe.json`, embarqué au build). Pour les tests et maquettes. */
  rappels?: readonly Rappel[];
  className?: string;
};

export function RappelChargement({ delai = 400, rappels = RAPPELS, className = '' }: PropsRappelChargement) {
  const [rappel, setRappel] = useState<Rappel | null>(null);

  useEffect(() => {
    const minuteur = setTimeout(() => {
      const choisi = choisirRappel(rappels, 'chargement', lireVus());
      if (choisi) {
        memoriserVu(choisi.id);
        setRappel(choisi);
      }
    }, delai);
    return () => clearTimeout(minuteur);
  }, [delai, rappels]);

  return (
    <div role="status" aria-live="polite" className={className}>
      {rappel ? <CarteRappel rappel={rappel} compacte /> : null}
    </div>
  );
}
