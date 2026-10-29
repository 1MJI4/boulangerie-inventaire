// node --test src/catalogue/typesAccueil.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_ACCUEIL_PAR_PRODUIT } from './typesAccueil.ts';
import { chargerCatalogueDepuisDossier } from './chargerFichiers.ts';
import { typesDeCommande } from '../lib/commandes.ts';

const ligne = (cleCatalogue: string, categorie: string, nom: string) =>
  ({ produitCatalogue: { cleCatalogue, categorie, nom, regimePrix: 'A' as const } }) as never;

test('chaque exception du filtre de l’accueil désigne un produit qui existe au catalogue', () => {
  const produits = chargerCatalogueDepuisDossier().catalogue.produits;
  for (const cle of Object.keys(TYPE_ACCUEIL_PAR_PRODUIT)) assert.ok(produits.has(cle), cle);
});

test('8 Msemen : Salé sur l’accueil, le reste de l’Oriental ne bouge pas (29/10/2026)', () => {
  assert.deepEqual(typesDeCommande({ lignes: [ligne('oriental/msemen/semoule', 'Oriental', 'Msemen')] }), ['sale']);
  assert.deepEqual(typesDeCommande({ lignes: [ligne('oriental/corne-de-gazelle', 'Oriental', 'Corne de gazelle')] }), ['patisserie']);
});
