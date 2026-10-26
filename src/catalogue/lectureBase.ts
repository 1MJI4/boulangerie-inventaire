// src/catalogue/lectureBase.ts
// Lecture du catalogue ENREGISTRÉ EN BASE (tables ProduitCatalogue / PrixProduit) et
// conversion vers les types de l'API pure. Propriétaire : `catalogue-prix`.
//
// Aucun import de Prisma ici : la base est atteinte par une `SourceCatalogueBase`
// reçue en paramètre (implémentée avec Prisma dans ./serveur.ts, par un faux
// en mémoire dans les tests). Toute la logique est donc testable sans base.
//
// Pas de repli silencieux : si la base n'a encore aucun catalogue importé,
// la lecture échoue en ERR_CATALOGUE_ABSENT (distinct de ERR_TARIF_ABSENT,
// qui vise un produit sans prix à une date). On ne lit JAMAIS l'ancienne
// table « Tarif » (prix écrasés sur place, sans date d'effet).
// Produit sans régime de prix (LOI 6) → ERR_PRODUIT_SANS_REGIME.
//
// Champs du type `Produit` / `LignePrix` NON STOCKÉS en base (migration
// 20261015110000) et donc reconstruits ici :
//   grille            ← régime : A → « comptoir », B/C → « sur-commande »
//                       (vérifié sur tout le catalogue par base.test.ts)
//   famille           ← catégorie + nom, par les tables de ./familles.ts
//                       (« supplement » si listé dans PRODUITS_SUPPLEMENT ;
//                       même règle qu'à l'import, vérifiée par base.test.ts)
//   prixEstPlancher   ← régime C ET base « personne » ou « piece », hors
//                       supplément (prix fixe, même par personne : Pâte à sucre)
//                       (même règle que l'import des affiches, vérifiée par test)
//   typeMin           ← « bloquant » dès qu'un minimum existe (LOI 7)
//   estFavori (ligne) ← Produit.estFavori (non versionné en base)
//   variantes         ← [] · variantesFermees ← false
//   maxParUnite.objet ← "" · rapprochementComptoir ← []
//   etages            ← ProduitCatalogue.etages (migration 20261015160000),
//                       sur la FICHE produit et non sur la version de prix :
//                       le délai « gâteau à étages » (5 jours ouvrés) en dépend.
// HYPOTHÈSE À VALIDER : les autres champs vides ci-dessus ne servent ni au calcul du
// prix ni aux minimums ; ils sont vides côté serveur tant que la base ne les
// porte pas (dépendance `base-donnees`, voir rapport du lot 2).

import { echecDateIllisible, echecProduitInconnu, echecTarifAbsent } from "./catalogue.ts";
import { estSupplement, familleDuProduit } from "./familles.ts";
import { signaler } from "../domaine/messages.ts";
import { estDateISO } from "./normaliser.ts";
import { succes, type Resultat } from "../domaine/resultat.ts";
import type {
  BasePrix,
  DateISO,
  Grille,
  PrixEnVigueurServeur,
  ProduitAuTarifServeur,
  ProduitServeur,
  RayonAuTarifServeur,
  RegimePrix,
  TauxTva,
  Unite,
} from "./types.ts";
import type { OptionsListe } from "./catalogue.ts";

// ------------------------------------------------------------ Lignes brutes

/** Colonnes lues dans « ProduitCatalogue » (jamais « Produit », qui est l'inventaire). */
export interface LigneProduitBase {
  id: number;
  cleCatalogue: string;
  nom: string;
  categorie: string;
  sousCategorie: string | null;
  unite: Unite;
  regimePrix: RegimePrix | null;
  estFavori: boolean;
  /** Étages de l'affiche (mariage, pièce montée), NULL sinon. */
  etages: number | null;
  actif: boolean;
}

/** Colonnes lues dans "PrixProduit". Dates @db.Date = minuit UTC. */
export interface LignePrixBase {
  id: number;
  produitId: number;
  prixCentimes: number;
  basePrix: BasePrix;
  valideDu: Date;
  valideAu: Date | null;
  tauxTvaEmporterPb: number | null;
  tauxTvaSurPlacePb: number | null;
  minimum: number | null;
  minimumParSymbole: number | null;
  maximum: number | null;
  versionCode: string | null;
}

