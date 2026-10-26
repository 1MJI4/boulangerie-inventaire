// Tests de l'écriture et de la lecture du catalogue EN BASE.
//
// ⚠ Pas de PostgreSQL ici (aucune base réelle dans les tests) : les tests
// passent par un FAUX client en mémoire, aux colonnes du modèle Prisma
// ProduitCatalogue / PrixProduit, qui reproduit les garanties du déclencheur
// PrixProduit_controler (migration 20261015110000) : pas de chevauchement,
// version en vigueur figée sauf sa date de fin (jamais dans le passé), aucune
// suppression, et transaction « tout ou rien ».
// Aucun prix écrit en dur (LOI 1) : tout est relu dans le catalogue des fichiers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerCatalogueDepuisDossier } from "./chargerFichiers.ts";
import { ajouterVersion, getPrix, listerParCategorie } from "./catalogue.ts";
import {
  attenduDepuisCatalogue,
  ecrireCatalogueEnBase,
  planifierEcriture,
  type ClientEcritureCatalogue,
  type DepotEcritureCatalogue,
} from "./ecritureBase.ts";
import { verifierCibleEcriture, verifierCiblePremierImportProduction } from "./gardeEcriture.ts";
import {
  creerLecteurBase,
  dateBaseVersIso,
  grilleDuRegime,
  prixEstPlancherDepuisBase,
  type LignePrixBase,
  type LigneProduitBase,
  type ProduitAvecPrixBase,
  type SourceCatalogueBase,
} from "./lectureBase.ts";
import { clientEcriturePrisma, connaitProduitCatalogue, sourcePrisma, SOURCE_SANS_CATALOGUE, type ClientPrismaAvecTransaction } from "./serveur.ts";
import { veille } from "./normaliser.ts";
import type { Catalogue, DateISO, VersionTarif } from "./types.ts";

const charge = chargerCatalogueDepuisDossier();
assert.ok(charge.ok);
const CAT = charge.catalogue;
const AUJOURDHUI = "2026-10-15";

// ------------------------------------------------------------ Faux client

class ErreurBase extends Error {}

/** Base en mémoire : tables ProduitCatalogue et PrixProduit + déclencheur simulé. */
class FausseBase {
  produits: LigneProduitBase[] = [];
  prix: LignePrixBase[] = [];
  private seq = { p: 0, x: 0 };
  ecritures = 0;
  /** Échoue à la N-ième écriture (test de la transaction). */
  echouerA: number | null = null;
  aujourdhui: DateISO;
  constructor(aujourdhui: DateISO) {
    this.aujourdhui = aujourdhui;
  }

  private ecrire() {
    this.ecritures++;
    if (this.echouerA !== null && this.ecritures >= this.echouerA) throw new ErreurBase("panne simulée");
  }

  private controlerPrix(l: LignePrixBase) {
    for (const autre of this.prix) {
      if (autre.id === l.id || autre.produitId !== l.produitId) continue;
      const finA = autre.valideAu?.getTime() ?? Infinity;
      const finB = l.valideAu?.getTime() ?? Infinity;
      if (autre.valideDu.getTime() <= finB && l.valideDu.getTime() <= finA) throw new ErreurBase("ERR_TARIF_CHEVAUCHEMENT");
    }
  }

  avecPrix(p: LigneProduitBase, filtre: (l: LignePrixBase) => boolean = () => true): ProduitAvecPrixBase {
    return {
      ...p,
      prix: this.prix.filter((l) => l.produitId === p.id && filtre(l)).sort((a, b) => a.valideDu.getTime() - b.valideDu.getTime()).map((l) => ({ ...l })),
    };
  }

