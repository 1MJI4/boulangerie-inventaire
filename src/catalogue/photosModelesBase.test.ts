// Galerie de photos EN BASE (src/catalogue/photosModelesBase.ts), sur un faux
// dépôt en mémoire : lecture, ajout, modification, masquage, ◀ ▶, et
// traduction des erreurs de la base (LOI 9). Aucun prix écrit en dur (LOI 1).

import { test } from "node:test";
import assert from "node:assert/strict";
import { creerGaleriePhotos, type ChampsPhotoModifiables, type DepotPhotosModeles } from "./photosModelesBase.ts";
import type { CatalogueDesPhotos, LignePhotoBase } from "./photosModeles.ts";
import { definirDestination } from "../lib/journal.ts";

// Journal silencieux pendant les tests.
definirDestination(() => {});

const GATEAU = "gateaux-sur-commande/layer-cake";
const SUPPLEMENT = "gateaux-sur-commande/supplement-pate-a-sucre";
const AUJOURDHUI = "2026-10-26";

const CATALOGUE: CatalogueDesPhotos = {
  getProduit(cle) {
    if (cle === GATEAU) return { ok: true, donnees: { produit: "Layer Cake", famille: "patisserie", actif: true }, signalements: [] };
    if (cle === SUPPLEMENT) return { ok: true, donnees: { produit: "Pâte à sucre", famille: "supplement", actif: true }, signalements: [] };
    return { ok: false, niveau: "bloquant", code: "ERR_PRODUIT_INCONNU", message: "Ce produit n’est pas dans le catalogue." };
  },
  getPrix: () => ({ ok: true, donnees: {}, signalements: [] }),
};

function ligne(id: string, categorie: string, ordre: number, extra: Partial<LignePhotoBase> = {}): LignePhotoBase {
  return { id, categorie, produitCle: GATEAU, supplements: [], note: null, masquee: false, ordre, fichier: `${id}.jpg`, creePar: null, ...extra };
}

type Journal = { reserves: number; insertions: LignePhotoBase[]; modifications: { id: string; champs: ChampsPhotoModifiables }[]; images: string[] };

function fauxDepot(initiales: LignePhotoBase[], options: { panne?: unknown } = {}): { depot: DepotPhotosModeles; table: Map<string, LignePhotoBase>; j: Journal } {
  const table = new Map(initiales.map((l) => [l.id, { ...l }]));
  const j: Journal = { reserves: 0, insertions: [], modifications: [], images: [] };
  let seq = 0;
  const depot: DepotPhotosModeles = {
    async lirePhotos({ inclureMasquees }) {
      if (options.panne) throw options.panne;
      return [...table.values()].filter((l) => inclureMasquees || !l.masquee).map((l) => ({ ...l }));
    },
    async lirePhoto(id) {
      const l = table.get(id);
      return l ? { ...l } : null;
    },
    async reserverId() {
      j.reserves++;
      return `P${String(++seq).padStart(3, "0")}`;
    },
    async inserer(l) {
      const neuve = { ...l, masquee: false };
      j.insertions.push(neuve);
      table.set(l.id, neuve);
      return { ...neuve };
    },
    async modifier(id, champs) {
      j.modifications.push({ id, champs });
      const l = { ...table.get(id)!, ...champs };
      table.set(id, l);
      return { ...l };
    },
    transaction: (travail) => travail(depot),
  };
  return { depot, table, j };
}

const OPTIONS = { aujourdhui: () => AUJOURDHUI };
const INITIALES = [ligne("G001", "Bavarois", 10), ligne("G002", "Bavarois", 20, { note: "Forêt noire" }), ligne("G003", "Layer Cake", 30), ligne("G004", "Bavarois", 40, { masquee: true })];

test("lecture : galerie de la vendeuse sans les photos masquées ; écran du gérant avec", async () => {
  const { depot } = fauxDepot(INITIALES);
  const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
  const vendeuse = await g.listerPhotosModeles();
  assert.ok(vendeuse.ok);
  assert.deepEqual(vendeuse.donnees.map((p) => p.id), ["G001", "G002", "G003"]);
  assert.equal(vendeuse.donnees[0].url, "/api/modeles/G001.jpg");
  const gerant = await g.listerPhotosModeles({ inclureMasquees: true });
  assert.ok(gerant.ok && gerant.donnees.length === 4);
  const bavarois = await g.listerPhotosModeles({ categorie: "Layer Cake" });
  assert.ok(bavarois.ok && bavarois.donnees.length === 1);
  const rayons = await g.categoriesPhotosModeles();
  assert.deepEqual(rayons.ok && rayons.donnees, ["Bavarois", "Layer Cake"]);
});

