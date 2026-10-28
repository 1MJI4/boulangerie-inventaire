// src/lib/serveur/envoiUnique.ts
//
// Côté SERVEUR de la file hors ligne de la tablette (propriétaire :
// `base-donnees`). La tablette (src/lib/envoiHorsLigne.ts, `data-offline`)
// garde une commande quand le réseau tombe et la renvoie plus tard, avec :
//   - un identifiant `idClient` (UUID) stable, dans le corps ET dans l'en-tête
//     `Idempotency-Key` ;
//   - l'heure de prise RÉELLE `priseLe` (horloge de la tablette).
//
// Deux garanties :
//   1. une commande (ou une modification) envoyée deux fois n'est enregistrée
//      qu'UNE fois — réponse perdue, renvoi automatique, deux envois en même
//      temps. La base tranche (index UNIQUE "Commande_idClient_key" /
//      "EvenementCommande_idClient_key") ; ici on retrouve ce qui existe déjà.
//   2. une commande gardée lundi et arrivée mercredi est contrôlée et TARIFÉE
//      à lundi (LOI 1 : prix en vigueur à la date de prise), si l'heure de la
//      tablette est plausible.
//
// Fonctions pures ou à dépendances injectées : aucun accès direct à Prisma,
// testées sans base (envoiUnique.test.ts). Aucune règle métier nouvelle.

import { bloquant, type Echec } from '../../domaine/resultat.ts';
import { signaler } from '../../domaine/messages.ts';

/* ------------------------------------------------------------ Identifiant */

/** UUID (versions 1 à 8, variante RFC 4122), comme `crypto.randomUUID()` et `nouvelIdSaisie`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type IdClientLu = { ok: true; idClient: string | null };

function normaliser(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase();
  if (t === '') return null;
  return UUID.test(t) ? t : undefined;
}

/**
 * Identifiant d'envoi lu dans le corps (`idClient`) et/ou l'en-tête
 * `Idempotency-Key`. Absent des deux → `null` (envoi sans protection, comme
 * avant). Mal formé, ou différent entre corps et en-tête → refus : mieux vaut
 * refuser qu'enregistrer sans savoir si c'est un doublon (règle de doute).
 * Normalisé en minuscules (CHECK "…_idClient_format" en base).
 */
export function lireIdClient(corps: unknown, entete: string | null | undefined): IdClientLu | Echec {
  const duCorps = normaliser(corps);
  const deLEntete = normaliser(entete);
  if (duCorps === undefined || deLEntete === undefined || (duCorps && deLEntete && duCorps !== deLEntete)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'identifiant d’envoi de la tablette' }, { champ: 'idClient' });
  }
  return { ok: true, idClient: duCorps ?? deLEntete ?? null };
}

/* ---------------------------------------------------------- Heure de prise */

/** Avance tolérée de l'horloge de la tablette sur celle du serveur. */
export const TOLERANCE_HORLOGE_MS = 5 * 60_000;

/**
 * Âge maximal d'une commande gardée sur la tablette.
 * HYPOTHÈSE À VALIDER (docs/QUESTIONS-GERANT.md, question 90) : 7 jours. Au-delà,
 * la commande est refusée (« à reprendre » sur la tablette) : le client doit
 * être rappelé, le tarif a pu changer.
 */
export const JOURS_MAX_PRISE_HORS_LIGNE = 7;

/** Instant ISO 8601 COMPLET avec fuseau (Z ou ±HH:MM) : jamais une heure locale ambiguë. */
const ISO_AVEC_FUSEAU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

export type PriseLue = {
  ok: true;
  /** Instant retenu comme date de prise (tarif, R56, règles du jour de la saisie). */
  instant: Date;
  /**
   * tablette : heure de la tablette retenue ;
   * serveur  : absente ou illisible → heure du serveur ;
   * futur    : tablette en avance de plus de la tolérance → heure du serveur (à journaliser) ;
   * avance   : tablette en avance dans la tolérance → ramenée à l'heure du serveur.
   */
  source: 'tablette' | 'serveur' | 'futur' | 'avance';
};

