// node --test src/catalogue/goutsSurCommande.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOUTS_SUR_COMMANDE } from './goutsSurCommande.ts';
import { ordonnerGouts } from '../domaine/gouts.ts';
import { chargerCatalogueDepuisDossier } from './chargerFichiers.ts';

const BAVAROIS = GOUTS_SUR_COMMANDE['gateaux-sur-commande/bavarois'];

test('Bavarois sur commande : les goûts du comptoir en premier (propriétaire, 28/10/2026)', () => {
  assert.deepEqual(BAVAROIS.goutsEnTete, ['Mangue', 'Fruits de la passion', 'Framboise', 'Fraisier', 'Matadi chocolat', 'Mousse chocolat']);
});

test('chaque goût en tête du Bavarois est un gâteau du comptoir, libellé à la lettre (LOI 5)', () => {
  const noms = new Set([...chargerCatalogueDepuisDossier().catalogue.produits.values()].map((p) => p.produit));
  for (const g of BAVAROIS.goutsEnTete ?? []) {
    assert.ok(noms.has(g) || noms.has(`Bavarois ${g.toLocaleLowerCase('fr')}`), `${g} absent du comptoir`);
  }
});

test('la liste du manager suit, sans doublon ni casse en double', () => {
  const liste = ['Chocolat', 'Vanille', 'Framboise', 'mousse chocolat', 'Pistache'];
  assert.deepEqual(ordonnerGouts(BAVAROIS.goutsEnTete, liste), [
    'Mangue', 'Fruits de la passion', 'Framboise', 'Fraisier', 'Matadi chocolat', 'Mousse chocolat', 'Chocolat', 'Vanille', 'Pistache',
  ]);
  // Sans goûts en tête : la liste du manager telle quelle.
  assert.deepEqual(ordonnerGouts(undefined, ['Vanille', 'Vanille ', 'Fraise']), ['Vanille', 'Fraise']);
});

test('les autres gâteaux gardent la liste du manager seule', () => {
  for (const [id, choix] of Object.entries(GOUTS_SUR_COMMANDE)) {
    if (id === 'gateaux-sur-commande/bavarois') continue;
    assert.equal(choix.goutsEnTete, undefined, id);
  }
});
