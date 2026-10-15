// node --test src/domaine/argent.test.ts
// Arithmétique pure sur des centimes : nombres FICTIFS, aucun prix du catalogue ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formaterEuros, lireMontant, multiplier, partMinimale, prixAuPoids, resteDu, somme } from './argent.ts';

test('lireMontant : virgule, point, euros entiers, symbole, espaces → centimes entiers', () => {
  const cas: [string, number][] = [
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.05', 1205],
    ['0,10', 10],
    [' 12,50 € ', 1250],
    ['1 234,50', 123450], // invariant-ok: exemple de format
  ];
  for (const [texte, attendu] of cas) {
    const r = lireMontant(texte);
    assert.ok(r.ok, texte);
    assert.equal(r.donnees, attendu, texte);
    assert.ok(Number.isInteger(r.donnees));
  }
});

test('lireMontant : refuse ce qui n’est pas un montant, avec un message humain', () => {
  for (const texte of ['', 'abc', '-5', '12,505', '1.234,50', '12,', ',5']) { // invariant-ok: exemple de format
    const r = lireMontant(texte, 'acompte');
    assert.equal(r.ok, false, texte);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
      assert.equal(r.champ, 'acompte');
      assert.match(r.message, /acompte/);
    }
  }
});

test('lireMontant : pas de dérive flottante (0,29 → 29, pas 28)', () => {
  const r = lireMontant('0,29');
  assert.ok(r.ok);
  assert.equal(r.donnees, 29);
});

test('formaterEuros : format unique', () => {
  assert.equal(formaterEuros(0), '0,00 €');
  assert.equal(formaterEuros(5), '0,05 €');
  assert.equal(formaterEuros(1205), '12,05 €'); // invariant-ok: exemple de format
  assert.equal(formaterEuros(123450), '1 234,50 €'); // invariant-ok: exemple de format
  assert.equal(formaterEuros(-250), '-2,50 €');
  assert.throws(() => formaterEuros(12.5), RangeError);
});

test('multiplier : entiers seulement', () => {
  assert.equal(multiplier(40, 301), 12040);
  assert.throws(() => multiplier(1.5, 100), RangeError);
  assert.throws(() => multiplier(2, 1.3), RangeError);
});

test('prixAuPoids : 750 g × 1000 c/kg (fictif) = 750 c exactement', () => {
  assert.equal(prixAuPoids(750, 1000), 750);
  assert.equal(prixAuPoids(750, 1300), 975);
});

test('prixAuPoids : arrondi half-up au centime', () => {
  assert.equal(prixAuPoids(5, 100), 1); // 0,5 c → 1 (demi exact)
  assert.equal(prixAuPoids(1, 1400), 1); // 1,4 c → 1
  assert.equal(prixAuPoids(1, 1600), 2); // 1,6 c → 2
  assert.equal(prixAuPoids(333, 1700), 566); // 566,1 c → 566
  assert.equal(prixAuPoids(1000, 1300), 1300);
  assert.equal(prixAuPoids(0, 1300), 0);
  assert.throws(() => prixAuPoids(0.75, 1000), RangeError);
  assert.throws(() => prixAuPoids(-1, 1000), RangeError);
});

test('somme et resteDu : jamais négatif', () => {
  assert.equal(somme([]), 0);
  assert.equal(somme([12040, 660]), 12700);
  assert.throws(() => somme([1, 0.5]), RangeError);
  assert.equal(resteDu(12700, 5000), 7700);
  assert.equal(resteDu(1000, 5000), 0);
});

test('partMinimale : pourcentage entier, arrondi au centime supérieur, en entiers', () => {
  assert.equal(partMinimale(9000, 50), 4500);
  assert.equal(partMinimale(2931, 50), 1466);
  assert.equal(partMinimale(1, 50), 1);
  assert.equal(partMinimale(0, 50), 0);
  assert.equal(partMinimale(1000, 33), 330);
  assert.equal(partMinimale(1001, 33), 331);
  assert.equal(partMinimale(1234, 100), 1234);
  assert.throws(() => partMinimale(12.5, 50), RangeError);
  assert.throws(() => partMinimale(100, 101), RangeError);
  assert.throws(() => partMinimale(100, 50.5), RangeError);
});
