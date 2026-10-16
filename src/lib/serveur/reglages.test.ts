// node --test src/lib/serveur/reglages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLES_REGLEMENT,
  CLES_REGLEMENT_OBSOLETES,
  ecrireReglages,
  estDate,
  lireReglages,
  preparerEcriture,
  TAILLES_GATEAU_DEFAUT,
  versReglages,
  type EcrivainReglages,
  type LigneReglage,
} from './reglages.ts';

// Données de TEST (valeurs volontairement différentes du règlement réel) :
// la seule source des chiffres est la table "Reglage".
const PAR_JOUR = { '1': '08:15', '2': '08:15', '3': '08:30', '4': '08:15', '5': '08:15', '6': '10:45', '7': '11:00' };
const LIGNES: LigneReglage[] = [
  { cle: CLES_REGLEMENT.acomptePourcentageMin, valeur: '30' },
  { cle: CLES_REGLEMENT.heureFermeture, valeur: '"19:30"' },
  { cle: CLES_REGLEMENT.famillesPatisserie, valeur: '["famille test"]' },
  { cle: CLES_REGLEMENT.retraitParJour, valeur: JSON.stringify(PAR_JOUR) },
  { cle: CLES_REGLEMENT.retraitExceptions, valeur: '[{"date":"2026-12-24","heure":"07:00"},{"date":"2026-11-07","heure":"11:00"}]' },
  { cle: CLES_REGLEMENT.taillesGateau, valeur: '[3,5,12]' },
  // Anciennes clés encore en base (obsolètes) : ignorées quand « par jour » existe.
  { cle: CLES_REGLEMENT_OBSOLETES.retraitSemaine, valeur: '"06:00"' },
  { cle: CLES_REGLEMENT_OBSOLETES.retraitWeekEnd, valeur: '"06:30"' },
  { cle: CLES_REGLEMENT_OBSOLETES.joursWeekEndIso, valeur: '[6,7]' },
];

function sans(...cles: string[]): LigneReglage[] {
  return LIGNES.filter((l) => !cles.includes(l.cle));
}
function avec(cle: string, valeur: string, lignes = LIGNES): LigneReglage[] {
  return lignes.map((l) => (l.cle === cle ? { cle, valeur } : l));
}

test('conversion : forme du contrat (par jour, exceptions triées, tailles) + heure de fermeture', () => {
  const r = versReglages(LIGNES);
  assert.deepEqual(r.reglement, {
    acomptePourcentageMin: 30,
    horairesRetraitPatisserie: {
      familles: ['famille test'],
      parJour: PAR_JOUR,
      exceptions: [
        { date: '2026-11-07', heure: '11:00' },
        { date: '2026-12-24', heure: '07:00' },
      ],
    },
    taillesGateau: [3, 5, 12],
  });
  assert.equal(r.heureFermeture, '19:30');
});

test('compatibilité : sans « par jour », déduit de semaine / week-end / jours de week-end', () => {
  const lignes = avec(CLES_REGLEMENT_OBSOLETES.joursWeekEndIso, '[7]', sans(CLES_REGLEMENT.retraitParJour, CLES_REGLEMENT.retraitExceptions));
  const h = versReglages(lignes).reglement.horairesRetraitPatisserie;
  assert.deepEqual(h.parJour, { '1': '06:00', '2': '06:00', '3': '06:00', '4': '06:00', '5': '06:00', '6': '06:00', '7': '06:30' });
  assert.deepEqual(h.exceptions, []);
  // ni l'une ni l'autre forme : refus
  assert.throws(
    () => versReglages(sans(CLES_REGLEMENT.retraitParJour, CLES_REGLEMENT_OBSOLETES.retraitSemaine)),
    /patisserie_retrait_semaine/,
  );
});

test('clé absente : refus (jamais de valeur par défaut)', () => {
  for (const cle of Object.values(CLES_REGLEMENT)) {
    if (cle === CLES_REGLEMENT.retraitParJour) continue; // compatibilité, testée plus haut
    if (cle === CLES_REGLEMENT.taillesGateau) continue; // défaut décidé par le propriétaire, testé plus bas
    assert.throws(() => versReglages(sans(cle)), new RegExp(cle));
  }
});

