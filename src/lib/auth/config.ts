// src/lib/auth/config.ts
//
// Lecture de l'environnement et réglages des cookies. Propriétaire : `securite`.
// Les secrets ne quittent ce module que pour signer, vérifier ou comparer ;
// ils ne sont jamais journalisés ni renvoyés.
//
//   SESSION_SECRET  ≥ 32 caractères — clé de signature des cookies
//   CODE_TABLETTE   ≥ 8 caractères  — tapé une fois à l'installation d'une tablette
//   CODE_GESTION    ≥ 8 caractères  — demandé pour changer prix, produits, gâteaux
//
// Un réglage absent ou trop court ne fait jamais « ouvrir par défaut » : l'accès
// concerné est refusé avec ERR_CONFIGURATION_SERVEUR et une référence courte.

import { cleDeSignature, LONGUEUR_MIN_CODE, LONGUEUR_MIN_SECRET, type TypeJeton } from './session.ts';

export const NOM_COOKIE_TABLETTE = 'pp_tablette';
export const NOM_COOKIE_GERANT = 'pp_gerant';

/** Références citées à l'écran (« prévenez le gérant en citant … »). */
export const REFERENCES_CONFIGURATION = {
  secret: 'CONF-SESSION',
  tablette: 'CONF-TABLETTE',
  gerant: 'CONF-GESTION',
} as const;

export type Configuration =
  | { ok: true; cle: Buffer; code: string }
  | { ok: false; reference: string };

const VARIABLE_CODE: Record<TypeJeton, string> = {
  tablette: 'CODE_TABLETTE',
  gerant: 'CODE_GESTION',
};

/** Clé de signature et code attendu pour un type d'accès, ou la référence du réglage fautif. */
export function lireConfiguration(type: TypeJeton): Configuration {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== 'string' || secret.length < LONGUEUR_MIN_SECRET) {
    return { ok: false, reference: REFERENCES_CONFIGURATION.secret };
  }
  const code = process.env[VARIABLE_CODE[type]];
  if (typeof code !== 'string' || code.length < LONGUEUR_MIN_CODE) {
    return { ok: false, reference: REFERENCES_CONFIGURATION[type] };
  }
  const cle = cleDeSignature(type, secret, code);
  if (!cle) return { ok: false, reference: REFERENCES_CONFIGURATION[type] };
  return { ok: true, cle, code };
}

export type OptionsCookie = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
};

/**
 * httpOnly : le JavaScript de la page ne lit jamais le jeton.
 * SameSite=Lax : un autre site ne peut pas déclencher d'écriture avec ce cookie.
 * Secure : en production (HTTPS). En développement local (http://), un cookie
 * Secure ne serait pas renvoyé par une tablette du réseau local.
 */
export function optionsCookie(maxAgeSecondes: number): OptionsCookie {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSecondes,
  };
}

/** Adresse du client, pour la limite de tentatives (jamais journalisée). */
export function adresseClient(entetes: Headers): string {
  return (
    entetes.get('x-nf-client-connection-ip') ??
    entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'inconnue'
  ).slice(0, 64);
}
