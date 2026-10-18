// node --test src/lib/serveur/reglages.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLES_REGLEMENT,
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
const P = (ouverture: string, fermeture: string) => ({ ouverture, fermeture });
const PAR_JOUR = {
  '1': P('07:00', '19:00'),
  '2': P('07:00', '19:00'),
  '3': P('07:30', '19:00'),
  '4': P('07:00', '19:00'),
  '5': P('07:00', '19:30'),
  '6': P('08:00', '18:00'),
  '7': P('08:00', '13:00'),
};
const LIGNES: LigneReglage[] = [
  { cle: CLES_REGLEMENT.acomptePourcentageMin, valeur: '30' },
  { cle: CLES_REGLEMENT.ouvertureParJour, valeur: JSON.stringify(PAR_JOUR) },
  {
    cle: CLES_REGLEMENT.ouvertureExceptions,
    valeur: '[{"date":"2026-12-24","ouverture":"07:00","fermeture":"16:00"},{"date":"2026-11-07","ouverture":"09:00","fermeture":"12:00"}]',
  },
  { cle: CLES_REGLEMENT.taillesGateau, valeur: '[3,5,12]' },
  { cle: CLES_REGLEMENT.delaiGateauEtagesJours, valeur: '4' },
];

function sans(...cles: string[]): LigneReglage[] {
  return LIGNES.filter((l) => !cles.includes(l.cle));
}
function avec(cle: string, valeur: string, lignes = LIGNES): LigneReglage[] {
  return lignes.map((l) => (l.cle === cle ? { cle, valeur } : l));
}

test('clés : nouvelles clés de la migration 20261018100000, plus aucune clé pâtisserie ni heure de fermeture', () => {
  assert.deepEqual(Object.values(CLES_REGLEMENT).sort(), [
    'reglement:acompte_min_pourcent',
    'reglement:delai_gateau_etages_jours',
    'reglement:ouverture_exceptions',
    'reglement:ouverture_par_jour',
    'reglement:tailles_gateau',
  ]);
});

test('conversion : forme du contrat (ouverture par jour, exceptions triées, tailles, délai étages)', () => {
  const r = versReglages(LIGNES);
  assert.deepEqual(r.reglement, {
    acomptePourcentageMin: 30,
    horairesOuverture: {
      parJour: PAR_JOUR,
      exceptions: [
        { date: '2026-11-07', ouverture: '09:00', fermeture: '12:00' },
        { date: '2026-12-24', ouverture: '07:00', fermeture: '16:00' },
      ],
    },
    taillesGateau: [3, 5, 12],
  });
  assert.equal(r.delaiGateauEtagesJours, 4);
});

test('clés absentes : décisions du propriétaire (06:00–20:00, aucune exception, délai étages 0, tailles) ; acompte absent : refus', () => {
  const r = versReglages(
    sans(CLES_REGLEMENT.ouvertureParJour, CLES_REGLEMENT.ouvertureExceptions, CLES_REGLEMENT.delaiGateauEtagesJours, CLES_REGLEMENT.taillesGateau),
  );
  for (const j of ['1', '2', '3', '4', '5', '6', '7'] as const) {
    assert.deepEqual(r.reglement.horairesOuverture.parJour[j], { ouverture: '06:00', fermeture: '20:00' }, j);
  }
  assert.deepEqual(r.reglement.horairesOuverture.exceptions, []);
  assert.equal(r.delaiGateauEtagesJours, 0);
  assert.deepEqual(r.reglement.taillesGateau, [...TAILLES_GATEAU_DEFAUT]);
  assert.deepEqual([...TAILLES_GATEAU_DEFAUT], [4, 6, 8, 10, 15, 20, 25, 30]);
  assert.throws(() => versReglages(sans(CLES_REGLEMENT.acomptePourcentageMin)), /acompte_min_pourcent/);
});

