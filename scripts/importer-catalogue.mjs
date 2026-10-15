#!/usr/bin/env node
// scripts/importer-catalogue.mjs — agent `catalogue-prix`
//
// Import des tarifs listés dans data/versions-tarifs.json, en SIMULATION par
// défaut : lit les fichiers, contrôle, affiche le rapport pour le gérant
// (diff, alertes, écarts affiche/Excel) et N'ÉCRIT RIEN.
//
//   node scripts/importer-catalogue.mjs                 simulation, rapport résumé
//   node scripts/importer-catalogue.mjs --detail        simulation, toutes les alertes
//   node scripts/importer-catalogue.mjs --ecrire-en-base   écriture (voir plus bas)
//
// Node 24 requis (lecture native des fichiers .ts du module catalogue).
// Code de sortie : 0 si aucun blocage, 1 sinon.

import { chargerCatalogueDepuisDossier, DOSSIER_DATA_PAR_DEFAUT } from "../src/catalogue/chargerFichiers.ts";
import { comparerVersions, formaterRapportDiff } from "../src/catalogue/diff.ts";

const args = new Set(process.argv.slice(2));
const detail = args.has("--detail");
const ecrire = args.has("--ecrire-en-base");

const NIVEAUX = { bloquant: "BLOQUANT", avertissement: "À vérifier", information: "Info" };

function afficherSignalements(signalements) {
  const parCode = new Map();
  for (const s of signalements) parCode.set(s.code, [...(parCode.get(s.code) ?? []), s]);
  for (const [code, liste] of parCode) {
    const niveau = NIVEAUX[liste[0].niveau];
    if (detail || liste.length <= 3 || liste[0].niveau === "bloquant") {
      for (const s of liste) console.log(`  [${niveau}] ${s.message}`);
    } else {
      console.log(`  [${niveau}] ${liste.length} × ${code} — ex. ${liste[0].message} (--detail pour tout voir)`);
    }
  }
}

console.log("=== Import du catalogue — SIMULATION (rien n'est écrit) ===");
console.log(`Dossier : ${DOSSIER_DATA_PAR_DEFAUT}\n`);

const resultat = chargerCatalogueDepuisDossier();
const { catalogue } = resultat;

for (const rapport of resultat.rapports) {
  console.log(`--- ${rapport.code} ---`);
  afficherSignalements(rapport.signalements);
  const version = catalogue.versions.find((v) => v.code === rapport.code);
  if (version) {
    const precedentes = catalogue.versions.filter((v) => v.grille === version.grille && v.valideDu < version.valideDu);
    const precedente = precedentes.at(-1) ?? null;
    console.log(`  Valable du ${version.valideDu} au ${version.valideAu ?? "(en cours)"}`);
    console.log(`  Diff par rapport à ${precedente ? precedente.code : "(aucun tarif précédent)"} :`);
    const lignesDiff = formaterRapportDiff(comparerVersions(precedente, version), catalogue).split("\n");
    const visibles = detail || lignesDiff.length <= 15 ? lignesDiff : [...lignesDiff.slice(0, 15), `… ${lignesDiff.length - 15} lignes de plus (--detail pour tout voir)`];
    console.log(visibles.map((l) => "    " + l).join("\n"));
  }
  console.log("");
}

console.log("--- Écarts entre les affiches et l'Excel ---");
afficherSignalements(resultat.ecarts);
console.log("");

const produits = [...catalogue.produits.values()];
console.log("--- Ce que l'import écrirait ---");
console.log(`  ${catalogue.versions.length} versions de tarif · ${produits.length} produits`);
for (const r of ["A", "B", "C"]) console.log(`  Régime ${r} : ${produits.filter((p) => p.regimePrix === r).length} produits`);
console.log(`  Au kilo : ${produits.filter((p) => p.unite === "kg").map((p) => p.produit).join(", ")}`);
console.log(`  Favoris : ${produits.filter((p) => p.estFavori).length} · TVA à confirmer : ${produits.filter((p) => p.tauxTva === null).length}`);
console.log("");

if (!resultat.ok) {
  console.log("RÉSULTAT : import BLOQUÉ — corriger les lignes « BLOQUANT » ci-dessus.");
  process.exit(1);
}

if (ecrire) {
  // Écriture volontairement non implémentée : le schéma Prisma ne porte pas
  // encore les versions de tarif (valideDu/valideAu, regimePrix, unite,
  // estFavori, tauxTva). Dépendance : agent `base-donnees`. Le comportement
  // le plus sûr est de refuser plutôt que d'écraser la table Tarif actuelle.
  console.log("ÉCRITURE REFUSÉE : le schéma de base ne gère pas encore les versions de tarif.");
  console.log("Rien n'a été écrit. (Dépendance : agent base-donnees.)");
  process.exit(1);
}

console.log("RÉSULTAT : simulation réussie, aucun blocage. Rien n'a été écrit en base.");
