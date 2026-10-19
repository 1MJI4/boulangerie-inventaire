// src/app/api/cloudprnt/[cle]/route.ts
//
// Le point de rendez-vous avec l'imprimante Star.
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
//   DELETE → elle confirme avoir imprimé (code=OK) ou signale l'échec.
//
// La confirmation est ce qui compte vraiment : c'est seulement quand le
// dernier exemplaire est sorti qu'on marque la commande imprimée. Le bouton
// « Imprimer » d'un navigateur, lui, ment — il marque imprimé même si le
// papier était fini.

import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { confirmationReussie } from '@/lib/cloudprnt';

// Accès : cette route est la seule exception au proxy (src/lib/auth/chemins.ts).
// L'imprimante ne sait pas ouvrir de session : elle est authentifiée par la clé
// de son URL, et uniquement pour lire et acquitter des travaux d'impression.
// La clé n'est JAMAIS journalisée ni renvoyée dans une réponse.

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
function cleValide(cle: string): boolean {
  const attendue = process.env.CLOUDPRNT_CLE;
  // Pas de clé configurée (ou trop courte) : on refuse tout plutôt que d'ouvrir
  // une file d'impression publique à qui passe.
  if (!attendue || attendue.length < LONGUEUR_MIN_CLE) return false;
  if (typeof cle !== 'string' || cle.length > 256) return false;
  // Comparaison à durée constante sur des empreintes de même longueur : le
  // temps de réponse ne révèle ni la clé ni sa longueur.
  return timingSafeEqual(empreinte(cle), empreinte(attendue));
}

/** Mémorise l'état de l'imprimante pour que l'écran puisse le montrer. */
async function noterEtat(statusCode: string, mac: string | null) {
  await prisma.reglage
    .upsert({
      where: { cle: 'imprimante:etat' },
      create: {
        cle: 'imprimante:etat',
        valeur: JSON.stringify({ statusCode, mac, vueLe: new Date().toISOString() }),
      },
      update: {
        valeur: JSON.stringify({ statusCode, mac, vueLe: new Date().toISOString() }),
      },
    })
    .catch(() => {});
}

/* ------------------------------------------------ POST : le sondage */

export async function POST(requete: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  if (!cleValide(cle)) return NextResponse.json({ jobReady: false }, { status: 403 });

  let corps: Record<string, unknown> = {};
  try {
    corps = await requete.json();
  } catch {
    // Certaines versions de firmware sondent sans corps. Ce n'est pas une
    // erreur : on répond quand même.
  }

  const statusCode = typeof corps.statusCode === 'string' ? corps.statusCode : '';
  const mac = typeof corps.printerMAC === 'string' ? corps.printerMAC : null;
  await noterEtat(statusCode, mac);

  const travail = await prisma.travailImpression.findFirst({
    where: { statut: 'en_attente' },
    orderBy: { id: 'asc' },
    select: { id: true, media: true },
  });

  return NextResponse.json({
    jobReady: Boolean(travail),
    mediaTypes: travail ? [travail.media] : [],
    // L'imprimante confirmera par DELETE ; c'est le comportement par défaut,
    // on l'énonce quand même pour ne dépendre d'aucune valeur implicite.
    deleteMethod: 'DELETE',
  });
}

/* --------------------------------------- GET : elle vient chercher */

export async function GET(requete: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  if (!cleValide(cle)) return new NextResponse('', { status: 403 });

  const travail = await prisma.travailImpression.findFirst({
    where: { statut: 'en_attente' },
    orderBy: { id: 'asc' },
  });
  if (!travail) return new NextResponse('', { status: 404 });

  // « remis » et pas « imprimé » : le papier n'est pas encore sorti. Si
  // l'imprimante tombe entre les deux, le travail reste visible comme non
  // terminé au lieu de disparaître en silence.
  await prisma.travailImpression.update({
    where: { id: travail.id },
    data: { statut: 'remis', remisLe: new Date() },
  });

  return new NextResponse(Buffer.from(travail.contenu), {
    status: 200,
    headers: {
      'Content-Type': travail.media,
      'Content-Length': String(travail.contenu.length),
      'Cache-Control': 'no-store',
    },
  });
}

/* --------------------------------- DELETE : elle confirme avoir imprimé */

export async function DELETE(requete: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  if (!cleValide(cle)) return new NextResponse('', { status: 403 });

  const code = requete.nextUrl.searchParams.get('code') ?? 'OK';
  const reussi = confirmationReussie(code);

  const travail = await prisma.travailImpression.findFirst({
    where: { statut: 'remis' },
    orderBy: { id: 'asc' },
  });
  if (!travail) return new NextResponse('', { status: 200 });

  await prisma.travailImpression.update({
    where: { id: travail.id },
    data: reussi
      ? { statut: 'imprime', imprimeLe: new Date(), erreur: null }
      : // Un échec repart en file : le vendeur remet du papier, l'imprimante
        // reprend toute seule là où elle s'était arrêtée.
        { statut: 'en_attente', remisLe: null, erreur: code },
  });

  if (reussi && travail.commandeId) {
    const reste = await prisma.travailImpression.count({
      where: { commandeId: travail.commandeId, statut: { not: 'imprime' } },
    });
    if (reste === 0) {
      // Tous les exemplaires sont sortis : c'est maintenant, et seulement
      // maintenant, que la commande est vraiment imprimée.
      const commande = await prisma.commande.findUnique({
        where: { id: travail.commandeId },
        select: { statut: true },
      });
      if (commande && commande.statut === 'a_imprimer') {
        await prisma.commande.update({
          where: { id: travail.commandeId },
          data: { statut: 'imprimee', imprimeeLe: new Date() },
        });
        await prisma.evenementCommande.create({
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

  return new NextResponse('', { status: 200 });
}
