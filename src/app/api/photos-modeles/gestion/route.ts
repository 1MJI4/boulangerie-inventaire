// src/app/api/photos-modeles/gestion/route.ts
//
// Gestion de la galerie de photos modèles PAR LE GÉRANT (décision du
// propriétaire, 26/10/2026). Accès gérant (code gérant, POST /api/gestion).
//
//   GET   → { photos, rayons } : TOUTES les photos, masquées comprises (grisées à l'écran).
//   POST  → multipart/form-data : image (fichier) + categorie, produit ('' = la
//           vendeuse choisit), supplements (liste JSON de clés), note, creePar.
//           Réponse : la photo créée.
//   PATCH → JSON { id, action } :
//           'modifier' + categorie? produit? supplements? note?  → la photo
//           'masquer'  + masquee (true / false)                   → la photo
//           'deplacer' + sens ('avant' / 'apres')                 → photos renumérotées
//
// Pas de suppression : une photo citée par une commande doit rester lisible.
//
// L'image : la tablette l'a déjà réduite (1280 px, JPEG) pour le réseau faible ;
// ici elle est NORMALISÉE (src/lib/photosModelesDisque.ts : orientation, 640 px,
// JPEG ~75, sans métadonnées, ≤ 80 Ko), puis écrite de façon atomique par le
// rappel `enregistrerImage`, APRÈS validation des champs par le catalogue.
// Toute validation (rayon, note sans prix, produit au tarif) est celle de
// src/catalogue/photosModeles.ts : la route ne redit aucune règle.

import { NextResponse } from 'next/server';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { nomDeclare } from '@/lib/auth/identite';
import {
  creerPhotoModele,
  deplacerPhotoModele,
  listerPhotosModeles,
  masquerPhotoModele,
  modifierPhotoModele,
} from '@/catalogue/serveur';
import { rayonsDansLOrdre, type ModificationPhoto } from '@/catalogue/photosModeles';
import { signaler } from '@/domaine/messages';
import type { Echec } from '@/domaine/resultat';
import { dossierPhotos, ecrireImageAtomique, normaliserImage, retirerImage } from '@/lib/photosModelesDisque';
import {
  MARGE_ENVELOPPE,
  TAILLE_MAX_IMAGE,
  refusFormatPhoto,
  refusImageManquante,
  refusPhotoTropLourde,
} from '@/components/commande/photosGestion';

const SANS_CACHE = { 'Cache-Control': 'no-store' };

function refus(echec: Echec, route: string) {
  const { corps, statut } = reponseEchec(echec, route);
  return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
}

function erreur(e: unknown, route: string) {
  const { corps, statut } = traiterErreur(e, route);
  return NextResponse.json(corps, { status: statut, headers: SANS_CACHE });
}

function invalide(champLibelle: string, champ: string): Echec {
  return signaler('ERR_SAISIE_INVALIDE', { champLibelle }, { champ });
}

/** Champ texte d'un formulaire (un fichier à la place d'un texte = absent). */
function champTexte(f: FormData, nom: string): string | undefined {
  const v = f.get(nom);
  return typeof v === 'string' ? v : undefined;
}

/** Liste JSON de clés (« ["…supplement-pate-a-sucre"] ») ; absente = aucune. */
function lireListe(brut: string | undefined): unknown {
  if (brut === undefined || brut.trim() === '') return [];
  try {
    return JSON.parse(brut);
  } catch {
    return null; // refusée par le catalogue (ERR_SAISIE_INVALIDE « suppléments »)
  }
}

/* -------------------------------------------------------------------- GET */

export async function GET(request: Request) {
  const garde = exigerRole(request, 'gerant', 'gérer les photos des modèles');
  if (!garde.ok) return garde.reponse;
  const route = 'GET /api/photos-modeles/gestion';
  try {
    const photos = await listerPhotosModeles({ inclureMasquees: true });
    if (!photos.ok) return refus(photos, route);
    return NextResponse.json({ photos: photos.donnees, rayons: rayonsDansLOrdre(photos.donnees) }, { headers: SANS_CACHE });
  } catch (e) {
    return erreur(e, route);
  }
}

/* ------------------------------------------------------------------- POST */

