// src/domaine/constantes.ts
//
// Les chiffres qui pilotent le commerce, sur un seul écran.
// Propriétaire : agent `regles-metier`.
//
// Ce qui N'EST PAS ici, volontairement :
//   - les prix, minimums, maximums, régimes, unités → catalogue (src/catalogue/),
//     lus produit par produit (LOI 1, 6, 7) ;
//   - les jours de fermeture → table `JourFerme` (LOI 3 : une DONNÉE, pas une
//     constante), passée aux fonctions de calendrier.
//
// Ce qui est ici n'est utilisé que comme VALEUR PAR DÉFAUT transmise en
// paramètre par l'appelant : aucune règle ne lit ce fichier directement.

import type { RegimePrix } from './types.ts';

/** Délais minimum de commande, en JOURS OUVRÉS (fermetures exclues). */
export type DelaisCommande = {
  /** Délai selon le régime de prix du produit. */
  parRegime: Record<RegimePrix, number>;
  /**
   * Délai d'un gâteau à étages (mariage, pièce montée) : produit avec `etages` renseigné.
   * Ce délai dépend UNIQUEMENT de la donnée `etages` fournie par le catalogue
   * (agent catalogue-prix) : rien n'est déduit du nom ni du minimum de parts. Une
   * fiche sans `etages` reçoit le délai de son régime (prouvé par metier.test.ts, B2).
   */
  gateauAEtages: number;
};

// Propriétaire, 15/10/2026 : les commandes pour le lendemain sont « généralement
// acceptées » → plateau salé (B), comptoir commandé (A) et gâteau simple (C) :
// 1 jour ouvré (le lendemain passe, le jour même reste refusé).
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°17) : gâteau à étages (mariage, pièce
// montée) gardé à 5 jours ouvrés, par prudence — « généralement » ne dit pas si
// ces gâteaux sont concernés.
// HYPOTHÈSE À VALIDER (question à ajouter à QUESTIONS-GERANT) : produit du comptoir commandé
// (régime A) = 1 jour ouvré, comme le salé — le plus sûr en l'absence de réponse.
export const DELAIS_HYPOTHESE: DelaisCommande = {
  parRegime: { A: 1, B: 1, C: 1 },
  // HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°17) : 5 jours ouvrés pour un gâteau à étages.
  gateauAEtages: 5,
};

/**
 * Nombre maximum de jours parcourus pour trouver un jour ouvert. Au-delà, la
 * table des fermetures est jugée incohérente (tout est fermé) : aucune date
 * n'est proposée plutôt qu'une date fausse.
 */
export const HORIZON_RECHERCHE_JOURS = 366;

/** Seuils de vraisemblance d'un comptage d'inventaire (repris de src/lib/coherence.ts). */
export type SeuilsComptage = {
  /** Au-delà, en PIÈCES, c'est presque toujours un zéro de trop. Sans objet pour le kg. */
  plafondPieces: number;
  /** Écart au repère historique (× moyenne) à partir duquel on interroge. */
  facteurSuspect: number;
  /** Sous cette moyenne historique, l'écart n'est pas significatif. */
  moyenneMinimale: number;
};

// HYPOTHÈSE À VALIDER : valeurs reprises telles quelles de l'ancien
// src/lib/coherence.ts (2000 pièces, × 4, moyenne > 5), jamais validées par le gérant.
export const SEUILS_COMPTAGE_HYPOTHESE: SeuilsComptage = {
  plafondPieces: 2000,
  facteurSuspect: 4,
  moyenneMinimale: 5,
};

/** Jours après le retrait au-delà desquels une commande est archivée (repris de src/lib/commandes.ts). */
export const JOURS_AVANT_ARCHIVAGE = 2;

// ---------------------------------------------------------------------------
// Règlement intérieur (LOI 11, REGLEMENT-INTERIEUR.md points 9, 51, 52, 53)
// ---------------------------------------------------------------------------

/** Jour ISO sous forme de clé : « 1 » = lundi … « 7 » = dimanche. */
export type JourIsoCle = '1' | '2' | '3' | '4' | '5' | '6' | '7';

/** Clés des jours ISO, dans l'ordre lundi → dimanche (pour parcourir `parJour`). */
export const JOURS_ISO_CLES: readonly JourIsoCle[] = ['1', '2', '3', '4', '5', '6', '7'];

/**
 * Heures de retrait d'une commande de pâtisserie (« HH:MM », heure locale).
 * Réglables par le gérant JOUR PAR JOUR et PAR DATE EXCEPTIONNELLE (décision
 * du 15/10/2026, LOI 11). Lues par `heureMinRetrait` (reglement.ts).
 */
export type HorairesRetraitPatisserie = {
  /** Familles de vente (`Produit.famille` du catalogue) soumises à ces horaires. */
  familles: string[];
  /** Première heure de retrait pour chaque jour ISO (1 = lundi … 7 = dimanche). */
  parJour: Record<JourIsoCle, string>;
  /**
   * Dates exceptionnelles (« AAAA-MM-JJ ») : l'heure remplace celle du jour
   * (ex. un samedi à 11:00 au lieu de 12:00). Prioritaire sur tout le reste.
   */
  exceptions: { date: string; heure: string }[];
};

/**
 * ANCIENNE forme des horaires (avant le 15/10/2026) : semaine / week-end.
 * Gardée uniquement pour `convertirHorairesAncienneForme` (reglement.ts),
 * le temps que les réglages déjà enregistrés soient migrés.
 */
export type HorairesRetraitAncienneForme = {
  familles: readonly string[];
  semaine: string;
  weekEnd: string;
  joursWeekEndIso: readonly number[];
  feriesOuverts?: readonly string[];
};

/** Les chiffres du règlement qui pilotent la prise de commande et l'inventaire. */
export type ReglementCommande = {
  /** Acompte minimum, en POURCENT entier du total (0 à 100). */
  acomptePourcentageMin: number;
  horairesRetraitPatisserie: HorairesRetraitPatisserie;
  /**
   * Familles de vente dont un produit vendu au comptoir (régime A) est un
   * « gâteau » pour les suppléments au forfait (R7). Absent → FAMILLES_GATEAU.
   */
  famillesGateau?: readonly string[];
  /**
   * Tailles standard (nombre de parts) d'un gâteau simple sur commande (LOI 11,
   * décision du 15/10/2026). Une autre taille est refusée sauf code gérant.
   */
  taillesGateau: number[];
};

// R7 — suppléments « une fois par gâteau ». Ce qui compte comme gâteau est une
// DONNÉE (famille du catalogue + régime + base de prix), jamais le libellé.
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°60) : seule la famille « patisserie »
// porte des gâteaux (pas la viennoiserie, pas le rayon inconnu : le plus sûr).
export const FAMILLES_GATEAU: readonly string[] = ['patisserie'];

