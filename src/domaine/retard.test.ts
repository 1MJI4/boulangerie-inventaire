// node --test src/domaine/retard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesDeLHeure, niveauRetard } from './retard.ts';

const J = '2026-10-29';
const a = (h: number, m = 0) => ({ date: J, minutes: h * 60 + m });

test('avant l’heure de retrait : pas en retard ; dès l’heure passée : en retard (orange)', () => {
  assert.equal(niveauRetard(J, '14:30', a(14, 29)), null);
  assert.equal(niveauRetard(J, '14:30', a(14, 30)), 'retard');
  assert.equal(niveauRetard(J, '14h30', a(18, 59)), 'retard');
});

test('à 19h, prévue avant 19h et pas retirée : rouge', () => {
  assert.equal(niveauRetard(J, '14:30', a(19)), 'retard-rouge');
  assert.equal(niveauRetard(J, '18:45', a(19, 10)), 'retard-rouge');
});

test('prévue à 19h ou après : orange une fois l’heure passée, jamais rouge le jour même', () => {
  assert.equal(niveauRetard(J, '19:00', a(19)), 'retard');
  assert.equal(niveauRetard(J, '19:30', a(19, 15)), null);
  assert.equal(niveauRetard(J, '19:30', a(19, 45)), 'retard');
});

test('jour précédent : rouge ; jour suivant : pas en retard', () => {
  assert.equal(niveauRetard('2026-10-28', '19:30', a(6)), 'retard-rouge');
  assert.equal(niveauRetard('2026-10-30T00:00:00.000Z', '06:00', a(23)), null);
});

test('sans heure : rouge à 19h le jour même (question 94)', () => {
  assert.equal(niveauRetard(J, null, a(18, 59)), null);
  assert.equal(niveauRetard(J, '', a(19)), 'retard-rouge');
});

test('heures lues : « 14:30 », « 14h30 », « 9h », illisible', () => {
  assert.equal(minutesDeLHeure('14:30'), 870);
  assert.equal(minutesDeLHeure('14h30'), 870);
  assert.equal(minutesDeLHeure('9h'), 540);
  assert.equal(minutesDeLHeure('midi'), null);
  assert.equal(minutesDeLHeure('25:00'), null);
});
