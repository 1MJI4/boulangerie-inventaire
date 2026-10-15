// node --test src/lib/erreurBase.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKS_REPERTORIES, CODES_LEVES_PAR_LA_BASE, corpsClient, diagnostiquer, lireRefusBase, lireViolationCheck,
  reponseEchec, statutHttp, traiterErreur,
  type Diagnostic,
} from './erreurBase.ts';
import { CATALOGUE, messagePour } from '../domaine/messages.ts';
import { formaterEuros } from '../domaine/argent.ts';
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
  // Clé étrangère sur une contrainte non répertoriée : l'élément visé n'existe pas.
  ['P2003', erreur('PrismaClientKnownRequestError', 'Foreign key', 'P2003'), 'ERR_DONNEE_INTROUVABLE'],
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
  assert.equal(statutHttp({ code: 'ERR_PRODUIT_INCONNU' }), 422);
  assert.equal(statutHttp({ code: 'ERR_TROP_DE_TENTATIVES' }), 429);
  assert.equal(statutHttp({ code: 'ERR_CODE_INCORRECT' }), 403);
  assert.equal(statutHttp({ code: 'ERR_ORIGINE_REFUSEE' }), 403);
  assert.equal(statutHttp({ code: 'ERR_SESSION_EXPIREE' }), 401);
  assert.equal(statutHttp({ code: 'ERR_CATALOGUE_ABSENT' }), 503);
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

type CasBase = {
  code: string; sqlstate: string; detail: string; hint: string; champ?: string;
  /** Texte attendu, ou fonction de la référence courte (pannes de configuration). */
  message: string | ((reference: string) => string);
  statut?: number; valeurProposee?: unknown;
};

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
  // --- Lot 2 : commandes et règlement (migration 20261015140000) ---
  { code: 'ERR_COMMANDE_LENDEMAIN', sqlstate: 'P0001', detail: 'Retrait 2026-10-16, premier jour ouvert suivant 2026-10-16.', hint: 'champ=retraitLe', champ: 'retraitLe',
    message: messagePour('ERR_COMMANDE_LENDEMAIN', {}) },
  { code: 'ERR_DATE_PASSEE', sqlstate: 'P0001', detail: 'Retrait 2026-10-14, saisie 2026-10-15.', hint: 'champ=retraitLe', champ: 'retraitLe',
    message: messagePour('ERR_DATE_PASSEE', {}) },
  { code: 'ERR_ACOMPTE_INSUFFISANT', sqlstate: 'P0001', detail: 'minimum=1050;pourcentage=30', hint: 'champ=acompte', champ: 'acompte',
    message: messagePour('ERR_ACOMPTE_INSUFFISANT', { minimumFormate: formaterEuros(1050), pourcentage: 30 }), valeurProposee: 1050 },
  { code: 'ERR_ACOMPTE_SUPERIEUR_TOTAL', sqlstate: 'P0001', detail: 'Acompte 5000 centimes, total 3500 centimes.', hint: 'champ=acompte', champ: 'acompte',
    message: messagePour('ERR_ACOMPTE_SUPERIEUR_TOTAL', {}) },
  { code: 'ERR_TOTAL_INCOHERENT', sqlstate: 'P0001', detail: 'Total 9000 centimes, tarif 8000 centimes.', hint: 'champ=total', champ: 'total',
    message: messagePour('ERR_TOTAL_INCOHERENT', {}) },
  { code: 'ERR_REMISE_NON_AUTORISEE', sqlstate: 'P0001', detail: 'Total du tarif : 8000 centimes.', hint: 'champ=total', champ: 'total',
    message: messagePour('ERR_REMISE_NON_AUTORISEE', {}) },
  { code: 'ERR_QUANTITE_MIN', sqlstate: 'P0001', detail: 'minimum=20', hint: 'champ=quantite', champ: 'quantite',
    message: messagePour('ERR_QUANTITE_MIN', { minimum: 20 }), valeurProposee: 20 },
  { code: 'ERR_NB_SYMBOLES_MANQUANT', sqlstate: 'P0001', detail: 'Nombre de chiffres ou lettres absent.', hint: 'champ=nbSymboles', champ: 'nbSymboles',
    message: messagePour('ERR_NB_SYMBOLES_MANQUANT', {}) },
  { code: 'ERR_DROIT_INSUFFISANT', sqlstate: 'P0001', detail: 'Prix d\'une ligne libre fixe sans accord du gerant.', hint: 'champ=prixCentimes', champ: 'prixCentimes',
    message: messagePour('ERR_DROIT_INSUFFISANT', {}), statut: 403 },
  { code: 'ERR_MONTANT_NUL', sqlstate: 'P0001', detail: 'Ligne libre sans prix.', hint: 'champ=prixCentimes', champ: 'prixCentimes',
    message: messagePour('ERR_MONTANT_NUL', {}) },
  // Réglage absent : aucun champ pointé (l'employé n'y peut rien), 500, référence citée.
  { code: 'ERR_CONFIGURATION_SERVEUR', sqlstate: 'P0001', detail: 'Reglage reglement:acompte_min_pourcent absent ou illisible.', hint: 'champ=acompte',
    message: (reference) => messagePour('ERR_CONFIGURATION_SERVEUR', { reference }), statut: 500 },
];

