// src/lib/photosStockDisque.ts
//
// Photos de référence des articles du stock, SUR LE DISQUE du serveur : dans le
// sous-dossier « stock » de DOSSIER_PHOTOS_MODELES (donc sauvegardé avec les
// photos modèles). Fichier = « <id>.jpg », id de la ligne PhotoArticleStock.
// Contrairement aux vignettes de la galerie (640 px, ≤ 80 Ko), on garde ici une
// image plus fine (1280 px) : elle servira plus tard à entraîner une IA.
// Serveur seulement (node:fs, sharp).

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { succes, type Resultat } from '../domaine/resultat.ts';
import { refusFormatPhoto } from '../components/commande/photosGestion.ts';
import { dossierPhotos } from './photosModelesDisque.ts';

export const COTE_MAX_STOCK = 1280;
export const PHOTOS_MAX_PAR_ARTICLE = 8;
const PIXELS_MAX = 50_000_000;

/** Seul un identifiant numérique est un nom valide : aucun chemin possible. */
export const estIdPhotoStock = (v: unknown): v is string => typeof v === 'string' && /^[1-9][0-9]{0,9}$/.test(v);

export function dossierStock(): Resultat<string> {
  const d = dossierPhotos();
  return d.ok ? succes(join(d.donnees, 'stock')) : d;
}

export async function normaliserImageStock(entree: Uint8Array): Promise<Resultat<Buffer>> {
  try {
    const format = (await sharp(entree, { limitInputPixels: PIXELS_MAX }).metadata()).format;
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return refusFormatPhoto();
    const sortie = await sharp(entree, { limitInputPixels: PIXELS_MAX })
      .rotate()
      .resize({ width: COTE_MAX_STOCK, height: COTE_MAX_STOCK, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return succes(sortie);
  } catch {
    return refusFormatPhoto();
  }
}

export async function ecrirePhotoStock(dossier: string, id: number, contenu: Uint8Array): Promise<void> {
  await mkdir(dossier, { recursive: true });
  await writeFile(join(dossier, `${id}.jpg`), contenu);
}

export async function lirePhotoStock(dossier: string, id: string): Promise<Buffer | null> {
  if (!estIdPhotoStock(id)) return null;
  try {
    return await readFile(join(dossier, `${id}.jpg`));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw e;
  }
}

export async function retirerPhotoStock(dossier: string, id: number): Promise<void> {
  await unlink(join(dossier, `${id}.jpg`)).catch(() => {});
}
