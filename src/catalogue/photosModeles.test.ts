// Contrôle de la galerie de photos de modèles (src/catalogue/photosModeles.ts).
// Aucun prix écrit en dur (LOI 1).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chargerCatalogueDepuisDossier } from "./chargerFichiers.ts";
import { getPrix } from "./catalogue.ts";
import { PHOTOS_MODELES } from "./photosModeles.ts";
import { listerPhotosModeles } from "./index.ts";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));
const cat = chargerCatalogueDepuisDossier().catalogue;
const d = new Date();
const AUJOURDHUI = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("photos : identifiants uniques, au format G000 / S000, fichier /modeles/<ID>.jpg", () => {
  const ids = PHOTOS_MODELES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PHOTOS_MODELES) {
    assert.match(p.id, /^[GS]\d{3}$/, p.id);
    assert.equal(p.fichier, `/modeles/${p.id}.jpg`, p.id);
    assert.ok(p.categorie.trim().length > 0, p.id);
  }
});

test("photos : chaque produit et supplément existe au catalogue de commande à la date du jour", () => {
  for (const p of PHOTOS_MODELES) {
    for (const cle of [p.produit, ...(p.supplements ?? [])]) {
      if (cle === null) continue;
      const r = getPrix(cat, cle, AUJOURDHUI);
      assert.ok(r.ok, `${p.id} → « ${cle} » absent du catalogue au ${AUJOURDHUI}`);
    }
  }
});

test("photos : un supplément cité est bien un supplément (pas un gâteau)", () => {
  for (const p of PHOTOS_MODELES) {
    for (const s of p.supplements ?? []) assert.match(s, /\/supplement-/, `${p.id} → ${s}`);
  }
});

test("photos : chaque image existe dans public/modeles, allégée (< 80 Ko), sans fichier orphelin", () => {
  for (const p of PHOTOS_MODELES) {
    const chemin = PUBLIC + p.fichier;
    assert.ok(existsSync(chemin), `${p.id} : ${p.fichier} manquant`);
    assert.ok(statSync(chemin).size < 80 * 1024, `${p.id} : image trop lourde pour un réseau faible`);
  }
  const references = new Set(PHOTOS_MODELES.map((p) => p.fichier.replace("/modeles/", "")));
  for (const f of readdirSync(PUBLIC + "/modeles")) assert.ok(references.has(f), `public/modeles/${f} n'est cité par aucune photo`);
});

test("photos : aucune note ne contient de montant (LOI 1)", () => {
  for (const p of PHOTOS_MODELES) {
    if (p.note) assert.doesNotMatch(p.note, /\d|€|euro/i, p.id);
  }
});

test("photos : listerPhotosModeles filtre par rayon sans rien perdre", () => {
  assert.equal(listerPhotosModeles().length, PHOTOS_MODELES.length);
  const total = [...new Set(PHOTOS_MODELES.map((p) => p.categorie))]
    .reduce((n, c) => n + listerPhotosModeles(c).length, 0);
  assert.equal(total, PHOTOS_MODELES.length);
});
