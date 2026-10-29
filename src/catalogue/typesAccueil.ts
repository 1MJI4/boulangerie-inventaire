// src/catalogue/typesAccueil.ts
//
// Filtre de l'accueil (Pâtisserie · Salé · Boulangerie) : exceptions au
// classement par famille. DONNÉE explicite (rayon du tarif, à la lettre, ou
// clé du catalogue), jamais déduite du nom du produit (LOI 6). Le rayon du
// tarif ne change pas : les produits restent dans « Oriental » (propriétaire,
// 29/10/2026 : « laisse en oriental tout ça ») ; seul le filtre de l'accueil
// les range en Salé (« en vérité oriental va dans salé »).
// Propriétaire de la donnée : `catalogue-prix`.

export type TypeAccueil = 'boulangerie' | 'patisserie' | 'sale';

/** Rayon du tarif (catégorie du CSV, à la lettre) → type du filtre de l'accueil. */
export const TYPE_ACCUEIL_PAR_RAYON: Readonly<Record<string, TypeAccueil>> = {
  Oriental: 'sale',
};

/** Exceptions produit par produit (clé du catalogue), prioritaires sur le rayon. Aucune pour l'instant. */
export const TYPE_ACCUEIL_PAR_PRODUIT: Readonly<Record<string, TypeAccueil>> = {};
