// node --test src/domaine/produitsProposes.test.ts
// Produits proposés par les vendeurs au comptage (propriétaire, 21/11/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memeNomDeProduit, normaliserNomProduit, validerProposition } from './produitsProposes.ts';

test('noms : accents, casse, ponctuation et espaces ne font pas un autre produit', () => {
  assert.equal(normaliserNomProduit('  Bàgnat   Blanc '), 'bagnat blanc');
  assert.equal(memeNomDeProduit('Pain shawarma - bagnat blanc', 'pain SHAWARMA bagnat blanc'), true);
  assert.equal(memeNomDeProduit('Éclair chocolat', 'eclair chocolat'), true);
  assert.equal(memeNomDeProduit('Éclair chocolat', 'Éclair moka'), false);
  assert.equal(memeNomDeProduit('???', '---'), false, 'rien de lisible : jamais « le même »');
});

test('proposition : nom lisible obligatoire, reste facultatif mais entier positif ou nul', () => {
  const ok = validerProposition('  Smoothie   Myrtille ', '12');
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.donnees, { nom: 'Smoothie Myrtille', quantite: 12 });
  const sans = validerProposition('Smoothie', '');
  assert.ok(sans.ok && sans.donnees.quantite === null);
  const zero = validerProposition('Smoothie', 0);
  assert.ok(zero.ok && zero.donnees.quantite === 0, '0 est un comptage');
  for (const quantite of [-1, 2.5, 'abc', 100_000]) assert.equal(validerProposition('Smoothie', quantite).ok, false, String(quantite));
  for (const nom of ['', ' ', 'a', '---', 'x'.repeat(81)]) {
    const r = validerProposition(nom, 1);
    assert.equal(r.ok, false, nom);
    if (!r.ok) assert.match(r.code, /^ERR_/);
  }
});
