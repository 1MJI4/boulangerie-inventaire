// src/lib/coherence.ts
//
// Une quantité aberrante saisie à 19h se découvre des semaines plus tard,
// quand une moyenne devient absurde. Ces contrôles la signalent au moment de
// la frappe — sans jamais bloquer : le vendeur voit ce que l'application ne
// comprend pas, et c'est lui qui tranche.

/** Au-delà, c'est presque toujours un zéro de trop. */
const PLAFOND_ABSOLU = 2000;

/** Écart au repère historique à partir duquel on interroge. */
const FACTEUR_SUSPECT = 4;

export function verifierComptage({
  restante,
  produite,
  moyenneHistorique,
}: {
  restante: number | null;
  produite: number | null;
  moyenneHistorique?: number | null;
}): string | null {
  if (restante === null) return null;

  if (restante > PLAFOND_ABSOLU) return 'Quantité inhabituelle — un chiffre de trop ?';

  // On ne peut pas avoir plus d'invendus que de pièces produites.
  if (produite !== null && restante > produite) {
    return `Plus que les ${produite} produits`;
  }

  if (
    moyenneHistorique != null &&
    moyenneHistorique > 5 &&
    restante > moyenneHistorique * FACTEUR_SUSPECT
  ) {
    return `Bien au-dessus de l’habitude (~${moyenneHistorique})`;
  }

  return null;
}

export function verifierProduction({
  produite,
  demandee,
}: {
  produite: number | null;
  demandee: number | null;
}): string | null {
  if (produite === null) return null;

  if (produite > PLAFOND_ABSOLU) return 'Quantité inhabituelle — un chiffre de trop ?';

  // Un écart énorme avec la commande du manager mérite un regard, dans les
  // deux sens : on a pu taper 400 pour 40, ou 4 pour 40.
  if (demandee != null && demandee > 5) {
    if (produite > demandee * FACTEUR_SUSPECT) return `Très au-dessus des ${demandee} demandés`;
    if (produite * FACTEUR_SUSPECT < demandee) return `Très en dessous des ${demandee} demandés`;
  }

  return null;
}
