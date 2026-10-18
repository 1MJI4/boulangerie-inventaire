// node --test src/domaine/calendrier.test.ts
// Le jour de fermeture n'existe ici que comme DONNÉE de test (forme de la table JourFerme).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ajouterJoursOuvres,
  dateProduction,
  estDateISO,
  estJourFerme,
  fermetureDuJour,
  jourSemaineIso,
  prochainJourOuvert,
  validerDateRetrait,
  validerDelai,
  veilleOuvree,
  type JourFerme,
} from './calendrier.ts';

// Données initiales de la base : fermeture hebdomadaire le mardi (ISO 2).
const MARDI: JourFerme = { id: 1, nature: 'hebdomadaire', jourSemaineIso: 2, libelle: 'mardi' };
const FERMES: JourFerme[] = [MARDI];

// Repères d'octobre 2026 : jeudi 15 (aujourd'hui), lundi 19, mardi 20, mercredi 21.
const LUNDI = '2026-10-19';
const MARDI_20 = '2026-10-20';
const MERCREDI = '2026-10-21';

test('jourSemaineIso : ISO, lundi = 1, dimanche = 7', () => {
  assert.equal(jourSemaineIso(LUNDI), 1);
  assert.equal(jourSemaineIso(MARDI_20), 2);
  assert.equal(jourSemaineIso('2026-10-25'), 7);
});

test('estJourFerme : le mardi est fermé, le mercredi ouvert', () => {
  assert.equal(estJourFerme(MARDI_20, FERMES), true);
  assert.equal(estJourFerme(MERCREDI, FERMES), false);
  assert.equal(estJourFerme(MARDI_20, []), false, 'la liste est une donnée : vide → rien de fermé');
});

test('validerDateRetrait : mardi → ERR_JOUR_FERME, format LOI 9, prochain jour ouvert proposé', () => {
  const r = validerDateRetrait(MARDI_20, FERMES, '2026-10-15');
  assert.deepEqual(r, {
    ok: false,
    niveau: 'bloquant',
    code: 'ERR_JOUR_FERME',
    message: 'Fermé le mardi — choisissez un autre jour de retrait.',
    champ: 'dateRetrait',
    valeurProposee: MERCREDI,
  });
});

test('validerDateRetrait : mercredi accepté', () => {
  const r = validerDateRetrait(MERCREDI, FERMES, '2026-10-15');
  assert.ok(r.ok);
  assert.equal(r.donnees, MERCREDI);
});

test('saisie hors ligne un lundi pour un mardi, synchronisée le mercredi → rejetée à l’arrivée', () => {
  // Côté serveur, `aujourdhui` = date de saisie sur la tablette (lundi).
  const r = validerDateRetrait(MARDI_20, FERMES, LUNDI);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_JOUR_FERME');
});

test('date passée → bloquant ERR_DATE_PASSEE avec le prochain jour ouvert', () => {
  const r = validerDateRetrait('2026-10-14', FERMES, '2026-10-15');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DATE_PASSEE');
    assert.equal(r.valeurProposee, '2026-10-15');
  }
  // Aujourd'hui un mardi : on propose le mercredi.
  const r2 = validerDateRetrait(LUNDI, FERMES, MARDI_20);
  if (!r2.ok) assert.equal(r2.valeurProposee, MERCREDI);
});

test('29 février : refusé en 2026, accepté en 2028 ; date illisible refusée', () => {
  assert.equal(estDateISO('2026-02-29'), false);
  assert.equal(estDateISO('2028-02-29'), true);
  const r = validerDateRetrait('2026-02-29', FERMES, '2026-01-01');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
  assert.equal(validerDateRetrait('demain', FERMES, '2026-01-01').ok, false);
  // Le 29/02/2028 tombe un mardi : date valide, mais jour fermé.
  const r2 = validerDateRetrait('2028-02-29', FERMES, '2028-01-01');
  assert.equal(r2.ok, false);
  if (!r2.ok) {
    assert.equal(r2.code, 'ERR_JOUR_FERME');
    assert.equal(r2.valeurProposee, '2028-03-01');
  }
  assert.equal(validerDateRetrait('2028-02-29', [], '2028-01-01').ok, true);
});

test('changement d’heure (dimanche 25/10/2026) : aucun décalage de jour', () => {
  assert.equal(ajouterJoursOuvres('2026-10-24', 1, FERMES), '2026-10-25');
  assert.equal(ajouterJoursOuvres('2026-10-25', 1, FERMES), '2026-10-26');
  assert.equal(ajouterJoursOuvres('2026-10-26', 1, FERMES), '2026-10-28', 'le mardi 27 est sauté');
  assert.equal(ajouterJoursOuvres('2027-03-27', 2, FERMES), '2027-03-29');
});

test('mardi férié : une seule fermeture, message du mardi', () => {
  const ferie: JourFerme = { id: 2, nature: 'ferie', dateDebut: '2026-12-29', libelle: 'Férié test' };
  const f = fermetureDuJour('2026-12-29', [MARDI, ferie]);
  assert.equal(f?.id, 1, 'même priorité que la base : id le plus ancien');
});

