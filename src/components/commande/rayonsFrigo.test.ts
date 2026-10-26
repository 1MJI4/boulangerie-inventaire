// src/components/commande/rayonsFrigo.test.ts
//
// Propriétaire, 26/10/2026 : les rayons du frigo ne s'affichent plus dans la
// grille par défaut ni dans les boutons de famille ; ils restent trouvables par
// la recherche. Prix : valeur de test arbitraire (LOI 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAYONS_HORS_LISTE_PAR_DEFAUT, boutonsFamilles, fichesVisibles, type CatalogueCommande, type FicheCatalogue } from './modele.ts';

function fiche(id: string, produit: string, categorie: string, estFavori: boolean, regime: 'A' | 'B' = 'A'): FicheCatalogue {
  return {
    produit: { id, produit, sousCategorie: '', unite: 'piece', regimePrix: regime, famille: 'sale', categorie, estFavori },
    prix: { prixCentimes: 123, basePrix: 'piece', prixEstPlancher: false, minQuantite: null, minParSymbole: null, maxParUnite: null },
  };
}

const cat: CatalogueCommande = {
  date: '2026-10-28',
  fiches: [
    fiche('frigo-boisson/coca', 'Coca', 'Frigo-Boisson', true),
    fiche('frigo-s/salade', 'Salade', 'Frigo-S', true),
    fiche('boulangerie/baguette', 'Baguette', 'Boulangerie', true),
    fiche('sur-commande/mini-wrap', 'Mini wrap', 'Sur commande', false, 'B'),
  ],
};

test('rayons du frigo : donnée nommée, noms du catalogue à la lettre', () => {
  assert.deepEqual([...RAYONS_HORS_LISTE_PAR_DEFAUT], ['Frigo-Boisson', 'Frigo-S']);
});

test('grille par défaut : sans les produits du frigo, même favoris', () => {
  const ids = fichesVisibles(cat, '', null).map((f) => f.produit.id);
  assert.deepEqual(ids, ['boulangerie/baguette', 'sur-commande/mini-wrap']);
});

test('recherche : les produits du frigo restent trouvables', () => {
  assert.deepEqual(fichesVisibles(cat, 'coca', null).map((f) => f.produit.id), ['frigo-boisson/coca']);
  assert.deepEqual(fichesVisibles(cat, 'salade', null).map((f) => f.produit.id), ['frigo-s/salade']);
});

test('boutons de famille : aucun bouton pour les rayons du frigo', () => {
  const rayons = boutonsFamilles(cat).map((b) => b.rayon);
  assert.ok(!rayons.includes('Frigo-Boisson'));
  assert.ok(!rayons.includes('Frigo-S'));
  assert.ok(rayons.includes('Boulangerie'));
});
