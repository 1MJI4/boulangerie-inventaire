// src/catalogue/serveur.ts
// API du catalogue CÔTÉ SERVEUR : lit les tables ProduitCatalogue / PrixProduit.
// SEUL fichier du module autorisé à toucher Prisma. Ne jamais l'importer
// depuis un composant navigateur.
//
//   getPrixServeur(cleCatalogue, date)  → prix en vigueur à cette date
//   getProduitServeur(cleCatalogue)     → fiche produit (jamais supprimée)
//   listerParCategorieServeur(date)     → rayons au tarif à cette date
//   listerPhotosModeles / categoriesPhotosModeles / getPhotoModele,
//   creerPhotoModele / modifierPhotoModele / masquerPhotoModele /
//   deplacerPhotoModele                 → galerie de photos (table PhotoModele)
//
// RÈGLE DU PROPRIÉTAIRE (15/10/2026) : le catalogue de COMMANDE (CSV +
// affiches) et les produits d'INVENTAIRE sont deux mondes séparés. Ce module
// ne lit ni n'écrit JAMAIS la table « Produit » (inventaire). Il vise le modèle
// Prisma « ProduitCatalogue » (schéma `base-donnees`), avec
// PrixProduit.produitId → ProduitCatalogue.id et la relation `prix`.
// Le nom du modèle n'apparaît QUE dans ce fichier (`ClientPrismaCatalogue`).
//
// Mêmes types que l'API pure (src/catalogue/index.ts), enrichis de
// `idBase` / `produitIdBase` (ProduitCatalogue.id) et `prixProduitId`
// (PrixProduit.id) : c'est ce que la route commandes pose sur la ligne pour
// figer le prix appliqué. Conversions dans ./lectureBase.ts (pur, testé).
//
// Pas de repli sur l'ancienne table « Tarif » : base sans catalogue importé
// → ERR_CATALOGUE_ABSENT.

import type { Resultat } from "../domaine/resultat.ts";
import type { OptionsListe } from "./catalogue.ts";
import type { ChampsProduitModifiables, ClientEcritureCatalogue, DepotEcritureCatalogue, PrixAttendu, ProduitAttendu } from "./ecritureBase.ts";
import { creerLecteurBase, dateIsoVersBase, type LecteurCatalogueBase, type ProduitAvecPrixBase, type SourceCatalogueBase } from "./lectureBase.ts";
import type { DateISO, PrixEnVigueurServeur, ProduitServeur, RayonAuTarifServeur } from "./types.ts";
import { aujourdhuiMagasin } from "./lectureBase.ts";
import { creerGaleriePhotos, type CreationAvecImage, type DepotPhotosModeles, type GaleriePhotosBase, type OptionsListePhotos } from "./photosModelesBase.ts";
import type { CatalogueDesPhotos, LignePhotoBase, ModificationPhoto, PhotoModele } from "./photosModeles.ts";
import { signaler } from "../domaine/messages.ts";
import type { Echec } from "../domaine/resultat.ts";
import { journaliser, nouvelleReference } from "../lib/journal.ts";

