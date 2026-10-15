// src/lib/auth/codes.ts
//
// Vérification d'un code partagé (code de tablette, code gérant) : comparaison
// à durée constante + limite de tentatives. Propriétaire : agent `securite`.
// Le code saisi n'est jamais journalisé, jamais renvoyé.

import { createHash, timingSafeEqual } from 'node:crypto';
import { succes, type Resultat } from '../../domaine/resultat.ts';
import { signaler } from '../../domaine/messages.ts';
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

// Messages : catalogue unique de `gestion-erreurs` (src/domaine/messages.ts).

/** Attente restante en minutes entières (au moins 1), pour le message. */
function minutesAttente(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
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
    return signaler('ERR_TROP_DE_TENTATIVES', { minutes: minutesAttente(attente) }, { champ: 'code' });
  }

  if (!memeCode(saisie, attendu)) {
    limiteurs.global.noterEchec('global', maintenant);
    for (const c of cles) limiteurs.parSource.noterEchec(c, maintenant);
    return signaler('ERR_CODE_INCORRECT', {}, { champ: 'code' });
  }

  for (const c of cles) limiteurs.parSource.oublier(c);
  return succes(null);
}