// Règlement intérieur 15/10/2026 : « Un acompte de minimum 50% doit être payé pour
// valider toute commande » · « Les commandes en pâtisserie sont disponibles à partir
// de 9h en semaine et 12h le week-end » · tailles « bizarres » (3P, 7P…) généralement
// pas possibles.
// Horaires réglables jour par jour + dates exceptionnelles (décision du 15/10/2026).
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°52) : semaine = lundi à vendredi (9:00),
// week-end = samedi et dimanche (12:00) ; un jour férié ouvert suit l'horaire du
// DIMANCHE (le plus prudent), sauf date exceptionnelle saisie par le gérant.
export const REGLEMENT_COMMANDE: ReglementCommande = {
  acomptePourcentageMin: 50,
  horairesRetraitPatisserie: {
    // HYPOTHÈSE À VALIDER : viennoiserie soumise aux horaires pâtisserie (question gérant n°50).
    // Le règlement cite pâtisserie et viennoiserie séparément : règle de doute, on inclut.
    familles: ['patisserie', 'viennoiserie'],
    parJour: { '1': '09:00', '2': '09:00', '3': '09:00', '4': '09:00', '5': '09:00', '6': '12:00', '7': '12:00' },
    exceptions: [],
  },
  // Décision du propriétaire (15/10/2026) : tailles standard 4, 6, 8, 10, 15, 20, 25, 30
  // parts, liste réglable par le gérant. Le règlement cite 3P et 7P comme tailles « bizarres ».
  taillesGateau: [4, 6, 8, 10, 15, 20, 25, 30],
};

// Règlement intérieur, point 9 : « L'inventaire doit être réalisé à 20h00 et jamais avant ».
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°51) : 20h00 tous les jours ouverts, week-end compris.
export const HEURE_FERMETURE_HYPOTHESE = '20:00';
