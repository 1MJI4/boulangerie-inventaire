// src/catalogue/basesFournil.ts
// R72 — Produit du catalogue de COMMANDE → produit du FOURNIL qui lui sert de
// base (décision du propriétaire, 19/11/2026). Règle appliquée par
// `regles-metier` (src/domaine/commandesFournil.ts).
//
// DONNÉE EXPLICITE, jamais déduite du nom (LOI 6). C'est la seule passerelle
// entre les deux listes, qui restent séparées (LOI 10) : `commande` est une clé
// du catalogue de commande, `fournil` le nom exact d'un produit de la liste
// d'inventaire (`Produit.nom`, unique — l'identifiant sur lequel s'appuie déjà
// le seed). Aucun prix ici (LOI 1).
//
// À NE PAS CONFONDRE (paroles du propriétaire) :
//   - « Croissant à la pâte d'amande » : croissant cuit, ouvert et garni APRÈS
//     cuisson → dérivé du Croissant ;
//   - « Croissant aux amandes » : cuit AVEC la pâte d'amande → produit à part,
//     il a sa ligne au fournil, il n'est PAS dans cette table ;
//   - « Croissant au chocolat » : chocolat à l'intérieur → produit à part, PAS
//     dans cette table ;
//   - « Couque au chocolat double » : couque au chocolat + couche de chocolat
//     dessus → dérivé de la Couque au chocolat.
//
// « Pain chocolat » (tarif) et « Couque au chocolat » (fournil) sont le même
// produit sous deux noms : HYPOTHÈSE À VALIDER (docs/QUESTIONS-GERANT.md).

import type { LienFournil } from "../domaine/commandesFournil.ts";

export type { LienFournil };

export const BASES_FOURNIL: readonly LienFournil[] = [
  { commande: "viennoiserie/croissant", fournil: "Croissant", derive: false },
  { commande: "viennoiserie/croissant-a-la-pate-damande", fournil: "Croissant", derive: true },
  { commande: "viennoiserie/pain-chocolat", fournil: "Couque au chocolat", derive: false },
  // Couque au beurre (21/11/2026) : même produit au tarif et au fournil, à la pièce
  // (pas de plateau : ses pièces s'ajoutent telles quelles à la feuille).
  { commande: "viennoiserie/couque-au-beurre", fournil: "Couque au beurre", derive: false },
  // Toute la viennoiserie qui a une ligne au fournil (propriétaire, 21/11/2026) : à la pièce,
  // même produit des deux côtés. Les deux gosettes s'écrivent « Gosette pommes / cerises »
  // au fournil et « Gosette aux pommes / cerises » au tarif : même produit (confirmé 21/11/2026).
  // Pas de ligne au fournil, donc rien à lier : Sablés, Financier, Palmier, Mini-viennoiseries,
  // Fqaqess ; à trancher (QUESTIONS-GERANT) : Brioches, Cougnou.
  { commande: "viennoiserie/couque-aux-raisins", fournil: "Couque aux raisins", derive: false },
  { commande: "viennoiserie/croissant-au-chocolat", fournil: "Croissant au chocolat", derive: false },
  { commande: "viennoiserie/croissant-aux-amandes", fournil: "Croissant aux amandes", derive: false },
  { commande: "viennoiserie/torsade", fournil: "Torsade", derive: false },
  { commande: "viennoiserie/couque-suisse-longue", fournil: "Couque suisse longue", derive: false },
  { commande: "viennoiserie/couque-suisse-ronde", fournil: "Couque suisse ronde", derive: false },
  { commande: "viennoiserie/huit", fournil: "Huit", derive: false },
  { commande: "viennoiserie/noix-de-pecan", fournil: "Noix de pécan", derive: false },
  { commande: "viennoiserie/maton-fromage", fournil: "Maton fromage", derive: false },
  { commande: "viennoiserie/coque-croquant-amandes-cerise", fournil: "Coque croquant amandes cerise", derive: false },
  { commande: "viennoiserie/coque-croquant-noisettes-chocolat", fournil: "Coque croquant noisettes chocolat", derive: false },
  { commande: "viennoiserie/gosette-aux-pommes", fournil: "Gosette pommes", derive: false },
  { commande: "viennoiserie/gosette-aux-cerises", fournil: "Gosette cerises", derive: false },
  { commande: "viennoiserie/sandwich-mou", fournil: "Sandwich mou", derive: false },
  // Beignet : au choix du client, sucré ou nature (propriétaire, 21/11/2026) — la sorte
  // choisie sur la ligne (goutsSurCommande.ts) désigne la ligne du fournil.
  { commande: "viennoiserie/beignet", fournil: "Beignet sucré", derive: false, gout: "Sucré" },
  { commande: "viennoiserie/beignet", fournil: "Beignet nature", derive: false, gout: "Nature" },
  // Couque au chocolat double : au tarif depuis le 21/11/2026 (1,90 €, prix donné par le
  // propriétaire le 19/11) ; dérivé de la Couque au chocolat, sans ligne au fournil.
  { commande: "viennoiserie/couque-au-chocolat-double", fournil: "Couque au chocolat", derive: true },
];

/** Clés du catalogue de commande réellement suivies (hors entrées à venir). */
export function clesSuivies(liens: readonly LienFournil[] = BASES_FOURNIL): string[] {
  return liens.filter((l) => !l.aVenir).map((l) => l.commande);
}

/** Noms des produits du fournil cités (hors entrées à venir), sans doublon. */
export function basesSuivies(liens: readonly LienFournil[] = BASES_FOURNIL): string[] {
  return [...new Set(liens.filter((l) => !l.aVenir).map((l) => l.fournil))];
}
