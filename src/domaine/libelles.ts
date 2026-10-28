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

/** Un gâteau sur commande qui, à ce goût, porte un autre nom (Bavarois goût Fraisier → « Fraisier »). */
export type LibelleSelonGout = { produit: string; gout: string; libelle: string };

/**
 * Libellé à montrer pour (produit, goûts) quand la table en donne un
 * (src/catalogue/libellesSelonGout.ts), sinon null (libellé habituel). Seul
 * le goût UNIQUE d'un gâteau à un étage compte ; comparaison sans casse ni
 * espaces en trop. Quand un libellé est rendu, le goût est DANS le nom : le
 * bon n'imprime pas en plus « GOÛT : … ».
 */
export function libelleSelonGout(
  produitId: string | null | undefined,
  gouts: readonly string[] | null | undefined,
  table: readonly LibelleSelonGout[],
): string | null {
  if (!produitId) return null;
  const g = (gouts ?? []).map((x) => x.trim()).filter(Boolean);
  if (g.length !== 1) return null;
  const cle = g[0].toLocaleLowerCase('fr');
  return table.find((e) => e.produit === produitId && e.gout.trim().toLocaleLowerCase('fr') === cle)?.libelle ?? null;
}
