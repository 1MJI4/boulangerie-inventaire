// node --test src/domaine/reglement.test.ts
// LOI 11 — règlement intérieur. Dates : jeudi 15/10/2026, mardi fermé.
// Décisions du propriétaire du 18/10/2026 : jour même accepté (information),
// heure de retrait facultative, dans les heures d'ouverture du magasin.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { JourFerme } from './calendrier.ts';
import { REGLEMENT_COMMANDE } from './constantes.ts';
import type { HorairesOuverture } from './constantes.ts';
import {
  controlerCommandeInhabituelle,
  estPlageOuverture,
  formaterHeure,
  heureChamp,
  horairesOuvertureDuJour,
  lireHeure,
  nomJourIso,
  validerHeureRetrait,
  validerJourMeme,
  validerLendemain,
  validerRemise,
} from './reglement.ts';

const FERMES: JourFerme[] = [{ id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' }];
const HORAIRES = REGLEMENT_COMMANDE.horairesOuverture;

// ------------------------------------------------------------------ heures

test('lireHeure : HH:MM, H:MM, 9h00 ; refuse 24:00, 12:60, texte', () => {
  assert.equal(lireHeure('09:00'), 540);
  assert.equal(lireHeure('9:00'), 540);
  assert.equal(lireHeure('9h00'), 540);
  assert.equal(lireHeure('00:00'), 0);
  assert.equal(lireHeure('23:59'), 1439);
  for (const x of ['24:00', '12:60', 'midi', '', '9', null, 900]) assert.equal(lireHeure(x), null, String(x));
  assert.equal(formaterHeure(540), '9h00');
  assert.equal(heureChamp(540), '09:00');
});

// ------------------------------------------------------------------ R53 lendemain

test('R53 retrait le lendemain → ACCEPTÉ avec INFO_COMMANDE_LENDEMAIN (décision du 15/10/2026)', () => {
  const r = validerLendemain('2026-10-16', '2026-10-15', FERMES);
  assert.ok(r.ok);
  assert.equal(r.donnees, '2026-10-16');
  assert.equal(r.signalements.length, 1);
  const info = r.signalements[0];
  assert.equal(info?.code, 'INFO_COMMANDE_LENDEMAIN');
  assert.equal(info?.niveau, 'information');
  assert.equal(info?.champ, 'dateRetrait');
  assert.equal(info?.message, 'Commande pour demain : prévenez l’atelier.');
  assert.doesNotMatch(info?.message ?? '', /code|gérant|accord/i, 'aucun code gérant, aucun accord');
});

test('R53 fermeture exceptionnelle en plus du mardi : prise lundi 9/11, mar fermé, mer 11/11 fermé → « pour jeudi »', () => {
  // Mécanisme seulement : aucune fermeture exceptionnelle n'est prévue (fériés ouverts, 18/10/2026).
  const fermes: JourFerme[] = [...FERMES, { id: 2, nature: 'exceptionnel', dateDebut: '2026-11-11', libelle: 'Travaux' }];
  const r = validerLendemain('2026-11-12', '2026-11-09', fermes);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'INFO_COMMANDE_LENDEMAIN');
  assert.match(r.signalements[0]?.message ?? '', /^Commande pour jeudi, le prochain jour d’ouverture/);
});

test('R53 jour même : pas « le lendemain » (il a sa propre information) ; surlendemain → aucune information', () => {
  const r = validerLendemain('2026-10-15', '2026-10-15', FERMES);
  assert.ok(r.ok);
  assert.equal(r.signalements.length, 0);
  const ok = validerLendemain('2026-10-17', '2026-10-15', FERMES);
  assert.ok(ok.ok);
  assert.equal(ok.signalements.length, 0);
});

test('R53 vendredi pour samedi → accepté, information', () => {
  const r = validerLendemain('2026-10-17', '2026-10-16', FERMES);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'INFO_COMMANDE_LENDEMAIN');
  assert.equal(r.signalements[0]?.message, 'Commande pour demain : prévenez l’atelier.', 'vrai lendemain calendaire');
});

