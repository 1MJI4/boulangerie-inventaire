// node --test src/domaine/notifications.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateIsoValide,
  minutesDepuisRetrait,
  notifCommandeCreee,
  notifCommandeModifiee,
  notifInventaireTermine,
  notifTest,
  rappelsDus,
  sonneEnSalle,
} from './notifications.ts';

const C = { id: 7, numero: '2026-0247', retraitLe: '2026-11-21', retraitHeure: '14:30' };
const a = (h: number, m = 0, date = '2026-11-21') => ({ date, minutes: h * 60 + m });
const types = (h: number, m = 0, date?: string) => rappelsDus(C, a(h, m, date)).map((n) => n.type);

test('1 h avant : « retrait dans 1 h », pas avant', () => {
  assert.deepEqual(types(13, 29), []);
  assert.deepEqual(types(13, 30), ['retrait_dans_1h']);
  assert.deepEqual(types(14, 29), ['retrait_dans_1h']);
});

test('à l’heure : « retrait maintenant »', () => {
  assert.deepEqual(types(14, 30), ['retrait_maintenant']);
  assert.deepEqual(types(15, 0), ['retrait_maintenant']);
});

test('2 h après et toujours là : urgent, rouge', () => {
  assert.deepEqual(types(15, 30), []);
  assert.deepEqual(types(16, 29), []);
  const n = rappelsDus(C, a(16, 30));
  assert.deepEqual(n.map((x) => x.type), ['retrait_retard_2h']);
  assert.equal(n[0].urgente, true);
  assert.match(n[0].corps, /2 h de retard/);
});

test('un rappel manqué n’est plus envoyé une fois périmé', () => {
  assert.deepEqual(types(17, 45), []);
  assert.deepEqual(types(23, 0), []);
});

test('sans heure de retrait : aucun rappel', () => {
  assert.deepEqual(rappelsDus({ ...C, retraitHeure: null }, a(14, 30)), []);
});

test('à travers minuit : retrait à 23h30, 2 h plus tard à 1h30', () => {
  const c = { ...C, retraitLe: '2026-11-20', retraitHeure: '23:30' };
  assert.equal(minutesDepuisRetrait(c.retraitLe, c.retraitHeure, a(1, 30)), 120);
  assert.deepEqual(rappelsDus(c, a(1, 30)).map((n) => n.type), ['retrait_retard_2h']);
});

test('clés stables et distinctes : un rappel ne part qu’une fois, un autre horaire en refait un', () => {
  const k1 = rappelsDus(C, a(14, 30))[0].cle;
  assert.equal(k1, rappelsDus(C, a(14, 45))[0].cle);
  assert.notEqual(k1, rappelsDus({ ...C, retraitHeure: '16:00' }, a(16, 0))[0].cle);
});

test('aucun nom de client dans les textes', () => {
  const textes = [
    ...rappelsDus(C, a(16, 30)),
    notifCommandeCreee(C),
    notifCommandeModifiee(C, 3),
    notifInventaireTermine('2026-11-21'),
  ].map((n) => n.titre + n.corps);
  for (const t of textes) assert.doesNotMatch(t, /client\s+[A-Z]/);
});

test('événements du manager : textes en français, une modification = une clé', () => {
  assert.match(notifCommandeCreee(C).corps, /2026-0247.*21\/11 à 14h30/);
  assert.notEqual(notifCommandeModifiee(C, 1).cle, notifCommandeModifiee(C, 2).cle);
  assert.equal(notifInventaireTermine('2026-11-21').cle, 'inventaire:2026-11-21');
});

test('la salle sonne pour l’échéance et le retard, pas pour les événements du manager', () => {
  assert.equal(sonneEnSalle({ type: 'retrait_dans_1h' }), true);
  assert.equal(sonneEnSalle({ type: 'retrait_maintenant' }), true);
  assert.equal(sonneEnSalle({ type: 'retrait_retard_2h' }), true);
  assert.equal(sonneEnSalle({ type: 'commande_creee' }), false);
});

test('dates : format strict', () => {
  assert.equal(dateIsoValide('2026-11-21'), true);
  assert.equal(dateIsoValide('21/11/2026'), false);
  assert.equal(dateIsoValide(null), false);
});

test('notification de test : clé unique à chaque envoi, texte en français, rien de personnel', () => {
  const a = notifTest(1);
  assert.notEqual(a.cle, notifTest(2).cle);
  assert.equal(a.type, 'test');
  assert.match(a.corps, /cet appareil/);
  assert.equal(a.urgente, false);
});
