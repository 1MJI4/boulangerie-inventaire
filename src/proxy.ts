// src/proxy.ts
//
// Première barrière : toute page et toute route API exigent une TABLETTE
// INSTALLÉE (cookie signé posé une fois avec le code de tablette), sauf les
// exceptions déclarées dans src/lib/auth/chemins.ts (connexion, fichiers
// statiques, /api/cloudprnt/*). Next 16 appelle ce fichier « proxy »
// (anciennement « middleware ») ; il tourne sur Node.js.
//
// Le proxy ne connaît pas les rôles : c'est `exigerRole`, dans chaque route,
// qui décide qui peut faire quoi. Ici : « tablette installée ou non », refus
// des écritures venues d'un autre site, et prolongation à l'usage des cookies
// tablette (180 jours) et gérant (30 minutes).
// Propriétaire : agent `securite`.

import { NextResponse, type NextRequest } from 'next/server';
import { signaler } from '@/domaine/messages';
import type { Echec } from '@/domaine/resultat';
import { corpsClient } from '@/lib/erreurBase';
import { CHEMIN_CONNEXION, estCheminApi, estCheminPublic } from '@/lib/auth/chemins';
import { NOM_COOKIE_GERANT, NOM_COOKIE_TABLETTE, lireConfiguration, optionsCookie } from '@/lib/auth/config';
import { doitRafraichir, dureeCookieSecondes, prolonger, signerJeton, verifierJeton } from '@/lib/auth/session';

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

function refusApi(echec: Echec, statut: number): NextResponse {
  return NextResponse.json(corpsClient(echec), {
    status: statut,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function versConnexion(requete: NextRequest): NextResponse {
  const url = requete.nextUrl.clone();
  const suite = `${requete.nextUrl.pathname}${requete.nextUrl.search}`;
  url.pathname = CHEMIN_CONNEXION;
  url.search = suite === '/' ? '' : `?suite=${encodeURIComponent(suite)}`;
  return NextResponse.redirect(url);
}

/**
 * Une écriture envoyée depuis un autre site est refusée, même si le navigateur
 * a joint le cookie. SameSite=Lax suffit dans les navigateurs récents ; ceci
 * couvre les autres.
 */
function origineEtrangere(requete: NextRequest): boolean {
  if (METHODES_SURES.has(requete.method)) return false;
  if (requete.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origine = requete.headers.get('origin');
  if (!origine) return false;
  try {
    return new URL(origine).host !== requete.nextUrl.host;
  } catch {
    return true;
  }
}

export function proxy(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname;
  if (estCheminPublic(chemin)) return NextResponse.next();

  const api = estCheminApi(chemin);
  const conf = lireConfiguration('tablette');
  if (!conf.ok) {
    // Serveur mal configuré : personne n'entre. La page de connexion l'explique.
    return api
      ? refusApi(signaler('ERR_CONFIGURATION_SERVEUR', { reference: conf.reference }), 503)
      : versConnexion(requete);
  }

  const maintenant = Date.now();
  const tablette = verifierJeton(requete.cookies.get(NOM_COOKIE_TABLETTE)?.value, conf.cle, 'tablette', maintenant);
  if (!tablette) {
    return api ? refusApi(signaler('ERR_SESSION_EXPIREE', {}), 401) : versConnexion(requete);
  }

  if (api && origineEtrangere(requete)) {
    return refusApi(signaler('ERR_ORIGINE_REFUSEE', {}), 403);
  }

  const reponse = NextResponse.next();

  // Tablette utilisée → prolongée (au plus une fois par jour).
  if (doitRafraichir(tablette, maintenant)) {
    const prolongee = prolonger(tablette, maintenant);
    reponse.cookies.set(
      NOM_COOKIE_TABLETTE,
      signerJeton(prolongee, conf.cle),
      optionsCookie(dureeCookieSecondes(prolongee, maintenant))
    );
  }

  // Gérant qui travaille → accès gérant prolongé (dans la limite de sa durée maximale).
  const confGerant = lireConfiguration('gerant');
  if (confGerant.ok) {
    const gerant = verifierJeton(requete.cookies.get(NOM_COOKIE_GERANT)?.value, confGerant.cle, 'gerant', maintenant);
    if (gerant && gerant.appareil === tablette.appareil && doitRafraichir(gerant, maintenant)) {
      const prolonge = prolonger(gerant, maintenant);
      reponse.cookies.set(
        NOM_COOKIE_GERANT,
        signerJeton(prolonge, confGerant.cle),
        optionsCookie(dureeCookieSecondes(prolonge, maintenant))
      );
    }
  }

  return reponse;
}

export const config = {
  // Tout passe par le proxy, sauf les fichiers compilés de Next (immuables,
  // sans donnée). Les autres exceptions sont dans `estCheminPublic`, en clair.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
