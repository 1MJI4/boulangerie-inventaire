// Tests du catalogue comptoir (régime A). Lancer : node --test "src/catalogue/*.test.ts"
// Aucun prix écrit en dur (LOI 1) : toutes les valeurs attendues sont relues
// dans le CSV ou dérivées du catalogue.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyserCsv } from "./csv.ts";
import { DOSSIER_DATA_PAR_DEFAUT } from "./chargerFichiers.ts";
import { importerCsvComptoir } from "./importComptoir.ts";
import {
  ajouterVersion,
  catalogueVide,
  creerApiCatalogue,
  getPrix,
  getProduit,
  listerFavoris,
  listerParCategorie,
} from "./catalogue.ts";
import { comparerVersions, formaterRapportDiff } from "./diff.ts";
import { identifiantProduit } from "./normaliser.ts";
import type { Catalogue, ResultatImport } from "./types.ts";

const CSV = readFileSync(join(DOSSIER_DATA_PAR_DEFAUT, "catalogue_prix_2026-09.csv"), "utf8");
const OPTS = { code: "tarif_2026-09", valideDu: "2026-09-01", source: "catalogue_prix_2026-09.csv" };
const lignesCsv = analyserCsv(CSV).slice(1).map((l) => l.champs);

function importer(texte: string, opts = OPTS): ResultatImport {
  return importerCsvComptoir(texte, opts);
}
function charger(texte = CSV, opts = OPTS): Catalogue {
  const imp = importer(texte, opts);
  assert.ok(imp.ok, JSON.stringify(imp.signalements.filter((s) => s.niveau === "bloquant")));
  const r = ajouterVersion(catalogueVide(), imp.version!, imp.produits);
  assert.ok(r.ok);
  return r.catalogue;
}
/** Remplace une ligne exacte du CSV par une autre (pour fabriquer un cas). */
function remplacerLigne(texte: string, ancienne: string, nouvelle: string): string {
  const lignes = texte.split("\n");
  const i = lignes.indexOf(ancienne);
  assert.notEqual(i, -1, `ligne introuvable : ${ancienne}`);
  lignes[i] = nouvelle;
  return lignes.join("\n");
}
function ligneBrute(predicat: (champs: string[]) => boolean): string {
  const l = CSV.split("\n").find((ligne) => {
    const enr = analyserCsv(ligne)[0];
    return enr !== undefined && predicat(enr.champs);
  });
  assert.ok(l, "ligne de test introuvable");
  return l!;
}
const codes = (imp: ResultatImport) => imp.signalements.map((s) => s.code);

// ------------------------------------------------------------ non-régression

test("le CSV compte 351 lignes de produits, toutes lues", () => {
  assert.equal(lignesCsv.length, 351);
  const imp = importer(CSV);
  assert.equal(imp.ok, true);
  assert.equal(imp.signalements.filter((s) => s.niveau === "bloquant").length, 0);
});

test("chacune des 351 lignes retrouve exactement son prix_cents via getPrix", () => {
  const cat = charger();
  for (const [categorie, produit, sous, , prixCentimes] of lignesCsv) {
    // Une ligne Favoris pointe vers son jumeau : même identifiant hors catégorie.
    const id =
      categorie === "Favoris"
        ? [...cat.produits.values()].find(
            (p) => p.estFavori && identifiantProduit("x", p.produit, p.sousCategorie) === identifiantProduit("x", produit, sous),
          )!.id
        : identifiantProduit(categorie, produit, sous);
    const prix = getPrix(cat, id, "2026-09-15");
    assert.ok(prix.ok, `${categorie} / ${produit} / ${sous}`);
    assert.equal(prix.donnees.prixCentimes, Number.parseInt(prixCentimes, 10));
  }
});

test("tous les prix sont des entiers strictement positifs (centimes)", () => {
  const cat = charger();
  for (const v of cat.versions) {
    for (const l of v.lignes.values()) {
      assert.ok(Number.isInteger(l.prixCentimes) && l.prixCentimes > 0);
    }
  }
});

test("libellés et catégories repris à la lettre (LOI 5)", () => {
  const cat = charger();
  const crabe = [...cat.produits.values()].find((p) => p.produit.includes("SURIMI"))!;
  const brut = lignesCsv.find((l) => l[1].includes("SURIMI"))!;
  assert.equal(crabe.produit, brut[1]); // caractères invisibles conservés, mais signalés
  assert.ok(codes(importer(CSV)).includes("AVERT_CARACTERE_INVISIBLE"));
  const categoriesCsv = new Set(lignesCsv.map((l) => l[0]).filter((c) => c !== "Favoris"));
  assert.deepEqual(new Set([...cat.produits.values()].map((p) => p.categorie)), categoriesCsv);
});

