import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerQuantiteStock, QUANTITE_STOCK_MAX } from './stock.ts';

test('stock : vide = pas encore compté (null), 0 est un vrai comptage', () => {
  for (const v of [null, undefined, '']) {
    const r = validerQuantiteStock(v, 'x');
    assert.ok(r.ok && r.donnees === null);
  }
  const zero = validerQuantiteStock(0, 'x');
  assert.ok(zero.ok && zero.donnees === 0);
});

test('stock : entiers acceptés, texte numérique converti', () => {
  const a = validerQuantiteStock(12, 'x');
  const b = validerQuantiteStock('7', 'x');
  assert.ok(a.ok && a.donnees === 12);
  assert.ok(b.ok && b.donnees === 7);
});

test('stock : négatif, décimal, texte, trop grand → refus typé en français', () => {
  for (const v of [-1, 2.5, 'abc', '1,5', QUANTITE_STOCK_MAX + 1, NaN]) {
    const r = validerQuantiteStock(v, 'produit:3');
    assert.ok(!r.ok, String(v));
    if (!r.ok) {
      assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
      assert.equal(r.champ, 'produit:3');
    }
  }
});
