// src/domaine/supplements.ts
//
// R7 — Suppléments au forfait (Photo, Écriture… : `basePrix = 'forfait'` au
// catalogue) : « une fois par gâteau, jamais par personne » (affiche).
// Propriétaire : agent `regles-metier`.
//
// « Gâteau » est défini par les DONNÉES du produit, jamais par son nom :
//   - régime C vendu par personne (Layer Cake, mariage, Number Cake…) : la
//     ligne est UN gâteau, quel que soit le nombre de parts ;
//   - régime C vendu à la pièce (minis) : la ligne (le plateau) est UN gâteau ;
//   - régime A à la pièce, d'une famille « gâteau » (FAMILLES_GATEAU) : chaque
//     pièce est un gâteau (2 Bavarois 6P = 2 gâteaux) ;
//   - tout le reste (kilo, traiteur B, viennoiserie, supplément — y compris
//     par personne, famille « supplement » —, ligne libre) : 0.
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°60) : plateau de minis = un gâteau ;
// pâtisserie individuelle du comptoir (éclair…) = un gâteau par pièce.

import type { Echec } from './resultat.ts';
import { signaler } from './messages.ts';
import { FAMILLE_SUPPLEMENT } from './constantes.ts';
import type { BasePrix, RegimePrix } from './types.ts';

export type RepereGateau = {
  regimePrix: RegimePrix | null;
  basePrix: BasePrix | null;
  quantite: number;
  /** `Produit.famille` du catalogue ; null = ligne libre. */
  famille: string | null;
};

/** Nombre de gâteaux qu'apporte une ligne (cf. définition en tête de fichier). */
export function gateauxDeLigne(l: RepereGateau, famillesGateau: readonly string[]): number {
  if (l.basePrix === 'forfait' || l.basePrix === 'kg' || l.basePrix === null) return 0;
  // Un supplément n'est jamais un gâteau, même vendu par personne (Pâte à sucre,
  // R64, 26/10/2026) : la famille du catalogue le dit, avant le régime.
  if (l.famille === FAMILLE_SUPPLEMENT) return 0;
  // Gâteau sur commande vendu par personne. Les minis (régime C à la pièce :
  // tartelettes, éclairs…) ne sont pas des gâteaux : ni écriture ni photo (22/10/2026).
  if (l.regimePrix === 'C') return l.basePrix === 'personne' ? 1 : 0;
  if (l.regimePrix === 'A' && l.basePrix === 'piece' && l.famille !== null && famillesGateau.includes(l.famille)) {
    return Number.isSafeInteger(l.quantite) && l.quantite > 0 ? l.quantite : 0;
  }
  return 0;
}

export type RepereSupplement = {
  produitId: string | null;
  basePrix: BasePrix | null;
  quantite: number;
  /** Gâteaux apportés par la ligne (`gateauxDeLigne`). */
  nbGateaux: number;
};

/**
 * Règle R7 : un supplément au forfait se compte au plus une fois par gâteau de
 * la commande, et n'existe pas sans gâteau.
 * Niveau : BLOQUANT (un supplément de trop = un prix faux, LOI 1 ; « 40 photos »
 * pour un Layer Cake de 40 parts est l'erreur à empêcher).
 *  - aucun gâteau → ERR_SUPPLEMENT_SANS_GATEAU, sortie : supprimer la ligne
 *    (`valeurProposee` = index de la ligne, comme ERR_LIGNE_SANS_PRODUIT) ;
 *  - quantité cumulée d'un même supplément > nombre de gâteaux →
 *    ERR_SUPPLEMENT_TROP_NOMBREUX { max }, `valeurProposee` = quantité à
 *    mettre sur la ligne fautive pour atteindre exactement le maximum.
 * Champ : `lignes[i].quantite` (ou `.produitId` sans gâteau).
 * N'interdit pas : Photo ET Écriture sur le même gâteau (suppléments
 * différents) ; deux gâteaux, deux photos ; un gâteau sans supplément.
 */
export function controlerSupplements(lignes: readonly RepereSupplement[]): Echec[] {
  const max = lignes.reduce((n, l) => n + (l.basePrix === 'forfait' ? 0 : l.nbGateaux), 0);
  const blocages: Echec[] = [];
  const dejaCompte = new Map<string, number>();
  lignes.forEach((l, i) => {
    if (l.basePrix !== 'forfait') return;
    if (max === 0) {
      blocages.push(signaler('ERR_SUPPLEMENT_SANS_GATEAU', {}, { champ: `lignes[${i}].produitId`, valeurProposee: i }));
      return;
    }
    const cle = l.produitId ?? `#${i}`;
    const avant = dejaCompte.get(cle) ?? 0;
    dejaCompte.set(cle, avant + l.quantite);
    if (avant + l.quantite > max) {
      blocages.push(
        signaler('ERR_SUPPLEMENT_TROP_NOMBREUX', { max }, {
          champ: `lignes[${i}].quantite`,
          valeurProposee: Math.max(0, max - avant),
        }),
      );
    }
  });
  return blocages;
}
