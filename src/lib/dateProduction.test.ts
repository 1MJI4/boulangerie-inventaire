// Journée de production : le fournil ne prépare jamais un jour fermé.
// Les fermetures sont une DONNÉE (LOI 3) : ces tests passent la liste, rien n'est supposé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeeProduction } from './dateProduction.ts';
import type { JourFerme } from '../domaine/calendrier.ts';

// Novembre 2026 = heure d'hiver : Bruxelles = UTC+1.
const LUNDI_11H = new Date('2026-11-23T10:00:00Z');
const LUNDI_18H = new Date('2026-11-23T17:00:00Z');
const MARDI_4H = new Date('2026-11-24T03:00:00Z');
const MARDI_18H = new Date('2026-11-24T17:00:00Z');

const FERME_CHAQUE_MARDI: JourFerme = { id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'Fermeture hebdomadaire' };
const OUVERT_CE_MARDI: JourFerme = {
  id: 2,
  nature: 'ouverture_exceptionnelle',
  dateDebut: '2026-11-24',
  libelle: 'Ouverture exceptionnelle',
};
const FERME_CE_MERCREDI: JourFerme = { id: 3, nature: 'exceptionnel', dateDebut: '2026-11-25', libelle: 'Fermeture exceptionnelle' };

test('sans liste de fermetures : comportement d’origine (bascule à 14h, jour calendaire)', () => {
  assert.equal(journeeProduction(LUNDI_11H), '2026-11-23');
  assert.equal(journeeProduction(LUNDI_18H), '2026-11-24');
});

test('lundi soir, mardi fermé : on prépare mercredi', () => {
  assert.equal(journeeProduction(LUNDI_18H, [FERME_CHAQUE_MARDI]), '2026-11-25');
});

test('lundi soir, mardi exceptionnellement ouvert : on prépare mardi', () => {
  assert.equal(journeeProduction(LUNDI_18H, [FERME_CHAQUE_MARDI, OUVERT_CE_MARDI]), '2026-11-24');
});

test('lundi soir, aucune fermeture : on prépare mardi', () => {
  assert.equal(journeeProduction(LUNDI_18H, []), '2026-11-24');
});

test('mardi à 4h du matin, mardi fermé : l’écran montre mercredi, pas une journée vide', () => {
  assert.equal(journeeProduction(MARDI_4H, [FERME_CHAQUE_MARDI]), '2026-11-25');
});

test('lundi en journée : la journée en cours, ouverte, reste lundi', () => {
  assert.equal(journeeProduction(LUNDI_11H, [FERME_CHAQUE_MARDI]), '2026-11-23');
});

test('plusieurs jours fermés de suite : le prochain jour ouvert', () => {
  assert.equal(journeeProduction(LUNDI_18H, [FERME_CHAQUE_MARDI, FERME_CE_MERCREDI]), '2026-11-26');
});

test('mardi soir, mardi ouvert : on prépare mercredi', () => {
  assert.equal(journeeProduction(MARDI_18H, [OUVERT_CE_MARDI]), '2026-11-25');
});
