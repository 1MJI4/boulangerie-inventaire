// src/app/api/impression/route.ts
//
// Côté vendeur : on dépose les quatre exemplaires dans la file, et on regarde
// l'imprimante venir les chercher.
//
// La file vit en base plutôt qu'en mémoire parce que l'application tourne en
// serverless : entre le dépôt et le sondage de l'imprimante, ce n'est pas la
// même instance qui répond. Un tableau en mémoire aurait marché en
// développement et perdu tous les tickets en production.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { corpsClient, statutHttp, traiterErreur } from '@/lib/erreurBase';
import { journaliser } from '@/lib/journal';
import { signaler } from '@/domaine/messages';

const ROUTE_POST = 'POST /api/impression';

/**
 * Bons vides, illisibles ou trop lourds : un seul refus typé, du catalogue
 * (LOI 9 : jamais « Requête illisible » ni « Ticket de taille invalide » à
 * l'écran). Le détail technique part au journal, pas au vendeur.
 */
function bonsIllisibles(detail: string, appareil: string) {
  journaliser({ niveau: 'erreur', code: 'ERR_BON_ILLISIBLE', route: ROUTE_POST, appareil, detail });
  const corps = corpsClient(signaler('ERR_BON_ILLISIBLE', {}));
  return NextResponse.json(corps, { status: statutHttp(corps) });
}

/** Au-delà, c'est qu'on envoie autre chose qu'un ticket : on refuse. */
const TAILLE_MAX = 400_000;

type TicketEntrant = { destination: string; png: string };

export async function POST(requete: NextRequest) {
  const garde = exigerRole(requete, 'tablette', 'imprimer une commande');
  if (!garde.ok) return garde.reponse;
  let corps: { commandeId?: number; numero?: string; tickets?: TicketEntrant[] };
  try {
    corps = await requete.json();
  } catch {
    return bonsIllisibles('corps JSON illisible', garde.acces.appareil);
  }

  const tickets = Array.isArray(corps.tickets) ? corps.tickets : [];
  if (!tickets.length) return bonsIllisibles('aucun bon reçu', garde.acces.appareil);

  const aEcrire: {
    commandeId: number | null;
    numero: string;
    destination: string;
    media: string;
    // Prisma attend un Uint8Array pour une colonne Bytes ; un Buffer Node en
    // est un, mais son type le declare sur un ArrayBufferLike plus large.
    contenu: Uint8Array<ArrayBuffer>;
  }[] = [];

  for (const ticket of tickets) {
    if (typeof ticket?.png !== 'string' || !ticket.png) return bonsIllisibles('bon vide', garde.acces.appareil);
    const octets = Buffer.from(ticket.png, 'base64');
    // Une copie dans un ArrayBuffer bien a soi : le Buffer de Node partage un
    // pool, et son type l'annonce sur un ArrayBufferLike que Prisma refuse.
    const contenu = new Uint8Array(octets.byteLength);
    contenu.set(octets);
    if (!contenu.byteLength || contenu.byteLength > TAILLE_MAX) {
      return bonsIllisibles(`bon de ${contenu.byteLength} octets (max ${TAILLE_MAX})`, garde.acces.appareil);
    }
    aEcrire.push({
      commandeId: typeof corps.commandeId === 'number' ? corps.commandeId : null,
      numero: typeof corps.numero === 'string' ? corps.numero : '',
      destination: String(ticket.destination ?? '').slice(0, 20),
      media: 'image/png',
      contenu,
    });
  }

  // On repart d'une file vide pour cette commande : sinon une réimpression
  // laisse les anciens exemplaires en place et le compteur de l'écran annonce
  // « 4 sur 8 ». L'historique des impressions vit dans EvenementCommande, pas
  // ici ; cette table n'est qu'une file d'attente.
  try {
    if (typeof corps.commandeId === 'number') {
      await prisma.travailImpression.deleteMany({ where: { commandeId: corps.commandeId } });
    }
    await prisma.travailImpression.createMany({ data: aEcrire });
  } catch (error) {
    // Base injoignable : message du catalogue + référence, journalisé (gestionnaire unique).
    const { corps: c, statut } = traiterErreur(error, ROUTE_POST);
    return NextResponse.json(c, { status: statut });
  }

  return NextResponse.json({ depose: aEcrire.length });
}

/** L'écran interroge cette route pour dire « l'imprimante a pris les tickets ». */
export async function GET(requete: NextRequest) {
  const garde = exigerRole(requete, 'tablette', "suivre l'impression");
  if (!garde.ok) return garde.reponse;
  const id = Number(requete.nextUrl.searchParams.get('commandeId'));
  try {
    return NextResponse.json(await suivi(id));
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/impression');
    return NextResponse.json(corps, { status: statut });
  }
}

async function suivi(id: number) {
  const etatBrut = await prisma.reglage.findUnique({ where: { cle: 'imprimante:etat' } });
  let imprimante: { statusCode: string; vueLe: string } | null = null;
  try {
    imprimante = etatBrut ? JSON.parse(etatBrut.valeur) : null;
  } catch {
    imprimante = null;
  }

  if (!Number.isFinite(id) || id <= 0) return { imprimante, travaux: [] };

  const travaux = await prisma.travailImpression.findMany({
    where: { commandeId: id },
    orderBy: { id: 'asc' },
    select: { id: true, destination: true, statut: true, erreur: true, imprimeLe: true },
  });
  return { imprimante, travaux };
}
