// src/catalogue/types.ts
// Types du module catalogue (propriétaire : agent `catalogue-prix`).
// Module PUR : aucune dépendance React, Next ou Prisma.
//
// Correspondance avec le schéma Prisma du lot 1 (agent `base-donnees`,
// migration 20261015110000) :
//   Produit.id                → Produit.cleCatalogue
//   Produit.produit           → Produit.nom      (⚠ @unique côté base : incompatible,
//                                                 « Baguette » existe en 4 sous-catégories)
//   LignePrix.prixCentimes    → PrixProduit.prixCentimes
//   VersionTarif.valideDu/Au  → PrixProduit.valideDu/valideAu (une ligne par produit)
//   VersionTarif.source       → PrixProduit.source
//   LignePrix.minQuantite / minParSymbole / maxParUnite.valeur
//                             → Produit.minimum / minimumParSymbole / maximum
//                               (⚠ non versionnés côté base)
//   Produit.tauxTva           → PrixProduit.tauxTvaPourMille (⚠ un seul taux côté base)
//
// Champs du module :
//
//   Produit.id            identifiant stable « categorie/produit/sous_categorie »
//                         slugifié. Ne change JAMAIS quand un prix change.
//   Produit.regimePrix    "A" | "B" | "C" — explicite, jamais déduit du nom (LOI 6)
//   Produit.estFavori     booléen ; « Favoris » n'est pas une catégorie (LOI 4)
//   Produit.unite         "piece" | "kg" — unité de comptage (LOI 2)
//   Produit.tauxTva       null tant que le comptable n'a pas tranché
//   LignePrix.prixCentimes   entier, centimes, TTC (LOI 1)
//   LignePrix.basePrix    "piece" | "kg" | "personne" | "forfait"
//   VersionTarif.valideDu / valideAu   dates d'effet « AAAA-MM-JJ », bornes incluses

/** Date civile « AAAA-MM-JJ ». Jamais d'heure : un tarif s'applique à une journée. */
export type DateISO = string;

export type RegimePrix = "A" | "B" | "C";

/** Unité de comptage : `kg` = quantité décimale saisie à la balance. */
export type Unite = "piece" | "kg";

/**
 * Sur quoi porte le prix :
 * - piece    : prix à la pièce
 * - kg       : prix au kilo
 * - personne : prix par part (régime C)
 * - forfait  : ajouté une fois par gâteau, jamais par personne (suppléments)
 */
export type BasePrix = "piece" | "kg" | "personne" | "forfait";

/** Chaque grille a sa propre suite de versions datées. */
export type Grille = "comptoir" | "sur-commande";

export type NiveauSignalement = "bloquant" | "avertissement" | "information";

/** Une ligne du rapport d'import, destinée au gérant (en français). */
export interface Signalement {
  niveau: NiveauSignalement;
  /** ERR_* (bloquant) · AVERT_* (avertissement) · INFO_* (information) */
  code: string;
  message: string;
  /** Numéro de ligne dans le fichier source (en-tête = ligne 1). */
  ligne?: number;
  produitId?: string;
}

/**
 * Taux de TVA en points de base (600 = 6 %), pour éviter tout flottant.
 * HYPOTHÈSE À VALIDER : 6 % à emporter / 12 % sur place — à confirmer par le
 * comptable. Tant que ce n'est pas fait, `Produit.tauxTva` vaut `null`.
 */
export interface TauxTva {
  aEmporterPb: number;
  surPlacePb: number;
}

export interface Produit {
  id: string;
  grille: Grille;
  /** Libellés À LA LETTRE (LOI 5) : jamais corrigés, jamais retaillés. */
  categorie: string;
  produit: string;
  sousCategorie: string;
  regimePrix: RegimePrix;
  unite: Unite;
  /** Valeur de la version la plus récente ; la valeur datée est dans LignePrix. */
  estFavori: boolean;
  tauxTva: TauxTva | null;
  /** Variantes telles qu'écrites sur l'affiche (groupes séparés par « · »). */
  variantes: readonly string[];
  /** true : la liste de variantes est fermée (ex. garnitures des mini-sandwichs). */
  variantesFermees: boolean;
}

export interface MaximumParUnite {
  valeur: number;
  /** Ce qui est compté, ex. « sandwichs » par grand pain surprise. */
  objet: string;
}

/** Prix d'un produit dans UNE version de tarif. */
export interface LignePrix {
  /** Entier strictement positif, en centimes TTC. */
  prixCentimes: number;
  basePrix: BasePrix;
  /** Régime C : le prix est un plancher « à partir de », modifiable vers le haut. */
  prixEstPlancher: boolean;
  estFavori: boolean;
  /** Minimum de quantité (pièces ou parts), null = aucun. */
  minQuantite: number | null;
  /** Minimum de parts PAR SYMBOLE (Number Cake), null = sans objet. */
  minParSymbole: number | null;
  /** Décision du gérant du 15/10/2026 : tout minimum est bloquant (LOI 7). */
  typeMin: "bloquant" | null;
  maxParUnite: MaximumParUnite | null;
  /** Nombre d'étages indiqué sur l'affiche (mariage, pièce montée), sinon null. */
  etages: number | null;
  /** Identifiants comptoir correspondants, pour le rapport d'écarts affiche/Excel. */
  rapprochementComptoir: readonly string[];
}

export interface VersionTarif {
  /** ex. « tarif_2026-09 », « sur-commande_2026-10 » */
  code: string;
  grille: Grille;
  valideDu: DateISO;
  /** null = toujours en vigueur. Fermé automatiquement à l'arrivée du tarif suivant. */
  valideAu: DateISO | null;
  /** Fichier source, pour la traçabilité. */
  source: string;
  lignes: ReadonlyMap<string, LignePrix>;
}

export interface Catalogue {
  /** Ordre d'insertion = ordre du fichier source. Un produit n'est jamais supprimé. */
  produits: ReadonlyMap<string, Produit>;
  versions: readonly VersionTarif[];
}

/**
 * Résultat retourné par l'API, au format de la LOI 9.
 * DÉPENDANCE `gestion-erreurs` : à remplacer par le type `Resultat` de
 * src/domaine/resultat.ts dès qu'il est publié (même forme attendue).
 */
export type ResultatCatalogue<T> =
  | { ok: true; valeur: T }
  | { ok: false; niveau: "bloquant"; code: string; message: string; champ?: string };

/** Prix en vigueur d'un produit à une date donnée. */
export interface PrixEnVigueur extends LignePrix {
  produitId: string;
  versionCode: string;
  valideDu: DateISO;
  valideAu: DateISO | null;
}

export interface ProduitAuTarif {
  produit: Produit;
  prix: PrixEnVigueur;
}

export interface RayonAuTarif {
  categorie: string;
  produits: ProduitAuTarif[];
}

/** Ce que produit un import de fichier, avant d'être ajouté au catalogue. */
export interface ResultatImport {
  ok: boolean;
  version: VersionTarif | null;
  produits: Produit[];
  signalements: Signalement[];
}
