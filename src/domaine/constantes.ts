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

// Décision du propriétaire, 18/10/2026 : le retrait LE JOUR MÊME est autorisé,
// pour tous les régimes (A comptoir commandé, B salé, C gâteau simple) : délai 0.
// Le jour même et le lendemain ne déclenchent qu'une INFORMATION « prévenez
// l'atelier » (INFO_COMMANDE_JOUR_MEME, INFO_COMMANDE_LENDEMAIN, reglement.ts).
// Gâteau à étages (mariage, pièce montée) : plus de délai minimum par défaut (0),
// mais ce délai est un RÉGLAGE du gérant (`reglement:delai_gateau_etages_jours`,
// lu côté serveur) : la valeur ci-dessous n'est que le défaut si le réglage manque.
export const DELAIS_PAR_DEFAUT: DelaisCommande = {
  parRegime: { A: 0, B: 0, C: 0 },
  gateauAEtages: 0,
};

/**
 * Bornes du réglage « délai d'un gâteau à étages », en jours ouvrés (décision
 * du propriétaire, 18/10/2026 : entier ≥ 0, réglé par le gérant). Le maximum
 * est une borne TECHNIQUE, pas une règle : au-delà d'un an, c'est une faute de
 * frappe (et aucune date ne serait plus proposée, HORIZON_RECHERCHE_JOURS).
 * Même borne dans le CHECK de la base (migration 20261018100000).
 */
export const DELAI_GATEAU_ETAGES_MIN = 0;
export const DELAI_GATEAU_ETAGES_MAX = 365;

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

/** Plage d'ouverture du magasin un jour donné (« HH:MM », heure locale, bornes incluses). */
export type PlageOuverture = { ouverture: string; fermeture: string };

/** Une date exceptionnelle (« AAAA-MM-JJ ») et ses heures d'ouverture. */
export type ExceptionOuverture = { date: string } & PlageOuverture;

/**
 * Heures d'ouverture du magasin : une heure de retrait, pour TOUT produit, doit
 * y tomber (décision du propriétaire, 18/10/2026). Réglables par le gérant JOUR
 * PAR JOUR et PAR DATE EXCEPTIONNELLE. Lues par `horairesOuvertureDuJour`
 * (reglement.ts). Les jours FERMÉS ne sont pas ici : table `JourFerme` (LOI 3).
 */
export type HorairesOuverture = {
  /** Ouverture et fermeture pour chaque jour ISO (1 = lundi … 7 = dimanche). */
  parJour: Record<JourIsoCle, PlageOuverture>;
  /** Dates exceptionnelles (ex. 24 décembre 06:00–16:00), prioritaires sur `parJour`. */
  exceptions: ExceptionOuverture[];
};

