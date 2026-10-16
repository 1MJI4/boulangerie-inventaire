// node --test src/components/saisie/saisie.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  appliquerTouche,
  appliquerToucheTelephone,
  effacerDernier,
  texteALire,
  toucheDepuisClavier,
  type OptionsTouche,
} from './mecanique.ts';
import {
  lecteurMontant,
  lecteurPieces,
  lecteurPoids,
  lecteurTelephone,
  texteDepuisCentimes,
  texteDepuisGrammes,
  texteDepuisPieces,
} from './lecteurs.ts';
import { ajouterJours, aujourdhuiIso, decalagePour, ecartJours, estDateIso, fenetreSemaines, joursSuccessifs } from './dates.ts';
import { cotePaveDepuisStockage } from '../../lib/preferencesSaisie.ts';
import { trierSignalements } from '../signalement/trier.ts';

// Les pavés ne convertissent rien eux-mêmes : la lecture est celle du domaine.
const lirePoidsPave = (t: string) => lecteurPoids('inventaire')(texteALire(t));
const lireMontantPave = (t: string) => lecteurMontant()(texteALire(t));

const POIDS: OptionsTouche = { virgule: true, chiffresEntiersMax: 3, lisible: (t) => lecteurPoids('inventaire')(t).ok };
const PIECES: OptionsTouche = { virgule: false, chiffresEntiersMax: 4, lisible: (t) => lecteurPieces('inventaire')(t).ok };
const EUROS: OptionsTouche = { virgule: true, chiffresEntiersMax: 5, lisible: (t) => lecteurMontant()(t).ok };

function taper(touches: string[], options: OptionsTouche): string {
  return touches.reduce((t, k) => appliquerTouche(t, k, options), '');
}

function valeur<T>(r: { ok: true; donnees: T } | { ok: false }): T | null {
  return r.ok ? r.donnees : null;
}

// --------------------------------------------------------------- pavé kg

test('pavé kg : séquences de touches', () => {
  assert.equal(taper(['1', ',', '2', '5'], POIDS), '1,25');
  assert.equal(taper([',', '5'], POIDS), '0,5'); // virgule en premier → « 0, » (lirePoids refuse « ,5 »)
  assert.equal(taper(['0', '5'], POIDS), '5');
  assert.equal(taper(['1', ',', ',', '5'], POIDS), '1,5'); // une seule virgule
  assert.equal(taper(['1', '.', '5'], POIDS), '1,5'); // le point devient virgule
  assert.equal(taper(['1', ',', '2', '3', '4', '5'], POIDS), '1,234'); // 4e décimale refusée par lirePoids
  assert.equal(taper(['1', '2', '3', '4'], POIDS), '123'); // garde-fou de frappe
  assert.equal(taper(['x', '1'], POIDS), '1');
  assert.equal(effacerDernier('1,25'), '1,2');
  assert.equal(effacerDernier('0,'), '0');
  assert.equal(effacerDernier(''), '');
});

test('pavé kg : la conversion est celle de lirePoids (grammes entiers, sans flottant)', () => {
  assert.equal(valeur(lirePoidsPave('1,25')), 1250);
  assert.equal(valeur(lirePoidsPave('0,5')), 500);
  assert.equal(valeur(lirePoidsPave('1,')), 1000); // état de frappe : « 1, » se lit « 1 »
  assert.equal(valeur(lirePoidsPave('0,1')), 100);
  assert.equal(valeur(lirePoidsPave('0')), 0); // inventaire : rayon vide
});

test('pavé kg : tout texte produit par le pavé est lisible par lirePoids', () => {
  const touches = ['0', '1', '5', '9', ','];
  const textes = new Set(['']);
  for (let tour = 0; tour < 5; tour++) {
    for (const t of [...textes]) for (const k of touches) textes.add(appliquerTouche(t, k, POIDS));
  }
  for (const t of textes) {
    if (t === '') continue;
    assert.equal(lirePoidsPave(t).ok, true, `illisible : « ${t} »`);
  }
});

