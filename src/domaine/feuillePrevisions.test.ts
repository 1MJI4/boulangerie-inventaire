// node --test src/domaine/feuillePrevisions.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireFeuille, quantiteDeLigne, type LignePrevision } from './feuillePrevisions.ts';

const ligne = (nom: string, extra: Partial<LignePrevision> = {}): LignePrevision => ({
  nom,
  quantitePrevue: 10,
  quantiteCommande: null,
  commandeAuto: null,
  plateauCommandes: null,
  piecesParPlateau: null,
  derives: '',
  ...extra,
});

test('une ligne sur deux est noire, la première de chaque rayon est blanche', () => {
  const f = construireFeuille({
    titre: 'Feuille pâtissier',
    dateLongue: 'samedi 21 novembre 2026',
    sections: [
      { titre: 'Viennoiserie', lignes: [ligne('A'), ligne('B'), ligne('C'), ligne('D')] },
      { titre: 'Pâtisserie', lignes: [ligne('E'), ligne('F')] },
    ],
  });
  assert.deepEqual(f.sections[0].lignes.map((l) => l.inverse), [false, true, false, true]);
  assert.deepEqual(f.sections[1].lignes.map((l) => l.inverse), [false, true]);
});

test('une pièce : le total à produire, avec la part commandée dessous', () => {
  const q = quantiteDeLigne(ligne('Baguette', { quantitePrevue: 20, quantiteCommande: 5, commandeAuto: 3, plateauCommandes: 2 }));
  assert.equal(q.quantite, '22');
  assert.equal(q.precision, 'dont 8 commandés');
  assert.equal(q.pieces, 22);
});

test('sans commande : pas de précision', () => {
  assert.equal(quantiteDeLigne(ligne('Pain')).precision, null);
});

test('plateaux : le gros chiffre est le nombre de plateaux, les pièces dessous (LOI 2)', () => {
  const q = quantiteDeLigne(ligne('Croissant', { quantitePrevue: 53, piecesParPlateau: 16 }));
  assert.equal(q.quantite, '3 plateaux');
  assert.equal(q.precision, '3 plateaux + 5 pièces · = 53 pièces');
  const un = quantiteDeLigne(ligne('Couque', { quantitePrevue: 16, piecesParPlateau: 16 }));
  assert.equal(un.quantite, '1 plateau');
});

test('plateaux : la part commandée reste en pièces, les dérivés sont dits', () => {
  const q = quantiteDeLigne(
    ligne('Croissant', { quantitePrevue: 48, quantiteCommande: 0, commandeAuto: 7, piecesParPlateau: 16, derives: 'dont 7 Croissant à la pâte d’amande' }),
  );
  assert.equal(q.precision, '= 48 pièces · + 7 pièces commandées · dont 7 Croissant à la pâte d’amande');
});

test('total et nombre de références comptés sur les lignes imprimées', () => {
  const f = construireFeuille({
    titre: 'Feuille boulanger',
    dateLongue: 'samedi 21 novembre 2026',
    sections: [
      { titre: 'Pains', lignes: [ligne('A', { quantitePrevue: 4 }), ligne('B', { quantitePrevue: 6 })] },
      { titre: 'Vide', lignes: [] },
    ],
  });
  assert.equal(f.references, 2);
  assert.equal(f.totalPieces, 10);
  assert.equal(f.sections.length, 1, 'un rayon sans ligne n’est pas imprimé');
  assert.equal(f.sousTitre, 'À produire pour le samedi 21 novembre 2026');
});
