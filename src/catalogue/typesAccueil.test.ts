// node --test src/catalogue/typesAccueil.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_ACCUEIL_PAR_PRODUIT, TYPE_ACCUEIL_PAR_RAYON } from './typesAccueil.ts';
import { chargerCatalogueDepuisDossier } from './chargerFichiers.ts';
import { typesDeCommande } from '../lib/commandes.ts';

const produits = chargerCatalogueDepuisDossier().catalogue.produits;
const ligneDe = (cle: string) => {
  const p = produits.get(cle);
  assert.ok(p, cle);
  return { produitCatalogue: { cleCatalogue: cle, categorie: p.categorie, nom: p.produit, regimePrix: 'A' as const } } as never;
};

test('chaque rayon et chaque produit cités existent au catalogue', () => {
  const rayons = new Set([...produits.values()].map((p) => p.categorie));
  for (const r of Object.keys(TYPE_ACCUEIL_PAR_RAYON)) assert.ok(rayons.has(r), r);
  for (const cle of Object.keys(TYPE_ACCUEIL_PAR_PRODUIT)) assert.ok(produits.has(cle), cle);
});

test('tout le rayon Oriental va dans Salé sur l’accueil (29/10/2026)', () => {
  const orientaux = [...produits.entries()].filter(([, p]) => p.categorie === 'Oriental').map(([cle]) => cle);
  assert.ok(orientaux.length >= 10);
  for (const cle of orientaux) assert.deepEqual(typesDeCommande({ lignes: [ligneDe(cle)] }), ['sale'], cle);
});
