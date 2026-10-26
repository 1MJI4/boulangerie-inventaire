// src/catalogue/photosModeles.ts
//
// Galerie de photos de modèles — règles PURES (types, contrôles, ordre).
// Propriétaire : agent `catalogue-prix`.
//
// Le client montre une photo, la vendeuse la touche, l'application choisit le
// produit du catalogue de commande ; le bon imprimé indique seulement
// « Photo sélectionnée : G043 » (aucune image imprimée).
//
// SOURCE DE VÉRITÉ (décision du propriétaire, 26/10/2026 : le gérant gère
// lui-même les photos) : la table « PhotoModele » en base, reprise des 152
// photos par la migration 20261026150000_galerie_photos_en_base. Ce fichier
// ne contient AUCUNE photo : seulement ce qui se vérifie sans base, pour que
// chaque refus soit dit en français AVANT d'écrire (LOI 9 — jamais d'erreur
// PostgreSQL brute). Accès base : ./photosModelesBase.ts (logique) et
// ./serveur.ts (Prisma).
//
// Utilisable dans le navigateur (aucun import node:, aucun Prisma).
//
// AUCUN PRIX dans une photo (LOI 1) : ni dans la note, ni ailleurs. Une note
// « SUPP PHOTO » n'ajoute PAS le supplément photo : elle décrit le modèle,
// pas la commande du client.

import { signaler } from "../domaine/messages.ts";
import { succes, type Echec, type Resultat } from "../domaine/resultat.ts";
import type { DateISO, Famille } from "./types.ts";

// ------------------------------------------------------------ Types

/** Une photo de la galerie, telle que la lisent les écrans. */
export interface PhotoModele {
  /** Identifiant imprimé sur le bon : « G043 », « S005 », « P001 » (photo ajoutée par le gérant). */
  id: string;
  /** Adresse de l'image, servie par l'application : `/api/modeles/<fichier>`. */
  url: string;
  /** Clé du produit au catalogue de commande ; null = la vendeuse choisit le produit. */
  produit: string | null;
  /** Rayon de la galerie (libellé du gérant, à la lettre). */
  categorie: string;
  /**
   * Suppléments qui font partie du modèle (clés du catalogue). TOUJOURS
   * présent (éventuellement vide) dans ce que renvoie l'API ; marqué
   * facultatif seulement pour que galerie.test.ts (`commandes-traiteur`)
   * compile tel quel. À rendre obligatoire avec le retrait de la copie figée.
   */
  supplements?: readonly string[];
  /** Note courte pour la vendeuse. Jamais de prix. */
  note: string | null;
  /** Retirée de la galerie, gardée pour les commandes qui la citent. */
  masquee: boolean;
  /** Rang dans le rayon (croissant ; égalité départagée par l'identifiant). */
  ordre: number;
  /**
   * @deprecated Présent UNIQUEMENT sur la copie figée de ./photosModelesReprise.ts
   * (ancien chemin `/modeles/G043.jpg`). Utiliser `url`. Sera retiré avec elle.
   */
  fichier?: string;
}

/** Ligne de la table « PhotoModele » (colonnes lues). */
export interface LignePhotoBase {
  id: string;
  categorie: string;
  produitCle: string | null;
  supplements: string[];
  note: string | null;
  masquee: boolean;
  ordre: number;
  fichier: string;
  creePar: string | null;
}

/** Ajout d'une photo par le gérant. */
export interface SaisieCreationPhoto {
  categorie: string;
  produit: string | null;
  supplements?: readonly string[];
  note?: string | null;
  /** Extension de l'image reçue : jpg, jpeg, png ou webp. Le nom du fichier est `<id>.<extension>`. */
  extension: string;
  /** Prénom déclaré de la personne qui ajoute la photo (pas de comptes par employé). */
  creePar: string;
}

/** Modification d'une photo existante : seuls les champs présents changent. */
export interface ModificationPhoto {
  categorie?: string;
  produit?: string | null;
  supplements?: readonly string[];
  note?: string | null;
  ordre?: number;
}

// ------------------------------------------------------------ Données de forme (alignées sur les CHECK de la migration)