/** Les chiffres du règlement qui pilotent la prise de commande et l'inventaire. */
export type ReglementCommande = {
  /** Acompte minimum, en POURCENT entier du total (0 à 100). */
  acomptePourcentageMin: number;
  /** Heures d'ouverture du magasin : bornes de l'heure de retrait (R54). */
  horairesOuverture: HorairesOuverture;
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
// Depuis le 22/10/2026 : seule la famille « gateau » (Gâteaux et tartes, fin
// d'année) porte des gâteaux au comptoir — pas les individuelles ni le rayon
// oriental (Msemen…), où « Écriture sur le gâteau » n'avait pas de sens.
export const FAMILLES_GATEAU: readonly string[] = ['gateau'];

/** Ouverture et fermeture par défaut du magasin (décision du propriétaire, 18/10/2026). */
export const OUVERTURE_PAR_DEFAUT = '06:00';
export const FERMETURE_PAR_DEFAUT = '20:00';

// Règlement intérieur 15/10/2026 : « Un acompte de minimum 50% doit être payé
// pour valider toute commande » — décision du propriétaire, 18/10/2026 : sous
// ce pourcentage, la commande est ACCEPTÉE avec un avertissement (R52).
// Tailles « bizarres » (3P, 7P…) généralement pas possibles.
// Heures d'ouverture (décision du propriétaire, 18/10/2026) : 06:00 → 20:00 tous
// les jours (le mardi est fermé de toute façon, LOI 3), réglables jour par jour et
// par date exceptionnelle. Elles remplacent les horaires de retrait « pâtisserie »
// (9h en semaine, 12h le week-end), supprimés.
export const REGLEMENT_COMMANDE: ReglementCommande = {
  acomptePourcentageMin: 50,
  horairesOuverture: {
    parJour: Object.fromEntries(
      JOURS_ISO_CLES.map((j) => [j, { ouverture: OUVERTURE_PAR_DEFAUT, fermeture: FERMETURE_PAR_DEFAUT }]),
    ) as Record<JourIsoCle, PlageOuverture>,
    exceptions: [],
  },
  // Décision du propriétaire (15/10/2026) : tailles standard 4, 6, 8, 10, 15, 20, 25, 30
  // parts, liste réglable par le gérant. Le règlement cite 3P et 7P comme tailles « bizarres ».
  taillesGateau: [4, 6, 8, 10, 15, 20, 25, 30],
};

// ---------------------------------------------------------------------------
// Décisions du propriétaire du 26/10/2026 (R63, R64, R65)
// ---------------------------------------------------------------------------
//
// Ces listes nomment des produits par leur CLÉ du catalogue (jamais par leur
// nom, LOI 6). Elles sont ici pour que le gérant les voie sur un écran ; les
// fonctions les reçoivent en paramètre (ContexteCommande), ce fichier n'est
// lu qu'en valeur par défaut. Leurs clés sont vérifiées sur le vrai catalogue
// par src/domaine/decisions2610.test.ts.

/** Famille du catalogue des suppléments (src/catalogue/familles.ts, PRODUITS_SUPPLEMENT). */
export const FAMILLE_SUPPLEMENT = 'supplement';

/**
 * Clé catalogue du supplément « Écriture » (forfait). Décision du propriétaire
 * (28/10/2026) : une écriture sur un gâteau = ce supplément au bon, toujours ;
 * le retirer à la main n'est pas autorisé (`controlerSupplementEcriture`,
 * passé au domaine par `ContexteCommande.supplementEcriture`).
 */
export const SUPPLEMENT_ECRITURE = 'gateaux-sur-commande/supplement-ecriture-simple';

/** R63 — forme (carré ou rond) d'un gâteau simple sur commande. */
export type ReglesForme = {
  /** Gâteaux sur commande qui demandent une forme (clés catalogue). */
  produits: readonly string[];
  /** Rond possible jusqu'à ce nombre de parts INCLUS ; au-dessus, carré d'office. */
  partsMaxRond: number;
  /** Gâteau proposé quand le client veut un rond plus grand (clé catalogue), ou null. */
  gateauRondGrand: string | null;
};

// Décision du propriétaire (26/10/2026) : Bavarois (tous ses goûts : forêt noire,
// framboise, mangue, passion… — UN produit au catalogue), Crème fraîche,
// Entremet, Cake nature. 4 à 8 parts : carré ou rond ; au-dessus : carré
// d'office ; un rond plus grand = un Layer Cake.
export const REGLES_FORME: ReglesForme = {
  produits: [
    'gateaux-sur-commande/bavarois',
    'gateaux-sur-commande/creme-fraiche',
    'gateaux-sur-commande/entremet',
    'gateaux-sur-commande/cake-nature',
  ],
  partsMaxRond: 8,
  gateauRondGrand: 'gateaux-sur-commande/layer-cake',
};

/** R64 — supplément vendu PAR PERSONNE du gâteau auquel il s'ajoute. */
export type RegleSupplementParPersonne = {
  /** Gâteaux qui peuvent le recevoir (clés catalogue). Un gâteau « à forme » doit être carré. */
  gateaux: readonly string[];
  /** Le gâteau doit faire au moins ce nombre de parts (LOI 7 : bloquant). */
  partsMin: number;
};

// Décision du propriétaire (26/10/2026) : Pâte à sucre, prix PAR PERSONNE (au
// catalogue, jamais ici), sur un Layer Cake ou un gâteau carré/rectangle, gâteau
// d'au moins 20 parts. HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°67) : pas sur un
// Number Cake ni une pièce montée.
export const SUPPLEMENTS_PAR_PERSONNE: Readonly<Record<string, RegleSupplementParPersonne>> = {
  'gateaux-sur-commande/supplement-pate-a-sucre': {
    gateaux: [
      'gateaux-sur-commande/layer-cake',
      'gateaux-sur-commande/bavarois',
      'gateaux-sur-commande/creme-fraiche',
      'gateaux-sur-commande/entremet',
      'gateaux-sur-commande/cake-nature',
    ],
    partsMin: 20,
  },
};

/**
 * R65 — un produit qui ne se fait pas dans cette taille, et ses remplaçants.
 * `action` : verbe du bouton — `passer` (« Passer en Matadi chocolat 6P ») pour le
 * même gâteau dans une autre taille, `prendre` (« Prendre Mousse chocolat 4P »)
 * pour un autre gâteau.
 */
export type TailleInterdite = {
  produit: string;
  remplacements: readonly { produitId: string; action: 'passer' | 'prendre' }[];
};

// Décision du propriétaire (26/10/2026) : « en gâteau chocolat y'a mousse
// chocolat disponible en 4p ou bien matadi minimum 6p ». Le tarif comptoir
// garde sa ligne « Matadi chocolat, 4P » (LOI 5) : elle est refusée à la commande.
export const TAILLES_INTERDITES: readonly TailleInterdite[] = [
  {
    produit: 'gateaux-et-tartes/matadi-chocolat/4p',
    remplacements: [
      { produitId: 'gateaux-et-tartes/matadi-chocolat/6p', action: 'passer' },
      { produitId: 'gateaux-et-tartes/mousse-chocolat/4p', action: 'prendre' },
    ],
  },
];

// Règlement intérieur, point 9 : « L'inventaire doit être réalisé à 20h00 et jamais avant ».
// Côté serveur, l'heure de début d'inventaire est la FERMETURE DU JOUR (heures
// d'ouverture réglées par le gérant, 18/10/2026). Cette valeur n'est que le repli
// de l'écran si les réglages sont illisibles : la fermeture par défaut.
export const HEURE_FERMETURE_HYPOTHESE = FERMETURE_PAR_DEFAUT;
