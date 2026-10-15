// node --test src/domaine/unites.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formaterQuantite, lirePieces, lirePoids, totalLigne, validerQuantite } from './unites.ts';

test('validerQuantite pièce : entier > 0', () => {
  assert.equal(validerQuantite('piece', 12).ok, true);
  for (const q of [0, -3, Number.NaN]) {
    const r = validerQuantite('piece', q);
    assert.equal(r.ok, false, String(q));
    if (!r.ok) assert.equal(r.code, 'ERR_QUANTITE_INVALIDE');
  }
});

test('validerQuantite pièce décimale : refus avec l’entier le plus proche proposé', () => {
  const r = validerQuantite('piece', 2.6);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, 3);
    assert.match(r.message, /nombre entier de pièces/);
  }
  const r2 = validerQuantite('piece', 0.2);
  if (!r2.ok) assert.equal(r2.valeurProposee, 1);
});

test('validerQuantite kg : grammes entiers > 0 ; poids nul refusé', () => {
  assert.equal(validerQuantite('kg', 750).ok, true);
  const r = validerQuantite('kg', 0);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_QUANTITE_INVALIDE');
    assert.match(r.message, /poids/);
  }
  assert.equal(validerQuantite('kg', 0.75).ok, false, '0,75 « kg » envoyé à la place de 750 g');
});

test('totalLigne : pièce = quantité × prix ; kg = grammes × prix/kg half-up', () => {
  const p = totalLigne('piece', 3, 111);
  assert.ok(p.ok);
  assert.equal(p.donnees, 333);
  const k = totalLigne('kg', 750, 1000); // prix fictif
  assert.ok(k.ok);
  assert.equal(k.donnees, 750);
});

test('totalLigne : le même nombre ne donne pas le même total selon l’unité (kg ≠ pièce)', () => {
  const k = totalLigne('kg', 2, 1000);
  const p = totalLigne('piece', 2, 1000);
  assert.ok(k.ok && p.ok);
  assert.notEqual(k.donnees, p.donnees);
  assert.equal(totalLigne('piece', 1, 0).ok, false);
});

test('lirePoids : pavé décimal → grammes, sans flottant', () => {
  const cas: [string, number][] = [
    ['0,750', 750],
    ['0.75', 750],
    ['1,2 kg', 1200],
    ['2', 2000],
    ['0,001', 1],
    ['0', 0],
  ];
  for (const [t, g] of cas) {
    const r = lirePoids(t);
    assert.ok(r.ok, t);
    assert.equal(r.donnees, g, t);
  }
  for (const t of ['', 'abc', '0,7505', '-1', '1,2,3']) assert.equal(lirePoids(t).ok, false, t);
});

test('lirePieces : entier sans décimale', () => {
  const r = lirePieces(' 12 ');
  assert.ok(r.ok);
  assert.equal(r.donnees, 12);
  assert.equal(lirePieces('2,5').ok, false);
  assert.equal(lirePieces('-1').ok, false);
});

test('formaterQuantite : « kg » affiché pour un produit au kilo', () => {
  assert.equal(formaterQuantite('kg', 750), '0,750 kg');
  assert.equal(formaterQuantite('kg', 12050), '12,050 kg');
  assert.equal(formaterQuantite('piece', 12), '12');
});