  depot(): DepotEcritureCatalogue {
    return {
      lireProduitsCatalogue: async () => this.produits.map((p) => this.avecPrix(p)),
      creerProduits: async (liste) => {
        const ids = new Map<string, number>();
        for (const a of liste) {
          this.ecrire();
          if (this.produits.some((p) => p.cleCatalogue === a.cle)) throw new ErreurBase("unique cleCatalogue");
          const id = ++this.seq.p;
          this.produits.push({ id, cleCatalogue: a.cle, nom: a.nom, categorie: a.categorie, sousCategorie: a.sousCategorie, unite: a.unite, regimePrix: a.regimePrix, estFavori: a.estFavori, etages: a.etages, actif: a.actif });
          ids.set(a.cle, id);
        }
        return ids;
      },
      modifierProduit: async (id, champs) => {
        this.ecrire();
        const p = this.produits.find((x) => x.id === id)!;
        Object.assign(p, champs);
      },
      fermerVersion: async (id, valideAu) => {
        this.ecrire();
        const l = this.prix.find((x) => x.id === id)!;
        const du = dateBaseVersIso(l.valideDu);
        if (du <= this.aujourdhui && dateBaseVersIso(valideAu) < veille(this.aujourdhui)) throw new ErreurBase("ERR_TARIF_PASSE");
        const copie = { ...l, valideAu };
        this.controlerPrix(copie);
        l.valideAu = valideAu;
      },
      insererVersions: async (lignes) => {
        for (const { produitId, prix } of lignes) {
          this.ecrire();
          const p = this.produits.find((x) => x.id === produitId)!;
          if ((prix.basePrix === "kg") !== (p.unite === "kg")) throw new ErreurBase("ERR_UNITE_INCOHERENTE");
          if (!(Number.isInteger(prix.prixCentimes) && prix.prixCentimes > 0)) throw new ErreurBase("prix positif");
          const l: LignePrixBase = {
            id: ++this.seq.x,
            produitId,
            prixCentimes: prix.prixCentimes,
            basePrix: prix.basePrix,
            valideDu: new Date(`${prix.valideDu}T00:00:00.000Z`),
            valideAu: prix.valideAu === null ? null : new Date(`${prix.valideAu}T00:00:00.000Z`),
            tauxTvaEmporterPb: null,
            tauxTvaSurPlacePb: null,
            minimum: prix.minimum,
            minimumParSymbole: prix.minimumParSymbole,
            maximum: prix.maximum,
            versionCode: prix.versionCode,
          };
          this.controlerPrix(l);
          this.prix.push(l);
        }
        return lignes.length;
      },
    };
  }

  /** Transaction : instantané avant, restauration en cas d'erreur. */
  client(): ClientEcritureCatalogue {
    return {
      transaction: async (travail) => {
        const avant = JSON.stringify({ produits: this.produits, prix: this.prix, seq: this.seq });
        try {
          return await travail(this.depot());
        } catch (e) {
          const s = JSON.parse(avant, (k, v) => (k === "valideDu" || k === "valideAu") && typeof v === "string" ? new Date(v) : v);
          this.produits = s.produits;
          this.prix = s.prix;
          this.seq = s.seq;
          throw e;
        }
      },
    };
  }

  source(): SourceCatalogueBase {
    const couvre = (l: LignePrixBase, d: Date) => l.valideDu <= d && (l.valideAu === null || d <= l.valideAu);
    return {
      lireProduit: async (cle) => {
        const p = this.produits.find((x) => x.cleCatalogue === cle);
        return p ? this.avecPrix(p) : null;
      },
      lireProduitsAuTarif: async (d) =>
        this.produits.filter((p) => this.prix.some((l) => l.produitId === p.id && couvre(l, d))).map((p) => this.avecPrix(p, (l) => couvre(l, d))),
      compterPrixCatalogue: async () => this.prix.length,
    };
  }
}

/** Catalogue + une version comptoir « tarif_2026-11 » où un produit prend 10 centimes. */
function catalogueAvecHausse(valideDu: DateISO): { cat: Catalogue; id: string; ancien: number; nouveau: number } {
  const v1 = CAT.versions.find((v) => v.grille === "comptoir")!;
  const [id, ligne] = [...v1.lignes].find(([, l]) => l.basePrix === "piece")!;
  const lignes = new Map(v1.lignes);
  lignes.set(id, { ...ligne, prixCentimes: ligne.prixCentimes + 10 });
  const version: VersionTarif = { code: "tarif_2026-11", grille: "comptoir", valideDu, valideAu: null, source: "test", lignes };
  const produits = [...CAT.produits.values()].filter((p) => p.grille === "comptoir");
  const r = ajouterVersion(CAT, version, produits);
  assert.ok(r.ok, JSON.stringify(r.signalements));
  return { cat: r.catalogue, id, ancien: ligne.prixCentimes, nouveau: ligne.prixCentimes + 10 };
}

async function baseRemplie() {
  const base = new FausseBase(AUJOURDHUI);
  const r = await ecrireCatalogueEnBase(base.client(), CAT, { aujourdhui: AUJOURDHUI });
  assert.ok(r.ok && r.ecrit, JSON.stringify(r.signalements.filter((s) => s.niveau === "bloquant")));
  return base;
}

