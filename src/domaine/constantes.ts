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
  /** Délai d'un gâteau à étages (mariage, pièce montée) : produit avec `etages` renseigné. */
  gateauAEtages: number;
};

// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°17) : gâteau de mariage / pièce montée
// 5 jours ouvrés · gâteau simple 48 h = 2 jours ouvrés · plateau salé 24 h = 1 jour ouvré.
// HYPOTHÈSE À VALIDER (question à ajouter à QUESTIONS-GERANT) : produit du comptoir commandé
// (régime A) = 1 jour ouvré, comme le salé — le plus sûr en l'absence de réponse.
export const DELAIS_HYPOTHESE: DelaisCommande = {
  parRegime: { A: 1, B: 1, C: 2 },
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

/**
 * Heures de retrait d'une commande de pâtisserie (« HH:MM », heure locale).
 * Le week-end est une DONNÉE (jours ISO 1 = lundi … 7 = dimanche).
 */
export type HorairesRetraitPatisserie = {
  /** Familles de vente (`Produit.famille` du catalogue) soumises à ces horaires. */
  familles: readonly string[];
  /** Première heure de retrait un jour de semaine. */
  semaine: string;
  /** Première heure de retrait un jour de week-end ou un jour férié ouvert. */
  weekEnd: string;
  /** Jours ISO comptés comme week-end. */
  joursWeekEndIso: readonly number[];
  /**
   * Jours fériés OUVERTS connus (« AAAA-MM-JJ »), traités comme le week-end.
   * S'ajoutent aux lignes `ferie` de la table JourFerme rouvertes par une
   * `ouverture_exceptionnelle`.
   */
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
};

// R7 — suppléments « une fois par gâteau ». Ce qui compte comme gâteau est une
// DONNÉE (famille du catalogue + régime + base de prix), jamais le libellé.
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°60) : seule la famille « patisserie »
// porte des gâteaux (pas la viennoiserie, pas le rayon inconnu : le plus sûr).
export const FAMILLES_GATEAU: readonly string[] = ['patisserie'];

// Règlement intérieur 15/10/2026 : « Un acompte de minimum 50% doit être payé pour
// valider toute commande » · « Les commandes en pâtisserie sont disponibles à partir
// de 9h en semaine et 12h le week-end ».
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°52) : week-end = samedi et dimanche ; un
// jour férié ouvert suit l'horaire du week-end (le plus prudent).
export const REGLEMENT_COMMANDE: ReglementCommande = {
  acomptePourcentageMin: 50,
  horairesRetraitPatisserie: {
    // HYPOTHÈSE À VALIDER : viennoiserie soumise aux horaires pâtisserie (question gérant n°50).
    // Le règlement cite pâtisserie et viennoiserie séparément : règle de doute, on inclut.
    familles: ['patisserie', 'viennoiserie'],
    semaine: '09:00',
    weekEnd: '12:00',
    joursWeekEndIso: [6, 7],
    feriesOuverts: [],
  },
};

// Règlement intérieur, point 9 : « L'inventaire doit être réalisé à 20h00 et jamais avant ».
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°51) : 20h00 tous les jours ouverts, week-end compris.
export const HEURE_FERMETURE_HYPOTHESE = '20:00';
