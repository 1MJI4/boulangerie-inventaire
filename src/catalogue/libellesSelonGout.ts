// src/catalogue/libellesSelonGout.ts
//
// Libellé d'un gâteau sur commande selon son goût (propriétaire, 28/10/2026) :
// « si on met Bavarois Fraisier, dire juste Fraisier ». Sur l'écran et le bon,
// un Bavarois sur commande au goût Fraisier s'appelle « Fraisier », sans la
// ligne « GOÛT : FRAISIER » (le nom dit déjà le goût). En 4/6/8 parts la ligne
// est déjà « Fraisier NP » du comptoir (correspondancesComptoir.ts) ; cette
// table sert au-delà (10, 15, 20… parts, prix par personne).
//
// DONNÉE EXPLICITE (LOI 6), jamais déduite du nom. Le libellé remplacé est
// celui du catalogue à la lettre (« Fraisier », rayon Gâteaux et tartes) ;
// le libellé enregistré sur la ligne (« Bavarois », LOI 5) n'est pas modifié.
// Propriétaire de la donnée : `catalogue-prix`.

import type { LibelleSelonGout } from "../domaine/libelles.ts";

export const LIBELLES_SELON_GOUT: readonly LibelleSelonGout[] = [
  { produit: "gateaux-sur-commande/bavarois", gout: "Fraisier", libelle: "Fraisier" },
  // Même règle pour les autres gâteaux du comptoir qui portent leur propre nom
  // (propriétaire, 19/11/2026) : au-dessus de 8 parts la ligne est le Bavarois
  // sur commande au prix par personne, et elle garde le nom du gâteau.
  { produit: "gateaux-sur-commande/bavarois", gout: "Matadi chocolat", libelle: "Matadi chocolat" },
  { produit: "gateaux-sur-commande/bavarois", gout: "Mousse chocolat", libelle: "Mousse chocolat" },
  { produit: "gateaux-sur-commande/bavarois", gout: "Forêt noire", libelle: "Forêt noire" },
];
