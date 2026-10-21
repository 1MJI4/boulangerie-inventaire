// cloudflare/imprimante/src/index.ts
//
// Worker Cloudflare dédié à l'imprimante Star (CloudPRNT).
//
// Pourquoi ici et pas chez Netlify (21/10/2026) : l'imprimante interroge le
// serveur toutes les 5 s, 24 h/24 — ~17 000 appels par jour, ~500 000 par
// mois. L'offre gratuite de Netlify compte chaque appel de fonction et
// plafonne bien en dessous ; les builds ont été mis en pause. L'offre gratuite
// de Cloudflare Workers autorise 100 000 appels PAR JOUR, ne « s'endort » pas,
// et Hyperdrive garde les connexions à la base ouvertes : réponse en quelques
// dizaines de millisecondes, bien sous le seuil d'abandon de la TSP100IV (~5 s).
//
// Adresse à saisir dans l'imprimante (Server URL) :
//   https://<worker>.<compte>.workers.dev/api/cloudprnt/<CLOUDPRNT_CLE>
//
// Aucune logique ici : tout est dans src/lib/serveur/cloudprnt.ts, partagé
// avec l'application Netlify (même base Supabase, mêmes tables).

import postgres from 'postgres';
import { repondreImprimante } from '../../../src/lib/serveur/cloudprnt.ts';
import { depotPostgres } from '../../../src/lib/serveur/depotImprimante.ts';

interface Env {
  /** Connexion à la base Supabase, gérée par Hyperdrive (pool global). */
  HYPERDRIVE: { connectionString: string };
  /** Clé de l'adresse de l'imprimante (secret Cloudflare). */
  CLOUDPRNT_CLE: string;
}

interface Contexte {
  waitUntil(promesse: Promise<unknown>): void;
}

const CHEMIN = /^\/api\/cloudprnt\/([^/]+)\/?$/;

const imprimante = {
  async fetch(requete: Request, env: Env, ctx: Contexte): Promise<Response> {
    const m = CHEMIN.exec(new URL(requete.url).pathname);
    if (!m) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

    // Un client par requête : Hyperdrive tient le vrai pool de connexions,
    // ouvrir ce client est quasi gratuit (recommandation Cloudflare).
    const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false });
    try {
      const reponse = await repondreImprimante(requete, decodeURIComponent(m[1]), depotPostgres(sql), env.CLOUDPRNT_CLE);
      // Repère visible dans les en-têtes : c'est bien le Worker qui a répondu.
      reponse.headers.set('X-Imprimante', 'cloudflare');
      return reponse;
    } finally {
      ctx.waitUntil(sql.end());
    }
  },
};

export default imprimante;
