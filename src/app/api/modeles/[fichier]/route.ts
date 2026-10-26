// src/app/api/modeles/[fichier]/route.ts
//
// GET : image d'une photo modèle de la galerie (« G043.jpg », « P001.jpg »),
// lue dans le dossier DOSSIER_PHOTOS_MODELES (hors du code, voir
// src/lib/photosModelesDisque.ts). Toute tablette installée (le proxy l'exige
// déjà ; `exigerRole` est la seconde barrière).
//
// Nom validé avant tout accès disque : format de la base, aucun chemin, aucun
// fichier caché (les fichiers temporaires d'écriture commencent par un point).
// Le contenu d'un fichier ne change jamais (identifiant imprimé sur les bons) :
// cache long `immutable`, « private » parce que la route est protégée.

import { NextResponse } from 'next/server';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { signaler } from '@/domaine/messages';
import { nouvelleReference } from '@/lib/journal';
import { dossierPhotos, lireImage } from '@/lib/photosModelesDisque';
import { nomFichierServable, typeContenuPhoto } from '@/components/commande/photosGestion';

type Contexte = { params: Promise<{ fichier: string }> };

const ROUTE = 'GET /api/modeles/[fichier]';

function introuvable() {
  const { corps, statut } = reponseEchec(signaler('ERR_DONNEE_INTROUVABLE', { reference: nouvelleReference() }, { champ: 'fichier' }), ROUTE);
  return NextResponse.json(corps, { status: statut, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request, { params }: Contexte) {
  const garde = exigerRole(request, 'tablette', 'voir les photos des modèles');
  if (!garde.ok) return garde.reponse;
  try {
    const { fichier } = await params;
    const type = nomFichierServable(fichier) ? typeContenuPhoto(fichier) : null;
    if (!type) return introuvable();
    const dossier = dossierPhotos();
    if (!dossier.ok) {
      const { corps, statut } = reponseEchec(dossier, ROUTE);
      return NextResponse.json(corps, { status: statut, headers: { 'Cache-Control': 'no-store' } });
    }
    const contenu = await lireImage(dossier.donnees, fichier);
    if (!contenu) return introuvable();
    return new Response(new Uint8Array(contenu), {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(contenu.length),
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, ROUTE);
    return NextResponse.json(corps, { status: statut, headers: { 'Cache-Control': 'no-store' } });
  }
}