test('chaque code levé par la base a un cas de test et une entrée au catalogue', () => {
  assert.deepEqual(CAS_BASE.map((c) => c.code).sort(), [...CODES_LEVES_PAR_LA_BASE].sort());
  for (const code of CODES_LEVES_PAR_LA_BASE) assert.ok(code in CATALOGUE, code);
});

function verifierRefus(
  d: Diagnostic,
  attendu: { code: string; message: string | ((reference: string) => string); champ?: string; statut?: number; valeurProposee?: unknown },
  statut: number,
) {
  const message = typeof attendu.message === 'function' ? attendu.message(d.reference) : attendu.message;
  assert.equal(d.ok, false);
  assert.equal(d.niveau, 'bloquant');
  assert.equal(d.code, attendu.code);
  assert.equal(d.message, message);
  assert.equal(d.error, message, 'compatibilité .error');
  assert.equal(d.erreur, message, 'compatibilité .erreur');
  assert.equal(d.champ, attendu.champ);
  assert.equal(d.valeurProposee, attendu.valeurProposee);
  assert.equal(statut, attendu.statut ?? 422);
  assert.doesNotMatch(d.message, /undefined|NaN|\(\)/);
  assert.doesNotMatch(JSON.stringify(d), INTERDITS_SQL);
  assert.doesNotMatch(JSON.stringify(d), INTERDITS);
}

