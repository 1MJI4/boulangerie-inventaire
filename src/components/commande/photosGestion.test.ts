// src/components/commande/photosGestion.test.ts
//
// Galerie gérée par le gérant (décision du propriétaire, 26/10/2026) :
// lecture de l'identifiant de photo d'une ligne contre la base (photo masquée),
// noms de fichiers servis, dimensions de la réduction faite par la tablette,
// messages des refus d'image (LOI 9 : en français, disent quoi faire).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ERR_FORMAT_PHOTO,
  ERR_PHOTO_MASQUEE,
  dimensionsReduites,
  idsPhotosCites,
  lirePhotoDeLigne,
  nomFichierServable,
  refusFormatPhoto,
  refusPhotoTropLourde,
  typeContenuPhoto,
} from './photosGestion.ts';

const CHAMP = 'lignes[2].photoModele';
const visible = { id: 'G043', masquee: false };
const masquee = { id: 'G019', masquee: true };

test('ligne : pas de photo (absente, null, vide) → acceptée sans photo', () => {
  for (const v of [undefined, null, '']) assert.deepEqual(lirePhotoDeLigne(v, null, false, CHAMP), { ok: true, valeur: null });
});

test('ligne : photo visible en base → gardée telle quelle', () => {
  assert.deepEqual(lirePhotoDeLigne('G043', visible, false, CHAMP), { ok: true, valeur: 'G043' });
});

test('ligne : identifiant mal formé ou absent de la base → refus humain, jamais corrigé en silence', () => {
  for (const mauvais of ['g043', 'G43', 'G0433', ' G043', 42, { id: 'G043' }]) {
    const r = lirePhotoDeLigne(mauvais, visible, false, CHAMP);
    assert.equal(r.ok, false, JSON.stringify(mauvais));
  }
  const inconnue = lirePhotoDeLigne('G999', null, false, CHAMP);
  assert.equal(inconnue.ok, false);
  if (!inconnue.ok) {
    assert.equal(inconnue.code, 'ERR_SAISIE_INVALIDE');
    assert.equal(inconnue.champ, CHAMP);
    assert.match(inconnue.message, /photo du modèle/);
    assert.doesNotMatch(inconnue.message, /CHECK|constraint|Prisma|violates|foreign/i);
  }
  // Photo lue pour un AUTRE identifiant : jamais acceptée.
  assert.equal(lirePhotoDeLigne('G043', masquee, true, CHAMP).ok, false);
});

test('ligne NOUVELLE avec une photo masquée → refus, sortie « Retirer la photo » (valeur null)', () => {
  const r = lirePhotoDeLigne('G019', masquee, false, CHAMP);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, ERR_PHOTO_MASQUEE);
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.champ, CHAMP);
    assert.equal(r.valeurProposee, null);
    assert.match(r.message, /G019/);
    assert.match(r.message, /retirez-la/);
  }
});

test('ligne EXISTANTE qui portait déjà la photo masquée → la garde', () => {
  assert.deepEqual(lirePhotoDeLigne('G019', masquee, true, CHAMP), { ok: true, valeur: 'G019' });
});

test('photos citées : identifiants au bon format, sans doublon ; rien à lire sans photo', () => {
  assert.deepEqual(idsPhotosCites([{ photoModele: 'G043' }, { photoModele: 'G043' }, { photoModele: 'P001' }, { photoModele: 'x' }, {}, null]), ['G043', 'P001']);
  assert.deepEqual(idsPhotosCites(undefined), []);
  assert.deepEqual(idsPhotosCites([{ produitId: 'a' }]), []);
});

test('fichier servi : format de la base, jamais un chemin ni un fichier caché', () => {
  for (const bon of ['G043.jpg', 'P001.jpg', 'S005.webp', 'G001-bis.png', 'G001_2.JPEG']) assert.equal(nomFichierServable(bon), true, bon);
  for (const mauvais of [
    '../G043.jpg',
    'G043.jpg/..',
    '..\\G043.jpg',
    '/etc/passwd',
    '.G043.jpg.abc.tmp',
    '.env',
    'G043.jpg.tmp',
    'G043.svg',
    'G043.heic',
    'g043.jpg',
    'G043',
    '',
    'G043.jpg\0',
    'C:G043.jpg',
    42,
  ]) {
    assert.equal(nomFichierServable(mauvais), false, String(mauvais));
  }
});

test('Content-Type selon l’extension', () => {
  assert.equal(typeContenuPhoto('G043.jpg'), 'image/jpeg');
  assert.equal(typeContenuPhoto('G043.JPEG'), 'image/jpeg');
  assert.equal(typeContenuPhoto('G043.png'), 'image/png');
  assert.equal(typeContenuPhoto('G043.webp'), 'image/webp');
  assert.equal(typeContenuPhoto('G043.gif'), null);
});

test('réduction sur la tablette : côté long ≤ 1280, proportions gardées, jamais agrandie', () => {
  assert.deepEqual(dimensionsReduites(4000, 3000), { largeur: 1280, hauteur: 960 });
  assert.deepEqual(dimensionsReduites(3000, 4000), { largeur: 960, hauteur: 1280 });
  assert.deepEqual(dimensionsReduites(800, 600), { largeur: 800, hauteur: 600 });
  assert.deepEqual(dimensionsReduites(10000, 3), { largeur: 1280, hauteur: 1 });
  assert.equal(dimensionsReduites(0, 100), null);
  assert.equal(dimensionsReduites(Number.NaN, 100), null);
});

test('refus d’image : français, disent quoi faire, pointent le champ image', () => {
  const f = refusFormatPhoto();
  assert.equal(f.code, ERR_FORMAT_PHOTO);
  assert.equal(f.message, 'Format de photo non pris en charge\u00a0: prenez la photo en JPEG ou faites une capture d’écran, s’il vous plaît.');
  assert.equal(f.champ, 'image');
  const t = refusPhotoTropLourde();
  assert.match(t.message, /10\u00a0Mo/);
  assert.match(t.message, /reprenez-la|capture d’écran/);
});
