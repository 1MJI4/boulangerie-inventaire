// src/domaine/prixComptoir.ts
//
// R60 — Décision du propriétaire du 18/10/2026 : un gâteau simple commandé
// (régime C, prix par personne) dans une TAILLE STANDARD qui existe au
// comptoir se vend comme le gâteau du COMPTOIR : la ligne devient le produit
// du comptoir (régime A, quantité 1, prix exact de la version en vigueur,
// jamais modifiable, même par le gérant). « Les gâteaux du comptoir restent
// au prix connu » (affiche). Tailles sans équivalent : régime C inchangé.
// Propriétaire : agent `regles-metier`.
//
// La correspondance est une DONNÉE explicite (src/catalogue/correspondancesComptoir.ts),
// jamais déduite du nom (LOI 6). Ce module ne fait que la LIRE : il ne connaît
// aucune clé, aucun prix, aucune taille.

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import type { FicheTarifee } from './types.ts';

/** Un gâteau sur commande, à un nombre de parts, vendu comme ce produit du comptoir. */
export type CorrespondanceComptoir = {
  /** Clé catalogue du gâteau sur commande (régime C, par personne). */
  surCommande: string;
  /** Nombre de parts (une taille standard, LOI 11). */
  parts: number;
  /** Clé catalogue du produit du comptoir (régime A, à la pièce). */
  comptoir: string;
};

/**
 * Clé du produit du comptoir qui remplace (gâteau sur commande, nb de parts),
 * ou null s'il n'y a pas d'équivalent (la ligne reste au prix par personne).
 */
export function produitComptoirPourTaille(
  produitId: string | null | undefined,
  parts: number | null | undefined,
  table: readonly CorrespondanceComptoir[],
): string | null {
  if (!produitId || typeof parts !== 'number') return null;
  return table.find((c) => c.surCommande === produitId && c.parts === parts)?.comptoir ?? null;
}

/**
 * Inverse : de quel gâteau sur commande, à quelle taille, ce produit du
 * comptoir est l'équivalent (null sinon). Sert à l'écran (boutons de taille)
 * et à reconnaître un gâteau commandé (écriture sur le gâteau).
 */
export function gateauSurCommandeDe(
  cleComptoir: string | null | undefined,
  table: readonly CorrespondanceComptoir[],
): { surCommande: string; parts: number } | null {
  if (!cleComptoir) return null;
  const c = table.find((x) => x.comptoir === cleComptoir);
  return c ? { surCommande: c.surCommande, parts: c.parts } : null;
}

/**
 * Règle R60 : un gâteau sur commande saisi au prix par personne dans une
 * taille qui existe au comptoir est refusé ; la ligne doit être le gâteau du
 * comptoir, à son prix.
 * Niveau : BLOQUANT (`ERR_PRIX_COMPTOIR`) — un autre prix que le prix du
 * comptoir est un prix faux (LOI 1). Sortie en un geste : `valeurProposee` =
 * clé du produit du comptoir, l'écran remplace la ligne.
 * N'interdit pas : une taille sans équivalent au comptoir (Crème fraîche 4
 * parts, Bavarois 15 parts…) au prix par personne ; le gâteau du comptoir
 * lui-même, à son prix.
 */
export function validerPrixComptoir(
  fiche: FicheTarifee,
  parts: number,
  table: readonly CorrespondanceComptoir[],
): Resultat<number> {
  const cle = produitComptoirPourTaille(fiche.produit.id, parts, table);
  if (cle === null) return succes(parts);
  return signaler('ERR_PRIX_COMPTOIR', { produit: fiche.produit.produit, parts }, { champ: 'quantite', valeurProposee: cle });
}
