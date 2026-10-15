// node --test src/components/rappels/tests/rappels.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { choisirRappel, noterVu, tailleMemoire, validerRappels, type Rappel } from '../rappels.ts';

const fixture = JSON.parse(readFileSync(new URL('./rappels-fixture.json', import.meta.url), 'utf8'));
const { rappels } = validerRappels(fixture);

const fixe = (x: number) => () => x;

test('fixture valide : 4 rappels, aucun défaut', () => {
  const v = validerRappels(fixture);
  assert.equal(v.rappels.length, 4);
  assert.deepEqual(v.defauts, []);
});

test('validerRappels écarte les entrées mal formées sans tout jeter', () => {
  const ok = fixture.rappels[0];
  const v = validerRappels({
    version: 1,
    rappels: [
      ok,
      { ...ok, id: 'long', titre: 'x'.repeat(31) },
      { ...ok, id: 'texte', texte: 'x'.repeat(141) },
      { ...ok, id: 'moment', moments: ['pause'] },
      { ...ok, id: 'vide', moments: [] },
      { ...ok, id: 'regle', regle: ['1'] },
      { ...ok, id: 'emoji', emoji: '' },
      { ...ok }, // id en double
      null,
    ],
  });
  assert.deepEqual(v.rappels.map((r) => r.id), ['test-a']);
  assert.equal(v.defauts.length, 8);
});

test('validerRappels : version inconnue ou fichier illisible → aucun rappel', () => {
  assert.equal(validerRappels({ version: 2, rappels: fixture.rappels }).rappels.length, 0);
  assert.equal(validerRappels(null).rappels.length, 0);
  assert.equal(validerRappels({ version: 1 }).rappels.length, 0);
});

test('choisirRappel : seulement les rappels du moment demandé', () => {
  assert.equal(choisirRappel(rappels, 'apres_inventaire', [], fixe(0))?.id, 'test-d');
  assert.equal(choisirRappel(rappels, 'apres_commande', [], fixe(0.99))?.id, 'test-b');
  assert.equal(choisirRappel([], 'chargement', []), null);
});

test('choisirRappel : ne repropose pas les derniers vus', () => {
  // chargement : A, B, C → mémoire de 2.
  assert.equal(tailleMemoire(3), 2);
  for (const x of [0, 0.5, 0.99]) {
    assert.equal(choisirRappel(rappels, 'chargement', ['test-a', 'test-b'], fixe(x))?.id, 'test-c');
  }
  // A vu il y a longtemps : redevient possible.
  const ids = new Set([0, 0.99].map((x) => choisirRappel(rappels, 'chargement', ['test-a', 'test-b', 'test-c'], fixe(x))?.id));
  assert.deepEqual([...ids].sort(), ['test-a']);
});

test('choisirRappel : un seul rappel pour ce moment → toujours lui', () => {
  assert.equal(choisirRappel(rappels, 'apres_inventaire', ['test-d', 'test-d'], fixe(0.5))?.id, 'test-d');
});

test('choisirRappel : tirage réparti sur les rappels non vus', () => {
  const vus = new Set<string>();
  for (let i = 0; i < 10; i++) vus.add(choisirRappel(rappels, 'chargement', [], fixe(i / 10))!.id);
  assert.deepEqual([...vus].sort(), ['test-a', 'test-b', 'test-c']);
});

test('noterVu : sans doublon, plus récent en dernier, borné', () => {
  assert.deepEqual(noterVu(['a', 'b'], 'a'), ['b', 'a']);
  assert.deepEqual(noterVu(['a', 'b', 'c'], 'd', 3), ['b', 'c', 'd']);
});

// Le vrai fichier (documentation-gerant), s'il existe : il doit être entièrement valide.
const vrai = new URL('../../../../data/rappels-equipe.json', import.meta.url);
test('data/rappels-equipe.json : toutes les entrées valides, chaque moment couvert', { skip: !existsSync(vrai) }, () => {
  const v = validerRappels(JSON.parse(readFileSync(vrai, 'utf8')));
  assert.deepEqual(v.defauts, []);
  for (const m of ['chargement', 'apres_commande', 'apres_inventaire'] as const) {
    assert.ok(v.rappels.some((r: Rappel) => r.moments.includes(m)), `aucun rappel pour « ${m} »`);
  }
  // LOI 1 : aucun prix dans un rappel.
  for (const r of v.rappels) assert.doesNotMatch(`${r.titre} ${r.texte}`, /€|\d\s*(eur|euros?)\b/i, r.id);
});
