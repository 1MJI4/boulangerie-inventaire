// node --test src/lib/cloudprnt.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationReussie } from './cloudprnt.ts';

test('confirmation CloudPRNT : « 200 OK » (TSP100IV) est une réussite', () => {
  for (const code of ['200 OK', '200', '200 ok', ' 200 OK ', '202 Accepted', 'OK', 'ok', null, undefined]) {
    assert.equal(confirmationReussie(code), true, String(code));
  }
});

test('confirmation CloudPRNT : tout autre code est un échec, le ticket repart en file', () => {
  for (const code of ['520 Download failed', '510 Paper empty', '500', '404 Not Found', 'KO', '', '2000', '20 OK']) {
    assert.equal(confirmationReussie(code), false, code);
  }
});
