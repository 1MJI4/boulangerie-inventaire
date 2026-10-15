// src/domaine/types.ts
//
// Types d'entrée des règles métier. Propriétaire : agent `regles-metier`.
//
// Ces types sont STRUCTURELS : le domaine n'importe pas le module catalogue.
// `Produit` et `PrixEnVigueur` de src/catalogue/ s'y conforment tels quels
// (un `Produit` est un `ProduitRegle`, un `PrixEnVigueur` est un `PrixRegle`).
// Ainsi le domaine reste testable seul, et une évolution interne du catalogue
// ne casse pas les règles.

/** Date civile « AAAA-MM-JJ ». Jamais d'heure, jamais de fuseau. */
export type DateISO = string;

/** LOI 2 — `piece` : quantité entière · `kg` : quantité en GRAMMES entiers. */
export type Unite = 'piece' | 'kg';

/** LOI 6 — A comptoir · B traiteur salé · C gâteau sur commande (prix plancher). */
export type RegimePrix = 'A' | 'B' | 'C';

/** Sur quoi porte le prix : pièce, kilo, personne (part), forfait (une fois par gâteau). */
export type BasePrix = 'piece' | 'kg' | 'personne' | 'forfait';

/** Identité d'un produit, telle que le catalogue la donne (`getProduit`). */
export type ProduitRegle = {
  id: string;
  /** Libellé À LA LETTRE (LOI 5). */
  produit: string;
  /** Sous-catégorie à la lettre (« 6P », « Photo »), vide ou absente sinon. */
  sousCategorie?: string;
  unite: Unite;
  /** `null` = régime non renseigné : le produit ne peut pas être vendu. */
  regimePrix: RegimePrix | null;
  /**
   * Famille de vente (« patisserie », « sale »…), donnée explicite du catalogue
   * (src/catalogue/familles.ts, tirée du rayon), jamais déduite du nom.
   * Sert aux horaires de retrait pâtisserie (R54). Toujours fournie par le
   * catalogue ; vide = inconnue → traitée comme soumise aux horaires (le plus sûr).
   */
  famille: string;
};

/** Prix d'un produit à une date, tel que le catalogue le donne (`getPrix`). */
export type PrixRegle = {
  /** Centimes TTC. Prix au KILO si basePrix = kg ; plancher si prixEstPlancher. */
  prixCentimes: number;
  basePrix: BasePrix;
  prixEstPlancher: boolean;
  minQuantite: number | null;
  minParSymbole: number | null;
  typeMin?: 'bloquant' | null;
  maxParUnite: { valeur: number; objet: string } | null;
  /** Nombre d'étages (mariage, pièce montée), sinon null — sert au délai. */
  etages?: number | null;
  /** Traçabilité R4 : version de tarif appliquée. */
  versionCode?: string;
  valideDu?: DateISO;
};

/** Un produit et son prix en vigueur à la date de la commande. */
export type FicheTarifee = { produit: ProduitRegle; prix: PrixRegle };

/** Déverrouillage d'un prix sous plancher (LOI 6) : identité déclarée + horodatage. */
export type Deverrouillage = { par: string; le: string };
