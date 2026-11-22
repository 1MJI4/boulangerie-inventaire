// src/app/api/stock/photos/route.ts
//
// POST (multipart : articleId + image) : ajoute une photo de référence à un
// article du stock (jusqu'à 8, plusieurs angles). La tablette a déjà réduit
// l'image (1280 px) ; ici elle est normalisée (orientation, JPEG, sans
// métadonnées) puis écrite sur le disque (src/lib/photosStockDisque.ts).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { signaler } from '@/domaine/messages';
import type { Echec } from '@/domaine/resultat';
import { MARGE_ENVELOPPE, TAILLE_MAX_IMAGE, refusFormatPhoto, refusImageManquante, refusPhotoTropLourde } from '@/components/commande/photosGestion';
import { PHOTOS_MAX_PAR_ARTICLE, dossierStock, ecrirePhotoStock, normaliserImageStock, retirerPhotoStock } from '@/lib/photosStockDisque';

const ROUTE = 'POST /api/stock/photos';
const SANS_CACHE = { 'Cache-Control': 'no-store' };

function refus(echec: Echec) {
  const { corps, statut } = reponseEchec(echec, ROUTE);
  return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
}

export async function POST(request: Request) {
  const garde = exigerRole(request, 'tablette', 'ajouter une photo de stock');
  if (!garde.ok) return garde.reponse;
  try {
    const longueur = Number(request.headers.get('content-length'));
    if (Number.isFinite(longueur) && longueur > TAILLE_MAX_IMAGE + MARGE_ENVELOPPE) return refus(refusPhotoTropLourde());

    let formulaire: FormData;
    try {
      formulaire = await request.formData();
    } catch {
      return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'photo' }, { champ: 'image' }));
    }
    const image = formulaire.get('image');
    if (!(image instanceof Blob) || image.size === 0) return refus(refusImageManquante());
    if (image.size > TAILLE_MAX_IMAGE) return refus(refusPhotoTropLourde());
    if (/hei[cf]/i.test(image.type)) return refus(refusFormatPhoto());

    const articleId = Number(formulaire.get('articleId'));
    const article = Number.isInteger(articleId) && articleId > 0 ? await prisma.articleStock.findUnique({ where: { id: articleId }, select: { id: true } }) : null;
    if (!article) return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'article' }, { champ: 'articleId' }));
    const deja = await prisma.photoArticleStock.count({ where: { articleId } });
    if (deja >= PHOTOS_MAX_PAR_ARTICLE) {
      return refus(
        signaler('ERR_SAISIE_INVALIDE', { champLibelle: `photos de l’article (${PHOTOS_MAX_PAR_ARTICLE} au plus : retirez-en une avant d’en ajouter)` }, { champ: 'image' }),
      );
    }

    const dossier = dossierStock();
    if (!dossier.ok) return refus(dossier);
    const normalisee = await normaliserImageStock(new Uint8Array(await image.arrayBuffer()));
    if (!normalisee.ok) return refus(normalisee);

    const ligne = await prisma.photoArticleStock.create({ data: { articleId }, select: { id: true } });
    try {
      await ecrirePhotoStock(dossier.donnees, ligne.id, normalisee.donnees);
    } catch (e) {
      await prisma.photoArticleStock.delete({ where: { id: ligne.id } }).catch(() => {});
      await retirerPhotoStock(dossier.donnees, ligne.id);
      throw e;
    }
    return NextResponse.json({ id: ligne.id, articleId }, { status: 201, headers: SANS_CACHE });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, ROUTE);
    return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
  }
}

export const dynamic = 'force-dynamic';
