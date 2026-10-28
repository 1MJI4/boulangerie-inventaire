// src/catalogue/libellesSelonGout.ts
//
// Libellé d'un gâteau sur commande selon son goût (propriétaire, 28/10/2026) :
// « si on met Bavarois Fraisier, dire juste Fraisier ». Sur l'écran et le bon,
// un Bavarois sur commande au goût Fraisier s'appelle « Fraisier », sans la
// ligne « GOÛT : FRAISIER » (le nom dit déjà le goût). En 4/6/8 parts la ligne
// est déjà « Fraisier NP » du comptoir (correspondancesComptoir.ts) ; cette
// table sert au-delà (15, 20… parts, prix par personne).
//
// DONNÉE EXPLICITE (LOI 6), jamais déduite du nom. Le libellé remplacé est
// celui du catalogue à la lettre (« Fraisier », rayon Gâteaux et tartes) ;
// le libellé enregistré sur la ligne (« Bavarois », LOI 5) n'est pas modifié.
// Propriétaire de la donnée : `catalogue-prix`.

import type { LibelleSelonGout } from "../domaine/libelles.ts";

export const LIBELLES_SELON_GOUT: readonly LibelleSelonGout[] = [
  { produit: "gateaux-sur-commande/bavarois", gout: "Fraisier", libelle: "Fraisier" },
  // 10 parts : le comptoir ne fait pas de Fraisier 10P, la ligne est le
  // « Bavarois 10P » (R60, entrée sans goût) ; au goût Fraisier elle se dit
  // « Fraisier 10P ». HYPOTHÈSE À VALIDER (QUESTIONS-GERANT) : un Fraisier en
  // 10 parts se fait-il, au prix du Bavarois 10P ?
  { produit: "gateaux-et-tartes/bavarois/10p", gout: "Fraisier", libelle: "Fraisier 10P" },
];
