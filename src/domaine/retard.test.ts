// node --test src/domaine/retard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesDeLHeure, niveauRetard } from './retard.ts';

const J = '2026-10-29';
const a = (h: number, m = 0) => ({ date: J, minutes: h * 60 + m });

test('avant l’heure de retrait : pas en retard ; dès l’heure passée : en retard (orange)', () => {
  assert.equal(niveauRetard(J, '14:30', a(14, 29)), null);
  assert.equal(niveauRetard(J, '14:30', a(14, 30)), 'retard');
  assert.equal(niveauRetard(J, '14h30', a(16, 29)), 'retard');
});

test('à 2 h de retard : urgent, et plus « en retard »', () => {
  assert.equal(niveauRetard(J, '14:30', a(16, 30)), 'urgent');
  assert.equal(niveauRetard(J, '08:00', a(19)), 'urgent');
});

test('plus de passage au rouge à 19h : une commande de 18h30 est seulement en retard à 19h', () => {
  assert.equal(niveauRetard(J, '18:30', a(19)), 'retard');
});

test('le retard se compte à travers minuit', () => {
  assert.equal(niveauRetard('2026-10-28', '23:30', a(0, 10)), 'retard');
  assert.equal(niveauRetard('2026-10-28', '23:30', a(1, 30)), 'urgent');
  assert.equal(niveauRetard('2026-10-28', '19:30', a(6)), 'urgent');
});

test('jour suivant : pas en retard', () => {
  assert.equal(niveauRetard('2026-10-30T00:00:00.000Z', '06:00', a(23)), null);
});

test('sans heure : urgent à 19h le jour même (question 94), dès le lendemain', () => {
  assert.equal(niveauRetard(J, null, a(18, 59)), null);
  assert.equal(niveauRetard(J, '', a(19)), 'urgent');
  assert.equal(niveauRetard('2026-10-28', null, a(6)), 'urgent');
});

test('heures lues : « 14:30 », « 14h30 », « 9h », illisible', () => {
  assert.equal(minutesDeLHeure('14:30'), 870);
  assert.equal(minutesDeLHeure('14h30'), 870);
  assert.equal(minutesDeLHeure('9h'), 540);
  assert.equal(minutesDeLHeure('midi'), null);
  assert.equal(minutesDeLHeure('25:00'), null);
});
