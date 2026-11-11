// node --no-warnings --test src/domaine/gouts.test.ts
// Montant FICTIF (le goût ne dépend pas du prix), libellés et goûts de test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GOUT_AU_CHOIX, goutsAttendus, goutsProposes, validerGouts } from './gouts.ts';
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
