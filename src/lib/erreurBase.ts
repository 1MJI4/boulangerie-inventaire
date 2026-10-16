// src/lib/erreurBase.ts
//
// Traduit une erreur technique (Prisma, réseau, bug) en échec typé au format
// de la LOI 9, destiné à l'employé. Propriétaire : agent `gestion-erreurs`.
//
// Audit sécurité M4 : la réponse au client ne contient PLUS jamais de nom de
// variable d'environnement, de port, de `binaryTargets`, d'état de
// configuration ni de message Prisma brut. Tout cela part dans le journal
// serveur (champ `piste` + `detail` filtré), retrouvable par la référence
// courte affichée à l'employé.
//
// Pas d'import de Prisma : les erreurs sont reconnues par leur `name` et leur
// code Pxxxx (robuste au bundling, et testable avec `node --test`).

import type { Echec } from '../domaine/resultat.ts';
import { pourClient } from '../domaine/resultat.ts';
import { signaler } from '../domaine/messages.ts';
import { formaterEuros } from '../domaine/argent.ts';
import { journaliser, nouvelleReference } from './journal.ts';

/**
 * Corps JSON d'un échec renvoyé au client : contrat LOI 9 + compatibilité.
 * `error` et `erreur` (= `message`) sont conservés pour les écrans qui lisent
 * encore `(await reponse.json()).error` / `.erreur` ; à retirer quand tous
 * lisent `message`.
 */
export type CorpsEchec = Echec & { error: string; erreur: string };

/** Corps renvoyé par `diagnostiquer` : + la référence courte du journal. */
export type Diagnostic = CorpsEchec & { reference: string };

/**
 * Seule façon de transformer un échec en corps JSON pour le client
 * (routes API, proxy, garde d'authentification). Filtre tout champ hors
 * contrat (`pourClient`) puis ajoute `error` / `erreur` pour les écrans.
 */
export function corpsClient(echec: Echec): CorpsEchec {
  const propre = pourClient(echec);
  return { ...propre, error: propre.message, erreur: propre.message };
}

// ---------------------------------------------------------------------------
// Refus levés par la base (déclencheurs PL/pgSQL des migrations du lot 1)
// ---------------------------------------------------------------------------
//
// Format posé par `base-donnees` :
//   RAISE EXCEPTION USING ERRCODE = 'P0001' (ou '23505'),
//     MESSAGE = 'ERR_…', DETAIL = précision, HINT = 'champ=<nom>'
//
// Forme réelle côté Prisma 6 (moteur natif, sans adaptateur) :
//   - requête de modèle → PrismaClientUnknownRequestError dont le message
//     contient le Debug Rust :
//       ConnectorError(ConnectorError { user_facing_error: None, kind:
//       QueryError(PostgresError { code: "P0001", message: "ERR_JOUR_FERME",
//       severity: "ERROR", detail: Some("mardi"), column: None,
//       hint: Some("champ=retraitLe") }), transient: false })
//   - requête brute ($queryRaw/$executeRaw) → PrismaClientKnownRequestError
//     P2010, meta = { code: 'P0001', message: '…ERR_JOUR_FERME…' } ;
//     DETAIL/HINT peuvent manquer → champ par défaut ci-dessous.
//   - SQLSTATE 23505 levé par un déclencheur → le moteur le convertit en
//     P2002 et PERD le MESSAGE. Depuis la séparation inventaire / catalogue
//     (LOI 10), `Produit.nom` est de nouveau une contrainte @unique ordinaire :
//     un P2002 sur Produit.nom est le doublon de nom (ERR_PRODUIT_EN_DOUBLE).
//   - pilote pg direct (adaptateur) → { code: 'P0001', message, detail, hint }.