test('valeurs hors format : refus', () => {
  const c = CLES_REGLEMENT;
  for (const v of ['101', '-1', '50.5', '"50"', 'x']) assert.throws(() => versReglages(avec(c.acomptePourcentageMin, v)));
  for (const v of ['"24:00"', '"9:00"', '"9h00"', '900']) assert.throws(() => versReglages(avec(c.heureFermeture, v)));
  for (const v of ['[]', '[""]', '"patisserie"', '[1]']) assert.throws(() => versReglages(avec(c.famillesPatisserie, v)));
  const sansDimanche = { ...PAR_JOUR } as Record<string, string>;
  delete sansDimanche['7'];
  for (const v of [
    '[]',
    JSON.stringify(sansDimanche),
    JSON.stringify({ ...PAR_JOUR, '8': '09:00' }),
    JSON.stringify({ ...PAR_JOUR, '6': '24:00' }),
    JSON.stringify({ ...PAR_JOUR, '6': 12 }),
  ]) {
    assert.throws(() => versReglages(avec(c.retraitParJour, v)), /par_jour/);
  }
  for (const v of [
    '{}',
    '[{"date":"2026-02-30","heure":"09:00"}]',
    '[{"date":"2026-2-03","heure":"09:00"}]',
    '[{"date":"2026-11-07","heure":"9:00"}]',
    '[{"date":"2026-11-07"}]',
    '[{"date":"2026-11-07","heure":"09:00","note":"x"}]',
    '[{"date":"2026-11-07","heure":"09:00"},{"date":"2026-11-07","heure":"10:00"}]',
  ]) {
    assert.throws(() => versReglages(avec(c.retraitExceptions, v)), /exceptions/);
  }
  for (const v of ['[]', '[0,4]', '[4,201]', '[6,4]', '[4,4]', '[4.5]', '["4"]', '4']) {
    assert.throws(() => versReglages(avec(c.taillesGateau, v)), /tailles_gateau/);
  }
});

test('tailles absentes : défaut du propriétaire (15/10/2026) ; présentes mais invalides : refus', () => {
  assert.deepEqual(versReglages(sans(CLES_REGLEMENT.taillesGateau)).reglement.taillesGateau, [...TAILLES_GATEAU_DEFAUT]);
  assert.deepEqual([...TAILLES_GATEAU_DEFAUT], [4, 6, 8, 10, 15, 20, 25, 30]);
  assert.throws(() => versReglages(avec(CLES_REGLEMENT.taillesGateau, '[]')), /tailles_gateau/);
});

test('dates : calendrier réel (années bissextiles)', () => {
  assert.ok(estDate('2028-02-29'));
  assert.ok(!estDate('2026-02-29'));
  assert.ok(!estDate('2100-02-29'));
  assert.ok(estDate('2000-02-29'));
  assert.ok(!estDate('2026-04-31'));
  assert.ok(!estDate('2026-00-10'));
});

test('bornes acceptées : 0 et 100 %, tailles 1 et 200, aucune exception', () => {
  const c = CLES_REGLEMENT;
  assert.equal(versReglages(avec(c.acomptePourcentageMin, '0')).reglement.acomptePourcentageMin, 0);
  assert.equal(versReglages(avec(c.acomptePourcentageMin, '100')).reglement.acomptePourcentageMin, 100);
  assert.deepEqual(versReglages(avec(c.taillesGateau, '[1,200]')).reglement.taillesGateau, [1, 200]);
  assert.deepEqual(versReglages(avec(c.retraitExceptions, '[]')).reglement.horairesRetraitPatisserie.exceptions, []);
});

test('lecture : une seule requête, clés du règlement (anciennes comprises)', async () => {
  const appels: unknown[] = [];
  const r = await lireReglages({
    reglage: {
      async findMany(args) {
        appels.push(args);
        return LIGNES;
      },
    },
  });
  assert.equal(appels.length, 1);
  assert.deepEqual(
    (appels[0] as { where: { cle: { in: string[] } } }).where.cle.in.sort(),
    [...Object.values(CLES_REGLEMENT), ...Object.values(CLES_REGLEMENT_OBSOLETES)].sort(),
  );
  assert.equal(r.reglement.acomptePourcentageMin, 30);
});

// --- Écriture -------------------------------------------------------------

