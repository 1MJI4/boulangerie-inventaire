// node --test src/domaine/inventaire.test.ts
// Les produits d'INVENTAIRE sont une donnée propre, distincte du catalogue de
// commande : ce test n'importe pas src/catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  totalInventaire,
  validerSaisieInventaire,
  validerSaisieProduit,
  verifierComptage,
  verifierProduction,
  type ProduitInventaire,
  type SaisieInventaire,
} from './inventaire.ts';
import { HEURE_FERMETURE_HYPOTHESE, SEUILS_COMPTAGE_HYPOTHESE } from './constantes.ts';
import { verifierHeureInventaire } from './inventaire.ts';

const PRODUITS: ProduitInventaire[] = [
  { id: 'inv-1', nom: 'Baguette blanche', unite: 'piece' },
  { id: 'inv-2', nom: 'Msemen', unite: 'piece' },
  { id: 'inv-3', nom: 'Halwa arbia', unite: 'kg' },
  { id: 'inv-4', nom: 'Ancien produit', unite: 'piece', actif: false },
];

const s = (saisieId: string, produitId: string, quantite: number, unite: 'piece' | 'kg' = 'piece'): SaisieInventaire => ({
  saisieId,
  produitId,
  unite,
  quantite,
});

test('validerSaisieInventaire : zéro permis (rayon vide), négatif refusé avec « mettre 0 »', () => {
  assert.equal(validerSaisieInventaire('piece', 0).ok, true);
  assert.equal(validerSaisieInventaire('kg', 0).ok, true);
  const r = validerSaisieInventaire('piece', -2);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_QUANTITE_NEGATIVE');
    assert.equal(r.valeurProposee, 0);
  }
  assert.equal(validerSaisieInventaire('kg', -750).ok, false);
});

test('validerSaisieInventaire : décimal à la pièce refusé, entier proposé ; kg en grammes entiers', () => {
  const r = validerSaisieInventaire('piece', 4.5);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_QUANTITE_INVALIDE');
  const r25 = validerSaisieInventaire('piece', 2.5);
  assert.equal(r25.ok, false);
  if (!r25.ok) {
    assert.equal(r25.code, 'ERR_QUANTITE_INVALIDE');
    assert.doesNotMatch(r25.message, /supérieur à zéro/, 'en comptage, 0 est valide : le message ne doit pas l’exclure');
  }
  assert.equal(validerSaisieInventaire('kg', 750).ok, true);
  assert.equal(validerSaisieInventaire('kg', 0.75).ok, false);
});

test('produit kg saisi à la pièce → ERR_UNITE_INCOHERENTE', () => {
  const r = validerSaisieProduit(PRODUITS, s('a', 'inv-3', 3, 'piece'));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_UNITE_INCOHERENTE');
});

test('produit du catalogue de COMMANDE inconnu de la liste d’inventaire → ERR_PRODUIT_INCONNU', () => {
  for (const id of ['gateaux-sur-commande/layer-cake', 'oriental/halwa-arbia', 'inv-4']) {
    const r = validerSaisieProduit(PRODUITS, s('a', id, 1));
    assert.equal(r.ok, false, id);
    if (!r.ok) assert.equal(r.code, 'ERR_PRODUIT_INCONNU', id);
    assert.equal(totalInventaire(PRODUITS, [s('a', id, 1)]).ok, false, id);
  }
});

test('totalInventaire : un id = une ligne, pièces et grammes jamais additionnés ensemble', () => {
  const r = totalInventaire(PRODUITS, [s('a', 'inv-1', 12), s('b', 'inv-3', 750, 'kg'), s('c', 'inv-2', 5)]);
  assert.ok(r.ok);
  assert.equal(r.donnees.lignes.length, 3);
  assert.equal(r.donnees.totalPieces, 17);
  assert.equal(r.donnees.totalGrammes, 750);
  assert.equal(r.signalements.length, 0);
});

test('même saisie reçue deux fois (rejeu de synchronisation, ou produit affiché en accès rapide ET en rayon) → comptée une fois', () => {
  const r = totalInventaire(PRODUITS, [s('a', 'inv-1', 12), s('a', 'inv-1', 12)]);
  assert.ok(r.ok);
  assert.equal(r.donnees.lignes.length, 1);
  assert.equal(r.donnees.totalPieces, 12);
  assert.equal(r.signalements.length, 0);
});