test("régime A explicite et TVA à confirmer (null) pour tout le comptoir", () => {
  const cat = charger();
  for (const p of cat.produits.values()) {
    assert.equal(p.regimePrix, "A");
    assert.equal(p.tauxTva, null);
  }
});

// ------------------------------------------------------------ unités (LOI 2)

test("exactement 4 produits au kilo, tous Oriental", () => {
  const cat = charger();
  const kg = [...cat.produits.values()].filter((p) => p.unite === "kg");
  assert.deepEqual(
    kg.map((p) => p.produit).sort(),
    ["Corne de gazelle", "Halwa arbia", "Sablé orientaux", "Sellou"],
  );
  assert.ok(kg.every((p) => p.categorie === "Oriental"));
  for (const p of kg) {
    const prix = getPrix(cat, p.id, "2026-09-15");
    assert.ok(prix.ok && prix.donnees.basePrix === "kg");
  }
});

test("un produit au kilo saisi à la pièce bloque l'import", () => {
  const l = ligneBrute((c) => c[1] === "Sellou");
  const imp = importer(remplacerLigne(CSV, l, l.replace(",kg,", ",piece,")));
  assert.equal(imp.ok, false);
  assert.ok(codes(imp).includes("ERR_PRODUIT_KG_A_LA_PIECE"));
});

test("un 5e produit au kilo bloque l'import", () => {
  const l = ligneBrute((c) => c[1] === "Meloui" && c[0] === "Oriental");
  const imp = importer(remplacerLigne(CSV, l, l.replace(",piece,", ",kg,")));
  assert.equal(imp.ok, false);
  assert.ok(codes(imp).includes("ERR_PRODUIT_KG_INATTENDU"));
});

// ------------------------------------------------------------ favoris (LOI 4)

test("CAS OBLIGATOIRE : un favori n'est jamais compté deux fois", () => {
  const cat = charger();
  const nbReels = lignesCsv.filter((l) => l[0] !== "Favoris").length;
  const nbFavorisLignes = lignesCsv.filter((l) => l[0] === "Favoris").length;
  assert.equal(nbFavorisLignes, 49);
  assert.equal(cat.produits.size, nbReels); // 302 : aucune ligne Favoris ne crée de produit

  const rayons = listerParCategorie(cat, "2026-09-15");
  assert.ok(!rayons.some((r) => r.categorie === "Favoris"), "pas de rayon Favoris");
  const listes = rayons.flatMap((r) => r.produits.map((p) => p.produit.id));
  assert.equal(listes.length, new Set(listes).size, "chaque produit une seule fois");
  assert.equal(listes.length, nbReels);

  // Inventaire simulé : une pièce de chaque produit listé. Le total doit
  // égaler la somme des lignes réelles du CSV, favoris NON ajoutés.
  const totalInventaire = rayons.flatMap((r) => r.produits).reduce((s, p) => s + p.prix.prixCentimes, 0);
  const totalCsvSansFavoris = lignesCsv.filter((l) => l[0] !== "Favoris").reduce((s, l) => s + Number.parseInt(l[4], 10), 0);
  assert.equal(totalInventaire, totalCsvSansFavoris);
});

test("les favoris sont rangés dans leur rayon réel, avec estFavori", () => {
  const cat = charger();
  const favoris = listerFavoris(cat, "2026-09-15");
  const clesFavoris = new Set(lignesCsv.filter((l) => l[0] === "Favoris").map((l) => `${l[1]}|${l[2]}`));
  assert.equal(favoris.length, clesFavoris.size); // 48 : « Piccolo blanc » figure deux fois
  assert.ok(favoris.every((f) => f.produit.categorie !== "Favoris" && f.produit.estFavori));
  assert.ok(codes(importer(CSV)).includes("AVERT_FAVORI_EN_DOUBLE"));
});

