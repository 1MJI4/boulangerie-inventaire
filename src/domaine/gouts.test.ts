// node --no-warnings --test src/domaine/gouts.test.ts
// Montant FICTIF (le goût ne dépend pas du prix), libellés et goûts de test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GOUT_AU_CHOIX, goutsAttendus, goutsInitiaux, goutsProposes, validerGoutReserve, validerGouts } from './gouts.ts';
import { GOUTS_SUR_COMMANDE } from '../catalogue/goutsSurCommande.ts';
import type { ChoixGout } from './gouts.ts';
import type { FicheTarifee } from './types.ts';

const fiche = (libelle: string, etages: number | null = null): FicheTarifee => ({
  produit: { id: 'p-test', produit: libelle, unite: 'piece', regimePrix: 'A', famille: 'patisserie' },
  prix: {
    prixCentimes: 100,
    basePrix: 'piece',
    prixEstPlancher: false,
    minQuantite: null,
    minParSymbole: null,
    maxParUnite: null,
    etages,
  },
});

const BUCHE = fiche('Bûche de test');
const PROPRE: ChoixGout = { liste: 'propre', parEtage: false, gouts: ['Goût A', 'Goût B', 'Goût C'] };
const PARFUM: ChoixGout = { liste: 'parfum', parEtage: false };
const LISTES = { parfums: ['Vanille', 'Chocolat'], entremets: ['Javanais', 'Saint-Michel'] };

// --- R67 : goût obligatoire à liste fermée (Bûches, Cœurs) -------------------

test('R67 liste propre : un seul goût attendu, jamais un par étage', () => {
  assert.equal(goutsAttendus(PROPRE, BUCHE), 1);
  assert.equal(goutsAttendus(PROPRE, fiche('Bûche de test', 3)), 1, 'les étages du tarif ne comptent pas');
});

test('R67 liste propre sans goût → ERR_GOUT_MANQUANT, sortie « Au choix du pâtissier »', () => {
  for (const saisie of [undefined, null, [], [''], ['   '], [null]]) {
    const r = validerGouts(PROPRE, BUCHE, saisie);
    assert.equal(r.ok, false, JSON.stringify(saisie));
    if (r.ok) continue;
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.code, 'ERR_GOUT_MANQUANT');
    assert.equal(r.champ, 'gouts');
    assert.equal(r.valeurProposee, GOUT_AU_CHOIX);
    assert.equal(
      r.message,
      'Choisissez le goût pour « Bûche de test ». Si le client hésite : « au choix du pâtissier ».',
    );
  }
});

test('R67 liste propre : un goût de la liste est accepté, tel quel (sans espaces en trop)', () => {
  const r = validerGouts(PROPRE, BUCHE, [' Goût B ']);
  assert.ok(r.ok);
  assert.deepEqual(r.donnees, ['Goût B']);
  assert.equal(r.signalements.length, 0);
});

test('R67 liste propre : « Au choix du pâtissier » est accepté', () => {
  const r = validerGouts(PROPRE, BUCHE, [GOUT_AU_CHOIX]);
  assert.ok(r.ok);
  assert.deepEqual(r.donnees, [GOUT_AU_CHOIX]);
});

test('R67 liste propre : un goût hors liste est accepté, comme « Autre… » des autres listes (hypothèse)', () => {
  const r = validerGouts(PROPRE, BUCHE, ['Pistache']);
  assert.ok(r.ok, 'même traitement que le texte libre d’un Bavarois : le domaine ne juge pas le mot');
  assert.deepEqual(r.donnees, ['Pistache']);
  // Référence : le comportement existant pour une liste du gérant.
  assert.ok(validerGouts(PARFUM, BUCHE, ['Pistache']).ok);
});

test('R67 liste propre : un seul goût gardé, même si l’écran en envoie plusieurs', () => {
  const r = validerGouts(PROPRE, BUCHE, ['Goût A', 'Goût B']);
  assert.ok(r.ok);
  assert.deepEqual(r.donnees, ['Goût A']);
});

test('R62 inchangé : listes du gérant, recette d’entremet, un goût par étage', () => {
  const sans = validerGouts({ liste: 'entremet', parEtage: false }, fiche('Entremet de test'), []);
  assert.ok(!sans.ok);
  if (!sans.ok) assert.match(sans.message, /Choisissez la recette pour/);
  const pm = fiche('Pièce de test', 3);
  const etages: ChoixGout = { liste: 'parfum', parEtage: true };
  assert.equal(goutsAttendus(etages, pm), 3);
  const manque = validerGouts(etages, pm, ['A', 'B']);
  assert.ok(!manque.ok);
  if (!manque.ok) assert.match(manque.message, /de l’étage 3/);
  assert.equal(goutsAttendus(null, pm), 0, 'produit sans choix de goût : non concerné');
  assert.ok(validerGouts(undefined, pm, undefined).ok);
});