test('même produit compté par deux saisies → addition + AVERT_DOUBLE_SCAN (R21)', () => {
  const r = totalInventaire(PRODUITS, [s('a', 'inv-1', 12), s('b', 'inv-1', 3), s('c', 'inv-1', 1)]);
  assert.ok(r.ok);
  assert.equal(r.donnees.lignes.length, 1);
  assert.equal(r.donnees.totalPieces, 16);
  assert.equal(r.signalements.length, 1);
  assert.equal(r.signalements[0].code, 'AVERT_DOUBLE_SCAN');
});

test('même saisie avec deux valeurs différentes → ERR_CONFLIT_COMPTAGE (jamais « le dernier gagne »)', () => {
  const r = totalInventaire(PRODUITS, [s('a', 'inv-1', 12), s('a', 'inv-1', 13)]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_CONFLIT_COMPTAGE');
});

test('quantité anormalement élevée → avertissement (seuils en paramètre)', () => {
  const baguette = PRODUITS[0];
  const seuils = SEUILS_COMPTAGE_HYPOTHESE;
  assert.equal(verifierComptage({ produit: baguette, quantite: seuils.plafondPieces + 1 }, seuils)[0]?.code, 'AVERT_QUANTITE_INHABITUELLE');
  assert.equal(verifierComptage({ produit: baguette, quantite: 50, moyenneHistorique: 10 }, seuils)[0]?.code, 'AVERT_QUANTITE_INHABITUELLE');
  assert.equal(verifierComptage({ produit: baguette, quantite: 30, moyenneHistorique: 10 }, seuils).length, 0);
  assert.equal(verifierComptage({ produit: baguette, quantite: 30, moyenneHistorique: 3 }, seuils).length, 0, 'moyenne trop faible');
  assert.equal(verifierComptage({ produit: baguette, quantite: 30, produite: 20 }, seuils)[0]?.code, 'AVERT_PLUS_QUE_PRODUIT');
  // Seuils = donnée : un plafond plus bas change le verdict.
  assert.equal(verifierComptage({ produit: baguette, quantite: 30 }, { ...seuils, plafondPieces: 20 }).length, 1);
  // Pas de plafond en pièces pour un produit au kilo (grammes).
  assert.equal(verifierComptage({ produit: PRODUITS[2], quantite: 5000 }, seuils).length, 0);
});

test('production très éloignée de la demande → avertissement dans les deux sens', () => {
  const p = PRODUITS[0];
  const seuils = SEUILS_COMPTAGE_HYPOTHESE;
  assert.equal(verifierProduction({ produit: p, produite: 400, demandee: 40 }, seuils)[0]?.code, 'AVERT_PRODUCTION_INHABITUELLE');
  assert.equal(verifierProduction({ produit: p, produite: 4, demandee: 40 }, seuils)[0]?.code, 'AVERT_PRODUCTION_INHABITUELLE');
  assert.equal(verifierProduction({ produit: p, produite: 45, demandee: 40 }, seuils).length, 0);
});

test('inventaire.ts n’importe pas le catalogue de commande', () => {
  const source = readFileSync(new URL('./inventaire.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"][^'"]*catalogue/);
});

test('R57 inventaire commencé avant la fermeture → AVERT_INVENTAIRE_AVANT_FERMETURE, accepté', () => {
  const r = verifierHeureInventaire('19:59', HEURE_FERMETURE_HYPOTHESE);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'AVERT_INVENTAIRE_AVANT_FERMETURE');
  assert.equal(r.signalements[0]?.niveau, 'avertissement');
  assert.match(r.signalements[0]?.message ?? '', /20h00/);
});

test('R57 à l’heure de fermeture ou après → rien ; minuit → signalé ; heure illisible → bloquant', () => {
  for (const h of ['20:00', '21:30', '23:59']) {
    const r = verifierHeureInventaire(h, HEURE_FERMETURE_HYPOTHESE);
    assert.ok(r.ok);
    assert.equal(r.signalements.length, 0, h);
  }
  const minuit = verifierHeureInventaire('00:00', HEURE_FERMETURE_HYPOTHESE);
  assert.ok(minuit.ok);
  assert.equal(minuit.signalements.length, 1, 'comparaison sur la journée : le plus prudent');
  const x = verifierHeureInventaire('25:00', HEURE_FERMETURE_HYPOTHESE);
  assert.equal(x.ok, false);
  if (!x.ok) assert.equal(x.code, 'ERR_SAISIE_INVALIDE');
  const tot = verifierHeureInventaire('18:00', '17:30');
  assert.ok(tot.ok);
  assert.equal(tot.signalements.length, 0, 'heure de fermeture = donnée');
});
