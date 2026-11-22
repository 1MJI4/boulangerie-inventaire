// src/app/api/stock/photos/[id]/route.ts
//
// GET : l'image d'une photo de stock (toute tablette installée).
// DELETE : retire une photo (ligne puis fichier).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { signaler } from '@/domaine/messages';
import { nouvelleReference } from '@/lib/journal';
import { dossierStock, estIdPhotoStock, lirePhotoStock, retirerPhotoStock } from '@/lib/photosStockDisque';

type Contexte = { params: Promise<{ id: string }> };
const SANS_CACHE = { 'Cache-Control': 'no-store' };

function introuvable(route: string) {
  const { corps, statut } = reponseEchec(signaler('ERR_DONNEE_INTROUVABLE', { reference: nouvelleReference() }, { champ: 'id' }), route);
  return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
}

export async function GET(request: Request, { params }: Contexte) {
  const garde = exigerRole(request, 'tablette', 'voir une photo de stock');
  if (!garde.ok) return garde.reponse;
  const route = 'GET /api/stock/photos/[id]';
  try {
    const { id } = await params;
    if (!estIdPhotoStock(id)) return introuvable(route);
    const dossier = dossierStock();
    if (!dossier.ok) {
      const { corps, statut } = reponseEchec(dossier, route);
      return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
    }
    const contenu = await lirePhotoStock(dossier.donnees, id);
    if (!contenu) return introuvable(route);
    return new Response(new Uint8Array(contenu), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(contenu.length), 'Cache-Control': 'private, max-age=31536000, immutable' },
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, route);
    return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
  }
}

export async function DELETE(request: Request, { params }: Contexte) {
  const garde = exigerRole(request, 'tablette', 'retirer une photo de stock');
  if (!garde.ok) return garde.reponse;
  const route = 'DELETE /api/stock/photos/[id]';
  try {
    const { id } = await params;
    if (!estIdPhotoStock(id)) return introuvable(route);
    const dossier = dossierStock();
    if (!dossier.ok) {
      const { corps, statut } = reponseEchec(dossier, route);
      return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
    }
    const n = await prisma.photoArticleStock.deleteMany({ where: { id: Number(id) } });
    if (n.count === 0) return introuvable(route);
    await retirerPhotoStock(dossier.donnees, Number(id));
    return NextResponse.json({ ok: true }, { headers: SANS_CACHE });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, route);
    return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
  }
}

export const dynamic = 'force-dynamic';
