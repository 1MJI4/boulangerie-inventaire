// node --test src/domaine/coherence.test.ts
// Montants FICTIFS (arithmétique de test), aucun prix du catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  controlerEcriture,
  reperesDoublons,
  telephonePlausible,
  validerAcompte,
  validerChampObligatoire,
  validerModification,
  validerPrixConvenu,
  validerTelephone,
  validerTransitionStatut,
} from './coherence.ts';

const GERANT = { par: 'Karim', le: '2026-10-15T10:00:00Z' };

test('nom du client vide → ERR_CHAMP_OBLIGATOIRE', () => {
  const r = validerChampObligatoire('   ', 'nom du client', 'client');
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_CHAMP_OBLIGATOIRE');
    assert.equal(r.champ, 'client');
    assert.equal(r.message, 'Le champ « nom du client » est obligatoire : remplissez-le pour continuer.');
  }
  const ok = validerChampObligatoire(' Dupont ', 'nom du client', 'client');
  assert.ok(ok.ok);
  assert.equal(ok.donnees, 'Dupont');
});

test('téléphone vide → bloquant', () => {
  const r = validerTelephone('');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_CHAMP_OBLIGATOIRE');
});

test('téléphone belge ou international → accepté sans signalement', () => {
  for (const t of ['0470 12 34 56', '02/123.45.67', '+32 470 12 34 56', '0032470123456', '+33 6 12 34 56 78']) {
    assert.equal(telephonePlausible(t), true, t);
    const r = validerTelephone(t);
    assert.ok(r.ok);
    assert.equal(r.signalements.length, 0, t);
  }
});

test('téléphone improbable → AVERTISSEMENT, la commande passe', () => {
  for (const t of ['12345', '0470 12', 'abc', '470123456']) {
    const r = validerTelephone(t);
    assert.ok(r.ok, t);
    assert.equal(r.signalements[0]?.code, 'AVERT_TELEPHONE_IMPROBABLE', t);
  }
});

test('acompte supérieur au total → ERR_ACOMPTE_SUPERIEUR_TOTAL, total proposé', () => {
  const r = validerAcompte(5000, 2930, 50);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_ACOMPTE_SUPERIEUR_TOTAL');
    assert.equal(r.valeurProposee, 2930);
    assert.match(r.message, /50,00 €.*29,30 €/);
  }
});

test('acompte négatif ou décimal → ERR_SAISIE_INVALIDE, minimum proposé ; acompte = total accepté', () => {
  const r = validerAcompte(-100, 2930, 50);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
    assert.equal(r.valeurProposee, 1465);
  }
  assert.equal(validerAcompte(2930, 2930, 50).ok, true);
  assert.equal(validerAcompte(1.5, 2930, 50).ok, false);
});

test('R52 acompte sous 50 % → ERR_ACOMPTE_INSUFFISANT, minimum proposé ; 0 € refusé', () => {
  const r = validerAcompte(4499, 9000, 50);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_ACOMPTE_INSUFFISANT');
    assert.equal(r.niveau, 'bloquant');
    assert.equal(r.valeurProposee, 4500);
    assert.equal(r.champ, 'acompte');
    assert.match(r.message, /50 %/);
    assert.match(r.message, /45,00 €/);
  }
  const zero = validerAcompte(0, 9000, 50);
  assert.equal(zero.ok, false, 'plus d’acompte facultatif');
  if (!zero.ok) assert.equal(zero.code, 'ERR_ACOMPTE_INSUFFISANT');
});

test('R52 acompte pile 50 % accepté ; total impair → minimum arrondi au centime supérieur', () => {
  assert.equal(validerAcompte(4500, 9000, 50).ok, true, 'pile 50 %');
  const impair = validerAcompte(1465, 2931, 50);
  assert.equal(impair.ok, false, '1465 < 1465,5');
  if (!impair.ok) assert.equal(impair.valeurProposee, 1466);
  assert.equal(validerAcompte(1466, 2931, 50).ok, true);
  assert.equal(validerAcompte(1, 1, 50).ok, true, '1 centime : minimum 1');
  assert.equal(validerAcompte(0, 1, 50).ok, false);
});

test('R52 le pourcentage est une donnée', () => {
  assert.equal(validerAcompte(2999, 10000, 30).ok, false);
  assert.equal(validerAcompte(3000, 10000, 30).ok, true);
  assert.equal(validerAcompte(0, 10000, 0).ok, true);
  assert.throws(() => validerAcompte(0, 10000, 150), RangeError, 'configuration impossible = bug');
});

test('prix convenu absent ou égal au tarif → total du tarif', () => {
  const a = validerPrixConvenu(12700, undefined);
  assert.ok(a.ok);
  assert.equal(a.donnees, 12700);
  assert.equal(validerPrixConvenu(12700, 12700).ok, true);
});

test('prix convenu sous le tarif sans gérant → ERR_REMISE_NON_AUTORISEE, tarif proposé', () => {
  const r = validerPrixConvenu(12700, 10000);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_REMISE_NON_AUTORISEE');
    assert.equal(r.valeurProposee, 12700);
  }
  assert.equal(validerPrixConvenu(12700, 10000, { par: ' ', le: 'x' }).ok, false, 'nom vide = pas d’accord');
});