test("un favori au prix différent de son jumeau bloque l'import (pas de fusion silencieuse)", () => {
  const l = ligneBrute((c) => c[0] === "Favoris" && c[1] === "Croissant");
  const champs = analyserCsv(l)[0].champs;
  const autre = String(Number.parseInt(champs[4], 10) + 10);
  const modifiee = l.replace(`,${champs[3]},${champs[4]},`, `,${champs[3]},${autre},`);
  // le contrôle euros/centimes doit aussi concorder : on ajuste prix_ttc_eur
  const eur = `${autre.slice(0, -2) || "0"}.${autre.slice(-2)}`;
  const imp = importer(remplacerLigne(CSV, l, modifiee.replace(`,${champs[3]},`, `,${eur},`)));
  assert.equal(imp.ok, false);
  assert.ok(codes(imp).includes("ERR_FAVORI_PRIX_DIFFERENT"));
});

test("un favori sans jumeau bloque l'import", () => {
  const l = ligneBrute((c) => c[0] === "Favoris" && c[1] === "Meloui");
  const imp = importer(remplacerLigne(CSV, l, l.replace("Meloui", "Meloui spécial")));
  assert.equal(imp.ok, false);
  assert.ok(codes(imp).includes("ERR_FAVORI_SANS_JUMEAU"));
});

test("un favori dont l'orthographe diffère seulement par un accent est signalé, pas rattaché", () => {
  const l = ligneBrute((c) => c[0] === "Favoris" && c[1] === "Éclair" && c[2] === "Moka");
  const imp = importer(remplacerLigne(CSV, l, l.replace("Éclair", "Eclair")));
  assert.equal(imp.ok, false);
  assert.ok(codes(imp).includes("ERR_FAVORI_JUMEAU_APPROXIMATIF"));
});

// ------------------------------------------------------------ contrôles de prix

test("prix vide, nul, non numérique ou incohérent → bloquant", () => {
  const l = ligneBrute((c) => c[1] === "Croissant" && c[0] === "Viennoiserie");
  const c = analyserCsv(l)[0].champs;
  const cas: [string, string][] = [
    [`${c[0]},${c[1]},,${c[3]},,piece,non`, "ERR_PRIX_VIDE"],
    [`${c[0]},${c[1]},,0,0,piece,non`, "ERR_PRIX_NUL_OU_NEGATIF"],
    [`${c[0]},${c[1]},,${c[3]},abc,piece,non`, "ERR_PRIX_NON_NUMERIQUE"],
    [`${c[0]},${c[1]},,${c[3]},${c[4]}0,piece,non`, "ERR_PRIX_INCOHERENT"],
  ];
  for (const [nouvelle, code] of cas) {
    const imp = importer(remplacerLigne(CSV, l, nouvelle));
    assert.equal(imp.ok, false, code);
    assert.ok(codes(imp).includes(code), code);
  }
});

test("doublon d'identifiant dans une même version → bloquant", () => {
  const l = ligneBrute((c) => c[1] === "Croissant" && c[0] === "Viennoiserie");
  const imp = importer(CSV.replace(l, `${l}\n${l.replace("Croissant", "CROISSANT  ")}`));
  assert.equal(imp.ok, false);
  assert.ok(codes(imp).includes("ERR_DOUBLON_IDENTIFIANT"));
});

// ------------------------------------------------------------ versions par date d'effet

function catalogueDeuxVersions() {
  const l = ligneBrute((c) => c[1] === "Torsade" && c[0] === "Viennoiserie"); // produit non favori
  const c = analyserCsv(l)[0].champs;
  const ancien = Number.parseInt(c[4], 10);
  const nouveau = String(ancien + 10);
  const eur = `${nouveau.slice(0, -2) || "0"}.${nouveau.slice(-2)}`;
  const csv2 = remplacerLigne(CSV, l, `${c[0]},${c[1]},${c[2]},${eur},${nouveau},${c[5]},${c[6]}`);
  const v1 = charger();
  const imp2 = importer(csv2, { code: "tarif_2026-11", valideDu: "2026-11-01", source: "test" });
  assert.ok(imp2.ok);
  const r = ajouterVersion(v1, imp2.version!, imp2.produits);
  assert.ok(r.ok);
  return { cat: r.catalogue, id: identifiantProduit(c[0], c[1], c[2]), ancien, nouveau: Number.parseInt(nouveau, 10), v1 };
}

test("getPrix de part et d'autre d'un changement de tarif", () => {
  const { cat, id, ancien, nouveau } = catalogueDeuxVersions();
  const avant = getPrix(cat, id, "2026-10-31");
  const apres = getPrix(cat, id, "2026-11-01");
  assert.ok(avant.ok && apres.ok);
  assert.equal(avant.donnees.prixCentimes, ancien);
  assert.equal(avant.donnees.versionCode, "tarif_2026-09");
  assert.equal(avant.donnees.valideAu, "2026-10-31");
  assert.equal(apres.donnees.prixCentimes, nouveau);
  assert.equal(apres.donnees.versionCode, "tarif_2026-11");
});

