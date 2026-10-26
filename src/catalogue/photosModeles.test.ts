// Galerie de photos de modèles : règles pures (src/catalogue/photosModeles.ts)
// et cohérence de la REPRISE (migration 20261026150000_galerie_photos_en_base)
// avec les images de public/modeles/ et le catalogue de commande.
// Sans base : la migration est lue comme un fichier texte.
// Aucun prix écrit en dur (LOI 1).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chargerCatalogueDepuisDossier } from "./chargerFichiers.ts";
import { getPrix, getProduit } from "./catalogue.ts";
import {
  FORMAT_ID_PHOTO,
  LONGUEUR_MAX_NOTE,
  LONGUEUR_MAX_RAYON,
  PHOTOS_MODELES,
  categoriesPhotosModeles,
  nomFichierPhoto,
  noteContientUnPrix,
  ordreEnFinDeRayon,
  photoDepuisBase,
  planDeplacement,
  rayonsDansLOrdre,
  trierPhotos,
  validerFichierPhoto,
  validerIdPhoto,
  validerNotePhoto,
  validerOrdrePhoto,
  validerPrenomPhoto,
  validerRattachementPhoto,
  validerRayonPhoto,
  type CatalogueDesPhotos,
} from "./photosModeles.ts";

const PUBLIC_MODELES = fileURLToPath(new URL("../../public/modeles", import.meta.url));
const MIGRATION = fileURLToPath(new URL("../../prisma/migrations/20261026150000_galerie_photos_en_base/migration.sql", import.meta.url));
const cat = chargerCatalogueDepuisDossier().catalogue;
const CATALOGUE: CatalogueDesPhotos = { getProduit: (c) => getProduit(cat, c), getPrix: (c, d) => getPrix(cat, c, d) };
const d = new Date();
const AUJOURDHUI = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ------------------------------------------------------------ Lecture de la reprise (migration)

type LigneReprise = { id: string; categorie: string; produit: string | null; supplements: string[]; note: string | null; ordre: number; fichier: string };

const CHAINE = String.raw`'((?:[^']|'')*)'`;
const RE_LIGNE = new RegExp(
  String.raw`^\s*\(${CHAINE}, ${CHAINE}, (NULL|${CHAINE}), ARRAY\[(.*?)\]::TEXT\[\], (NULL|${CHAINE}), (\d+), ${CHAINE}\)[,;]?\s*$`,
);
const sql = (s: string) => s.replace(/''/g, "'");

function lireReprise(): LigneReprise[] {
  const texte = readFileSync(MIGRATION, "utf8");
  const debut = texte.indexOf('INSERT INTO "PhotoModele"');
  assert.ok(debut >= 0, "INSERT de reprise introuvable dans la migration");
  const lignes: LigneReprise[] = [];
  for (const brut of texte.slice(debut).split("\n").slice(1)) {
    if (!brut.trim().startsWith("('")) break;
    const m = RE_LIGNE.exec(brut);
    assert.ok(m, `ligne de reprise illisible : ${brut}`);
    lignes.push({
      id: sql(m[1]),
      categorie: sql(m[2]),
      produit: m[3] === "NULL" ? null : sql(m[4]),
      supplements: m[5] === "" ? [] : [...m[5].matchAll(/'((?:[^']|'')*)'/g)].map((x) => sql(x[1])),
      note: m[6] === "NULL" ? null : sql(m[7]),
      ordre: Number(m[8]),
      fichier: sql(m[9]),
    });
  }
  return lignes;
}

const REPRISE = lireReprise();

// ------------------------------------------------------------ Reprise

test("reprise : 152 photos, identifiants uniques au format G000 / S000, fichier <ID>.jpg conforme au CHECK", () => {
  assert.equal(REPRISE.length, 152);
  assert.equal(new Set(REPRISE.map((p) => p.id)).size, REPRISE.length);
  for (const p of REPRISE) {
    assert.match(p.id, /^[GS]\d{3}$/, p.id);
    assert.equal(p.fichier, `${p.id}.jpg`, p.id);
    assert.ok(validerFichierPhoto(p.id, p.fichier), p.id);
  }
});