export type ProduitAvecPrixBase = LigneProduitBase & { prix: LignePrixBase[] };

/** Accès à la base, en lecture seule. */
export interface SourceCatalogueBase {
  /** Produit du catalogue par sa clé, avec TOUTES ses versions de prix ; null si absent. */
  lireProduit(cleCatalogue: string): Promise<ProduitAvecPrixBase | null>;
  /**
   * Produits du catalogue ayant une version couvrant `date` (bornes incluses),
   * triés par ProduitCatalogue.id (= ordre d'import), chacun avec cette seule version.
   */
  lireProduitsAuTarif(date: Date): Promise<ProduitAvecPrixBase[]>;
  /** Nombre de versions de prix des produits du catalogue (0 = jamais importé). */
  compterPrixCatalogue(): Promise<number>;
}

// ------------------------------------------------------------ Conversions

/** « AAAA-MM-JJ » → Date à minuit UTC (forme attendue par une colonne @db.Date). */
export function dateIsoVersBase(date: DateISO): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Colonne @db.Date (minuit UTC) → « AAAA-MM-JJ ». */
export function dateBaseVersIso(date: Date): DateISO {
  return date.toISOString().slice(0, 10);
}

/** Grille déduite du régime (la base ne stocke pas la grille). */
export function grilleDuRegime(regime: RegimePrix): Grille {
  return regime === "A" ? "comptoir" : "sur-commande";
}

/**
 * Régime C : prix par personne ou par mini-pièce = plancher « à partir de »,
 * SAUF un supplément (liste de ./familles.ts) : prix fixe, même par personne
 * (Pâte à sucre). Même règle que l'import des affiches.
 */
export function prixEstPlancherDepuisBase(regime: RegimePrix, basePrix: BasePrix, supplement: boolean): boolean {
  return !supplement && regime === "C" && (basePrix === "personne" || basePrix === "piece");
}

function tauxTvaDepuisBase(l: LignePrixBase): TauxTva | null {
  if (l.tauxTvaEmporterPb === null || l.tauxTvaSurPlacePb === null) return null;
  return { aEmporterPb: l.tauxTvaEmporterPb, surPlacePb: l.tauxTvaSurPlacePb };
}

/** Version la plus récente (pour la TVA d'une fiche produit sans date). */
function plusRecente(prix: readonly LignePrixBase[]): LignePrixBase | undefined {
  return [...prix].sort((a, b) => b.valideDu.getTime() - a.valideDu.getTime())[0];
}

export function produitDepuisBase(p: LigneProduitBase & { regimePrix: RegimePrix }, tva: TauxTva | null): ProduitServeur {
  return {
    id: p.cleCatalogue,
    idBase: p.id,
    actif: p.actif,
    grille: grilleDuRegime(p.regimePrix),
    categorie: p.categorie,
    produit: p.nom,
    sousCategorie: p.sousCategorie ?? "",
    regimePrix: p.regimePrix,
    unite: p.unite,
    estFavori: p.estFavori,
    famille: familleDuProduit(grilleDuRegime(p.regimePrix), p.categorie, p.nom),
    tauxTva: tva,
    variantes: [],
    variantesFermees: false,
  };
}

export function prixDepuisBase(p: LigneProduitBase & { regimePrix: RegimePrix }, l: LignePrixBase): PrixEnVigueurServeur {
  const aUnMinimum = l.minimum !== null || l.minimumParSymbole !== null;
  return {
    produitId: p.cleCatalogue,
    produitIdBase: p.id,
    prixProduitId: l.id,
    versionCode: l.versionCode ?? "",
    valideDu: dateBaseVersIso(l.valideDu),
    valideAu: l.valideAu === null ? null : dateBaseVersIso(l.valideAu),
    prixCentimes: l.prixCentimes,
    basePrix: l.basePrix,
    prixEstPlancher: prixEstPlancherDepuisBase(p.regimePrix, l.basePrix, estSupplement(grilleDuRegime(p.regimePrix), p.categorie, p.nom)),
    estFavori: p.estFavori,
    minQuantite: l.minimum,
    minParSymbole: l.minimumParSymbole,
    typeMin: aUnMinimum ? "bloquant" : null,
    maxParUnite: l.maximum === null ? null : { valeur: l.maximum, objet: "" },
    // `?? null` : ligne lue par un client Prisma généré avant la colonne.
    etages: p.etages ?? null,
    rapprochementComptoir: [],
    tauxTva: tauxTvaDepuisBase(l),
  };
}

