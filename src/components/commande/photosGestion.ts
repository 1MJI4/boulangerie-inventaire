// src/components/commande/photosGestion.ts
//
// Galerie de photos modèles gérée par le GÉRANT (décision du propriétaire,
// 26/10/2026 ; écrans et routes : `commandes-traiteur`). Fonctions PURES,
// utilisables par la tablette, les routes et `node --test` :
//   - les refus propres à l'envoi d'une image (format, poids) et à une photo
//     masquée, en français, avec ce qu'il faut faire (LOI 9) ;
//   - les dimensions de la réduction faite sur la tablette avant l'envoi ;
//   - la lecture de l'identifiant de photo d'une ligne de commande.
//
// Les règles de la galerie (rayon, note sans prix, produit au tarif, ordre)
// restent dans src/catalogue/photosModeles.ts (`catalogue-prix`) : rien n'est
// redit ici.
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import type { Echec } from '../../domaine/resultat.ts';
import { signaler } from '../../domaine/messages.ts';
import { FORMAT_ID_PHOTO, FORMAT_FICHIER_PHOTO, type PhotoModele } from '../../catalogue/photosModeles.ts';

// ---------------------------------------------------------------------------
// Envoi d'une image
// ---------------------------------------------------------------------------

/** Côté le plus long de l'image envoyée par la tablette (réseau faible). */
export const COTE_MAX_ENVOI = 1280;
/** Qualité JPEG de l'image envoyée par la tablette. */
export const QUALITE_ENVOI = 0.85;
/** Taille maximale d'une image reçue par le serveur (une photo de téléphone non réduite passe). */
export const TAILLE_MAX_IMAGE = 10 * 1024 * 1024;
/** Enveloppe multipart (champs texte, bornes) tolérée en plus de l'image. */
export const MARGE_ENVELOPPE = 256 * 1024;

// Codes du catalogue des messages (src/domaine/messages.ts, `gestion-erreurs`,
// repris le 28/10/2026) : le texte vit là-bas, jamais redit dans un écran.
export const ERR_FORMAT_PHOTO = 'ERR_FORMAT_PHOTO';
export const ERR_PHOTO_TROP_LOURDE = 'ERR_PHOTO_TROP_LOURDE';
export const ERR_PHOTO_MASQUEE = 'ERR_PHOTO_MASQUEE';

/** HEIC/HEIF, fichier qui n'est pas une image, image illisible. */
export function refusFormatPhoto(): Echec {
  return signaler(ERR_FORMAT_PHOTO, {}, { champ: 'image' });
}

/** Image au-delà de TAILLE_MAX_IMAGE. */
export function refusPhotoTropLourde(): Echec {
  return signaler(ERR_PHOTO_TROP_LOURDE, { maxMo: Math.round(TAILLE_MAX_IMAGE / (1024 * 1024)) }, { champ: 'image' });
}

/** Aucune image jointe à l'ajout. */
export function refusImageManquante(): Echec {
  return signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'photo' }, { champ: 'image' });
}

/**
 * Photo retirée de la galerie par le gérant, demandée sur une NOUVELLE ligne.
 * Sortie en un geste : « Retirer la photo » (valeurProposee null = plus de photo).
 */
export function refusPhotoMasquee(id: string, champ: string): Echec {
  return signaler(ERR_PHOTO_MASQUEE, { photo: id }, { champ, valeurProposee: null });
}

/**
 * Dimensions de l'image réduite : côté le plus long ramené à `max`, jamais
 * agrandie, proportions gardées (arrondi au pixel, au moins 1 px).
 * null si les dimensions lues sont inutilisables (image illisible).
 */
export function dimensionsReduites(largeur: number, hauteur: number, max = COTE_MAX_ENVOI): { largeur: number; hauteur: number } | null {
  if (![largeur, hauteur, max].every((n) => Number.isFinite(n) && n > 0)) return null;
  const echelle = Math.min(1, max / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * echelle)), hauteur: Math.max(1, Math.round(hauteur * echelle)) };
}

/**
 * Nom de fichier servable par GET /api/modeles/[fichier] : format de la base
 * (FORMAT_FICHIER_PHOTO), aucun chemin, aucun fichier caché (les fichiers
 * temporaires d'écriture commencent par un point).
 */
export function nomFichierServable(nom: unknown): nom is string {
  if (typeof nom !== 'string' || nom.length === 0 || nom.length > 80) return false;
  if (nom.startsWith('.') || /[\\/:\0]/.test(nom) || nom.includes('..')) return false;
  // Commence par l'identifiant tel qu'en base (« G043 », majuscule) : comme le CHECK
  // `left(fichier, 4) = id` ; « g043.jpg » n'est jamais une autre adresse de la même image.
  return FORMAT_FICHIER_PHOTO.test(nom) && FORMAT_ID_PHOTO.test(nom.slice(0, 4));
}

const TYPES_IMAGE: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Content-Type d'après l'extension (null : extension non servie). */
export function typeContenuPhoto(nom: string): string | null {
  const ext = nom.slice(nom.lastIndexOf('.') + 1).toLowerCase();
  return TYPES_IMAGE[ext] ?? null;
}

// ---------------------------------------------------------------------------
// Ligne de commande : identifiant de photo reçu
// ---------------------------------------------------------------------------

/**
 * Lecture d'un identifiant de photo reçu (route POST / PATCH des commandes).
 * Absent, null ou vide → pas de photo. Sinon : bon format ET présent en base
 * (`trouvee`, lue par getPhotoModele, masquée comprise), jamais corrigé en
 * silence (sortie de l'écran : « Retirer la photo »). Photo masquée : refusée
 * sur une NOUVELLE ligne (sortie « Retirer la
 * photo ») ; gardée si la commande la portait déjà (`dejaSurLaCommande`) —
 * une commande prise avant le retrait ne se casse pas.
 */
export function lirePhotoDeLigne(
  v: unknown,
  trouvee: Pick<PhotoModele, 'id' | 'masquee'> | null,
  dejaSurLaCommande: boolean,
  champ: string,
): { ok: true; valeur: string | null } | Echec {
  if (v === undefined || v === null || v === '') return { ok: true, valeur: null };
  if (typeof v !== 'string' || !FORMAT_ID_PHOTO.test(v) || !trouvee || trouvee.id !== v) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'photo du modèle' }, { champ });
  }
  if (trouvee.masquee && !dejaSurLaCommande) return refusPhotoMasquee(v, champ);
  return { ok: true, valeur: v };
}

/** Identifiants de photo (format valide) cités par les lignes reçues, sans doublon. */
export function idsPhotosCites(lignes: unknown): string[] {
  if (!Array.isArray(lignes)) return [];
  const ids = new Set<string>();
  for (const l of lignes) {
    const v = l && typeof l === 'object' ? (l as { photoModele?: unknown }).photoModele : undefined;
    if (typeof v === 'string' && FORMAT_ID_PHOTO.test(v)) ids.add(v);
  }
  return [...ids];
}
