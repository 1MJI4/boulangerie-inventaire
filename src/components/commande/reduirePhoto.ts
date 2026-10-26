'use client';

// src/components/commande/reduirePhoto.ts
//
// Réduction d'une photo SUR LA TABLETTE avant l'envoi (réseau faible) : côté
// le plus long 1280 px, JPEG qualité 0,85. Une photo de téléphone de 4 Mo
// part en ~250 Ko ; le serveur la normalise ensuite (640 px, ≤ 80 Ko).
// L'orientation de l'appareil photo est appliquée par le navigateur au
// décodage (`imageOrientation: 'from-image'`) : l'image envoyée est droite.
//
// Image que le navigateur ne sait pas lire (HEIC sur la plupart des
// tablettes Android, fichier abîmé) : refus clair, rien n'est envoyé.

import { succes, type Resultat } from '@/domaine/resultat';
import { COTE_MAX_ENVOI, QUALITE_ENVOI, dimensionsReduites, refusFormatPhoto } from './photosGestion';

type Decodee = { source: CanvasImageSource; largeur: number; hauteur: number; liberer: () => void };

async function decoder(fichier: Blob): Promise<Decodee | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
      return { source: b, largeur: b.width, hauteur: b.height, liberer: () => b.close() };
    } catch {
      /* navigateur plus ancien : passage par une balise image */
    }
  }
  const adresse = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = adresse;
    await img.decode();
    return { source: img, largeur: img.naturalWidth, hauteur: img.naturalHeight, liberer: () => URL.revokeObjectURL(adresse) };
  } catch {
    URL.revokeObjectURL(adresse);
    return null;
  }
}

/** Photo choisie (appareil ou galerie de la tablette) → JPEG réduit, prêt à envoyer. */
export async function reduirePhoto(fichier: Blob): Promise<Resultat<Blob>> {
  if (fichier.type !== '' && !fichier.type.startsWith('image/')) return refusFormatPhoto();
  const image = await decoder(fichier);
  if (!image) return refusFormatPhoto();
  try {
    const d = dimensionsReduites(image.largeur, image.hauteur, COTE_MAX_ENVOI);
    if (!d) return refusFormatPhoto();
    const toile = document.createElement('canvas');
    toile.width = d.largeur;
    toile.height = d.hauteur;
    const ctx = toile.getContext('2d');
    if (!ctx) return refusFormatPhoto();
    // Fond blanc : une capture PNG transparente ne devient pas noire en JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, d.largeur, d.hauteur);
    ctx.drawImage(image.source, 0, 0, d.largeur, d.hauteur);
    const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, 'image/jpeg', QUALITE_ENVOI));
    return blob ? succes(blob) : refusFormatPhoto();
  } finally {
    image.liberer();
  }
}
