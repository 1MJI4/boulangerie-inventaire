// src/domaine/stock.ts
//
// Comptage du STOCK de la feuille de commande (farines, congelé, sacs,
// emballages, entretien) — propriétaire, 22/11/2026. Liste PROPRE, séparée de
// l'inventaire des invendus (LOI 10) : aucun lien avec « Produit » ni avec le
// catalogue de commande. On compte ce qu'il RESTE ; une case vide = « pas
// encore compté », à ne pas confondre avec 0.
//
// HYPOTHÈSE À VALIDER : quantités entières (sacs, paquets, cartons) ; les
// articles au poids (sucre, sel…) se comptent en sacs/paquets entiers.

import { signaler } from './messages.ts';
import { succes, type Resultat } from './resultat.ts';

export const QUANTITE_STOCK_MAX = 100_000;

/** Quantité saisie : entier ≥ 0, ou `null` (pas encore compté). Texte vide = null. */
export function validerQuantiteStock(valeur: unknown, champ: string): Resultat<number | null> {
  if (valeur === null || valeur === undefined || valeur === '') return succes(null);
  const n = typeof valeur === 'string' && /^\d+$/.test(valeur.trim()) ? Number(valeur) : valeur;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > QUANTITE_STOCK_MAX) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'quantité en stock' }, { champ });
  }
  return succes(n);
}
