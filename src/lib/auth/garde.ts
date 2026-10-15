// src/lib/auth/garde.ts
//
// LE contrôle d'accès des routes API. Une route ne vérifie jamais un code ni un
// rôle elle-même : elle appelle `exigerRole` en première ligne.
//
//   const garde = exigerRole(requete, 'gerant', 'modifier un tarif');
//   if (!garde.ok) return garde.reponse;
//   const { acces } = garde;   // { appareil, role }
//
// Le proxy (src/proxy.ts) filtre déjà les appareils non installés ; ce garde est
// la seconde barrière, au plus près des données, et lui seul connaît le rôle
// exigé par chaque route (src/lib/auth/matrice.ts). Propriétaire : `securite`.

import type { Echec } from '../../domaine/resultat.ts';
import { signaler } from '../../domaine/messages.ts';
import { corpsClient } from '../erreurBase.ts';
import { NOM_COOKIE_GERANT, NOM_COOKIE_TABLETTE, lireConfiguration } from './config.ts';
import { LIBELLE_ROLE, type Role } from './roles.ts';
import { verifierJeton, type Jeton } from './session.ts';

export type Acces = { appareil: string; role: Role };

export type Garde =
  | { ok: true; acces: Acces; tablette: Jeton }
  | { ok: false; statut: 401 | 403 | 503; echec: Echec; reponse: Response };

/** Lit un cookie dans l'en-tête brut, sans dépendre de Next. */
export function lireCookie(requete: Request, nom: string): string | null {
  const entete = requete.headers.get('cookie');
  if (!entete) return null;
  for (const morceau of entete.split(';')) {
    const i = morceau.indexOf('=');
    if (i === -1) continue;
    if (morceau.slice(0, i).trim() !== nom) continue;
    try {
      return decodeURIComponent(morceau.slice(i + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Réponse d'échec au format du contrat (LOI 9), construite par `corpsClient`
 * (gestion-erreurs) : `error`/`erreur` reprennent le message pour les écrans
 * existants.
 */
export function reponseEchec(echec: Echec, statut: number, enPlus: Record<string, unknown> = {}): Response {
  return Response.json(
    { ...corpsClient(echec), ...enPlus },
    { status: statut, headers: { 'Cache-Control': 'no-store' } }
  );
}

function refus(statut: 401 | 403 | 503, echec: Echec): Garde {
  return { ok: false, statut, echec, reponse: reponseEchec(echec, statut) };
}

/** Jeton gérant valide ET obtenu sur cette même tablette. */
export function gerantActif(requete: Request, tablette: Jeton, maintenant = Date.now()): boolean {
  const conf = lireConfiguration('gerant');
  if (!conf.ok) return false;
  const jeton = verifierJeton(lireCookie(requete, NOM_COOKIE_GERANT), conf.cle, 'gerant', maintenant);
  return jeton !== null && jeton.appareil === tablette.appareil;
}

/**
 * Exige une tablette installée et, pour `gerant`, un accès gérant ouvert.
 * - réglage serveur absent ou trop court → 503 ERR_CONFIGURATION_SERVEUR
 * - tablette non installée / cookie expiré  → 401 ERR_SESSION_EXPIREE
 * - code gérant pas saisi (ou expiré)       → 403 ERR_DROIT_INSUFFISANT
 */
export function exigerRole(
  requete: Request,
  role: Role,
  action = 'faire cette opération',
  maintenant = Date.now()
): Garde {
  const conf = lireConfiguration('tablette');
  if (!conf.ok) return refus(503, signaler('ERR_CONFIGURATION_SERVEUR', { reference: conf.reference }));

  const tablette = verifierJeton(lireCookie(requete, NOM_COOKIE_TABLETTE), conf.cle, 'tablette', maintenant);
  if (!tablette) return refus(401, signaler('ERR_SESSION_EXPIREE', {}));

  if (role === 'gerant') {
    const confGerant = lireConfiguration('gerant');
    if (!confGerant.ok) {
      return refus(503, signaler('ERR_CONFIGURATION_SERVEUR', { reference: confGerant.reference }));
    }
    if (!gerantActif(requete, tablette, maintenant)) {
      return refus(403, signaler('ERR_DROIT_INSUFFISANT', { action, role: LIBELLE_ROLE.gerant }));
    }
    return { ok: true, acces: { appareil: tablette.appareil, role: 'gerant' }, tablette };
  }

  return { ok: true, acces: { appareil: tablette.appareil, role: 'tablette' }, tablette };
}
