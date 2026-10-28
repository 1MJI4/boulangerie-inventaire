// node --test src/catalogue/goutsSurCommande.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOUTS_SUR_COMMANDE } from './goutsSurCommande.ts';

test('Bavarois sur commande : mousse chocolat ou Matadi chocolat, rien d’autre (propriétaire, 28/10/2026)', () => {
  assert.deepEqual(GOUTS_SUR_COMMANDE['gateaux-sur-commande/bavarois'].goutsProposes, ['Mousse chocolat', 'Matadi chocolat']);
});

test('les autres gâteaux gardent la liste du gérant', () => {
  for (const [id, choix] of Object.entries(GOUTS_SUR_COMMANDE)) {
    if (id === 'gateaux-sur-commande/bavarois') continue;
    assert.equal(choix.goutsProposes, undefined, id);
  }
});
