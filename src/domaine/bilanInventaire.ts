// src/domaine/bilanInventaire.ts
//
// Bilan d'une journée d'inventaire pour le tableau de bord du manager.
//
// Constat du propriétaire sur les vraies données (19/11/2026) : les restes sont
// comptés chaque soir, mais la production du fournil ne l'est souvent pas. Le
// tableau de bord disait alors « pas encore compté » et « Produit 0 » pour des
// produits dont le reste était bel et bien là. Trois choses à ne jamais
// confondre :
//
//   - une quantité INCONNUE (null) n'est pas zéro : elle ne s'additionne pas,
//     elle ne s'affiche pas « 0 » ;
//   - le RESTE seul est déjà une information (invendus, produit à zéro) ;
//   - le VENDU ne se calcule que si production ET reste sont connus.
//
// Fonctions pures, sans date ni base : le tableau de bord leur donne les lignes.

export type LigneBilan = {
  nom: string;
  /** null = pas encore compté (≠ 0). */
  quantiteRestante: number | null;
  /** null = production non saisie (≠ 0). */
  quantiteProduite: number | null;
  /** 'kg' : quantités en grammes, jamais additionnées à des pièces (LOI 2). Absent = pièce. */
  unite?: string | null;
};

export type EtatLigne = 'complet' | 'production_manquante' | 'reste_manquant' | 'rien';

/** Ce que l'on sait d'un produit ce jour-là. */
export function etatLigne(l: LigneBilan): EtatLigne {
  const reste = l.quantiteRestante != null;
  const production = l.quantiteProduite != null;
  if (reste && production) return 'complet';
  if (reste) return 'production_manquante';
  if (production) return 'reste_manquant';
  return 'rien';
}

/** Vendu = produit − reste, jamais négatif ; null si l'un des deux manque. */
export function venduDeLaLigne(l: LigneBilan): number | null {
  if (l.quantiteProduite == null || l.quantiteRestante == null) return null;
  return Math.max(0, l.quantiteProduite - l.quantiteRestante);
}

/** Part vendue en pour cent (entier) ; null si inconnue ou production nulle. */
export function tauxDeLaLigne(l: LigneBilan): number | null {
  const vendu = venduDeLaLigne(l);
  if (vendu === null || !l.quantiteProduite || l.quantiteProduite <= 0) return null;
  return Math.round((vendu / l.quantiteProduite) * 100);
}

const estAuPoids = (l: LigneBilan) => l.unite === 'kg';

export type BilanJournee = {
  /** Produits de la journée. */
  produits: number;
  /** Produits dont le reste a été compté. */
  restesComptes: number;
  /** Produits dont la production a été saisie. */
  productionsSaisies: number;
  /** Somme des restes comptés, en pièces (produits au poids exclus). null si aucun reste compté. */
  resteTotalPieces: number | null;
  /** Produits comptés à zéro : tout est parti, peut-être avant la fermeture. */
  aZero: string[];
  /** Production et vendu : seulement sur les produits où les deux valeurs sont connues, en pièces. */
  produitTotalPieces: number | null;
  venduTotalPieces: number | null;
  /** Part vendue (entier, %) sur ces mêmes produits ; null si aucun. */
  tauxVente: number | null;
};

export function bilanJournee(lignes: readonly LigneBilan[]): BilanJournee {
  const comptees = lignes.filter((l) => l.quantiteRestante != null);
  const enPieces = comptees.filter((l) => !estAuPoids(l));
  const completes = lignes.filter((l) => etatLigne(l) === 'complet' && !estAuPoids(l));
  const produit = completes.reduce((s, l) => s + (l.quantiteProduite ?? 0), 0);
  const vendu = completes.reduce((s, l) => s + (venduDeLaLigne(l) ?? 0), 0);
  return {
    produits: lignes.length,
    restesComptes: comptees.length,
    productionsSaisies: lignes.filter((l) => l.quantiteProduite != null).length,
    resteTotalPieces: enPieces.length > 0 ? enPieces.reduce((s, l) => s + (l.quantiteRestante ?? 0), 0) : null,
    aZero: comptees.filter((l) => l.quantiteRestante === 0).map((l) => l.nom),
    produitTotalPieces: completes.length > 0 ? produit : null,
    venduTotalPieces: completes.length > 0 ? vendu : null,
    tauxVente: completes.length > 0 && produit > 0 ? Math.round((vendu / produit) * 100) : null,
  };
}

/** Les `n` plus gros restes en pièces (strictement positifs), du plus grand au plus petit. */
export function plusGrosRestes<L extends LigneBilan>(lignes: readonly L[], n: number): L[] {
  return lignes
    .filter((l) => !estAuPoids(l) && (l.quantiteRestante ?? 0) > 0)
    .sort((a, b) => (b.quantiteRestante ?? 0) - (a.quantiteRestante ?? 0))
    .slice(0, Math.max(0, n));
}

/**
 * Écart de restes avec une journée de référence (même jour la semaine d'avant) :
 * positif = plus d'invendus. null si l'une des deux journées n'a aucun reste compté.
 */
export function ecartDeRestes(jour: BilanJournee, reference: BilanJournee | null | undefined): number | null {
  if (!reference || jour.resteTotalPieces === null || reference.resteTotalPieces === null) return null;
  return jour.resteTotalPieces - reference.resteTotalPieces;
}
