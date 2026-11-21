// Comptage de la Glory (propriétaire, 17/11/2026) : pièces et billets par coupure.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COUPURES_CENTIMES, libelleCoupure, natureCoupure, totauxCaisse } from './caisse.ts';

test('Glory : les dix coupures demandées, pièces puis billets', () => {
  assert.deepEqual(COUPURES_CENTIMES.map(libelleCoupure), [
    '5 cents', '10 cents', '20 cents', '50 cents', '1 €', '2 €', '5 €', '10 €', '20 €', '50 €',
  ]);
  assert.deepEqual(COUPURES_CENTIMES.map(natureCoupure), [
    'piece', 'piece', 'piece', 'piece', 'piece', 'piece', 'billet', 'billet', 'billet', 'billet',
  ]);
});

test('Glory : totaux en centimes, pièces et billets séparés, sans flottant', () => {
  // 3 × 10 cents + 7 × 20 cents = 30 + 140 ; jamais 0,1 + 0,2 = 0,30000000000000004.
  const t = totauxCaisse({ 10: 3, 20: 7, 200: 4, 500: 2, 5000: 1 });
  assert.equal(t.totalPieces, 30 + 140 + 800);
  assert.equal(t.totalBillets, 1000 + 5000);
  assert.equal(t.total, 6970);
  assert.deepEqual(t.nonComptees, [5, 50, 100, 1000, 2000]);
});

test('Glory : zéro est un comptage, une case vide n’en est pas un', () => {
  const t = totauxCaisse({ 5: 0 });
  assert.equal(t.parCoupure[0].montant, 0);
  assert.ok(!t.nonComptees.includes(5));
  assert.equal(totauxCaisse({}).total, 0);
});

test('Glory : un nombre négatif ou décimal est refusé', () => {
  assert.throws(() => totauxCaisse({ 100: -1 }), RangeError);
  assert.throws(() => totauxCaisse({ 100: 1.5 }), RangeError);
});