/** Codes que la base peut lever, avec le champ visé si le HINT manque. */
const CODES_BASE: Record<string, string | undefined> = {
  ERR_JOUR_FERME: 'retraitLe',
  ERR_PERIODE_CONGES: 'retraitLe',
  ERR_UNITE_INCOHERENTE: undefined,
  ERR_UNITE_FIGEE: 'unite',
  ERR_REGIME_FIGE: 'regimePrix',
  ERR_TARIF_IMMUABLE: undefined,
  ERR_TARIF_PASSE: 'valideAu',
  ERR_TARIF_CHEVAUCHEMENT: 'valideDu',
  ERR_TARIF_INCOHERENT: 'prixProduitId',
  ERR_SOUS_PLANCHER: 'prixCentimes',
  ERR_PRODUIT_EN_DOUBLE: 'nom',
  // Lot 2 — commandes et règlement intérieur (migration 20261015140000).
  ERR_COMMANDE_LENDEMAIN: 'retraitLe',
  ERR_DATE_PASSEE: 'retraitLe',
  ERR_ACOMPTE_INSUFFISANT: 'acompte', // DETAIL « minimum=<centimes>;pourcentage=<n> »
  ERR_ACOMPTE_SUPERIEUR_TOTAL: 'acompte',
  ERR_TOTAL_INCOHERENT: 'total',
  ERR_REMISE_NON_AUTORISEE: 'total',
  ERR_QUANTITE_MIN: 'quantite', // DETAIL « minimum=<n> »
  ERR_NB_SYMBOLES_MANQUANT: 'nbSymboles',
  ERR_DROIT_INSUFFISANT: 'prixCentimes', // ligne libre sans accord du gérant
  ERR_MONTANT_NUL: 'prixCentimes',
  // Réglage du règlement absent ou supprimé : rien à corriger à l'écran, aucun champ.
  ERR_CONFIGURATION_SERVEUR: undefined,
};

export type CodeBase =
  | 'ERR_JOUR_FERME' | 'ERR_PERIODE_CONGES' | 'ERR_UNITE_INCOHERENTE' | 'ERR_UNITE_FIGEE'
  | 'ERR_REGIME_FIGE' | 'ERR_TARIF_IMMUABLE' | 'ERR_TARIF_PASSE' | 'ERR_TARIF_CHEVAUCHEMENT'
  | 'ERR_TARIF_INCOHERENT' | 'ERR_SOUS_PLANCHER' | 'ERR_PRODUIT_EN_DOUBLE'
  | 'ERR_COMMANDE_LENDEMAIN' | 'ERR_DATE_PASSEE' | 'ERR_ACOMPTE_INSUFFISANT' | 'ERR_ACOMPTE_SUPERIEUR_TOTAL'
  | 'ERR_TOTAL_INCOHERENT' | 'ERR_REMISE_NON_AUTORISEE' | 'ERR_QUANTITE_MIN' | 'ERR_NB_SYMBOLES_MANQUANT'
  | 'ERR_DROIT_INSUFFISANT' | 'ERR_MONTANT_NUL' | 'ERR_CONFIGURATION_SERVEUR';

/** Liste exposée pour les tests (un cas par code levé par la base). */
export const CODES_LEVES_PAR_LA_BASE = Object.keys(CODES_BASE) as CodeBase[];

export type RefusBase = { code: CodeBase; sqlstate?: string; detail?: string; champ?: string };

function estCodeBase(c: string): c is CodeBase {
  return Object.prototype.hasOwnProperty.call(CODES_BASE, c);
}

/** La cible d'un P2002 désigne-t-elle la colonne `nom` (ou l'index Produit_nom_key) ? */
function cibleNom(cible: unknown): boolean {
  const cibles = Array.isArray(cible) ? cible.map(String) : typeof cible === 'string' ? [cible] : [];
  return cibles.some((c) => c === 'nom' || /(^|_)nom(_key)?$/.test(c));
}

