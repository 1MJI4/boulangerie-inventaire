// src/lib/serveur/cloudprnt.ts
//
// Le point de rendez-vous avec l'imprimante Star (protocole CloudPRNT).
//
// Le sens de la conversation est inversé par rapport à une impression
// classique : ce n'est pas l'application qui pousse vers l'imprimante, c'est
// l'imprimante qui vient demander du travail. C'est ce qui permet d'imprimer
// depuis un iPad, depuis le téléphone du manager le soir, depuis n'importe
// quoi — aucun pilote nulle part, aucune machine à laisser allumée au
// comptoir.
//
// Le dialogue, tel que Star le définit :
//   POST   → l'imprimante dit bonjour et donne son état. On répond s'il y a
//            du travail et dans quel format on sait le servir.
//   GET    → elle vient chercher le document. On renvoie le PNG.
//   DELETE → elle confirme avoir imprimé (« 200 OK ») ou signale l'échec.
//
// La confirmation est ce qui compte vraiment : c'est seulement quand le
// dernier exemplaire est sorti qu'on marque la commande imprimée.
//
// Ce module ne dépend ni de Next ni de Netlify (Request / Response standard) :
// il est servi par la fonction Netlify dédiée (netlify/functions/imprimante.mts),
// qui démarre vite même « à froid », et par la route Next de secours
// (src/app/api/cloudprnt/[cle]/route.ts).
//
// Accès : l'imprimante ne sait pas ouvrir de session ; elle est authentifiée
// par la clé de son URL, et uniquement pour lire et acquitter des travaux
// d'impression. La clé n'est JAMAIS journalisée ni renvoyée dans une réponse.

import { createHash, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { confirmationReussie } from '../cloudprnt.ts';

/** Ce dont le dialogue a besoin dans la base (sous-ensemble de PrismaClient). */
export type BaseImprimante = Pick<PrismaClient, 'reglage' | 'travailImpression' | 'commande' | 'evenementCommande'>;

/**
 * Longueur minimale de CLOUDPRNT_CLE. Une clé courte se devine ; en dessous,
 * on refuse tout.
 * HYPOTHÈSE À VALIDER : 32 caractères (clé aléatoire générée, jamais choisie).
 */
const LONGUEUR_MIN_CLE = 32;

function empreinte(valeur: string): Buffer {
  return createHash('sha256').update(valeur, 'utf8').digest();
}

/** L'URL configurée dans l'imprimante contient cette clé. Sans elle, rien. */
export function cleValide(cle: string, attendue: string | undefined): boolean {
  // Pas de clé configurée (ou trop courte) : on refuse tout plutôt que d'ouvrir
  // une file d'impression publique à qui passe.
  if (!attendue || attendue.length < LONGUEUR_MIN_CLE) return false;
  if (typeof cle !== 'string' || cle.length > 256) return false;
  // Comparaison à durée constante sur des empreintes de même longueur : le
  // temps de réponse ne révèle ni la clé ni sa longueur.
  return timingSafeEqual(empreinte(cle), empreinte(attendue));
}

const SANS_CACHE = { 'Cache-Control': 'no-store' };

function json(corps: unknown, status = 200): Response {
  const texte = JSON.stringify(corps);
  return new Response(texte, {
    status,
    headers: { ...SANS_CACHE, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(texte)) },
  });
}

function vide(status: number): Response {
  return new Response(null, { status, headers: { ...SANS_CACHE, 'Content-Length': '0' } });
}

/** Mémorise l'état de l'imprimante pour que l'écran puisse le montrer. */
async function noterEtat(db: BaseImprimante, statusCode: string, mac: string | null) {
  const valeur = JSON.stringify({ statusCode, mac, vueLe: new Date().toISOString() });
  await db.reglage
    .upsert({ where: { cle: 'imprimante:etat' }, create: { cle: 'imprimante:etat', valeur }, update: { valeur } })
    .catch(() => {});
}

/* ------------------------------------------------ POST : le sondage */

