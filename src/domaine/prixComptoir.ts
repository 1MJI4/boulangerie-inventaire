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
  /**
   * Goût du gâteau commandé qui choisit CE produit du comptoir (propriétaire,
   * 28/10/2026 : Bavarois goût Framboise en 6 parts = « Bavarois framboise
   * 6P »). Absent : l'entrée vaut pour tout autre goût (ou aucun).
   */
  gout?: string;
};

/** Comparaison de goûts : sans casse ni espaces en trop (« framboise » = « Framboise »). */
function memeGout(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('fr') === b.trim().toLocaleLowerCase('fr');
}

/**
 * Le goût qui peut choisir un produit du comptoir : le goût UNIQUE de la ligne
 * (un gâteau à un seul étage). Aucun goût, plusieurs étages, « Autre » vide :
 * null (l'entrée sans goût s'applique).
 */
export function goutDeLaLigne(gouts: readonly string[] | null | undefined): string | null {
  const g = (gouts ?? []).map((x) => x.trim()).filter(Boolean);
  return g.length === 1 ? g[0] : null;
}

/**
 * Clé du produit du comptoir qui remplace (gâteau sur commande, nb de parts,
 * goût), ou null s'il n'y a pas d'équivalent (la ligne reste au prix par
 * personne). L'entrée AU GOÛT de la ligne d'abord (« Bavarois framboise 6P »),
 * sinon l'entrée sans goût (« Bavarois 6P »).
 */
export function produitComptoirPourTaille(
  produitId: string | null | undefined,
  parts: number | null | undefined,
  table: readonly CorrespondanceComptoir[],
  gout?: string | null,
): string | null {
  if (!produitId || typeof parts !== 'number') return null;
  const taille = table.filter((c) => c.surCommande === produitId && c.parts === parts);
  const auGout = gout ? taille.find((c) => c.gout !== undefined && memeGout(c.gout, gout)) : undefined;
  return (auGout ?? taille.find((c) => c.gout === undefined))?.comptoir ?? null;
}

/**
 * Inverse : de quel gâteau sur commande, à quelle taille, ce produit du
 * comptoir est l'équivalent (null sinon). Sert à l'écran (boutons de taille)
 * et à reconnaître un gâteau commandé (écriture sur le gâteau).
 */
export function gateauSurCommandeDe(
  cleComptoir: string | null | undefined,
  table: readonly CorrespondanceComptoir[],
): { surCommande: string; parts: number; gout: string | null } | null {
  if (!cleComptoir) return null;
  const c = table.find((x) => x.comptoir === cleComptoir);
  return c ? { surCommande: c.surCommande, parts: c.parts, gout: c.gout ?? null } : null;
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
  gouts?: readonly string[] | null,
): Resultat<number> {
  const cle = produitComptoirPourTaille(fiche.produit.id, parts, table, goutDeLaLigne(gouts));
  if (cle === null) return succes(parts);
  return signaler('ERR_PRIX_COMPTOIR', { produit: fiche.produit.produit, parts }, { champ: 'quantite', valeurProposee: cle });
}

/**
 * Règle R60 au goût (propriétaire, 28/10/2026) : une ligne du COMPTOIR qui
 * remplace un gâteau sur commande (`origineSurCommande`) doit être le produit
 * que la table donne pour ce gâteau, cette taille et le goût de la ligne.
 * « Bavarois 6P » goût Framboise → refusé, « Bavarois framboise 6P » proposé ;
 * « Bavarois framboise 6P » goût Mangue → « Bavarois mangue 6P » proposé.
 * Niveau : BLOQUANT (`ERR_PRIX_COMPTOIR`, champ `quantite`), même sortie que
 * `validerPrixComptoir` : `valeurProposee` = la bonne clé du comptoir, ou la
 * clé du gâteau sur commande s'il n'y en a aucune (retour au prix par personne).
 * `libelleOrigine` : nom du gâteau commandé, pour le message.
 * N'interdit pas : un achat au comptoir (sans origine), une ligne d'une autre
 * origine, le bon produit au bon goût.
 */
export function validerComptoirSelonGout(
  produitId: string,
  origineSurCommande: string | null | undefined,
  gouts: readonly string[] | null | undefined,
  table: readonly CorrespondanceComptoir[],
  libelleOrigine: string,
): Resultat<string> {
  const de = gateauSurCommandeDe(produitId, table);
  if (!de || !origineSurCommande || origineSurCommande !== de.surCommande) return succes(produitId);
  const attendu = produitComptoirPourTaille(de.surCommande, de.parts, table, goutDeLaLigne(gouts));
  if (attendu === produitId) return succes(produitId);
  return signaler(
    'ERR_PRIX_COMPTOIR',
    { produit: libelleOrigine, parts: de.parts },
    { champ: 'quantite', valeurProposee: attendu ?? de.surCommande },
  );
}
