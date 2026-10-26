// Tests des régimes B et C (affiches du gérant) et du chargement complet.
// Aucun prix écrit en dur : seuls des minimums (quantités) sont vérifiés.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargerCatalogueDepuisDossier, DOSSIER_DATA_PAR_DEFAUT } from "./chargerFichiers.ts";
import { importerTarifsSurCommande } from "./importSurCommande.ts";
import { getPrix, listerParCategorie } from "./catalogue.ts";
import { comparerVersions, formaterRapportDiff } from "./diff.ts";
import { eurosTexteEnCentimes } from "./normaliser.ts";
import { multiplier } from "../domaine/argent.ts";

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
  // tarif_2026-09 (comptoir) · sur-commande_2026-10 · sur-commande_2026-10-26 (Pâte à sucre).
  assert.equal(cat.versions.length, 3);
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

// Base de prix de chaque supplément : forfait (une fois par gâteau), sauf la
// Pâte à sucre, par personne (décision du propriétaire du 26/10/2026).
const SUPPLEMENTS_ATTENDUS: Record<string, { basePrix: string; produit: string }> = {
  "gateaux-et-tartes/supplement/photo": { basePrix: "forfait", produit: "Supplément" },
  "gateaux-et-tartes/supplement/ecriture": { basePrix: "forfait", produit: "Supplément" },
  "gateaux-sur-commande/supplement-photo": { basePrix: "forfait", produit: "Supplément" },
  "gateaux-sur-commande/supplement-ecriture-simple": { basePrix: "forfait", produit: "Supplément" },
  "gateaux-sur-commande/supplement-pate-a-sucre": { basePrix: "personne", produit: "Pâte à sucre" },
};
const IDS_SUPPLEMENTS = Object.keys(SUPPLEMENTS_ATTENDUS);
const PATE_A_SUCRE = "gateaux-sur-commande/supplement-pate-a-sucre";

test("suppléments : exactement 5, base déclarée, prix fixe, famille « supplement », libellés intacts", () => {
  const derniere = (id: string) => [...cat.versions].reverse().find((v) => v.lignes.has(id))!.lignes.get(id)!;
  const supplements = [...cat.produits.values()].filter((p) => p.famille === "supplement").map((p) => p.id);
  assert.deepEqual(supplements.sort(), [...IDS_SUPPLEMENTS].sort());
  for (const [id, attendu] of Object.entries(SUPPLEMENTS_ATTENDUS)) {
    assert.equal(derniere(id).basePrix, attendu.basePrix, id);
    assert.equal(derniere(id).prixEstPlancher, false, `${id} : prix fixe`);
    assert.equal(cat.produits.get(id)!.produit, attendu.produit, `${id} : libellé à la lettre (LOI 5)`);
  }
  // Seuls les suppléments sont au forfait, dans toutes les versions.
  const auForfait = IDS_SUPPLEMENTS.filter((id) => SUPPLEMENTS_ATTENDUS[id].basePrix === "forfait");
  for (const v of cat.versions) for (const [id, l] of v.lignes) assert.equal(l.basePrix === "forfait", auForfait.includes(id), id);
  // « Supplément (oeuf) » (sandwichs) n'est pas listé : reste à la pièce.
  const oeuf = [...cat.produits.values()].find((p) => p.produit === "Supplément (oeuf)")!;
  assert.equal(oeuf.famille, "sale");
});

// ------------------------------------------------------------ Pâte à sucre (26/10/2026)

const DOC_AFFICHES = readFileSync(new URL("../../docs/TARIFS-SUR-COMMANDE.md", import.meta.url), "utf8");
const euros = (t: string) => {
  const c = eurosTexteEnCentimes(t.replace(/\s*€$/u, ""));
  assert.ok(c !== null, t);
  return c;
};

/** Prix de la Pâte à sucre lu dans l'affiche transcrite (docs/), jamais écrit dans le test. */
function prixPateASucreDansLaDoc(): number {
  const m = DOC_AFFICHES.match(/^\|\s*Pâte à sucre\s*\|\s*(\d+(?:,\d{2})?)\s*€\/pers\s*\|/mu);
  assert.ok(m, "ligne « Pâte à sucre » absente de docs/TARIFS-SUR-COMMANDE.md");
  return euros(m[1]);
}

/** Supplément d'un gâteau de 20 parts, tel qu'écrit dans l'exemple de la doc (« 20 × … = … + X »). */
function supplement20PartsDansLaDoc(): number {
  const m = DOC_AFFICHES.match(/\+ 20 × \d+,\d{2} € = [\d,]+ € \+ (\d+,\d{2}) €/u);
  assert.ok(m, "exemple « 20 parts » de la Pâte à sucre absent de docs/TARIFS-SUR-COMMANDE.md");
  return euros(m[1]);
}

