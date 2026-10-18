// src/domaine/messages.ts
//
// Catalogue UNIQUE des codes et des messages (CLAUDE.md, LOI N°8 et N°9).
// Propriétaire : agent `gestion-erreurs`. Vérifié par `qa-metier`, traduit pour le
// gérant par `documentation-gerant`.
//
// Ce fichier décide COMMENT un refus est dit, jamais QUAND il se produit :
// aucun seuil, aucun jour de fermeture, aucun prix ici. Toutes les valeurs
// (minimum, nom du produit, prix déjà formaté, date déjà formatée…) sont
// fournies par l'appelant (`regles-metier`, `catalogue-prix`, `securite`).
//
// Règles d'écriture : français, vouvoiement, pas de jargon, pas de point
// d'exclamation, et chaque message dit QUOI FAIRE (ou qui prévenir).
//
// Sortie en un geste (LOI 7 et 8 : « tout refus doit proposer la sortie ») :
//   - `correction`  : libellé du bouton qui corrige la saisie (« Passer à 20 parts »).
//                     L'écran l'associe à `valeurProposee` quand la règle en fournit une.
//   - `autreSortie` : quand AUCUNE correction n'est possible depuis l'écran, le
//                     libellé de l'issue que l'écran doit afficher à la place
//                     (« Appeler le gérant »). Tout code bloquant a l'un ou l'autre
//                     (vérifié par messages.test.ts). `sortiePour` renvoie le bon.
//
// Exhaustivité : tout code ERR_/AVERT_/INFO_ écrit dans src/domaine, src/catalogue,
// src/lib, src/proxy.ts ou src/app/api DOIT exister ici (messages.test.ts échoue sinon).

import type {
  Avertissement,
  CodeAvertissement,
  CodeBloquant,
  CodeInformation,
  Echec,
  Information,
  Niveau,
  Options,
} from './resultat.ts';
import { avertir, bloquant, informer } from './resultat.ts';

// ---------------------------------------------------------------------------
// Paramètres attendus par chaque code
// ---------------------------------------------------------------------------

/** Référence courte que l'employé peut citer au téléphone (ex. « K7Q-3MD »). */
type AvecReference = { reference: string };

/**
 * Rapport d'import du catalogue (lu par le gérant ou la personne qui importe le
 * tarif, jamais au comptoir). `ou` : repère dans le fichier (« Ligne 12 « Croissant » »),
 * `precision` : précision factuelle (« 7 colonnes au lieu de 8 »). Tous deux
 * fournis par `catalogue-prix`, déjà rédigés en français.
 */
type ParametresImport = { ou?: string; precision?: string };

