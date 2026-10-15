// node --test src/domaine/resultat.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  avertir,
  bloquant,
  combiner,
  enchainer,
  estEchec,
  informer,
  listerBlocages,
  niveauDuCode,
  pourClient,
  succes,
  type Echec,
  type Resultat,
} from './resultat.ts';
import { CATALOGUE, libelleCorrection, messagePour, signaler } from './messages.ts';

test('bloquant : format exact de la LOI 9', () => {
  const r = bloquant('ERR_JOUR_FERME', 'Fermé le mardi — choisissez un autre jour de retrait.', {
    champ: 'dateRetrait',
    valeurProposee: '2026-10-21',
  });
  assert.deepEqual(r, {
    ok: false,
    niveau: 'bloquant',
    code: 'ERR_JOUR_FERME',
    message: 'Fermé le mardi — choisissez un autre jour de retrait.',
    champ: 'dateRetrait',
    valeurProposee: '2026-10-21',
  });
});

test('bloquant sans options : pas de clés champ/valeurProposee vides', () => {
  const r = bloquant('ERR_X', 'm');
  assert.deepEqual(Object.keys(r).sort(), ['code', 'message', 'niveau', 'ok']);
});

test('valeurProposee à 0 est conservée', () => {
  assert.equal(bloquant('ERR_X', 'm', { valeurProposee: 0 }).valeurProposee, 0);
});

test('avertir et informer ne bloquent pas : ils voyagent avec un succès', () => {
  const a = avertir('AVERT_DOUBLE_SCAN', 'a', { champ: 'quantite' });
  const i = informer('INFO_TARIF_EN_VIGUEUR', 'i');
  assert.equal(a.niveau, 'avertissement');
  assert.equal(i.niveau, 'information');
  const r = succes(12, a, i);
  assert.equal(r.ok, true);
  assert.equal(r.donnees, 12);
  assert.deepEqual(r.signalements, [a, i]);
});

test('succes dédoublonne les signalements (même code + même champ)', () => {
  const a = avertir('AVERT_DOUBLE_SCAN', 'a', { champ: 'q' });
  assert.equal(succes(1, a, a, avertir('AVERT_DOUBLE_SCAN', 'a', { champ: 'autre' })).signalements.length, 2);
});

test('niveauDuCode suit le préfixe', () => {
  assert.equal(niveauDuCode('ERR_A'), 'bloquant');
  assert.equal(niveauDuCode('AVERT_A'), 'avertissement');
  assert.equal(niveauDuCode('INFO_A'), 'information');
});

test('combiner : tout passe → données en tableau + signalements cumulés', () => {
  const r = combiner(succes('2026-10-22'), succes(20, avertir('AVERT_A', 'a')), succes(true, informer('INFO_B', 'b')));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.donnees, ['2026-10-22', 20, true]);
  assert.deepEqual(r.signalements.map((s) => s.code), ['AVERT_A', 'INFO_B']);
});

test('combiner : un bloquant → renvoie le premier, les avertissements ne masquent rien', () => {
  const e1 = bloquant('ERR_JOUR_FERME', 'm1', { champ: 'dateRetrait' });
  const e2 = bloquant('ERR_QUANTITE_MIN', 'm2', { champ: 'quantite', valeurProposee: 20 });
  const r = combiner(succes(1, avertir('AVERT_A', 'a')), e1, e2);
  assert.equal(estEchec(r), true);
  assert.equal(r, e1);
});

test('listerBlocages : tous les refus, dans l’ordre, sans doublon', () => {
  const e1 = bloquant('ERR_JOUR_FERME', 'm1', { champ: 'dateRetrait' });
  const e2 = bloquant('ERR_QUANTITE_MIN', 'm2', { champ: 'quantite' });
  const liste: Resultat<unknown>[] = [e1, succes(1), e2, e1];
  assert.deepEqual(listerBlocages(liste), [e1, e2]);
});

test('enchainer : propage l’échec et conserve les signalements', () => {
  const ok = enchainer(succes(10, informer('INFO_A', 'a')), (n) => succes(n * 2, avertir('AVERT_B', 'b')));
  assert.deepEqual(ok, { ok: true, donnees: 20, signalements: [informer('INFO_A', 'a'), avertir('AVERT_B', 'b')] });
  const e = bloquant('ERR_X', 'x');
  assert.equal(enchainer(e as Resultat<number>, (n) => succes(n)), e);
  assert.equal(enchainer(succes(1), () => e), e);
});

test('pourClient retire tout champ hors contrat (trace, erreur, detail)', () => {
  const sale = { ...bloquant('ERR_X', 'm', { champ: 'c' }), detail: new Error('nomClient: Dupont'), stack: 'at …' } as Echec;
  assert.deepEqual(pourClient(sale), { ok: false, niveau: 'bloquant', code: 'ERR_X', message: 'm', champ: 'c' });
});

// --- Catalogue de messages ---------------------------------------------------

test('ERR_JOUR_FERME reproduit le message exact de CLAUDE.md', () => {
  assert.equal(
    messagePour('ERR_JOUR_FERME', { jour: 'mardi' }),
    'Fermé le mardi — choisissez un autre jour de retrait.',
  );
});

