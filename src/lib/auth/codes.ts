// src/lib/auth/codes.ts
//
// Vérification d'un code partagé (code de tablette, code gérant) : comparaison
// à durée constante + limite de tentatives. Propriétaire : agent `securite`.
// Le code saisi n'est jamais journalisé, jamais renvoyé.

import { createHash, timingSafeEqual } from 'node:crypto';
import { bloquant, succes, type Resultat } from '../../domaine/resultat.ts';
import { FENETRE_MS, LimiteurTentatives, MAX_ECHECS_GLOBAL, MAX_ECHECS_PAR_SOURCE } from './limiteur.ts';

/** Au-delà, on ne compare même pas (évite de hacher des mégaoctets). */
const LONGUEUR_MAX_SAISIE = 256;

function empreinte(valeur: string): Buffer {
  return createHash('sha256').update(valeur, 'utf8').digest();
}

/**
 * Comparaison à durée constante, sur des empreintes de même longueur : le temps
 * de réponse ne révèle ni le code ni sa longueur.
 */
export function memeCode(saisi: unknown, attendu: string): boolean {
  if (typeof saisi !== 'string' || saisi.length === 0 || saisi.length > LONGUEUR_MAX_SAISIE) return false;
  return timingSafeEqual(empreinte(saisi), empreinte(attendu));
}

export type Limiteurs = { parSource: LimiteurTentatives; global: LimiteurTentatives };

export function nouveauxLimiteurs(): Limiteurs {
  return {
    parSource: new LimiteurTentatives(MAX_ECHECS_PAR_SOURCE, FENETRE_MS),
    global: new LimiteurTentatives(MAX_ECHECS_GLOBAL, FENETRE_MS),
  };
}

/** Limiteurs partagés par l'instance serveur : un jeu par code. */
export const LIMITEURS_TABLETTE = nouveauxLimiteurs();
export const LIMITEURS_GERANT = nouveauxLimiteurs();

// Ces messages devraient vivre dans src/domaine/messages.ts (gestion-erreurs) :
// les codes ERR_CODE_INCORRECT et ERR_TROP_DE_TENTATIVES y manquent. Ils sont ici
// en attendant, au format du catalogue (vouvoiement, dit quoi faire).
const MESSAGE_CODE_INCORRECT = 'Code incorrect. Vérifiez-le et recommencez ; en cas d’oubli, demandez au gérant.';

function messageAttente(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Trop d’essais. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}, ou demandez au gérant.`;
}

/**
 * Vérifie `saisie` contre `attendu`.
 * `sources` : clés de limitation propres à l'appelant (adresse, tablette…).
 * Bloqué si UNE des sources, ou le compteur global, a épuisé ses essais —
 * même avec le bon code, jusqu'à la fin de la fenêtre.
 */
export function verifierCode(
  saisie: unknown,
  attendu: string,
  sources: string[],
  limiteurs: Limiteurs,
  maintenant: number
): Resultat<null> {
  const cles = sources.map((s) => `s:${s}`);
  const attente = Math.max(
    limiteurs.global.attenteRestante('global', maintenant),
    ...cles.map((c) => limiteurs.parSource.attenteRestante(c, maintenant))
  );
  if (attente > 0) {
    return bloquant('ERR_TROP_DE_TENTATIVES', messageAttente(attente), { champ: 'code' });
  }

  if (!memeCode(saisie, attendu)) {
    limiteurs.global.noterEchec('global', maintenant);
    for (const c of cles) limiteurs.parSource.noterEchec(c, maintenant);
    return bloquant('ERR_CODE_INCORRECT', MESSAGE_CODE_INCORRECT, { champ: 'code' });
  }

  for (const c of cles) limiteurs.parSource.oublier(c);
  return succes(null);
}