test('prix convenu sous le tarif avec le gérant → accepté, tracé', () => {
  const r = validerPrixConvenu(12700, 10000, GERANT);
  assert.ok(r.ok);
  assert.equal(r.donnees, 10000);
  assert.equal(r.signalements[0]?.code, 'AVERT_REMISE_AUTORISEE');
  assert.match(r.signalements[0]?.message ?? '', /Karim/);
});

test('prix convenu au-dessus du tarif → ERR_TOTAL_INCOHERENT ; à 0 → ERR_MONTANT_NUL', () => {
  const r = validerPrixConvenu(12700, 15000, GERANT);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'ERR_TOTAL_INCOHERENT');
  const z = validerPrixConvenu(12700, 0, GERANT);
  assert.equal(z.ok, false);
  if (!z.ok) assert.equal(z.code, 'ERR_MONTANT_NUL');
});

test('même produit sur deux lignes → AVERT_PRODUIT_EN_DOUBLE, lignes à fusionner proposées', () => {
  const s = reperesDoublons([
    { produitId: 'a', libelle: 'Layer Cake' },
    { produitId: 'b', libelle: 'Mini burger' },
    { produitId: 'a', libelle: 'Layer Cake' },
    { produitId: null, libelle: 'Libre' },
    { produitId: null, libelle: 'Libre' },
  ]);
  assert.equal(s.length, 1);
  assert.equal(s[0].code, 'AVERT_PRODUIT_EN_DOUBLE');
  assert.deepEqual(s[0].valeurProposee, [0, 2]);
});

const TOUT_REMIS = { articles: [{ id: 'l0', remis: true }, { id: 'l1', remis: true }] };

test('statut : cycle de vie respecté', () => {
  assert.equal(validerTransitionStatut('a_imprimer', 'imprimee').ok, true);
  assert.equal(validerTransitionStatut('imprimee', 'remise', TOUT_REMIS).ok, true);
  assert.equal(validerTransitionStatut('imprimee', 'a_imprimer').ok, true, 'réimpression');
  assert.equal(validerTransitionStatut('remise', 'remise').ok, true, 'aucun changement');
});

test('R58 statut → remise sans décompte complet → ERR_DECOMPTE_INCOMPLET', () => {
  const r = validerTransitionStatut('imprimee', 'remise', { articles: [{ id: 'l0', remis: true }, { id: 'l1', remis: false }] });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, 'ERR_DECOMPTE_INCOMPLET');
    assert.deepEqual(r.valeurProposee, ['l1']);
  }
  const sans = validerTransitionStatut('imprimee', 'remise');
  assert.equal(sans.ok, false, 'pas de liste = pas de décompte');
  if (!sans.ok) assert.equal(sans.code, 'ERR_DECOMPTE_INCOMPLET');
  // Le cycle de vie passe avant le décompte : à imprimer → remise reste incohérent.
  const r2 = validerTransitionStatut('a_imprimer', 'remise', TOUT_REMIS);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.code, 'ERR_STATUT_INCOHERENT');
});

test('statut : remettre en cours une commande remise ou annulée → ERR_STATUT_INCOHERENT', () => {
  for (const [de, vers] of [
    ['remise', 'a_imprimer'],
    ['remise', 'imprimee'],
    ['annulee', 'a_imprimer'],
    ['a_imprimer', 'remise'],
  ] as const) {
    const r = validerTransitionStatut(de, vers);
    assert.equal(r.ok, false, `${de} → ${vers}`);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_STATUT_INCOHERENT');
      assert.equal(r.valeurProposee, de);
    }
  }
});

test('modifier une commande annulée, remise, anonymisée ou archivée → ERR_COMMANDE_FIGEE', () => {
  const base = { retraitLe: '2026-10-21' };
  const cas = [
    { ...base, statut: 'annulee' as const },
    { ...base, statut: 'remise' as const },
    { ...base, statut: 'a_imprimer' as const, anonymiseeLe: '2026-11-20' },
    { retraitLe: '2026-10-10', statut: 'imprimee' as const },
  ];
  for (const e of cas) {
    const r = validerModification(e, '2026-10-15', 2);
    assert.equal(r.ok, false, JSON.stringify(e));
    if (!r.ok) assert.equal(r.code, 'ERR_COMMANDE_FIGEE');
  }
});

test('modifier une commande imprimée → accepté, « réimprimez » ; à imprimer → rien', () => {
  const r = validerModification({ statut: 'imprimee', retraitLe: '2026-10-21' }, '2026-10-15', 2);
  assert.ok(r.ok);
  assert.equal(r.signalements[0]?.code, 'AVERT_COMMANDE_DEJA_IMPRIMEE');
  const r2 = validerModification({ statut: 'a_imprimer', retraitLe: '2026-10-13' }, '2026-10-15', 2);
  assert.ok(r2.ok, 'retrait passé depuis 2 jours : pas encore archivée');
  assert.equal(r2.signalements.length, 0);
});

test('écriture non précisée sur un gâteau → avertissement', () => {
  assert.equal(controlerEcriture({ contientGateau: true })[0]?.code, 'AVERT_ECRITURE_NON_PRECISEE');
  assert.equal(controlerEcriture({ contientGateau: true, texteGateau: 'Joyeux anniversaire' }).length, 0);
  assert.equal(controlerEcriture({ contientGateau: true, sansEcriture: true }).length, 0);
  assert.equal(controlerEcriture({ contientGateau: false }).length, 0);
});