test('ERR_QUANTITE_MIN : valeurs fournies par l’appelant + bouton de sortie', () => {
  const p = { produit: 'Layer Cake', minimum: 20, unite: 'parts' };
  const e = signaler('ERR_QUANTITE_MIN', p, { champ: 'quantite', valeurProposee: 20 });
  assert.equal(e.ok, false);
  assert.equal(e.niveau, 'bloquant');
  assert.match(e.message, /Minimum 20 parts pour « Layer Cake »/);
  assert.equal(e.valeurProposee, 20);
  assert.equal(libelleCorrection('ERR_QUANTITE_MIN', p), 'Passer à 20 parts');
  // Aucun seuil en dur : un autre minimum donne un autre texte.
  assert.match(messagePour('ERR_QUANTITE_MIN', { ...p, minimum: 30, precision: '15 parts par chiffre' }), /Minimum 30 parts .*15 parts par chiffre/);
});

test('signaler choisit le niveau d’après le catalogue', () => {
  assert.equal(signaler('AVERT_PAIN_SUPPLEMENTAIRE', { maximum: 20, demande: 21 }).niveau, 'avertissement');
  assert.equal(signaler('INFO_EN_ATTENTE_ENVOI', { nombre: 12 }).message.startsWith('12 lignes en attente'), true);
  assert.equal(messagePour('INFO_EN_ATTENTE_ENVOI', { nombre: 1 }).startsWith('1 ligne en attente'), true);
});

test('tous les messages : français, sans « ! », sans jargon, niveau cohérent avec le préfixe', () => {
  const exemples: Record<string, unknown> = {
    ERR_JOUR_FERME: { jour: 'mardi' },
    ERR_QUANTITE_MIN: { produit: 'P', minimum: 10, unite: 'pièces' },
    ERR_SOUS_PLANCHER: { produit: 'P', plancherFormate: 'X €' },
    ERR_DROIT_INSUFFISANT: { action: 'modifier un tarif', role: 'gérant' },
    ERR_DELAI_TROP_COURT: { delaiJoursOuvres: 2, premiereDate: 'jeudi 23 octobre' },
    AVERT_PAIN_SUPPLEMENTAIRE: { maximum: 20, demande: 21 },
    AVERT_DOUBLE_SCAN: { produit: 'P' },
    AVERT_DLC_PROCHE: { produit: 'P', date: '17/10' },
    INFO_TARIF_EN_VIGUEUR: { dateEffet: '01/09/2026' },
    INFO_EN_ATTENTE_ENVOI: { nombre: 3 },
    ERR_TARIF_ABSENT: { produit: 'P', date: '15/10/2026' },
    ERR_PRODUIT_INCONNU: {},
    ERR_SAISIE_INVALIDE: { champLibelle: 'Téléphone' },
    ERR_SERVEUR_INDISPONIBLE: { reference: 'ABC-DEF' },
    ERR_CONFIGURATION_SERVEUR: { reference: 'ABC-DEF' },
    ERR_DONNEE_INTROUVABLE: { reference: 'ABC-DEF' },
    ERR_DEJA_ENREGISTRE: { reference: 'ABC-DEF' },
    ERR_SESSION_EXPIREE: {},
    ERR_INATTENDUE: { reference: 'ABC-DEF' },
    // Refus levés par la base (KO-1) — sans paramètre, ou paramètre facultatif absent
    ERR_PERIODE_CONGES: {},
    ERR_UNITE_INCOHERENTE: {},
    ERR_UNITE_FIGEE: {},
    ERR_REGIME_FIGE: {},
    ERR_TARIF_IMMUABLE: {},
    ERR_TARIF_PASSE: {},
    ERR_TARIF_CHEVAUCHEMENT: {},
    ERR_TARIF_INCOHERENT: {},
    ERR_PRODUIT_EN_DOUBLE: {},
  };
  assert.deepEqual(Object.keys(exemples).sort(), Object.keys(CATALOGUE).sort(), 'chaque code a un exemple');
  for (const [code, entree] of Object.entries(CATALOGUE)) {
    const m = (entree.message as (p: unknown) => string)(exemples[code]);
    assert.ok(m.length > 10, code);
    assert.ok(!m.includes('!'), `${code} : pas de point d’exclamation`);
    assert.ok(/[.]$/.test(m), `${code} : phrase terminée`);
    assert.doesNotMatch(m, /prisma|database|http|\b[45]\d\d\b|undefined|null|NaN|error|failed|\btu\b|\bton\b/i, code);
    assert.equal(entree.niveau, niveauDuCode(code as `ERR_${string}`), `${code} : niveau = préfixe`);
  }
});

test('paramètres facultatifs (refus venus de la base) : message complet, sans trou ni montant/jour en dur', () => {
  const variantes = [
    messagePour('ERR_JOUR_FERME', {}),
    messagePour('ERR_PERIODE_CONGES', {}),
    messagePour('ERR_PERIODE_CONGES', { periode: 'congés d’été' }),
    messagePour('ERR_SOUS_PLANCHER', {}),
    libelleCorrection('ERR_SOUS_PLANCHER', {}) ?? '',
  ];
  for (const m of variantes) {
    assert.doesNotMatch(m, /undefined|null|\(\)|«  »|mardi|€|\d/, m);
  }
  assert.match(variantes[2], /\(congés d’été\)/);
});