/** Déséchappe une chaîne Debug Rust / JSON ; renvoie le brut si impossible. */
function desechapper(brut: string): string {
  try {
    return JSON.parse(`"${brut}"`) as string;
  } catch {
    return brut.replace(/\\"/g, '"');
  }
}

const RE_DETAIL_RUST = /\bdetail: Some\("((?:[^"\\]|\\.)*)"\)/;
const RE_HINT_RUST = /\bhint: Some\("((?:[^"\\]|\\.)*)"\)/;
const RE_DETAIL_PG = /^DETAIL:\s*(.+)$/m;
const RE_HINT_PG = /^HINT:\s*(.+)$/m;
const RE_CHAMP = /champ=([A-Za-z_][A-Za-z0-9_]*)/;
const RE_SQLSTATE_RUST = /PostgresError \{ code: "([0-9A-Z]{5})"/;

function extraire(texte: string, rust: RegExp, pg: RegExp): string | undefined {
  const r = rust.exec(texte);
  if (r) return desechapper(r[1]);
  const p = pg.exec(texte);
  return p ? p[1].trim() : undefined;
}

/**
 * Reconnaît un refus levé par un déclencheur de la base. `null` sinon.
 * Ne regarde que les erreurs Prisma ou les erreurs de pilote PostgreSQL
 * (SQLSTATE P0001 / 23505) : un `ERR_…` dans le message d'un bug ordinaire
 * n'est pas pris pour un refus métier.
 */
export function lireRefusBase(e: unknown): RefusBase | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as { name?: unknown; code?: unknown; message?: unknown; meta?: unknown; detail?: unknown; hint?: unknown };
  const name = typeof err.name === 'string' ? err.name : '';
  const code = typeof err.code === 'string' ? err.code : '';
  const message = typeof err.message === 'string' ? err.message : '';
  const meta = err.meta && typeof err.meta === 'object' ? (err.meta as Record<string, unknown>) : {};

  const estPrisma = name.startsWith('PrismaClient') || /^P\d{4}$/.test(code);
  const estPilote = !estPrisma && (code === 'P0001' || code === '23505');
  if (!estPrisma && !estPilote) return null;

  const metaMessage = typeof meta.message === 'string' ? meta.message : '';
  const texte = `${message}\n${metaMessage}`;
  const trouve = Array.from(texte.matchAll(/\bERR_[A-Z_]+\b/g), (m) => m[0]).find(estCodeBase);

  if (!trouve) {
    // Doublon de nom de produit d'inventaire : contrainte unique Produit.nom (P2002).
    if (code === 'P2002' && meta.modelName === 'Produit' && cibleNom(meta.target)) {
      return { code: 'ERR_PRODUIT_EN_DOUBLE', sqlstate: '23505', champ: CODES_BASE.ERR_PRODUIT_EN_DOUBLE };
    }
    return null;
  }

  const sqlstate =
    (typeof meta.code === 'string' && meta.code) ||
    RE_SQLSTATE_RUST.exec(texte)?.[1] ||
    (estPilote ? code : undefined) ||
    (code === 'P2002' ? '23505' : undefined);
  // Seuls les SQLSTATE levés par nos déclencheurs sont acceptés.
  if (sqlstate && sqlstate !== 'P0001' && sqlstate !== '23505') return null;

  const detail = (typeof err.detail === 'string' ? err.detail : undefined) ?? extraire(texte, RE_DETAIL_RUST, RE_DETAIL_PG);
  const hint = (typeof err.hint === 'string' ? err.hint : undefined) ?? extraire(texte, RE_HINT_RUST, RE_HINT_PG);
  // Une panne de configuration ne pointe aucun champ : l'employé n'y peut rien.
  const champ = trouve === 'ERR_CONFIGURATION_SERVEUR' ? undefined : (hint && RE_CHAMP.exec(hint)?.[1]) || CODES_BASE[trouve];

  const refus: RefusBase = { code: trouve };
  if (sqlstate) refus.sqlstate = sqlstate;
  if (detail) refus.detail = detail;
  if (champ) refus.champ = champ;
  return refus;
}