test('R53 lendemain fermé : prise lundi, mardi fermé → mercredi est « le lendemain » (information)', () => {
  const r = validerLendemain('2026-10-21', '2026-10-19', FERMES);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'INFO_COMMANDE_LENDEMAIN');
  // Réserve qa-metier m1 : ce n'est PAS « demain » (mardi entre les deux) ; le jour réel est nommé.
  assert.equal(
    r.signalements[0]?.message,
    'Commande pour mercredi, le prochain jour d’ouverture : prévenez l’atelier dès aujourd’hui.',
  );
  assert.doesNotMatch(r.signalements[0]?.message ?? '', /demain/);
  const mardi = validerLendemain('2026-10-20', '2026-10-19', FERMES);
  assert.equal(mardi.ok, false);
  if (!mardi.ok) assert.equal(mardi.code, 'ERR_JOUR_FERME', 'le jour fermé reste refusé');
  const jeudi = validerLendemain('2026-10-22', '2026-10-19', FERMES);
  assert.ok(jeudi.ok);
  assert.equal(jeudi.signalements.length, 0);
});

test('R53 date passée ou illisible → refus du calendrier', () => {
  const r = validerLendemain('2026-10-14', '2026-10-15', FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_DATE_PASSEE');
  const x = validerLendemain('2026-02-30', '2026-10-15', FERMES);
  if (!x.ok) assert.equal(x.code, 'ERR_SAISIE_INVALIDE');
  assert.equal(x.ok, false);
});

// ------------------------------------------------------------------ R53b jour même

test('R53b retrait le jour même → ACCEPTÉ avec INFO_COMMANDE_JOUR_MEME (décision du 18/10/2026)', () => {
  const r = validerJourMeme('2026-10-15', '2026-10-15', FERMES);
  assert.ok(r.ok);
  assert.equal(r.donnees, '2026-10-15');
  assert.equal(r.signalements.length, 1);
  const info = r.signalements[0];
  assert.equal(info?.code, 'INFO_COMMANDE_JOUR_MEME');
  assert.equal(info?.niveau, 'information');
  assert.equal(info?.champ, 'dateRetrait');
  assert.equal(info?.message, 'Commande pour aujourd’hui : prévenez l’atelier tout de suite.');
  // Le lendemain n'est pas « le jour même » (il a sa propre information).
  const demain = validerJourMeme('2026-10-16', '2026-10-15', FERMES);
  assert.ok(demain.ok);
  assert.equal(demain.signalements.length, 0);
});

test('R53b jour même : date passée, mardi, date illisible restent refusés', () => {
  const passee = validerJourMeme('2026-10-14', '2026-10-15', FERMES);
  assert.equal(passee.ok, false);
  if (!passee.ok) assert.equal(passee.code, 'ERR_DATE_PASSEE');
  // Saisie un mardi (hors ligne) pour le mardi même : refusée, quel que soit le jour d'arrivée.
  const mardi = validerJourMeme('2026-10-20', '2026-10-20', FERMES);
  assert.equal(mardi.ok, false);
  if (!mardi.ok) {
    assert.equal(mardi.code, 'ERR_JOUR_FERME');
    assert.equal(mardi.valeurProposee, '2026-10-21', 'mercredi proposé');
  }
  const x = validerJourMeme('2026-02-29', '2026-02-29', FERMES);
  assert.equal(x.ok, false, '29 février 2026 n’existe pas');
  if (!x.ok) assert.equal(x.code, 'ERR_SAISIE_INVALIDE');
  // 29 février 2028 : existe, mais c'est un mardi → fermé, mercredi 1er mars proposé.
  const bissextile = validerJourMeme('2028-02-29', '2028-02-29', FERMES);
  assert.equal(bissextile.ok, false);
  if (!bissextile.ok) {
    assert.equal(bissextile.code, 'ERR_JOUR_FERME');
    assert.equal(bissextile.valeurProposee, '2028-03-01');
  }
});

// ------------------------------------------------------------------ R54 heures d'ouverture

test('horairesOuvertureDuJour : 06:00 → 20:00 par défaut, chaque jour', () => {
  // Lundi 12/10/2026 … dimanche 18/10/2026.
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(horairesOuvertureDuJour(`2026-10-${12 + i}`, HORAIRES), { ouverture: '06:00', fermeture: '20:00' });
  }
});

