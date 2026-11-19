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
  // Commandes prises avant le 19/11/2026 : un Fraisier de 10 parts était le
  // « Bavarois 10P » du comptoir (correspondance retirée depuis) ; il garde son nom.
  { produit: "gateaux-et-tartes/bavarois/10p", gout: "Fraisier", libelle: "Fraisier 10P" },
  // Même règle pour les autres gâteaux du comptoir qui portent leur propre nom
  // (propriétaire, 19/11/2026) : au-dessus de 8 parts la ligne est le Bavarois
  // sur commande au prix par personne, et elle garde le nom du gâteau.
  { produit: "gateaux-sur-commande/bavarois", gout: "Matadi chocolat", libelle: "Matadi chocolat" },
  { produit: "gateaux-sur-commande/bavarois", gout: "Mousse chocolat", libelle: "Mousse chocolat" },
  { produit: "gateaux-sur-commande/bavarois", gout: "Forêt noire", libelle: "Forêt noire" },
  // Gâteaux SANS ligne propre au tarif (propriétaire, 19/11/2026 : Bavarois
  // fraise et Bavarois chocolat au lait praliné « même prix que le Bavarois
  // framboise », Fleur caramel chocolat « même prix que la Forêt noire »). Ils se
  // vendent comme le Bavarois (Bavarois 4P / 6P / 8P du comptoir, prix par
  // personne au-dessus) et portent leur nom à l'écran et sur le bon.
  // HYPOTHÈSE À VALIDER (QUESTIONS-GERANT) : l'orthographe exacte de ces noms.
  { produit: "gateaux-sur-commande/bavarois", gout: "Fraise", libelle: "Bavarois fraise" },
  { produit: "gateaux-et-tartes/bavarois/4p", gout: "Fraise", libelle: "Bavarois fraise 4P" },
  { produit: "gateaux-et-tartes/bavarois/6p", gout: "Fraise", libelle: "Bavarois fraise 6P" },
  { produit: "gateaux-et-tartes/bavarois/8p", gout: "Fraise", libelle: "Bavarois fraise 8P" },
  { produit: "gateaux-sur-commande/bavarois", gout: "Chocolat au lait praliné", libelle: "Bavarois chocolat au lait praliné" },
  { produit: "gateaux-et-tartes/bavarois/4p", gout: "Chocolat au lait praliné", libelle: "Bavarois chocolat au lait praliné 4P" },
  { produit: "gateaux-et-tartes/bavarois/6p", gout: "Chocolat au lait praliné", libelle: "Bavarois chocolat au lait praliné 6P" },
  { produit: "gateaux-et-tartes/bavarois/8p", gout: "Chocolat au lait praliné", libelle: "Bavarois chocolat au lait praliné 8P" },
  { produit: "gateaux-sur-commande/bavarois", gout: "Fleur caramel chocolat", libelle: "Fleur caramel chocolat" },
  { produit: "gateaux-et-tartes/bavarois/4p", gout: "Fleur caramel chocolat", libelle: "Fleur caramel chocolat 4P" },
  { produit: "gateaux-et-tartes/bavarois/6p", gout: "Fleur caramel chocolat", libelle: "Fleur caramel chocolat 6P" },
  { produit: "gateaux-et-tartes/bavarois/8p", gout: "Fleur caramel chocolat", libelle: "Fleur caramel chocolat 8P" },
];
