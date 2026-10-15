// node --test src/lib/erreurBase.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CODES_LEVES_PAR_LA_BASE, corpsClient, diagnostiquer, lireRefusBase, reponseEchec, statutHttp, traiterErreur,
  type Diagnostic,
} from './erreurBase.ts';
import { CATALOGUE, messagePour } from '../domaine/messages.ts';
import { definirDestination, type LigneJournal } from './journal.ts';
import { bloquant } from '../domaine/resultat.ts';

function erreur(name: string, message: string, code?: string) {
  const e = new Error(message) as Error & { code?: string };
  e.name = name;
  if (code) e.code = code;
  return e;
}

/** Mots qui ne doivent JAMAIS atteindre le client (audit M4). */
const INTERDITS = /DATABASE_URL|DIRECT_URL|CODE_GESTION|6543|pgbouncer|binaryTarget|rhel|Prisma|P\d{4}|setup-supabase|Supabase|Query Engine|Dupont|invocation/i;

const CAS: [string, Error, string][] = [
  ['P1001', erreur('PrismaClientKnownRequestError', "Can't reach database server at db.x.supabase.co:6543", 'P1001'), 'ERR_SERVEUR_INDISPONIBLE'],
  ['P1017', erreur('PrismaClientKnownRequestError', 'Server has closed the connection', 'P1017'), 'ERR_SERVEUR_INDISPONIBLE'],
  ['P1000', erreur('PrismaClientKnownRequestError', 'Authentication failed for postgres', 'P1000'), 'ERR_CONFIGURATION_SERVEUR'],
  ['P2021', erreur('PrismaClientKnownRequestError', 'The table `public.Commande` does not exist', 'P2021'), 'ERR_CONFIGURATION_SERVEUR'],
  ['P2025', erreur('PrismaClientKnownRequestError', 'Record to update not found', 'P2025'), 'ERR_DONNEE_INTROUVABLE'],
  ['P2002', erreur('PrismaClientKnownRequestError', 'Invalid `prisma.commande.create()` invocation: nomClient: "Dupont"', 'P2002'), 'ERR_DEJA_ENREGISTRE'],
  ['P2003', erreur('PrismaClientKnownRequestError', 'Foreign key', 'P2003'), 'ERR_INATTENDUE'],
  ['env', erreur('PrismaClientInitializationError', 'Environment variable not found: DATABASE_URL.'), 'ERR_CONFIGURATION_SERVEUR'],
  ['engine', erreur('PrismaClientInitializationError', 'Query Engine for runtime "rhel-openssl-3.0.x" not found. binaryTargets'), 'ERR_CONFIGURATION_SERVEUR'],
  ['init réseau', erreur('PrismaClientInitializationError', "Can't reach database server"), 'ERR_SERVEUR_INDISPONIBLE'],
  ['bug', new TypeError("Cannot read properties of undefined (reading 'nom')"), 'ERR_INATTENDUE'],
  ['non-Error', 'chaîne lancée' as unknown as Error, 'ERR_INATTENDUE'],
];

for (const [nom, e, codeAttendu] of CAS) {
  test(`diagnostiquer ${nom} → ${codeAttendu}, rien de technique côté client, tout côté journal`, () => {
    const lignes: LigneJournal[] = [];
    const retablir = definirDestination((l) => lignes.push(l));
    try {
      const d = diagnostiquer(e, 'GET /api/test');
      assert.equal(d.ok, false);
      assert.equal(d.niveau, 'bloquant');
      assert.equal(d.code, codeAttendu);
      assert.equal(d.error, d.message, 'compatibilité .error');
      assert.match(d.message, new RegExp(d.reference));
      assert.deepEqual(Object.keys(d).sort(), ['code', 'erreur', 'error', 'message', 'niveau', 'ok', 'reference']);
      assert.doesNotMatch(JSON.stringify(d), INTERDITS);
      // Le journal, lui, a la piste et la référence, mais pas la donnée client.
      assert.equal(lignes.length, 1);
      assert.equal(lignes[0].reference, d.reference);
      assert.equal(lignes[0].code, codeAttendu);
      assert.equal(lignes[0].route, 'GET /api/test');
      assert.ok(lignes[0].piste);
      assert.ok(!JSON.stringify(lignes[0]).includes('Dupont'));
    } finally {
      retablir();
    }
  });
}

