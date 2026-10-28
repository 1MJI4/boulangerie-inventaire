// src/components/commande/galerie.ts
//
// Galerie de photos de modèles dans l'écran de commande (décision du
// propriétaire, 26/10/2026 ; propriétaire de l'écran : `commandes-traiteur`).
// Le client montre une photo, la vendeuse la touche : l'application ajoute le
// produit comme un toucher de sa carte (`toucherProduit`) s'il n'est pas déjà
// au bon — sinon la photo se pose sur sa ligne, SANS rien ajouter — et la
// ligne retient l'identifiant de la photo (« G043 »), imprimé sur le bon.
//
// AUCUNE règle de prix ni de minimum ici : les photos sont une DONNÉE gérée
// par le gérant (table « PhotoModele », lue par GET /api/photos-modeles) ; le
// domaine juge ensuite la ligne comme n'importe quelle autre (taille, goût, forme, Pâte à sucre…).
// Le supplément « Photo » n'est JAMAIS ajouté d'office (note du catalogue :
// « SUPP PHOTO » décrit le modèle, pas la commande du client).
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import type { RegleSupplementParPersonne } from '../../domaine/constantes.ts';
import type { CorrespondanceComptoir } from '../../domaine/prixComptoir.ts';
import type { PhotoModele } from '../../catalogue/photosModeles.ts';
import {
  basculerSupplementParPersonne,
  estFicheGateau,
  gateauSansTaille,
  toucherProduit,
  type CatalogueCommande,
  type ChampTouche,
  type FicheCatalogue,
  type LigneEcran,
} from './modele.ts';

// Lecture de l'identifiant reçu par la route : ./photosGestion.ts (`lirePhotoDeLigne`,
// contrôlé contre la base, photo masquée comprise).

export type ToucherPhoto = { lignes: LigneEcran[]; cle: string; champ: ChampTouche };

/**
 * Pose la photo sur le produit de la fiche. Poser une photo n'ajoute JAMAIS
 * de quantité (audit du 28/10/2026 : Bûche 6P à 1 → photo → restait 1, pas 2 ;
 * 10 mini-burgers → 10, pas 11) :
 * - produit déjà au bon sur une ligne SANS photo (ou avec cette même photo) :
 *   la photo s'y pose, quantité inchangée ;
 * - produit déjà au bon, mais chaque ligne porte une AUTRE photo (deux gâteaux
 *   différents du même produit) : nouvelle ligne, jamais d'écrasement ;
 * - produit absent du bon : ajouté comme un toucher de sa carte (`toucherProduit`).
 * GÂTEAU (une ligne par gâteau, propriétaire, 28/10/2026) : la photo se pose
 * sur le DERNIER gâteau de ce produit qui n'a pas encore de photo (le gâteau
 * qu'on est en train de décrire — c'est aussi le seul moyen de donner une
 * photo à un gâteau déjà au bon), ou sur un gâteau encore sans taille qui
 * porte déjà cette photo (double toucher). Sinon — tous ses gâteaux ont une
 * photo, même celle-ci — c'est un NOUVEAU gâteau, jamais « 2 × ».
 * Même règle pour la photo « en attente » posée sur le prochain produit touché.
 * - Suppléments du modèle : seuls les suppléments PAR PERSONNE (Pâte à sucre,
 *   R64) sont cochés, par le mécanisme de la case du bloc gâteau ; le domaine
 *   juge ensuite (20 parts minimum, carré ou Layer) avec ses sorties. Le
 *   supplément Photo / Écriture n'est jamais ajouté d'office.
 */