async function sondage(requete: Request, db: BaseImprimante): Promise<Response> {
  let corps: Record<string, unknown> = {};
  try {
    corps = await requete.json();
  } catch {
    // Certaines versions de firmware sondent sans corps. Ce n'est pas une
    // erreur : on répond quand même.
  }
  const statusCode = typeof corps.statusCode === 'string' ? corps.statusCode : '';
  const mac = typeof corps.printerMAC === 'string' ? corps.printerMAC : null;

  // Les deux accès en parallèle : la réponse part plus vite.
  const [, travail] = await Promise.all([
    noterEtat(db, statusCode, mac),
    db.travailImpression.findFirst({
      where: { statut: 'en_attente' },
      orderBy: { id: 'asc' },
      select: { id: true, media: true },
    }),
  ]);

  return json({
    jobReady: Boolean(travail),
    mediaTypes: travail ? [travail.media] : [],
    // L'imprimante confirmera par DELETE ; c'est le comportement par défaut,
    // on l'énonce quand même pour ne dépendre d'aucune valeur implicite.
    deleteMethod: 'DELETE',
  });
}

/* --------------------------------------- GET : elle vient chercher */

async function remise(db: BaseImprimante): Promise<Response> {
  const travail = await db.travailImpression.findFirst({
    where: { statut: 'en_attente' },
    orderBy: { id: 'asc' },
  });
  if (!travail) return vide(404);

  // « remis » et pas « imprimé » : le papier n'est pas encore sorti. Si
  // l'imprimante tombe entre les deux, le travail reste visible comme non
  // terminé au lieu de disparaître en silence.
  await db.travailImpression.update({
    where: { id: travail.id },
    data: { statut: 'remis', remisLe: new Date() },
  });

  const octets = Buffer.from(travail.contenu);
  return new Response(octets, {
    status: 200,
    headers: { ...SANS_CACHE, 'Content-Type': travail.media, 'Content-Length': String(octets.length) },
  });
}

/* --------------------------------- DELETE : elle confirme avoir imprimé */

async function confirmation(url: URL, db: BaseImprimante): Promise<Response> {
  const code = url.searchParams.get('code') ?? 'OK';
  const reussi = confirmationReussie(code);

  const travail = await db.travailImpression.findFirst({
    where: { statut: 'remis' },
    orderBy: { id: 'asc' },
  });
  if (!travail) return vide(200);

  await db.travailImpression.update({
    where: { id: travail.id },
    data: reussi
      ? { statut: 'imprime', imprimeLe: new Date(), erreur: null }
      : // Un échec repart en file : le vendeur remet du papier, l'imprimante
        // reprend toute seule là où elle s'était arrêtée.
        { statut: 'en_attente', remisLe: null, erreur: code },
  });

  if (reussi && travail.commandeId) {
    const reste = await db.travailImpression.count({
      where: { commandeId: travail.commandeId, statut: { not: 'imprime' } },
    });
    if (reste === 0) {
      // Tous les exemplaires sont sortis : c'est maintenant, et seulement
      // maintenant, que la commande est vraiment imprimée.
      const commande = await db.commande.findUnique({
        where: { id: travail.commandeId },
        select: { statut: true },
      });
      if (commande && commande.statut === 'a_imprimer') {
        await db.commande.update({
          where: { id: travail.commandeId },
          data: { statut: 'imprimee', imprimeeLe: new Date() },
        });
        await db.evenementCommande.create({
          data: {
            commandeId: travail.commandeId,
            auteur: 'imprimante',
            action: 'impression',
            detail: 'quatre exemplaires sortis sur le rouleau',
          },
        });
      }
    }
  }

  return vide(200);
}

/**
 * Répond à un appel de l'imprimante. `cle` : dernier segment de l'adresse ;
 * `cleAttendue` : CLOUDPRNT_CLE de l'environnement.
 */
export async function repondreImprimante(
  requete: Request,
  cle: string,
  db: BaseImprimante,
  cleAttendue: string | undefined,
): Promise<Response> {
  if (!cleValide(cle, cleAttendue)) {
    return requete.method === 'POST' ? json({ jobReady: false }, 403) : vide(403);
  }
  switch (requete.method) {
    case 'POST':
      return sondage(requete, db);
    case 'GET':
      return remise(db);
    case 'DELETE':
      return confirmation(new URL(requete.url), db);
    default:
      return vide(405);
  }
}
