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
//   - SQLSTATE 23505 → le moteur le convertit en P2002 (unicité) et PERD le
//     MESSAGE : un P2002 sur le modèle Produit qui ne vise pas `cleCatalogue`
//     est donc le doublon de nom levé par le déclencheur.
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
};

export type CodeBase =
  | 'ERR_JOUR_FERME' | 'ERR_PERIODE_CONGES' | 'ERR_UNITE_INCOHERENTE' | 'ERR_UNITE_FIGEE'
  | 'ERR_REGIME_FIGE' | 'ERR_TARIF_IMMUABLE' | 'ERR_TARIF_PASSE' | 'ERR_TARIF_CHEVAUCHEMENT'
  | 'ERR_TARIF_INCOHERENT' | 'ERR_SOUS_PLANCHER' | 'ERR_PRODUIT_EN_DOUBLE';

/** Liste exposée pour les tests (un cas par code levé par la base). */
export const CODES_LEVES_PAR_LA_BASE = Object.keys(CODES_BASE) as CodeBase[];

export type RefusBase = { code: CodeBase; sqlstate?: string; detail?: string; champ?: string };

function estCodeBase(c: string): c is CodeBase {
  return Object.prototype.hasOwnProperty.call(CODES_BASE, c);
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
    // Doublon de nom : 23505 converti en P2002 par le moteur, MESSAGE perdu.
    if (code === 'P2002' && meta.modelName === 'Produit') {
      const cible = meta.target;
      const cibles = Array.isArray(cible) ? cible.map(String) : typeof cible === 'string' ? [cible] : [];
      if (!cibles.some((c) => c.includes('cleCatalogue'))) {
        return { code: 'ERR_PRODUIT_EN_DOUBLE', sqlstate: '23505', champ: CODES_BASE.ERR_PRODUIT_EN_DOUBLE };
      }
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
  const champ = (hint && RE_CHAMP.exec(hint)?.[1]) || CODES_BASE[trouve];

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
 * Échec du catalogue pour un refus de la base. Le DETAIL n'est repris que
 * comme libellé de fermeture (« mardi ») ; partout ailleurs il est technique
 * et ne part qu'au journal.
 */
export function echecPourRefusBase(r: RefusBase): Echec {
  const options = r.champ ? { champ: r.champ } : undefined;
  switch (r.code) {
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
    return { ...corpsClient(echecPourRefusBase(refus)), reference };
  }

  // 2. Panne, configuration, bug.
  const { code, piste } = classer(e);
  journaliser({ niveau: 'erreur', code, route, reference, piste, detail: e });
  return { ...corpsClient(signaler(code, { reference })), reference };
}

/** Statut HTTP conseillé pour un échec (les routes ne le choisissent plus elles-mêmes). */
export function statutHttp(echec: Pick<Echec, 'code'>): number {
  switch (echec.code) {
    case 'ERR_SERVEUR_INDISPONIBLE':
      return 503;
    case 'ERR_CONFIGURATION_SERVEUR':
    case 'ERR_INATTENDUE':
      return 500;
    case 'ERR_SESSION_EXPIREE':
      return 401;
    case 'ERR_DROIT_INSUFFISANT':
      return 403;
    case 'ERR_DONNEE_INTROUVABLE':
    case 'ERR_PRODUIT_INCONNU':
      return 404;
    case 'ERR_DEJA_ENREGISTRE':
      return 409;
    default:
      // Refus métier (jour fermé, minimum, plancher…) : la requête est comprise,
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