/** CHECK PhotoModele_id_format (et LigneCommande_photoModele_format). */
export const FORMAT_ID_PHOTO = /^[A-Z][0-9]{3}$/;
/** CHECK PhotoModele_fichier_valide (+ `left(fichier, 4) = id`). */
export const FORMAT_FICHIER_PHOTO = /^[A-Z][0-9]{3}([-_][A-Za-z0-9]+)*\.(jpg|jpeg|png|webp)$/i;
export const EXTENSIONS_PHOTO = ["jpg", "jpeg", "png", "webp"] as const;
export const LONGUEUR_MAX_RAYON = 60;
export const LONGUEUR_MAX_NOTE = 120;
export const LONGUEUR_MAX_PRENOM = 60;
/** Garde-fou : un modèle ne porte que quelques suppléments. */
export const SUPPLEMENTS_MAX = 10;
/** Ordre explicite maximal (colonne integer ; largement au-dessus de ×10 par photo). */
export const ORDRE_MAX = 1_000_000;
/** Écart entre deux rangs (comme la reprise : rang × 10). */
export const PAS_ORDRE = 10;

/** Préfixe de l'adresse servie par l'application (route écrite par `commandes-traiteur`). */
export const PREFIXE_URL_PHOTO = "/api/modeles/";

const CARACTERE_DE_CONTROLE = /[\u0000-\u001f\u007f]/;

// ------------------------------------------------------------ Conversions

export function urlDeFichier(fichier: string): string {
  return PREFIXE_URL_PHOTO + fichier;
}

export function photoDepuisBase(l: LignePhotoBase): PhotoModele {
  return {
    id: l.id,
    url: urlDeFichier(l.fichier),
    produit: l.produitCle,
    categorie: l.categorie,
    supplements: [...l.supplements],
    note: l.note,
    masquee: l.masquee,
    ordre: l.ordre,
  };
}

// ------------------------------------------------------------ Contrôles de champ

function invalide(champLibelle: string, champ: string, valeurProposee?: unknown): Echec {
  return signaler("ERR_SAISIE_INVALIDE", { champLibelle }, valeurProposee === undefined ? { champ } : { champ, valeurProposee });
}

/** Identifiant de photo reçu (format seulement ; l'existence se vérifie en base). */
export function validerIdPhoto(v: unknown, champ = "photoModele"): Resultat<string> {
  if (typeof v === "string" && FORMAT_ID_PHOTO.test(v)) return succes(v);
  return invalide("photo du modèle", champ);
}

/**
 * La note contient-elle un prix ? (LOI 1 : jamais de prix dans une photo.)
 *
 * RÈGLE RETENUE (la plus sûre qui laisse passer « 2 étages ») :
 *  - refusé : « € », « euro » (même au milieu d'un mot, comme la base :
 *    CHECK PhotoModele_note_valide `!~* 'euro'`) ;
 *  - refusé : un nombre suivi d'une unité monétaire — « eur », « ct », « cts »,
 *    « cent(s) », « centime(s) » (« 5 eur », « 50cts ») ;
 *  - refusé : un nombre à virgule ou à point (« 6,5 », « 3.90 ») : les notes
 *    de prix du propriétaire s'écrivent ainsi (« 6,5 » sur une photo du tri) ;
 *  - accepté : tout autre chiffre (« 2 étages », « 20 parts », « chiffre 18 »).
 * HYPOTHÈSE À VALIDER (docs/QUESTIONS-GERANT.md, question 81) : un nombre décimal
 * légitime dans une note (« 1,5 kg ») est refusé.
 */
export function noteContientUnPrix(note: string): boolean {
  if (/€|euro/i.test(note)) return true;
  if (/\d\s*(?:eur|cts?\b|cents?\b|centimes?\b)/i.test(note)) return true;
  if (/\d\s*[.,]\s*\d/.test(note)) return true;
  return false;
}

/** Note : vide → aucune note (null) ; sinon ≤ 120 caractères, sans prix. Espaces de bord retirés. */
export function validerNotePhoto(v: unknown): Resultat<string | null> {
  if (v === undefined || v === null) return succes(null);
  if (typeof v !== "string") return invalide("note", "note");
  const note = v.trim();
  if (note === "") return succes(null);
  if (CARACTERE_DE_CONTROLE.test(note)) return invalide("note", "note");
  if (note.length > LONGUEUR_MAX_NOTE) return invalide("note", "note", note.slice(0, LONGUEUR_MAX_NOTE).trim());
  if (noteContientUnPrix(note)) return invalide("note", "note");
  return succes(note);
}

/**
 * Rayon : non vide, ≤ 60 caractères. Si un rayon existant ne diffère que par
 * les majuscules ou les espaces (« bavarois » / « Bavarois »), refus avec le
 * rayon existant en sortie en un geste : on ne crée pas un doublon de rayon,
 * et on ne corrige pas en silence (LOI 5).
 */
