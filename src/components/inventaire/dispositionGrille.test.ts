// node --test src/components/inventaire/dispositionGrille.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HAUTEUR_LIGNE_MAX,
  HAUTEUR_LIGNE_MIN,
  LARGEUR_CARACTERE,
  calculerDisposition,
  largeurColonnePourNom,
  libelleSousPage,
  scinderEnSousPages,
  type Disposition,
} from './dispositionGrille.ts';

// Zone de la grille mesurée en plein écran (marges de <main> 8 px, pavé à côté
// — 320 px en paysage ≥ 1024, 288 px en portrait —, écart 16 px, onglets
// compacts : une ligne de 52 px en paysage, deux lignes (≈ 98 px) en portrait).
const PAYSAGE = { largeur: 1180 - 16 - 320 - 16, hauteur: 820 - 16 - 52 }; // 828 × 752
const PORTRAIT = { largeur: 820 - 16 - 288 - 16, hauteur: 1180 - 16 - 98 }; // 500 × 1066

/** Invariants : tout tient, sans défilement, dans les bornes de hauteur. */
function verifierTient(d: Disposition, nb: number, zone: { largeur: number; hauteur: number }) {
  assert.ok(d.hauteurLigne >= HAUTEUR_LIGNE_MIN && d.hauteurLigne <= HAUTEUR_LIGNE_MAX, 'hauteur de ligne bornée');
  assert.ok(d.rangees * d.hauteurLigne <= zone.hauteur, 'les rangées tiennent dans la hauteur');
  assert.ok(d.colonnes * d.rangees >= d.parSousPage, 'chaque produit a sa case');
  assert.ok(d.parSousPage * d.sousPages >= nb, 'aucun produit perdu');
}

test('17 produits à 1180×820 (paysage, pavé à côté) : une page, 2 colonnes de 80 px (toute la hauteur sert)', () => {
  const d = calculerDisposition(17, PAYSAGE.largeur, PAYSAGE.hauteur);
  verifierTient(d, 17, PAYSAGE);
  assert.equal(d.sousPages, 1);
  assert.equal(d.colonnes, 2);
  assert.equal(d.hauteurLigne, 80);
  assert.ok(PAYSAGE.hauteur - d.rangees * d.hauteurLigne < 100, 'peu de place perdue sous la grille');
});

test('17 produits à 820×1180 (portrait, pavé à côté) : une page, 2 colonnes de 80 px', () => {
  const d = calculerDisposition(17, PORTRAIT.largeur, PORTRAIT.hauteur);
  verifierTient(d, 17, PORTRAIT);
  assert.equal(d.sousPages, 1);
  assert.equal(d.colonnes, 2);
  assert.equal(d.hauteurLigne, 80);
});

test('40 produits : tiennent sur une page dans les deux orientations', () => {
  const p = calculerDisposition(40, PAYSAGE.largeur, PAYSAGE.hauteur);
  verifierTient(p, 40, PAYSAGE);
  assert.equal(p.sousPages, 1);
  assert.equal(p.colonnes, 3);
  assert.equal(p.hauteurLigne, 53);

  const v = calculerDisposition(40, PORTRAIT.largeur, PORTRAIT.hauteur);
  verifierTient(v, 40, PORTRAIT);
  assert.equal(v.sousPages, 1);
  assert.equal(v.colonnes, 2);
  assert.equal(v.hauteurLigne, 53);
});

test('5 produits : une colonne, lignes au maximum (80 px)', () => {
  const d = calculerDisposition(5, PAYSAGE.largeur, PAYSAGE.hauteur);
  verifierTient(d, 5, PAYSAGE);
  assert.deepEqual(d, { colonnes: 1, rangees: 5, hauteurLigne: 80, sousPages: 1, parSousPage: 5 });
});

test('page impossible à faire tenir : découpée en sous-pages, jamais de défilement', () => {
  const d = calculerDisposition(80, PAYSAGE.largeur, PAYSAGE.hauteur);
  verifierTient(d, 80, PAYSAGE);
  assert.equal(d.sousPages, 2);
  assert.equal(d.parSousPage, 40);

  // Écran bas (8 rangées de 48 px, 1 colonne) : 17 produits → 3 sous-pages.
  const bas = calculerDisposition(17, 300, 400);
  verifierTient(bas, 17, { largeur: 300, hauteur: 400 });
  assert.equal(bas.sousPages, 3);
});

test('noms longs : la colonne s’élargit pour lire le nom ENTIER sur deux lignes (LOI 5)', () => {
  const long = 'Demi baguette grise aux céréales'.length; // 32
  assert.ok(largeurColonnePourNom(long) >= 16 * LARGEUR_CARACTERE);
  // Paysage : 2 colonnes au lieu de 3 pour 25 produits, toujours une seule page.
  const p = calculerDisposition(25, PAYSAGE.largeur, PAYSAGE.hauteur, long);
  verifierTient(p, 25, PAYSAGE);
  assert.equal(p.colonnes, 2);
  assert.equal(p.sousPages, 1);
  // Portrait : une seule colonne ; 17 produits tiennent encore sans défilement.
  const v = calculerDisposition(17, PORTRAIT.largeur, PORTRAIT.hauteur, long);
  verifierTient(v, 17, PORTRAIT);
  assert.equal(v.colonnes, 1);
  assert.equal(v.sousPages, 1);
  // 25 produits en portrait : découpés plutôt que de défiler.
  const v25 = calculerDisposition(25, PORTRAIT.largeur, PORTRAIT.hauteur, long);
  verifierTient(v25, 25, PORTRAIT);
  assert.equal(v25.sousPages, 2);
});

test('à hauteur de ligne égale, le moins de colonnes (noms moins tronqués)', () => {
  // 6 produits : 1 colonne → 6 × 80 = 480 ≤ 752, inutile d'en mettre deux.
  assert.equal(calculerDisposition(6, PAYSAGE.largeur, PAYSAGE.hauteur).colonnes, 1);
});

test('aucun produit : disposition neutre', () => {
  const d = calculerDisposition(0, PAYSAGE.largeur, PAYSAGE.hauteur);
  assert.equal(d.sousPages, 1);
  assert.equal(d.parSousPage, 0);
});

test('sous-pages équilibrées, ordre conservé', () => {
  const liste = Array.from({ length: 17 }, (_, i) => i + 1);
  const t = scinderEnSousPages(liste, 2);
  assert.deepEqual(t.map((x) => x.length), [9, 8]);
  assert.deepEqual(t.flat(), liste);
  assert.deepEqual(scinderEnSousPages(liste, 1), [liste]);
  assert.deepEqual(scinderEnSousPages([], 3), [[]]);
});

test('libellé : « Page 1 · 1/2 » seulement si la page est découpée', () => {
  assert.equal(libelleSousPage('Page 1', 0, 1), 'Page 1');
  assert.equal(libelleSousPage('Page 1', 0, 2), 'Page 1 · 1/2');
  assert.equal(libelleSousPage('Page 1', 1, 2), 'Page 1 · 2/2');
});
