'use client';

// src/components/saisie/taillePave.ts
//
// Taille des pavés. « compact » : touches de 48 px (cible tactile minimale),
// grille resserrée, afficheur sur une ligne — pour tenir À CÔTÉ du contenu
// sur une tablette. `DispositionAvecPave` fournit « compact » par contexte ;
// la prop `taille` d'un pavé l'emporte toujours.

import { createContext, useContext } from 'react';

export type TaillePave = 'normal' | 'compact';

export const ContexteTaillePave = createContext<TaillePave>('normal');

export function useTaillePave(taille?: TaillePave): TaillePave {
  const duContexte = useContext(ContexteTaillePave);
  return taille ?? duContexte;
}