export function validerRayonPhoto(v: unknown, rayonsExistants: readonly string[] = []): Resultat<string> {
  if (typeof v !== "string" || v.trim() === "") return signaler("ERR_CHAMP_OBLIGATOIRE", { champLibelle: "rayon" }, { champ: "categorie" });
  const rayon = v.trim();
  if (CARACTERE_DE_CONTROLE.test(rayon) || rayon.length > LONGUEUR_MAX_RAYON) return invalide("rayon", "categorie");
  if (!rayonsExistants.includes(rayon)) {
    const cle = cleRayon(rayon);
    const proche = rayonsExistants.find((r) => cleRayon(r) === cle);
    if (proche !== undefined) return invalide("rayon", "categorie", proche);
  }
  return succes(rayon);
}

function cleRayon(r: string): string {
  return r.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

/** Prénom déclaré : obligatoire pour une photo ajoutée (traçabilité), ≤ 60 caractères. */
export function validerPrenomPhoto(v: unknown): Resultat<string> {
  if (typeof v !== "string" || v.trim() === "") return signaler("ERR_CHAMP_OBLIGATOIRE", { champLibelle: "prénom" }, { champ: "creePar" });
  const prenom = v.trim();
  if (CARACTERE_DE_CONTROLE.test(prenom) || prenom.length > LONGUEUR_MAX_PRENOM) return invalide("prénom", "creePar");
  return succes(prenom);
}

/** Extension de l'image reçue → nom de fichier `<id>.<extension>` (minuscules). */
export function nomFichierPhoto(id: string, extension: unknown): Resultat<string> {
  const ext = typeof extension === "string" ? extension.trim().replace(/^\./, "").toLowerCase() : "";
  if (!(EXTENSIONS_PHOTO as readonly string[]).includes(ext)) return invalide("image (JPEG, PNG ou WebP)", "fichier");
  const fichier = `${id}.${ext}`;
  if (!validerFichierPhoto(id, fichier)) return invalide("image (JPEG, PNG ou WebP)", "fichier");
  return succes(fichier);
}

/** Nom de fichier conforme au CHECK de la base (nom simple, commence par l'id). */
export function validerFichierPhoto(id: string, fichier: string): boolean {
  return FORMAT_ID_PHOTO.test(id) && FORMAT_FICHIER_PHOTO.test(fichier) && fichier.slice(0, 4) === id;
}

/** Ordre explicite : entier entre 0 et ORDRE_MAX. */
export function validerOrdrePhoto(v: unknown): Resultat<number> {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= ORDRE_MAX) return succes(v);
  return invalide("ordre", "ordre");
}

// ------------------------------------------------------------ Rattachement au catalogue

/**
 * Ce que le contrôle du rattachement lit au catalogue de commande. Le lecteur
 * serveur (./lectureBase.ts) s'y conforme ; les tests branchent le catalogue
 * des fichiers de data/.
 */
export interface CatalogueDesPhotos {
  getProduit(cle: string): Promise<Resultat<{ produit: string; famille: Famille; actif?: boolean }>> | Resultat<{ produit: string; famille: Famille; actif?: boolean }>;
  getPrix(cle: string, date: DateISO): Promise<Resultat<unknown>> | Resultat<unknown>;
}

/** Produit vendable aujourd'hui : présent, non archivé, avec un prix à `date`. */
async function verifierAuTarif(catalogue: CatalogueDesPhotos, cle: string, date: DateISO, champ: string): Promise<Resultat<Famille>> {
  const p = await catalogue.getProduit(cle);
  if (!p.ok) return { ...p, champ };
  if (p.donnees.actif === false) return signaler("ERR_PRODUIT_INCONNU", {}, { champ });
  const prix = await catalogue.getPrix(cle, date);
  if (!prix.ok) return { ...prix, champ };
  return succes(p.donnees.famille);
}

/**
 * Produit et suppléments d'une photo, contrôlés au catalogue de commande à
 * `date` (jour du magasin). LOI 10 : seul le catalogue de commande est lu,
 * jamais la liste d'inventaire.
 *  - produit : null (la vendeuse choisit) ou produit au tarif, qui n'est PAS un supplément ;
 *  - suppléments : produits au tarif de la famille « supplement », sans doublon.
 * Refus : celui du catalogue (ERR_PRODUIT_INCONNU, ERR_TARIF_ABSENT,
 * ERR_CATALOGUE_ABSENT, ERR_PRODUIT_SANS_REGIME), pointé sur le champ ;
 * ERR_SAISIE_INVALIDE si un supplément est cité comme produit, ou l'inverse.
 */
