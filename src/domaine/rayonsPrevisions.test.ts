import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireRayonsMasques, validerRayonsMasques } from './rayonsPrevisions.ts';

const R = ['Viennoiserie', 'Pains', 'Salé'];

test('rayons masqués : liste valide acceptée, doublons retirés', () => {
  const r = validerRayonsMasques(['Pains', 'Pains', 'Salé'], R);
  assert.ok(r.ok && r.donnees.join() === 'Pains,Salé');
  assert.ok(validerRayonsMasques([], R).ok);
});

test('rayons masqués : rayon inconnu, mauvais type ou TOUS masqués → refus', () => {
  for (const v of [['Inconnu'], 'Pains', [1], R]) {
    const r = validerRayonsMasques(v, R);
    assert.ok(!r.ok, JSON.stringify(v));
    if (!r.ok) assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
  }
});

test('lecture tolérante : absent ou illisible = rien de masqué', () => {
  assert.deepEqual(lireRayonsMasques(null), []);
  assert.deepEqual(lireRayonsMasques('pas du json'), []);
  assert.deepEqual(lireRayonsMasques('{"a":1}'), []);
  assert.deepEqual(lireRayonsMasques('["Pains"]'), ['Pains']);
});