test("lecture : getPhotoModele renvoie une photo masquée (citée par d'anciennes commandes) ; inconnue refusée", async () => {
  const g = creerGaleriePhotos(fauxDepot(INITIALES).depot, CATALOGUE, OPTIONS);
  const m = await g.getPhotoModele("G004");
  assert.ok(m.ok && m.donnees.masquee === true);
  const x = await g.getPhotoModele("G999");
  assert.ok(!x.ok && x.code === "ERR_SAISIE_INVALIDE" && x.champ === "photoModele");
  const f = await g.getPhotoModele("g001");
  assert.ok(!f.ok && f.code === "ERR_SAISIE_INVALIDE");
});

test("ajout : identifiant 'P…' réservé, image écrite AVANT la ligne, photo en fin de rayon", async () => {
  const { depot, j } = fauxDepot(INITIALES);
  const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
  const ordreAppels: string[] = [];
  const origInserer = depot.inserer;
  depot.inserer = async (l) => {
    ordreAppels.push("ligne");
    return origInserer(l);
  };
  const r = await g.creerPhotoModele({
    categorie: "Bavarois",
    produit: GATEAU,
    supplements: [SUPPLEMENT],
    note: " 2 étages ",
    extension: "JPG",
    creePar: "Samira",
    enregistrerImage: async (f) => {
      ordreAppels.push("image");
      j.images.push(f);
    },
  });
  assert.ok(r.ok, r.ok ? "" : r.message);
  assert.equal(r.donnees.id, "P001");
  assert.equal(r.donnees.url, "/api/modeles/P001.jpg");
  assert.equal(r.donnees.note, "2 étages");
  assert.equal(r.donnees.ordre, 50, "après G004 (masquée comprise)");
  assert.deepEqual(j.images, ["P001.jpg"]);
  assert.deepEqual(ordreAppels, ["image", "ligne"]);
  assert.equal(j.insertions[0].creePar, "Samira");
});

test("ajout : toute saisie refusée l'est AVANT la base (aucun numéro consommé, aucune image écrite)", async () => {
  const cas: [string, Record<string, unknown>, string, string][] = [
    ["note avec prix", { note: "5 € la part" }, "ERR_SAISIE_INVALIDE", "note"],
    ["rayon vide", { categorie: " " }, "ERR_CHAMP_OBLIGATOIRE", "categorie"],
    ["rayon à la casse près", { categorie: "bavarois" }, "ERR_SAISIE_INVALIDE", "categorie"],
    ["produit inconnu", { produit: "x/inconnu" }, "ERR_PRODUIT_INCONNU", "produit"],
    ["supplément cité comme produit", { produit: SUPPLEMENT }, "ERR_SAISIE_INVALIDE", "produit"],
    ["gâteau cité comme supplément", { supplements: [GATEAU] }, "ERR_SAISIE_INVALIDE", "supplements"],
    ["image GIF", { extension: "gif" }, "ERR_SAISIE_INVALIDE", "fichier"],
    ["prénom manquant", { creePar: "" }, "ERR_CHAMP_OBLIGATOIRE", "creePar"],
  ];
  for (const [nom, modif, code, champ] of cas) {
    const { depot, j } = fauxDepot(INITIALES);
    const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
    const r = await g.creerPhotoModele({
      categorie: "Bavarois",
      produit: null,
      supplements: [],
      note: null,
      extension: "jpg",
      creePar: "Samira",
      enregistrerImage: async (f) => void j.images.push(f),
      ...modif,
    } as Parameters<typeof g.creerPhotoModele>[0]);
    assert.ok(!r.ok, nom);
    assert.equal(r.code, code, nom);
    assert.equal(r.champ, champ, nom);
    assert.equal(j.reserves, 0, `${nom} : aucun numéro consommé`);
    assert.equal(j.images.length, 0, `${nom} : aucune image écrite`);
    assert.equal(j.insertions.length, 0, nom);
  }
});

