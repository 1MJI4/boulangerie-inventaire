// src/domaine/plateaux.ts
//
// Prévisions de viennoiserie en PLATEAUX (décision du propriétaire, 17/11/2026).
// Propriétaire : agent `regles-metier`.
//
// Certains produits d'inventaire se sortent par plateau entier : le manager
// demande « 3 plateaux » de croissants, le pâtissier lit « 3 plateaux ».
// La contenance d'un plateau est une DONNÉE du produit (`Produit.piecesParPlateau`,
// 36 pour Croissant et Couque au chocolat), jamais déduite du nom.
//
// Ce qui ne change pas :
//   - la base garde des PIÈCES (prévue = plateaux × contenance + part commandée) :
//     statistiques, historique et production restent comparables ;
//   - le comptage des restes, le soir, reste en pièces ;
//   - la part due aux commandes clients (le « + ») reste en pièces : un client
//     commande 5 croissants, pas un tiers de plateau.
//
// Règle : la part prévue hors commande est TOUJOURS un nombre entier de
// plateaux (pas de demi-plateau). L'écran le garantit par construction : on y
// tape un nombre de plateaux, jamais de pièces.

/** Un produit sans contenance (null, 0, invalide) se planifie à la pièce. */
export function sePlanifieEnPlateaux(piecesParPlateau: number | null | undefined): piecesParPlateau is number {
  return Number.isSafeInteger(piecesParPlateau) && (piecesParPlateau as number) > 0;
}

/** 3 plateaux de 16 → 48 pièces. */
export function piecesDePlateaux(plateaux: number, piecesParPlateau: number): number {
  return plateaux * piecesParPlateau;
}

/**
 * Décompose des pièces en plateaux entiers + reste : 53 (par 16) → 3 plateaux + 5.
 * Le reste n'existe que pour d'anciennes données ou la part commandée.
 */
export function enPlateaux(pieces: number, piecesParPlateau: number): { plateaux: number; reste: number } {
  const p = Math.max(0, Math.trunc(pieces));
  const reste = p % piecesParPlateau;
  return { plateaux: (p - reste) / piecesParPlateau, reste };
}

/** La part prévue hors commande tombe-t-elle sur des plateaux entiers ? */
export function estEnPlateauxEntiers(pieces: number, piecesParPlateau: number): boolean {
  return Number.isSafeInteger(pieces) && pieces >= 0 && pieces % piecesParPlateau === 0;
}

/**
 * Repère proposé au manager (moyenne des jours passés, en pièces) converti en
 * plateaux : arrondi au plateau le PLUS PROCHE, au moins 1 dès qu'il y a eu
 * une production.
 * HYPOTHÈSE À VALIDER : plus proche plutôt que supérieur (un plateau de trop
 * = 36 invendus possibles ; un de moins = rupture possible). Ce n'est qu'une
 * suggestion, le manager la corrige d'un geste.
 */
export function suggestionEnPlateaux(moyennePieces: number | null | undefined, piecesParPlateau: number): number | null {
  if (moyennePieces == null || !Number.isFinite(moyennePieces) || moyennePieces <= 0) return null;
  return Math.max(1, Math.round(moyennePieces / piecesParPlateau));
}

/** « 1 plateau », « 3 plateaux », « 3 plateaux + 5 pièces », « 0 plateau ». */
export function formaterPlateaux(pieces: number, piecesParPlateau: number): string {
  const { plateaux, reste } = enPlateaux(pieces, piecesParPlateau);
  const texte = `${plateaux} plateau${plateaux > 1 ? 'x' : ''}`;
  if (reste === 0) return texte;
  return `${texte} + ${reste} pièce${reste > 1 ? 's' : ''}`;
}