test('horairesOuvertureDuJour : date exceptionnelle prioritaire, valable pour SA date seulement', () => {
  const h: HorairesOuverture = { ...HORAIRES, exceptions: [{ date: '2026-12-24', ouverture: '06:00', fermeture: '16:00' }] };
  assert.deepEqual(horairesOuvertureDuJour('2026-12-24', h), { ouverture: '06:00', fermeture: '16:00' });
  assert.deepEqual(horairesOuvertureDuJour('2026-12-31', h), { ouverture: '06:00', fermeture: '20:00' });
  // Même date saisie deux fois : la plage commune (le plus sûr).
  const doubles: HorairesOuverture = {
    ...HORAIRES,
    exceptions: [
      { date: '2026-12-24', ouverture: '07:00', fermeture: '18:00' },
      { date: '2026-12-24', ouverture: '06:00', fermeture: '16:00' },
    ],
  };
  assert.deepEqual(horairesOuvertureDuJour('2026-12-24', doubles), { ouverture: '07:00', fermeture: '16:00' });
});

test('horairesOuvertureDuJour : réglage cassé ou date illisible → RangeError (bug, jamais une heure inventée)', () => {
  const casse: HorairesOuverture = { ...HORAIRES, parJour: { ...HORAIRES.parJour, '6': { ouverture: 'midi', fermeture: '20:00' } } };
  assert.throws(() => horairesOuvertureDuJour('2026-10-17', casse), RangeError);
  const inverse: HorairesOuverture = { ...HORAIRES, parJour: { ...HORAIRES.parJour, '6': { ouverture: '20:00', fermeture: '06:00' } } };
  assert.throws(() => horairesOuvertureDuJour('2026-10-17', inverse), RangeError);
  assert.throws(() => horairesOuvertureDuJour('2026-02-30', HORAIRES), RangeError);
});

test('estPlageOuverture : deux heures lisibles, ouverture strictement avant fermeture', () => {
  assert.ok(estPlageOuverture({ ouverture: '06:00', fermeture: '20:00' }));
  assert.ok(!estPlageOuverture({ ouverture: '20:00', fermeture: '20:00' }));
  assert.ok(!estPlageOuverture({ ouverture: '21:00', fermeture: '20:00' }));
  assert.ok(!estPlageOuverture({ ouverture: '24:00', fermeture: '20:00' }));
  assert.ok(!estPlageOuverture(null));
  assert.ok(!estPlageOuverture('06:00-20:00'));
});

test('R54 samedi 05:59 → ERR_HEURE_HORS_OUVERTURE, 06:00 proposé, message du gérant', () => {
  const r = validerHeureRetrait('2026-10-17', '05:59', HORAIRES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_HEURE_HORS_OUVERTURE');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.champ, 'heureRetrait');
    assert.equal(r.valeurProposee, '06:00', 'trop tôt : l’ouverture');
    assert.equal(r.message, 'Le magasin est ouvert de 6h00 à 20h00 le samedi — choisissez une heure dans ces horaires.');
  }
});

test('R54 trop tard → fermeture proposée ; bornes incluses (06:00 et 20:00 acceptées)', () => {
  const r = validerHeureRetrait('2026-10-16', '20:01', HORAIRES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, '20:00', 'trop tard : la fermeture');
    assert.match(r.message, /le vendredi/);
  }
  assert.equal(validerHeureRetrait('2026-10-16', '06:00', HORAIRES).ok, true);
  const fermeture = validerHeureRetrait('2026-10-16', '20:00', HORAIRES);
  assert.ok(fermeture.ok);
  assert.equal(fermeture.donnees, '20:00');
  const minuit = validerHeureRetrait('2026-10-16', '00:00', HORAIRES);
  assert.equal(minuit.ok, false);
  if (!minuit.ok) assert.equal(minuit.valeurProposee, '06:00');
  const tard = validerHeureRetrait('2026-10-16', '23:59', HORAIRES);
  if (!tard.ok) assert.equal(tard.valeurProposee, '20:00');
  assert.equal(tard.ok, false);
});