test("modification : rangée dans un autre rayon → à la fin de celui-ci ; seuls les champs changés sont écrits", async () => {
  const { depot, j } = fauxDepot(INITIALES);
  const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
  const r = await g.modifierPhotoModele("G001", { categorie: "Layer Cake", note: "" });
  assert.ok(r.ok);
  assert.equal(r.donnees.categorie, "Layer Cake");
  assert.equal(r.donnees.ordre, 40);
  assert.deepEqual(j.modifications, [{ id: "G001", champs: { categorie: "Layer Cake", ordre: 40 } }], "note déjà vide : non réécrite");
  const rien = await g.modifierPhotoModele("G002", { note: "Forêt noire" });
  assert.ok(rien.ok);
  assert.equal(j.modifications.length, 1, "rien à écrire");
});

test("modification : produit contrôlé seulement s'il change ; note avec prix refusée ; photo inconnue refusée", async () => {
  // G003 rattachée à un produit que le catalogue ne connaît plus : on corrige quand même sa note.
  const { depot } = fauxDepot([ligne("G003", "Layer Cake", 30, { produitCle: "x/archive" })]);
  const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
  assert.ok((await g.modifierPhotoModele("G003", { note: "Layer cake cœur" })).ok);
  const p = await g.modifierPhotoModele("G003", { produit: "x/autre" });
  assert.ok(!p.ok && p.code === "ERR_PRODUIT_INCONNU" && p.champ === "produit");
  const n = await g.modifierPhotoModele("G003", { note: "6,5" });
  assert.ok(!n.ok && n.champ === "note");
  const s = await g.modifierPhotoModele("G003", { supplements: [SUPPLEMENT] });
  assert.ok(s.ok && s.donnees.supplements?.[0] === SUPPLEMENT);
  const x = await g.modifierPhotoModele("G999", { note: "x" });
  assert.ok(!x.ok && x.code === "ERR_SAISIE_INVALIDE");
});

test("masquer / remettre : jamais de suppression, idempotent", async () => {
  const { depot, j, table } = fauxDepot(INITIALES);
  const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
  assert.ok((await g.masquerPhotoModele("G001", true)).ok);
  assert.equal(table.get("G001")!.masquee, true);
  assert.ok((await g.masquerPhotoModele("G001", true)).ok);
  assert.equal(j.modifications.length, 1, "déjà masquée : rien écrit");
  assert.ok((await g.masquerPhotoModele("G001", false)).ok);
  assert.equal(table.size, INITIALES.length);
});

test("◀ ▶ : échange dans le rayon (masquées comprises), rayon renvoyé dans le nouvel ordre", async () => {
  const { depot } = fauxDepot(INITIALES);
  const g = creerGaleriePhotos(depot, CATALOGUE, OPTIONS);
  const r = await g.deplacerPhotoModele("G002", "avant");
  assert.ok(r.ok);
  assert.deepEqual(r.donnees.map((p) => p.id), ["G002", "G001", "G004"]);
  const bout = await g.deplacerPhotoModele("G004", "apres");
  assert.ok(bout.ok && bout.donnees.map((p) => p.id).join() === "G002,G001,G004");
  const sens = await g.deplacerPhotoModele("G001", "haut" as "avant");
  assert.ok(!sens.ok && sens.code === "ERR_SAISIE_INVALIDE");
});

test("erreur de la base : message en français, jamais le texte PostgreSQL (LOI 9)", async () => {
  const panne = Object.assign(new Error('new row for relation "PhotoModele" violates check constraint "PhotoModele_note_valide"'), {
    name: "PrismaClientKnownRequestError",
    code: "P2010",
    meta: { code: "23514", message: 'violates check constraint "PhotoModele_note_valide"' },
  });
  const g = creerGaleriePhotos(fauxDepot(INITIALES, { panne }).depot, CATALOGUE, OPTIONS);
  const r = await g.listerPhotosModeles();
  assert.ok(!r.ok);
  assert.match(r.code, /^ERR_/);
  assert.doesNotMatch(r.message, /constraint|PhotoModele|relation|P2010/);
  assert.equal("error" in r, false);
});