/** Libellé de fermeture affichable : court, sans caractère de contrôle ni guillemet. */
function libelleAffichable(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const t = detail.replace(/[\u0000-\u001f\u007f"`<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return t && t.length <= 60 ? t : undefined;
}

/**
 * Paramètres machine d'un DETAIL « cle=valeur;cle=valeur » (posés par
 * `base-donnees` pour ERR_ACOMPTE_INSUFFISANT et ERR_QUANTITE_MIN).
 * Seuls les entiers positifs ou nuls sont retenus : une valeur illisible est
 * ignorée (variante générique du message), jamais affichée.
 */
function entiersDuDetail(detail: string | undefined): Record<string, number> {
  const res: Record<string, number> = {};
  if (!detail) return res;
  for (const morceau of detail.split(';')) {
    const m = /^\s*([A-Za-z_]+)\s*=\s*(\d{1,12})\s*$/.exec(morceau);
    if (m) res[m[1]] = Number(m[2]);
  }
  return res;
}

/**
 * Échec du catalogue pour un refus de la base. Le DETAIL n'est repris que
 * comme libellé de fermeture (« mardi ») ou comme paramètres machine
 * (`minimum=…;pourcentage=…`) ; partout ailleurs il est technique et ne part
 * qu'au journal. `reference` : référence courte du journal (pannes de configuration).
 */
export function echecPourRefusBase(r: RefusBase, reference = nouvelleReference()): Echec {
  const options = r.champ ? { champ: r.champ } : undefined;
  switch (r.code) {
    case 'ERR_ACOMPTE_INSUFFISANT': {
      const { minimum, pourcentage } = entiersDuDetail(r.detail);
      const params: { minimumFormate?: string; pourcentage?: number } = {};
      if (minimum !== undefined) params.minimumFormate = formaterEuros(minimum);
      if (pourcentage !== undefined && pourcentage <= 100) params.pourcentage = pourcentage;
      return signaler('ERR_ACOMPTE_INSUFFISANT', params,
        minimum !== undefined ? { ...options, valeurProposee: minimum } : options);
    }
    case 'ERR_QUANTITE_MIN': {
      const { minimum } = entiersDuDetail(r.detail);
      if (minimum === undefined || minimum < 1) return signaler('ERR_QUANTITE_MIN', {}, options);
      return signaler('ERR_QUANTITE_MIN', { minimum }, { ...options, valeurProposee: minimum });
    }
    case 'ERR_CONFIGURATION_SERVEUR':
      return signaler('ERR_CONFIGURATION_SERVEUR', { reference });
    case 'ERR_JOUR_FERME': {
      const jour = libelleAffichable(r.detail);
      return signaler('ERR_JOUR_FERME', jour ? { jour } : {}, options);
    }
    case 'ERR_PERIODE_CONGES': {
      const periode = libelleAffichable(r.detail);
      return signaler('ERR_PERIODE_CONGES', periode ? { periode } : {}, options);
    }
    case 'ERR_SOUS_PLANCHER':
      return signaler('ERR_SOUS_PLANCHER', {}, options);
    default:
      return signaler(r.code, {}, options);
  }
}

// ---------------------------------------------------------------------------
// Contraintes CHECK (SQLSTATE 23514) : la donnée écrite est mal formée
// ---------------------------------------------------------------------------
//
// Prisma 6 ne convertit PAS 23514 en code Pxxxx (aucune correspondance dans
// le moteur 6.18) :
//   - requête de modèle → PrismaClientUnknownRequestError, Debug Rust :
//       PostgresError { code: "23514", message: "new row for relation
//       \"Commande\" violates check constraint \"Commande_total_convenu\"",
//       severity: "ERROR", detail: Some("Failing row contains (…)"), … }
//   - requête brute → PrismaClientKnownRequestError P2010,
//       meta = { code: '23514', message: '…violates check constraint "…"' }
//   - pilote pg direct → { code: '23514', constraint: '<nom>' }.
// Le DETAIL « Failing row contains » recopie toute la ligne (données client) :
// il n'est ni lu ni journalisé.

type CodeCheck =
  | 'ERR_SAISIE_INVALIDE' | 'ERR_DROIT_INSUFFISANT' | 'ERR_REMISE_NON_AUTORISEE'
  | 'ERR_ACOMPTE_SUPERIEUR_TOTAL' | 'ERR_QUANTITE_INVALIDE' | 'ERR_CONFIGURATION_SERVEUR';

type CibleCheck = { code: CodeCheck; champ?: string; champLibelle?: string };

/**
 * Contraintes connues → code + champ. *_trace (accord sans horodatage ou
 * inversement) = l'accord du gérant n'est pas prouvé → ERR_DROIT_INSUFFISANT ;
 * *_nom_non_vide (nom du gérant vide) = saisie incomplète → ERR_SAISIE_INVALIDE.
 * Le champ pointé est celui de l'écran, aligné sur le HINT des déclencheurs.
 */
const CHECKS: Record<string, CibleCheck> = {
  Commande_retrait_heure_format: { code: 'ERR_SAISIE_INVALIDE', champ: 'retraitHeure', champLibelle: 'heure de retrait' },
  Commande_accord_lendemain_trace: { code: 'ERR_DROIT_INSUFFISANT', champ: 'retraitLe' },
  Commande_remise_trace: { code: 'ERR_DROIT_INSUFFISANT', champ: 'total' },
  Commande_total_convenu: { code: 'ERR_REMISE_NON_AUTORISEE', champ: 'total' },
  Commande_acompte_max_total: { code: 'ERR_ACOMPTE_SUPERIEUR_TOTAL', champ: 'acompte' },
  LigneCommande_ligne_libre_trace: { code: 'ERR_DROIT_INSUFFISANT', champ: 'prixCentimes' },
  LigneCommande_deverrouillage_trace: { code: 'ERR_DROIT_INSUFFISANT', champ: 'prixCentimes' },
  LigneCommande_deverrouillage_nom_non_vide: { code: 'ERR_SAISIE_INVALIDE', champ: 'sousPlancherAutorisePar', champLibelle: 'nom du gérant' },
  LigneCommande_nbObjets_positif: { code: 'ERR_QUANTITE_INVALIDE', champ: 'nbObjets' },
  LigneCommande_nbSymboles_positif: { code: 'ERR_SAISIE_INVALIDE', champ: 'nbSymboles', champLibelle: 'chiffres ou lettres' },
  // Accord du gérant pour une taille de gâteau hors liste (migration 20261015150000).
  LigneCommande_taille_trace: { code: 'ERR_DROIT_INSUFFISANT', champ: 'tailleAutoriseePar' },
  LigneCommande_taille_nom_non_vide: { code: 'ERR_SAISIE_INVALIDE', champ: 'tailleAutoriseePar', champLibelle: 'nom du gérant' },
  // L'écran des réglages ÉCRIT dans Reglage : une valeur refusée par le CHECK
  // (fonction "reglage_valeur_valide", étendue par 20261015150000 ; le nom de
  // la contrainte, lui, reste "Reglage_reglement_valide") est une saisie mal
  // formée du gérant, pas une panne. Pas de champLibelle : la contrainte ne dit
  // pas quelle clé est fautive → message générique « vérifiez la saisie ».
  // La suppression d'une clé reste ERR_CONFIGURATION_SERVEUR (déclencheur P0001).
  Reglage_reglement_valide: { code: 'ERR_SAISIE_INVALIDE', champ: 'reglages' },
};

/** Liste exposée pour les tests (un cas par contrainte répertoriée). */
export const CHECKS_REPERTORIES = Object.keys(CHECKS);

export type ViolationCheck = CibleCheck & { contrainte?: string; connue: boolean };

const RE_NOM_CHECK = /check constraint \\*"([A-Za-z0-9_]+)\\*"/;

/**
 * Reconnaît une violation de contrainte CHECK (Prisma ou pilote). `null` sinon.
 * Contrainte non répertoriée → ERR_SAISIE_INVALIDE générique (jamais un refus
 * métier inventé), son nom part au journal pour qu'on l'ajoute ici.
 */
export function lireViolationCheck(e: unknown): ViolationCheck | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as { name?: unknown; code?: unknown; message?: unknown; meta?: unknown; constraint?: unknown };
  const name = typeof err.name === 'string' ? err.name : '';
  const code = typeof err.code === 'string' ? err.code : '';
  const message = typeof err.message === 'string' ? err.message : '';
  const meta = err.meta && typeof err.meta === 'object' ? (err.meta as Record<string, unknown>) : {};
  const metaMessage = typeof meta.message === 'string' ? meta.message : '';
  const texte = `${message}\n${metaMessage}`;

  const estPrisma = name.startsWith('PrismaClient') || /^P\d{4}$/.test(code);
  const sqlstate = estPrisma
    ? (typeof meta.code === 'string' && meta.code) || RE_SQLSTATE_RUST.exec(texte)?.[1]
    : code;
  if (sqlstate !== '23514') return null;

  const contrainte =
    (typeof err.constraint === 'string' && err.constraint) ||
    (typeof meta.constraint === 'string' && meta.constraint) ||
    RE_NOM_CHECK.exec(texte)?.[1] ||
    undefined;
  const cible = contrainte && Object.prototype.hasOwnProperty.call(CHECKS, contrainte) ? CHECKS[contrainte] : undefined;
  if (cible) return { ...cible, contrainte, connue: true };
  return { code: 'ERR_SAISIE_INVALIDE', contrainte, connue: false };
}

function echecPourCheck(c: ViolationCheck, reference: string): Echec {
  const options = c.champ ? { champ: c.champ } : undefined;
  switch (c.code) {
    case 'ERR_SAISIE_INVALIDE':
      return signaler('ERR_SAISIE_INVALIDE', c.champLibelle ? { champLibelle: c.champLibelle } : {}, options);
    case 'ERR_QUANTITE_INVALIDE':
      return signaler('ERR_QUANTITE_INVALIDE', { unite: 'piece' }, options);
    case 'ERR_CONFIGURATION_SERVEUR':
      return signaler('ERR_CONFIGURATION_SERVEUR', { reference });
    default:
      return signaler(c.code, {}, options);
  }
}

// ---------------------------------------------------------------------------
// Clés étrangères (P2003) : la ligne vise un élément qui n'existe pas
// ---------------------------------------------------------------------------
//
// Prisma 6 : PrismaClientKnownRequestError P2003, meta.field_name =
// « Inventaire_produitId_fkey (index) » (moteur natif) ou meta.constraint
// (adaptateurs). Le nom de contrainte suit la convention <Modèle>_<champ>_fkey.

type CodeCleEtrangere = 'ERR_PRODUIT_INCONNU' | 'ERR_TARIF_INCOHERENT' | 'ERR_DONNEE_INTROUVABLE';

/** Contraintes connues du schéma → code juste + champ à pointer à l'écran. */
const CLES_ETRANGERES: Record<string, { code: CodeCleEtrangere; champ: string; inventaire?: true }> = {
  // LOI 10 : un relevé d'inventaire ne vise QUE la liste d'inventaire.
  Inventaire_produitId_fkey: { code: 'ERR_PRODUIT_INCONNU', champ: 'produitId', inventaire: true },
  Releve_produitId_fkey: { code: 'ERR_PRODUIT_INCONNU', champ: 'produitId', inventaire: true },
  // Catalogue de commande.
  LigneCommande_produitCatalogueId_fkey: { code: 'ERR_PRODUIT_INCONNU', champ: 'produitCatalogueId' },
  PrixProduit_produitId_fkey: { code: 'ERR_PRODUIT_INCONNU', champ: 'produitId' },
  LigneCommande_prixProduitId_fkey: { code: 'ERR_TARIF_INCOHERENT', champ: 'prixProduitId' },
  // Commande supprimée depuis un autre poste.
  LigneCommande_commandeId_fkey: { code: 'ERR_DONNEE_INTROUVABLE', champ: 'commandeId' },
  EvenementCommande_commandeId_fkey: { code: 'ERR_DONNEE_INTROUVABLE', champ: 'commandeId' },
};

export type RefusCleEtrangere = { contrainte?: string; code: CodeCleEtrangere; champ?: string; inventaire?: true };

/**
 * Reconnaît une violation de clé étrangère (P2003, ou SQLSTATE 23503 du pilote).
 * Contrainte inconnue → ERR_DONNEE_INTROUVABLE (l'élément visé n'existe pas),
 * jamais un refus métier inventé.
 */
export function lireCleEtrangere(e: unknown): RefusCleEtrangere | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as { name?: unknown; code?: unknown; message?: unknown; meta?: unknown; constraint?: unknown };
  const code = typeof err.code === 'string' ? err.code : '';
  if (code !== 'P2003' && code !== '23503') return null;
  const meta = err.meta && typeof err.meta === 'object' ? (err.meta as Record<string, unknown>) : {};
  const textes = [meta.field_name, meta.constraint, err.constraint, err.message]
    .map((v) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : ''))
    .join(' ');
  const contrainte = Object.keys(CLES_ETRANGERES).find((c) => textes.includes(c));
  if (!contrainte) return { code: 'ERR_DONNEE_INTROUVABLE' };
  return { contrainte, ...CLES_ETRANGERES[contrainte] };
}