// ------------------------------------------------------------ Garde-fou

test("garde-fou : refuse toute base sans la marque « recette »", () => {
  const prod = "postgresql://postgres.abc:motdepasse@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
  const r = verifierCibleEcriture(prod, "aws-0-eu-central-1.pooler.supabase.com");
  assert.equal(r.ok, false);
  assert.ok(!r.ok && !r.message.includes("motdepasse"), "le mot de passe n'apparaît jamais");
  assert.equal(verifierCibleEcriture(undefined, "x").ok, false);
  assert.equal(verifierCibleEcriture("pas une url", "x").ok, false);
  assert.equal(verifierCibleEcriture("mysql://u:p@h/recette", "h").ok, false);
});

test("garde-fou : marque « recette » ET hôte confirmé, les deux exigés", () => {
  const url = "postgresql://u:secret@db.exemple.be:5432/boulangerie_recette";
  assert.equal(verifierCibleEcriture(url, undefined).ok, false);
  assert.equal(verifierCibleEcriture(url, "autre.exemple.be").ok, false);
  const ok = verifierCibleEcriture(url, "DB.exemple.be");
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.hote, "db.exemple.be");
  assert.ok(verifierCibleEcriture("postgresql://u:p@recette.exemple.be/app", "recette.exemple.be").ok);
});

test("garde-fou production : premier import seulement, hôte confirmé, catalogue vide", () => {
  const prod = "postgresql://postgres.abc:motdepasse@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
  const hote = "aws-0-eu-central-1.pooler.supabase.com";
  const ok = verifierCiblePremierImportProduction(prod, hote.toUpperCase(), 0);
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.hote, hote);
  // Confirmation absente ou différente.
  assert.equal(verifierCiblePremierImportProduction(prod, undefined, 0).ok, false);
  assert.equal(verifierCiblePremierImportProduction(prod, "autre.exemple.be", 0).ok, false);
  // Catalogue déjà rempli : jamais d'écrasement par cette voie.
  const rempli = verifierCiblePremierImportProduction(prod, hote, 1);
  assert.equal(rempli.ok, false);
  assert.ok(!rempli.ok && !rempli.message.includes("motdepasse"), "le mot de passe n'apparaît jamais");
  assert.equal(verifierCiblePremierImportProduction(prod, hote, Number.NaN).ok, false);
  // Une base de recette ne passe pas par --production.
  const recette = "postgresql://u:p@db.exemple.be:5432/boulangerie_recette";
  assert.equal(verifierCiblePremierImportProduction(recette, "db.exemple.be", 0).ok, false);
  // URL absente, illisible ou non PostgreSQL.
  assert.equal(verifierCiblePremierImportProduction(undefined, hote, 0).ok, false);
  assert.equal(verifierCiblePremierImportProduction("pas une url", hote, 0).ok, false);
  assert.equal(verifierCiblePremierImportProduction("mysql://u:p@h/app", "h", 0).ok, false);
});

// ------------------------------------------------------------ Écriture

test("écriture complète : un produit par clé, libellés à la lettre, TVA NULL", async () => {
  const base = await baseRemplie();
  assert.equal(base.produits.length, CAT.produits.size);
  assert.equal(new Set(base.produits.map((p) => p.cleCatalogue)).size, CAT.produits.size, "favoris non dupliqués (LOI 4)");
  for (const p of CAT.produits.values()) {
    const b = base.produits.find((x) => x.cleCatalogue === p.id)!;
    assert.equal(b.nom, p.produit);
    assert.equal(b.categorie, p.categorie);
    assert.equal(b.sousCategorie ?? "", p.sousCategorie);
    assert.equal(b.unite, p.unite);
    assert.equal(b.regimePrix, p.regimePrix);
    assert.equal(b.estFavori, p.estFavori);
  }
  assert.equal(base.produits.filter((p) => p.unite === "kg").length, 4);
  assert.ok(!base.produits.some((p) => p.categorie === "Favoris"));
  assert.ok(base.prix.every((l) => l.tauxTvaEmporterPb === null && l.tauxTvaSurPlacePb === null));
});

