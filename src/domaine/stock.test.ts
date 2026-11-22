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

import { mettreEnPageStock } from './stock.ts';

const art = (c: string, n: number) => Array.from({ length: n }, (_, i) => ({ nom: `${c}${i}`, categorie: c, quantite: i === 0 ? 3 : null }));

test('feuille : une barre titre par catégorie, quantités gardées', () => {
  const pages = mettreEnPageStock([...art('A', 2), ...art('B', 1)], 10);
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0][0].map((l) => l.genre), ['titre', 'article', 'article', 'titre', 'article']);
  const premier = pages[0][0][1];
  assert.ok(premier.genre === 'article' && premier.quantite === 3);
});

test('feuille : deux colonnes par page, jamais de titre orphelin en bas de colonne', () => {
  const pages = mettreEnPageStock([...art('A', 3), ...art('B', 5)], 5);
  for (const p of pages) for (const col of p) {
    assert.ok(col.length <= 5);
    assert.notEqual(col[col.length - 1].genre, 'titre');
  }
  const total = pages.flat(2).filter((l) => l.genre === 'article').length;
  assert.equal(total, 8);
  assert.ok(pages.every((p) => p.length <= 2));
});

test('feuille : liste vide → aucune page', () => {
  assert.deepEqual(mettreEnPageStock([], 10), []);
});
