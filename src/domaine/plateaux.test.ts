// node --test src/domaine/plateaux.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  enPlateaux,
  estEnPlateauxEntiers,
  formaterPlateaux,
  piecesDePlateaux,
  sePlanifieEnPlateaux,
  suggestionEnPlateaux,
} from './plateaux.ts';

test('seuls les produits avec une contenance se planifient en plateaux', () => {
  assert.equal(sePlanifieEnPlateaux(16), true);
  for (const v of [null, undefined, 0, -16, 2.5]) assert.equal(sePlanifieEnPlateaux(v), false, String(v));
});

test('3 plateaux de 16 = 48 pièces stockées', () => {
  assert.equal(piecesDePlateaux(3, 16), 48);
  assert.equal(piecesDePlateaux(0, 16), 0);
});

test('décomposition : 48 → 3 plateaux, 53 → 3 plateaux + 5', () => {
  assert.deepEqual(enPlateaux(48, 16), { plateaux: 3, reste: 0 });
  assert.deepEqual(enPlateaux(53, 16), { plateaux: 3, reste: 5 });
  assert.deepEqual(enPlateaux(0, 16), { plateaux: 0, reste: 0 });
});

test('plateaux entiers uniquement : pas de demi-plateau', () => {
  assert.equal(estEnPlateauxEntiers(32, 16), true);
  assert.equal(estEnPlateauxEntiers(0, 16), true);
  assert.equal(estEnPlateauxEntiers(24, 16), false);
  assert.equal(estEnPlateauxEntiers(-16, 16), false);
});

test('suggestion : moyenne en pièces → plateau le plus proche, au moins 1', () => {
  assert.equal(suggestionEnPlateaux(40, 16), 3); // 2,5 → 3
  assert.equal(suggestionEnPlateaux(39, 16), 2);
  assert.equal(suggestionEnPlateaux(5, 16), 1);
  assert.equal(suggestionEnPlateaux(0, 16), null);
  assert.equal(suggestionEnPlateaux(null, 16), null);
});

test('affichage pour le fournil', () => {
  assert.equal(formaterPlateaux(16, 16), '1 plateau');
  assert.equal(formaterPlateaux(48, 16), '3 plateaux');
  assert.equal(formaterPlateaux(53, 16), '3 plateaux + 5 pièces');
  assert.equal(formaterPlateaux(17, 16), '1 plateau + 1 pièce');
});