function echecPourCleEtrangere(r: RefusCleEtrangere, reference: string): Echec {
  const options = r.champ ? { champ: r.champ } : undefined;
  switch (r.code) {
    case 'ERR_PRODUIT_INCONNU':
      return signaler('ERR_PRODUIT_INCONNU', r.inventaire ? { liste: 'inventaire' } : {}, options);
    case 'ERR_TARIF_INCOHERENT':
      return signaler('ERR_TARIF_INCOHERENT', {}, options);
    default:
      return signaler('ERR_DONNEE_INTROUVABLE', { reference }, options);
  }
}

type Classement = {
  code: 'ERR_SERVEUR_INDISPONIBLE' | 'ERR_CONFIGURATION_SERVEUR' | 'ERR_DONNEE_INTROUVABLE' | 'ERR_DEJA_ENREGISTRE' | 'ERR_INATTENDUE';
  /** Pour l'administrateur, dans le journal uniquement. */
  piste: string;
};

type ErreurLike = { name?: unknown; code?: unknown; message?: unknown };

function classer(e: unknown): Classement {
  const err = (e && typeof e === 'object' ? e : {}) as ErreurLike;
  const name = typeof err.name === 'string' ? err.name : '';
  const code = typeof err.code === 'string' ? err.code : '';
  const message = typeof err.message === 'string' ? err.message : '';

  if (name === 'PrismaClientKnownRequestError' || /^P\d{4}$/.test(code)) {
    switch (code) {
      case 'P1001': // base injoignable
      case 'P1002': // délai dépassé
      case 'P1008': // opération trop longue
      case 'P1017': // connexion fermée
      case 'P2024': // file du pool saturée
        return {
          code: 'ERR_SERVEUR_INDISPONIBLE',
          piste: `Prisma ${code} : vérifier l'hôte/port de DATABASE_URL (pooler 6543), ?pgbouncer=true&connection_limit=1, état du projet Supabase.`,
        };
      case 'P1000': // identifiants refusés
      case 'P1003': // base inexistante
      case 'P2021': // table absente
      case 'P2022': // colonne absente
        return {
          code: 'ERR_CONFIGURATION_SERVEUR',
          piste: `Prisma ${code} : identifiants DATABASE_URL, ou schéma non appliqué (migrations / setup-supabase.sql).`,
        };
      case 'P2025':
        return { code: 'ERR_DONNEE_INTROUVABLE', piste: `Prisma ${code} : enregistrement visé introuvable.` };
      case 'P2002':
        return { code: 'ERR_DEJA_ENREGISTRE', piste: `Prisma ${code} : contrainte d'unicité.` };
      default:
        return { code: 'ERR_INATTENDUE', piste: `Prisma ${code || 'sans code'} : voir le détail.` };
    }
  }

  if (name === 'PrismaClientInitializationError') {
    if (/environment variable|DATABASE_URL|DIRECT_URL/i.test(message)) {
      return {
        code: 'ERR_CONFIGURATION_SERVEUR',
        piste: "Variables DATABASE_URL / DIRECT_URL / CODE_GESTION absentes chez l'hébergeur : les ajouter puis redéployer.",
      };
    }
    if (/Query Engine|binaryTarget|rhel/i.test(message)) {
      return {
        code: 'ERR_CONFIGURATION_SERVEUR',
        piste: 'Moteur Prisma absent : binaryTargets doit contenir "rhel-openssl-3.0.x", redéployer en vidant le cache.',
      };
    }
    if (/can't reach|cannot reach|timed out|ECONNREFUSED|ENOTFOUND/i.test(message)) {
      return { code: 'ERR_SERVEUR_INDISPONIBLE', piste: 'Initialisation Prisma : base injoignable.' };
    }
    return { code: 'ERR_CONFIGURATION_SERVEUR', piste: 'Initialisation Prisma en échec : vérifier DATABASE_URL et DIRECT_URL.' };
  }

  if (name === 'PrismaClientRustPanicError') {
    return { code: 'ERR_SERVEUR_INDISPONIBLE', piste: 'Moteur Prisma tombé : redémarrage du processus nécessaire.' };
  }

  return { code: 'ERR_INATTENDUE', piste: 'Erreur non classée : voir le détail.' };
}

