// node --test src/lib/auth/session.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  DUREES,
  cleDeSignature,
  creerJeton,
  doitRafraichir,
  dureeCookieSecondes,
  nouvelAppareil,
  prolonger,
  signerJeton,
  verifierJeton,
} from './session.ts';

// Valeurs de test générées pour ce fichier, sans rapport avec la production.
const SECRET = 'secret-de-test-suffisamment-long-0123456789';
const CODE_T = 'tablette-test-1234';
const CODE_G = 'gerant-test-5678';
const CLE_T = cleDeSignature('tablette', SECRET, CODE_T)!;
const CLE_G = cleDeSignature('gerant', SECRET, CODE_G)!;
const T0 = Date.UTC(2026, 9, 15, 6, 0, 0);
const JOUR = 24 * 60 * 60 * 1000;
const APPAREIL = nouvelAppareil();

test('un jeton signé se relit à l’identique', () => {
  const j = creerJeton('tablette', APPAREIL, T0);
  assert.deepEqual(verifierJeton(signerJeton(j, CLE_T), CLE_T, 'tablette', T0 + 1000), j);
});

test('changer SESSION_SECRET ou CODE_TABLETTE déconnecte toutes les tablettes', () => {
  const jeton = signerJeton(creerJeton('tablette', APPAREIL, T0), CLE_T);
  const autreSecret = cleDeSignature('tablette', 'un-autre-secret-de-test-tres-long-9876543210', CODE_T);
  const autreCode = cleDeSignature('tablette', SECRET, 'nouveau-code-tablette');
  assert.equal(verifierJeton(jeton, autreSecret, 'tablette', T0), null);
  assert.equal(verifierJeton(jeton, autreCode, 'tablette', T0), null);
});

test('changer CODE_GESTION ferme les accès gérant, sans toucher aux tablettes', () => {
  const g = signerJeton(creerJeton('gerant', APPAREIL, T0), CLE_G);
  assert.equal(verifierJeton(g, cleDeSignature('gerant', SECRET, 'autre-code-gerant'), 'gerant', T0), null);
  assert.ok(cleDeSignature('tablette', SECRET, CODE_T)!.equals(CLE_T));
});

test('secret ou code trop courts : aucune clé, rien de signé ni d’accepté', () => {
  assert.equal(cleDeSignature('tablette', 'court', CODE_T), null);
  assert.equal(cleDeSignature('tablette', SECRET, '1234'), null, 'ancien code à 4 chiffres');
  assert.equal(cleDeSignature('gerant', SECRET, '1234567'), null, '7 caractères');
  assert.ok(cleDeSignature('gerant', SECRET, '12345678'));
  assert.equal(cleDeSignature('tablette', null, CODE_T), null);
  assert.throws(() => signerJeton(creerJeton('tablette', APPAREIL, T0), null));
  assert.equal(verifierJeton(signerJeton(creerJeton('tablette', APPAREIL, T0), CLE_T), null, 'tablette', T0), null);
});

test('un jeton gérant ne vaut pas jeton tablette, et inversement', () => {
  const g = signerJeton(creerJeton('gerant', APPAREIL, T0), CLE_G);
  const t = signerJeton(creerJeton('tablette', APPAREIL, T0), CLE_T);
  assert.equal(verifierJeton(g, CLE_T, 'tablette', T0), null);
  assert.equal(verifierJeton(t, CLE_G, 'gerant', T0), null);
  // Même signé avec la bonne clé, le type est contrôlé.
  assert.equal(verifierJeton(signerJeton(creerJeton('gerant', APPAREIL, T0), CLE_T), CLE_T, 'tablette', T0), null);
});

test('modifier le contenu invalide la signature', () => {
  const jeton = signerJeton(creerJeton('tablette', APPAREIL, T0), CLE_T);
  const [, sig] = jeton.split('.');
  const falsifie = Buffer.from(JSON.stringify({ ...creerJeton('tablette', APPAREIL, T0), ouverteA: T0 + JOUR }))
    .toString('base64url');
  assert.equal(verifierJeton(`${falsifie}.${sig}`, CLE_T, 'tablette', T0), null);
  const i = jeton.length - 10;
  const altere = jeton.slice(0, i) + (jeton[i] === 'A' ? 'B' : 'A') + jeton.slice(i + 1);
  assert.equal(verifierJeton(altere, CLE_T, 'tablette', T0), null);
});