/**
 * Heure de prise venue de la tablette, acceptée seulement si elle est plausible :
 *  - absente, mal formée → heure du serveur (comportement d'avant) ;
 *  - dans le futur au-delà de `TOLERANCE_HORLOGE_MS` → heure du serveur
 *    (horloge de la tablette fausse : on ne tarife jamais à une date à venir) ;
 *  - dans le futur en deçà → ramenée à l'heure du serveur ;
 *  - plus vieille que `joursMax` jours → REFUS, message humain ; la tablette
 *    garde la commande « à reprendre » ;
 *  - sinon → heure de la tablette.
 * Limite : une tablette en RETARD (horloge remise à zéro, moins de 7 jours) ne
 * se distingue pas d'une vraie coupure réseau.
 */
export function lirePriseTablette(
  brut: unknown,
  maintenant: Date,
  joursMax: number = JOURS_MAX_PRISE_HORS_LIGNE,
): PriseLue | Echec {
  if (typeof brut !== 'string' || !ISO_AVEC_FUSEAU.test(brut.trim())) {
    return { ok: true, instant: maintenant, source: 'serveur' };
  }
  const t = Date.parse(brut.trim());
  if (!Number.isFinite(t)) return { ok: true, instant: maintenant, source: 'serveur' };
  const ecart = t - maintenant.getTime();
  if (ecart > TOLERANCE_HORLOGE_MS) return { ok: true, instant: maintenant, source: 'futur' };
  if (ecart > 0) return { ok: true, instant: maintenant, source: 'avance' };
  if (-ecart > joursMax * 24 * 60 * 60_000) {
    // HYPOTHÈSE À VALIDER : texte à reprendre dans le catalogue src/domaine/messages.ts
    // sous un code dédié (propriétaire `gestion-erreurs`) ; d'ici là, code générique
    // ERR_SAISIE_INVALIDE avec un message qui dit QUOI FAIRE (LOI 9).
    return bloquant(
      'ERR_SAISIE_INVALIDE',
      `Cette commande a été prise il y a plus de ${joursMax}${' '}jours et n’est pas arrivée au magasin à temps. ` +
        `Rappelez le client pour la confirmer, puis prenez-la de nouveau, s’il vous plaît.`,
      { champ: 'priseLe' },
    );
  }
  return { ok: true, instant: new Date(t), source: 'tablette' };
}

/* ------------------------------------------------------------ Dédoublonnage */

/** L'erreur est-elle une violation d'unicité (Prisma P2002, ou SQLSTATE 23505 brut) ? */
export function estConflitUnicite(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const x = e as { code?: unknown; meta?: { code?: unknown } };
  return x.code === 'P2002' || x.code === '23505' || x.meta?.code === '23505';
}

/**
 * Décision « déjà reçue ? » : avec un identifiant ET un enregistrement déjà
 * trouvé sous cet identifiant → on renvoie l'existant, rien n'est refait.
 */
export function decisionEnvoi<T>(idClient: string | null, trouve: T | null): { type: 'nouveau' } | { type: 'deja'; existant: T } {
  return idClient !== null && trouve !== null ? { type: 'deja', existant: trouve } : { type: 'nouveau' };
}

/**
 * Exécute `ecrire` une seule fois par identifiant.
 *  1. identifiant déjà connu → l'existant, `ecrire` n'est PAS appelé ;
 *  2. sinon `ecrire` (transaction : numéro, lignes, événement…) ;
 *  3. course : un envoi jumeau a gagné entre-temps → la contrainte UNIQUE fait
 *     échouer `ecrire` (transaction annulée entière) → on relit l'existant.
 *     Une autre violation d'unicité (numéro…) SANS existant sous cet
 *     identifiant est relancée telle quelle.
 * Sans identifiant : `ecrire` tout court (comportement d'avant).
 */
export async function ecrireUneFois<T>(
  idClient: string | null,
  trouver: (idClient: string) => Promise<T | null>,
  ecrire: () => Promise<T>,
): Promise<{ resultat: T; rejoue: boolean }> {
  if (idClient === null) return { resultat: await ecrire(), rejoue: false };
  const avant = decisionEnvoi(idClient, await trouver(idClient));
  if (avant.type === 'deja') return { resultat: avant.existant, rejoue: true };
  try {
    return { resultat: await ecrire(), rejoue: false };
  } catch (e) {
    if (!estConflitUnicite(e)) throw e;
    const apres = decisionEnvoi(idClient, await trouver(idClient));
    if (apres.type === 'deja') return { resultat: apres.existant, rejoue: true };
    throw e;
  }
}
