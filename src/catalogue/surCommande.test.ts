// Tests des régimes B et C (affiches du gérant) et du chargement complet.
// Aucun prix écrit en dur : seuls des minimums (quantités) sont vérifiés.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargerCatalogueDepuisDossier, DOSSIER_DATA_PAR_DEFAUT } from "./chargerFichiers.ts";
import { importerTarifsSurCommande } from "./importSurCommande.ts";
import { getPrix, listerParCategorie } from "./catalogue.ts";

const JSON_AFFICHES = JSON.parse(readFileSync(join(DOSSIER_DATA_PAR_DEFAUT, "tarifs-sur-commande_2026-10.json"), "utf8"));
const OPTS = { code: "sur-commande_2026-10", valideDu: "2026-10-15", source: "test" };
const charge = chargerCatalogueDepuisDossier();
const cat = charge.catalogue;
const JOUR = "2026-10-20";

function ligne(id: string) {
  const r = getPrix(cat, id, JOUR);
  assert.ok(r.ok, id);
  return r.valeur;
}

test("le dossier data/ se charge sans blocage (comptoir + sur commande)", () => {
  assert.equal(charge.ok, true, JSON.stringify(charge.rapports));
  assert.equal(cat.versions.length, 2);
});

test("chaque produit sur commande porte un régime B ou C explicite", () => {
  const surCommande = [...cat.produits.values()].filter((p) => p.grille === "sur-commande");
  assert.ok(surCommande.length > 0);
  for (const p of surCommande) assert.ok(p.regimePrix === "B" || p.regimePrix === "C", p.id);
  assert.ok(surCommande.every((p) => p.tauxTva === null));
});

test("minimums de la LOI 7, tous bloquants, seuils distincts", () => {
  assert.equal(ligne("gateaux-sur-commande/layer-cake").minQuantite, 20);
  const number = ligne("gateaux-sur-commande/number-cake");
  assert.equal(number.minParSymbole, 15);
  assert.equal(number.minQuantite, null);
  assert.equal(ligne("gateaux-sur-commande/gateau-de-mariage").minQuantite, 40);
  assert.equal(ligne("gateaux-sur-commande/piece-montee").minQuantite, 60);
  for (const id of ["mini-tartelette", "mini-bavarois", "mini-eclair-mille-feuille"]) {
    assert.equal(ligne(`gateaux-sur-commande/${id}`).minQuantite, 15, id);
  }
  for (const id of ["mini-pizza-quiche", "mini-wrap", "mini-burger", "mini-batbout-farci", "mini-sandwichs-garnis"]) {
    assert.equal(ligne(`sur-commande/${id}`).minQuantite, 10, id);
  }
  assert.deepEqual(ligne("sur-commande/grand-pain-surprise").maxParUnite, { valeur: 20, objet: "sandwichs" });
  for (const v of cat.versions[1].lignes.values()) {
    const aMin = v.minQuantite !== null || v.minParSymbole !== null;
    assert.equal(v.typeMin, aMin ? "bloquant" : null);
  }
});

test("régime C : prix par personne = plancher ; suppléments = forfait par gâteau", () => {
  const bavarois = ligne("gateaux-sur-commande/bavarois");
  assert.equal(bavarois.basePrix, "personne");
  assert.equal(bavarois.prixEstPlancher, true);
  const photo = ligne("gateaux-sur-commande/supplement-photo");
  assert.equal(photo.basePrix, "forfait");
  assert.equal(photo.prixEstPlancher, false);
});

test("le Bavarois comptoir (A) et le Bavarois sur commande (C) restent deux produits distincts", () => {
  const a = listerParCategorie(cat, JOUR, { regime: "A" }).flatMap((r) => r.produits).filter((p) => p.produit.produit === "Bavarois");
  const c = listerParCategorie(cat, JOUR, { regime: "C" }).flatMap((r) => r.produits).filter((p) => p.produit.produit === "Bavarois");
  assert.ok(a.length > 0 && c.length === 1);
  assert.ok(a.every((p) => p.prix.basePrix === "piece" && !p.prix.prixEstPlancher));
});

test("avant la date d'effet des affiches, aucun prix sur commande n'est servi", () => {
  const r = getPrix(cat, "gateaux-sur-commande/layer-cake", "2026-10-14");
  assert.equal(!r.ok && r.code, "ERR_AUCUN_TARIF_A_CETTE_DATE");
});

test("rapport d'écarts affiche / Excel : prix concordants, orthographe Bastella/Bestella signalée", () => {
  assert.ok(!charge.ecarts.some((s) => s.code === "AVERT_ECART_AFFICHE_EXCEL"));
  assert.ok(charge.ecarts.some((s) => s.code === "AVERT_LIBELLE_AFFICHE_EXCEL" && s.message.includes("Bastella")));
  assert.ok(!charge.ecarts.some((s) => s.code === "AVERT_RAPPROCHEMENT_INTROUVABLE"));
});

test("régime absent, minimum en « majoration » ou plancher en régime B → import refusé", () => {
  const cas: [(p: Record<string, unknown>) => void, string][] = [
    [(p) => delete p.regimePrix, "ERR_REGIME_ABSENT"],
    [(p) => { p.minQuantite = 20; p.typeMin = "majoration"; }, "ERR_TYPE_MINIMUM"],
    [(p) => { p.regimePrix = "B"; p.prixEstPlancher = true; }, "ERR_REGIME_INCOHERENT"],
    [(p) => { p.prixCentimes = 4.5; }, "ERR_PRIX_NON_NUMERIQUE"],
  ];
  for (const [modifier, code] of cas) {
    const copie = structuredClone(JSON_AFFICHES);
    modifier(copie.affiches[1].produits[0]);
    const imp = importerTarifsSurCommande(copie, OPTS);
    assert.equal(imp.ok, false, code);
    assert.ok(imp.signalements.some((s) => s.code === code), code);
  }
});