export function ajouterAvecPhoto(
  lignes: readonly LigneEcran[],
  fiche: FicheCatalogue,
  photo: Pick<PhotoModele, 'id' | 'supplements'>,
  catalogue: CatalogueCommande | null,
  famillesGateau: readonly string[],
  regles: Readonly<Record<string, RegleSupplementParPersonne>>,
  table: readonly CorrespondanceComptoir[],
): ToucherPhoto {
  // Même repérage que `toucherProduit` (gâteau devenu celui du comptoir compris, R60).
  const duProduit = lignes.filter((l) => l.produitId === fiche.produit.id || l.origineSurCommande === fiche.produit.id);
  const derniers = [...duProduit].reverse();
  const cible = estFicheGateau(fiche, famillesGateau)
    ? (derniers.find((l) => !l.photoModele) ?? derniers.find((l) => l.photoModele === photo.id && gateauSansTaille(l)))
    : (duProduit.find((l) => l.photoModele === photo.id) ?? duProduit.find((l) => !l.photoModele));
  let t: ToucherPhoto;
  if (cible) {
    // Champ à ouvrir comme un toucher de la carte, mais AUCUNE quantité ajoutée.
    t = { lignes: [...lignes], cle: cible.cle, champ: toucherProduit([cible], fiche, famillesGateau).champ };
  } else if (duProduit.length > 0) {
    const neuve = toucherProduit([], fiche, famillesGateau);
    t = { lignes: [...lignes, ...neuve.lignes], cle: neuve.cle, champ: neuve.champ };
  } else {
    t = toucherProduit(lignes, fiche, famillesGateau);
  }
  let suivantes = t.lignes.map((l) => (l.cle === t.cle ? { ...l, photoModele: photo.id } : l));
  for (const s of photo.supplements ?? []) {
    if (!regles[s]) continue; // Photo, Écriture : jamais d'office.
    suivantes = basculerSupplementParPersonne(suivantes, s, true, catalogue, famillesGateau, regles, table);
  }
  return { ...t, lignes: suivantes };
}

/** Retire la photo d'une ligne (la ligne reste au bon). */
export function retirerPhoto(lignes: readonly LigneEcran[], cle: string): LigneEcran[] {
  return lignes.map((l) => (l.cle === cle ? { ...l, photoModele: null } : l));
}

/** Fiche du produit désigné par la photo, au catalogue reçu (date de prise) ; null : la vendeuse choisit. */
export function ficheDePhoto(catalogue: CatalogueCommande | null, photo: Pick<PhotoModele, 'produit'>): FicheCatalogue | null {
  if (!catalogue || photo.produit === null) return null;
  return catalogue.fiches.find((f) => f.produit.id === photo.produit) ?? null;
}

// ---------------------------------------------------------------------------
// Photo sans produit unique (bûches, tartes, mini-pâtisseries)
// ---------------------------------------------------------------------------
// La galerie se ferme, la grille est filtrée sur une recherche qui montre les
// produits possibles, et la photo est GARDÉE EN ATTENTE : elle se pose sur le
// prochain produit touché (jamais sur un supplément), puis l'attente s'efface.
// Un bandeau visible (vignette + « Annuler la photo ») le rappelle tant qu'elle
// attend, et la photo reste retirable de la ligne : rien ne se pose en silence.
//
// Navigation = simple AIDE D'AFFICHAGE (quelle recherche taper à la place de la
// vendeuse), pas une règle : aucun produit n'est déduit d'un nom.

/** Recherche et consigne par rayon de la galerie. Rayon absent : son nom sert de recherche. */
const NAVIGATION_RAYON: Readonly<Record<string, { recherche: string; consigne: string }>> = {
  'Bûches': { recherche: 'bûche', consigne: 'Choisissez la taille de la bûche' },
  'Tartes': { recherche: 'tarte', consigne: 'Choisissez la tarte et sa taille' },
  'Mini-pâtisseries': { recherche: 'mini', consigne: 'Choisissez la mini-pâtisserie' },
};

export function navigationPourPhoto(photo: Pick<PhotoModele, 'categorie' | 'produit'>): { recherche: string; consigne: string } {
  const nav = NAVIGATION_RAYON[photo.categorie];
  if (nav && photo.produit === null) return nav;
  return { recherche: nav?.recherche ?? photo.categorie, consigne: `Choisissez le produit (${photo.categorie})` };
}