test("relecture : getPrix serveur = getPrix des fichiers, pour chaque produit", async () => {
  const base = await baseRemplie();
  const lecteur = creerLecteurBase(base.source());
  for (const date of ["2026-09-15", "2026-10-20"]) {
    for (const id of CAT.produits.keys()) {
      const attendu = getPrix(CAT, id, date);
      const lu = await lecteur.getPrix(id, date);
      assert.equal(lu.ok, attendu.ok, `${id} au ${date}`);
      if (!attendu.ok || !lu.ok) {
        assert.equal(!lu.ok && lu.code, !attendu.ok && attendu.code);
        continue;
      }
      const a = attendu.donnees;
      const b = lu.donnees;
      for (const champ of ["prixCentimes", "basePrix", "prixEstPlancher", "estFavori", "minQuantite", "minParSymbole", "typeMin", "etages", "versionCode", "valideDu", "valideAu"] as const) {
        assert.deepEqual(b[champ], a[champ], `${id} ${champ}`);
      }
      assert.equal(b.maxParUnite?.valeur ?? null, a.maxParUnite?.valeur ?? null);
      assert.ok(Number.isInteger(b.prixProduitId) && b.prixProduitId > 0);
      assert.equal(b.produitIdBase, base.produits.find((p) => p.cleCatalogue === id)!.id);
    }
  }
});

test("relecture : fiche produit, grille et régime reconstruits", async () => {
  const base = await baseRemplie();
  const lecteur = creerLecteurBase(base.source());
  for (const p of CAT.produits.values()) {
    assert.equal(grilleDuRegime(p.regimePrix), p.grille, "la grille se déduit du régime");
    const r = await lecteur.getProduit(p.id);
    assert.ok(r.ok);
    assert.equal(r.donnees.grille, p.grille);
    assert.equal(r.donnees.produit, p.produit);
    assert.equal(r.donnees.famille, p.famille, `${p.id} : famille reconstruite depuis la catégorie`);
    assert.equal(r.donnees.tauxTva, null);
  }
});

test("le plancher se déduit du régime et de la base, comme sur les affiches", () => {
  for (const v of CAT.versions) {
    for (const [id, l] of v.lignes) {
      const p = CAT.produits.get(id)!;
      assert.equal(prixEstPlancherDepuisBase(p.regimePrix, l.basePrix, p.famille === "supplement"), l.prixEstPlancher, id);
    }
  }
});