export type ParametresMessages = {
  // --- Refus métier : dates -------------------------------------------------
  /**
   * `jour` : libellé du jour fermé (« mardi », « 25 décembre »…), fourni par le
   * calendrier ou par la base (DETAIL du refus). Absent si la base ne l'a pas
   * transmis : le message reste exact sans lui.
   */
  ERR_JOUR_FERME: { jour?: string };
  /** `periode` : libellé de la fermeture pour congés (« congés d'été »…), facultatif. */
  ERR_PERIODE_CONGES: { periode?: string };
  /** `premiereDate` : prochain jour ouvert, déjà formaté (facultatif). */
  ERR_DATE_PASSEE: { premiereDate?: string };
  /** `premiereDate` : date déjà formatée (« mercredi 22 octobre »). */
  ERR_DELAI_TROP_COURT: { delaiJoursOuvres: number; premiereDate: string };

  // --- Refus métier : quantités, minimums -----------------------------------
  /**
   * `unite` : « pièces » ou « parts ». `precision` : ex. « 15 parts par chiffre ».
   * Refus venu de la base : seul `minimum` est connu (DETAIL `minimum=…`), parfois
   * rien du tout → variante générique, jamais de « undefined ».
   */
  ERR_QUANTITE_MIN: { produit?: string; minimum?: number; unite?: string; precision?: string };
  /**
   * `unite` : unité du produit. `proposition` : quantité proposée, déjà formatée (facultatif).
   * `zeroAccepte` : vrai en inventaire, où zéro est une quantité comptée valable
   * (rayon vide) → « positif ou zéro » au lieu de « supérieur à zéro ».
   */
  ERR_QUANTITE_INVALIDE: { unite: 'piece' | 'kg'; proposition?: string; zeroAccepte?: boolean };
  /** Inventaire : quantité comptée négative. */
  ERR_QUANTITE_NEGATIVE: { produit?: string };
  /** `produit` absent quand le refus vient de la base. */
  ERR_NB_SYMBOLES_MANQUANT: { produit?: string };
  ERR_CONFLIT_COMPTAGE: { produit: string };
  /**
   * Supplément (option comptée une fois par gâteau) en quantité supérieure au
   * nombre de gâteaux. `max` : quantité maximale autorisée, fournie par regles-metier.
   */
  ERR_SUPPLEMENT_TROP_NOMBREUX: { max: number; produit?: string };
  /** Supplément commandé sans aucun gâteau auquel le rattacher. */
  ERR_SUPPLEMENT_SANS_GATEAU: { produit?: string };

  // --- Refus métier : prix ---------------------------------------------------
  /**
   * Prix déjà formaté par `argent.ts` (montant + symbole euro). Aucune arithmétique ici.
   * Les deux champs sont absents quand le refus vient de la base (déclencheur) :
   * le message ne cite alors ni produit ni montant.
   */
  ERR_SOUS_PLANCHER: { produit?: string; plancherFormate?: string };
  /** `objet` : « la ligne « Entremet » » ou « la commande » ; absent si refus de la base. */
  ERR_MONTANT_NUL: { objet?: string };
  /** Montants déjà formatés par `formaterEuros` ; absents si refus de la base. */
  ERR_ACOMPTE_SUPERIEUR_TOTAL: { acompteFormate?: string; totalFormate?: string };
  /** Total du tarif, déjà formaté ; absent si refus de la base. */
  ERR_REMISE_NON_AUTORISEE: { totalFormate?: string };
  /** Total du tarif, déjà formaté ; absent si refus de la base. */
  ERR_TOTAL_INCOHERENT: { totalFormate?: string };

  // --- Refus métier : commande -----------------------------------------------
  /** `champLibelle` : « nom du client », « téléphone », « acompte »… */
  ERR_CHAMP_OBLIGATOIRE: { champLibelle: string };
  ERR_COMMANDE_VIDE: Record<string, never>;
  ERR_LIGNE_SANS_PRODUIT: Record<string, never>;
  /** Libellés de statut en clair (« Remise au client »…). */
  ERR_STATUT_INCOHERENT: { de: string; vers: string };
  /** `etat` : « annulée », « remise au client », « archivée », « anonymisée ». */
  ERR_COMMANDE_FIGEE: { etat: string };
  /**
   * OBSOLÈTE (R53 : lendemain accepté depuis le 15/10/2026, plus émis par le domaine).
   * Gardé tant que le déclencheur de la base (migration 20261015140000) et
   * src/lib/erreurBase.ts le produisent encore. À retirer avec eux.
   */
  ERR_COMMANDE_LENDEMAIN: { dateRetrait?: string };
  /**
   * Heure de retrait hors des heures d'ouverture du magasin (décision du
   * propriétaire, 18/10/2026). Heures déjà formatées (« 6h00 ») ; `jour` : « le
   * samedi », ou la date en clair pour une date exceptionnelle (« le jeudi 24
   * décembre »), fourni par regles-metier. `heureProposee` : borne la plus
   * proche, déjà formatée (libellé du bouton).
   */
  ERR_HEURE_HORS_OUVERTURE: { ouverture: string; fermeture: string; jour: string; heureProposee: string };
  /**
   * LOI 11 — gâteau simple sur commande hors des tailles standard (donnée réglable).
   * `parts` : taille demandée ; `inferieure` / `superieure` : tailles standard les
   * plus proches, `null` s'il n'y en a pas de ce côté.
   */
  ERR_TAILLE_NON_STANDARD: { parts: number; inferieure: number | null; superieure: number | null };
  /**
   * R60 — gâteau sur commande dans une taille qui existe au comptoir : il se vend
   * comme le gâteau du comptoir (décision du 18/10/2026). `produit` : libellé du
   * gâteau sur commande ; `parts` : taille demandée.
   */
  ERR_PRIX_COMPTOIR: { produit: string; parts: number };
  /** LOI 11 — décompte des articles devant le client non terminé à la remise. */
  ERR_DECOMPTE_INCOMPLET: { restants: number };

  // --- Accès (securite) ------------------------------------------------------
  /**
   * `action` : ce qui est réservé, en clair (« modifier un tarif »).
   * Tous deux absents quand le refus vient de la base (accord non tracé).
   */
  ERR_DROIT_INSUFFISANT: { action?: string; role?: string };
  ERR_CODE_INCORRECT: Record<string, never>;
  /** `minutes` : attente restante, entier ≥ 1 calculé par l'appelant. */
  ERR_TROP_DE_TENTATIVES: { minutes: number };
  ERR_ORIGINE_REFUSEE: Record<string, never>;
  ERR_SESSION_EXPIREE: Record<string, never>;

  // --- Avertissements ---------------------------------------------------------
  AVERT_PAIN_SUPPLEMENTAIRE: { maximum: number; demande: number };
  AVERT_DOUBLE_SCAN: { produit: string };
  /** `date` : date limite déjà formatée. */
  AVERT_DLC_PROCHE: { produit: string; date: string };
  AVERT_TELEPHONE_IMPROBABLE: Record<string, never>;
  AVERT_PRODUIT_EN_DOUBLE: { produit: string };
  AVERT_ECRITURE_NON_PRECISEE: Record<string, never>;
  AVERT_GATEAU_COMPLEXE: Record<string, never>;
  AVERT_COMMANDE_DEJA_IMPRIMEE: Record<string, never>;
  /** `par` : nom déclaré du gérant qui a déverrouillé. */
  AVERT_SOUS_PLANCHER_AUTORISE: { produit: string; par: string };
  AVERT_REMISE_AUTORISEE: { par: string };
  /** LOI 11 — taille de gâteau hors standard, déverrouillée par le gérant (tracé). */
  AVERT_TAILLE_NON_STANDARD_AUTORISEE: { par: string };
  /** LOI 11 — commande inhabituelle (ingrédients, moules spéciaux…). */
  AVERT_COMMANDE_INHABITUELLE: Record<string, never>;
  /**
   * LOI 11 — acompte sous le pourcentage minimum : ACCEPTÉ, signalé, tracé
   * (décision du propriétaire, 18/10/2026). Montants déjà formatés par
   * `formaterEuros` ; `pourcentage` : donnée fournie par regles-metier.
   */
  AVERT_ACOMPTE_INSUFFISANT: { acompteFormate?: string; minimumFormate: string; pourcentage: number };
  /** LOI 11 — inventaire commencé avant l'heure de fermeture. `heureFermeture` déjà formatée (donnée). */
  AVERT_INVENTAIRE_AVANT_FERMETURE: { heureFermeture: string };
  /** `reference` : repère historique (moyenne arrondie) ou plafond, déjà formaté. */
  AVERT_QUANTITE_INHABITUELLE: { produit: string; reference?: string };
  /** `produite` : quantité produite, déjà formatée avec son unité. */
  AVERT_PLUS_QUE_PRODUIT: { produit: string; produite: string };
  /** `demandee` : quantité demandée, déjà formatée. */
  AVERT_PRODUCTION_INHABITUELLE: { produit: string; demandee: string; sens: 'dessus' | 'dessous' };

  // --- Informations -----------------------------------------------------------
  /** `dateEffet` : date déjà formatée. */
  INFO_TARIF_EN_VIGUEUR: { dateEffet: string };
  INFO_EN_ATTENTE_ENVOI: { nombre: number };
  /**
   * LOI 11 — retrait le premier jour ouvert suivant : accepté, l'atelier est prévenu.
   * `jour` : nom du jour de retrait (« mercredi »), tiré de la date, jamais écrit en dur.
   * `demain` : vrai seulement si le retrait est le lendemain CALENDAIRE de la prise.
   */
  INFO_COMMANDE_LENDEMAIN: { jour: string; demain: boolean };
  /** Retrait le jour même de la prise : accepté (décision du propriétaire, 18/10/2026), l'atelier est prévenu. */
  INFO_COMMANDE_JOUR_MEME: Record<string, never>;

  // --- Données incohérentes (famille 5) ---------------------------------------
  ERR_TARIF_ABSENT: { produit: string; date: string };
  /** Aucun tarif importé sur le serveur (base vide). Distinct de ERR_TARIF_ABSENT. */
  ERR_CATALOGUE_ABSENT: Record<string, never>;
  /** Produit présent mais sans régime de prix (A/B/C) : invendable (LOI 6). */
  ERR_PRODUIT_SANS_REGIME: { produit?: string };
  /**
   * `liste` : « inventaire » quand l'identifiant manque à la liste d'inventaire
   * (LOI 10) ; absent = catalogue de commande.
   */
  ERR_PRODUIT_INCONNU: { liste?: 'inventaire' };
  /** `champLibelle` absent : contrainte de la base non reconnue → message générique. */
  ERR_SAISIE_INVALIDE: { champLibelle?: string };

  // --- Refus levés par la base (déclencheurs, LOIS 1, 2, 4, 6) ----------------
  // Ils arrivent par `diagnostiquer` (src/lib/erreurBase.ts). Aucun paramètre :
  // le DETAIL de la base est technique et n'est jamais montré.
  ERR_UNITE_INCOHERENTE: Record<string, never>;
  ERR_UNITE_FIGEE: Record<string, never>;
  ERR_REGIME_FIGE: Record<string, never>;
  ERR_TARIF_IMMUABLE: Record<string, never>;
  ERR_TARIF_PASSE: Record<string, never>;
  ERR_TARIF_CHEVAUCHEMENT: Record<string, never>;
  ERR_TARIF_INCOHERENT: Record<string, never>;
  ERR_PRODUIT_EN_DOUBLE: Record<string, never>;

  // --- Techniques (familles 4 et 6) -------------------------------------------
  ERR_SERVEUR_INDISPONIBLE: AvecReference;
  ERR_CONFIGURATION_SERVEUR: AvecReference;
  ERR_DONNEE_INTROUVABLE: AvecReference;
  ERR_DEJA_ENREGISTRE: AvecReference;
  ERR_INATTENDUE: AvecReference;

  // --- Rapport d'import du catalogue (src/catalogue, lu par le gérant) --------
  ERR_DATE_EFFET_INVALIDE: ParametresImport;
  ERR_DATE_EFFET_PASSEE: ParametresImport;
  ERR_ENTETE_CSV: ParametresImport;
  ERR_LIGNE_MALFORMEE: ParametresImport;
  ERR_FICHIER_SUR_COMMANDE: ParametresImport;
  ERR_LIBELLE_VIDE: ParametresImport;
  ERR_IDENTIFIANT_INVALIDE: ParametresImport;
  ERR_DOUBLON_IDENTIFIANT: ParametresImport;
  ERR_IDENTIFIANT_DEJA_PRIS: ParametresImport;
  ERR_PRIX_VIDE: ParametresImport;
  ERR_PRIX_NON_NUMERIQUE: ParametresImport;
  ERR_PRIX_NUL_OU_NEGATIF: ParametresImport;
  ERR_PRIX_INCOHERENT: ParametresImport;
  ERR_PRIX_SANS_PRODUIT: ParametresImport;
  ERR_PRODUIT_SANS_PRIX: ParametresImport;
  ERR_UNITE_INCONNUE: ParametresImport;
  ERR_PRODUIT_KG_A_LA_PIECE: ParametresImport;
  ERR_PRODUIT_KG_INATTENDU: ParametresImport;
  ERR_SEUIL_AU_KILO: ParametresImport;
  ERR_FAVORI_ILLISIBLE: ParametresImport;
  ERR_FAVORI_INCOHERENT: ParametresImport;
  ERR_FAVORI_SANS_JUMEAU: ParametresImport;
  ERR_FAVORI_JUMEAU_APPROXIMATIF: ParametresImport;
  ERR_FAVORI_AMBIGU: ParametresImport;
  ERR_FAVORI_PRIX_DIFFERENT: ParametresImport;
  ERR_REGIME_ABSENT: ParametresImport;
  ERR_REGIME_INCOHERENT: ParametresImport;
  ERR_BASE_PRIX_INVALIDE: ParametresImport;
  ERR_PLANCHER_NON_PRECISE: ParametresImport;
  ERR_MINIMUM_INVALIDE: ParametresImport;
  ERR_TYPE_MINIMUM: ParametresImport;
  ERR_MAXIMUM_INVALIDE: ParametresImport;
  ERR_ETAGES_INVALIDE: ParametresImport;
  ERR_VARIANTES_INVALIDES: ParametresImport;
  ERR_RAPPROCHEMENT_INVALIDE: ParametresImport;
  ERR_CHANGEMENT_UNITE: ParametresImport;
  ERR_CHANGEMENT_REGIME: ParametresImport;
  ERR_CHEVAUCHEMENT_TARIFS: ParametresImport;
  ERR_VERSION_ANTERIEURE: ParametresImport;
  ERR_VERSION_DEJA_IMPORTEE_DIFFERENTE: ParametresImport;
  ERR_VERSION_INCONNUE_EN_BASE: ParametresImport;
  ERR_PERIODE_DIFFERENTE: ParametresImport;
  AVERT_CARACTERE_INVISIBLE: ParametresImport;
  AVERT_PRIX_A_CONFIRMER: ParametresImport;
  AVERT_PRODUIT_KG_ABSENT: ParametresImport;
  AVERT_FAVORI_EN_DOUBLE: ParametresImport;
  AVERT_LIBELLE_MODIFIE: ParametresImport;
  AVERT_PRODUIT_HORS_FICHIERS: ParametresImport;
  AVERT_ECART_AFFICHE_EXCEL: ParametresImport;
  AVERT_LIBELLE_AFFICHE_EXCEL: ParametresImport;
  AVERT_RAPPROCHEMENT_INTROUVABLE: ParametresImport;
  INFO_IMPORT: ParametresImport;
  INFO_DEJA_IMPORTE: ParametresImport;
  INFO_FAVORIS: ParametresImport;
  INFO_ESPACES_LIBELLE: ParametresImport;
  INFO_RESTE_ARCHIVE: ParametresImport;
  INFO_AFFICHE_EXCEL_COHERENTS: ParametresImport;
  INFO_HYPOTHESE: ParametresImport;
};

