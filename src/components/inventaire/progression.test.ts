// node --test src/components/inventaire/progression.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bilanFinInventaire,
  calculerProgression,
  prochainNonCompte,
  texteEnAttente,
  type Progression,
} from './progression.ts';

const produits = [{ id: 1 }, { id: 2 }, { id: 3, actif: true }, { id: 4, actif: false }];

test('progression : compte les produits actifs seulement', () => {
  const p = calculerProgression(produits, { 1: '5', 4: '2' });
  assert.equal(p.total, 3);
  assert.equal(p.comptes, 1);
  assert.deepEqual(p.restants, [2, 3]);
  assert.equal(p.pourcent, 33);
});

test('progression : 0 est compté, vide ne l’est pas', () => {
  const p = calculerProgression(produits, { 1: '0', 2: '', 3: '1200' });
  assert.equal(p.comptes, 2);
  assert.deepEqual(p.restants, [2]);
});

test('progression : un même produit n’est jamais compté deux fois (LOI 10)', () => {
  const p = calculerProgression([{ id: 1 }, { id: 1 }, { id: 2 }], { 1: '3' });
  assert.equal(p.total, 2);
  assert.equal(p.comptes, 1);
});

test('progression : 100 % seulement quand tout est compté', () => {
  const liste = Array.from({ length: 300 }, (_, i) => ({ id: i + 1 }));
  const valeurs = Object.fromEntries(liste.slice(0, 299).map((p) => [p.id, '1']));
  assert.equal(calculerProgression(liste, valeurs).pourcent, 99);
  assert.equal(calculerProgression(liste, { ...valeurs, 300: '0' }).pourcent, 100);
  assert.equal(calculerProgression([], {}).pourcent, 0);
});

test('prochain non compté : après la sélection, puis on repart du début', () => {
  const ordre = [10, 20, 30, 40];
  const valeurs = { 10: '', 20: '1', 30: '', 40: '2' };
  assert.equal(prochainNonCompte(ordre, valeurs, null), 10);
  assert.equal(prochainNonCompte(ordre, valeurs, 10), 30);
  assert.equal(prochainNonCompte(ordre, valeurs, 30), 10);
  assert.equal(prochainNonCompte(ordre, valeurs, 999), 10);
  assert.equal(prochainNonCompte(ordre, { 10: '1', 20: '1', 30: '', 40: '1' }, 30), 30);
  assert.equal(prochainNonCompte(ordre, { 10: '0', 20: '1', 30: '0', 40: '2' }, 10), null);
  assert.equal(prochainNonCompte([], {}, null), null);
});

const prog = (comptes: number, total: number): Progression => ({
  comptes,
  total,
  restants: Array.from({ length: total - comptes }, (_, i) => i + 1),
  pourcent: total === 0 ? 0 : Math.floor((comptes * 100) / total), // invariant-ok: pourcentage de progression, pas un montant
});
const calme = { nbEnAttente: 0, envoiEnCours: false, nbACorriger: 0, nbAvertissements: 0, termineQuandMeme: false };

test('fin : tout compté et tout enregistré → terminé', () => {
  const b = bilanFinInventaire({ ...calme, progression: prog(5, 5) });
  assert.equal(b.etat, 'termine');
  assert.equal(b.incomplet, false);
});

test('fin : tout compté mais envois en attente → jamais « terminé »', () => {
  assert.equal(bilanFinInventaire({ ...calme, progression: prog(5, 5), nbEnAttente: 3 }).etat, 'attente_envoi');
  assert.equal(bilanFinInventaire({ ...calme, progression: prog(5, 5), envoiEnCours: true }).etat, 'attente_envoi');
});

test('fin : une saisie refusée passe avant l’attente d’envoi', () => {
  const b = bilanFinInventaire({ ...calme, progression: prog(5, 5), nbEnAttente: 2, nbACorriger: 1 });
  assert.equal(b.etat, 'a_corriger');
});

test('fin : il reste des produits → en cours', () => {
  assert.equal(bilanFinInventaire({ ...calme, progression: prog(3, 5) }).etat, 'en_cours');
});

test('fin : « terminer quand même » → terminé incomplet, mais seulement une fois tout envoyé', () => {
  const force = { ...calme, progression: prog(3, 5), termineQuandMeme: true };
  const b = bilanFinInventaire(force);
  assert.equal(b.etat, 'termine');
  assert.equal(b.incomplet, true);
  assert.equal(b.restants, 2);
  assert.equal(bilanFinInventaire({ ...force, nbEnAttente: 1 }).etat, 'attente_envoi');
});

test('fin : avertissements restants reportés sans bloquer', () => {
  const b = bilanFinInventaire({ ...calme, progression: prog(5, 5), nbAvertissements: 2 });
  assert.equal(b.etat, 'termine');
  assert.equal(b.avertissements, 2);
});

test('fin : liste vide', () => {
  assert.equal(bilanFinInventaire({ ...calme, progression: prog(0, 0) }).etat, 'vide');
});

test('texte d’attente accordé', () => {
  assert.equal(texteEnAttente(1), '1 saisie pas encore envoyée');
  assert.equal(texteEnAttente(3), '3 saisies pas encore envoyées');
});