/**
 * Signature compatible avec les routes existantes :
 *   return NextResponse.json(diagnostiquer(error), { status: 500 });
 * Le second paramètre (facultatif) nomme la route dans le journal.
 *
 * Journalise l'erreur (filtrée) côté serveur, puis renvoie un échec typé
 * sans aucun détail technique. Remplace donc aussi le `console.error(error)`
 * qui précède chaque appel (à retirer : il écrit l'erreur Prisma brute, M3).
 */
export function diagnostiquer(e: unknown, route?: string): Diagnostic {
  const reference = nouvelleReference();

  // 1. Refus métier levé par la base : message du catalogue, jamais le texte SQL.
  const refus = lireRefusBase(e);
  if (refus) {
    journaliser({
      niveau: 'erreur',
      code: refus.code,
      route,
      reference,
      piste: `Refus de la base (SQLSTATE ${refus.sqlstate ?? 'inconnu'}) sur le champ ${refus.champ ?? 'non précisé'}.`,
      detail: { champ: refus.champ, precision: refus.detail, erreur: e },
    });
    return { ...corpsClient(echecPourRefusBase(refus, reference)), reference };
  }

  // 1 bis. Contrainte CHECK violée (SQLSTATE 23514) : saisie refusée, le nom
  // de la contrainte ne va qu'au journal.
  const check = lireViolationCheck(e);
  if (check) {
    journaliser({
      niveau: 'erreur',
      code: check.code,
      route,
      reference,
      piste: `Contrainte CHECK ${check.contrainte ?? 'non nommée'} violée${check.connue ? '' : ' (non répertoriée dans erreurBase.ts)'}.`,
      // Le DETAIL PostgreSQL (« Failing row contains (…) ») recopie la ligne entière,
      // donc nom et téléphone du client : jamais journalisé. Une erreur `Error` est
      // résumée par le journal (message Prisma jamais recopié) ; un objet brut de
      // pilote n'est pas transmis.
      detail: { contrainte: check.contrainte, champ: check.champ, erreur: e instanceof Error ? e : undefined },
    });
    return { ...corpsClient(echecPourCheck(check, reference)), reference };
  }

  // 2. Élément visé inexistant (clé étrangère) : produit hors liste, commande supprimée…
  const cle = lireCleEtrangere(e);
  if (cle) {
    journaliser({
      niveau: 'erreur',
      code: cle.code,
      route,
      reference,
      piste: `Clé étrangère ${cle.contrainte ?? 'non reconnue'} : l'élément visé n'existe pas.`,
      detail: { champ: cle.champ, erreur: e },
    });
    return { ...corpsClient(echecPourCleEtrangere(cle, reference)), reference };
  }

  // 3. Panne, configuration, bug.
  const { code, piste } = classer(e);
  journaliser({ niveau: 'erreur', code, route, reference, piste, detail: e });
  return { ...corpsClient(signaler(code, { reference })), reference };
}