test("listerParCategorie serveur : mêmes rayons, favoris une seule fois", async () => {
  const base = await baseRemplie();
  const lu = await creerLecteurBase(base.source()).listerParCategorie("2026-10-20");
  assert.ok(lu.ok);
  const attendu = listerParCategorie(CAT, "2026-10-20");
  assert.deepEqual(lu.donnees.map((r) => r.categorie), attendu.map((r) => r.categorie));
  const ids = lu.donnees.flatMap((r) => r.produits.map((p) => p.produit.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, attendu.flatMap((r) => r.produits.map((p) => p.produit.id)));
  assert.ok(!lu.donnees.some((r) => r.categorie === "Favoris"));
  const filtre = await creerLecteurBase(base.source()).listerParCategorie("2026-10-20", { regime: "C" });
  assert.ok(filtre.ok && filtre.donnees.every((r) => r.produits.every((p) => p.produit.regimePrix === "C")));
});

test("idempotence : relancer l'import n'écrit rien", async () => {
  const base = await baseRemplie();
  const avant = base.ecritures;
  const r = await ecrireCatalogueEnBase(base.client(), CAT, { aujourdhui: AUJOURDHUI });
  assert.ok(r.ok);
  assert.equal(r.ecrit, false);
  assert.equal(r.operations.length, 0);
  assert.equal(r.resume.produitsInchanges, CAT.produits.size);
  assert.equal(base.ecritures, avant);
});

test("changement de prix à date future : fermer l'ancienne version puis insérer", async () => {
  const base = await baseRemplie();
  const { cat, id, ancien, nouveau } = catalogueAvecHausse("2026-11-01");
  const nbComptoir = [...cat.produits.values()].filter((p) => p.grille === "comptoir").length;
  const r = await ecrireCatalogueEnBase(base.client(), cat, { aujourdhui: AUJOURDHUI });
  assert.ok(r.ok && r.ecrit, JSON.stringify(r.signalements.filter((s) => s.niveau === "bloquant")));
  assert.equal(r.resume.produitsCrees, 0);
  assert.equal(r.resume.versionsFermees, nbComptoir);
  assert.equal(r.resume.versionsInserees, nbComptoir);
  const lecteur = creerLecteurBase(base.source());
  const avant = await lecteur.getPrix(id, "2026-10-31");
  const apres = await lecteur.getPrix(id, "2026-11-01");
  assert.ok(avant.ok && apres.ok);
  assert.equal(avant.donnees.prixCentimes, ancien);
  assert.equal(avant.donnees.valideAu, "2026-10-31");
  assert.equal(apres.donnees.prixCentimes, nouveau);
  assert.notEqual(avant.donnees.prixProduitId, apres.donnees.prixProduitId, "l'ancienne version n'est pas écrasée");
  // Et c'est à nouveau idempotent.
  const encore = await ecrireCatalogueEnBase(base.client(), cat, { aujourdhui: AUJOURDHUI });
  assert.equal(encore.ecrit, false);
});

test("nouveau tarif à date passée : refusé, rien n'est écrit", async () => {
  const base = await baseRemplie();
  const { cat } = catalogueAvecHausse("2026-10-01");
  const avant = base.ecritures;
  const r = await ecrireCatalogueEnBase(base.client(), cat, { aujourdhui: AUJOURDHUI });
  assert.equal(r.ok, false);
  assert.ok(r.signalements.some((s) => s.code === "ERR_DATE_EFFET_PASSEE"));
  assert.equal(base.ecritures, avant);
});

test("version en base différente des fichiers : refus total, jamais d'écrasement", async () => {
  const base = await baseRemplie();
  base.prix[0].prixCentimes += 1; // simulé : la base a dérivé
  const r = await ecrireCatalogueEnBase(base.client(), CAT, { aujourdhui: AUJOURDHUI });
  assert.equal(r.ok, false);
  assert.ok(r.signalements.some((s) => s.code === "ERR_VERSION_DEJA_IMPORTEE_DIFFERENTE"));
  assert.equal(r.operations.length, 0);
});

test("version en base inconnue des fichiers : refus", () => {
  const { produits } = attenduDepuisCatalogue(CAT);
  const a = produits[0];
  const existant: ProduitAvecPrixBase = {
    id: 1, cleCatalogue: a.cle, nom: a.nom, categorie: a.categorie, sousCategorie: a.sousCategorie,
    unite: a.unite, regimePrix: a.regimePrix, estFavori: a.estFavori, etages: null, actif: true,
    prix: [{ id: 9, produitId: 1, prixCentimes: a.prix[0].prixCentimes, basePrix: a.prix[0].basePrix, valideDu: new Date("2026-08-01T00:00:00.000Z"), valideAu: new Date("2026-08-31T00:00:00.000Z"), tauxTvaEmporterPb: null, tauxTvaSurPlacePb: null, minimum: null, minimumParSymbole: null, maximum: null, versionCode: null }],
  };
  const plan = planifierEcriture(produits, [existant], AUJOURDHUI);
  assert.equal(plan.ok, false);
  assert.ok(plan.signalements.some((s) => s.code === "ERR_VERSION_INCONNUE_EN_BASE"));
});

test("changement d'unité ou de régime en base : refus", () => {
  const { produits } = attenduDepuisCatalogue(CAT);
  const kg = produits.find((p) => p.unite === "kg")!;
  const base = (x: Partial<ProduitAvecPrixBase>): ProduitAvecPrixBase => ({
    id: 1, cleCatalogue: kg.cle, nom: kg.nom, categorie: kg.categorie, sousCategorie: kg.sousCategorie,
    unite: kg.unite, regimePrix: kg.regimePrix, estFavori: kg.estFavori, etages: null, actif: true, prix: [], ...x,
  });
  assert.ok(planifierEcriture([kg], [base({ unite: "piece" })], AUJOURDHUI).signalements.some((s) => s.code === "ERR_CHANGEMENT_UNITE"));
  assert.ok(planifierEcriture([kg], [base({ regimePrix: "C" })], AUJOURDHUI).signalements.some((s) => s.code === "ERR_CHANGEMENT_REGIME"));
});

test("panne en cours d'écriture : la transaction n'écrit rien", async () => {
  const base = new FausseBase(AUJOURDHUI);
  base.echouerA = 200;
  await assert.rejects(ecrireCatalogueEnBase(base.client(), CAT, { aujourdhui: AUJOURDHUI }));
  assert.equal(base.produits.length, 0);
  assert.equal(base.prix.length, 0);
});

// ------------------------------------------------------------ Étages (délai « gâteau à étages »)

/** Produits dont l'affiche porte des étages, lus dans les fichiers (aucun identifiant en dur). */
function produitsAEtages() {
  return attenduDepuisCatalogue(CAT).produits.filter((p) => p.etages !== null);
}

test("étages : l'affiche porte ceux des pièces montées 2 et 3 étages", () => {
  const aEtages = produitsAEtages();
  // Renommées par le propriétaire le 22/10/2026 (ex-« Gâteau de mariage » = 2 étages).
  assert.ok(aEtages.some((p) => p.cle === "gateaux-sur-commande/gateau-de-mariage" && p.etages === 2), "pièce montée 2 étages sans étages");
  assert.ok(aEtages.some((p) => p.cle === "gateaux-sur-commande/piece-montee" && p.etages === 3), "pièce montée 3 étages sans étages");
  for (const p of aEtages) {
    assert.ok(Number.isInteger(p.etages) && p.etages! >= 2, `${p.nom} : ${p.etages}`);
    assert.equal(p.regimePrix, "C");
  }
});

test("étages : relus en base (getPrix, listerParCategorie) — pièce montée et mariage ≥ 2", async () => {
  const base = await baseRemplie();
  const lecteur = creerLecteurBase(base.source());
  for (const p of produitsAEtages()) {
    const r = await lecteur.getPrix(p.cle, "2026-10-20");
    assert.ok(r.ok, p.cle);
    assert.equal(r.donnees.etages, p.etages);
    assert.ok(r.donnees.etages! >= 2);
  }
  const rayons = await lecteur.listerParCategorie("2026-10-20");
  assert.ok(rayons.ok);
  const tous = rayons.donnees.flatMap((x) => x.produits);
  const aEtages = tous.filter((x) => x.prix.etages !== null);
  assert.equal(aEtages.length, produitsAEtages().length);
  // Aucun produit du comptoir n'hérite d'étages.
  assert.ok(tous.filter((x) => x.produit.regimePrix === "A").every((x) => x.prix.etages === null));
});

test("étages : une base importée SANS étages est complétée au réimport, prix intacts, puis idempotente", async () => {
  const base = await baseRemplie();
  const cles = new Set(produitsAEtages().map((p) => p.cle));
  for (const p of base.produits) if (cles.has(p.cleCatalogue)) p.etages = null; // import d'avant la colonne
  const prixAvant = JSON.stringify(base.prix);

  const r = await ecrireCatalogueEnBase(base.client(), CAT, { aujourdhui: AUJOURDHUI });
  assert.ok(r.ok && r.ecrit, JSON.stringify(r.signalements.filter((s) => s.niveau === "bloquant")));
  assert.equal(r.resume.produitsModifies, cles.size);
  assert.equal(r.resume.versionsInserees, 0);
  assert.equal(r.resume.versionsFermees, 0);
  assert.ok(r.operations.every((o) => o.type === "modifierProduit" && Object.keys(o.champs).join() === "etages"));
  assert.equal(JSON.stringify(base.prix), prixAvant, "aucune version de prix touchée");
  for (const p of base.produits) if (cles.has(p.cleCatalogue)) assert.ok(p.etages! >= 2);

  const encore = await ecrireCatalogueEnBase(base.client(), CAT, { aujourdhui: AUJOURDHUI });
  assert.equal(encore.ecrit, false);
  assert.equal(encore.operations.length, 0);
});

test("étages : un fichier sans étages n'efface jamais ceux de la base", () => {
  const a = produitsAEtages()[0];
  const sansEtages = { ...a, etages: null };
  const existant: ProduitAvecPrixBase = {
    id: 1, cleCatalogue: a.cle, nom: a.nom, categorie: a.categorie, sousCategorie: a.sousCategorie,
    unite: a.unite, regimePrix: a.regimePrix, estFavori: a.estFavori, etages: a.etages, actif: true, prix: [],
  };
  const plan = planifierEcriture([sansEtages], [existant], AUJOURDHUI);
  assert.ok(plan.ok);
  assert.ok(!plan.operations.some((o) => o.type === "modifierProduit" && "etages" in o.champs));
  assert.ok(plan.signalements.some((s) => s.code === "INFO_HYPOTHESE"));
});

// ------------------------------------------------------------ Lecture : échecs typés

test("base sans catalogue : ERR_CATALOGUE_ABSENT, jamais de repli", async () => {
  const lecteur = creerLecteurBase(SOURCE_SANS_CATALOGUE);
  const id = [...CAT.produits.keys()][0];
  const p = await lecteur.getPrix(id, "2026-10-20");
  assert.equal(!p.ok && p.code, "ERR_CATALOGUE_ABSENT");
  const f = await lecteur.getProduit(id);
  assert.equal(!f.ok && f.code, "ERR_CATALOGUE_ABSENT");
  const l = await lecteur.listerParCategorie("2026-10-20");
  assert.equal(!l.ok && l.code, "ERR_CATALOGUE_ABSENT");
  assert.ok(!l.ok && !/ERR_|undefined/.test(l.message), "message humain (LOI 9)");
});

test("produit sans régime en base : ERR_PRODUIT_SANS_REGIME (getProduit, getPrix), absent des listes", async () => {
  const base = await baseRemplie();
  const cible = base.produits[0];
  cible.regimePrix = null;
  const lecteur = creerLecteurBase(base.source());
  const f = await lecteur.getProduit(cible.cleCatalogue);
  assert.equal(!f.ok && f.code, "ERR_PRODUIT_SANS_REGIME");
  assert.equal(!f.ok && f.champ, "produitId");
  assert.ok(!f.ok && f.message.includes(cible.nom), "le message nomme le produit");
  const p = await lecteur.getPrix(cible.cleCatalogue, "2026-10-20");
  assert.equal(!p.ok && p.code, "ERR_PRODUIT_SANS_REGIME");
  const l = await lecteur.listerParCategorie("2026-10-20");
  assert.ok(l.ok && !l.donnees.some((r) => r.produits.some((x) => x.produit.id === cible.cleCatalogue)));
});

test("catalogue présent : clé inconnue, date illisible, date sans tarif", async () => {
  const base = await baseRemplie();
  const lecteur = creerLecteurBase(base.source());
  const inconnu = await lecteur.getPrix("n-existe/pas", "2026-10-20");
  assert.equal(!inconnu.ok && inconnu.code, "ERR_PRODUIT_INCONNU");
  const id = [...CAT.produits.keys()][0];
  const illisible = await lecteur.getPrix(id, "2026-02-30");
  assert.equal(!illisible.ok && illisible.code, "ERR_SAISIE_INVALIDE");
  const avant = await lecteur.getPrix(id, "2026-08-31");
  assert.equal(!avant.ok && avant.code, "ERR_TARIF_ABSENT");
  assert.ok(!avant.ok && !/ERR_|undefined/.test(avant.message), "message humain (LOI 9)");
});

// ------------------------------------------------------------ Adaptateur Prisma

test("adaptateur Prisma : vise ProduitCatalogue, ne touche jamais « Produit » (inventaire)", async () => {
  const appels: string[] = [];
  const espion = (modele: string) =>
    new Proxy({}, { get: (_t, methode: string) => async (args: { data?: { cleCatalogue: string }[] }) => {
      appels.push(`${modele}.${methode}`);
      if (methode === "count") return 0;
      if (methode === "findMany") return [];
      if (methode === "createManyAndReturn") return (args.data ?? []).map((d, i) => ({ id: i + 1, cleCatalogue: d.cleCatalogue }));
      if (methode === "createMany") return { count: 0 };
      return null;
    } });
  const inventaire = new Proxy({}, { get: () => { throw new Error("la table Produit (inventaire) a été touchée"); } });
  const client = { produit: inventaire, produitCatalogue: espion("produitCatalogue"), prixProduit: espion("prixProduit") } as unknown as ClientPrismaAvecTransaction;
  (client as unknown as { $transaction: unknown }).$transaction = async (f: (tx: unknown) => Promise<unknown>) => f(client);
  assert.ok(connaitProduitCatalogue(client));
  assert.equal(connaitProduitCatalogue({ produit: {} }), false);
  const src = sourcePrisma(client);
  await src.lireProduit("x");
  await src.lireProduitsAuTarif(new Date());
  await src.compterPrixCatalogue();
  await ecrireCatalogueEnBase(clientEcriturePrisma(client), CAT, { aujourdhui: AUJOURDHUI });
  assert.ok(appels.length > 0 && appels.every((a) => a.startsWith("produitCatalogue.") || a.startsWith("prixProduit.")), appels.join(","));
});
