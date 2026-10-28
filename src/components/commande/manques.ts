// src/components/commande/manques.ts
//
// Fenêtre « Il manque : » de l'écran de commande (propriétaire : `commandes-traiteur`).
// Simple, sans gros boutons (propriétaire, 28/10/2026) : un mot-clé par
// manque ; pour un REFUS DE RÈGLE (mardi, minimum…), sa phrase courte du
// domaine en dessous — jamais comme un champ simplement vide (audit du
// 28/10/2026 : « DATE de retrait » alors que la date était remplie).
// Aucune règle ici : les textes viennent du domaine (`message` du signalement).
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import { libelleProduit } from '../../domaine/commande.ts';
import { champLocal, ficheDe, gateauDeLaLigne, indexLigne, type CatalogueCommande, type LigneEcran } from './modele.ts';

/** Ce qui manque, en un mot en capitales (« NOM du client », « GOÛT — Bavarois »). */
export const MOTS_MANQUANTS: Readonly<Record<string, string>> = {
  client: 'NOM du client',
  telephone: 'TÉLÉPHONE',
  dateRetrait: 'DATE de retrait',
  heureRetrait: 'HEURE de retrait',
  acompte: 'ACOMPTE',
  total: 'TOTAL',
  texteGateau: 'ÉCRITURE sur le gâteau',
  lignes: 'PRODUITS',
  quantite: 'TAILLE / QUANTITÉ',
  gouts: 'GOÛT',
  forme: 'FORME (carré ou rond)',
  nbSymboles: 'CHIFFRES OU LETTRES',
  prixCentimes: 'PRIX',
  nbObjets: 'NOMBRE DE SANDWICHS',
  gateauLibre: 'GÂTEAU OU NON',
};

/** Codes d'un champ simplement vide : le mot-clé suffit, pas besoin de la phrase. */
export const MANQUE_SIMPLE: ReadonlySet<string> = new Set([
  'ERR_CHAMP_OBLIGATOIRE',
  'ERR_QUANTITE_INVALIDE',
  'ERR_GOUT_MANQUANT',
  'ERR_FORME_MANQUANTE',
  'ERR_NB_SYMBOLES_MANQUANT',
  'ERR_COMMANDE_VIDE',
]);

/**
 * Libellé d'un manque : `titre` (mot-clé + produit de la ligne) et `detail`
 * (phrase du domaine pour un refus de règle, null pour un champ vide).
 */
export function libelleManque(
  m: { code: string; message: string; champ?: string },
  lignes: readonly LigneEcran[],
  catalogue: CatalogueCommande | null,
): { titre: string; detail: string | null } {
  const i = indexLigne(m.champ);
  const mot = MOTS_MANQUANTS[champLocal(m.champ)] ?? null;
  const ligne = i !== null ? lignes[i] : undefined;
  const fiche = ligne ? ficheDe(catalogue, gateauDeLaLigne(ligne)) : null;
  const produit = ligne ? (fiche ? libelleProduit(fiche) : ligne.libelleLibre || 'Autre demande') : null;
  const titre = [mot, produit].filter(Boolean).join(' — ') || m.message;
  const detail = MANQUE_SIMPLE.has(m.code) || titre === m.message ? null : m.message;
  return { titre, detail };
}
