// src/lib/photosModelesDisque.test.ts
//
// Images de la galerie sur le disque : normalisation (sharp) et écriture
// atomique, dans un dossier temporaire (jamais le dossier de recette ni de
// production). Images de test fabriquées par sharp lui-même.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  COTE_MAX_SERVEUR,
  POIDS_VISE,
  dossierPhotos,
  ecrireImageAtomique,
  lireImage,
  normaliserImage,
  retirerImage,
} from './photosModelesDisque.ts';
import { ERR_FORMAT_PHOTO } from '../components/commande/photosGestion.ts';

/** Photo de test « de téléphone » : bruit (se compresse mal), orientation EXIF 6 (à tourner). */
async function photoDeTelephone(largeur: number, hauteur: number): Promise<Buffer> {
  const bruit = Buffer.alloc(largeur * hauteur * 3);
  for (let i = 0; i < bruit.length; i++) bruit[i] = (i * 2654435761) >>> 24;
  return sharp(bruit, { raw: { width: largeur, height: hauteur, channels: 3 } })
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'Appareil de test', Software: 'TEST-GPS' } } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

test('normalisation : orientation EXIF appliquée, côté long 640, JPEG ≤ 80 Ko, sans métadonnées', async () => {
  const entree = await photoDeTelephone(2000, 1500); // paysage, à tourner d'un quart de tour
  const r = await normaliserImage(entree);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const m = await sharp(r.donnees).metadata();
  assert.equal(m.format, 'jpeg');
  assert.equal(Math.max(m.width!, m.height!), COTE_MAX_SERVEUR);
  assert.equal(m.width, 480, 'tournée : portrait');
  assert.equal(m.height, 640);
  assert.equal(m.orientation, undefined, 'plus d’orientation EXIF');
  assert.equal(m.exif, undefined, 'métadonnées retirées');
  assert.ok(r.donnees.length <= POIDS_VISE, `${r.donnees.length} octets`);
});

test('normalisation : petite image jamais agrandie ; PNG transparent → JPEG fond blanc', async () => {
  const png = await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const r = await normaliserImage(png);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const m = await sharp(r.donnees).metadata();
  assert.equal(m.format, 'jpeg');
  assert.equal(m.width, 300);
  assert.equal(m.height, 200);
});

test('normalisation : fichier qui n’est pas une image, SVG → « Format de photo non pris en charge »', async () => {
  for (const mauvais of [Buffer.from('pas une image'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), Buffer.alloc(0)]) {
    const r = await normaliserImage(mauvais);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, ERR_FORMAT_PHOTO);
      assert.match(r.message, /JPEG ou faites une capture d’écran/);
    }
  }
});

test('écriture atomique : aucun fichier temporaire laissé ; lecture refusée hors format', async () => {
  const dossier = await mkdtemp(join(tmpdir(), 'photos-modeles-'));
  try {
    await ecrireImageAtomique(dossier, 'P001.jpg', Buffer.from('image'));
    assert.deepEqual(await readdir(dossier), ['P001.jpg']);
    assert.equal((await lireImage(dossier, 'P001.jpg'))?.toString(), 'image');
    assert.equal(await lireImage(dossier, 'P002.jpg'), null, 'absente → null (404)');
    assert.equal(await lireImage(dossier, '../P001.jpg'), null, 'chemin refusé');
    await assert.rejects(ecrireImageAtomique(dossier, '../evasion.jpg', Buffer.from('x')));
    await retirerImage(dossier, 'P001.jpg');
    assert.deepEqual(await readdir(dossier), []);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
});

test('dossier : variable absente, non posée ou relative → refus clair (prévenir le gérant, référence)', () => {
  const avant = process.env.DOSSIER_PHOTOS_MODELES;
  try {
    for (const v of [undefined, '', '[POSÉ PAR recette:base]', 'donnees/modeles']) {
      if (v === undefined) delete process.env.DOSSIER_PHOTOS_MODELES;
      else process.env.DOSSIER_PHOTOS_MODELES = v;
      const r = dossierPhotos();
      assert.equal(r.ok, false, String(v));
      if (!r.ok) {
        assert.equal(r.code, 'ERR_CONFIGURATION_SERVEUR');
        assert.match(r.message, /Prévenez le gérant/);
        assert.doesNotMatch(r.message, /DOSSIER_PHOTOS_MODELES/);
      }
    }
    process.env.DOSSIER_PHOTOS_MODELES = tmpdir();
    assert.deepEqual(dossierPhotos(), { ok: true, donnees: tmpdir(), signalements: [] });
  } finally {
    if (avant === undefined) delete process.env.DOSSIER_PHOTOS_MODELES;
    else process.env.DOSSIER_PHOTOS_MODELES = avant;
  }
});
