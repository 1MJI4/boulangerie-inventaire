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
  return r.donnees;
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
  assert.equal(!r.ok && r.code, "ERR_TARIF_ABSENT");
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

// ------------------------------------------------------------ Famille (LOI 11)

test("famille explicite : affiche des gâteaux = pâtisserie, affiche traiteur = salé (jamais déduite du nom)", () => {
  for (const affiche of JSON_AFFICHES.affiches as { titre: string; produits: { id: string; basePrix: string }[] }[]) {
    for (const { id, basePrix } of affiche.produits) {
      const attendue = basePrix === "forfait" ? "supplement" : affiche.titre === "Sur commande" ? "sale" : "patisserie";
      assert.equal(cat.produits.get(id)?.famille, attendue, id);
    }
  }
});

// ------------------------------------------------------------ Suppléments (R7)

const SUPPLEMENTS_ATTENDUS = [
  "gateaux-et-tartes/supplement/photo",
  "gateaux-et-tartes/supplement/ecriture",
  "gateaux-sur-commande/supplement-photo",
  "gateaux-sur-commande/supplement-ecriture-simple",
];

test("suppléments : exactement 4, au forfait, famille « supplement », libellés intacts", () => {
  const derniere = (id: string) => [...cat.versions].reverse().find((v) => v.lignes.has(id))!.lignes.get(id)!;
  const supplements = [...cat.produits.values()].filter((p) => p.famille === "supplement").map((p) => p.id);
  assert.deepEqual(supplements.sort(), [...SUPPLEMENTS_ATTENDUS].sort());
  for (const id of SUPPLEMENTS_ATTENDUS) {
    assert.equal(derniere(id).basePrix, "forfait", id);
    assert.equal(cat.produits.get(id)!.produit, "Supplément", `${id} : libellé à la lettre (LOI 5)`);
  }
  // Seuls les suppléments sont au forfait, dans toutes les versions.
  for (const v of cat.versions) for (const [id, l] of v.lignes) assert.equal(l.basePrix === "forfait", SUPPLEMENTS_ATTENDUS.includes(id), id);
  // « Supplément (oeuf) » (sandwichs) n'est pas listé : reste à la pièce.
  const oeuf = [...cat.produits.values()].find((p) => p.produit === "Supplément (oeuf)")!;
  assert.equal(oeuf.famille, "sale");
});

test("affiche : supplément hors forfait, ou forfait hors supplément → bloquant", () => {
  const a = structuredClone(JSON_AFFICHES);
  const gateaux = a.affiches.find((x: { titre: string }) => x.titre !== "Sur commande");
  const photo = gateaux.produits.find((p: { id: string }) => p.id === "gateaux-sur-commande/supplement-photo");
  photo.basePrix = "piece";
  photo.prixEstPlancher = true;
  const imp1 = importerTarifsSurCommande(a, OPTS);
  assert.equal(imp1.ok, false);
  assert.ok(imp1.signalements.some((s) => s.code === "ERR_REGIME_INCOHERENT" && s.produitId === photo.id));

  const b = structuredClone(JSON_AFFICHES);
  const g2 = b.affiches.find((x: { titre: string }) => x.titre !== "Sur commande");
  const layer = g2.produits.find((p: { id: string }) => p.id === "gateaux-sur-commande/layer-cake");
  layer.basePrix = "forfait";
  layer.prixEstPlancher = false;
  const imp2 = importerTarifsSurCommande(b, OPTS);
  assert.equal(imp2.ok, false);
  assert.ok(imp2.signalements.some((s) => s.code === "ERR_REGIME_INCOHERENT" && s.produitId === layer.id));
});

test("famille du comptoir : tirée du rayon, chaque produit en a une", () => {
  const parRayon = new Map<string, Set<string>>();
  for (const p of cat.produits.values()) {
    assert.ok(["gateau", "patisserie", "viennoiserie", "boulangerie", "sale", "boisson", "supplement"].includes(p.famille), p.id);
    if (p.famille === "supplement") continue; // supplément : liste explicite, pas le rayon (testé plus haut)
    parRayon.set(p.categorie, (parRayon.get(p.categorie) ?? new Set()).add(p.famille));
  }
  for (const [rayon, familles] of parRayon) assert.equal(familles.size, 1, `une seule famille par rayon : ${rayon}`);
  assert.deepEqual([...parRayon.get("Gâteaux et tartes")!], ["gateau"]);
  assert.deepEqual([...parRayon.get("Oriental")!], ["patisserie"], "Msemen, corne de gazelle : pas des gâteaux");
  assert.deepEqual([...parRayon.get("Boulangerie")!], ["boulangerie"]);
  assert.deepEqual([...parRayon.get("Sandwichs Froids")!], ["sale"]);
});

test("rayon inconnu : classé pâtisserie (le plus prudent) et signalé en hypothèse", () => {
  const copie = structuredClone(JSON_AFFICHES);
  copie.affiches[0].titre = "Nouvelle affiche";
  const imp = importerTarifsSurCommande(copie, OPTS);
  assert.ok(imp.ok);
  assert.ok(imp.produits.filter((p) => p.categorie === "Nouvelle affiche").every((p) => p.famille === "patisserie"));
  assert.ok(imp.signalements.some((s) => s.code === "INFO_HYPOTHESE" && s.message.includes("Nouvelle affiche")));
});

test("rapport d'import : textes du catalogue des messages, jamais de code ni d'« undefined »", () => {
  const copie = structuredClone(JSON_AFFICHES);
  delete copie.affiches[1].produits[0].regimePrix;
  const imp = importerTarifsSurCommande(copie, OPTS);
  const s = imp.signalements.find((x) => x.code === "ERR_REGIME_ABSENT")!;
  assert.equal(s.niveau, "bloquant");
  assert.ok(s.message.startsWith("« "), "commence par le repère (« produit » (affiche))");
  assert.ok(!/ERR_|undefined/.test(s.message), s.message);
  for (const r of charge.rapports) for (const x of r.signalements) assert.ok(!/ERR_|AVERT_|INFO_|undefined/.test(x.message), x.message);
});
