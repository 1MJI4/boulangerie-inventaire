// src/app/api/photos-modeles/route.ts
//
// GET : la galerie de photos modèles de l'écran de commande (table
// « PhotoModele », gérée par le gérant). Toute tablette installée.
//   GET            → { photos, rayons } : photos VISIBLES seulement, triées
//                    (rayon puis ordre) ; les images ne sont PAS envoyées
//                    (chacune se charge à l'écran, depuis `url`).
//   GET ?id=G043   → { photo } : une photo, MÊME MASQUÉE — une ligne de
//                    commande déjà prise peut la citer (vignette du bon).
// Gestion (ajouter, ranger, masquer) : /api/photos-modeles/gestion (gérant).

import { NextResponse } from 'next/server';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { getPhotoModele, listerPhotosModeles } from '@/catalogue/serveur';
import { rayonsDansLOrdre } from '@/catalogue/photosModeles';
import type { Echec } from '@/domaine/resultat';

const ROUTE = 'GET /api/photos-modeles';
const SANS_CACHE = { 'Cache-Control': 'no-store' };

function refus(echec: Echec) {
  const { corps, statut } = reponseEchec(echec, ROUTE);
  return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'voir les photos des modèles');
  if (!garde.ok) return garde.reponse;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id !== null) {
      const photo = await getPhotoModele(id);
      if (!photo.ok) return refus(photo);
      return NextResponse.json({ photo: photo.donnees }, { headers: SANS_CACHE });
    }
    // Une seule lecture : les rayons se déduisent des photos (même règle que categoriesPhotosModeles).
    const photos = await listerPhotosModeles();
    if (!photos.ok) return refus(photos);
    return NextResponse.json({ photos: photos.donnees, rayons: rayonsDansLOrdre(photos.donnees) }, { headers: SANS_CACHE });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, ROUTE);
    return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
  }
}