test('statutHttp : technique vs refus métier', () => {
  assert.equal(statutHttp({ code: 'ERR_SERVEUR_INDISPONIBLE' }), 503);
  assert.equal(statutHttp({ code: 'ERR_INATTENDUE' }), 500);
  assert.equal(statutHttp({ code: 'ERR_DROIT_INSUFFISANT' }), 403);
  assert.equal(statutHttp({ code: 'ERR_JOUR_FERME' }), 422);
  assert.equal(statutHttp({ code: 'ERR_QUANTITE_MIN' }), 422);
});

test('traiterErreur et reponseEchec', () => {
  const retablir = definirDestination(() => {});
  try {
    const t = traiterErreur(erreur('PrismaClientKnownRequestError', 'x', 'P1001'));
    assert.equal(t.statut, 503);
    const sale = { ...bloquant('ERR_QUANTITE_MIN', 'Minimum 20 parts.', { champ: 'quantite', valeurProposee: 20 }), stack: 'at x' };
    const r = reponseEchec(sale, 'POST /api/commandes');
    assert.equal(r.statut, 422);
    assert.deepEqual(r.corps, {
      ok: false, niveau: 'bloquant', code: 'ERR_QUANTITE_MIN', message: 'Minimum 20 parts.',
      champ: 'quantite', valeurProposee: 20, error: 'Minimum 20 parts.', erreur: 'Minimum 20 parts.',
    });
  } finally {
    retablir();
  }
});

// ---------------------------------------------------------------------------
// KO-1 (qa-metier) : refus levés par les déclencheurs de la base
// ---------------------------------------------------------------------------

