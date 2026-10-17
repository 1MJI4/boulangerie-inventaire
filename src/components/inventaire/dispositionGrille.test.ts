// node --test src/components/inventaire/dispositionGrille.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HAUTEUR_LIGNE_MAX,
  HAUTEUR_LIGNE_MIN,
  POLICE_NOM_MIN,
  calculerDisposition,
  largeurColonne,
  largeurHorsNom,
  lignesDuNom,
  policeNom,
  policeNomNormale,
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
  assert.deepEqual(d, { colonnes: 1, rangees: 5, hauteurLigne: 80, sousPages: 1, parSousPage: 5, policeNomMin: 18 });
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

// --- Réserve m2 (qa-metier) : un nom très long ne déborde jamais sur la ligne voisine ---

/** 120 caractères, à la lettre : un nom n'est jamais raccourci (LOI 5). */
const NOM_120 = 'Assortiment de pâtisseries orientales au miel et aux amandes grillées, boîte familiale de fête avec cornes de gazelle et makrouts'.slice(0, 120);

/** Une page de `n` produits dont le premier porte le nom de 120 caractères. */
function pageAvecNomLong(n: number, unite: 'piece' | 'kg') {
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? { nom: NOM_120, unite } : { nom: 'Pain gris', unite: 'piece' as const }
  );
}

/** Chaque nom tient ENTIER dans sa ligne, à 13 px au moins, sans dépasser la hauteur. */
function verifierNomsContenus(
  d: Disposition,
  zone: { largeur: number },
  produits: readonly { nom: string; unite: 'piece' | 'kg' }[]
) {
  const h = d.hauteurLigne;
  for (const p of produits) {
    const largeurNom = largeurColonne(zone.largeur, d.colonnes) - largeurHorsNom(h, p.unite);
    const police = policeNom(p.nom, largeurNom, h);
    assert.notEqual(police, null, `« ${p.nom} » tient dans sa ligne`);
    assert.ok(police! >= POLICE_NOM_MIN, 'police jamais sous 13 px');
    assert.ok(lignesDuNom(p.nom, largeurNom, police!) * police! * 1.25 <= h - 1, 'aucun débordement vertical');
  }
  assert.ok(d.policeNomMin >= POLICE_NOM_MIN);
}

test('largeur hors nom : le champ kg (w-28) et l’icône de niveau sont comptés', () => {
  // Grande ligne (≥ 64 px) : marges 16 + écart 6 + « 0 » 56 + écart 8 + champ + icône 22.
  assert.equal(largeurHorsNom(80, 'piece'), 16 + 6 + 56 + 8 + 80 + 22);
  assert.equal(largeurHorsNom(80, 'kg'), 16 + 6 + 56 + 8 + 112 + 22);
  // Ligne normale : « 0 » 44, champ w-16 / w-24.
  assert.equal(largeurHorsNom(53, 'piece'), 16 + 6 + 44 + 8 + 64 + 22);
  assert.equal(largeurHorsNom(53, 'kg'), 16 + 6 + 44 + 8 + 96 + 22);
  // L'ancienne estimation (164 px) sous-estimait la ligne kg de 56 px.
  assert.ok(largeurHorsNom(80, 'kg') - 164 >= 56);
});

test('police du nom : normale si possible, réduite jusqu’à 13 px, sinon null (sous-pages)', () => {
  assert.equal(policeNomNormale(80), 18);
  assert.equal(policeNomNormale(53), 15);
  assert.equal(policeNom('Pain gris', 300, 53), 15);
  // 120 caractères dans 340 px (portrait, pièce) à 62 px de haut : ne tient qu’en réduisant.
  const reduite = policeNom(NOM_120, 340, 62);
  assert.ok(reduite !== null && reduite < 15 && reduite >= POLICE_NOM_MIN);
  // Dans 190 px à 80 px de haut : même à 13 px, impossible → null.
  assert.equal(policeNom(NOM_120, 190, 80), null);
  // Retour à la ligne aux espaces ; mot trop long coupé.
  assert.equal(lignesDuNom('aa bb', 10 * (15 * 10 / 18), 15), 1);
  assert.equal(lignesDuNom('aaaa bbbb', 5 * (15 * 10 / 18), 15), 2);
  assert.equal(lignesDuNom('a'.repeat(12), 5 * (15 * 10 / 18), 15), 3);
});

test('120 caractères en PORTRAIT, à la pièce : une page, police réduite, nom contenu', () => {
  const produits = pageAvecNomLong(17, 'piece');
  const d = calculerDisposition(17, PORTRAIT.largeur, PORTRAIT.hauteur, produits);
  verifierTient(d, 17, PORTRAIT);
  verifierNomsContenus(d, PORTRAIT, produits);
  assert.equal(d.sousPages, 1, 'réduire la police avant de découper');
  assert.equal(d.colonnes, 1);
  assert.ok(d.policeNomMin < policeNomNormale(d.hauteurLigne), 'police du nom réduite');
});

test('120 caractères en PORTRAIT, produit au KILO : le champ plus large impose des sous-pages', () => {
  const produits = pageAvecNomLong(17, 'kg');
  const d = calculerDisposition(17, PORTRAIT.largeur, PORTRAIT.hauteur, produits);
  verifierTient(d, 17, PORTRAIT);
  verifierNomsContenus(d, PORTRAIT, produits);
  assert.equal(d.sousPages, 2, 'dernier recours : sous-pages plutôt que déborder');
  assert.equal(d.hauteurLigne, 80);
});

test('120 caractères en PAYSAGE (pièce et kg) : une colonne pleine largeur, jamais de débordement', () => {
  for (const unite of ['piece', 'kg'] as const) {
    for (const nb of [17, 22, 40]) {
      const produits = pageAvecNomLong(nb, unite);
      const d = calculerDisposition(nb, PAYSAGE.largeur, PAYSAGE.hauteur, produits);
      verifierTient(d, nb, PAYSAGE);
      verifierNomsContenus(d, PAYSAGE, produits);
      assert.equal(d.colonnes, 1, `${nb} ${unite} : deux colonnes laisseraient déborder le nom`);
    }
  }
  // Sans le nom long, 22 produits tiennent sur une page : c'est bien le nom qui découpe.
  const courts = pageAvecNomLong(22, 'piece').slice(1);
  assert.equal(calculerDisposition(22, PORTRAIT.largeur, PORTRAIT.hauteur, courts).sousPages, 1);
  assert.equal(calculerDisposition(22, PORTRAIT.largeur, PORTRAIT.hauteur, pageAvecNomLong(22, 'piece')).sousPages, 2);
});

test('sans la liste des produits (longueur seule) : on suppose le champ kg, jamais moins prudent', () => {
  const nombre = calculerDisposition(17, PORTRAIT.largeur, PORTRAIT.hauteur, 120);
  verifierTient(nombre, 17, PORTRAIT);
  verifierNomsContenus(nombre, PORTRAIT, [{ nom: 'x'.repeat(120), unite: 'kg' }]);
});

test('écran minuscule : un produit par sous-page, la ligne prend la hauteur pour garder le nom entier', () => {
  const produits = pageAvecNomLong(10, 'kg');
  const d = calculerDisposition(10, 300, 500, produits);
  assert.equal(d.sousPages, 10);
  assert.equal(d.parSousPage, 1);
  assert.ok(d.hauteurLigne <= 500);
  verifierNomsContenus(d, { largeur: 300 }, produits);
});