test("reprise : rayons, notes et ordres passent les contrôles appliqués aux photos du gérant", () => {
  const rayons = [...new Set(REPRISE.map((p) => p.categorie))];
  let precedent = -1;
  for (const p of REPRISE) {
    const r = validerRayonPhoto(p.categorie, rayons);
    assert.ok(r.ok && r.donnees === p.categorie, `${p.id} : rayon « ${p.categorie} »`);
    const n = validerNotePhoto(p.note);
    assert.ok(n.ok && n.donnees === p.note, `${p.id} : note « ${p.note} »`);
    assert.ok(validerOrdrePhoto(p.ordre).ok, p.id);
    assert.ok(p.ordre > precedent, `${p.id} : ordre croissant (rang × 10)`);
    precedent = p.ordre;
  }
});

test("reprise : chaque produit et supplément existe au catalogue de commande à la date du jour", async () => {
  for (const p of REPRISE) {
    const r = await validerRattachementPhoto(CATALOGUE, p.produit, p.supplements, AUJOURDHUI);
    assert.ok(r.ok, `${p.id} → ${r.ok ? "" : r.code} au ${AUJOURDHUI}`);
    assert.deepEqual(r.donnees, { produit: p.produit, supplements: p.supplements }, p.id);
  }
});

test("reprise : chaque image de public/modeles correspond à une ligne de la migration, et inversement (< 80 Ko)", () => {
  const images = readdirSync(PUBLIC_MODELES).sort();
  const fichiers = REPRISE.map((p) => p.fichier).sort();
  assert.deepEqual(images, fichiers);
  for (const f of images) assert.ok(statSync(`${PUBLIC_MODELES}/${f}`).size < 80 * 1024, `${f} : image trop lourde pour un réseau faible`);
});

test("reprise : l'ordre des rayons en base redonne l'ordre actuel de la galerie", () => {
  assert.deepEqual(rayonsDansLOrdre(REPRISE), categoriesPhotosModeles());
  assert.equal(rayonsDansLOrdre(REPRISE)[0], "Bavarois");
});

test("copie figée @deprecated : identique, ligne à ligne, à la reprise de la migration", () => {
  assert.equal(PHOTOS_MODELES.length, REPRISE.length);
  PHOTOS_MODELES.forEach((p, i) => {
    const r = REPRISE[i];
    assert.deepEqual(
      { id: p.id, categorie: p.categorie, produit: p.produit, supplements: [...(p.supplements ?? [])], note: p.note, ordre: p.ordre, fichier: p.fichier },
      { id: r.id, categorie: r.categorie, produit: r.produit, supplements: r.supplements, note: r.note, ordre: r.ordre, fichier: `/modeles/${r.fichier}` },
      r.id,
    );
  });
});

// ------------------------------------------------------------ Note : jamais de prix (LOI 1)

test("note : « 2 étages », « 20 parts » acceptés ; €, euro, nombre + eur/cts, nombre décimal refusés", () => {
  for (const ok of ["2 étages", "20 parts", "Chiffre 18 en pâte à sucre", "Déco à valider sur WhatsApp", "Modèle avec photo imprimée (+ supplément)", "3 couleurs, 2 prénoms"]) {
    assert.equal(noteContientUnPrix(ok), false, ok);
    assert.ok(validerNotePhoto(ok).ok, ok);
  }
  for (const ko of ["5 €", "€5", "5 euros", "EURO", "goût européen", "5 eur", "5EUR pochage", "50 cts", "50 centimes", "6,5", "3.90 la part", "6 , 5"]) {
    assert.equal(noteContientUnPrix(ko), true, ko);
    const r = validerNotePhoto(ko);
    assert.ok(!r.ok && r.code === "ERR_SAISIE_INVALIDE" && r.champ === "note", ko);
  }
});

test("note : vide = aucune note, espaces de bord retirés, 120 caractères au plus (sortie : note raccourcie)", () => {
  assert.deepEqual(validerNotePhoto(""), { ok: true, donnees: null, signalements: [] });
  assert.deepEqual(validerNotePhoto("   "), { ok: true, donnees: null, signalements: [] });
  assert.deepEqual(validerNotePhoto(null), { ok: true, donnees: null, signalements: [] });
  assert.deepEqual(validerNotePhoto("  Forêt noire "), { ok: true, donnees: "Forêt noire", signalements: [] });
  assert.ok(validerNotePhoto("a".repeat(LONGUEUR_MAX_NOTE)).ok);
  const long = validerNotePhoto("a".repeat(LONGUEUR_MAX_NOTE + 1));
  assert.ok(!long.ok && long.valeurProposee === "a".repeat(LONGUEUR_MAX_NOTE));
  assert.equal(validerNotePhoto("ligne\nsuivante").ok, false);
  assert.equal(validerNotePhoto(12).ok, false);
});