// --- Quelle liste montrer ------------------------------------------------------

test('goutsProposes : liste propre → ses goûts, dans l’ordre du tarif, jamais la liste du gérant', () => {
  assert.deepEqual(goutsProposes(PROPRE, LISTES), ['Goût A', 'Goût B', 'Goût C']);
  assert.deepEqual(goutsProposes(PROPRE, {}), ['Goût A', 'Goût B', 'Goût C']);
  assert.deepEqual(goutsProposes(PROPRE, null), ['Goût A', 'Goût B', 'Goût C']);
});

test('goutsProposes : liste propre sans doublon ni entrée vide, libellés à la lettre', () => {
  const choix: ChoixGout = { liste: 'propre', parEtage: false, gouts: ['Moka', ' moka', '', 'Praliné'] };
  assert.deepEqual(goutsProposes(choix, LISTES), ['Moka', 'Praliné']);
});

test('goutsProposes : parfum → liste des goûts du gérant, goûts du gâteau en tête', () => {
  assert.deepEqual(goutsProposes(PARFUM, LISTES), ['Vanille', 'Chocolat']);
  const enTete: ChoixGout = { liste: 'parfum', parEtage: false, goutsEnTete: ['Framboise', 'chocolat'] };
  assert.deepEqual(goutsProposes(enTete, LISTES), ['Framboise', 'chocolat', 'Vanille']);
});

test('goutsProposes : entremet → liste des recettes ; liste absente → vide (jamais d’erreur)', () => {
  assert.deepEqual(goutsProposes({ liste: 'entremet', parEtage: false }, LISTES), ['Javanais', 'Saint-Michel']);
  assert.deepEqual(goutsProposes({ liste: 'entremet', parEtage: false }, { parfums: ['Vanille'] }), []);
  assert.deepEqual(goutsProposes(PARFUM, undefined), []);
});

// --- R70 (propriétaire, 17/11/2026) : Crème fraîche à la vanille, autre goût = manager.

const CREME = GOUTS_SUR_COMMANDE['gateaux-sur-commande/creme-fraiche'];
const MANAGER = { par: 'Sara', le: '2026-11-17T20:00:00.000Z' };

test('R70 : la Crème fraîche part à la vanille, les autres gâteaux sans goût imposé', () => {
  assert.deepEqual(goutsInitiaux(CREME), ['Vanille']);
  assert.deepEqual(goutsInitiaux(GOUTS_SUR_COMMANDE['gateaux-sur-commande/layer-cake']), []);
  assert.deepEqual(goutsInitiaux(GOUTS_SUR_COMMANDE['special-fin-dannee/buches-6p']), []);
  assert.deepEqual(goutsInitiaux(null), []);
});

test('R70 : vanille acceptée sans code, quelle que soit la casse', () => {
  for (const g of ['Vanille', 'vanille', ' Vanille ']) {
    assert.equal(validerGoutReserve(CREME, 'Crème fraîche', [g]).ok, true, g);
  }
  assert.equal(validerGoutReserve(CREME, 'Crème fraîche', []).ok, true);
});

test('R70 : un autre goût sans le manager est refusé, avec « Remettre Vanille »', () => {
  for (const g of ['Fraise', 'Au choix du pâtissier']) {
    const r = validerGoutReserve(CREME, 'Crème fraîche', [g]);
    assert.equal(r.ok, false, g);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_GOUT_RESERVE');
      assert.equal(r.valeurProposee, 'Vanille');
      assert.match(r.message, /manager/);
    }
  }
});

test('R70 : un autre goût avec le code du manager est accepté et tracé', () => {
  const r = validerGoutReserve(CREME, 'Crème fraîche', ['Fraise'], MANAGER);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.signalements[0]?.code, 'AVERT_GOUT_AUTORISE');
  const vide = validerGoutReserve(CREME, 'Crème fraîche', ['Fraise'], { par: '  ', le: MANAGER.le });
  assert.equal(vide.ok, false);
});

test('R70 : les autres gâteaux gardent le libre choix du goût', () => {
  const layer = GOUTS_SUR_COMMANDE['gateaux-sur-commande/layer-cake'];
  assert.equal(validerGoutReserve(layer, 'Layer Cake', ['Fraise']).ok, true);
});
