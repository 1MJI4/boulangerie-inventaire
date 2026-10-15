// src/domaine/messages.ts
//
// Catalogue UNIQUE des codes et des messages (CLAUDE.md, LOI N°8 et N°9).
// Propriétaire : agent `gestion-erreurs`. Vérifié par `qa-metier`, traduit pour le
// gérant par `documentation-gerant`.
//
// Ce fichier décide COMMENT un refus est dit, jamais QUAND il se produit :
// aucun seuil, aucun jour de fermeture, aucun prix ici. Toutes les valeurs
// (minimum, nom du produit, prix déjà formaté, date déjà formatée…) sont
// fournies par l'appelant (`regles-metier`, `catalogue-prix`).
//
// Règles d'écriture : français, vouvoiement, pas de jargon, pas de point
// d'exclamation, et chaque message dit QUOI FAIRE (ou qui prévenir).

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

export type ParametresMessages = {
  // --- Refus métier -------------------------------------------------------
  /**
   * `jour` : libellé du jour fermé (« mardi », « 25 décembre »…), fourni par le
   * calendrier ou par la base (DETAIL du refus). Absent si la base ne l'a pas
   * transmis : le message reste exact sans lui.
   */
  ERR_JOUR_FERME: { jour?: string };
  /** `periode` : libellé de la fermeture pour congés (« congés d'été »…), facultatif. */
  ERR_PERIODE_CONGES: { periode?: string };
  /** `unite` : « pièces » ou « parts ». `precision` : ex. « 15 parts par chiffre ». */
  ERR_QUANTITE_MIN: { produit: string; minimum: number; unite: string; precision?: string };
  /**
   * Prix déjà formaté par `argent.ts` (montant + symbole euro). Aucune arithmétique ici.
   * Les deux champs sont absents quand le refus vient de la base (déclencheur) :
   * le message ne cite alors ni produit ni montant.
   */
  ERR_SOUS_PLANCHER: { produit?: string; plancherFormate?: string };
  /** `action` : ce qui est réservé, en clair (« modifier un tarif »). */
  ERR_DROIT_INSUFFISANT: { action: string; role: string };
  /** `premiereDate` : date déjà formatée (« mercredi 22 octobre »). */
  ERR_DELAI_TROP_COURT: { delaiJoursOuvres: number; premiereDate: string };

  // --- Avertissements -----------------------------------------------------
  AVERT_PAIN_SUPPLEMENTAIRE: { maximum: number; demande: number };
  AVERT_DOUBLE_SCAN: { produit: string };
  /** `date` : date limite déjà formatée. */
  AVERT_DLC_PROCHE: { produit: string; date: string };

  // --- Informations -------------------------------------------------------
  /** `dateEffet` : date déjà formatée. */
  INFO_TARIF_EN_VIGUEUR: { dateEffet: string };
  INFO_EN_ATTENTE_ENVOI: { nombre: number };

  // --- Données incohérentes (famille 5) -----------------------------------
  ERR_TARIF_ABSENT: { produit: string; date: string };
  ERR_PRODUIT_INCONNU: Record<string, never>;
  ERR_SAISIE_INVALIDE: { champLibelle: string };

  // --- Refus levés par la base (déclencheurs, LOIS 1, 2, 4, 6) ------------
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

  // --- Techniques (familles 4 et 6) ---------------------------------------
  ERR_SERVEUR_INDISPONIBLE: AvecReference;
  ERR_CONFIGURATION_SERVEUR: AvecReference;
  ERR_DONNEE_INTROUVABLE: AvecReference;
  ERR_DEJA_ENREGISTRE: AvecReference;
  ERR_SESSION_EXPIREE: Record<string, never>;
  ERR_INATTENDUE: AvecReference;
};

export type CodeCatalogue = keyof ParametresMessages;

type Entree<C extends CodeCatalogue> = {
  niveau: Niveau;
  /** Le cas qui produit ce code (pour qa-metier et documentation-gerant). */
  cas: string;
  message: (p: ParametresMessages[C]) => string;
  /** Libellé du bouton de sortie (LOI 7 : « tout refus doit proposer la sortie »). */
  correction?: (p: ParametresMessages[C]) => string;
};

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

// ---------------------------------------------------------------------------
// Le catalogue
// ---------------------------------------------------------------------------

