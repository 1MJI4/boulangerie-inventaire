// src/lib/photosModelesDisque.ts
//
// Images de la galerie de photos modèles, SUR LE DISQUE du serveur (décision du
// propriétaire, 26/10/2026 : le gérant ajoute lui-même ses photos). Utilisé
// par les routes /api/modeles/[fichier] et /api/photos-modeles/gestion
// (`commandes-traiteur`). Serveur seulement (node:fs, sharp).
//
// Dossier : variable DOSSIER_PHOTOS_MODELES, HORS du code (recette :
// <projet>/donnees/modeles ; VPS : /var/lib/pain-patisserie/modeles). La
// variable est lue ICI, jamais dans une route (src/lib/auth/matrice.test.ts).
//
// Une image ne change jamais de contenu sous un même nom (l'identifiant d'une
// photo est imprimé sur les bons) : elle est écrite UNE fois, dans un fichier
// temporaire caché du même dossier puis renommée (atomique : personne ne lit
// jamais une image à moitié écrite).

import { randomBytes } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { signaler } from '../domaine/messages.ts';
import { succes, type Echec, type Resultat } from '../domaine/resultat.ts';
import { journaliser, nouvelleReference } from './journal.ts';
import { nomFichierServable, refusFormatPhoto } from '../components/commande/photosGestion.ts';

const ROUTE_JOURNAL = 'photos-modeles/disque';

/** Côté le plus long de l'image gardée sur le serveur. */
export const COTE_MAX_SERVEUR = 640;
/** Qualités JPEG essayées dans l'ordre, jusqu'à passer sous POIDS_VISE. */
export const QUALITES_JPEG = [75, 65, 55] as const;
/** Poids visé d'une vignette (réseau faible) ; la dernière qualité est gardée sinon. */
export const POIDS_VISE = 80 * 1024;
/** Garde-fou de décodage (pixels) : une image démesurée est refusée, jamais décodée. */
const PIXELS_MAX = 50_000_000;

function refusConfiguration(piste: string): Echec {
  const reference = nouvelleReference();
  journaliser({ niveau: 'erreur', code: 'ERR_CONFIGURATION_SERVEUR', route: ROUTE_JOURNAL, reference, piste });
  return signaler('ERR_CONFIGURATION_SERVEUR', { reference });
}

/** Dossier des images, ou refus clair (prévenir le gérant, avec une référence). */
export function dossierPhotos(): Resultat<string> {
  const d = process.env.DOSSIER_PHOTOS_MODELES?.trim();
  if (!d || d.startsWith('[')) {
    return refusConfiguration('DOSSIER_PHOTOS_MODELES absente : la poser dans l’environnement (recette : npm run recette:base).');
  }
  if (!isAbsolute(d)) return refusConfiguration('DOSSIER_PHOTOS_MODELES doit être un chemin absolu.');
  return succes(d);
}

/** Contenu d'une image ; null si le nom n'est pas servable ou si le fichier n'existe pas. */
export async function lireImage(dossier: string, nom: string): Promise<Buffer | null> {
  if (!nomFichierServable(nom)) return null;
  try {
    return await readFile(join(dossier, nom));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') return null;
    throw e;
  }
}

/**
 * Image reçue → JPEG de la galerie : orientation EXIF appliquée, côté long
 * ≤ 640 px (jamais agrandie), métadonnées retirées (sharp n'en recopie aucune
 * sans `withMetadata`), qualité 75 puis moins jusqu'à ≤ 80 Ko.
 * HEIC/HEIF, SVG, fichier qui n'est pas une image, image illisible : refus
 * « Format de photo non pris en charge… ».
 */
export async function normaliserImage(entree: Uint8Array): Promise<Resultat<Buffer>> {
  let format: string | undefined;
  try {
    format = (await sharp(entree, { limitInputPixels: PIXELS_MAX }).metadata()).format;
  } catch {
    return refusFormatPhoto();
  }
  if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return refusFormatPhoto();
  try {
    let sortie: Buffer | null = null;
    for (const qualite of QUALITES_JPEG) {
      sortie = await sharp(entree, { limitInputPixels: PIXELS_MAX })
        .rotate()
        .resize({ width: COTE_MAX_SERVEUR, height: COTE_MAX_SERVEUR, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: qualite, mozjpeg: true })
        .toBuffer();
      if (sortie.length <= POIDS_VISE) break;
    }
    return sortie ? succes(sortie) : refusFormatPhoto();
  } catch {
    return refusFormatPhoto();
  }
}

/**
 * Écrit l'image sous `nom` : fichier temporaire caché du même dossier (nom
 * aléatoire, `wx` : jamais partagé), puis renommage. Le nom final vient d'un
 * identifiant neuf (séquence de la base) : il n'existe pas encore.
 */
export async function ecrireImageAtomique(dossier: string, nom: string, contenu: Uint8Array): Promise<void> {
  if (!nomFichierServable(nom)) throw new Error(`Nom d'image refusé : ${nom}`);
  const temporaire = join(dossier, `.${nom}.${randomBytes(6).toString('hex')}.tmp`);
  await writeFile(temporaire, contenu, { flag: 'wx' });
  try {
    await rename(temporaire, join(dossier, nom));
  } catch (e) {
    await unlink(temporaire).catch(() => {});
    throw e;
  }
}

/** Retire une image orpheline (ligne non insérée). Sans effet si elle n'existe pas. */
export async function retirerImage(dossier: string, nom: string): Promise<void> {
  if (!nomFichierServable(nom)) return;
  await unlink(join(dossier, nom)).catch(() => {});
}
