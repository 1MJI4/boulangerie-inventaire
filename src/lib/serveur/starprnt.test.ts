import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { pngMonochrome } from '../pngMonochrome.ts';
import { decoderPngMonochrome, pngVersStarPrnt } from './starprnt.ts';

/** Image RGBA : point noir en (0,0) et (9,1), blanc ailleurs ; 10 × 2 points. */
function image(): { points: Uint8ClampedArray; largeur: number; hauteur: number } {
  const largeur = 10;
  const hauteur = 2;
  const points = new Uint8ClampedArray(largeur * hauteur * 4).fill(255);
  for (const [x, y] of [[0, 0], [9, 1]]) {
    const i = (y * largeur + x) * 4;
    points[i] = points[i + 1] = points[i + 2] = 0;
  }
  return { points, largeur, hauteur };
}

test('StarPRNT : le PNG de l’aperçu redevient les mêmes points, bit à 1 = noir', async () => {
  const { points, largeur, hauteur } = image();
  const png = await pngMonochrome(points, largeur, hauteur, async (d) => new Uint8Array(deflateSync(d)));
  const r = decoderPngMonochrome(png);
  assert.ok(r);
  assert.equal(r.octetsParLigne, 2);
  assert.deepEqual([...r.points], [0b1000_0000, 0, 0, 0b0100_0000]);
});

test('StarPRNT : remise à zéro, raster par bande, coupe à la fin', async () => {
  const { points, largeur, hauteur } = image();
  const png = await pngMonochrome(points, largeur, hauteur, async (d) => new Uint8Array(deflateSync(d)));
  const s = pngVersStarPrnt(png);
  assert.ok(s);
  assert.deepEqual([...s.subarray(0, 2)], [0x1b, 0x40]);
  assert.deepEqual([...s.subarray(2, 11)], [0x1b, 0x1d, 0x53, 0x01, 2, 0, 2, 0, 0]);
  assert.deepEqual([...s.subarray(-3)], [0x1b, 0x64, 0x03]);
  assert.equal(s.length, 2 + 9 + 4 + 3);
});

test('StarPRNT : un fichier qui n’est pas le PNG attendu → null (on servira le PNG)', () => {
  assert.equal(pngVersStarPrnt(new Uint8Array([1, 2, 3])), null);
});
