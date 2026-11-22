import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estIdPhotoStock } from './photosStockDisque.ts';

test('photo de stock : seul un identifiant numérique est un nom valide', () => {
  for (const ok of ['1', '42', '1234567890']) assert.equal(estIdPhotoStock(ok), true, ok);
  for (const ko of ['', '0', '01', '../x', '1.jpg', 'a', '12345678901', '1/2', null, 3]) assert.equal(estIdPhotoStock(ko), false, String(ko));
});