export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'ajouter une photo de modèle');
  if (!garde.ok) return garde.reponse;
  const route = 'POST /api/photos-modeles/gestion';
  try {
    // Trop lourd : refusé AVANT de lire le corps (réseau faible, mémoire du serveur).
    const longueur = Number(request.headers.get('content-length'));
    if (Number.isFinite(longueur) && longueur > TAILLE_MAX_IMAGE + MARGE_ENVELOPPE) return refus(refusPhotoTropLourde(), route);

    let formulaire: FormData;
    try {
      formulaire = await request.formData();
    } catch {
      return refus(invalide('photo', 'image'), route);
    }
    const image = formulaire.get('image');
    if (!(image instanceof Blob) || image.size === 0) return refus(refusImageManquante(), route);
    if (image.size > TAILLE_MAX_IMAGE) return refus(refusPhotoTropLourde(), route);
    // HEIC/HEIF annoncé par le navigateur : refus clair sans même le décoder.
    if (/hei[cf]/i.test(image.type)) return refus(refusFormatPhoto(), route);

    const dossier = dossierPhotos();
    if (!dossier.ok) return refus(dossier, route);
    const normalisee = await normaliserImage(new Uint8Array(await image.arrayBuffer()));
    if (!normalisee.ok) return refus(normalisee, route);

    const produit = champTexte(formulaire, 'produit');
    // Objet (et non `let`) : l'écriture a lieu dans le rappel, lu ensuite ici.
    const ecrite: { nom: string | null } = { nom: null };
    const r = await creerPhotoModele({
      categorie: champTexte(formulaire, 'categorie') ?? '',
      produit: produit && produit.trim() !== '' ? produit.trim() : null,
      supplements: lireListe(champTexte(formulaire, 'supplements')) as string[],
      note: champTexte(formulaire, 'note') ?? null,
      extension: 'jpg',
      // Prénom déclaré par la tablette (pas de comptes par employé), nettoyé.
      creePar: nomDeclare(champTexte(formulaire, 'creePar')),
      enregistrerImage: async (fichier) => {
        await ecrireImageAtomique(dossier.donnees, fichier, normalisee.donnees);
        ecrite.nom = fichier;
      },
    }).catch(async (e: unknown) => {
      if (ecrite.nom) await retirerImage(dossier.donnees, ecrite.nom);
      throw e;
    });
    if (!r.ok) {
      // Image écrite mais ligne refusée par la base : on ne laisse pas d'orpheline.
      if (ecrite.nom) await retirerImage(dossier.donnees, ecrite.nom);
      return refus(r, route);
    }
    return NextResponse.json(r.donnees, { status: 201, headers: SANS_CACHE });
  } catch (e) {
    return erreur(e, route);
  }
}

/* ------------------------------------------------------------------ PATCH */

export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'gerant', 'ranger les photos des modèles');
  if (!garde.ok) return garde.reponse;
  const route = 'PATCH /api/photos-modeles/gestion';
  try {
    let corps: Record<string, unknown>;
    try {
      const brut: unknown = await request.json();
      if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return refus(invalide('modification de la photo', 'action'), route);
      corps = brut as Record<string, unknown>;
    } catch {
      return refus(invalide('modification de la photo', 'action'), route);
    }
    const id = typeof corps.id === 'string' ? corps.id : '';

    switch (corps.action) {
      case 'modifier': {
        // Seuls les champs PRÉSENTS changent ; le catalogue valide chacun.
        const m: ModificationPhoto = {};
        if (corps.categorie !== undefined) m.categorie = corps.categorie as string;
        if (corps.produit !== undefined) m.produit = corps.produit === '' ? null : (corps.produit as string | null);
        if (corps.supplements !== undefined) m.supplements = corps.supplements as string[];
        if (corps.note !== undefined) m.note = corps.note as string | null;
        const r = await modifierPhotoModele(id, m);
        return r.ok ? NextResponse.json(r.donnees, { headers: SANS_CACHE }) : refus(r, route);
      }
      case 'masquer': {
        const r = await masquerPhotoModele(id, corps.masquee as boolean);
        return r.ok ? NextResponse.json(r.donnees, { headers: SANS_CACHE }) : refus(r, route);
      }
      case 'deplacer': {
        const r = await deplacerPhotoModele(id, corps.sens as 'avant' | 'apres');
        return r.ok ? NextResponse.json(r.donnees, { headers: SANS_CACHE }) : refus(r, route);
      }
      default:
        return refus(invalide('modification de la photo', 'action'), route);
    }
  } catch (e) {
    return erreur(e, route);
  }
}
