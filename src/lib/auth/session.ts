// src/lib/auth/session.ts
//
// Jetons signés (HMAC-SHA256), portés par des cookies httpOnly.
// Propriétaire : agent `securite`. Fonctions pures : la clé et l'heure sont
// passées en paramètre, rien n'est lu dans l'environnement ici.
//
// Deux jetons, deux cookies :
//   - `tablette` : posé UNE fois, à l'installation de la tablette (code de
//     tablette). Longue durée, prolongé à l'usage : une tablette qui sert tous
//     les jours ne redemande jamais rien.
//   - `gerant`   : posé quand le gérant tape son code. Courte durée, prolongé
//     tant qu'il travaille, lié à la tablette qui l'a obtenu.
//
// Format : base64url(JSON du jeton) + "." + base64url(HMAC du premier bloc)
//
// Clé de signature = HMAC(SESSION_SECRET, type + code). Conséquence voulue :
// changer SESSION_SECRET, ou changer CODE_TABLETTE, invalide immédiatement
// toutes les tablettes ; changer CODE_GESTION ferme tous les accès gérant.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type TypeJeton = 'tablette' | 'gerant';

/** Longueur minimale de SESSION_SECRET : en dessous, on refuse de signer. */
export const LONGUEUR_MIN_SECRET = 32;
/**
 * Longueur minimale de CODE_TABLETTE et CODE_GESTION. L'ancien code gérant à
 * 4 chiffres est public (historique git) : il est désormais refusé.
 */
export const LONGUEUR_MIN_CODE = 8;
/**
 * Code GESTION (gérant) : 6 caractères suffisent (propriétaire, 22/10/2026 —
 * « on n'est pas Microsoft »). Il ne s'essaie que depuis une tablette déjà
 * installée (code tablette ≥ 8) et les essais sont limités (5 par 15 min et
 * par source, 50 au total) : 6 chiffres = 1 million de possibilités.
 */
export const LONGUEUR_MIN_CODE_GESTION = 6;

const JOUR_MS = 24 * 60 * 60 * 1000;

export const DUREES: Record<
  TypeJeton,
  { inactiviteMs: number; maxMs: number; rafraichissementMs: number }
> = {
  // 180 jours sans servir → la tablette redemande son code. Aucune durée
  // maximale : une tablette utilisée ne se déconnecte jamais d'elle-même.
  tablette: {
    inactiviteMs: 180 * JOUR_MS,
    maxMs: Number.POSITIVE_INFINITY,
    rafraichissementMs: JOUR_MS,
  },
  // HYPOTHÈSE À VALIDER : 30 min sans action gérant referment l'accès gérant,
  // et 8 h au plus même en travaillant (une tablette laissée en mode gérant
  // ne le reste pas jusqu'au lendemain).
  gerant: {
    inactiviteMs: 30 * 60 * 1000,
    maxMs: 8 * 60 * 60 * 1000,
    rafraichissementMs: 60 * 1000,
  },
};

/** Tolérance d'horloge entre instances serveur. */
const DERIVE_HORLOGE_MS = 60 * 1000;

export type Jeton = {
  v: 2;
  t: TypeJeton;
  /** Identifiant aléatoire de la tablette, tiré à l'installation. */
  appareil: string;
  /** Ouverture (ms epoch) : borne la durée maximale. */
  ouverteA: number;
  /** Dernière activité (ms epoch) : borne l'inactivité. */
  activeA: number;
};

/**
 * Clé de signature d'un type de jeton. `null` si le secret ou le code est
 * absent ou trop court : rien n'est alors signé ni accepté (on échoue fermé).
 */
export function cleDeSignature(
  type: TypeJeton,
  secret: string | null | undefined,
  code: string | null | undefined
): Buffer | null {
  if (typeof secret !== 'string' || secret.length < LONGUEUR_MIN_SECRET) return null;
  const minimum = type === 'gerant' ? LONGUEUR_MIN_CODE_GESTION : LONGUEUR_MIN_CODE;
  if (typeof code !== 'string' || code.length < minimum) return null;
  return createHmac('sha256', secret).update(`pp-${type}-v2\u0000${code}`, 'utf8').digest();
}

export function nouvelAppareil(): string {
  return randomBytes(12).toString('base64url');
}

export function creerJeton(t: TypeJeton, appareil: string, maintenant: number): Jeton {
  return { v: 2, t, appareil, ouverteA: maintenant, activeA: maintenant };
}

function signature(bloc: string, cle: Buffer): Buffer {
  return createHmac('sha256', cle).update(bloc).digest();
}

export function signerJeton(jeton: Jeton, cle: Buffer | null): string {
  if (!cle || cle.length < 32) throw new Error('Clé de signature absente.');
  const bloc = Buffer.from(JSON.stringify(jeton), 'utf8').toString('base64url');
  return `${bloc}.${signature(bloc, cle).toString('base64url')}`;
}

/**
 * Le jeton s'il est intact, du type attendu, bien formé et non expiré ;
 * `null` dans tous les autres cas (on ne dit jamais pourquoi au client).
 */
export function verifierJeton(
  brut: string | null | undefined,
  cle: Buffer | null,
  type: TypeJeton,
  maintenant: number
): Jeton | null {
  if (!cle || cle.length < 32) return null;
  if (typeof brut !== 'string' || brut.length > 2048) return null;

  const parties = brut.split('.');
  if (parties.length !== 2) return null;
  const [bloc, signatureRecue] = parties;
  if (!bloc || !signatureRecue) return null;

  const attendue = signature(bloc, cle);
  const recue = Buffer.from(signatureRecue, 'base64url');
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;

  let valeur: unknown;
  try {
    valeur = JSON.parse(Buffer.from(bloc, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!valeur || typeof valeur !== 'object') return null;
  const j = valeur as Record<string, unknown>;

  if (j.v !== 2 || j.t !== type) return null;
  if (typeof j.appareil !== 'string' || !/^[\w-]{8,64}$/.test(j.appareil)) return null;
  if (typeof j.ouverteA !== 'number' || typeof j.activeA !== 'number') return null;
  if (!Number.isFinite(j.ouverteA) || !Number.isFinite(j.activeA)) return null;

  // Une date dans le futur trahit un jeton fabriqué ou une horloge folle.
  if (j.ouverteA > maintenant + DERIVE_HORLOGE_MS) return null;
  if (j.activeA > maintenant + DERIVE_HORLOGE_MS) return null;
  if (j.activeA < j.ouverteA) return null;

  const d = DUREES[type];
  if (maintenant - j.ouverteA >= d.maxMs) return null;
  if (maintenant - j.activeA >= d.inactiviteMs) return null;

  return { v: 2, t: type, appareil: j.appareil, ouverteA: j.ouverteA, activeA: j.activeA };
}

/** Vrai quand il est temps de prolonger (on ne réécrit pas le cookie à chaque requête). */
export function doitRafraichir(jeton: Jeton, maintenant: number): boolean {
  return maintenant - jeton.activeA >= DUREES[jeton.t].rafraichissementMs;
}

/** Le même jeton, prolongé. La durée maximale, elle, ne bouge pas. */
export function prolonger(jeton: Jeton, maintenant: number): Jeton {
  return { ...jeton, activeA: maintenant };
}

/** Durée de vie du cookie (secondes) : ce qui reste avant la borne la plus proche. */
export function dureeCookieSecondes(jeton: Jeton, maintenant: number): number {
  const d = DUREES[jeton.t];
  const restant = Math.min(jeton.activeA + d.inactiviteMs - maintenant, jeton.ouverteA + d.maxMs - maintenant);
  return Math.max(0, Math.floor(restant / 1000));
}