test("un nouveau tarif n'écrase jamais l'ancien", () => {
  const { cat, v1, id, ancien } = catalogueDeuxVersions();
  assert.equal(cat.versions.length, 2);
  assert.equal(v1.versions[0].valideAu, null, "le catalogue d'origine n'est pas muté");
  assert.equal(cat.versions[0].lignes.get(id)!.prixCentimes, ancien);
});

test("aucun tarif avant la première date d'effet → refus explicite", () => {
  const cat = charger();
  const r = getPrix(cat, [...cat.produits.keys()][0], "2026-08-31");
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, "ERR_TARIF_ABSENT");
});

test("produit disparu : fiche conservée, plus de prix au nouveau tarif", () => {
  const l = ligneBrute((c) => c[1] === "Smoothie");
  const c = analyserCsv(l)[0].champs;
  const id = identifiantProduit(c[0], c[1], c[2]);
  const imp2 = importer(CSV.replace(`${l}\n`, ""), { code: "tarif_2026-11", valideDu: "2026-11-01", source: "test" });
  const r = ajouterVersion(charger(), imp2.version!, imp2.produits);
  assert.ok(r.ok);
  assert.ok(getProduit(r.catalogue, id).ok);
  assert.ok(getPrix(r.catalogue, id, "2026-10-15").ok);
  const apres = getPrix(r.catalogue, id, "2026-11-02");
  assert.equal(!apres.ok && apres.code, "ERR_TARIF_ABSENT");
  const diff = comparerVersions(r.catalogue.versions[0], r.catalogue.versions[1]);
  assert.deepEqual(diff.disparus, [id]);
  assert.match(formaterRapportDiff(diff, r.catalogue), /1 disparus/);
});

test("import idempotent : le même tarif deux fois ne change rien", () => {
  const cat = charger();
  const imp = importer(CSV);
  const r = ajouterVersion(cat, imp.version!, imp.produits);
  assert.ok(r.ok);
  assert.equal(r.catalogue, cat);
  assert.ok(r.signalements.some((s) => s.code === "INFO_DEJA_IMPORTE"));
  const diff = comparerVersions(cat.versions[0], imp.version!);
  assert.equal(diff.modifies.length + diff.ajoutes.length + diff.disparus.length, 0);
});

test("un tarif rétroactif ou un changement d'unité est refusé", () => {
  const cat = charger();
  const imp = importer(CSV, { code: "tarif_2026-08", valideDu: "2026-08-01", source: "test" });
  const r = ajouterVersion(cat, imp.version!, imp.produits);
  assert.equal(r.ok, false);
  assert.ok(r.signalements.some((s) => s.code === "ERR_VERSION_ANTERIEURE"));

  // Changement d'unité d'un produit (pièce → kg) dans une version suivante :
  // construit directement, sans passer par l'import qui le bloquerait déjà.
  const imp2 = importer(CSV, { code: "tarif_2026-12", valideDu: "2026-12-01", source: "test" });
  const id = [...cat.produits.values()].find((p) => p.unite === "piece")!.id;
  const produits = imp2.produits.map((p) => (p.id === id ? { ...p, unite: "kg" as const } : p));
  const r2 = ajouterVersion(cat, imp2.version!, produits);
  assert.equal(r2.ok, false);
  assert.ok(r2.signalements.some((s) => s.code === "ERR_CHANGEMENT_UNITE"));
});

test("API liée : getPrix / getProduit / listerParCategorie", () => {
  const api = creerApiCatalogue(charger());
  assert.equal(api.getProduit("inconnu/xyz").ok, false);
  const premier = api.listerParCategorie("2026-09-15")[0].produits[0];
  assert.ok(api.getProduit(premier.produit.id).ok);
  assert.equal(api.getPrix("x", "2026-13-45").ok, false);
});

test("constat : aucun des 4 produits au kilo n'est un favori dans le CSV (Halwa arbia comprise)", () => {
  const cat = charger();
  const auKilo = [...cat.produits.values()].filter((p) => p.unite === "kg");
  assert.equal(auKilo.length, 4);
  assert.ok(auKilo.every((p) => !p.estFavori));
  assert.ok(!lignesCsv.some((l) => l[0] === "Favoris" && l[1] === "Halwa arbia"), "aucune ligne Favoris « Halwa arbia »");
});
