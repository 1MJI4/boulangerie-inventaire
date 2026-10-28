// node --test src/lib/auth/codes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memeCode, nouveauxLimiteurs, verifierCode } from './codes.ts';
import { nomDeclare } from './identite.ts';
import { FENETRE_MS, MAX_ECHECS_GLOBAL, MAX_ECHECS_PAR_SOURCE } from './limiteur.ts';

// Codes de test générés pour ce fichier, sans rapport avec la production.
const BON = `test-${Math.random().toString(36).slice(2, 12)}`;
const FAUX = `${BON}x`;
const T0 = Date.UTC(2026, 9, 15, 6, 0, 0);

test('comparaison : exacte, sans exception, quelle que soit l’entrée', () => {
  assert.equal(memeCode(BON, BON), true);
  for (const s of [FAUX, BON.slice(0, -1), BON.toUpperCase(), '', null, undefined, 42, {}, 'x'.repeat(10_000)]) {
    assert.equal(memeCode(s, BON), false, String(s));
  }
});

test('bon code accepté, mauvais code refusé avec un message qui dit quoi faire', () => {
  const l = nouveauxLimiteurs();
  assert.equal(verifierCode(BON, BON, ['ip:a'], l, T0).ok, true);
  const r = verifierCode(FAUX, BON, ['ip:a'], l, T0);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_CODE_INCORRECT');
    assert.match(r.message, /manager/);
    assert.doesNotMatch(r.message, new RegExp(BON));
  }
});

test('limite de tentatives par source : bloqué après 5 échecs, même avec le bon code', () => {
  const l = nouveauxLimiteurs();
  for (let i = 0; i < MAX_ECHECS_PAR_SOURCE; i++) verifierCode(FAUX, BON, ['ip:a', 'tablette:x'], l, T0);
  const r = verifierCode(BON, BON, ['ip:a'], l, T0 + 1000);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_TROP_DE_TENTATIVES');
    assert.match(r.message, /Réessayez dans \d+ minute/);
  }
  // Même tablette depuis une autre adresse : toujours bloquée.
  assert.equal(verifierCode(BON, BON, ['ip:b', 'tablette:x'], l, T0 + 1000).ok, false);
  // Une autre source n'est pas pénalisée.
  assert.equal(verifierCode(BON, BON, ['ip:c', 'tablette:y'], l, T0 + 1000).ok, true);
  // Fenêtre écoulée : de nouveau accepté.
  assert.equal(verifierCode(BON, BON, ['ip:a', 'tablette:x'], l, T0 + FENETRE_MS).ok, true);
});

test('limite globale : une attaque répartie sur beaucoup d’adresses est freinée', () => {
  const l = nouveauxLimiteurs();
  for (let i = 0; i < MAX_ECHECS_GLOBAL; i++) verifierCode(FAUX, BON, [`ip:${i}`], l, T0);
  const r = verifierCode(BON, BON, ['ip:nouvelle'], l, T0 + 1000);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_TROP_DE_TENTATIVES');
});

test('un succès remet à zéro le compteur de la source', () => {
  const l = nouveauxLimiteurs();
  for (let i = 0; i < MAX_ECHECS_PAR_SOURCE - 1; i++) verifierCode(FAUX, BON, ['ip:a'], l, T0);
  assert.equal(verifierCode(BON, BON, ['ip:a'], l, T0).ok, true);
  for (let i = 0; i < MAX_ECHECS_PAR_SOURCE - 1; i++) verifierCode(FAUX, BON, ['ip:a'], l, T0);
  assert.equal(verifierCode(BON, BON, ['ip:a'], l, T0).ok, true);
});

test('nom déclaré par la tablette : texte simple et court', () => {
  assert.equal(nomDeclare('  Fatima  '), 'Fatima');
  assert.equal(nomDeclare('Marie-Hélène O’Brien'), 'Marie-Hélène O’Brien');
  assert.equal(nomDeclare('<script>alert(1)</script>'), 'script alert 1 script');
  assert.equal(nomDeclare('Ali\n\tDupont\u0000'), 'Ali Dupont');
  assert.equal(nomDeclare('x'.repeat(500)).length, 40);
  for (const v of [null, undefined, 42, {}, '   ', '<>{}']) assert.equal(nomDeclare(v), '', String(v));
});