test('jour férié un autre jour : ERR_JOUR_FERME avec la date en clair', () => {
  const noel: JourFerme = { id: 3, nature: 'ferie', dateDebut: '2026-12-25', libelle: 'Noël' };
  const r = validerDateRetrait('2026-12-25', [MARDI, noel], '2026-10-15');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_JOUR_FERME');
    assert.equal(r.message, 'Fermé le 25 décembre — choisissez un autre jour de retrait.');
    assert.equal(r.valeurProposee, '2026-12-26');
  }
});

test('congés : ERR_PERIODE_CONGES, prioritaire sur les autres fermetures, sortie après la période', () => {
  const conges: JourFerme = {
    id: 9,
    nature: 'conges',
    dateDebut: '2027-07-12',
    dateFin: '2027-07-25',
    libelle: 'congés d’été',
  };
  const r = validerDateRetrait('2027-07-13', [MARDI, conges], '2027-06-01'); // un mardi pendant les congés
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_PERIODE_CONGES');
    assert.match(r.message, /congés d’été/);
    assert.equal(r.valeurProposee, '2027-07-26');
  }
});

test('ouverture exceptionnelle : prioritaire sur le mardi (même règle que la base)', () => {
  const ouverture: JourFerme = {
    id: 5,
    nature: 'ouverture_exceptionnelle',
    dateDebut: '2026-12-22',
    libelle: 'mardi avant Noël',
  };
  assert.equal(estJourFerme('2026-12-22', [MARDI, ouverture]), false);
  assert.equal(estJourFerme('2026-12-29', [MARDI, ouverture]), true);
});

test('ligne désactivée ignorée ; fermeture hebdomadaire bornée par sa période', () => {
  assert.equal(estJourFerme(MARDI_20, [{ ...MARDI, actif: false }]), false);
  const borne: JourFerme = { ...MARDI, dateDebut: '2026-11-01' };
  assert.equal(estJourFerme(MARDI_20, [borne]), false);
  assert.equal(estJourFerme('2026-11-03', [borne]), true);
});

test('tout fermé (donnée incohérente) : refus sans date inventée', () => {
  const tout: JourFerme[] = [1, 2, 3, 4, 5, 6, 7].map((j) => ({
    id: j,
    nature: 'hebdomadaire',
    jourSemaineIso: j,
    libelle: `jour ${j}`,
  }));
  assert.equal(prochainJourOuvert(MERCREDI, tout), null);
  const r = validerDateRetrait(MERCREDI, tout, '2026-10-15');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.valeurProposee, undefined);
  assert.equal(ajouterJoursOuvres(MERCREDI, 1, tout), null);
});

test('veilleOuvree : retrait le mercredi → production le lundi (mardi fermé)', () => {
  assert.equal(veilleOuvree(MERCREDI, FERMES), LUNDI);
  assert.equal(veilleOuvree('2026-10-22', FERMES), MERCREDI);
});

test('dateProduction : veille ouverte, jamais avant le jour de la prise (jour même autorisé, 18/10/2026)', () => {
  // Prise lundi pour mercredi : production lundi (mardi fermé).
  assert.equal(dateProduction(MERCREDI, LUNDI, FERMES), LUNDI);
  // Prise mercredi pour mercredi (jour même) : production mercredi, pas lundi.
  assert.equal(dateProduction(MERCREDI, MERCREDI, FERMES), MERCREDI);
  // Prise jeudi 15 pour vendredi 16 : production jeudi.
  assert.equal(dateProduction('2026-10-16', '2026-10-15', FERMES), '2026-10-15');
  // Prise lointaine : la veille ouverte.
  assert.equal(dateProduction('2026-10-22', '2026-10-15', FERMES), MERCREDI);
});

test('validerDelai : compté en jours ouvrés, mardi exclu, première date proposée', () => {
  // Commande le lundi, délai 1 jour ouvré : mardi fermé → premier retrait mercredi.
  const r = validerDelai(MARDI_20, LUNDI, 1, FERMES);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DELAI_TROP_COURT');
    assert.equal(r.valeurProposee, MERCREDI);
    assert.match(r.message, /1 jour ouvré/);
  }
  assert.equal(validerDelai(MERCREDI, LUNDI, 1, FERMES).ok, true);
  // 2 jours ouvrés depuis lundi : mercredi, jeudi → jeudi 22.
  const r2 = validerDelai(MERCREDI, LUNDI, 2, FERMES);
  if (!r2.ok) assert.equal(r2.valeurProposee, '2026-10-22');
  // Le délai est une donnée : 5 jours ouvrés depuis jeudi 15 → vendredi 16, sam, dim, lun, mer 21.
  assert.equal(validerDelai('2026-10-20', '2026-10-15', 5, FERMES).ok, false);
  assert.equal(validerDelai(MERCREDI, '2026-10-15', 5, FERMES).ok, true);
});

test('validerDelai 0 : le jour même s’il est ouvert', () => {
  assert.equal(validerDelai(LUNDI, LUNDI, 0, FERMES).ok, true);
});