/** Ce qui vient de la base et ne doit jamais atteindre l'employé. */
const INTERDITS_SQL = /P0001|23505|SQLSTATE|PostgresError|ConnectorError|QueryError|severity|champ=|DETAIL|HINT|Some\(|exprime|nomme|centimes|Dupont|invocation|Prisma|P\d{4}/;

/** Forme réelle Prisma 6 (moteur natif) d'un RAISE EXCEPTION sur une requête de modèle. */
function erreurDeclencheur(sqlstate: string, code: string, detail: string | null, hint: string | null) {
  const s = (v: string | null) => (v === null ? 'None' : `Some(${JSON.stringify(v)})`);
  const e = new Error(
    '\nInvalid `prisma.commande.create()` invocation:\n\n{\n  data: {\n    nomClient: "Dupont",\n    telClient: "0470123456"\n  }\n}\n\n' +
      'Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(' +
      `PostgresError { code: "${sqlstate}", message: "${code}", severity: "ERROR", detail: ${s(detail)}, column: None, hint: ${s(hint)} }` +
      '), transient: false })',
  ) as Error & { clientVersion?: string };
  e.name = 'PrismaClientUnknownRequestError';
  e.clientVersion = '6.18.0';
  return e;
}

function connue(message: string, code: string, meta: Record<string, unknown>) {
  const e = erreur('PrismaClientKnownRequestError', message, code) as Error & { meta?: unknown };
  e.meta = meta;
  return e;
}

type CasBase = { code: string; sqlstate: string; detail: string; hint: string; champ: string; message: string };

const CAS_BASE: CasBase[] = [
  { code: 'ERR_JOUR_FERME', sqlstate: 'P0001', detail: 'mardi', hint: 'champ=retraitLe', champ: 'retraitLe',
    message: 'Fermé le mardi — choisissez un autre jour de retrait.' },
  { code: 'ERR_PERIODE_CONGES', sqlstate: 'P0001', detail: 'congés d’été', hint: 'champ=retraitLe', champ: 'retraitLe',
    message: messagePour('ERR_PERIODE_CONGES', { periode: 'congés d’été' }) },
  { code: 'ERR_UNITE_INCOHERENTE', sqlstate: 'P0001', detail: 'Prix exprime par kg, produit compte en piece.', hint: 'champ=basePrix', champ: 'basePrix',
    message: messagePour('ERR_UNITE_INCOHERENTE', {}) },
  { code: 'ERR_UNITE_FIGEE', sqlstate: 'P0001', detail: 'Ce produit a deja un historique : creer un nouveau produit plutot que changer son unite.', hint: 'champ=unite', champ: 'unite',
    message: messagePour('ERR_UNITE_FIGEE', {}) },
  { code: 'ERR_REGIME_FIGE', sqlstate: 'P0001', detail: 'Ce produit a deja des prix ou des commandes : creer un nouveau produit plutot que changer son regime.', hint: 'champ=regimePrix', champ: 'regimePrix',
    message: messagePour('ERR_REGIME_FIGE', {}) },
  { code: 'ERR_TARIF_IMMUABLE', sqlstate: 'P0001', detail: 'Un tarif entre en vigueur ne se modifie pas : creer une nouvelle version datee.', hint: 'champ=prixCentimes', champ: 'prixCentimes',
    message: messagePour('ERR_TARIF_IMMUABLE', {}) },
  { code: 'ERR_TARIF_PASSE', sqlstate: 'P0001', detail: 'La periode passee d\'un tarif ne se reecrit pas.', hint: 'champ=valideAu', champ: 'valideAu',
    message: messagePour('ERR_TARIF_PASSE', {}) },
  { code: 'ERR_TARIF_CHEVAUCHEMENT', sqlstate: 'P0001', detail: 'Une autre version de prix couvre deja cette periode : fermer la version courante d\'abord.', hint: 'champ=valideDu', champ: 'valideDu',
    message: messagePour('ERR_TARIF_CHEVAUCHEMENT', {}) },
  { code: 'ERR_TARIF_INCOHERENT', sqlstate: 'P0001', detail: 'La version de prix ne correspond pas au produit de la ligne.', hint: 'champ=prixProduitId', champ: 'prixProduitId',
    message: messagePour('ERR_TARIF_INCOHERENT', {}) },
  { code: 'ERR_SOUS_PLANCHER', sqlstate: 'P0001', detail: 'Prix par personne sous le plancher (450 centimes).', hint: 'champ=prixCentimes', champ: 'prixCentimes',
    message: messagePour('ERR_SOUS_PLANCHER', {}) },
  { code: 'ERR_PRODUIT_EN_DOUBLE', sqlstate: '23505', detail: 'Un produit nomme « Pain gris » existe deja.', hint: 'champ=nom', champ: 'nom',
    message: messagePour('ERR_PRODUIT_EN_DOUBLE', {}) },
];

test('chaque code levé par la base a un cas de test et une entrée au catalogue', () => {
  assert.deepEqual(CAS_BASE.map((c) => c.code).sort(), [...CODES_LEVES_PAR_LA_BASE].sort());
  for (const code of CODES_LEVES_PAR_LA_BASE) assert.ok(code in CATALOGUE, code);
});

function verifierRefus(d: Diagnostic, attendu: { code: string; message: string; champ?: string }, statut: number) {
  assert.equal(d.ok, false);
  assert.equal(d.niveau, 'bloquant');
  assert.equal(d.code, attendu.code);
  assert.equal(d.message, attendu.message);
  assert.equal(d.error, attendu.message, 'compatibilité .error');
  assert.equal(d.erreur, attendu.message, 'compatibilité .erreur');
  assert.equal(d.champ, attendu.champ);
  assert.equal(statut, 422);
  assert.doesNotMatch(JSON.stringify(d), INTERDITS_SQL);
  assert.doesNotMatch(JSON.stringify(d), INTERDITS);
}

for (const c of CAS_BASE) {
  test(`déclencheur ${c.code} (SQLSTATE ${c.sqlstate}) → message du catalogue, champ ${c.champ}, 422`, () => {
    const lignes: LigneJournal[] = [];
    const retablir = definirDestination((l) => lignes.push(l));
    try {
      const { corps, statut } = traiterErreur(erreurDeclencheur(c.sqlstate, c.code, c.detail, c.hint), 'POST /api/test');
      verifierRefus(corps, c, statut);
      // Journal : code, référence — mais aucune donnée client.
      assert.equal(lignes.length, 1);
      assert.equal(lignes[0].code, c.code);
      assert.equal(lignes[0].reference, corps.reference);
      assert.ok(!JSON.stringify(lignes[0]).includes('Dupont'));
      assert.ok(!JSON.stringify(lignes[0]).includes('0470123456'));
    } finally {
      retablir();
    }
  });
}

test('le message de fermeture suit la DONNÉE de la base (aucun jour en dur)', () => {
  const retablir = definirDestination(() => {});
  try {
    const d = diagnostiquer(erreurDeclencheur('P0001', 'ERR_JOUR_FERME', '25 décembre', 'champ=retraitLe'));
    assert.equal(d.message, 'Fermé le 25 décembre — choisissez un autre jour de retrait.');
    // Libellé absent : message exact sans lui, champ par défaut.
    const sans = diagnostiquer(erreurDeclencheur('P0001', 'ERR_JOUR_FERME', null, null));
    assert.equal(sans.message, messagePour('ERR_JOUR_FERME', {}));
    assert.equal(sans.champ, 'retraitLe');
    assert.doesNotMatch(sans.message, /mardi/);
  } finally {
    retablir();
  }
});

test('requête brute : P2010 meta.code P0001 → refus typé', () => {
  const retablir = definirDestination(() => {});
  try {
    const e = connue('Raw query failed. Code: `P0001`. Message: `ERR_TARIF_CHEVAUCHEMENT`', 'P2010',
      { code: 'P0001', message: 'ERR_TARIF_CHEVAUCHEMENT' });
    const { corps, statut } = traiterErreur(e);
    verifierRefus(corps, { code: 'ERR_TARIF_CHEVAUCHEMENT', message: messagePour('ERR_TARIF_CHEVAUCHEMENT', {}), champ: 'valideDu' }, statut);
  } finally {
    retablir();
  }
});

test('texte PostgreSQL (DETAIL:/HINT:) et pilote pg direct', () => {
  const retablir = definirDestination(() => {});
  try {
    const texte = 'ERROR: ERR_JOUR_FERME\nDETAIL: mardi\nHINT: champ=retraitLe';
    const a = traiterErreur(connue(`Raw query failed. Code: \`P0001\`. Message: \`${texte}\``, 'P2010', { code: 'P0001', message: texte }));
    verifierRefus(a.corps, CAS_BASE[0], a.statut);

    const pg = Object.assign(new Error('ERR_PERIODE_CONGES'), { code: 'P0001', detail: 'congés d’été', hint: 'champ=retraitLe' });
    const b = traiterErreur(pg);
    verifierRefus(b.corps, CAS_BASE[1], b.statut);
  } finally {
    retablir();
  }
});

test('23505 converti en P2002 par le moteur (MESSAGE perdu) : doublon de produit', () => {
  const retablir = definirDestination(() => {});
  try {
    const e = connue('Unique constraint failed on the (not available)', 'P2002', { modelName: 'Produit', target: '(not available)' });
    const { corps, statut } = traiterErreur(e);
    verifierRefus(corps, { code: 'ERR_PRODUIT_EN_DOUBLE', message: messagePour('ERR_PRODUIT_EN_DOUBLE', {}), champ: 'nom' }, statut);

    // Le vrai index unique cleCatalogue, ou un autre modèle, reste ERR_DEJA_ENREGISTRE.
    const cle = connue('Unique constraint failed on the fields: (`cleCatalogue`)', 'P2002', { modelName: 'Produit', target: ['cleCatalogue'] });
    assert.equal(traiterErreur(cle).corps.code, 'ERR_DEJA_ENREGISTRE');
    const autre = connue('Unique constraint failed', 'P2002', { modelName: 'Commande', target: ['numero'] });
    assert.equal(traiterErreur(autre).corps.code, 'ERR_DEJA_ENREGISTRE');
  } finally {
    retablir();
  }
});

test('un ERR_* hors base (bug ordinaire, code inconnu, autre SQLSTATE) n’est pas pris pour un refus', () => {
  const retablir = definirDestination(() => {});
  try {
    assert.equal(diagnostiquer(new Error('ERR_JOUR_FERME')).code, 'ERR_INATTENDUE');
    assert.equal(diagnostiquer(erreurDeclencheur('P0001', 'ERR_INVENTE_PAR_LA_BASE', null, null)).code, 'ERR_INATTENDUE');
    assert.equal(diagnostiquer(erreurDeclencheur('42P01', 'ERR_JOUR_FERME', null, null)).code, 'ERR_INATTENDUE');
    assert.equal(lireRefusBase(null), null);
  } finally {
    retablir();
  }
});

test('corpsClient : contrat LOI 9 + error/erreur, rien d’autre', () => {
  const sale = { ...bloquant('ERR_JOUR_FERME', 'Fermé.', { champ: 'retraitLe', valeurProposee: '2026-10-22' }), stack: 'at x', detail: 'SQL' };
  assert.deepEqual(corpsClient(sale), {
    ok: false, niveau: 'bloquant', code: 'ERR_JOUR_FERME', message: 'Fermé.',
    champ: 'retraitLe', valeurProposee: '2026-10-22', error: 'Fermé.', erreur: 'Fermé.',
  });
});
