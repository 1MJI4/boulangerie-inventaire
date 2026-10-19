// src/lib/auth/chemins.ts
//
// Ce qui est accessible SANS session. Tout le reste est protégé par défaut :
// une nouvelle page ou une nouvelle route API est fermée tant qu'on ne l'a pas
// explicitement ajoutée ici. Propriétaire : agent `securite`.

export const CHEMIN_CONNEXION = '/connexion';

/** Fichiers posés à la racine de `public/` ou générés par Next (icônes, manifeste). */
const RESSOURCE_STATIQUE_RACINE = /^\/[A-Za-z0-9._-]+\.(?:png|svg|ico|jpg|jpeg|webp|webmanifest|txt)$/;

/**
 * Exceptions explicites :
 *  - la page de connexion (et ses Server Actions, qui y sont postées) ;
 *  - les ressources techniques de Next (`/_next/…`) et les fichiers statiques ;
 *  - `/api/cloudprnt/…` : l'imprimante ne sait pas ouvrir de session, elle est
 *    authentifiée par sa clé dans l'URL, vérifiée dans la route elle-même ;
 *    idem pour son relais `/.netlify/functions/cloudprnt-relais/…`.
 */
export function estCheminPublic(chemin: string): boolean {
  if (chemin === CHEMIN_CONNEXION) return true;
  if (chemin.startsWith('/_next/')) return true;
  if (chemin.startsWith('/api/cloudprnt/')) return true;
  // Relais CloudPRNT (netlify/functions/cloudprnt-relais.mjs) : il ne fait que
  // transmettre à /api/cloudprnt/<clé>, qui vérifie la clé.
  if (chemin.startsWith('/.netlify/functions/cloudprnt-relais/')) return true;
  if (RESSOURCE_STATIQUE_RACINE.test(chemin)) return true;
  return false;
}

export function estCheminApi(chemin: string): boolean {
  return chemin === '/api' || chemin.startsWith('/api/');
}

/**
 * Page où revenir après connexion. Seul un chemin interne est accepté : jamais
 * une URL complète, jamais « //autre-site » (redirection ouverte).
 */
export function cheminDeRetour(suite: unknown): string {
  if (typeof suite !== 'string') return '/';
  if (!suite.startsWith('/') || suite.startsWith('//') || suite.startsWith('/\\')) return '/';
  if (suite.startsWith(CHEMIN_CONNEXION)) return '/';
  if (suite.length > 512) return '/';
  return suite;
}
