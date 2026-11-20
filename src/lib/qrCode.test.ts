// node --test src/lib/qrCode.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matriceQr, cheminSvgQr } from './qrCode.ts';
import { ADRESSE_QR } from './coordonneesMagasin.ts';

test('QR : matrice carrée avec les trois repères aux coins', () => {
  const m = matriceQr(ADRESSE_QR);
  const n = m.length;
  assert.ok(n >= 21 && n <= 41, `taille inattendue : ${n}`);
  assert.ok(m.every((l) => l.length === n));
  // Un repère = carré sombre de 7x7 dont le centre 3x3 est plein et l'anneau intérieur clair.
  for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    assert.ok(m[y0][x0] && m[y0][x0 + 6] && m[y0 + 6][x0] && m[y0 + 6][x0 + 6]);
    assert.ok(m[y0 + 3][x0 + 3]);
    assert.ok(!m[y0 + 1][x0 + 1]);
  }
});

test('QR : le chemin SVG compte un carré par module sombre', () => {
  const m = matriceQr(ADRESSE_QR);
  const sombres = m.flat().filter(Boolean).length;
  assert.equal(cheminSvgQr(m).split('z').length - 1, sombres);
});

test('QR : à 5 points par module, le code tient dans le papier (576)', () => {
  const n = matriceQr(ADRESSE_QR).length;
  assert.ok((n + 8) * 5 <= 576);
});