function couvre(l: LignePrixBase, date: DateISO): boolean {
  const du = dateBaseVersIso(l.valideDu);
  const au = l.valideAu === null ? null : dateBaseVersIso(l.valideAu);
  return du <= date && (au === null || date <= au);
}

function aUnRegime(p: LigneProduitBase): p is LigneProduitBase & { regimePrix: RegimePrix } {
  return p.regimePrix !== null;
}

/** Aucun tarif importé sur le serveur. */
function echecCatalogueAbsent() {
  return signaler("ERR_CATALOGUE_ABSENT", {});
}

/** Produit présent mais sans régime de prix : invendable (LOI 6). */
function echecSansRegime(p: LigneProduitBase) {
  return signaler("ERR_PRODUIT_SANS_REGIME", { produit: p.nom }, { champ: "produitId" });
}

// ------------------------------------------------------------ API serveur

export interface LecteurCatalogueBase {
  getPrix(cleCatalogue: string, date: DateISO): Promise<Resultat<PrixEnVigueurServeur>>;
  getProduit(cleCatalogue: string): Promise<Resultat<ProduitServeur>>;
  listerParCategorie(date: DateISO, options?: OptionsListe): Promise<Resultat<RayonAuTarifServeur[]>>;
}

export function creerLecteurBase(source: SourceCatalogueBase): LecteurCatalogueBase {
  /** Produit introuvable : catalogue jamais importé (ERR_CATALOGUE_ABSENT) ou clé inconnue. */
  async function echecIntrouvable() {
    if ((await source.compterPrixCatalogue()) === 0) return echecCatalogueAbsent();
    return echecProduitInconnu();
  }

  return {
    async getProduit(cle) {
      const p = await source.lireProduit(cle);
      if (!p) return echecIntrouvable();
      // LOI 6 : un produit sans régime n'est pas vendable.
      if (!aUnRegime(p)) return echecSansRegime(p);
      const recente = plusRecente(p.prix);
      return succes(produitDepuisBase(p, recente ? tauxTvaDepuisBase(recente) : null));
    },

    async getPrix(cle, date) {
      if (!estDateISO(date)) return echecDateIllisible();
      const p = await source.lireProduit(cle);
      if (!p) return echecIntrouvable();
      // LOI 6 : regimePrix absent = invendable, getPrix refuse.
      if (!aUnRegime(p)) return echecSansRegime(p);
      const enVigueur = p.prix.filter((l) => couvre(l, date));
      if (enVigueur.length > 1) {
        // Impossible si le déclencheur PrixProduit_controler est en place.
        throw new Error(`Catalogue en base incohérent : ${enVigueur.length} prix en vigueur le ${date} pour ${cle}.`);
      }
      if (enVigueur.length === 0) return echecTarifAbsent(p.nom, date, "date");
      return succes(prixDepuisBase(p, enVigueur[0]));
    },

    async listerParCategorie(date, options = {}) {
      if (!estDateISO(date)) return echecDateIllisible();
      const lignes = await source.lireProduitsAuTarif(dateIsoVersBase(date));
      if (lignes.length === 0 && (await source.compterPrixCatalogue()) === 0) return echecCatalogueAbsent();
      const rayons = new Map<string, ProduitAuTarifServeur[]>();
      for (const p of lignes) {
        if (!aUnRegime(p)) continue;
        const l = p.prix.find((x) => couvre(x, date));
        if (!l) continue;
        const produit = produitDepuisBase(p, tauxTvaDepuisBase(l));
        if (options.grille && produit.grille !== options.grille) continue;
        if (options.regime && produit.regimePrix !== options.regime) continue;
        const liste = rayons.get(produit.categorie) ?? [];
        liste.push({ produit, prix: prixDepuisBase(p, l) });
        rayons.set(produit.categorie, liste);
      }
      return succes([...rayons].map(([categorie, produits]) => ({ categorie, produits })));
    },
  };
}

/** Date du jour du magasin (Belgique), pas celle du serveur (UTC). */
export function aujourdhuiMagasin(maintenant: Date = new Date()): DateISO {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
}
