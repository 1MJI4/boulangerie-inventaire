// src/catalogue/controles.ts
// Paramètres des contrôles d'import. Ce ne sont pas des prix de vente : ce sont
// des seuils d'alerte « à confirmer par le gérant » (fiche catalogue-prix).

/** En-tête attendu du CSV comptoir, dans cet ordre exact. */
export const COLONNES_CSV = [
  "categorie",
  "produit",
  "sous_categorie",
  "prix_ttc_eur",
  "prix_cents",
  "unite",
  "est_favori",
] as const;

/** Les lignes de cette « catégorie » sont des raccourcis, pas un rayon (LOI 4). */
export const CATEGORIE_FAVORIS = "Favoris";

/**
 * LOI 2 : exactement 4 produits au kilo, catégorie Oriental.
 * Comparés par clé stricte (majuscules et espaces ignorés, accents comptés).
 */
export const PRODUITS_AU_KG_ATTENDUS: ReadonlyArray<{ categorie: string; produit: string }> = [
  { categorie: "Oriental", produit: "Corne de gazelle" },
  { categorie: "Oriental", produit: "Halwa arbia" },
  { categorie: "Oriental", produit: "Sellou" },
  { categorie: "Oriental", produit: "Sablé orientaux" },
];

/** Un produit au kilo sous ce seuil (centimes) déclenche une alerte à confirmer. */
export const SEUIL_ALERTE_KG_BAS_CENTS = 500;
/** Un produit à la pièce au-dessus de ce seuil (centimes) déclenche une alerte à confirmer. */
export const SEUIL_ALERTE_PIECE_HAUT_CENTS = 2000;
