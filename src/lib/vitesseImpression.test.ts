// node --test src/lib/vitesseImpression.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moyenneVitesse } from './vitesseImpression.ts';

test('vitesse apprise : moyenne glissante vers la mesure', () => {
  // 4 000 lignes sorties en 6 s = 1,5 ms/ligne ; depuis 1 : 0,6 × 1 + 0,4 × 1,5.
  assert.ok(Math.abs(moyenneVitesse(1, 6000, 4000) - 1.2) < 1e-9);
});

test('vitesse apprise : une mesure absurde ne change rien, les bornes tiennent', () => {
  assert.equal(moyenneVitesse(1.2, 0, 4000), 1.2);
  assert.equal(moyenneVitesse(1.2, 5000, 0), 1.2);
  assert.equal(moyenneVitesse(10, 10_000_000, 10), 12);
});
