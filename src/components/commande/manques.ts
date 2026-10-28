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
import { estSeparationProposee } from '../../domaine/unGateauParLigne.ts';
import { champLocal, ficheDe, gateauDeLaLigne, indexLigne, type CatalogueCommande, type LigneEcran } from './modele.ts';

/**
 * Ce qui manque, en quelques mots (« Nom du client », « Goût — Bavarois »).
 * Sans capitales criées à l'écran (audit du 28/10/2026, point 9) : les capitales
 * restent réservées au papier.
 */
export const MOTS_MANQUANTS: Readonly<Record<string, string>> = {
  client: 'Nom du client',
  telephone: 'Téléphone',
  dateRetrait: 'Date de retrait',
  heureRetrait: 'Heure de retrait',
  acompte: 'Acompte',
  total: 'Total',
  texteGateau: 'Écriture sur le gâteau',
  photoImprimee: 'Photo à imprimer sur le gâteau',
  lignes: 'Produits',
  quantite: 'Taille ou quantité',
  gouts: 'Goût',
  forme: 'Forme (carré ou rond)',
  nbSymboles: 'Chiffres ou lettres',
  prixCentimes: 'Prix',
  nbObjets: 'Nombre de sandwichs',
  gateauLibre: 'Gâteau ou non',
  libelle: 'décrivez la demande',
};

/** Mot-clé d'une ligne de plusieurs gâteaux du comptoir (« 2 × Bavarois 6P »). */
export const MOT_UN_GATEAU_PAR_LIGNE = 'Un gâteau par ligne';

/**
 * Champs dont la fenêtre « Il manque » dit la CONSIGNE du domaine plutôt qu'un
 * mot-clé (« Décrivez ce que veut le client. », « Photo G047 : touchez le
 * produit… ») : un mot-clé n'y dirait pas quoi faire.
 */
export const MANQUES_PAR_CONSIGNE: ReadonlySet<string> = new Set(['libelle', 'photoEnAttente']);

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
 * true : signalement d'un champ simplement vide (mot-clé, sans bouton). Une
 * ligne de N gâteaux (« Séparer en N gâteaux », 28/10/2026) n'en est pas un,
 * bien qu'elle porte le code ERR_QUANTITE_INVALIDE : elle garde son bouton.
 */
export function estManqueSimple(s: { code: string; valeurProposee?: unknown }): boolean {
  return MANQUE_SIMPLE.has(s.code) && !estSeparationProposee(s.valeurProposee);
}

/**
 * Libellé d'un manque : `titre` (mot-clé + produit de la ligne) et `detail`
 * (phrase du domaine pour un refus de règle, null pour un champ vide).
 */
export function libelleManque(
  m: { code: string; message: string; champ?: string; valeurProposee?: unknown },
  lignes: readonly LigneEcran[],
  catalogue: CatalogueCommande | null,
): { titre: string; detail: string | null } {
  if (MANQUES_PAR_CONSIGNE.has(champLocal(m.champ))) return { titre: m.message, detail: null };
  const i = indexLigne(m.champ);
  const mot = estSeparationProposee(m.valeurProposee) ? MOT_UN_GATEAU_PAR_LIGNE : (MOTS_MANQUANTS[champLocal(m.champ)] ?? null);
  const ligne = i !== null ? lignes[i] : undefined;
  const fiche = ligne ? ficheDe(catalogue, gateauDeLaLigne(ligne)) : null;
  const produit = ligne ? (fiche ? libelleProduit(fiche) : ligne.libelleLibre || 'Autre demande') : null;
  const titre = [mot, produit].filter(Boolean).join(' — ') || m.message;
  const detail = estManqueSimple(m) || titre === m.message ? null : m.message;
  return { titre, detail };
}

/**
 * Champs du haut de l'écran (client, retrait) : leur message de champ vide est
 * la phrase courte du domaine (« Indiquez le nom du client. »), sous le champ.
 */
export const CHAMPS_A_PHRASE: ReadonlySet<string> = new Set(['client', 'telephone', 'dateRetrait', 'heureRetrait']);

/**
 * Texte discret d'un champ simplement vide, affiché SOUS le champ (propriétaire,
 * 28/10/2026 : comme une app Apple — phrase courte, ni triangle ni capitales).
 * Champ du haut : la phrase du domaine ; champ d'une ligne : « À remplir : goût ».
 */
export function texteChampVide(s: { message: string; champ?: string }): string {
  const champ = champLocal(s.champ);
  if (CHAMPS_A_PHRASE.has(champ)) return s.message;
  const mot = MOTS_MANQUANTS[champ];
  return mot ? `À remplir\u00a0: ${mot.toLocaleLowerCase('fr')}` : 'À remplir';
}