export async function validerRattachementPhoto(
  catalogue: CatalogueDesPhotos,
  produit: unknown,
  supplements: unknown,
  date: DateISO,
): Promise<Resultat<{ produit: string | null; supplements: string[] }>> {
  let cleProduit: string | null = null;
  if (produit !== null && produit !== undefined && produit !== "") {
    if (typeof produit !== "string") return invalide("produit du modèle", "produit");
    const r = await verifierAuTarif(catalogue, produit, date, "produit");
    if (!r.ok) return r;
    if (r.donnees === "supplement") return invalide("produit du modèle", "produit");
    cleProduit = produit;
  }
  const liste = supplements === undefined || supplements === null ? [] : supplements;
  if (!Array.isArray(liste) || liste.length > SUPPLEMENTS_MAX || liste.some((s) => typeof s !== "string" || s === "")) {
    return invalide("suppléments", "supplements");
  }
  const uniques = [...new Set(liste as string[])];
  if (uniques.length !== liste.length) return invalide("suppléments", "supplements", uniques);
  for (const s of uniques) {
    const r = await verifierAuTarif(catalogue, s, date, "supplements");
    if (!r.ok) return r;
    if (r.donnees !== "supplement") return invalide("suppléments", "supplements", uniques.filter((x) => x !== s));
  }
  return succes({ produit: cleProduit, supplements: uniques });
}

// ------------------------------------------------------------ Ordre d'affichage

type Ordonnable = { id: string; categorie: string; ordre: number };

function parOrdre(a: Ordonnable, b: Ordonnable): number {
  return a.ordre - b.ordre || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Rayons dans leur ordre d'affichage. DONNÉE : un rayon se place au plus petit
 * `ordre` de ses photos. La reprise numérote toute la galerie d'un seul tenant
 * (rang × 10, dans l'ordre du tri du propriétaire), ce qui redonne exactement
 * l'ordre actuel des rayons (Bavarois, Crème fraîche, Entremet…). Un rayon
 * créé par le gérant se place à la fin. Égalité : ordre alphabétique (fr).
 */
export function rayonsDansLOrdre(photos: readonly Ordonnable[]): string[] {
  const premier = new Map<string, number>();
  for (const p of photos) {
    const o = premier.get(p.categorie);
    if (o === undefined || p.ordre < o) premier.set(p.categorie, p.ordre);
  }
  return [...premier].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "fr")).map(([r]) => r);
}

/** Photos triées : rayon (ordre ci-dessus), puis ordre, puis identifiant. */
export function trierPhotos<T extends Ordonnable>(photos: readonly T[]): T[] {
  const rang = new Map(rayonsDansLOrdre(photos).map((r, i) => [r, i]));
  return [...photos].sort((a, b) => rang.get(a.categorie)! - rang.get(b.categorie)! || parOrdre(a, b));
}

/**
 * Ordre d'une photo posée en FIN de rayon. Rayon nouveau : après toute la
 * galerie (le rayon apparaît en dernier).
 */
export function ordreEnFinDeRayon(photos: readonly Ordonnable[], categorie: string, exclure?: string): number {
  const autres = photos.filter((p) => p.id !== exclure);
  const duRayon = autres.filter((p) => p.categorie === categorie);
  const base = duRayon.length > 0 ? duRayon : autres;
  const max = base.reduce((m, p) => Math.max(m, p.ordre), -PAS_ORDRE);
  return Math.min(max + PAS_ORDRE, ORDRE_MAX);
}

/**
 * Boutons ◀ ▶ de l'écran du gérant : la photo échange sa place avec sa
 * voisine du rayon (photos masquées comprises, pour que l'ordre reste le même
 * qu'on les affiche ou non). Le rayon est renuméroté à partir de son plus
 * petit ordre, de 10 en 10 : la place du rayon dans la galerie ne bouge pas,
 * et deux photos à égalité ne bloquent jamais le déplacement.
 * Renvoie seulement les photos dont l'ordre change ([] : déjà au bout).
 */
export function planDeplacement(
  photosDuRayon: readonly Ordonnable[],
  id: string,
  sens: "avant" | "apres",
): { id: string; ordre: number }[] {
  const triees = [...photosDuRayon].sort(parOrdre);
  const i = triees.findIndex((p) => p.id === id);
  const j = sens === "avant" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= triees.length) return [];
  [triees[i], triees[j]] = [triees[j], triees[i]];
  const base = Math.min(...photosDuRayon.map((p) => p.ordre));
  return triees.flatMap((p, k) => {
    const ordre = base + k * PAS_ORDRE;
    return ordre === p.ordre ? [] : [{ id: p.id, ordre }];
  });
}

// ------------------------------------------------------------ Compatibilité (temporaire)
// @deprecated — copie figée, voir ./photosModelesReprise.ts.
export { PHOTOS_MODELES, categoriesPhotosModeles } from "./photosModelesReprise.ts";
export type { PhotoModeleReprise } from "./photosModelesReprise.ts";
