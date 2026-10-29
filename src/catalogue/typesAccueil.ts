// src/catalogue/typesAccueil.ts
//
// Filtre de l'accueil (Pâtisserie · Salé · Boulangerie) : exceptions au
// classement par rayon. DONNÉE explicite par clé du catalogue, jamais déduite
// du nom (LOI 6). Le rayon du tarif ne change pas : le Msemen reste dans
// « Oriental » (propriétaire, 29/10/2026 : « laisse en oriental tout ça »),
// seul le filtre de l'accueil le range en Salé (« 8 msemen ça va dans salé »).
// Propriétaire de la donnée : `catalogue-prix`.

export type TypeAccueil = 'boulangerie' | 'patisserie' | 'sale';

export const TYPE_ACCUEIL_PAR_PRODUIT: Readonly<Record<string, TypeAccueil>> = {
  'oriental/msemen/semoule': 'sale',
  'oriental/msemen/grise': 'sale',
  'oriental/msemen-semoule-confiture': 'sale',
  'oriental/msemen-grise-confiture': 'sale',
};
