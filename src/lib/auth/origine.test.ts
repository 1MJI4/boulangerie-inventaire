// node --test src/lib/auth/origine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { origineEtrangere, type EntetesOrigine } from './origine.ts';

function ecriture(p: Partial<EntetesOrigine>): EntetesOrigine {
  return { methode: 'POST', origin: null, secFetchSite: null, host: null, xForwardedHost: null, ...p };
}

test('même hôte : localhost:3000 ↔ localhost:3000 accepté', () => {
  const e = ecriture({ origin: 'http://localhost:3000', host: 'localhost:3000', secFetchSite: 'same-origin' });
  assert.equal(origineEtrangere(e, false), false);
});

test('tablette par l’IP wifi : 192.168.1.140:3000 ↔ 192.168.1.140:3000 accepté', () => {
  const e = ecriture({ origin: 'http://192.168.1.140:3000', host: '192.168.1.140:3000' });
  assert.equal(origineEtrangere(e, false), false);
});

test('autre site : evil.com ↔ 192.168.1.140:3000 refusé', () => {
  const e = ecriture({ origin: 'https://evil.com', host: '192.168.1.140:3000' });
  assert.equal(origineEtrangere(e, false), true);
  assert.equal(origineEtrangere(e, true), true);
});

test('derrière Netlify : x-forwarded-host = app.netlify.app ↔ Origin https://app.netlify.app accepté', () => {
  const e = ecriture({ origin: 'https://app.netlify.app', host: 'interne:8080', xForwardedHost: 'app.netlify.app' });
  assert.equal(origineEtrangere(e, true), false);
});

test('x-forwarded-host ignoré sans proxy de confiance : il ne peut pas autoriser contre host', () => {
  const e = ecriture({ origin: 'https://evil.com', host: 'localhost:3000', xForwardedHost: 'evil.com' });
  assert.equal(origineEtrangere(e, false), true);
});

test('Origin absent + same-origin accepté', () => {
  assert.equal(origineEtrangere(ecriture({ secFetchSite: 'same-origin', host: 'localhost:3000' }), false), false);
  // Navigateur ancien : ni Origin ni Sec-Fetch-Site.
  assert.equal(origineEtrangere(ecriture({ host: 'localhost:3000' }), false), false);
});

test('Origin absent + cross-site refusé', () => {
  assert.equal(origineEtrangere(ecriture({ secFetchSite: 'cross-site', host: 'localhost:3000' }), false), true);
});

test('cross-site refusé même si l’Origin semble correcte', () => {
  const e = ecriture({ origin: 'http://localhost:3000', host: 'localhost:3000', secFetchSite: 'cross-site' });
  assert.equal(origineEtrangere(e, false), true);
});

test('Origin « null » ou illisible refusée', () => {
  assert.equal(origineEtrangere(ecriture({ origin: 'null', host: 'localhost:3000' }), false), true);
  assert.equal(origineEtrangere(ecriture({ origin: 'file:///x', host: 'localhost:3000' }), false), true);
});

test('aucun hôte de requête lisible : refusé', () => {
  assert.equal(origineEtrangere(ecriture({ origin: 'http://localhost:3000' }), false), true);
});

test('port par défaut et casse normalisés', () => {
  const e = ecriture({ origin: 'https://App.Netlify.app', host: 'app.netlify.app:443' });
  assert.equal(origineEtrangere(e, false), false);
});

test('port différent = autre origine : refusé', () => {
  const e = ecriture({ origin: 'http://localhost:4000', host: 'localhost:3000' });
  assert.equal(origineEtrangere(e, false), true);
});

test('méthodes sûres jamais refusées ici', () => {
  for (const methode of ['GET', 'HEAD', 'OPTIONS']) {
    const e = ecriture({ methode, origin: 'https://evil.com', host: 'localhost:3000', secFetchSite: 'cross-site' });
    assert.equal(origineEtrangere(e, false), false, methode);
  }
});
