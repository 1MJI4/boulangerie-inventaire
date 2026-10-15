// node --test src/lib/auth/chemins.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheminDeRetour, estCheminApi, estCheminPublic } from './chemins.ts';

test('exceptions explicites : connexion, statiques, imprimante', () => {
  for (const c of [
    '/connexion',
    '/_next/static/chunks/app.js',
    '/favicon.ico',
    '/icon.png',
    '/icone-192.png',
    '/manifest.webmanifest',
    '/api/cloudprnt/une-cle',
  ]) {
    assert.equal(estCheminPublic(c), true, c);
  }
});

test('tout le reste est protégé par défaut', () => {
  for (const c of [
    '/',
    '/inventaire',
    '/commandes',
    '/commandes/12/imprimer',
    '/dashboard',
    '/connexion/autre',
    '/api/commandes',
    '/api/tarifs',
    '/api/impression',
    '/api/gestion',
    '/api/cloudprnt',
    '/api/nouvelle-route-oubliee',
    '/dossier/fichier.png',
    '/api/fichier.png',
  ]) {
    assert.equal(estCheminPublic(c), false, c);
  }
});

test('reconnaissance des routes API', () => {
  assert.equal(estCheminApi('/api/commandes'), true);
  assert.equal(estCheminApi('/apiculture'), false);
});

test('retour après connexion : jamais vers un autre site', () => {
  assert.equal(cheminDeRetour('/commandes?statut=en_cours'), '/commandes?statut=en_cours');
  for (const mauvais of ['https://exemple.com', '//exemple.com', '/\\exemple.com', 'commandes', '/connexion', undefined, 42]) {
    assert.equal(cheminDeRetour(mauvais), '/', String(mauvais));
  }
});
