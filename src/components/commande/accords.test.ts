// Conservation des accords du gérant en modification (réserve 3 et KO remise de qa-metier).
// Montants : valeurs de test arbitraires en centimes, aucun prix du catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ligneCouverte,
  memeAccord,
  remiseCouverte,
  tailleCouverte,
  type AccordEnregistre,
} from './accords.ts';

const LE = new Date('2026-10-10T09:00:00.000Z');
const TOTAL_REMISE = 9000;
const TOTAL_TARIF = 10000;

const remise: AccordEnregistre = {
  type: 'remise',
  par: 'Gérant',
  le: LE,
  totalCentimes: TOTAL_REMISE,
  totalTarifCentimes: TOTAL_TARIF,
};
const ligne: AccordEnregistre = { type: 'ligne', cle: 'layer-cake|400', par: 'Gérant', le: LE, quantite: 20 };

test('remise inchangée (même total convenu, même total au tarif) → conservée', () => {
  assert.equal(remiseCouverte(remise, { totalCentimes: TOTAL_REMISE, totalTarifCentimes: TOTAL_TARIF }), true);
});

test('remise : total convenu 90 € → 10 € sans gérant → refusée', () => {
  assert.equal(remiseCouverte(remise, { totalCentimes: 1000, totalTarifCentimes: TOTAL_TARIF }), false);
});

test('remise : 20 → 40 parts (tarif doublé), total convenu identique → refusée', () => {
  assert.equal(remiseCouverte(remise, { totalCentimes: TOTAL_REMISE, totalTarifCentimes: TOTAL_TARIF * 2 }), false);
});

test('remise : total convenu relevé → refusée aussi (règle la plus sûre : identiques)', () => {
  assert.equal(remiseCouverte(remise, { totalCentimes: TOTAL_REMISE + 1, totalTarifCentimes: TOTAL_TARIF }), false);
});

test('remise ancienne sans total au tarif connu → jamais conservée', () => {
  const ancienne: AccordEnregistre = { ...remise, totalTarifCentimes: null } as AccordEnregistre;
  assert.equal(remiseCouverte(ancienne, { totalCentimes: TOTAL_REMISE, totalTarifCentimes: TOTAL_TARIF }), false);
});

test('ligne : même produit, même prix, même quantité → conservée ; quantité inférieure → conservée', () => {
  assert.equal(ligneCouverte(ligne, { cle: 'layer-cake|400', quantite: 20 }), true);
  assert.equal(ligneCouverte(ligne, { cle: 'layer-cake|400', quantite: 18 }), true);
});

test('ligne : 20 → 30 parts, ou prix / produit changé, ou quantité illisible → refusée', () => {
  assert.equal(ligneCouverte(ligne, { cle: 'layer-cake|400', quantite: 30 }), false);
  assert.equal(ligneCouverte(ligne, { cle: 'layer-cake|300', quantite: 20 }), false);
  assert.equal(ligneCouverte(ligne, { cle: 'autre|400', quantite: 20 }), false);
  assert.equal(ligneCouverte(ligne, { cle: 'layer-cake|400', quantite: null }), false);
});

test('un accord ne couvre jamais un autre type', () => {
  assert.equal(remiseCouverte(ligne, { totalCentimes: TOTAL_REMISE, totalTarifCentimes: TOTAL_TARIF }), false);
  assert.equal(ligneCouverte(remise, { cle: 'layer-cake|400', quantite: 20 }), false);
});

test('memeAccord : même nom et même heure exigés', () => {
  assert.equal(memeAccord(remise, { par: 'Gérant', le: LE.toISOString() }), true);
  assert.equal(memeAccord(remise, { par: 'Autre', le: LE.toISOString() }), false);
  assert.equal(memeAccord(remise, { par: 'Gérant', le: new Date().toISOString() }), false);
});

test('taille hors standard déjà acceptée : conservée au même produit et à la même quantité seulement', () => {
  const taille: AccordEnregistre = { type: 'taille', cle: 'gateau-x', par: 'Gérant', le: LE, quantite: 7 };
  assert.equal(tailleCouverte(taille, { produitId: 'gateau-x', quantite: 7 }), true);
  assert.equal(tailleCouverte(taille, { produitId: 'gateau-x', quantite: 9 }), false, 'plus grand : gérant');
  assert.equal(tailleCouverte(taille, { produitId: 'gateau-x', quantite: 5 }), false, 'plus petit : gérant aussi');
  assert.equal(tailleCouverte(taille, { produitId: 'gateau-y', quantite: 7 }), false);
  assert.equal(tailleCouverte(taille, { produitId: null, quantite: 7 }), false);
  assert.equal(memeAccord(taille, { par: 'Gérant', le: LE.toISOString() }), true);
  assert.equal(memeAccord(taille, { par: 'Autre', le: LE.toISOString() }), false);
});

// Réserve m3 : accord non confirmé devenu inutile → ignoré, pas refusé.
import { accordManquant } from './accords.ts';

const ACCORD = { par: 'Gérant', le: '2026-10-10T09:00:00.000Z' };

test('m3 : accord de taille non confirmé, taille redevenue standard (domaine ne le trace pas) → ignoré', () => {
  assert.equal(accordManquant({ lignes: [{ prix: false, taille: true }], remise: false }, { lignes: [{}] }), null);
});

test('m3 : accord de taille non confirmé, taille toujours hors liste → code gérant redemandé', () => {
  assert.deepEqual(
    accordManquant({ lignes: [{ prix: false, taille: true }], remise: false }, { lignes: [{ autorisationTaille: ACCORD }] }),
    { type: 'taille', ligne: 0 },
  );
});

test('m3 : accord sous plancher non confirmé, prix ≥ plancher → ignoré ; sous plancher → redemandé', () => {
  const attente = { lignes: [{ prix: false, taille: false }, { prix: true, taille: false }], remise: false };
  assert.equal(accordManquant(attente, { lignes: [{}, {}] }), null);
  assert.deepEqual(accordManquant(attente, { lignes: [{}, { autorisation: ACCORD }] }), { type: 'prix', ligne: 1 });
});

test('m3 : remise non confirmée, total = tarif → ignorée ; total remisé → redemandée', () => {
  const attente = { lignes: [], remise: true };
  assert.equal(accordManquant(attente, { lignes: [] }), null);
  assert.deepEqual(accordManquant(attente, { lignes: [], remise: ACCORD }), { type: 'remise' });
});

test('m3 : accord confirmé (gérant présent ou déjà enregistré) utilisé → jamais redemandé', () => {
  assert.equal(
    accordManquant({ lignes: [{ prix: false, taille: false }], remise: false }, { lignes: [{ autorisation: ACCORD, autorisationTaille: ACCORD }], remise: ACCORD }),
    null,
  );
});
