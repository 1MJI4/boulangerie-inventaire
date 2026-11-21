// node --test src/domaine/brouillons.test.ts
//
// Brouillons de commande WhatsApp (propriétaire, 21/11/2026). Aucun vrai IBAN ici :
// valeurs de test, sans rapport avec la production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alerteExpirationDue,
  delaiPaiementMinutes,
  echeancePaiement,
  etatBrouillon,
  formaterCompteARebours,
  jourDuMessage,
  lienWhatsApp,
  messagePaiement,
  montantDuMessage,
  referencePaiement,
  secondesRestantes,
  type EntreeMessage,
} from './brouillons.ts';

const T0 = new Date('2026-11-21T18:00:00Z');

test('délai : 5 minutes le jour même, 1 heure les jours suivants', () => {
  assert.equal(delaiPaiementMinutes('2026-11-21', '2026-11-21'), 5);
  assert.equal(delaiPaiementMinutes('2026-11-22', '2026-11-21'), 60);
  assert.equal(delaiPaiementMinutes('2026-11-21T00:00:00.000Z', '2026-11-21'), 5);
});

test('état : en attente, puis expiré à l’échéance, jamais effacé', () => {
  const echeance = echeancePaiement(T0, 5);
  assert.equal(etatBrouillon({ statut: 'en_attente', echeanceLe: echeance }, new Date(T0.getTime() + 4 * 60_000 + 59_000)), 'en_attente');
  assert.equal(etatBrouillon({ statut: 'en_attente', echeanceLe: echeance }, new Date(T0.getTime() + 5 * 60_000)), 'expire');
  assert.equal(etatBrouillon({ statut: 'confirme', echeanceLe: echeance }, new Date(T0.getTime() + 999_000_000)), 'confirme');
  assert.equal(etatBrouillon({ statut: 'abandonne', echeanceLe: echeance }, T0), 'abandonne');
});

test('compte à rebours', () => {
  assert.equal(secondesRestantes(echeancePaiement(T0, 5), new Date(T0.getTime() + 60_000)), 240);
  assert.equal(secondesRestantes(echeancePaiement(T0, 5), new Date(T0.getTime() + 600_000)), 0);
  assert.equal(formaterCompteARebours(240), '04:00');
  assert.equal(formaterCompteARebours(3599), '59:59');
  assert.equal(formaterCompteARebours(3600), '1:00:00');
});

test('alerte « non payé » : 5 minutes après l’expiration, une seule fois', () => {
  const b = { statut: 'en_attente' as const, echeanceLe: echeancePaiement(T0, 5), expireNotifieLe: null };
  assert.equal(alerteExpirationDue(b, new Date(T0.getTime() + 9 * 60_000 + 59_000)), false);
  assert.equal(alerteExpirationDue(b, new Date(T0.getTime() + 10 * 60_000)), true);
  assert.equal(alerteExpirationDue({ ...b, expireNotifieLe: new Date() }, new Date(T0.getTime() + 20 * 60_000)), false);
  assert.equal(alerteExpirationDue({ ...b, statut: 'confirme' as never }, new Date(T0.getTime() + 20 * 60_000)), false);
});

test('référence : jour de création + numéro', () => {
  assert.equal(referencePaiement('2026-11-21', 727), '21/11-727');
});

const base: EntreeMessage = {
  langue: 'fr',
  lignes: [{ quantite: 15, libelle: 'Piccolo — blanc' }],
  retraitLe: '2026-11-21',
  retraitHeure: '14:00',
  totalCentimes: 900,
  reference: '21/11-727',
  delaiMinutes: 5,
  beneficiaire: 'BÉNÉFICIAIRE TEST',
  iban: 'BE00 0000 0000 0000',
};

test('message français : lignes, jour, heure, total, compte, communication, délai', () => {
  const m = messagePaiement(base);
  assert.match(m, /^Je vous envoie ce message pour confirmer votre commande de :/);
  assert.match(m, /\* 15 Piccolo — blanc/);
  assert.match(m, /Pour samedi 21\/11 à 14h00\./);
  assert.match(m, /règlement de 9,00\s€/);
  assert.match(m, /Bénéficiaire : BÉNÉFICIAIRE TEST/);
  assert.match(m, /IBAN : BE00 0000 0000 0000/);
  assert.match(m, /Communication :\nCommande 21\/11-727/);
  assert.match(m, /dans les 5 minutes\./);
});

test('message anglais : jour, heure 12 h, montant « €46.00 », délai d’une heure', () => {
  const m = messagePaiement({
    ...base,
    langue: 'en',
    lignes: [{ quantite: 6, libelle: 'Crème fraîche', basePrix: 'personne' }],
    retraitHeure: '16:00',
    totalCentimes: 4600,
    delaiMinutes: 60,
  });
  assert.match(m, /^I’m sending you this message to confirm the following order:/);
  assert.match(m, /\* Crème fraîche for 6 people/);
  assert.match(m, /For Saturday, 21 November, at 4:00 PM\./);
  assert.match(m, /payment of €46\.00 to the following bank account/);
  assert.match(m, /Payment reference: Order 21\/11-727/);
  assert.match(m, /within one hour\./);
});

test('sans heure : pas de « à … » ; au kilo : poids lisible', () => {
  const m = messagePaiement({ ...base, retraitHeure: null, lignes: [{ quantite: 1500, libelle: 'Sellou', unite: 'kg' }] });
  assert.match(m, /Pour samedi 21\/11\./);
  assert.match(m, /\* 1,500 kg Sellou/);
});

test('mise en forme du jour et du montant', () => {
  assert.equal(jourDuMessage('2026-11-22', 'fr'), 'dimanche 22/11');
  assert.equal(jourDuMessage('2026-11-22', 'en'), 'Sunday, 22 November');
  assert.equal(montantDuMessage(4600, 'en'), '€46.00');
  assert.match(montantDuMessage(910, 'fr'), /^9,10\s€$/);
});

test('lien WhatsApp : numéro belge normalisé, texte encodé, numéro inutilisable refusé', () => {
  assert.equal(lienWhatsApp('0472 25 05 78', 'Bonjour ça va'), 'https://wa.me/32472250578?text=Bonjour%20%C3%A7a%20va');
  assert.equal(lienWhatsApp('+32 472 25 05 78', 'x'), 'https://wa.me/32472250578?text=x');
  assert.equal(lienWhatsApp('0032472250578', 'x'), 'https://wa.me/32472250578?text=x');
  assert.equal(lienWhatsApp('12', 'x'), null);
  assert.equal(lienWhatsApp('', 'x'), null);
});
