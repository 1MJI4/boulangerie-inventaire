// src/lib/gateaux.ts
//
// Listes d'aide à la saisie d'un gâteau ou d'un plateau sur commande :
// parfums, garnitures, décorations. Ce sont des MOTS proposés au vendeur pour
// remplir la précision d'une ligne (imprimée sur le bon), jamais des prix.
//
// Depuis le lot 2, les prix, minimums et formats viennent du CATALOGUE de
// commande (LOI 1, 6, 7) : les anciennes familles à prix par personne, paliers,
// formats fixes, réglage des coupes et suppléments « moins de 6 personnes »
// ont disparu (décision du gérant du 15/10/2026).

export type GenreOption = 'parfum' | 'garniture' | 'decoration';

export type OptionGateau = {
  id: number;
  nom: string;
  /** Renseigné seulement quand l'écran de réglages demande les inactifs. */
  actif?: boolean;
};

/** Réponse de GET /api/gateaux. */
export type OptionsGateau = {
  parfums: OptionGateau[];
  garnitures: OptionGateau[];
  decorations: OptionGateau[];
};