export type CodeCatalogue = keyof ParametresMessages;

type EntreeAvec<P> = {
  niveau: Niveau;
  /** Le cas qui produit ce code (pour qa-metier et documentation-gerant). */
  cas: string;
  message: (p: P) => string;
  /** Libellé du bouton de correction (LOI 7 : « tout refus doit proposer la sortie »). */
  correction?: (p: P) => string;
  /**
   * Issue à afficher par l'écran quand aucune correction n'est possible depuis
   * la saisie (« Appeler le gérant »). Tout bloquant sans `correction` en a une.
   */
  autreSortie?: string;
};

type Entree<C extends CodeCatalogue> = EntreeAvec<ParametresMessages[C]>;

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/** Issue commune quand l'employé ne peut rien corriger lui-même. */
export const APPELER_LE_GERANT = 'Appeler le gérant';
/** Issue du règlement intérieur (points 52 et lendemain) : le responsable, sur place ou au téléphone. */
export const APPELER_LE_RESPONSABLE = 'Appeler le responsable';
const CORRIGER_LE_FICHIER = 'Corriger le fichier puis relancer l’import';

/** Entrée du rapport d'import : « <où> — <constat> (<précision>). <quoi faire> ». */
function rapport(niveau: Niveau, cas: string, constat: string, action: string): EntreeAvec<ParametresImport> {
  const entree: EntreeAvec<ParametresImport> = {
    niveau,
    cas: `Import du catalogue : ${cas}`,
    message: (p) =>
      (p.ou ? `${p.ou} — ` : '') + constat + (p.precision ? ` (${p.precision})` : '') + '. ' + action,
  };
  if (niveau === 'bloquant') entree.autreSortie = CORRIGER_LE_FICHIER;
  return entree;
}

// ---------------------------------------------------------------------------
// Le catalogue
// ---------------------------------------------------------------------------

