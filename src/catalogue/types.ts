// src/catalogue/types.ts
// Types du module catalogue (propriétaire : agent `catalogue-prix`).
// Module PUR : aucune dépendance React, Next ou Prisma.
//
// Correspondance avec la base (agent `base-donnees`). Règle du propriétaire
// du 15/10/2026 : le catalogue de commande vit dans « ProduitCatalogue »,
// JAMAIS dans « Produit » (inventaire). Colonnes reprises de la
// migration 20261015110000 :
//   Produit.id                → ProduitCatalogue.cleCatalogue (unique)
//   Produit.produit / categorie / sousCategorie
//                             → ProduitCatalogue.nom / categorie / sousCategorie ("" → NULL)
//   Produit.unite / regimePrix / estFavori → mêmes colonnes
//   LignePrix.prixCentimes / basePrix → PrixProduit.prixCentimes / basePrix
//   VersionTarif.valideDu/Au  → PrixProduit.valideDu/valideAu (une ligne par produit)
//   VersionTarif.code/source  → PrixProduit.versionCode / source
//   LignePrix.minQuantite / minParSymbole / maxParUnite.valeur
//                             → PrixProduit.minimum / minimumParSymbole / maximum
//   Produit.tauxTva           → PrixProduit.tauxTvaEmporterPb / tauxTvaSurPlacePb
//   NON STOCKÉS en base (voir lectureBase.ts) : grille, famille (reconstruite
//   depuis la catégorie, voir familles.ts), variantes, variantesFermees,
//   prixEstPlancher, maxParUnite.objet, etages, rapprochementComptoir.
//
// Champs du module :
//
//   Produit.id            identifiant stable « categorie/produit/sous_categorie »
//                         slugifié. Ne change JAMAIS quand un prix change.
//   Produit.regimePrix    "A" | "B" | "C" — explicite, jamais déduit du nom (LOI 6)
//   Produit.estFavori     booléen ; « Favoris » n'est pas une catégorie (LOI 4)
//   Produit.famille       famille de vente, tirée du RAYON du fichier (familles.ts),
//                         jamais du nom du produit — ex. horaires pâtisserie (LOI 11)
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

/**
 * Famille de vente, donnée explicite du catalogue (src/catalogue/familles.ts) :
 * tirée du rayon du fichier source, jamais du nom du produit.
 * `patisserie` : commandes disponibles à partir de 9h en semaine / 12h le
 * week-end (règlement intérieur, LOI 11 — règle appliquée par `regles-metier`).
 * `supplement` : supplément au forfait (Photo, Écriture), jamais un gâteau
 * (liste explicite PRODUITS_SUPPLEMENT de familles.ts, basePrix « forfait »).
 */
export type Famille = "patisserie" | "viennoiserie" | "boulangerie" | "sale" | "boisson" | "supplement";

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
  /** Famille de vente, tirée du rayon (jamais du nom). */
  famille: Famille;
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

// ------------------------------------------------------------ Côté serveur
// Mêmes types que l'API pure, enrichis des identifiants de la base. Lus par
// src/catalogue/serveur.ts (tables ProduitCatalogue / PrixProduit).

export interface ProduitServeur extends Produit {
  /** ProduitCatalogue.id (clé technique Prisma). */
  idBase: number;
  /** false = produit archivé (retiré du tarif), lisible dans l'historique. */
  actif: boolean;
}

export interface PrixEnVigueurServeur extends PrixEnVigueur {
  /** PrixProduit.id : la version appliquée, à poser sur LigneCommande.prixProduitId. */
  prixProduitId: number;
  /** ProduitCatalogue.id (clé technique Prisma). */
  produitIdBase: number;
  /** TVA portée par la version ; null tant que le comptable n'a pas tranché. */
  tauxTva: TauxTva | null;
}

export interface ProduitAuTarifServeur {
  produit: ProduitServeur;
  prix: PrixEnVigueurServeur;
}

export interface RayonAuTarifServeur {
  categorie: string;
  produits: ProduitAuTarifServeur[];
}
