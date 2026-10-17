// node --test src/domaine/reglement.test.ts
// LOI 11 — règlement intérieur. Dates : jeudi 15/10/2026, mardi fermé.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { JourFerme } from './calendrier.ts';
import { REGLEMENT_COMMANDE } from './constantes.ts';
import type { HorairesRetraitPatisserie } from './constantes.ts';
import {
  convertirHorairesAncienneForme,
  controlerCommandeInhabituelle,
  heureMinRetrait,
  nomJourIso,
  estPatisserie,
  formaterHeure,
  heureChamp,
  lireHeure,
  validerHeureRetrait,
  validerLendemain,
  validerRemise,
} from './reglement.ts';

const FERMES: JourFerme[] = [{ id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' }];
const HORAIRES = REGLEMENT_COMMANDE.horairesRetraitPatisserie;
const PATISSERIE = [{ estPatisserie: true }];
const SALE = [{ estPatisserie: false }];

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

test('R53 jour férié en plus du mardi : prise lundi 9/11, mar fermé, mer 11/11 férié → « pour jeudi »', () => {
  const fermes: JourFerme[] = [...FERMES, { id: 2, nature: 'ferie', dateDebut: '2026-11-11', libelle: 'Armistice' }];
  const r = validerLendemain('2026-11-12', '2026-11-09', fermes);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'INFO_COMMANDE_LENDEMAIN');
  assert.match(r.signalements[0]?.message ?? '', /^Commande pour jeudi, le prochain jour d’ouverture/);
});

test('R53 jour même : pas « le lendemain » (le délai le refuse) ; surlendemain → aucune information', () => {
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

// ------------------------------------------------------------------ R54 heure de retrait

test('R54 samedi 11:59 → ERR_HEURE_RETRAIT_TROP_TOT (week-end), 12:00 proposé ; 12:00 accepté', () => {
  const r = validerHeureRetrait('2026-10-17', '11:59', PATISSERIE, HORAIRES, FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_HEURE_RETRAIT_TROP_TOT');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.champ, 'heureRetrait');
    assert.equal(r.valeurProposee, '12:00');
    assert.match(r.message, /12h00/);
    assert.match(r.message, /ce samedi/);
  }
  const ok = validerHeureRetrait('2026-10-17', '12:00', PATISSERIE, HORAIRES, FERMES);
  assert.ok(ok.ok);
  assert.equal(ok.donnees, '12:00');
  assert.equal(validerHeureRetrait('2026-10-18', '11:00', PATISSERIE, HORAIRES, FERMES).ok, false, 'dimanche');
});

test('R54 semaine : 08:59 refusé (9:00 proposé), 09:00 accepté, minuit refusé', () => {
  const r = validerHeureRetrait('2026-10-16', '08:59', PATISSERIE, HORAIRES, FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.valeurProposee, '09:00');
    assert.match(r.message, /9h00 ce vendredi/);
  }
  assert.ok(validerHeureRetrait('2026-10-16', '9:00', PATISSERIE, HORAIRES, FERMES).ok);
  const minuit = validerHeureRetrait('2026-10-16', '00:00', PATISSERIE, HORAIRES, FERMES);
  assert.equal(minuit.ok, false);
  if (!minuit.ok) assert.equal(minuit.code, 'ERR_HEURE_RETRAIT_TROP_TOT');
});

test('R54 sans pâtisserie : aucune heure minimale ; heure facultative', () => {
  const r = validerHeureRetrait('2026-10-17', '07:00', SALE, HORAIRES, FERMES);
  assert.ok(r.ok);
  const vide = validerHeureRetrait('2026-10-17', '', SALE, HORAIRES, FERMES);
  assert.ok(vide.ok);
  assert.equal(vide.donnees, null);
});

test('R54 pâtisserie sans heure → ERR_CHAMP_OBLIGATOIRE ; heure illisible → ERR_SAISIE_INVALIDE', () => {
  const vide = validerHeureRetrait('2026-10-17', null, PATISSERIE, HORAIRES, FERMES);
  assert.equal(vide.ok, false);
  if (!vide.ok) assert.equal(vide.code, 'ERR_CHAMP_OBLIGATOIRE');
  for (const h of ['24:00', 'midi', '12:5']) {
    const r = validerHeureRetrait('2026-10-17', h, SALE, HORAIRES, FERMES);
    assert.equal(r.ok, false, h);
    if (!r.ok) assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
  }
});

test('R54 jour férié ouvert = horaire du dimanche (HYPOTHÈSE n°52)', () => {
  // Mercredi 11/11/2026, férié rouvert par une ouverture exceptionnelle.
  const feries: JourFerme[] = [
    ...FERMES,
    { id: 2, nature: 'ferie', dateDebut: '2026-11-11', libelle: 'Armistice' },
    { id: 3, nature: 'ouverture_exceptionnelle', dateDebut: '2026-11-11', libelle: 'Ouvert' },
  ];
  assert.equal(heureMinRetrait('2026-11-11', REGLEMENT_COMMANDE, feries), HORAIRES.parJour['7']);
  const r = validerHeureRetrait('2026-11-11', '11:00', PATISSERIE, HORAIRES, feries);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.valeurProposee, '12:00');
  assert.ok(validerHeureRetrait('2026-11-11', '11:00', PATISSERIE, HORAIRES, FERMES).ok, 'sans férié : mercredi');
  // Une date exceptionnelle l'emporte sur le férié.
  const exc = { ...HORAIRES, exceptions: [{ date: '2026-11-11', heure: '10:00' }] };
  assert.ok(validerHeureRetrait('2026-11-11', '10:00', PATISSERIE, exc, feries).ok);
});

test('heureMinRetrait : parJour par défaut — 09:00 du lundi au vendredi, 12:00 samedi et dimanche', () => {
  // Lundi 12/10/2026 … dimanche 18/10/2026.
  const attendu = ['09:00', '09:00', '09:00', '09:00', '09:00', '12:00', '12:00'];
  attendu.forEach((h, i) => assert.equal(heureMinRetrait(`2026-10-${12 + i}`, REGLEMENT_COMMANDE), h, `jour ${i + 1}`));
  assert.equal(heureMinRetrait('2026-10-17', HORAIRES), '12:00', 'accepte aussi les horaires seuls');
});

test('R54 samedi 11:00 : refusé avec parJour 12:00, accepté avec une exception du jour à 11:00', () => {
  const refuse = validerHeureRetrait('2026-10-17', '11:00', PATISSERIE, HORAIRES, FERMES);
  assert.equal(refuse.ok, false);
  if (!refuse.ok) {
    assert.equal(refuse.code, 'ERR_HEURE_RETRAIT_TROP_TOT');
    assert.equal(refuse.valeurProposee, '12:00');
    assert.equal(
      refuse.message,
      'Les commandes pâtisserie sont disponibles à partir de 12h00 ce samedi. Choisissez une heure de retrait à partir de 12h00.',
    );
  }
  const exception: HorairesRetraitPatisserie = { ...HORAIRES, exceptions: [{ date: '2026-10-17', heure: '11:00' }] };
  assert.equal(heureMinRetrait('2026-10-17', { horairesRetraitPatisserie: exception }), '11:00');
  assert.ok(validerHeureRetrait('2026-10-17', '11:00', PATISSERIE, exception, FERMES).ok);
  assert.equal(validerHeureRetrait('2026-10-17', '10:59', PATISSERIE, exception, FERMES).ok, false);
  // L'exception ne vaut que pour SA date : le samedi suivant reste à 12:00.
  assert.equal(validerHeureRetrait('2026-10-24', '11:00', PATISSERIE, exception, FERMES).ok, false);
  // Date en double : la plus tardive (le plus sûr).
  const doubles = { ...HORAIRES, exceptions: [{ date: '2026-10-17', heure: '11:00' }, { date: '2026-10-17', heure: '11:30' }] };
  assert.equal(heureMinRetrait('2026-10-17', doubles), '11:30');
});

test('R54 parJour modifié par le gérant : les horaires sont des données', () => {
  const autres: HorairesRetraitPatisserie = {
    familles: ['patisserie', 'viennoiserie'],
    parJour: { '1': '09:00', '2': '09:00', '3': '09:00', '4': '09:00', '5': '10:30', '6': '10:30', '7': '08:00' },
    exceptions: [],
  };
  assert.equal(validerHeureRetrait('2026-10-16', '10:00', PATISSERIE, autres).ok, false, 'vendredi 10:30');
  assert.ok(validerHeureRetrait('2026-10-17', '10:30', PATISSERIE, autres).ok, 'samedi 10:30');
  assert.ok(validerHeureRetrait('2026-10-18', '08:00', PATISSERIE, autres).ok, 'dimanche 08:00');
  assert.throws(() => heureMinRetrait('2026-10-18', { ...autres, parJour: { ...autres.parJour, '7': 'midi' } }), RangeError);
});

test('compatibilité : ancienne forme semaine / week-end convertie jour par jour', () => {
  const ancienne = {
    familles: ['patisserie'],
    semaine: '10:30',
    weekEnd: '08:00',
    joursWeekEndIso: [7],
    feriesOuverts: ['2026-11-11'],
  };
  const h = convertirHorairesAncienneForme(ancienne);
  assert.deepEqual(h.parJour, { '1': '10:30', '2': '10:30', '3': '10:30', '4': '10:30', '5': '10:30', '6': '10:30', '7': '08:00' });
  assert.deepEqual(h.exceptions, [{ date: '2026-11-11', heure: '08:00' }]);
  assert.deepEqual(h.familles, ['patisserie']);
  // validerHeureRetrait accepte encore l'ancienne forme (conversion automatique).
  assert.equal(validerHeureRetrait('2026-10-16', '10:00', PATISSERIE, ancienne).ok, false);
  assert.ok(validerHeureRetrait('2026-10-17', '10:30', PATISSERIE, ancienne).ok, 'samedi = semaine ici');
  assert.ok(validerHeureRetrait('2026-10-18', '08:00', PATISSERIE, ancienne).ok);
  // Valeurs par défaut équivalentes à l'ancien règlement (9h semaine, 12h week-end).
  assert.deepEqual(
    convertirHorairesAncienneForme({ familles: HORAIRES.familles, semaine: '09:00', weekEnd: '12:00', joursWeekEndIso: [6, 7] }).parJour,
    HORAIRES.parJour,
  );
});

test('estPatisserie : donnée `famille` du catalogue ; viennoiserie incluse (HYPOTHÈSE) ; inconnue ou ligne libre = oui', () => {
  const familles = HORAIRES.familles;
  assert.equal(estPatisserie({ famille: 'patisserie' }, familles), true);
  assert.equal(estPatisserie({ famille: 'viennoiserie' }, familles), true, 'règle de doute');
  assert.equal(estPatisserie({ famille: 'boulangerie' }, familles), false);
  assert.equal(estPatisserie({ famille: 'sale' }, familles), false);
  assert.equal(estPatisserie({ famille: 'boisson' }, familles), false);
  assert.equal(estPatisserie({ famille: '' }, familles), true, 'famille inconnue : le plus sûr');
  assert.equal(estPatisserie(null, familles), true, 'ligne libre');
  assert.equal(estPatisserie({ famille: 'sale' }, ['patisserie', 'sale']), true, 'liste = donnée (question n°50)');
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