export const CATALOGUE: { [C in CodeCatalogue]: Entree<C> } = {
  // --- Dates ----------------------------------------------------------------
  ERR_JOUR_FERME: {
    niveau: 'bloquant',
    cas: 'Date de retrait (ou de production) tombant un jour de fermeture.',
    message: (p) =>
      p.jour
        ? `Fermé le ${p.jour} — choisissez un autre jour de retrait.`
        : `Le magasin est fermé ce jour-là — choisissez un autre jour de retrait.`,
    correction: () => 'Prendre le prochain jour ouvert',
  },
  ERR_PERIODE_CONGES: {
    niveau: 'bloquant',
    cas: 'Date de retrait tombant pendant une fermeture pour congés.',
    message: (p) =>
      `Le magasin est en congés à cette date` +
      (p.periode ? ` (${p.periode})` : '') +
      ` — choisissez un jour de retrait en dehors des congés.`,
    correction: () => 'Prendre le prochain jour ouvert',
  },
  ERR_DATE_PASSEE: {
    niveau: 'bloquant',
    cas: 'Date de retrait antérieure au jour de la prise de commande.',
    message: (p) =>
      `Cette date est déjà passée — choisissez une date de retrait à partir d’aujourd’hui` +
      (p.premiereDate ? ` (premier jour possible : ${p.premiereDate}).` : '.'),
    correction: () => 'Prendre le prochain jour ouvert',
  },
  ERR_DELAI_TROP_COURT: {
    niveau: 'bloquant',
    cas: 'Date de retrait trop proche, délai compté en jours ouvrés.',
    message: (p) =>
      `Cette commande demande ${p.delaiJoursOuvres} ${pluriel(p.delaiJoursOuvres, 'jour ouvré', 'jours ouvrés')} de préparation. ` +
      `Premier retrait possible : ${p.premiereDate}.`,
    correction: (p) => `Passer au ${p.premiereDate}`,
  },

  // --- Quantités, minimums ----------------------------------------------------
  ERR_QUANTITE_MIN: {
    niveau: 'bloquant',
    cas: 'Quantité sous le minimum du produit (LOI 7, tous les minimums sont bloquants).',
    message: (p) => {
      if (p.minimum === undefined) {
        return `La quantité est sous le minimum ` +
          (p.produit ? `de « ${p.produit} »` : 'de ce produit') +
          `. Augmentez-la jusqu’au minimum pour continuer.`;
      }
      const u = p.unite ? ` ${p.unite}` : '';
      return `Minimum ${p.minimum}${u} pour ` +
        (p.produit ? `« ${p.produit} »` : 'ce produit') +
        (p.precision ? ` (${p.precision})` : '') +
        `. Passez à ${p.minimum}${u} pour continuer.`;
    },
    correction: (p) =>
      p.minimum === undefined ? 'Corriger la quantité' : `Passer à ${p.minimum}${p.unite ? ` ${p.unite}` : ''}`,
  },
  ERR_QUANTITE_INVALIDE: {
    niveau: 'bloquant',
    cas: 'Quantité vide, nulle, négative, ou décimale pour un produit à la pièce ; poids nul.',
    message: (p) => {
      const borne = p.zeroAccepte ? 'positif ou zéro' : 'supérieur à zéro';
      return p.unite === 'kg'
        ? `Indiquez un poids ${borne}, en kilos, lu sur la balance.`
        : `Indiquez un nombre entier de pièces ${borne}.`;
    },
    correction: (p) => (p.proposition ? `Passer à ${p.proposition}` : 'Corriger la quantité'),
  },
  ERR_QUANTITE_NEGATIVE: {
    niveau: 'bloquant',
    cas: 'Inventaire : quantité comptée négative.',
    message: (p) =>
      `Une quantité comptée ne peut pas être négative` +
      (p.produit ? ` (« ${p.produit} »)` : '') +
      `. Saisissez zéro si le rayon est vide.`,
    correction: () => 'Mettre zéro',
  },
  ERR_NB_SYMBOLES_MANQUANT: {
    niveau: 'bloquant',
    cas: 'Number Cake (minimum par symbole) sans nombre de chiffres ou lettres.',
    message: (p) =>
      `Indiquez les chiffres ou lettres à réaliser pour ` +
      (p.produit ? `« ${p.produit} »` : 'ce gâteau') +
      ` : le minimum de parts en dépend.`,
    correction: () => 'Indiquer les chiffres ou lettres',
  },
  ERR_CONFLIT_COMPTAGE: {
    niveau: 'bloquant',
    cas: 'Inventaire : une même saisie arrive deux fois avec des quantités différentes (R22).',
    message: (p) =>
      `« ${p.produit} » a deux comptages différents pour la même saisie. Recomptez ce produit et saisissez une seule valeur.`,
    correction: () => 'Recompter',
  },
  ERR_SUPPLEMENT_TROP_NOMBREUX: {
    niveau: 'bloquant',
    cas: 'Supplément en quantité supérieure au nombre de gâteaux (un supplément se compte une fois par gâteau).',
    message: (p) =>
      `Un supplément ` + (p.produit ? `« ${p.produit} » ` : '') +
      `se compte une fois par gâteau : ${p.max} au maximum.`,
    correction: (p) => `Passer à ${p.max}`,
  },
  ERR_SUPPLEMENT_SANS_GATEAU: {
    niveau: 'bloquant',
    cas: 'Supplément commandé sans aucun gâteau dans la commande.',
    message: (p) =>
      `Un supplément ` + (p.produit ? `« ${p.produit} » ` : '') +
      `s’ajoute à un gâteau, et cette commande n’en contient aucun. Ajoutez un gâteau ou supprimez la ligne.`,
    correction: () => 'Supprimer la ligne',
  },

  // --- Prix ------------------------------------------------------------------
  ERR_SOUS_PLANCHER: {
    niveau: 'bloquant',
    cas: 'Prix par personne saisi sous le plancher « à partir de » (régime C).',
    message: (p) =>
      p.produit && p.plancherFormate
        ? `Le prix par personne de « ${p.produit} » ne peut pas descendre sous ${p.plancherFormate}. ` +
          `Remettez ${p.plancherFormate} ou demandez au gérant de déverrouiller.`
        : `Le prix par personne est sous le prix « à partir de » de ce gâteau. ` +
          `Remettez au moins ce prix ou demandez au gérant de déverrouiller.`,
    correction: (p) =>
      p.plancherFormate ? `Remettre ${p.plancherFormate} par personne` : 'Remettre le prix « à partir de »',
  },
  ERR_MONTANT_NUL: {
    niveau: 'bloquant',
    cas: 'Ligne ou commande sans montant (QUESTIONS-GERANT n°13 : refusé en attendant).',
    message: (p) =>
      (p.objet ? `Le prix de ${p.objet} est nul.` : `Le prix indiqué est nul.`) +
      ` Indiquez le prix ; un article offert n’est pas encore prévu, demandez au gérant en cas de doute.`,
    correction: () => 'Indiquer le prix',
  },
  ERR_ACOMPTE_SUPERIEUR_TOTAL: {
    niveau: 'bloquant',
    cas: 'Acompte supérieur au total de la commande.',
    message: (p) =>
      `L’acompte` + (p.acompteFormate ? ` (${p.acompteFormate})` : '') +
      ` dépasse le total de la commande` + (p.totalFormate ? ` (${p.totalFormate})` : '') + `. ` +
      (p.totalFormate
        ? `Ramenez l’acompte à ${p.totalFormate} au maximum.`
        : `Ramenez l’acompte au montant du total au maximum.`),
    correction: (p) => (p.totalFormate ? `Ramener l’acompte à ${p.totalFormate}` : 'Corriger l’acompte'),
  },
  ERR_REMISE_NON_AUTORISEE: {
    niveau: 'bloquant',
    cas: 'Prix convenu sous le total du tarif, sans déverrouillage du gérant.',
    message: (p) =>
      p.totalFormate
        ? `Le prix convenu est sous le total du tarif (${p.totalFormate}). ` +
          `Remettez ${p.totalFormate} ou demandez au gérant de déverrouiller.`
        : `Le prix convenu est sous le total du tarif. ` +
          `Remettez le total du tarif ou demandez au gérant de déverrouiller.`,
    correction: (p) => (p.totalFormate ? `Remettre ${p.totalFormate}` : 'Remettre le total du tarif'),
  },
  ERR_TOTAL_INCOHERENT: {
    niveau: 'bloquant',
    cas: 'Total transmis supérieur au total recalculé depuis le tarif.',
    message: (p) =>
      p.totalFormate
        ? `Le total saisi ne correspond pas au tarif : le total exact est ${p.totalFormate}. Reprenez ce montant.`
        : `Le total saisi ne correspond pas au tarif. Reprenez le total calculé par l’application.`,
    correction: (p) => (p.totalFormate ? `Reprendre ${p.totalFormate}` : 'Reprendre le total du tarif'),
  },

  // --- Commande ----------------------------------------------------------------
  ERR_CHAMP_OBLIGATOIRE: {
    niveau: 'bloquant',
    cas: 'Champ obligatoire laissé vide (nom du client, téléphone, acompte, libellé d’une ligne libre…).',
    // Tournure neutre : correcte quel que soit le genre ou l'initiale du libellé
    // (« nom du client », « heure de retrait », « date de retrait »…).
    message: (p) => `Le champ « ${p.champLibelle} » est obligatoire : remplissez-le pour continuer.`,
    correction: (p) => `Remplir « ${p.champLibelle} »`,
  },
  ERR_COMMANDE_VIDE: {
    niveau: 'bloquant',
    cas: 'Commande validée sans aucune ligne.',
    message: () => `La commande ne contient aucun produit. Ajoutez au moins un produit pour continuer.`,
    correction: () => 'Ajouter un produit',
  },
  ERR_LIGNE_SANS_PRODUIT: {
    niveau: 'bloquant',
    cas: 'Ligne ajoutée sans produit choisi ni libellé.',
    message: () => `Une ligne n’a pas de produit. Choisissez un produit ou supprimez la ligne.`,
    correction: () => 'Supprimer la ligne',
  },
  ERR_STATUT_INCOHERENT: {
    niveau: 'bloquant',
    cas: 'Changement de statut impossible (ex. remettre « à imprimer » une commande remise).',
    message: (p) =>
      `Une commande « ${p.de} » ne peut pas passer à « ${p.vers} ». ` +
      `Vérifiez le statut de la commande ; en cas de doute, demandez au gérant.`,
    correction: (p) => `Laisser « ${p.de} »`,
  },
  ERR_COMMANDE_FIGEE: {
    niveau: 'bloquant',
    cas: 'Modification d’une commande annulée, remise, archivée ou anonymisée.',
    message: (p) =>
      `Cette commande est ${p.etat} : elle ne se modifie plus. Créez une nouvelle commande si nécessaire.`,
    correction: () => 'Créer une nouvelle commande',
  },


  // --- Règlement intérieur (LOI 11) ------------------------------------------------
  ERR_COMMANDE_LENDEMAIN: {
    niveau: 'bloquant',
    cas: 'OBSOLÈTE — refus du lendemain encore émis par la base ; le domaine l’accepte depuis le 15/10/2026 (LOI 11).',
    message: (p) =>
      (p.dateRetrait
        ? `Retrait le ${p.dateRetrait} : une commande pour le lendemain doit d’abord être acceptée par le responsable. `
        : `Une commande pour le lendemain doit d’abord être acceptée par le responsable. `) +
      `Demandez-lui de saisir son code gérant, ou appelez-le avant de confirmer au client.`,
    correction: () => 'Saisir le code gérant',
    autreSortie: APPELER_LE_RESPONSABLE,
  },
  ERR_HEURE_HORS_OUVERTURE: {
    niveau: 'bloquant',
    cas: 'Heure de retrait hors des heures d’ouverture du magasin (réglées par le gérant, décision du 18/10/2026).',
    message: (p) =>
      `Le magasin est ouvert de ${p.ouverture} à ${p.fermeture} ${p.jour} — choisissez une heure dans ces horaires.`,
    correction: (p) => `Passer à ${p.heureProposee}`,
  },
  ERR_TAILLE_NON_STANDARD: {
    niveau: 'bloquant',
    cas: 'Gâteau simple sur commande dans une taille hors des tailles standard (liste = donnée, LOI 11). Déverrouillable par le gérant.',
    message: (p) => {
      const proches = [p.inferieure, p.superieure].filter((t): t is number => t !== null);
      const tailles = proches.length > 0 ? proches.join(' ou ') : null;
      return tailles
        ? `Ce gâteau se fait en ${tailles} parts, pas en ${p.parts}. ` +
            `Choisissez une taille standard ou demandez au gérant de déverrouiller.`
        : `Ce gâteau ne se fait pas en ${p.parts} parts. ` +
            `Choisissez une taille standard ou demandez au gérant de déverrouiller.`;
    },
    correction: (p) => {
      const t = p.superieure ?? p.inferieure;
      return t === null ? 'Choisir une taille standard' : `Passer à ${t} parts`;
    },
  },
  ERR_PRIX_COMPTOIR: {
    niveau: 'bloquant',
    cas: 'Gâteau sur commande dans une taille qui existe au comptoir : il se vend au prix du comptoir (décision du 18/10/2026).',
    message: (p) =>
      `« ${p.produit} » en ${p.parts} parts existe au comptoir : il se vend au prix du comptoir. ` +
      `Prenez le gâteau du comptoir à la place.`,
    correction: () => 'Prendre le gâteau du comptoir',
  },
  ERR_DECOMPTE_INCOMPLET: {
    niveau: 'bloquant',
    cas: 'Remise de commande validée alors que des articles ne sont pas cochés comme remis (règlement intérieur, LOI 11).',
    message: (p) =>
      `Il reste ${p.restants} ${pluriel(p.restants, 'article', 'articles')} à remettre au client. ` +
      `Faites le décompte devant lui avant de valider.`,
    correction: () => 'Cocher les articles remis',
  },

  // --- Accès ---------------------------------------------------------------------
  ERR_DROIT_INSUFFISANT: {
    niveau: 'bloquant',
    cas: 'Action réservée à un rôle que l’utilisateur connecté n’a pas.',
    message: (p) =>
      p.role && p.action
        ? `Seul le ${p.role} peut ${p.action}. Demandez-lui de le faire ou de saisir son code.`
        : `Cette opération demande l’accord du gérant, et cet accord n’est pas enregistré. ` +
          `Demandez-lui de saisir son code, puis réessayez.`,
    correction: (p) => `Saisir le code ${p.role ?? 'gérant'}`,
  },
  ERR_CODE_INCORRECT: {
    niveau: 'bloquant',
    cas: 'Code de tablette ou code gérant erroné.',
    message: () => `Code incorrect. Vérifiez-le et recommencez ; en cas d’oubli, demandez au gérant.`,
    correction: () => 'Ressaisir le code',
  },
  ERR_TROP_DE_TENTATIVES: {
    niveau: 'bloquant',
    cas: 'Trop de codes erronés : saisie suspendue quelques minutes (même avec le bon code).',
    message: (p) =>
      `Trop d’essais. Réessayez dans ${p.minutes} ${pluriel(p.minutes, 'minute', 'minutes')}, ou demandez au gérant.`,
    autreSortie: APPELER_LE_GERANT,
  },
  ERR_ORIGINE_REFUSEE: {
    niveau: 'bloquant',
    cas: 'Écriture envoyée depuis un autre site que l’application (protection contre la falsification).',
    message: () => `Cette demande ne vient pas de l’application. Rouvrez l’application et recommencez.`,
    correction: () => 'Rouvrir l’application',
  },
  ERR_SESSION_EXPIREE: {
    niveau: 'bloquant',
    cas: 'Tablette non installée ou installation expirée (cookie tablette absent ou invalide).',
    message: () => `Cette tablette doit être réinstallée : saisissez le code de la tablette.`,
    correction: () => 'Réinstaller la tablette',
  },

  // --- Avertissements ---------------------------------------------------------------
  AVERT_PAIN_SUPPLEMENTAIRE: {
    niveau: 'avertissement',
    cas: 'Pain surprise : plus de sandwichs que la contenance d’un pain.',
    message: (p) =>
      `Un pain surprise contient au plus ${p.maximum} sandwichs (${p.demande} demandés). ` +
      `Ajoutez un 2e pain pour les sandwichs en plus.`,
    correction: () => 'Ajouter un 2e pain',
  },
  AVERT_DOUBLE_SCAN: {
    niveau: 'avertissement',
    cas: 'Même produit scanné deux fois dans la même zone : les quantités s’additionnent.',
    message: (p) =>
      `« ${p.produit} » a déjà été compté ici : les quantités ont été additionnées. ` +
      `Si c’était un double scan, corrigez la quantité.`,
  },
  AVERT_DLC_PROCHE: {
    niveau: 'avertissement',
    cas: 'Date limite de consommation proche.',
    message: (p) =>
      `« ${p.produit} » arrive à sa date limite le ${p.date}. Mettez-le en avant ou prévoyez de le retirer.`,
  },
  AVERT_TELEPHONE_IMPROBABLE: {
    niveau: 'avertissement',
    cas: 'Téléphone au format improbable (ni belge, ni international).',
    message: () =>
      `Le numéro de téléphone semble incomplet ou mal tapé. Relisez-le au client avant de valider.`,
  },
  AVERT_PRODUIT_EN_DOUBLE: {
    niveau: 'avertissement',
    cas: 'Même produit sur plusieurs lignes d’une commande.',
    message: (p) =>
      `« ${p.produit} » figure sur plusieurs lignes. Fusionnez-les si c’est le même article.`,
    correction: () => 'Fusionner les lignes',
  },
  AVERT_ECRITURE_NON_PRECISEE: {
    niveau: 'avertissement',
    cas: 'Gâteau sur commande sans texte ni « pas d’écriture » coché.',
    message: () => `Écriture sur le gâteau : notez le texte, ou cochez « pas d’écriture ».`,
  },
  AVERT_GATEAU_COMPLEXE: {
    niveau: 'avertissement',
    cas: 'Commande marquée « gâteau complexe ».',
    message: () =>
      `Gâteau complexe : confirmez le prix et la faisabilité avec le gérant avant de vous engager auprès du client.`,
  },
  AVERT_COMMANDE_DEJA_IMPRIMEE: {
    niveau: 'avertissement',
    cas: 'Modification d’une commande déjà imprimée.',
    message: () => `Cette commande est déjà imprimée : réimprimez les bons après la modification.`,
    correction: () => 'Réimprimer',
  },
  AVERT_SOUS_PLANCHER_AUTORISE: {
    niveau: 'avertissement',
    cas: 'Prix par personne sous le plancher, déverrouillé par le gérant (tracé).',
    message: (p) => `Prix de « ${p.produit} » sous le tarif, autorisé par ${p.par}. Ce déverrouillage est enregistré.`,
  },
  AVERT_REMISE_AUTORISEE: {
    niveau: 'avertissement',
    cas: 'Prix convenu sous le total du tarif, déverrouillé par le gérant (tracé).',
    message: (p) => `Remise sur le total autorisée par ${p.par}. Ce déverrouillage est enregistré.`,
  },
  AVERT_TAILLE_NON_STANDARD_AUTORISEE: {
    niveau: 'avertissement',
    cas: 'Gâteau simple dans une taille hors standard, déverrouillé par le gérant (tracé, LOI 11).',
    message: (p) => `Taille de gâteau hors standard autorisée par ${p.par}. Ce déverrouillage est enregistré.`,
  },
  AVERT_COMMANDE_INHABITUELLE: {
    niveau: 'avertissement',
    // Recouvre en partie AVERT_GATEAU_COMPLEXE : les deux sont gardés pour l'instant.
    cas: 'Commande inhabituelle (ingrédients spécifiques, moules spéciaux…) : accord du responsable d’abord (LOI 11).',
    message: () =>
      `Commande inhabituelle : demandez d’abord l’accord du responsable, sur place ou au téléphone, ` +
      `avant de la confirmer au client. Vous pouvez aussi l’inviter à passer commande par WhatsApp pour un meilleur suivi.`,
    autreSortie: 'Appeler le responsable ou proposer WhatsApp',
  },
  AVERT_ACOMPTE_INSUFFISANT: {
    niveau: 'avertissement',
    cas: 'Acompte sous le pourcentage minimum du total : accepté, signalé et tracé (règlement intérieur, décision du propriétaire du 18/10/2026).',
    message: (p) =>
      `Essayez d’obtenir au moins ${p.pourcentage} % d’acompte (${p.minimumFormate})` +
      (p.acompteFormate ? ` : ${p.acompteFormate} saisi` : '') +
      `. La commande reste acceptée.`,
    correction: (p) => `Mettre l’acompte à ${p.minimumFormate}`,
  },
  AVERT_INVENTAIRE_AVANT_FERMETURE: {
    niveau: 'avertissement',
    cas: 'Inventaire commencé avant l’heure de fermeture (heure = donnée, LOI 11).',
    message: (p) =>
      `L’inventaire se fait à partir de ${p.heureFermeture}, pour un comptage juste. Vous pouvez continuer si c’est voulu.`,
  },
  AVERT_QUANTITE_INHABITUELLE: {
    niveau: 'avertissement',
    cas: 'Inventaire : quantité très au-dessus de l’habitude ou du plafond.',
    message: (p) =>
      `« ${p.produit} » : quantité inhabituelle` +
      (p.reference ? ` (habituellement environ ${p.reference})` : '') +
      `. Vérifiez qu’il n’y a pas un chiffre de trop.`,
    correction: () => 'Corriger la quantité',
  },
  AVERT_PLUS_QUE_PRODUIT: {
    niveau: 'avertissement',
    cas: 'Inventaire : il reste plus que la quantité produite.',
    message: (p) =>
      `Il reste plus de « ${p.produit} » que la quantité produite (${p.produite}). Recomptez ce produit.`,
    correction: () => 'Corriger la quantité',
  },
  AVERT_PRODUCTION_INHABITUELLE: {
    niveau: 'avertissement',
    cas: 'Production très au-dessus ou en dessous de la quantité demandée.',
    message: (p) =>
      `« ${p.produit} » : production très au-${p.sens} de la quantité demandée (${p.demandee}). Vérifiez la saisie.`,
    correction: () => 'Corriger la quantité',
  },

  // --- Informations -----------------------------------------------------------------
  INFO_TARIF_EN_VIGUEUR: {
    niveau: 'information',
    cas: 'Rappel du tarif appliqué.',
    message: (p) => `Tarif en vigueur depuis le ${p.dateEffet}.`,
  },
  INFO_EN_ATTENTE_ENVOI: {
    niveau: 'information',
    cas: 'Saisies conservées sur l’appareil, pas encore synchronisées (réseau absent).',
    message: (p) =>
      `${p.nombre} ${pluriel(p.nombre, 'ligne en attente', 'lignes en attente')} d’envoi. ` +
      `Elles partiront toutes seules au retour du réseau.`,
  },
  INFO_COMMANDE_LENDEMAIN: {
    niveau: 'information',
    cas: 'Retrait le premier jour ouvert suivant la prise : accepté, l’atelier doit être prévenu (LOI 11, décision du 15/10/2026).',
    message: (p) =>
      p.demain
        ? `Commande pour demain : prévenez l’atelier.`
        : `Commande pour ${p.jour}, le prochain jour d’ouverture : prévenez l’atelier dès aujourd’hui.`,
  },
  INFO_COMMANDE_JOUR_MEME: {
    niveau: 'information',
    cas: 'Retrait le jour même de la prise de commande : accepté, l’atelier doit être prévenu tout de suite (décision du propriétaire, 18/10/2026).',
    message: () => `Commande pour aujourd’hui : prévenez l’atelier tout de suite.`,
  },

  // --- Données incohérentes -----------------------------------------------------------
  ERR_TARIF_ABSENT: {
    niveau: 'bloquant',
    cas: 'Aucun prix au catalogue pour ce produit à cette date.',
    message: (p) =>
      `Aucun prix n’est enregistré pour « ${p.produit} » au ${p.date}. ` +
      `Ne vendez pas ce produit tant que le gérant n’a pas saisi son prix.`,
    correction: () => 'Choisir un autre produit',
  },
  ERR_CATALOGUE_ABSENT: {
    niveau: 'bloquant',
    cas: 'Aucun tarif n’a encore été importé sur le serveur (base sans catalogue).',
    message: () =>
      `Les prix ne sont pas encore chargés dans l’application. Prévenez le gérant : le tarif doit être importé avant toute vente ou commande.`,
    autreSortie: APPELER_LE_GERANT,
  },
  ERR_PRODUIT_SANS_REGIME: {
    niveau: 'bloquant',
    cas: 'Produit présent au catalogue mais sans régime de prix (comptoir, traiteur, gâteau par personne) : invendable (LOI 6).',
    message: (p) =>
      (p.produit ? `« ${p.produit} »` : 'Ce produit') +
      ` n’a pas encore de façon d’être vendu (comptoir, traiteur ou gâteau par personne). ` +
      `Choisissez un autre produit et signalez-le au gérant.`,
    correction: () => 'Choisir un autre produit',
  },
  ERR_PRODUIT_INCONNU: {
    niveau: 'bloquant',
    cas: 'Référence scannée ou saisie absente du catalogue de commande (ou archivée), ou absente de la liste d’inventaire (LOI 10).',
    message: (p) =>
      p.liste === 'inventaire'
        ? `Ce produit n’est pas dans la liste d’inventaire. Choisissez un produit de la liste, ou demandez au gérant de l’y ajouter.`
        : `Ce produit n’est pas dans le catalogue. Mettez-le de côté et signalez-le au gérant.`,
    correction: () => 'Choisir un autre produit',
  },
  ERR_SAISIE_INVALIDE: {
    niveau: 'bloquant',
    cas: 'Donnée reçue incomplète ou mal formée.',
    message: (p) =>
      p.champLibelle
        ? `Le champ « ${p.champLibelle} » est incomplet ou mal rempli. Corrigez-le puis réessayez.`
        : `Une information de la saisie est incomplète ou mal remplie. Vérifiez la saisie puis réessayez.`,
    correction: (p) => (p.champLibelle ? `Corriger « ${p.champLibelle} »` : 'Vérifier la saisie'),
  },

  // --- Refus levés par la base ------------------------------------------------------------
  ERR_UNITE_INCOHERENTE: {
    niveau: 'bloquant',
    cas: 'Base : unité d’une quantité ou d’un prix différente de celle du produit (pièce / kg).',
    message: () =>
      `L’unité saisie ne correspond pas à celle du produit (pièce ou kg). ` +
      `Rechargez la page et saisissez la quantité dans l’unité affichée.`,
    correction: () => 'Recharger',
  },
  ERR_UNITE_FIGEE: {
    niveau: 'bloquant',
    cas: 'Base : changement d’unité d’un produit qui a déjà un historique.',
    message: () =>
      `Ce produit a déjà un historique : son unité (pièce ou kg) ne peut plus changer. ` +
      `Créez un nouveau produit avec la bonne unité.`,
    correction: () => 'Créer un nouveau produit',
  },
  ERR_REGIME_FIGE: {
    niveau: 'bloquant',
    cas: 'Base : changement de régime de prix d’un produit qui a déjà des prix ou des commandes.',
    message: () =>
      `Ce produit a déjà des prix ou des commandes : sa façon d’être vendu (comptoir, traiteur, gâteau par personne) ` +
      `ne peut plus changer. Créez un nouveau produit pour l’autre façon de le vendre.`,
    correction: () => 'Créer un nouveau produit',
  },
  ERR_TARIF_IMMUABLE: {
    niveau: 'bloquant',
    cas: 'Base : modification ou suppression d’un prix déjà entré en vigueur.',
    message: () =>
      `Un prix déjà en vigueur ne se modifie pas et ne se supprime pas. ` +
      `Créez un nouveau prix avec sa date d’entrée en vigueur.`,
    correction: () => 'Créer un nouveau prix',
  },
  ERR_TARIF_PASSE: {
    niveau: 'bloquant',
    cas: 'Base : réécriture de la période passée d’un prix.',
    message: () =>
      `Une période de prix déjà écoulée ne se modifie pas. ` +
      `Choisissez une date de fin à partir d’aujourd’hui, ou créez un nouveau prix.`,
    correction: () => 'Créer un nouveau prix',
  },
  ERR_TARIF_CHEVAUCHEMENT: {
    niveau: 'bloquant',
    cas: 'Base : deux versions de prix couvrant la même période pour un produit.',
    message: () =>
      `Un autre prix couvre déjà cette période. ` +
      `Indiquez d’abord la date de fin du prix actuel, puis créez le nouveau prix.`,
    correction: () => 'Indiquer la fin du prix actuel',
  },
  ERR_TARIF_INCOHERENT: {
    niveau: 'bloquant',
    cas: 'Base : la version de prix d’une ligne ne correspond pas au produit de la ligne.',
    message: () =>
      `Le prix enregistré ne correspond pas à ce produit. Rechargez la page et choisissez à nouveau le produit.`,
    correction: () => 'Recharger',
  },
  ERR_PRODUIT_EN_DOUBLE: {
    niveau: 'bloquant',
    cas: 'Base : un produit hors catalogue porte déjà ce nom.',
    message: () =>
      `Un produit porte déjà ce nom. Choisissez un autre nom, ou modifiez le produit existant.`,
    correction: () => 'Choisir un autre nom',
  },

  // --- Techniques ------------------------------------------------------------------------
  ERR_SERVEUR_INDISPONIBLE: {
    niveau: 'bloquant',
    cas: 'Base de données injoignable ou saturée.',
    message: (p) =>
      `Le serveur ne répond pas pour le moment. Réessayez dans quelques minutes ; ` +
      `si cela continue, prévenez le gérant en citant la référence ${p.reference}.`,
    correction: () => 'Réessayer',
  },
  ERR_CONFIGURATION_SERVEUR: {
    niveau: 'bloquant',
    cas: 'Installation du serveur incomplète (base non initialisée, réglage manquant).',
    message: (p) =>
      `L’application n’est pas prête sur le serveur. Prévenez le gérant en citant la référence ${p.reference}.`,
    autreSortie: APPELER_LE_GERANT,
  },
  ERR_DONNEE_INTROUVABLE: {
    niveau: 'bloquant',
    cas: 'L’élément visé n’existe plus (supprimé depuis un autre poste).',
    message: (p) =>
      `Cet élément n’existe plus, il a peut-être été supprimé sur un autre appareil. ` +
      `Rechargez la page. Référence ${p.reference}.`,
    correction: () => 'Recharger',
  },
  ERR_DEJA_ENREGISTRE: {
    niveau: 'bloquant',
    cas: 'Enregistrement en double (contrainte d’unicité).',
    message: (p) =>
      `Cet élément est déjà enregistré. Rechargez la page pour voir la version à jour. Référence ${p.reference}.`,
    correction: () => 'Recharger',
  },
  ERR_INATTENDUE: {
    niveau: 'bloquant',
    cas: 'Imprévu (bug).',
    message: (p) =>
      `Un problème imprévu est survenu. Réessayez ; si cela recommence, ` +
      `prévenez le gérant en citant la référence ${p.reference}.`,
    correction: () => 'Réessayer',
  },

  // --- Rapport d'import du catalogue ----------------------------------------------------------
  ERR_DATE_EFFET_INVALIDE: rapport('bloquant', 'date d’effet absente ou mal écrite.',
    'Date d’effet du tarif illisible', 'Écrivez-la au format année-mois-jour puis relancez l’import.'),
  ERR_DATE_EFFET_PASSEE: rapport('bloquant', 'le nouveau tarif commencerait à une date déjà passée.',
    'Ce tarif commencerait à une date déjà passée', 'Choisissez une date d’effet à partir d’aujourd’hui puis relancez l’import.'),
  ERR_ENTETE_CSV: rapport('bloquant', 'colonnes du fichier CSV différentes de celles attendues.',
    'Les colonnes du fichier ne sont pas celles attendues', 'Reprenez le modèle de fichier du tarif, sans renommer ni déplacer de colonne, puis relancez l’import.'),
  ERR_LIGNE_MALFORMEE: rapport('bloquant', 'ligne du CSV avec un mauvais nombre de colonnes.',
    'Cette ligne n’a pas le bon nombre de colonnes', 'Vérifiez les virgules et les guillemets de la ligne puis relancez l’import.'),
  ERR_FICHIER_SUR_COMMANDE: rapport('bloquant', 'fichier des tarifs sur commande illisible ou incomplet.',
    'Le fichier des tarifs sur commande est incomplet', 'Complétez l’affiche ou le produit signalé puis relancez l’import.'),
  ERR_LIBELLE_VIDE: rapport('bloquant', 'produit ou catégorie sans libellé.',
    'Libellé du produit ou de la catégorie vide', 'Écrivez le nom du produit tel qu’il est connu au magasin puis relancez l’import.'),
  ERR_IDENTIFIANT_INVALIDE: rapport('bloquant', 'identifiant de produit absent ou mal formé.',
    'Identifiant du produit absent ou mal écrit', 'Corrigez l’identifiant (minuscules, chiffres et tirets) puis relancez l’import.'),
  ERR_DOUBLON_IDENTIFIANT: rapport('bloquant', 'deux produits du fichier portent le même identifiant.',
    'Deux produits portent le même identifiant', 'Gardez un seul produit par identifiant puis relancez l’import.'),
  ERR_IDENTIFIANT_DEJA_PRIS: rapport('bloquant', 'identifiant déjà utilisé par l’autre grille (comptoir / sur commande).',
    'Cet identifiant est déjà utilisé par un autre tarif', 'Donnez un identifiant différent à ce produit puis relancez l’import.'),
  ERR_PRIX_VIDE: rapport('bloquant', 'prix vide.',
    'Prix vide', 'Indiquez le prix du produit puis relancez l’import.'),
  ERR_PRIX_NON_NUMERIQUE: rapport('bloquant', 'prix illisible ou non entier en centimes.',
    'Prix illisible', 'Écrivez le prix en chiffres puis relancez l’import.'),
  ERR_PRIX_NUL_OU_NEGATIF: rapport('bloquant', 'prix nul ou négatif.',
    'Prix nul ou négatif', 'Indiquez le vrai prix du produit puis relancez l’import.'),
  ERR_PRIX_INCOHERENT: rapport('bloquant', 'les deux colonnes de prix de la ligne ne disent pas la même chose.',
    'Les deux prix de cette ligne ne concordent pas', 'Gardez le bon prix dans les deux colonnes puis relancez l’import.'),
  ERR_PRIX_SANS_PRODUIT: rapport('bloquant', 'prix fourni pour un produit qui n’existe pas dans le fichier.',
    'Prix sans fiche produit', 'Ajoutez la fiche du produit ou retirez ce prix puis relancez l’import.'),
  ERR_PRODUIT_SANS_PRIX: rapport('bloquant', 'produit du tarif fourni sans prix.',
    'Produit sans prix', 'Indiquez son prix ou retirez-le du tarif puis relancez l’import.'),
  ERR_UNITE_INCONNUE: rapport('bloquant', 'unité différente de « piece » et « kg ».',
    'Unité inconnue', 'Indiquez « piece » ou « kg » puis relancez l’import.'),
  ERR_PRODUIT_KG_A_LA_PIECE: rapport('bloquant', 'produit vendu au kilo (LOI 2) déclaré à la pièce.',
    'Ce produit se vend au kilo mais il est déclaré à la pièce', 'Indiquez l’unité « kg » puis relancez l’import.'),
  ERR_PRODUIT_KG_INATTENDU: rapport('bloquant', 'produit déclaré au kilo hors de la liste des produits au kilo (LOI 2).',
    'Ce produit est déclaré au kilo alors qu’il se vend à la pièce', 'Indiquez l’unité « piece », ou faites confirmer la vente au kilo par le gérant, puis relancez l’import.'),
  ERR_SEUIL_AU_KILO: rapport('bloquant', 'produit au kilo portant un minimum ou un maximum (unité du seuil inconnue).',
    'Ce produit au kilo porte un minimum ou un maximum', 'Faites préciser par le gérant si le seuil est en kilos ou en pièces, puis relancez l’import.'),
  ERR_FAVORI_ILLISIBLE: rapport('bloquant', 'colonne favori ni « oui » ni « non ».',
    'Colonne favori illisible', 'Écrivez « oui » ou « non » puis relancez l’import.'),
  ERR_FAVORI_INCOHERENT: rapport('bloquant', 'ligne de la liste Favoris mal marquée (LOI 4).',
    'Cette ligne des favoris est mal marquée', 'Marquez-la comme favori, ou sortez-la de la liste Favoris, puis relancez l’import.'),
  ERR_FAVORI_SANS_JUMEAU: rapport('bloquant', 'favori sans produit correspondant dans un vrai rayon (LOI 4).',
    'Ce favori ne correspond à aucun produit d’un rayon', 'Ajoutez le produit dans son rayon, ou retirez-le des favoris, puis relancez l’import.'),
  ERR_FAVORI_JUMEAU_APPROXIMATIF: rapport('bloquant', 'favori dont le libellé ne correspond qu’approximativement à un produit de rayon.',
    'Ce favori ressemble à un produit de rayon sans porter exactement le même nom', 'Écrivez le même nom dans les deux lignes puis relancez l’import.'),
  ERR_FAVORI_AMBIGU: rapport('bloquant', 'favori correspondant à plusieurs produits de rayon.',
    'Ce favori correspond à plusieurs produits', 'Précisez de quel produit il s’agit puis relancez l’import.'),
  ERR_FAVORI_PRIX_DIFFERENT: rapport('bloquant', 'favori et produit de rayon avec des prix différents.',
    'Le favori et le produit du rayon n’ont pas le même prix', 'Faites confirmer le bon prix par le gérant, écrivez-le dans les deux lignes, puis relancez l’import.'),
  ERR_REGIME_ABSENT: rapport('bloquant', 'régime de prix absent ou invalide (jamais déduit du nom, LOI 6).',
    'Façon de vendre le produit non précisée', 'Indiquez le régime de prix du produit puis relancez l’import.'),
  ERR_REGIME_INCOHERENT: rapport('bloquant', 'régime de prix incompatible avec la base de prix ou le plancher.',
    'Le régime de prix ne correspond pas à la façon de calculer le prix', 'Corrigez le régime ou la base de prix puis relancez l’import.'),
  ERR_BASE_PRIX_INVALIDE: rapport('bloquant', 'base de prix inconnue.',
    'Base de prix inconnue', 'Indiquez une base de prix reconnue puis relancez l’import.'),
  ERR_PLANCHER_NON_PRECISE: rapport('bloquant', 'le fichier ne dit pas si le prix est un plancher « à partir de ».',
    'Le fichier ne dit pas si ce prix est un prix « à partir de »', 'Précisez-le puis relancez l’import.'),
  ERR_MINIMUM_INVALIDE: rapport('bloquant', 'minimum non entier.',
    'Minimum mal écrit', 'Écrivez le minimum en nombre entier puis relancez l’import.'),
  ERR_TYPE_MINIMUM: rapport('bloquant', 'type de minimum autre que bloquant, ou type sans minimum (LOI 7).',
    'Type de minimum non accepté : tout minimum est bloquant', 'Corrigez le type de minimum puis relancez l’import.'),
  ERR_MAXIMUM_INVALIDE: rapport('bloquant', 'maximum mal décrit.',
    'Maximum mal décrit', 'Corrigez le maximum puis relancez l’import.'),
  ERR_ETAGES_INVALIDE: rapport('bloquant', 'nombre d’étages invalide.',
    'Nombre d’étages mal écrit', 'Écrivez un nombre entier d’étages puis relancez l’import.'),
  ERR_VARIANTES_INVALIDES: rapport('bloquant', 'variantes mal décrites.',
    'Variantes mal décrites', 'Corrigez la liste des variantes puis relancez l’import.'),
  ERR_RAPPROCHEMENT_INVALIDE: rapport('bloquant', 'rapprochement avec le comptoir mal décrit.',
    'Lien avec le produit du comptoir mal décrit', 'Corrigez ce lien puis relancez l’import.'),
  ERR_CHANGEMENT_UNITE: rapport('bloquant', 'le fichier change l’unité (pièce / kg) d’un produit existant.',
    'Le fichier change l’unité de ce produit', 'Gardez l’unité actuelle, ou créez un nouveau produit avec la nouvelle unité, puis relancez l’import.'),
  ERR_CHANGEMENT_REGIME: rapport('bloquant', 'le fichier change le régime de prix d’un produit existant.',
    'Le fichier change la façon de vendre ce produit', 'Gardez le régime actuel, ou créez un nouveau produit, puis relancez l’import.'),
  ERR_CHEVAUCHEMENT_TARIFS: rapport('bloquant', 'deux tarifs couvrent la même période.',
    'Ce tarif chevauche un tarif existant', 'Corrigez les dates d’effet puis relancez l’import.'),
  ERR_VERSION_ANTERIEURE: rapport('bloquant', 'tarif plus ancien que le dernier tarif importé.',
    'Ce tarif est plus ancien que le dernier tarif importé', 'Vérifiez la date d’effet du fichier puis relancez l’import.'),
  ERR_VERSION_DEJA_IMPORTEE_DIFFERENTE: rapport('bloquant', 'un tarif de même date existe déjà avec un contenu différent.',
    'Un tarif de même date est déjà enregistré avec d’autres valeurs', 'Donnez une nouvelle date d’effet aux changements puis relancez l’import.'),
  ERR_VERSION_INCONNUE_EN_BASE: rapport('bloquant', 'la base contient un prix que les fichiers ne décrivent pas.',
    'Le serveur contient un prix absent des fichiers', 'Ajoutez ce tarif aux fichiers, ou faites vérifier par le gérant, puis relancez l’import.'),
  ERR_PERIODE_DIFFERENTE: rapport('bloquant', 'la période d’un prix diffère entre la base et les fichiers.',
    'La période de ce prix diffère entre le serveur et les fichiers', 'Alignez les dates dans les fichiers puis relancez l’import.'),
  AVERT_CARACTERE_INVISIBLE: rapport('avertissement', 'caractère invisible dans un libellé.',
    'Caractère invisible dans le libellé', 'Retirez-le du fichier au prochain import.'),
  AVERT_PRIX_A_CONFIRMER: rapport('avertissement', 'prix inhabituel, à faire confirmer.',
    'Prix inhabituel', 'Faites confirmer ce prix par le gérant.'),
  AVERT_PRODUIT_KG_ABSENT: rapport('avertissement', 'un produit vendu au kilo manque dans ce tarif.',
    'Un produit vendu au kilo manque dans ce tarif', 'Vérifiez avec le gérant s’il est toujours vendu.'),
  AVERT_FAVORI_EN_DOUBLE: rapport('avertissement', 'favori présent plusieurs fois.',
    'Ce favori apparaît plusieurs fois', 'Il n’est compté qu’une fois ; retirez le doublon du fichier au prochain import.'),
  AVERT_LIBELLE_MODIFIE: rapport('avertissement', 'libellé modifié entre deux tarifs (même produit).',
    'Libellé modifié', 'Même produit, historique conservé : vérifiez que les employés le reconnaîtront.'),
  AVERT_PRODUIT_HORS_FICHIERS: rapport('avertissement', 'produit présent sur le serveur mais dans aucun fichier.',
    'Produit présent sur le serveur mais absent des fichiers', 'Il est laissé tel quel ; vérifiez avec le gérant s’il est toujours vendu.'),
  AVERT_ECART_AFFICHE_EXCEL: rapport('avertissement', 'prix différent entre l’affiche du gérant et le tarif comptoir.',
    'Prix différent entre l’affiche et le tarif comptoir', 'Signalez l’écart au gérant.'),
  AVERT_LIBELLE_AFFICHE_EXCEL: rapport('avertissement', 'libellé différent entre l’affiche du gérant et le tarif comptoir (LOI 5).',
    'Nom différent entre l’affiche et le tarif comptoir', 'Les deux noms sont conservés tels quels ; signalez l’écart au gérant.'),
  AVERT_RAPPROCHEMENT_INTROUVABLE: rapport('avertissement', 'produit de l’affiche introuvable au tarif comptoir.',
    'Produit de l’affiche introuvable au tarif comptoir', 'Vérifiez le lien avec le gérant.'),
  INFO_IMPORT: rapport('information', 'résumé de l’import.',
    'Import terminé', 'Vérifiez les avertissements ci-dessus s’il y en a.'),
  INFO_DEJA_IMPORTE: rapport('information', 'tarif identique déjà enregistré : rien à faire.',
    'Ce tarif est déjà enregistré à l’identique', 'Aucune action nécessaire.'),
  INFO_FAVORIS: rapport('information', 'résumé des favoris rattachés à leur produit.',
    'Favoris rattachés à leur produit', 'Aucune action nécessaire.'),
  INFO_ESPACES_LIBELLE: rapport('information', 'espaces en trop dans un libellé, conservé tel quel (LOI 5).',
    'Espaces en trop dans le libellé, conservé tel quel', 'Vous pouvez les retirer du fichier au prochain import.'),
  INFO_RESTE_ARCHIVE: rapport('information', 'produit au tarif mais désactivé sur le serveur : il reste désactivé.',
    'Produit au tarif mais désactivé : il reste désactivé', 'Réactivez-le si le gérant le demande.'),
  INFO_AFFICHE_EXCEL_COHERENTS: rapport('information', 'affiche et tarif comptoir concordent.',
    'L’affiche et le tarif comptoir concordent', 'Aucune action nécessaire.'),
  INFO_HYPOTHESE: rapport('information', 'hypothèse à valider avec le gérant (règle de doute).',
    'Hypothèse à valider', 'Faites-la confirmer par le gérant.'),
};

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