test('R54 vaut pour TOUS les produits ; heure facultative (vide = acceptée) ; illisible → ERR_SAISIE_INVALIDE', () => {
  for (const vide of [null, undefined, '', '  ']) {
    const r = validerHeureRetrait('2026-10-17', vide, HORAIRES);
    assert.ok(r.ok, String(vide));
    assert.equal(r.donnees, null);
    assert.equal(r.signalements.length, 0);
  }
  assert.ok(validerHeureRetrait('2026-10-17', '07:00', HORAIRES).ok, 'plus de 12h00 le week-end (règle pâtisserie supprimée)');
  const lue = validerHeureRetrait('2026-10-17', '9h30', HORAIRES);
  assert.ok(lue.ok);
  assert.equal(lue.donnees, '09:30', 'heure normalisée « HH:MM »');
  for (const h of ['24:00', 'midi', '12:5']) {
    const r = validerHeureRetrait('2026-10-17', h, HORAIRES);
    assert.equal(r.ok, false, h);
    if (!r.ok) assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
  }
  const date = validerHeureRetrait('2026-02-30', '10:00', HORAIRES);
  assert.equal(date.ok, false);
  if (!date.ok) assert.equal(date.champ, 'dateRetrait');
});

test('R54 date exceptionnelle 24/12 06:00–16:00 : 16:30 refusé (16:00 proposé), message avec la date', () => {
  const h: HorairesOuverture = { ...HORAIRES, exceptions: [{ date: '2026-12-24', ouverture: '06:00', fermeture: '16:00' }] };
  const r = validerHeureRetrait('2026-12-24', '16:30', h);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, '16:00');
    assert.equal(r.message, 'Le magasin est ouvert de 6h00 à 16h00 le jeudi 24 décembre — choisissez une heure dans ces horaires.');
  }
  assert.ok(validerHeureRetrait('2026-12-24', '16:00', h).ok);
  assert.ok(validerHeureRetrait('2026-12-31', '19:00', h).ok, 'l’exception ne vaut que pour sa date');
});

test('R54 horaires modifiés par le gérant jour par jour : ce sont des données', () => {
  const h: HorairesOuverture = {
    parJour: { ...HORAIRES.parJour, '7': { ouverture: '07:30', fermeture: '13:00' } },
    exceptions: [],
  };
  assert.equal(validerHeureRetrait('2026-10-18', '07:00', h).ok, false, 'dimanche 07:30');
  assert.ok(validerHeureRetrait('2026-10-18', '12:45', h).ok);
  const tard = validerHeureRetrait('2026-10-18', '14:00', h);
  assert.equal(tard.ok, false);
  if (!tard.ok) assert.equal(tard.valeurProposee, '13:00');
  assert.ok(validerHeureRetrait('2026-10-17', '19:00', h).ok, 'samedi inchangé');
});

test('R54 changement d’heure (25/10/2026) : heure locale, plage inchangée', () => {
  assert.deepEqual(horairesOuvertureDuJour('2026-10-25', HORAIRES), { ouverture: '06:00', fermeture: '20:00' });
  assert.ok(validerHeureRetrait('2026-10-25', '06:00', HORAIRES).ok);
});

// ------------------------------------------------------------------ R55 inhabituelle

test('R55 demande inhabituelle ou ligne libre → un seul AVERT_COMMANDE_INHABITUELLE', () => {
  assert.equal(controlerCommandeInhabituelle({}).length, 0);
  const a = controlerCommandeInhabituelle({ demandeInhabituelle: true });
  assert.equal(a[0]?.code, 'AVERT_COMMANDE_INHABITUELLE');
  assert.equal(a[0]?.niveau, 'avertissement');
  assert.equal(controlerCommandeInhabituelle({ contientLigneLibre: true }).length, 1);
  assert.equal(controlerCommandeInhabituelle({ demandeInhabituelle: true, contientLigneLibre: true }).length, 1);
});

// ------------------------------------------------------------------ R58 remise

test('R58 tous les articles cochés → accepté', () => {
  assert.ok(validerRemise([{ id: 'a', remis: true }, { id: 'b', remis: true }]).ok);
});

test('R58 articles restants → ERR_DECOMPTE_INCOMPLET avec la liste restante', () => {
  const r = validerRemise([
    { id: 'a', remis: true },
    { id: 'b', remis: false },
    { id: 'c', remis: false },
  ]);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DECOMPTE_INCOMPLET');
    assert.deepEqual(r.valeurProposee, ['b', 'c']);
    assert.match(r.message, /2 articles/);
  }
  const vide = validerRemise([]);
  assert.equal(vide.ok, false, 'aucune liste = aucun décompte');
});

test('nomJourIso : libellés des jours pour l’écran des réglages', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(nomJourIso), ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']);
  assert.equal(nomJourIso('6'), 'samedi');
  assert.throws(() => nomJourIso(0), RangeError);
});