export const CATALOGUE: { [C in CodeCatalogue]: Entree<C> } = {
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
  ERR_QUANTITE_MIN: {
    niveau: 'bloquant',
    cas: 'Quantité sous le minimum du produit (LOI 7, tous les minimums sont bloquants).',
    message: (p) =>
      `Minimum ${p.minimum} ${p.unite} pour « ${p.produit} »` +
      (p.precision ? ` (${p.precision})` : '') +
      `. Passez à ${p.minimum} ${p.unite} pour continuer.`,
    correction: (p) => `Passer à ${p.minimum} ${p.unite}`,
  },
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
  ERR_DROIT_INSUFFISANT: {
    niveau: 'bloquant',
    cas: 'Action réservée à un rôle que l’utilisateur connecté n’a pas.',
    message: (p) =>
      `Seul le ${p.role} peut ${p.action}. Demandez-lui de le faire ou de saisir son code.`,
  },
  ERR_DELAI_TROP_COURT: {
    niveau: 'bloquant',
    cas: 'Date de retrait trop proche, délai compté en jours ouvrés.',
    message: (p) =>
      `Cette commande demande ${p.delaiJoursOuvres} ${pluriel(p.delaiJoursOuvres, 'jour ouvré', 'jours ouvrés')} de préparation. ` +
      `Premier retrait possible : ${p.premiereDate}.`,
    correction: (p) => `Passer au ${p.premiereDate}`,
  },

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

  ERR_TARIF_ABSENT: {
    niveau: 'bloquant',
    cas: 'Aucun prix au catalogue pour ce produit à cette date.',
    message: (p) =>
      `Aucun prix n’est enregistré pour « ${p.produit} » au ${p.date}. ` +
      `Ne vendez pas ce produit tant que le gérant n’a pas saisi son prix.`,
  },
  ERR_PRODUIT_INCONNU: {
    niveau: 'bloquant',
    cas: 'Référence scannée ou saisie absente du catalogue (ou archivée).',
    message: () =>
      `Ce produit n’est pas dans le catalogue. Mettez-le de côté et signalez-le au gérant.`,
  },
  ERR_SAISIE_INVALIDE: {
    niveau: 'bloquant',
    cas: 'Donnée reçue incomplète ou mal formée.',
    message: (p) => `Le champ « ${p.champLibelle} » est incomplet ou mal rempli. Corrigez-le puis réessayez.`,
  },

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
  },
  ERR_REGIME_FIGE: {
    niveau: 'bloquant',
    cas: 'Base : changement de régime de prix d’un produit qui a déjà des prix ou des commandes.',
    message: () =>
      `Ce produit a déjà des prix ou des commandes : sa façon d’être vendu (comptoir, traiteur, gâteau par personne) ` +
      `ne peut plus changer. Créez un nouveau produit pour l’autre façon de le vendre.`,
  },
  ERR_TARIF_IMMUABLE: {
    niveau: 'bloquant',
    cas: 'Base : modification ou suppression d’un prix déjà entré en vigueur.',
    message: () =>
      `Un prix déjà en vigueur ne se modifie pas et ne se supprime pas. ` +
      `Créez un nouveau prix avec sa date d’entrée en vigueur.`,
  },
  ERR_TARIF_PASSE: {
    niveau: 'bloquant',
    cas: 'Base : réécriture de la période passée d’un prix.',
    message: () =>
      `Une période de prix déjà écoulée ne se modifie pas. ` +
      `Choisissez une date de fin à partir d’aujourd’hui, ou créez un nouveau prix.`,
  },
  ERR_TARIF_CHEVAUCHEMENT: {
    niveau: 'bloquant',
    cas: 'Base : deux versions de prix couvrant la même période pour un produit.',
    message: () =>
      `Un autre prix couvre déjà cette période. ` +
      `Indiquez d’abord la date de fin du prix actuel, puis créez le nouveau prix.`,
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
  },

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
  ERR_SESSION_EXPIREE: {
    niveau: 'bloquant',
    cas: 'Session absente ou expirée.',
    message: () => `Votre session a expiré. Saisissez à nouveau votre code pour continuer.`,
  },
  ERR_INATTENDUE: {
    niveau: 'bloquant',
    cas: 'Imprévu (bug).',
    message: (p) =>
      `Un problème imprévu est survenu. Réessayez ; si cela recommence, ` +
      `prévenez le gérant en citant la référence ${p.reference}.`,
    correction: () => 'Réessayer',
  },
};

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

/** Texte du message pour un code et ses paramètres. */
export function messagePour<C extends CodeCatalogue>(code: C, params: ParametresMessages[C]): string {
  return CATALOGUE[code].message(params);
}

/** Libellé du bouton de sortie, s'il existe pour ce code. */
export function libelleCorrection<C extends CodeCatalogue>(
  code: C,
  params: ParametresMessages[C],
): string | undefined {
  return CATALOGUE[code].correction?.(params);
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