/** Vrai si `code` est un code du catalogue. */
export function estCodeCatalogue(code: string): code is CodeCatalogue {
  return Object.prototype.hasOwnProperty.call(CATALOGUE, code);
}

/** Texte du message pour un code et ses paramètres. */
export function messagePour<C extends CodeCatalogue>(code: C, params: ParametresMessages[C]): string {
  return CATALOGUE[code].message(params);
}

/** Libellé du bouton de correction, s'il existe pour ce code. */
export function libelleCorrection<C extends CodeCatalogue>(
  code: C,
  params: ParametresMessages[C],
): string | undefined {
  return CATALOGUE[code].correction?.(params);
}

/**
 * La sortie à proposer à l'écran : le bouton de correction s'il existe
 * (`type: 'correction'`), sinon l'issue de secours (`type: 'autre'`, ex.
 * « Appeler le gérant »). `undefined` seulement pour un avertissement ou une
 * information sans action.
 */
export function sortiePour<C extends CodeCatalogue>(
  code: C,
  params: ParametresMessages[C],
): { type: 'correction' | 'autre'; libelle: string } | undefined {
  const e = CATALOGUE[code];
  const correction = e.correction?.(params);
  if (correction) return { type: 'correction', libelle: correction };
  if (e.autreSortie) return { type: 'autre', libelle: e.autreSortie };
  return undefined;
}

/**
 * Construit le signalement complet depuis le catalogue.
 *   signaler('ERR_QUANTITE_MIN', { produit, minimum, unite: 'parts' },
 *            { champ: 'quantite', valeurProposee: minimum })
 */
export function signaler<C extends CodeCatalogue & CodeBloquant>(
  code: C, params: ParametresMessages[C], options?: Options): Echec;
export function signaler<C extends CodeCatalogue & CodeAvertissement>(
  code: C, params: ParametresMessages[C], options?: Options): Avertissement;
export function signaler<C extends CodeCatalogue & CodeInformation>(
  code: C, params: ParametresMessages[C], options?: Options): Information;
export function signaler(
  code: CodeCatalogue,
  params: ParametresMessages[CodeCatalogue],
  options?: Options,
): Echec | Avertissement | Information {
  const message = (CATALOGUE[code].message as (p: unknown) => string)(params);
  if (code.startsWith('ERR_')) return bloquant(code as CodeBloquant, message, options);
  if (code.startsWith('AVERT_')) return avertir(code as CodeAvertissement, message, options);
  return informer(code as CodeInformation, message, options);
}
