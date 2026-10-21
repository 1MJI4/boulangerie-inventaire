// netlify/functions/imprimante.mts
//
// Fonction Netlify DÉDIÉE à l'imprimante Star (CloudPRNT), servie à la même
// adresse que la route Next : /api/cloudprnt/<clé>. L'imprimante n'a rien à
// changer dans ses réglages.
//
// Pourquoi (21/10/2026) : servie par l'application Next, une requête de
// l'imprimante qui tombe sur un serveur « froid » (la tablette occupe déjà le
// serveur chaud pendant qu'elle suit l'impression) met ~5 s à répondre. La
// TSP100IV abandonne le téléchargement du ticket avant (« 520 Download
// failed »), se met en retrait plusieurs minutes, et seul le ticket CLIENT
// sort. Cette fonction ne charge que Prisma : elle démarre en moins d'une
// seconde et n'est jamais en concurrence avec la tablette.
//
// Aucune logique ici : tout est dans src/lib/serveur/cloudprnt.ts, partagé avec
// la route de secours src/app/api/cloudprnt/[cle]/route.ts.

import { PrismaClient } from '@prisma/client';
import { repondreImprimante } from '../../src/lib/serveur/cloudprnt.ts';

// Types minimaux du runtime Netlify (fonctions « v2 ») : pas de dépendance
// @netlify/functions pour deux champs.
type Context = { params: Record<string, string | undefined> };
type Config = { path: string; method?: string[] };

// Un seul client par instance, réutilisé d'un appel à l'autre tant que la
// fonction reste chaude.
const prisma = new PrismaClient();

export default async function imprimante(requete: Request, contexte: Context): Promise<Response> {
  const reponse = await repondreImprimante(requete, contexte.params.cle ?? '', prisma, process.env.CLOUDPRNT_CLE);
  // Repère visible dans les en-têtes : c'est bien la fonction dédiée qui a répondu.
  reponse.headers.set('X-Imprimante', 'fonction-dediee');
  return reponse;
}

export const config: Config = {
  path: '/api/cloudprnt/:cle',
  method: ['GET', 'POST', 'DELETE'],
};
