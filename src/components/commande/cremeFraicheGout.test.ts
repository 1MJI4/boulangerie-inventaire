// R70 (propriétaire 17/11/2026) : Crème fraîche à la vanille ; un autre goût
// demande le code du manager. Côté écran : goût pré-rempli et bouton de sortie.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sortieDe } from './sorties.ts';
import { ligneVide } from './modele.ts';

test('R70 : la sortie du goût réservé dit « Remettre Vanille », jamais « undefined »', () => {
  const so = sortieDe({
    ok: false,
    niveau: 'bloquant',
    code: 'ERR_GOUT_RESERVE',
    message: '',
    champ: 'lignes[0].gouts',
    valeurProposee: 'Vanille',
  });
  assert.equal(so.libelle, 'Remettre Vanille');
  assert.equal(so.avecValeur, true);
});

test('R70 : une nouvelle ligne Crème fraîche arrive avec Vanille ; un autre gâteau, sans goût', () => {
  assert.deepEqual(ligneVide('gateaux-sur-commande/creme-fraiche').gouts, ['Vanille']);
  assert.deepEqual(ligneVide('gateaux-sur-commande/bavarois').gouts, []);
});
