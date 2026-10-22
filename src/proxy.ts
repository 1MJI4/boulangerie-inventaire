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
import { origineEtrangere } from '@/lib/auth/origine';
import { CHEMIN_CONNEXION, estCheminApi, estCheminPublic } from '@/lib/auth/chemins';
import { NOM_COOKIE_GERANT, NOM_COOKIE_TABLETTE, lireConfiguration, optionsCookie } from '@/lib/auth/config';
import { doitRafraichir, dureeCookieSecondes, prolonger, signerJeton, verifierJeton } from '@/lib/auth/session';

function refusApi(echec: Echec, statut: number): NextResponse {
  return NextResponse.json(corpsClient(echec), {
    status: statut,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * La redirection vise l'hôte RÉELLEMENT demandé par le navigateur (en-tête Host,
 * protocole transmis par le serveur web) : derrière Caddy sur le VPS, Next se
 * croit sur « localhost:3000 » et `nextUrl` y enverrait la tablette. Le proxy
 * de Next refuse une adresse relative.
 */
function versConnexion(requete: NextRequest): NextResponse {
  const url = requete.nextUrl.clone();
  const hote = requete.headers.get('host');
  const protocole = requete.headers.get('x-forwarded-proto');
  if (hote) {
    url.port = ''; // un Host sans port ne remet pas le port à zéro de lui-même
    url.host = hote;
  }
  if (protocole === 'https' || protocole === 'http') url.protocol = `${protocole}:`;
  const suite = `${requete.nextUrl.pathname}${requete.nextUrl.search}`;
  url.pathname = CHEMIN_CONNEXION;
  url.search = suite === '/' ? '' : `?suite=${encodeURIComponent(suite)}`;
  return NextResponse.redirect(url);
}

/**
 * Une écriture envoyée depuis un autre site est refusée, même si le navigateur
 * a joint le cookie. SameSite=Lax suffit dans les navigateurs récents ; ceci
 * couvre les autres. La comparaison se fait sur l'hôte RÉEL de la requête
 * (en-tête Host), pas sur `nextUrl.host` — voir src/lib/auth/origine.ts.
 *
 * x-forwarded-host n'est retenu que derrière Netlify (variable NETLIFY=true
 * posée par la plateforme).
 * HYPOTHÈSE À VALIDER : NETLIFY=true est bien visible à l'exécution des
 * fonctions Netlify (agent `deploiement`). Si elle ne l'est pas, seul Host est
 * comparé : plus strict, jamais plus permissif.
 */
function origineRefusee(requete: NextRequest): boolean {
  return origineEtrangere(
    {
      methode: requete.method,
      origin: requete.headers.get('origin'),
      secFetchSite: requete.headers.get('sec-fetch-site'),
      host: requete.headers.get('host'),
      xForwardedHost: requete.headers.get('x-forwarded-host'),
    },
    process.env.NETLIFY === 'true'
  );
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

  if (api && origineRefusee(requete)) {
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
  // sans donnée) et l'imprimante (/api/cloudprnt/, servie par sa fonction
  // Netlify dédiée et authentifiée par sa clé : le proxy n'y ajouterait que du
  // délai, et l'imprimante abandonne un téléchargement trop lent). Les autres
  // exceptions sont dans `estCheminPublic`, en clair.
  matcher: ['/((?!_next/static|_next/image|api/cloudprnt/).*)'],
};
