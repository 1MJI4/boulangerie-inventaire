// src/lib/auth/origine.ts
//
// Défense CSRF des écritures : une requête POST/PUT/PATCH/DELETE n'est
// acceptée que si elle vient de la page servie par CE serveur.
// Propriétaire : agent `securite`. Fonction pure : les en-têtes et la
// confiance accordée au proxy sont passés en paramètre, rien n'est lu dans
// l'environnement ici.
//
// Pourquoi ne pas comparer à `requete.nextUrl.host` : en développement, Next
// construit nextUrl à partir de l'option -H (« localhost » par défaut), pas de
// l'en-tête Host (next/dist/server/lib/router-utils/resolve-routes.js). Une
// tablette qui passe par l'IP wifi (192.168.x.x:3000) était donc refusée, et
// avec -H 0.0.0.0 toutes les écritures l'étaient. On compare donc à l'hôte
// RÉEL de la requête : l'en-tête `host`.
//
// `x-forwarded-host` : posé par un proxy (Netlify). N'importe quel client peut
// l'envoyer, donc il n'est retenu QUE si l'appelant déclare le proxy de
// confiance (`proxyDeConfiance`). Sinon il est ignoré : il ne peut jamais
// AUTORISER une origine que `host` contredit. Il n'élargit pas la défense
// CSRF elle-même — un navigateur tiers ne peut pas poser cet en-tête sur une
// requête inter-sites sans pré-vol CORS, que nous ne servons pas —, mais on
// ne l'accepte pas « au cas où » hors d'un déploiement derrière proxy.

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface EntetesOrigine {
  methode: string;
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
  xForwardedHost: string | null;
}

/** Normalise un hôte (casse, port par défaut du schéma de l'Origin). `null` si illisible. */
function normaliserHote(hote: string, protocole: string): string | null {
  try {
    return new URL(`${protocole}//${hote.trim()}`).host;
  } catch {
    return null;
  }
}

/** Un proxy peut empiler plusieurs valeurs : « client, proxy1 ». Seule la première désigne l'hôte demandé. */
function premiereValeur(valeur: string | null): string | null {
  const premiere = valeur?.split(',')[0]?.trim();
  return premiere ? premiere : null;
}

/**
 * `true` si l'écriture doit être refusée parce qu'elle vient d'un autre site.
 *  - méthode sûre (GET, HEAD, OPTIONS) → jamais refusée ici ;
 *  - Sec-Fetch-Site = cross-site → refusée (avec ou sans Origin) ;
 *  - Origin absent (navigateur ancien, même origine) → acceptée ;
 *  - Origin illisible ou « null » → refusée ;
 *  - hôte de l'Origin ≠ hôte de la requête → refusée.
 */
export function origineEtrangere(e: EntetesOrigine, proxyDeConfiance: boolean): boolean {
  if (METHODES_SURES.has(e.methode.toUpperCase())) return false;
  if (e.secFetchSite === 'cross-site') return true;
  if (!e.origin) return false;

  let origine: URL;
  try {
    origine = new URL(e.origin);
  } catch {
    return true;
  }
  if (origine.protocol !== 'http:' && origine.protocol !== 'https:') return true;

  const hotes: string[] = [];
  const hote = premiereValeur(e.host);
  if (hote) hotes.push(hote);
  const transmis = premiereValeur(e.xForwardedHost);
  if (proxyDeConfiance && transmis) hotes.push(transmis);

  const autorises = hotes
    .map((h) => normaliserHote(h, origine.protocol))
    .filter((h): h is string => h !== null);
  // Aucun hôte lisible : dans le doute, on refuse.
  if (autorises.length === 0) return true;
  return !autorises.includes(origine.host);
}
