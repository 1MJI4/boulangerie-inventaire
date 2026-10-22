// src/catalogue/goutsSurCommande.ts
//
// R62 — ce que chaque gâteau sur commande demande comme goût (propriétaire,
// 22/10/2026). DONNÉE explicite par identifiant, jamais déduite du nom (LOI 6).
// Les gâteaux du comptoir ont déjà leur goût : absents d'ici.
// Propriétaire : agent `catalogue-prix`.
//
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT) : les minis (tartelette, bavarois,
// éclair / mille-feuille) sont des assortiments, sans goût obligatoire.

import type { ChoixGout } from '../domaine/gouts.ts';

export const GOUTS_SUR_COMMANDE: Readonly<Record<string, ChoixGout>> = {
  'gateaux-sur-commande/cake-nature': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/creme-fraiche': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/bavarois': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/layer-cake': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/number-cake': { liste: 'parfum', parEtage: false },
  'gateaux-sur-commande/gateau-de-mariage': { liste: 'parfum', parEtage: true },
  'gateaux-sur-commande/piece-montee': { liste: 'parfum', parEtage: true },
  'gateaux-sur-commande/entremet': { liste: 'entremet', parEtage: false },
};