test('pavé kg : en commande, un poids nul est refusé par validerQuantite', () => {
  const r = lecteurPoids('commande')('0');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_QUANTITE_INVALIDE');
  assert.equal(valeur(lecteurPoids('commande')('0,750')), 750);
});

test('affichage kg dérivé de formaterQuantite, relisible', () => {
  assert.equal(texteDepuisGrammes(1250), '1,250');
  assert.equal(texteDepuisGrammes(7), '0,007');
  for (const g of [0, 1, 10, 99, 100, 999, 1000, 1001, 12345, 999999]) {
    assert.equal(valeur(lirePoidsPave(texteDepuisGrammes(g))), g);
  }
});

// --------------------------------------------------------------- pavé entier

test('pavé entier : séquences et lecture par lirePieces', () => {
  assert.equal(taper(['0', '2', '0'], PIECES), '20');
  assert.equal(taper([',', '5'], PIECES), '5');
  assert.equal(taper(['1', '2', '3', '4', '5'], PIECES), '1234');
  assert.equal(valeur(lecteurPieces('inventaire')('20')), 20);
  assert.equal(valeur(lecteurPieces('inventaire')('0')), 0);
  assert.equal(lecteurPieces('commande')('0').ok, false);
  assert.equal(lecteurPieces('inventaire')('1,5').ok, false);
  assert.equal(texteDepuisPieces(12), '12');
});

// --------------------------------------------------------------- pavé euros

test('pavé euros : 2 décimales max, conversion par lireMontant', () => {
  assert.equal(taper(['4', ',', '5'], EUROS), '4,5');
  assert.equal(taper([',', '5', '0'], EUROS), '0,50');
  assert.equal(taper(['4', ',', '5', '0', '9'], EUROS), '4,50'); // 3e décimale refusée par lireMontant
  assert.equal(taper(['1', '2', '3', '4', '5', '6'], EUROS), '12345');
  assert.equal(valeur(lireMontantPave('4,5')), 450);
  assert.equal(valeur(lireMontantPave('12,')), 1200);
  assert.equal(valeur(lireMontantPave('0,1')), 10);
  assert.equal(texteDepuisCentimes(123450), '1234,50');
  for (const c of [0, 1, 10, 450, 3100, 123456]) {
    assert.equal(valeur(lireMontantPave(texteDepuisCentimes(c))), c);
  }
});

test('pavé euros : tout texte produit est lisible par lireMontant', () => {
  const touches = ['0', '1', '9', ','];
  const textes = new Set(['']);
  for (let tour = 0; tour < 5; tour++) {
    for (const t of [...textes]) for (const k of touches) textes.add(appliquerTouche(t, k, EUROS));
  }
  for (const t of textes) if (t !== '') assert.equal(lireMontantPave(t).ok, true, `illisible : « ${t} »`);
});

// --------------------------------------------------------------- pavé téléphone

test('pavé téléphone : chiffres, espace, « + » en tête seulement', () => {
  const taperTel = (touches: string[]) => touches.reduce((t, k) => appliquerToucheTelephone(t, k), '');
  assert.equal(taperTel(['+', '3', '2', ' ', '4', '7', '0']), '+32 470');
  assert.equal(taperTel(['0', '+', '4']), '04');
  assert.equal(taperTel([' ', '0', ' ', ' ', '4']), '0 4');
  assert.equal(taperTel(['0', ',', 'a', '4']), '04');
  assert.equal(taperTel(Array(30).fill('1')).length, 20);
  assert.equal(lecteurTelephone()('0470 12 34 56').ok, true);
});

test('clavier physique → touches du pavé', () => {
  assert.equal(toucheDepuisClavier('5', 'entier'), '5');
  assert.equal(toucheDepuisClavier('.', 'decimal'), ',');
  assert.equal(toucheDepuisClavier('.', 'entier'), null);
  assert.equal(toucheDepuisClavier('+', 'telephone'), '+');
  assert.equal(toucheDepuisClavier('+', 'decimal'), null);
  assert.equal(toucheDepuisClavier('Backspace', 'entier'), 'effacer');
  assert.equal(toucheDepuisClavier('Enter', 'telephone'), 'valider');
});

