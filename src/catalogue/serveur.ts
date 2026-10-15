// src/catalogue/serveur.ts
// API du catalogue CÔTÉ SERVEUR : lit les tables ProduitCatalogue / PrixProduit.
// SEUL fichier du module autorisé à toucher Prisma. Ne jamais l'importer
// depuis un composant navigateur.
//
//   getPrixServeur(cleCatalogue, date)  → prix en vigueur à cette date
//   getProduitServeur(cleCatalogue)     → fiche produit (jamais supprimée)
//   listerParCategorieServeur(date)     → rayons au tarif à cette date
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