for (const c of CAS_BASE) {
  test(`déclencheur ${c.code} (SQLSTATE ${c.sqlstate}) → message du catalogue, champ ${c.champ ?? 'aucun'}, ${c.statut ?? 422}`, () => {
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

test('P2002 sur Produit.nom (contrainte @unique) : doublon de produit, 422', () => {
  const retablir = definirDestination(() => {});
  try {
    for (const target of [['nom'], 'Produit_nom_key']) {
      const e = connue('Unique constraint failed on the fields: (`nom`)', 'P2002', { modelName: 'Produit', target });
      const { corps, statut } = traiterErreur(e);
      verifierRefus(corps, { code: 'ERR_PRODUIT_EN_DOUBLE', message: messagePour('ERR_PRODUIT_EN_DOUBLE', {}), champ: 'nom' }, statut);
    }
    // Autre modèle, ou cible inconnue : doublon générique.
    const autre = connue('Unique constraint failed', 'P2002', { modelName: 'Commande', target: ['numero'] });
    assert.equal(traiterErreur(autre).corps.code, 'ERR_DEJA_ENREGISTRE');
    const inconnue = connue('Unique constraint failed on the (not available)', 'P2002', { modelName: 'Produit', target: '(not available)' });
    assert.equal(traiterErreur(inconnue).corps.code, 'ERR_DEJA_ENREGISTRE');
  } finally {
    retablir();
  }
});

// ---------------------------------------------------------------------------
// Clés étrangères (P2003) — LOI 10 : inventaire et catalogue séparés
// ---------------------------------------------------------------------------

const CAS_FK: [string, Record<string, unknown>, string, string, number][] = [
  ['Inventaire (moteur natif)', { modelName: 'Inventaire', field_name: 'Inventaire_produitId_fkey (index)' }, 'ERR_PRODUIT_INCONNU', 'produitId', 422],
  ['Releve (adaptateur)', { modelName: 'Releve', constraint: 'Releve_produitId_fkey' }, 'ERR_PRODUIT_INCONNU', 'produitId', 422],
  ['LigneCommande → ProduitCatalogue', { field_name: 'LigneCommande_produitCatalogueId_fkey (index)' }, 'ERR_PRODUIT_INCONNU', 'produitCatalogueId', 422],
  ['PrixProduit → ProduitCatalogue', { field_name: 'PrixProduit_produitId_fkey (index)' }, 'ERR_PRODUIT_INCONNU', 'produitId', 422],
  ['LigneCommande → PrixProduit', { field_name: 'LigneCommande_prixProduitId_fkey (index)' }, 'ERR_TARIF_INCOHERENT', 'prixProduitId', 422],
  ['LigneCommande → Commande', { field_name: 'LigneCommande_commandeId_fkey (index)' }, 'ERR_DONNEE_INTROUVABLE', 'commandeId', 404],
];

for (const [nom, meta, code, champ, statutAttendu] of CAS_FK) {
  test(`P2003 ${nom} → ${code}, champ ${champ}, ${statutAttendu}`, () => {
    const lignes: LigneJournal[] = [];
    const retablir = definirDestination((l) => lignes.push(l));
    try {
      const e = connue('Invalid `prisma.releve.create()` invocation: { data: { nomClient: "Dupont" } } Foreign key constraint violated', 'P2003', meta);
      const { corps, statut } = traiterErreur(e, 'POST /api/test');
      assert.equal(corps.code, code);
      assert.equal(corps.champ, champ);
      assert.equal(statut, statutAttendu);
      assert.doesNotMatch(JSON.stringify(corps), INTERDITS);
      assert.doesNotMatch(JSON.stringify(corps), /fkey/);
      assert.equal(lignes.length, 1);
      assert.equal(lignes[0].code, code);
      assert.match(lignes[0].piste ?? '', /_fkey/);
      assert.ok(!JSON.stringify(lignes[0]).includes('Dupont'));
    } finally {
      retablir();
    }
  });
}

test('P2003 inventaire : le message dit que le produit manque à la liste d’inventaire et quoi faire', () => {
  const retablir = definirDestination(() => {});
  try {
    const e = connue('Foreign key constraint violated', 'P2003', { field_name: 'Inventaire_produitId_fkey (index)' });
    const { corps } = traiterErreur(e);
    assert.equal(corps.message, messagePour('ERR_PRODUIT_INCONNU', { liste: 'inventaire' }));
    assert.match(corps.message, /liste d’inventaire.*Choisissez/);
    // Pilote pg direct (SQLSTATE 23503, nom de contrainte en propriété).
    const pg = Object.assign(new Error('insert or update violates foreign key constraint'), { code: '23503', constraint: 'Releve_produitId_fkey' });
    assert.equal(traiterErreur(pg).corps.code, 'ERR_PRODUIT_INCONNU');
    assert.equal(traiterErreur(pg).statut, 422);
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

// ---------------------------------------------------------------------------
// Lot 2 : paramètres tirés du DETAIL (acompte, minimum) — absents ou illisibles
// ---------------------------------------------------------------------------

test('DETAIL absent ou illisible : variante générique, champ par défaut, pas de valeur proposée', () => {
  const retablir = definirDestination(() => {});
  try {
    for (const detail of [null, 'minimum=abc;pourcentage=', 'texte libre']) {
      const a = diagnostiquer(erreurDeclencheur('P0001', 'ERR_ACOMPTE_INSUFFISANT', detail, null));
      assert.equal(a.code, 'ERR_ACOMPTE_INSUFFISANT');
      assert.equal(a.message, messagePour('ERR_ACOMPTE_INSUFFISANT', {}));
      assert.equal(a.champ, 'acompte');
      assert.equal(a.valeurProposee, undefined);
      assert.doesNotMatch(a.message, /undefined|NaN/);

      const q = diagnostiquer(erreurDeclencheur('P0001', 'ERR_QUANTITE_MIN', detail, null));
      assert.equal(q.message, messagePour('ERR_QUANTITE_MIN', {}));
      assert.equal(q.champ, 'quantite');
      assert.equal(q.valeurProposee, undefined);
    }
    // Pourcentage seul : cité ; minimum seul : proposé.
    const p = diagnostiquer(erreurDeclencheur('P0001', 'ERR_ACOMPTE_INSUFFISANT', 'pourcentage=30', 'champ=acompte'));
    assert.equal(p.message, messagePour('ERR_ACOMPTE_INSUFFISANT', { pourcentage: 30 }));
    const m = diagnostiquer(erreurDeclencheur('P0001', 'ERR_ACOMPTE_INSUFFISANT', 'minimum=2000', 'champ=acompte'));
    assert.equal(m.valeurProposee, 2000);
    assert.ok(m.message.includes(formaterEuros(2000)));
    // Tous les nouveaux codes, sans DETAIL ni HINT : champ par défaut.
    const defauts: Record<string, string | undefined> = {
      ERR_COMMANDE_LENDEMAIN: 'retraitLe', ERR_DATE_PASSEE: 'retraitLe', ERR_ACOMPTE_SUPERIEUR_TOTAL: 'acompte',
      ERR_TOTAL_INCOHERENT: 'total', ERR_REMISE_NON_AUTORISEE: 'total', ERR_NB_SYMBOLES_MANQUANT: 'nbSymboles',
      ERR_DROIT_INSUFFISANT: 'prixCentimes', ERR_MONTANT_NUL: 'prixCentimes', ERR_CONFIGURATION_SERVEUR: undefined,
    };
    for (const [code, champ] of Object.entries(defauts)) {
      const d = diagnostiquer(erreurDeclencheur('P0001', code, null, null));
      assert.equal(d.code, code);
      assert.equal(d.champ, champ, code);
      assert.doesNotMatch(d.message, /undefined|NaN|\(\)/, code);
    }
  } finally {
    retablir();
  }
});

test('requête brute P2010 : ERR_ACOMPTE_INSUFFISANT avec DETAIL texte PostgreSQL', () => {
  const retablir = definirDestination(() => {});
  try {
    const texte = 'ERROR: ERR_ACOMPTE_INSUFFISANT\nDETAIL: minimum=1050;pourcentage=30\nHINT: champ=acompte';
    const { corps, statut } = traiterErreur(connue(`Raw query failed. Code: \`P0001\`. Message: \`${texte}\``, 'P2010', { code: 'P0001', message: texte }));
    verifierRefus(corps, CAS_BASE.find((c) => c.code === 'ERR_ACOMPTE_INSUFFISANT')!, statut);
  } finally {
    retablir();
  }
});

// ---------------------------------------------------------------------------
// Contraintes CHECK (SQLSTATE 23514)
// ---------------------------------------------------------------------------

/** Forme réelle Prisma 6 (moteur natif) d'une violation de CHECK sur une requête de modèle. */
function erreurCheck(contrainte: string, table = 'Commande') {
  const e = new Error(
    '\nInvalid `prisma.commande.create()` invocation:\n\n\n' +
      'Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(' +
      `PostgresError { code: "23514", message: "new row for relation \\"${table}\\" violates check constraint \\"${contrainte}\\"", ` +
      'severity: "ERROR", detail: Some("Failing row contains (12, Dupont, 0470123456, 2026-10-16, 25:99)."), column: None, hint: None }' +
      '), transient: false })',
  ) as Error & { clientVersion?: string };
  e.name = 'PrismaClientUnknownRequestError';
  e.clientVersion = '6.18.0';
  return e;
}

type CasCheck = { contrainte: string; code: string; champ?: string; message: string | ((reference: string) => string); statut: number };

const CAS_CHECK: CasCheck[] = [
  { contrainte: 'Commande_retrait_heure_format', code: 'ERR_SAISIE_INVALIDE', champ: 'retraitHeure',
    message: messagePour('ERR_SAISIE_INVALIDE', { champLibelle: 'heure de retrait' }), statut: 422 },
  { contrainte: 'Commande_accord_lendemain_trace', code: 'ERR_DROIT_INSUFFISANT', champ: 'retraitLe',
    message: messagePour('ERR_DROIT_INSUFFISANT', {}), statut: 403 },
  { contrainte: 'Commande_remise_trace', code: 'ERR_DROIT_INSUFFISANT', champ: 'total',
    message: messagePour('ERR_DROIT_INSUFFISANT', {}), statut: 403 },
  { contrainte: 'Commande_total_convenu', code: 'ERR_REMISE_NON_AUTORISEE', champ: 'total',
    message: messagePour('ERR_REMISE_NON_AUTORISEE', {}), statut: 422 },
  { contrainte: 'Commande_acompte_max_total', code: 'ERR_ACOMPTE_SUPERIEUR_TOTAL', champ: 'acompte',
    message: messagePour('ERR_ACOMPTE_SUPERIEUR_TOTAL', {}), statut: 422 },
  { contrainte: 'LigneCommande_ligne_libre_trace', code: 'ERR_DROIT_INSUFFISANT', champ: 'prixCentimes',
    message: messagePour('ERR_DROIT_INSUFFISANT', {}), statut: 403 },
  { contrainte: 'LigneCommande_deverrouillage_trace', code: 'ERR_DROIT_INSUFFISANT', champ: 'prixCentimes',
    message: messagePour('ERR_DROIT_INSUFFISANT', {}), statut: 403 },
  { contrainte: 'LigneCommande_deverrouillage_nom_non_vide', code: 'ERR_SAISIE_INVALIDE', champ: 'sousPlancherAutorisePar',
    message: messagePour('ERR_SAISIE_INVALIDE', { champLibelle: 'nom du gérant' }), statut: 422 },
  { contrainte: 'LigneCommande_nbObjets_positif', code: 'ERR_QUANTITE_INVALIDE', champ: 'nbObjets',
    message: messagePour('ERR_QUANTITE_INVALIDE', { unite: 'piece' }), statut: 422 },
  { contrainte: 'LigneCommande_nbSymboles_positif', code: 'ERR_SAISIE_INVALIDE', champ: 'nbSymboles',
    message: messagePour('ERR_SAISIE_INVALIDE', { champLibelle: 'chiffres ou lettres' }), statut: 422 },
  { contrainte: 'Reglage_reglement_valide', code: 'ERR_CONFIGURATION_SERVEUR',
    message: (reference) => messagePour('ERR_CONFIGURATION_SERVEUR', { reference }), statut: 500 },
];

test('chaque CHECK répertorié a un cas de test', () => {
  assert.deepEqual(CAS_CHECK.map((c) => c.contrainte).sort(), [...CHECKS_REPERTORIES].sort());
});

for (const c of CAS_CHECK) {
  test(`CHECK ${c.contrainte} (23514) → ${c.code}, champ ${c.champ ?? 'aucun'}, ${c.statut}`, () => {
    const lignes: LigneJournal[] = [];
    const retablir = definirDestination((l) => lignes.push(l));
    try {
      const { corps, statut } = traiterErreur(erreurCheck(c.contrainte), 'POST /api/commandes');
      verifierRefus(corps, c, statut);
      // Le nom de contrainte ne va qu'au journal.
      assert.ok(!JSON.stringify(corps).includes(c.contrainte));
      assert.doesNotMatch(JSON.stringify(corps), /23514|check|constraint|_trace|Failing/i);
      assert.equal(lignes.length, 1);
      assert.equal(lignes[0].code, c.code);
      assert.equal(lignes[0].reference, corps.reference);
      assert.ok((lignes[0].piste ?? '').includes(c.contrainte));
      // « Failing row contains (…) » recopie la ligne : jamais journalisé.
      const journal = JSON.stringify(lignes[0]);
      assert.ok(!journal.includes('Dupont'));
      assert.ok(!journal.includes('0470123456'));
      assert.ok(!journal.includes('Failing row'));
    } finally {
      retablir();
    }
  });
}

test('CHECK : requête brute (P2010) et pilote pg direct', () => {
  const retablir = definirDestination(() => {});
  try {
    const brut = connue('Raw query failed. Code: `23514`. Message: `new row for relation "Commande" violates check constraint "Commande_total_convenu"`',
      'P2010', { code: '23514', message: 'new row for relation "Commande" violates check constraint "Commande_total_convenu"' });
    const a = traiterErreur(brut);
    verifierRefus(a.corps, { code: 'ERR_REMISE_NON_AUTORISEE', message: messagePour('ERR_REMISE_NON_AUTORISEE', {}), champ: 'total' }, a.statut);

    const pg = Object.assign(new Error('new row for relation "LigneCommande" violates check constraint "LigneCommande_nbObjets_positif"'),
      { code: '23514', constraint: 'LigneCommande_nbObjets_positif', detail: 'Failing row contains (Dupont).' });
    const b = traiterErreur(pg);
    verifierRefus(b.corps, { code: 'ERR_QUANTITE_INVALIDE', message: messagePour('ERR_QUANTITE_INVALIDE', { unite: 'piece' }), champ: 'nbObjets' }, b.statut);
  } finally {
    retablir();
  }
});

test('CHECK inconnu → ERR_SAISIE_INVALIDE générique, 422, nom au journal seulement', () => {
  const lignes: LigneJournal[] = [];
  const retablir = definirDestination((l) => lignes.push(l));
  try {
    const { corps, statut } = traiterErreur(erreurCheck('Commande_nouvelle_regle_xyz'), 'POST /api/commandes');
    verifierRefus(corps, { code: 'ERR_SAISIE_INVALIDE', message: messagePour('ERR_SAISIE_INVALIDE', {}) }, statut);
    assert.ok(!JSON.stringify(corps).includes('Commande_nouvelle_regle_xyz'));
    assert.match(lignes[0].piste ?? '', /Commande_nouvelle_regle_xyz.*non répertoriée/);
    // Sans nom lisible : toujours générique.
    const sansNom = connue('Raw query failed', 'P2010', { code: '23514', message: 'check violation' });
    assert.equal(lireViolationCheck(sansNom)?.code, 'ERR_SAISIE_INVALIDE');
    // Bug ordinaire qui parle de « check constraint », ou refus P0001 : pas un CHECK.
    assert.equal(lireViolationCheck(new Error('violates check constraint "Commande_total_convenu"')), null);
    assert.equal(lireViolationCheck(erreurDeclencheur('P0001', 'ERR_JOUR_FERME', null, null)), null);
  } finally {
    retablir();
  }
});
