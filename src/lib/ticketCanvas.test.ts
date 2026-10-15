// node --test src/lib/ticketCanvas.test.ts
// Formatage pur des tickets (sans canvas). Prix FICTIFS, propres aux tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { LigneCommande } from './commandes.ts';
import { demandeAConfirmer, formaterLigneTicket, mentionHeureRetrait, MENTION_LIGNE_LIBRE } from './ticketCanvas.ts';

function ligne(partiel: Partial<LigneCommande>): LigneCommande {
  return { libelle: 'Produit test', quantite: 1, prixCentimes: 1000, poste: null, precision: null, ...partiel };
}

test('kg : 750 g à 1000 c/kg → « 0,750 kg » et 7,50 € (jamais 7500)', () => {
  const l = formaterLigneTicket(ligne({ unite: 'kg', quantite: 750, prixCentimes: 1000 }), 'ATELIER');
  assert.equal(l.quantite, '0,750 kg');
  assert.equal(l.prix, '7,50 €');
});

test('kg : 750 g à 1234 c/kg (fictif) → 9,26 € half-up, pas 9255,00 (cas du KO-A)', () => {
  assert.equal(formaterLigneTicket(ligne({ unite: 'kg', quantite: 750, prixCentimes: 1234 }), 'ATELIER').prix, '9,26 €');
});

test('kg : arrondi half-up au centime (333 g à 1000 c/kg → 3,33 €, 335 g à 1001 c/kg → 3,35 €)', () => {
  assert.equal(formaterLigneTicket(ligne({ unite: 'kg', quantite: 333, prixCentimes: 1000 }), 'ATELIER').prix, '3,33 €');
  assert.equal(formaterLigneTicket(ligne({ unite: 'kg', quantite: 335, prixCentimes: 1001 }), 'ATELIER').prix, '3,35 €');
});

test('pièce : « 3 × » et 3 × 1000 c = 30,00 €', () => {
  const l = formaterLigneTicket(ligne({ unite: 'piece', quantite: 3, prixCentimes: 1000 }), 'ATELIER');
  assert.equal(l.quantite, '3 ×');
  assert.equal(l.prix, '30,00 €');
  assert.equal(l.aConfirmer, false);
});

test('ligne sans unité (antérieure au lot 2) : traitée à la pièce', () => {
  assert.equal(formaterLigneTicket(ligne({ quantite: 2, prixCentimes: 1000 }), 'ATELIER').quantite, '2 ×');
});

test('total incalculable : jamais un montant faux, « à confirmer »', () => {
  assert.equal(formaterLigneTicket(ligne({ quantite: 2, prixCentimes: 0 }), 'ATELIER').prix, 'à confirmer');
});

test('ligne libre : « à confirmer par le pâtissier » sur les exemplaires internes, jamais sur le CLIENT', () => {
  const libre = ligne({ ligneLibreAutoriseePar: 'Gérant' });
  for (const d of ['BUREAU', 'MAGASIN', 'ATELIER'] as const) {
    assert.equal(formaterLigneTicket(libre, d).aConfirmer, true, d);
  }
  assert.equal(formaterLigneTicket(libre, 'CLIENT').aConfirmer, false);
  assert.equal(MENTION_LIGNE_LIBRE, 'à confirmer par le pâtissier');
});

test('heure de retrait null ou vide : aucune mention (ni « à null » ni « à  »)', () => {
  assert.equal(mentionHeureRetrait(null), null);
  assert.equal(mentionHeureRetrait(undefined), null);
  assert.equal(mentionHeureRetrait('  '), null);
  assert.equal(mentionHeureRetrait('14h30'), 'à 14h30');
});

test('demande à confirmer : nouveau champ, ou ancien drapeau en repli', () => {
  assert.equal(demandeAConfirmer({ demandeInhabituelle: true }, 'ATELIER'), true);
  assert.equal(demandeAConfirmer({ gateauComplexe: true }, 'BUREAU'), true);
  assert.equal(demandeAConfirmer({ demandeInhabituelle: false, gateauComplexe: false }, 'ATELIER'), false);
  assert.equal(demandeAConfirmer({}, 'MAGASIN'), false);
});

test('demande à confirmer : jamais sur l’exemplaire CLIENT', () => {
  assert.equal(demandeAConfirmer({ demandeInhabituelle: true }, 'CLIENT'), false);
  assert.equal(demandeAConfirmer({ gateauComplexe: true }, 'CLIENT'), false);
});
