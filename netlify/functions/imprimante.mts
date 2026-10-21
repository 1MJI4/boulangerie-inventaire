// netlify/functions/imprimante.mts
//
// Fonction Netlify DÉDIÉE à l'imprimante Star (CloudPRNT), servie à la même
// adresse que la route Next : /api/cloudprnt/<clé>. L'imprimante n'a rien à
// changer dans ses réglages.
//
// Pourquoi (21/10/2026) : la TSP100IV abandonne une réponse qui dépasse ~5 s
// (« 520 Download failed ») et se met alors en retrait plusieurs minutes : le
// client attend son ticket. Servie par l'application Next, ou même par une
// fonction qui charge Prisma, une requête qui réveille un serveur endormi
// prenait ~5 s. Cette fonction n'utilise que le client PostgreSQL `postgres`
// (JavaScript pur) : réveil en une fraction de seconde. Une tâche planifiée
// (imprimante-reveil.mts) l'appelle chaque minute pendant les heures
// d'ouverture pour qu'elle ne s'endorme pas.
//
// Aucune logique ici : tout est dans src/lib/serveur/cloudprnt.ts, partagé avec
// la route de secours src/app/api/cloudprnt/[cle]/route.ts.

import postgres from 'postgres';
import { repondreImprimante } from '../../src/lib/serveur/cloudprnt.ts';
import { depotPostgres } from '../../src/lib/serveur/depotImprimante.ts';

// Types minimaux du runtime Netlify (fonctions « v2 ») : pas de dépendance
// @netlify/functions pour deux champs.
type Context = { params: Record<string, string | undefined> };
type Config = { path: string; method?: string[] };

/** Segment d'adresse réservé au réveil planifié : aucune donnée, aucun travail. */
export const SEGMENT_REVEIL = 'reveil';

/**
 * DATABASE_URL vise le pooler transactionnel Supabase (port 6543). Ses
 * paramètres propres à Prisma (?pgbouncer=true&connection_limit=1) ne sont pas
 * des paramètres PostgreSQL : on les retire.
 */
function adresseBase(): string {
  const brute = process.env.DATABASE_URL ?? '';
  const i = brute.indexOf('?');
  return i >= 0 ? brute.slice(0, i) : brute;
}

// Une seule connexion par instance, ouverte au premier besoin et réutilisée
// tant que la fonction reste éveillée. `prepare: false` : obligatoire derrière
// un pooler transactionnel.
const adresse = adresseBase();
const sql = postgres(adresse, {
  max: 1,
  prepare: false,
  // Chiffrement exigé, sauf la base de recette locale (Docker, sans TLS).
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(adresse) ? false : 'require',
  idle_timeout: 60,
  connect_timeout: 4,
});
const depot = depotPostgres(sql);

const SANS_CACHE = { 'Cache-Control': 'no-store', 'X-Imprimante': 'fonction-dediee' };

export default async function imprimante(requete: Request, contexte: Context): Promise<Response> {
  const cle = contexte.params.cle ?? '';
  if (cle === SEGMENT_REVEIL) {
    // Garde la connexion à la base ouverte et la fonction éveillée.
    await sql`SELECT 1`;
    return new Response(null, { status: 204, headers: SANS_CACHE });
  }
  const reponse = await repondreImprimante(requete, cle, depot, process.env.CLOUDPRNT_CLE);
  // Repère visible dans les en-têtes : c'est bien la fonction dédiée qui a répondu.
  reponse.headers.set('X-Imprimante', 'fonction-dediee');
  return reponse;
}

export const config: Config = {
  path: '/api/cloudprnt/:cle',
  method: ['GET', 'POST', 'DELETE'],
};