// ------------------------------------------------------------ Rayon, prénom, fichier, id, ordre

test("rayon : obligatoire, 60 caractères au plus, pas de doublon à la casse près (sortie : rayon existant)", () => {
  const vide = validerRayonPhoto("  ");
  assert.ok(!vide.ok && vide.code === "ERR_CHAMP_OBLIGATOIRE" && vide.champ === "categorie");
  assert.equal(validerRayonPhoto(undefined).ok, false);
  assert.ok(validerRayonPhoto("x".repeat(LONGUEUR_MAX_RAYON)).ok);
  assert.equal(validerRayonPhoto("x".repeat(LONGUEUR_MAX_RAYON + 1)).ok, false);
  const proche = validerRayonPhoto("bavarois", ["Bavarois", "Layer Cake"]);
  assert.ok(!proche.ok && proche.code === "ERR_SAISIE_INVALIDE" && proche.valeurProposee === "Bavarois");
  const espaces = validerRayonPhoto("Layer  cake", ["Bavarois", "Layer Cake"]);
  assert.ok(!espaces.ok && espaces.valeurProposee === "Layer Cake");
  const nouveau = validerRayonPhoto("  Gâteaux 3D ", ["Bavarois"]);
  assert.ok(nouveau.ok && nouveau.donnees === "Gâteaux 3D", "libellé gardé à la lettre, bords retirés");
});

test("prénom : obligatoire pour une photo ajoutée, 60 caractères au plus", () => {
  const r = validerPrenomPhoto("");
  assert.ok(!r.ok && r.code === "ERR_CHAMP_OBLIGATOIRE" && r.champ === "creePar");
  assert.ok(validerPrenomPhoto(" Samira ").ok);
  assert.equal(validerPrenomPhoto("x".repeat(61)).ok, false);
});

test("fichier : <id>.<extension> en minuscules, JPEG / PNG / WebP seulement, jamais de chemin", () => {
  assert.deepEqual(nomFichierPhoto("P001", "JPG"), { ok: true, donnees: "P001.jpg", signalements: [] });
  assert.ok(nomFichierPhoto("P002", ".webp").ok);
  for (const ext of ["gif", "", "jpg/../x", "exe", undefined]) assert.equal(nomFichierPhoto("P003", ext).ok, false, String(ext));
  assert.equal(validerFichierPhoto("P001", "P002.jpg"), false, "doit commencer par l'id");
  assert.equal(validerFichierPhoto("P001", "../P001.jpg"), false);
  assert.equal(validerFichierPhoto("P001", "P001-3fa9c2.jpg"), true);
});

test("identifiant : même format que la base (A000), jamais corrigé en silence", () => {
  assert.ok(validerIdPhoto("G043").ok);
  assert.ok(validerIdPhoto("P001").ok);
  for (const v of ["g043", "G43", "G0433", "", null, 43]) assert.equal(validerIdPhoto(v).ok, false, String(v));
  assert.equal(FORMAT_ID_PHOTO.test("P999"), true);
});

test("ordre explicite : entier positif ou nul, borné", () => {
  assert.ok(validerOrdrePhoto(0).ok);
  for (const v of [-1, 1.5, "10", Number.NaN, 2_000_000]) assert.equal(validerOrdrePhoto(v).ok, false, String(v));
});

// ------------------------------------------------------------ Rattachement au catalogue

const UN_GATEAU = REPRISE.find((p) => p.produit !== null && p.supplements.length > 0)!;
const UN_SUPPLEMENT = UN_GATEAU.supplements[0];

test("rattachement : produit inconnu refusé (ERR_PRODUIT_INCONNU sur le champ produit), null accepté", async () => {
  const r = await validerRattachementPhoto(CATALOGUE, "gateaux-sur-commande/n-existe-pas", [], AUJOURDHUI);
  assert.ok(!r.ok && r.code === "ERR_PRODUIT_INCONNU" && r.champ === "produit");
  const libre = await validerRattachementPhoto(CATALOGUE, null, undefined, AUJOURDHUI);
  assert.deepEqual(libre.ok && libre.donnees, { produit: null, supplements: [] });
});

test("rattachement : un supplément n'est pas un produit, un gâteau n'est pas un supplément", async () => {
  const a = await validerRattachementPhoto(CATALOGUE, UN_SUPPLEMENT, [], AUJOURDHUI);
  assert.ok(!a.ok && a.code === "ERR_SAISIE_INVALIDE" && a.champ === "produit");
  const b = await validerRattachementPhoto(CATALOGUE, UN_GATEAU.produit, [UN_GATEAU.produit!], AUJOURDHUI);
  assert.ok(!b.ok && b.code === "ERR_SAISIE_INVALIDE" && b.champ === "supplements");
});