test("Pâte à sucre : régime C, par personne, prix fixe, en vigueur le 26/10/2026, prix de l'affiche", () => {
  const r = getPrix(cat, PATE_A_SUCRE, "2026-10-26");
  assert.ok(r.ok);
  assert.equal(r.donnees.prixCentimes, prixPateASucreDansLaDoc());
  assert.equal(r.donnees.basePrix, "personne");
  assert.equal(r.donnees.prixEstPlancher, false);
  assert.equal(r.donnees.minQuantite, null, "le minimum 20 parts est une règle de regles-metier, pas de cette ligne");
  assert.equal(r.donnees.valideDu, "2026-10-26");
  const p = cat.produits.get(PATE_A_SUCRE)!;
  assert.equal(p.regimePrix, "C");
  assert.equal(p.famille, "supplement");
  assert.equal(p.unite, "piece");
  assert.equal(p.sousCategorie, "");
  assert.equal(Number.isInteger(r.donnees.prixCentimes), true);
  // Décision du propriétaire : gâteau de 20 parts → supplément de 120 € (exemple de la doc),
  // calculé en centimes entiers par le helper du domaine.
  assert.equal(multiplier(20, r.donnees.prixCentimes), supplement20PartsDansLaDoc());
  // Avant sa date d'effet, la Pâte à sucre n'existe pas : une commande passée ne la voit pas.
  const veille = getPrix(cat, PATE_A_SUCRE, "2026-10-25");
  assert.equal(veille.ok, false);
});

test("version du 26/10/2026 : l'ancienne n'est pas écrasée, diff = 1 ajouté, rien d'autre", () => {
  const ancienne = cat.versions.find((v) => v.code === "sur-commande_2026-10")!;
  const nouvelle = cat.versions.find((v) => v.code === "sur-commande_2026-10-26")!;
  assert.equal(ancienne.valideAu, "2026-10-25");
  assert.equal(nouvelle.valideDu, "2026-10-26");
  assert.equal(nouvelle.valideAu, null);
  assert.equal(ancienne.lignes.has(PATE_A_SUCRE), false);
  const diff = comparerVersions(ancienne, nouvelle);
  assert.deepEqual(diff.ajoutes, [PATE_A_SUCRE]);
  assert.deepEqual(diff.modifies, []);
  assert.deepEqual(diff.disparus, []);
  assert.equal(diff.inchanges.length, ancienne.lignes.size);
  assert.match(formaterRapportDiff(diff, cat), /Pâte à sucre/);
  // Les prix d'avant le 26/10 restent ceux du 15/10.
  for (const [id, l] of ancienne.lignes) {
    const avant = getPrix(cat, id, "2026-10-25");
    assert.ok(avant.ok && avant.donnees.prixCentimes === l.prixCentimes && avant.donnees.versionCode === "sur-commande_2026-10", id);
  }
});

test("Pâte à sucre : au forfait, ou en plancher « à partir de » → bloquant", () => {
  const JSON_26 = JSON.parse(readFileSync(join(DOSSIER_DATA_PAR_DEFAUT, "tarifs-sur-commande_2026-10-26.json"), "utf8"));
  const opts = { code: "sur-commande_2026-10-26", valideDu: "2026-10-26", source: "test" };
  assert.equal(importerTarifsSurCommande(JSON_26, opts).ok, true);
  const trouver = (d: typeof JSON_26) =>
    d.affiches.flatMap((a: { produits: { id: string }[] }) => a.produits).find((p: { id: string }) => p.id === PATE_A_SUCRE);

  const auForfait = structuredClone(JSON_26);
  trouver(auForfait).basePrix = "forfait";
  const imp1 = importerTarifsSurCommande(auForfait, opts);
  assert.equal(imp1.ok, false);
  assert.ok(imp1.signalements.some((s) => s.code === "ERR_REGIME_INCOHERENT" && s.produitId === PATE_A_SUCRE));

  const plancher = structuredClone(JSON_26);
  trouver(plancher).prixEstPlancher = true;
  const imp2 = importerTarifsSurCommande(plancher, opts);
  assert.equal(imp2.ok, false);
  assert.ok(imp2.signalements.some((s) => s.code === "ERR_REGIME_INCOHERENT" && s.produitId === PATE_A_SUCRE));
});

test("import idempotent : recharger le dossier donne le même catalogue", () => {
  const encore = chargerCatalogueDepuisDossier();
  assert.equal(encore.ok, true);
  assert.deepEqual(encore.catalogue.versions.map((v) => [v.code, v.valideDu, v.valideAu, v.lignes.size]), cat.versions.map((v) => [v.code, v.valideDu, v.valideAu, v.lignes.size]));
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