// --------------------------------------------------------------- dates

test('dates ISO', () => {
  assert.equal(estDateIso('2026-10-21'), true);
  assert.equal(estDateIso('2026-02-30'), false);
  assert.equal(estDateIso('21/10/2026'), false);
  assert.equal(ajouterJours('2026-10-31', 1), '2026-11-01');
  assert.equal(ajouterJours('2026-03-28', 2), '2026-03-30'); // passage à l'heure d'été
  assert.equal(ajouterJours('2026-01-01', -1), '2025-12-31');
  assert.equal(aujourdhuiIso(new Date(2026, 9, 15, 23, 30)), '2026-10-15');
  assert.deepEqual(joursSuccessifs('2026-12-30', 3), ['2026-12-30', '2026-12-31', '2027-01-01']);
});

// --------------------------------------------------------------- signalements

test('trierSignalements : bloquants d’abord, dédoublonnés par code + champ', () => {
  const info = { niveau: 'information', code: 'INFO_TARIF_EN_VIGUEUR', message: 'i' } as const;
  const avert = { niveau: 'avertissement', code: 'AVERT_DOUBLE_SCAN', message: 'a', champ: 'q' } as const;
  const err1 = { ok: false, niveau: 'bloquant', code: 'ERR_QUANTITE_MIN', message: 'e1', champ: 'q' } as const;
  const err1bis = { ...err1, message: 'doublon' } as const;
  const err1autre = { ...err1, champ: 'r', message: 'autre champ' } as const;
  const err2 = { ok: false, niveau: 'bloquant', code: 'ERR_JOUR_FERME', message: 'e2' } as const;

  const tries = trierSignalements([info, avert, err1, err1bis, err2, err1autre]);
  assert.deepEqual(
    tries.map((s) => s.message),
    ['e1', 'e2', 'autre champ', 'a', 'i'],
  );
});

test('sélecteur de date : 2 semaines de 7 jours, défilement par semaine', () => {
  const j = fenetreSemaines('2026-10-15', 0, 2);
  assert.equal(j.length, 14);
  assert.equal(j[0], '2026-10-15');
  assert.equal(j[7], '2026-10-22'); // 2e rangée : même jour de semaine, colonnes alignées
  assert.equal(j[13], '2026-10-28');
  assert.equal(fenetreSemaines('2026-10-15', 1, 2)[0], '2026-10-22');
  assert.equal(fenetreSemaines('2026-10-29', 0, 1)[6], '2026-11-04'); // passage de mois
});

test('sélecteur de date : écart en jours et semaine d’une date choisie', () => {
  assert.equal(ecartJours('2026-10-15', '2026-10-15'), 0);
  assert.equal(ecartJours('2026-10-15', '2026-11-15'), 31);
  assert.equal(ecartJours('2026-03-28', '2026-03-30'), 2); // heure d'été sans effet
  assert.equal(ecartJours('2026-10-15', '2026-10-14'), -1);
  assert.equal(decalagePour('2026-10-15', '2026-10-21'), 0);
  assert.equal(decalagePour('2026-10-15', '2026-10-22'), 1);
  assert.equal(decalagePour('2026-10-15', '2026-10-01'), 0);
});

test('côté du pavé : droitier par défaut, reprise du réglage « main », valeurs illisibles ignorées', () => {
  assert.equal(cotePaveDepuisStockage(null, null), 'droite');
  assert.equal(cotePaveDepuisStockage('gauche', null), 'gauche');
  assert.equal(cotePaveDepuisStockage(null, JSON.stringify({ main: 'gauche' })), 'gauche');
  assert.equal(cotePaveDepuisStockage('droite', JSON.stringify({ main: 'gauche' })), 'droite');
  assert.equal(cotePaveDepuisStockage('milieu', '{pas du json'), 'droite');
  assert.equal(cotePaveDepuisStockage(null, 'null'), 'droite');
});