test("rattachement : supplément en double refusé avec la liste sans doublon en sortie", async () => {
  const r = await validerRattachementPhoto(CATALOGUE, UN_GATEAU.produit, [UN_SUPPLEMENT, UN_SUPPLEMENT], AUJOURDHUI);
  assert.ok(!r.ok && r.champ === "supplements");
  assert.deepEqual(r.valeurProposee, [UN_SUPPLEMENT]);
});

test("rattachement : produit sans prix à la date (tarif pas encore en vigueur) refusé", async () => {
  const r = await validerRattachementPhoto(CATALOGUE, UN_GATEAU.produit, [], "1990-01-01");
  assert.ok(!r.ok && r.code === "ERR_TARIF_ABSENT" && r.champ === "produit");
});

test("rattachement : produit archivé refusé", async () => {
  const archive: CatalogueDesPhotos = {
    getProduit: async () => ({ ok: true, donnees: { produit: "X", famille: "gateau", actif: false }, signalements: [] }),
    getPrix: async () => ({ ok: true, donnees: {}, signalements: [] }),
  };
  const r = await validerRattachementPhoto(archive, "x/y", [], AUJOURDHUI);
  assert.ok(!r.ok && r.code === "ERR_PRODUIT_INCONNU");
});

// ------------------------------------------------------------ Ordre d'affichage

const p = (id: string, categorie: string, ordre: number) => ({ id, categorie, ordre });

test("ordre : rayons au plus petit ordre de leurs photos, égalité alphabétique ; photos par ordre puis id", () => {
  const photos = [p("G003", "B", 30), p("G001", "A", 50), p("G002", "B", 10), p("G004", "C", 10), p("G005", "A", 50)];
  assert.deepEqual(rayonsDansLOrdre(photos), ["B", "C", "A"]);
  assert.deepEqual(trierPhotos(photos).map((x) => x.id), ["G002", "G003", "G004", "G001", "G005"]);
});

test("ordre : photo ajoutée en fin de rayon ; rayon nouveau après toute la galerie", () => {
  const photos = [p("G001", "A", 10), p("G002", "A", 20), p("G003", "B", 30)];
  assert.equal(ordreEnFinDeRayon(photos, "A"), 30);
  assert.equal(ordreEnFinDeRayon(photos, "Nouveau"), 40);
  assert.equal(ordreEnFinDeRayon([], "A"), 0);
  assert.equal(ordreEnFinDeRayon(photos, "A", "G002"), 20, "la photo déplacée ne compte pas");
});

test("◀ ▶ : échange avec la voisine, rayon renuméroté de 10 en 10 depuis son plus petit ordre", () => {
  const rayon = [p("G001", "A", 100), p("G002", "A", 110), p("G003", "A", 120)];
  assert.deepEqual(planDeplacement(rayon, "G002", "avant"), [{ id: "G002", ordre: 100 }, { id: "G001", ordre: 110 }]);
  assert.deepEqual(planDeplacement(rayon, "G002", "apres"), [{ id: "G003", ordre: 110 }, { id: "G002", ordre: 120 }]);
  assert.deepEqual(planDeplacement(rayon, "G001", "avant"), [], "déjà en tête");
  assert.deepEqual(planDeplacement(rayon, "G003", "apres"), [], "déjà au bout");
  assert.deepEqual(planDeplacement(rayon, "X999", "avant"), []);
  // Égalité d'ordre : le déplacement ne bloque pas.
  const egaux = [p("G001", "A", 50), p("G002", "A", 50)];
  assert.deepEqual(planDeplacement(egaux, "G002", "avant"), [{ id: "G001", ordre: 60 }]);
  assert.deepEqual(trierPhotos([{ ...egaux[0], ordre: 60 }, egaux[1]]).map((x) => x.id), ["G002", "G001"]);
});

test("conversion : url /api/modeles/<fichier>, jamais public/", () => {
  const photo = photoDepuisBase({ id: "P001", categorie: "A", produitCle: null, supplements: [], note: null, masquee: false, ordre: 10, fichier: "P001.webp", creePar: "Samira" });
  assert.equal(photo.url, "/api/modeles/P001.webp");
  assert.equal("creePar" in photo, false);
});