test('valeurs présentes hors format : refus (jamais remplacées par un défaut)', () => {
  const c = CLES_REGLEMENT;
  for (const v of ['101', '-1', '50.5', '"50"', 'x']) assert.throws(() => versReglages(avec(c.acomptePourcentageMin, v)));
  const sansDimanche = { ...PAR_JOUR } as Record<string, unknown>;
  delete sansDimanche['7'];
  for (const v of [
    '[]',
    JSON.stringify(sansDimanche),
    JSON.stringify({ ...PAR_JOUR, '8': P('09:00', '18:00') }),
    JSON.stringify({ ...PAR_JOUR, '6': P('24:00', '18:00') }),
    JSON.stringify({ ...PAR_JOUR, '6': P('9:00', '18:00') }),
    JSON.stringify({ ...PAR_JOUR, '6': P('18:00', '08:00') }),
    JSON.stringify({ ...PAR_JOUR, '6': P('08:00', '08:00') }),
    JSON.stringify({ ...PAR_JOUR, '6': '08:00' }),
    JSON.stringify({ ...PAR_JOUR, '6': { ...P('08:00', '18:00'), note: 'x' } }),
  ]) {
    assert.throws(() => versReglages(avec(c.ouvertureParJour, v)), /ouverture_par_jour/, v);
  }
  for (const v of [
    '{}',
    '[{"date":"2026-02-30","ouverture":"06:00","fermeture":"16:00"}]',
    '[{"date":"2026-2-03","ouverture":"06:00","fermeture":"16:00"}]',
    '[{"date":"2026-11-07","ouverture":"6:00","fermeture":"16:00"}]',
    '[{"date":"2026-11-07","ouverture":"16:00","fermeture":"06:00"}]',
    '[{"date":"2026-11-07","ouverture":"06:00"}]',
    '[{"date":"2026-11-07","heure":"09:00"}]',
    '[{"date":"2026-11-07","ouverture":"06:00","fermeture":"16:00","note":"x"}]',
    '[{"date":"2026-11-07","ouverture":"06:00","fermeture":"16:00"},{"date":"2026-11-07","ouverture":"07:00","fermeture":"16:00"}]',
  ]) {
    assert.throws(() => versReglages(avec(c.ouvertureExceptions, v)), /ouverture_exceptions/, v);
  }
  for (const v of ['[]', '[0,4]', '[4,201]', '[6,4]', '[4,4]', '[4.5]', '["4"]', '4']) {
    assert.throws(() => versReglages(avec(c.taillesGateau, v)), /tailles_gateau/);
  }
  for (const v of ['-1', '1.5', '"3"', '366', 'null', '[]']) {
    assert.throws(() => versReglages(avec(c.delaiGateauEtagesJours, v)), /delai_gateau_etages_jours/, v);
  }
});

test('dates : calendrier réel (années bissextiles)', () => {
  assert.ok(estDate('2028-02-29'));
  assert.ok(!estDate('2026-02-29'));
  assert.ok(!estDate('2100-02-29'));
  assert.ok(estDate('2000-02-29'));
  assert.ok(!estDate('2026-04-31'));
  assert.ok(!estDate('2026-00-10'));
});

test('bornes acceptées : 0 et 100 %, tailles 1 et 200, délai 0 et 365, aucune exception', () => {
  const c = CLES_REGLEMENT;
  assert.equal(versReglages(avec(c.acomptePourcentageMin, '0')).reglement.acomptePourcentageMin, 0);
  assert.equal(versReglages(avec(c.acomptePourcentageMin, '100')).reglement.acomptePourcentageMin, 100);
  assert.deepEqual(versReglages(avec(c.taillesGateau, '[1,200]')).reglement.taillesGateau, [1, 200]);
  assert.deepEqual(versReglages(avec(c.ouvertureExceptions, '[]')).reglement.horairesOuverture.exceptions, []);
  assert.equal(versReglages(avec(c.delaiGateauEtagesJours, '0')).delaiGateauEtagesJours, 0);
  assert.equal(versReglages(avec(c.delaiGateauEtagesJours, '365')).delaiGateauEtagesJours, 365);
  const journee = JSON.stringify({ ...PAR_JOUR, '1': P('00:00', '23:59') });
  assert.deepEqual(versReglages(avec(c.ouvertureParJour, journee)).reglement.horairesOuverture.parJour['1'], P('00:00', '23:59'));
});

test('lecture : une seule requête, uniquement les clés du règlement', async () => {
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
  assert.deepEqual((appels[0] as { where: { cle: { in: string[] } } }).where.cle.in.sort(), Object.values(CLES_REGLEMENT).sort());
  assert.equal(r.reglement.acomptePourcentageMin, 30);
});

// --- Écriture -------------------------------------------------------------

