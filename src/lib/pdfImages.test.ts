import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfDepuisJpegs } from './pdfImages.ts';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

test('PDF : en-tête, une page par image, xref aux bons décalages', () => {
  const pdf = pdfDepuisJpegs([
    { jpeg: JPEG, largeur: 10, hauteur: 20 },
    { jpeg: JPEG, largeur: 10, hauteur: 20 },
  ]);
  const t = Buffer.from(pdf).toString('latin1');
  assert.ok(t.startsWith('%PDF-1.4'));
  assert.ok(t.trimEnd().endsWith('%%EOF'));
  assert.match(t, /\/Count 2/);
  const debut = Number(/startxref\n(\d+)/.exec(t)![1]);
  assert.ok(t.slice(debut).startsWith('xref'));
  const lignes = [...t.slice(debut).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.equal(lignes.length, 2 + 2 * 3);
  lignes.forEach((d, i) => assert.ok(t.slice(d).startsWith(`${i + 1} 0 obj`), `objet ${i + 1}`));
});