test('préparer : fusion d’un « par jour » partiel, tailles triées, exceptions triées', () => {
  const actuel = versReglages(LIGNES);
  const r = preparerEcriture(
    {
      retraitParJour: { '6': '11:00' },
      taillesGateau: [10, 4, 6],
      retraitExceptions: [
        { date: '2026-12-31', heure: '08:00' },
        { date: '2026-12-24', heure: '07:00' },
      ],
    },
    actuel,
  );
  assert.ok(r.ok);
  const parCle = Object.fromEntries(r.donnees.map((e) => [e.cle, JSON.parse(e.valeur)]));
  assert.deepEqual(parCle[CLES_REGLEMENT.retraitParJour], { ...PAR_JOUR, '6': '11:00' });
  assert.deepEqual(parCle[CLES_REGLEMENT.taillesGateau], [4, 6, 10]);
  assert.deepEqual(parCle[CLES_REGLEMENT.retraitExceptions].map((e: { date: string }) => e.date), ['2026-12-24', '2026-12-31']);
  // rien d'autre n'est écrit
  assert.equal(r.donnees.length, 3);
});

test('préparer : refus lisibles, champ fautif désigné', () => {
  const actuel = versReglages(LIGNES);
  const cas: [Parameters<typeof preparerEcriture>[0], string][] = [
    [{ retraitParJour: { '6': '25:00' } }, 'retraitParJour.6'],
    [{ retraitParJour: { '8': '09:00' } as never }, 'retraitParJour'],
    [{ retraitExceptions: [{ date: '2026-02-30', heure: '09:00' }] }, 'retraitExceptions'],
    [{ retraitExceptions: [{ date: '2026-11-07', heure: '09:00' }, { date: '2026-11-07', heure: '10:00' }] }, 'retraitExceptions'],
    [{ taillesGateau: [4, 4] }, 'taillesGateau'],
    [{ taillesGateau: [0] }, 'taillesGateau'],
    [{ taillesGateau: [] }, 'taillesGateau'],
    [{ taillesGateau: [4.5] }, 'taillesGateau'],
    [{ acomptePourcentageMin: 120 }, 'acomptePourcentageMin'],
    [{ heureFermeture: '8h' }, 'heureFermeture'],
    [{ famillesPatisserie: [] }, 'famillesPatisserie'],
    [{ inconnu: 1 } as never, 'inconnu'],
  ];
  for (const [partiel, champ] of cas) {
    const r = preparerEcriture(partiel, actuel);
    assert.equal(r.ok, false, JSON.stringify(partiel));
    if (r.ok) continue;
    assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
    assert.equal(r.champ, champ);
    assert.doesNotMatch(r.message, /reglement:|CHECK|JSON/);
  }
  const samedi = preparerEcriture({ retraitParJour: { '6': '25:00' } }, actuel);
  assert.ok(!samedi.ok && /samedi/.test(samedi.message));
});

function fauxClient(lignes: LigneReglage[]) {
  const table = new Map(lignes.map((l) => [l.cle, l.valeur]));
  const journal: string[] = [];
  const client: EcrivainReglages = {
    reglage: {
      async findMany({ where }) {
        journal.push('lire');
        return [...table].filter(([cle]) => where.cle.in.includes(cle)).map(([cle, valeur]) => ({ cle, valeur }));
      },
      upsert({ where, update }) {
        return { then: (ok: (v: unknown) => unknown) => (table.set(where.cle, update.valeur), journal.push(`ecrire ${where.cle}`), ok(undefined)) } as PromiseLike<unknown>;
      },
    },
    async $transaction(ops) {
      journal.push('transaction');
      return Promise.all(ops);
    },
  };
  return { client, table, journal };
}

test('écrire : une transaction, puis relecture', async () => {
  const { client, journal } = fauxClient(LIGNES);
  const r = await ecrireReglages(client, { taillesGateau: [8, 4], retraitParJour: { '7': '12:00' } });
  assert.ok(r.ok);
  assert.deepEqual(r.donnees.reglement.taillesGateau, [4, 8]);
  assert.equal(r.donnees.reglement.horairesRetraitPatisserie.parJour['7'], '12:00');
  assert.equal(r.donnees.reglement.horairesRetraitPatisserie.parJour['6'], '10:45');
  assert.deepEqual(journal.filter((j) => j === 'transaction'), ['transaction']);
});

test('écrire : refus → rien n’est écrit', async () => {
  const { client, journal } = fauxClient(LIGNES);
  const r = await ecrireReglages(client, { taillesGateau: [4, 6], retraitParJour: { '1': '9:00' } });
  assert.equal(r.ok, false);
  assert.ok(!journal.includes('transaction'));
});