/** Statut HTTP conseillé pour un échec (les routes ne le choisissent plus elles-mêmes). */
export function statutHttp(echec: Pick<Echec, 'code'>): number {
  switch (echec.code) {
    case 'ERR_SERVEUR_INDISPONIBLE':
    case 'ERR_CATALOGUE_ABSENT':
      return 503;
    case 'ERR_CONFIGURATION_SERVEUR':
    case 'ERR_INATTENDUE':
      return 500;
    case 'ERR_SESSION_EXPIREE':
      return 401;
    case 'ERR_DROIT_INSUFFISANT':
    case 'ERR_CODE_INCORRECT':
    case 'ERR_ORIGINE_REFUSEE':
      return 403;
    case 'ERR_TROP_DE_TENTATIVES':
      return 429;
    case 'ERR_DONNEE_INTROUVABLE':
      return 404;
    case 'ERR_DEJA_ENREGISTRE':
      return 409;
    default:
      // Refus métier (jour fermé, minimum, plancher, produit inconnu…) : la requête est comprise,
      // la règle la refuse. Le corps porte le code typé et la sortie proposée.
      return 422;
  }
}

/**
 * Gestionnaire unique pour le `catch` des routes :
 *   catch (error) {
 *     const { corps, statut } = traiterErreur(error, 'POST /api/commandes');
 *     return NextResponse.json(corps, { status: statut });
 *   }
 */
export function traiterErreur(e: unknown, route?: string): { corps: Diagnostic; statut: number } {
  const corps = diagnostiquer(e, route);
  return { corps, statut: statutHttp(corps) };
}

/**
 * Réponse pour un refus métier venu du domaine (ERR_*), journalisé lui aussi
 * (« tout ok:false bloquant est journalisé »), sans donnée client.
 */
export function reponseEchec(echec: Echec, route?: string): { corps: CorpsEchec; statut: number } {
  journaliser({ niveau: 'erreur', code: echec.code, route, detail: { champ: echec.champ } });
  const corps = corpsClient(echec);
  return { corps, statut: statutHttp(corps) };
}