// ------------------------------------------------------------ Client Prisma
// Typage volontairement minimal : ce module ne dépend que des méthodes qu'il
// appelle. Le client Prisma généré s'y conforme ; les tests passent des faux
// clients en mémoire.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Methode = (args: any) => Promise<any>;
export interface ClientPrismaCatalogue {
  produitCatalogue: { findUnique: Methode; findMany: Methode; count: Methode; update: Methode; createManyAndReturn: Methode };
  prixProduit: { update: Methode; createMany: Methode };
}
export interface ClientPrismaAvecTransaction extends ClientPrismaCatalogue {
  $transaction: (travail: (tx: any) => Promise<any>, options?: { timeout?: number; maxWait?: number }) => Promise<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** true si le client connaît le modèle ProduitCatalogue (garde-fou : client Prisma non régénéré). */
export function connaitProduitCatalogue(client: unknown): client is ClientPrismaAvecTransaction {
  const c = client as Partial<ClientPrismaCatalogue> | null;
  return typeof c?.produitCatalogue?.findMany === "function";
}

const CHAMPS_PRODUIT = {
  id: true,
  cleCatalogue: true,
  nom: true,
  categorie: true,
  sousCategorie: true,
  unite: true,
  regimePrix: true,
  estFavori: true,
  etages: true, // migration 20261015160000 (délai « gâteau à étages »)
  actif: true,
} as const;

const CHAMPS_PRIX = {
  id: true,
  produitId: true,
  prixCentimes: true,
  basePrix: true,
  valideDu: true,
  valideAu: true,
  tauxTvaEmporterPb: true,
  tauxTvaSurPlacePb: true,
  minimum: true,
  minimumParSymbole: true,
  maximum: true,
  versionCode: true,
} as const;

function couvrant(date: Date) {
  return { valideDu: { lte: date }, OR: [{ valideAu: null }, { valideAu: { gte: date } }] };
}

/** Source de lecture branchée sur un client Prisma (ou un client de transaction). */
export function sourcePrisma(client: ClientPrismaCatalogue): SourceCatalogueBase {
  return {
    async lireProduit(cle) {
      return (await client.produitCatalogue.findUnique({
        where: { cleCatalogue: cle },
        select: { ...CHAMPS_PRODUIT, prix: { select: CHAMPS_PRIX, orderBy: { valideDu: "asc" } } },
      })) as ProduitAvecPrixBase | null;
    },
    async lireProduitsAuTarif(date) {
      return (await client.produitCatalogue.findMany({
        where: { prix: { some: couvrant(date) } },
        orderBy: { id: "asc" },
        select: { ...CHAMPS_PRODUIT, prix: { where: couvrant(date), select: CHAMPS_PRIX } },
      })) as ProduitAvecPrixBase[];
    },
    async compterPrixCatalogue() {
      return (await client.produitCatalogue.count({ where: { prix: { some: {} } } })) as number;
    },
  };
}

/** Écriture transactionnelle branchée sur un client Prisma (scripts/importer-catalogue.mjs). */
export function clientEcriturePrisma(client: ClientPrismaAvecTransaction): ClientEcritureCatalogue {
  return {
    transaction(travail) {
      // Plus de 300 produits : délai large, une seule transaction.
      return client.$transaction((tx: ClientPrismaCatalogue) => travail(depotPrisma(tx)), { timeout: 180_000, maxWait: 20_000 });
    },
  };
}

export function depotPrisma(tx: ClientPrismaCatalogue): DepotEcritureCatalogue {
  return {
    async lireProduitsCatalogue() {
      return (await tx.produitCatalogue.findMany({
        orderBy: { id: "asc" },
        select: { ...CHAMPS_PRODUIT, prix: { select: CHAMPS_PRIX, orderBy: { valideDu: "asc" } } },
      })) as ProduitAvecPrixBase[];
    },
    async creerProduits(produits: readonly ProduitAttendu[]) {
      const crees = (await tx.produitCatalogue.createManyAndReturn({
        data: produits.map((p) => ({
          cleCatalogue: p.cle,
          nom: p.nom,
          categorie: p.categorie,
          sousCategorie: p.sousCategorie,
          unite: p.unite,
          regimePrix: p.regimePrix,
          estFavori: p.estFavori,
          etages: p.etages,
          actif: p.actif,
        })),
        select: { id: true, cleCatalogue: true },
      })) as { id: number; cleCatalogue: string }[];
      return new Map(crees.map((c) => [c.cleCatalogue, c.id]));
    },
    async modifierProduit(idBase: number, champs: ChampsProduitModifiables) {
      await tx.produitCatalogue.update({ where: { id: idBase }, data: champs });
    },
    async fermerVersion(prixProduitId: number, valideAu: Date) {
      // Seul valideAu change : prix, base et seuils d'une version restent figés.
      await tx.prixProduit.update({ where: { id: prixProduitId }, data: { valideAu } });
    },
    async insererVersions(lignes: readonly { produitId: number; prix: PrixAttendu }[]) {
      const r = (await tx.prixProduit.createMany({
        data: lignes.map(({ produitId, prix }) => ({
          produitId,
          prixCentimes: prix.prixCentimes,
          basePrix: prix.basePrix,
          valideDu: dateIsoVersBase(prix.valideDu),
          valideAu: prix.valideAu === null ? null : dateIsoVersBase(prix.valideAu),
          minimum: prix.minimum,
          minimumParSymbole: prix.minimumParSymbole,
          maximum: prix.maximum,
          versionCode: prix.versionCode,
          source: prix.source,
          tauxTvaEmporterPb: null, // HYPOTHÈSE À VALIDER : TVA à confirmer par le comptable
          tauxTvaSurPlacePb: null,
          creePar: null, // import, pas une saisie
        })),
      })) as { count: number };
      return r.count;
    },
  };
}

// ------------------------------------------------------------ API (client partagé)

let lecteur: LecteurCatalogueBase | null = null;

/** Source vide : client Prisma sans le modèle ProduitCatalogue (non régénéré). Lecture → ERR_CATALOGUE_ABSENT. */
export const SOURCE_SANS_CATALOGUE: SourceCatalogueBase = {
  lireProduit: async () => null,
  lireProduitsAuTarif: async () => [],
  compterPrixCatalogue: async () => 0,
};

async function lecteurPartage(): Promise<LecteurCatalogueBase> {
  if (!lecteur) {
    // Import paresseux : charger ce module (ex. dans un test) n'ouvre aucune connexion.
    const { prisma } = await import("../lib/prisma.ts");
    if (!connaitProduitCatalogue(prisma)) {
      // Garde-fou : client Prisma généré sans ProduitCatalogue (`prisma generate`
      // non relancé) → catalogue absent. On ne lit SURTOUT PAS « Produit »
      // (inventaire) ni « Tarif » (obsolète). Pas de mise en cache.
      return creerLecteurBase(SOURCE_SANS_CATALOGUE);
    }
    lecteur = creerLecteurBase(sourcePrisma(prisma));
  }
  return lecteur;
}

/** Prix en vigueur à `date` (« AAAA-MM-JJ », jour du magasin). */
export async function getPrixServeur(cleCatalogue: string, date: DateISO): Promise<Resultat<PrixEnVigueurServeur>> {
  return (await lecteurPartage()).getPrix(cleCatalogue, date);
}

/** Fiche produit, même archivée. */
export async function getProduitServeur(cleCatalogue: string): Promise<Resultat<ProduitServeur>> {
  return (await lecteurPartage()).getProduit(cleCatalogue);
}

/** Rayons au tarif à `date`, dans l'ordre d'import ; favoris dans leur rayon réel (LOI 4). */
export async function listerParCategorieServeur(date: DateISO, options?: OptionsListe): Promise<Resultat<RayonAuTarifServeur[]>> {
  return (await lecteurPartage()).listerParCategorie(date, options);
}

// ------------------------------------------------------------ Galerie de photos modèles (table « PhotoModele »)
// Décision du propriétaire (26/10/2026) : le gérant gère lui-même les photos.
// Logique et validations : ./photosModelesBase.ts et ./photosModeles.ts (purs).
// Ici : uniquement le branchement Prisma. Le nom du modèle n'apparaît qu'ici.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ClientPrismaPhotos {
  photoModele: { findMany: Methode; findUnique: Methode; create: Methode; update: Methode };
  $queryRawUnsafe: (sql: string, ...valeurs: unknown[]) => Promise<any>;
}
export interface ClientPrismaPhotosAvecTransaction extends ClientPrismaPhotos {
  $transaction: (travail: (tx: any) => Promise<any>, options?: { timeout?: number; maxWait?: number }) => Promise<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** true si le client connaît le modèle PhotoModele (garde-fou : client Prisma non régénéré). */
export function connaitPhotoModele(client: unknown): client is ClientPrismaPhotosAvecTransaction {
  const c = client as Partial<ClientPrismaPhotos> | null;
  return typeof c?.photoModele?.findMany === "function";
}

const CHAMPS_PHOTO = {
  id: true,
  categorie: true,
  produitCle: true,
  supplements: true,
  note: true,
  masquee: true,
  ordre: true,
  fichier: true,
  creePar: true,
} as const;

/** Requête constante (aucune valeur saisie) : identifiant 'P' + 3 chiffres, atomique entre tablettes. */
const SQL_RESERVER_ID = `SELECT 'P' || lpad(nextval('"PhotoModele_numero_P_seq"')::text, 3, '0') AS id`;

/**
 * Dépôt Prisma de la galerie. `transaction` absent : on est déjà dans une
 * transaction (client `tx`), le travail s'exécute directement.
 */
export function depotPhotosPrisma(client: ClientPrismaPhotos, transaction?: ClientPrismaPhotosAvecTransaction["$transaction"]): DepotPhotosModeles {
  const depot: DepotPhotosModeles = {
    async lirePhotos({ inclureMasquees }) {
      return (await client.photoModele.findMany({
        where: inclureMasquees ? {} : { masquee: false },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
        select: CHAMPS_PHOTO,
      })) as LignePhotoBase[];
    },
    async lirePhoto(id) {
      return (await client.photoModele.findUnique({ where: { id }, select: CHAMPS_PHOTO })) as LignePhotoBase | null;
    },
    async reserverId() {
      const lignes = (await client.$queryRawUnsafe(SQL_RESERVER_ID)) as { id: string }[];
      return lignes[0].id;
    },
    async inserer(ligne) {
      return (await client.photoModele.create({ data: ligne, select: CHAMPS_PHOTO })) as LignePhotoBase;
    },
    async modifier(id, champs) {
      // `modifieLe` : @updatedAt. Jamais l'id (déclencheur ERR_PHOTO_IMMUABLE).
      return (await client.photoModele.update({ where: { id }, data: champs, select: CHAMPS_PHOTO })) as LignePhotoBase;
    },
    async transaction(travail) {
      if (!transaction) return travail(depot);
      return transaction((tx: ClientPrismaPhotos) => travail(depotPhotosPrisma(tx)), { timeout: 20_000, maxWait: 10_000 });
    },
  };
  return depot;
}

let galerie: GaleriePhotosBase | null = null;

/** Contrôle des produits d'une photo : même lecteur que getPrixServeur (catalogue de commande en base). */
const CATALOGUE_DES_PHOTOS: CatalogueDesPhotos = {
  getProduit: async (cle) => (await lecteurPartage()).getProduit(cle),
  getPrix: async (cle, date) => (await lecteurPartage()).getPrix(cle, date),
};

async function galeriePartagee(): Promise<GaleriePhotosBase | Echec> {
  if (galerie) return galerie;
  const { prisma } = await import("../lib/prisma.ts");
  if (!connaitPhotoModele(prisma)) {
    // Client Prisma généré sans PhotoModele (`prisma generate` non relancé) :
    // panne de configuration. AUCUN repli sur la copie figée. Pas de cache.
    const reference = nouvelleReference();
    journaliser({
      niveau: "erreur",
      code: "ERR_CONFIGURATION_SERVEUR",
      route: "catalogue/photos-modeles",
      reference,
      piste: "Client Prisma sans le modèle PhotoModele : relancer `prisma generate` puis redémarrer.",
    });
    return signaler("ERR_CONFIGURATION_SERVEUR", { reference });
  }
  galerie = creerGaleriePhotos(depotPhotosPrisma(prisma, prisma.$transaction.bind(prisma)), CATALOGUE_DES_PHOTOS, {
    aujourdhui: () => aujourdhuiMagasin(),
  });
  return galerie;
}

async function avecGalerie<T>(travail: (g: GaleriePhotosBase) => Promise<Resultat<T>>): Promise<Resultat<T>> {
  const g = await galeriePartagee();
  return "ok" in g ? g : travail(g);
}

/**
 * Photos de la galerie, triées par rayon (ordre des rayons = donnée, voir
 * `rayonsDansLOrdre`), puis ordre, puis identifiant. Par défaut SANS les
 * photos masquées (galerie de la vendeuse) ; `inclureMasquees: true` pour
 * l'écran du gérant. `url` = « /api/modeles/<fichier> ».
 */
export function listerPhotosModeles(options?: OptionsListePhotos): Promise<Resultat<PhotoModele[]>> {
  return avecGalerie((g) => g.listerPhotosModeles(options));
}

/** Rayons dans leur ordre d'affichage (par défaut sans les rayons dont toutes les photos sont masquées). */
export function categoriesPhotosModeles(options?: { inclureMasquees?: boolean }): Promise<Resultat<string[]>> {
  return avecGalerie((g) => g.categoriesPhotosModeles(options));
}

/** Une photo, MÊME MASQUÉE (une ancienne commande peut la citer). Inconnue → ERR_SAISIE_INVALIDE (champ photoModele). */
export function getPhotoModele(id: string): Promise<Resultat<PhotoModele>> {
  return avecGalerie((g) => g.getPhotoModele(id));
}

/** Ajout par le gérant : validation, identifiant 'P…' réservé, image écrite par `enregistrerImage`, puis ligne. */
export function creerPhotoModele(saisie: CreationAvecImage): Promise<Resultat<PhotoModele>> {
  return avecGalerie((g) => g.creerPhotoModele(saisie));
}

/** Rayon, produit, suppléments, note, ordre. Seuls les champs présents changent. */
export function modifierPhotoModele(id: string, modification: ModificationPhoto): Promise<Resultat<PhotoModele>> {
  return avecGalerie((g) => g.modifierPhotoModele(id, modification));
}

/** Masquer (true) ou remettre dans la galerie (false). Jamais de suppression. */
export function masquerPhotoModele(id: string, masquee: boolean): Promise<Resultat<PhotoModele>> {
  return avecGalerie((g) => g.masquerPhotoModele(id, masquee));
}

/** Boutons ◀ ▶ : échange avec la voisine du rayon. Renvoie le rayon entier (masquées comprises), dans le nouvel ordre. */
export function deplacerPhotoModele(id: string, sens: "avant" | "apres"): Promise<Resultat<PhotoModele[]>> {
  return avecGalerie((g) => g.deplacerPhotoModele(id, sens));
}