test('jetons mal formés : null, jamais d’exception', () => {
  for (const j of [undefined, null, '', '.', 'abc', 'a.b.c', 'é.é', 'x'.repeat(5000)]) {
    assert.equal(verifierJeton(j as string, CLE_T, 'tablette', T0), null);
  }
  const bloc = Buffer.from(JSON.stringify({ v: 2, t: 'tablette', appareil: '<script>', ouverteA: T0, activeA: T0 }))
    .toString('base64url');
  const sig = createHmac('sha256', CLE_T).update(bloc).digest('base64url');
  assert.equal(verifierJeton(`${bloc}.${sig}`, CLE_T, 'tablette', T0), null, 'identifiant d’appareil invalide');
});

test('session de tablette longue : 180 jours d’inactivité, puis expirée', () => {
  const jeton = signerJeton(creerJeton('tablette', APPAREIL, T0), CLE_T);
  assert.ok(verifierJeton(jeton, CLE_T, 'tablette', T0 + 179 * JOUR));
  assert.equal(verifierJeton(jeton, CLE_T, 'tablette', T0 + 180 * JOUR), null);
  assert.equal(dureeCookieSecondes(creerJeton('tablette', APPAREIL, T0), T0), 180 * 24 * 3600);
});

test('tablette utilisée chaque semaine : jamais déconnectée, même après deux ans', () => {
  let j = creerJeton('tablette', APPAREIL, T0);
  for (let t = T0 + 7 * JOUR; t < T0 + 730 * JOUR; t += 7 * JOUR) {
    const relu = verifierJeton(signerJeton(j, CLE_T), CLE_T, 'tablette', t);
    assert.ok(relu, `tablette perdue au jour ${(t - T0) / JOUR}`);
    if (doitRafraichir(relu, t)) j = prolonger(relu, t);
  }
});

test('accès gérant : 30 min sans action, et 8 h au plus même actif', () => {
  const j = creerJeton('gerant', APPAREIL, T0);
  const s = signerJeton(j, CLE_G);
  assert.ok(verifierJeton(s, CLE_G, 'gerant', T0 + DUREES.gerant.inactiviteMs - 1));
  assert.equal(verifierJeton(s, CLE_G, 'gerant', T0 + DUREES.gerant.inactiviteMs), null);

  let g = j;
  let t = T0;
  while (t + 10 * 60 * 1000 < T0 + DUREES.gerant.maxMs) {
    t += 10 * 60 * 1000;
    const relu = verifierJeton(signerJeton(g, CLE_G), CLE_G, 'gerant', t);
    assert.ok(relu, `gérant perdu à t+${(t - T0) / 60000} min`);
    if (doitRafraichir(relu, t)) g = prolonger(relu, t);
  }
  assert.equal(verifierJeton(signerJeton(g, CLE_G), CLE_G, 'gerant', T0 + DUREES.gerant.maxMs), null);
  assert.equal(dureeCookieSecondes(prolonger(j, T0 + DUREES.gerant.maxMs - 60_000), T0 + DUREES.gerant.maxMs - 60_000), 60);
});

test('rafraîchissement : pas à chaque requête', () => {
  const t = creerJeton('tablette', APPAREIL, T0);
  assert.equal(doitRafraichir(t, T0 + JOUR - 1), false);
  assert.equal(doitRafraichir(t, T0 + JOUR), true);
  const g = creerJeton('gerant', APPAREIL, T0);
  assert.equal(doitRafraichir(g, T0 + 59_000), false);
  assert.equal(doitRafraichir(g, T0 + 60_000), true);
  assert.equal(prolonger(t, T0 + 5).ouverteA, T0);
});

test('dates dans le futur refusées', () => {
  const futur = creerJeton('tablette', APPAREIL, T0 + 10 * 60 * 1000);
  assert.equal(verifierJeton(signerJeton(futur, CLE_T), CLE_T, 'tablette', T0), null);
});
