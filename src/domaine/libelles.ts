// src/domaine/libelles.ts
//
// Libellé affiché d'un produit : produit + sous-catégorie, chacun À LA LETTRE
// (LOI 5) : « Bavarois 6P ». Seul endroit qui les assemble (commande.ts le
// réexporte sous le nom `libelleProduit`).
// Propriétaire : agent `regles-metier`.

import type { FicheTarifee } from './types.ts';

export function libelleProduitFiche(fiche: FicheTarifee): string {
  const sc = fiche.produit.sousCategorie?.trim();
  return sc ? `${fiche.produit.produit} ${sc}` : fiche.produit.produit;
}
