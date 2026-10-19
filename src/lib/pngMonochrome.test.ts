// node --test src/lib/pngMonochrome.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { enBase64, pngMonochrome, type Zlib } from './pngMonochrome.ts';

const zlib: Zlib = async (d) => new Uint8Array(deflateSync(d));

/** Image RGBA : noir là où `noir(x, y)`, blanc ailleurs. */
function image(l: number, h: number, noir: (x: number, y: number) => boolean): Uint8Array {
  const d = new Uint8Array(l * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = (y * l + x) * 4;
      const v = noir(x, y) ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return d;
}

function lire(png: Uint8Array) {
  const b = Buffer.from(png);
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const largeur = b.readUInt32BE(16);
  const hauteur = b.readUInt32BE(20);
  const profondeur = b[24];
  const couleur = b[25];
  const idatLongueur = b.readUInt32BE(33);
  assert.equal(b.subarray(37, 41).toString('latin1'), 'IDAT');
  const brut = inflateSync(b.subarray(41, 41 + idatLongueur));
  return { largeur, hauteur, profondeur, couleur, brut };
}

test('ticket 576 points : PNG 1 bit niveaux de gris, en-tête exact', async () => {
  const png = await pngMonochrome(image(576, 1283, () => false), 576, 1283, zlib);
  const r = lire(png);
  assert.equal(r.largeur, 576);
  assert.equal(r.hauteur, 1283);
  assert.equal(r.profondeur, 1);
  assert.equal(r.couleur, 0);
  // Décodé : 1283 lignes × (1 octet de filtre + 72 octets) — ~94 Ko au lieu de ~3 Mo en RGBA.
  assert.equal(r.brut.length, 1283 * 73);
  assert.ok(r.brut.length < 100_000);
});

test('les points noirs restent noirs, le blanc reste blanc, au bit près', async () => {
  // Largeur 10 (non multiple de 8) : colonne 0 noire, ligne 1 entièrement noire.
  const png = await pngMonochrome(image(10, 3, (x, y) => x === 0 || y === 1), 10, 3, zlib);
  const { brut } = lire(png);
  // Ligne 0 : filtre 0, puis 0b01111111 0b11000000 (bits de remplissage à 0).
  assert.deepEqual([...brut.subarray(0, 3)], [0, 0b01111111, 0b11000000]);
  assert.deepEqual([...brut.subarray(3, 6)], [0, 0, 0]);
  assert.deepEqual([...brut.subarray(6, 9)], [0, 0b01111111, 0b11000000]);
});

test('transparence posée sur du blanc ; gris clair → blanc, gris foncé → noir', async () => {
  const d = new Uint8Array([0, 0, 0, 0, 200, 200, 200, 255, 60, 60, 60, 255]);
  const { brut } = lire(await pngMonochrome(d, 3, 1, zlib));
  assert.equal(brut[1], 0b11000000);
});

test('dimensions incohérentes : refus clair', async () => {
  await assert.rejects(pngMonochrome(new Uint8Array(4), 2, 1, zlib), RangeError);
  await assert.rejects(pngMonochrome(new Uint8Array(0), 0, 0, zlib), RangeError);
});

test('base64 identique à celui de Node', () => {
  const o = new Uint8Array(70_000).map((_, i) => i % 251);
  assert.equal(enBase64(o), Buffer.from(o).toString('base64'));
});