test('préparer : fusion d’un « par jour » partiel, tailles triées, exceptions triées, délai étages', () => {
  const actuel = versReglages(LIGNES);
  const r = preparerEcriture(
    {
      ouvertureParJour: { '6': P('07:00', '17:00') },
      taillesGateau: [10, 4, 6],
      ouvertureExceptions: [
        { date: '2026-12-31', ouverture: '06:00', fermeture: '17:00' },
        { date: '2026-12-24', ouverture: '06:00', fermeture: '16:00' },
      ],
      delaiGateauEtagesJours: 3,
    },
    actuel,
  );
  assert.ok(r.ok);
  const parCle = Object.fromEntries(r.donnees.map((e) => [e.cle, JSON.parse(e.valeur)]));
  assert.deepEqual(parCle[CLES_REGLEMENT.ouvertureParJour], { ...PAR_JOUR, '6': P('07:00', '17:00') });
  assert.deepEqual(parCle[CLES_REGLEMENT.taillesGateau], [4, 6, 10]);
  assert.deepEqual(parCle[CLES_REGLEMENT.ouvertureExceptions].map((e: { date: string }) => e.date), ['2026-12-24', '2026-12-31']);
  assert.equal(parCle[CLES_REGLEMENT.delaiGateauEtagesJours], 3);
  // rien d'autre n'est écrit
  assert.equal(r.donnees.length, 4);
});

test('préparer : refus lisibles, champ fautif désigné', () => {
  const actuel = versReglages(LIGNES);
  const cas: [Parameters<typeof preparerEcriture>[0], string][] = [
    [{ ouvertureParJour: { '6': P('25:00', '18:00') } }, 'ouvertureParJour.6'],
    [{ ouvertureParJour: { '6': P('18:00', '08:00') } }, 'ouvertureParJour.6'],
    [{ ouvertureParJour: { '8': P('09:00', '18:00') } } as never, 'ouvertureParJour'],
    [{ ouvertureParJour: '06:00' } as never, 'ouvertureParJour'],
    [{ ouvertureExceptions: [{ date: '2026-02-30', ouverture: '06:00', fermeture: '16:00' }] }, 'ouvertureExceptions'],
    [{ ouvertureExceptions: [{ date: '2026-12-24', ouverture: '16:00', fermeture: '06:00' }] }, 'ouvertureExceptions'],
    [
      {
        ouvertureExceptions: [
          { date: '2026-11-07', ouverture: '06:00', fermeture: '16:00' },
          { date: '2026-11-07', ouverture: '07:00', fermeture: '16:00' },
        ],
      },
      'ouvertureExceptions',
    ],
    [{ taillesGateau: [4, 4] }, 'taillesGateau'],
    [{ taillesGateau: [0] }, 'taillesGateau'],
    [{ taillesGateau: [] }, 'taillesGateau'],
    [{ taillesGateau: [4.5] }, 'taillesGateau'],
    [{ acomptePourcentageMin: 120 }, 'acomptePourcentageMin'],
    [{ delaiGateauEtagesJours: -1 }, 'delaiGateauEtagesJours'],
    [{ delaiGateauEtagesJours: 2.5 }, 'delaiGateauEtagesJours'],
    [{ delaiGateauEtagesJours: '3' } as never, 'delaiGateauEtagesJours'],
    [{ heureFermeture: '20:00' } as never, 'heureFermeture'],
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
  const samedi = preparerEcriture({ ouvertureParJour: { '6': P('25:00', '18:00') } }, actuel);
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
  const r = await ecrireReglages(client, { taillesGateau: [8, 4], ouvertureParJour: { '7': P('07:00', '12:00') }, delaiGateauEtagesJours: 0 });
  assert.ok(r.ok);
  assert.deepEqual(r.donnees.reglement.taillesGateau, [4, 8]);
  assert.deepEqual(r.donnees.reglement.horairesOuverture.parJour['7'], P('07:00', '12:00'));
  assert.deepEqual(r.donnees.reglement.horairesOuverture.parJour['6'], PAR_JOUR['6']);
  assert.equal(r.donnees.delaiGateauEtagesJours, 0);
  assert.deepEqual(journal.filter((j) => j === 'transaction'), ['transaction']);
});

test('écrire : clé absente en base (base pas encore migrée) → créée', async () => {
  const { client, table } = fauxClient(sans(CLES_REGLEMENT.delaiGateauEtagesJours));
  const r = await ecrireReglages(client, { delaiGateauEtagesJours: 5 });
  assert.ok(r.ok);
  assert.equal(r.donnees.delaiGateauEtagesJours, 5);
  assert.equal(table.get(CLES_REGLEMENT.delaiGateauEtagesJours), '5');
});

test('écrire : refus → rien n’est écrit', async () => {
  const { client, journal } = fauxClient(LIGNES);
  const r = await ecrireReglages(client, { taillesGateau: [4, 6], ouvertureParJour: { '1': P('9:00', '18:00') } });
  assert.equal(r.ok, false);
  assert.ok(!journal.includes('transaction'));
});
