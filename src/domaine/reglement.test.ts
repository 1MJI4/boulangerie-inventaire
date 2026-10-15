// node --test src/domaine/reglement.test.ts
// LOI 11 — règlement intérieur. Dates : jeudi 15/10/2026, mardi fermé.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { JourFerme } from './calendrier.ts';
import { REGLEMENT_COMMANDE } from './constantes.ts';
import type { HorairesRetraitPatisserie } from './constantes.ts';
import {
  controlerCommandeInhabituelle,
  estPatisserie,
  formaterHeure,
  heureChamp,
  lireHeure,
  validerHeureRetrait,
  validerLendemain,
  validerRemise,
} from './reglement.ts';

const FERMES: JourFerme[] = [{ id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' }];
const GERANT = { par: ' Karim ', le: '2026-10-15T10:00:00Z' };
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

test('R53 retrait le lendemain → ERR_COMMANDE_LENDEMAIN, surlendemain proposé', () => {
  const r = validerLendemain('2026-10-16', '2026-10-15', FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_COMMANDE_LENDEMAIN');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.champ, 'dateRetrait');
    assert.equal(r.valeurProposee, '2026-10-17');
    assert.match(r.message, /vendredi 16 octobre/);
  }
});

test('R53 retrait le jour même → refusé aussi ; surlendemain → accepté', () => {
  const r = validerLendemain('2026-10-15', '2026-10-15', FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_COMMANDE_LENDEMAIN');
  const ok = validerLendemain('2026-10-17', '2026-10-15', FERMES);
  assert.ok(ok.ok);
  assert.equal(ok.signalements.length, 0);
});

test('R53 vendredi soir pour samedi → refusé, dimanche proposé', () => {
  const r = validerLendemain('2026-10-17', '2026-10-16', FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.valeurProposee, '2026-10-18');
});

test('R53 lendemain fermé : prise lundi, mardi fermé → mercredi est « le lendemain »', () => {
  const r = validerLendemain('2026-10-21', '2026-10-19', FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_COMMANDE_LENDEMAIN');
    assert.equal(r.valeurProposee, '2026-10-22');
  }
  const mardi = validerLendemain('2026-10-20', '2026-10-19', FERMES);
  assert.equal(mardi.ok, false);
  if (!mardi.ok) assert.equal(mardi.code, 'ERR_JOUR_FERME', 'le jour fermé passe avant');
  assert.ok(validerLendemain('2026-10-22', '2026-10-19', FERMES).ok);
});

test('R53 accord du responsable → accepté, AVERT_COMMANDE_LENDEMAIN_AUTORISEE tracé', () => {
  const r = validerLendemain('2026-10-16', '2026-10-15', FERMES, GERANT);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'AVERT_COMMANDE_LENDEMAIN_AUTORISEE');
  assert.equal(r.signalements[0]?.niveau, 'avertissement');
  assert.match(r.signalements[0]?.message ?? '', /Karim/);
  const incomplet = validerLendemain('2026-10-16', '2026-10-15', FERMES, { par: '  ', le: GERANT.le });
  assert.equal(incomplet.ok, false, 'accord sans nom = pas d’accord');
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
    assert.match(r.message, /week-end/);
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
    assert.match(r.message, /9h00 en semaine/);
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

test('R54 jour férié ouvert = horaire du week-end (HYPOTHÈSE n°52)', () => {
  // Mercredi 11/11/2026, férié rouvert par une ouverture exceptionnelle.
  const feries: JourFerme[] = [
    ...FERMES,
    { id: 2, nature: 'ferie', dateDebut: '2026-11-11', libelle: 'Armistice' },
    { id: 3, nature: 'ouverture_exceptionnelle', dateDebut: '2026-11-11', libelle: 'Ouvert' },
  ];
  const r = validerHeureRetrait('2026-11-11', '11:00', PATISSERIE, HORAIRES, feries);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.valeurProposee, '12:00');
  // Même résultat par la liste `feriesOuverts` des horaires.
  const parListe = validerHeureRetrait('2026-11-11', '11:00', PATISSERIE, { ...HORAIRES, feriesOuverts: ['2026-11-11'] }, FERMES);
  assert.equal(parListe.ok, false);
  assert.ok(validerHeureRetrait('2026-11-11', '11:00', PATISSERIE, HORAIRES, FERMES).ok, 'sans férié : semaine');
});

test('R54 les horaires et le week-end sont des données', () => {
  const autres: HorairesRetraitPatisserie = { familles: ['patisserie', 'viennoiserie'], semaine: '10:30', weekEnd: '08:00', joursWeekEndIso: [7] };
  assert.equal(validerHeureRetrait('2026-10-16', '10:00', PATISSERIE, autres).ok, false);
  assert.ok(validerHeureRetrait('2026-10-17', '10:30', PATISSERIE, autres).ok, 'samedi = semaine ici');
  assert.ok(validerHeureRetrait('2026-10-18', '08:00', PATISSERIE, autres).ok);
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
