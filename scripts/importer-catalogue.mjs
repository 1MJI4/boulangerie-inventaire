#!/usr/bin/env node
// scripts/importer-catalogue.mjs — agent `catalogue-prix`
//
// Import des tarifs listés dans data/versions-tarifs.json, en SIMULATION par
// défaut : lit les fichiers, contrôle, affiche le rapport pour le gérant
// (diff, alertes, écarts affiche/Excel) et N'ÉCRIT RIEN.
//
//   node scripts/importer-catalogue.mjs                 simulation, rapport résumé
//   node scripts/importer-catalogue.mjs --detail        simulation, toutes les alertes
//   node scripts/importer-catalogue.mjs --ecrire-en-base --je-confirme-la-base=<hôte>
//        écriture dans une base de RECETTE seulement (voir ecrireEnBase plus bas)
//   node scripts/importer-catalogue.mjs --ecrire-en-base --production --je-confirme-la-base=<hôte>
//        PREMIER import en production, refusé si le catalogue en base n'est pas vide
//
// Node 24 requis (lecture native des fichiers .ts du module catalogue).
// Code de sortie : 0 si aucun blocage, 1 sinon.

import { chargerCatalogueDepuisDossier, DOSSIER_DATA_PAR_DEFAUT } from "../src/catalogue/chargerFichiers.ts";
import { comparerVersions, formaterRapportDiff } from "../src/catalogue/diff.ts";
import { ErreurImport } from "../src/catalogue/rapport.ts";

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

let resultat;
try {
  resultat = chargerCatalogueDepuisDossier();
} catch (e) {
  // Registre des versions inutilisable : message du catalogue des messages (ErreurImport).
  if (!(e instanceof ErreurImport)) throw e;
  afficherSignalements([e.signalement]);
  console.log("RÉSULTAT : import BLOQUÉ — corriger les lignes « BLOQUANT » ci-dessus.");
  process.exit(1);
}
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
console.log(`  Familles : ${[...new Set(produits.map((p) => p.famille))].map((f) => `${f} ${produits.filter((p) => p.famille === f).length}`).join(" · ")}`);
console.log(`  Au kilo : ${produits.filter((p) => p.unite === "kg").map((p) => p.produit).join(", ")}`);
console.log(`  Favoris : ${produits.filter((p) => p.estFavori).length} · TVA à confirmer : ${produits.filter((p) => p.tauxTva === null).length}`);
console.log("");

if (!resultat.ok) {
  console.log("RÉSULTAT : import BLOQUÉ — corriger les lignes « BLOQUANT » ci-dessus.");
  process.exit(1);
}

if (ecrire) {
  await ecrireEnBase();
  process.exit(0);
}

console.log("RÉSULTAT : simulation réussie, aucun blocage. Rien n'a été écrit en base.");

// ------------------------------------------------------------ Écriture en base
// Cible : tables ProduitCatalogue / PrixProduit (catalogue de COMMANDE), JAMAIS
// « Produit » (inventaire) — règle du propriétaire du 15/10/2026.
// Garde-fou : DATABASE_URL doit porter la marque « recette » ET l'hôte doit
// être confirmé par --je-confirme-la-base=<hôte>. Une seule transaction ;
// relancer sur une base à jour n'écrit rien.
async function ecrireEnBase() {
  const { verifierCibleEcriture, verifierCiblePremierImportProduction } = await import("../src/catalogue/gardeEcriture.ts");
  const production = args.has("--production");
  const confirmation = process.argv.find((a) => a.startsWith("--je-confirme-la-base="))?.split("=")[1];
  // URL figée AVANT de charger Prisma (qui lit .env) : seule celle-ci est vérifiée et utilisée.
  const urlVerifiee = process.env.DATABASE_URL;
  console.log("=== Écriture en base ===");
  if (!production) {
    const cible = verifierCibleEcriture(urlVerifiee, confirmation);
    if (!cible.ok) {
      console.log("ÉCRITURE REFUSÉE : " + cible.message);
      process.exit(1);
    }
    console.log(`Base : « ${cible.base} » sur « ${cible.hote} » (recette confirmée).`);
  }

  const { PrismaClient } = await import("@prisma/client");
  const { clientEcriturePrisma, connaitProduitCatalogue } = await import("../src/catalogue/serveur.ts");
  const { ecrireCatalogueEnBase, formaterResumeEcriture } = await import("../src/catalogue/ecritureBase.ts");
  const { aujourdhuiMagasin } = await import("../src/catalogue/lectureBase.ts");
  // URL passée explicitement : celle qui vient d'être vérifiée, et aucune autre.
  const prisma = new PrismaClient({ datasourceUrl: urlVerifiee });
  try {
    if (!connaitProduitCatalogue(prisma)) {
      // Garde-fou : client Prisma généré avant le modèle ProduitCatalogue.
      console.log("ÉCRITURE REFUSÉE : client Prisma à régénérer (npx prisma generate). Rien n'a été écrit.");
      process.exit(1);
    }
    if (production) {
      // Premier import en production : seulement sur un catalogue vide.
      const dejaEnBase = await prisma.produitCatalogue.count();
      const cible = verifierCiblePremierImportProduction(urlVerifiee, confirmation, dejaEnBase);
      if (!cible.ok) {
        console.log("ÉCRITURE REFUSÉE : " + cible.message);
        process.exit(1);
      }
      console.log(`Base : « ${cible.base} » sur « ${cible.hote} » (PRODUCTION confirmée, catalogue vide).`);
    }
    const r = await ecrireCatalogueEnBase(clientEcriturePrisma(prisma), catalogue, { aujourdhui: aujourdhuiMagasin() });
    afficherSignalements(r.signalements);
    console.log(formaterResumeEcriture(r));
    if (!r.ok) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
