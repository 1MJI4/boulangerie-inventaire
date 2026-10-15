// node --test src/lib/journal.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MASQUE,
  cleSensible,
  definirDestination,
  journaliser,
  nettoyer,
  nettoyerTexte,
  nouvelleReference,
  type LigneJournal,
} from './journal.ts';

/** Fabrique une erreur au profil d'une PrismaClientKnownRequestError, sans Prisma. */
function erreurPrisma(code: string, message: string, meta?: Record<string, unknown>) {
  const e = new Error(message) as Error & { code: string; meta?: unknown; clientVersion: string };
  e.name = 'PrismaClientKnownRequestError';
  e.code = code;
  e.meta = meta;
  e.clientVersion = '6.18.0';
  return e;
}

function capturer(): { lignes: LigneJournal[]; retablir: () => void } {
  const lignes: LigneJournal[] = [];
  const retablir = definirDestination((l) => lignes.push(l));
  return { lignes, retablir };
}

test('clés sensibles masquées, y compris variantes et accents', () => {
  for (const cle of ['nom', 'nomClient', 'client_nom', 'prénom', 'telephone', 'téléphoneClient', 'tel', 'email', 'adresse', 'notes', 'motDePasse', 'codeGestion', 'token', 'DATABASE_URL', 'cookie']) {
    assert.equal(cleSensible(cle), true, cle);
  }
  for (const cle of ['code', 'route', 'quantite', 'produitId', 'dateRetrait', 'modelName', 'target', 'reference']) {
    assert.equal(cleSensible(cle), false, cle);
  }
});

test('nettoyer : objet de commande → aucune donnée client ne subsiste', () => {
  const commande = {
    id: 'c1',
    nomClient: 'Dupont',
    telephone: '0470 12 34 56',
    lignes: [{ produitId: 'p1', quantite: 20, note: 'Joyeux anniversaire Sarah' }],
    client: { nom: 'Dupont', email: 'a@b.be' },
  };
  const propre = nettoyer(commande);
  const texte = JSON.stringify(propre);
  for (const interdit of ['Dupont', '0470', 'Sarah', 'a@b.be']) assert.ok(!texte.includes(interdit), interdit);
  assert.deepEqual(propre, {
    id: 'c1',
    nomClient: MASQUE,
    telephone: MASQUE,
    lignes: [{ produitId: 'p1', quantite: 20, note: MASQUE }],
    client: MASQUE,
  });
  // L'original n'est pas modifié.
  assert.equal(commande.nomClient, 'Dupont');
});

test('nettoyerTexte : téléphone, e-mail, chaîne de connexion, valeurs entre guillemets', () => {
  const t = nettoyerTexte(
    'appel +32 470 12 34 56 ou 0470/12.34.56, mail jean.dupont@exemple.be, ' +
      'base postgresql://postgres:MotDePasse@db.x.supabase.co:6543/postgres, nom "Dupont" \'Sarah\'',
  );
  for (const interdit of ['470', 'jean.dupont', 'MotDePasse', 'supabase.co', 'Dupont', 'Sarah']) {
    assert.ok(!t.includes(interdit), `${interdit} dans ${t}`);
  }
});

test('nettoyerTexte : une date jj/mm/aaaa et un ISO ne sont pas pris pour un téléphone', () => {
  assert.equal(nettoyerTexte('retrait le 05/10/2026'), 'retrait le 05/10/2026');
  assert.equal(nettoyerTexte('2026-10-15T15:02:00.000Z'), '2026-10-15T15:02:00.000Z');
});

test('nettoyerTexte tronque les textes très longs', () => {
  assert.ok(nettoyerTexte('x'.repeat(5000)).length <= 301);
});

test('erreur Prisma : le message (qui embarque les valeurs) n’est jamais recopié', () => {
  const e = erreurPrisma(
    'P2002',
    'Invalid `prisma.commande.create()` invocation:\n{ data: { nomClient: "Dupont", telephone: "0470123456" } }\nUnique constraint failed',
    { modelName: 'Commande', target: ['telephone'] },
  );
  const r = nettoyer(e) as Record<string, unknown>;
  const texte = JSON.stringify(r);
  assert.ok(!texte.includes('Dupont'));
  assert.ok(!texte.includes('0470123456'));
  assert.ok(!('message' in r) || r.message === undefined);
  assert.equal(r.code, 'P2002');
  assert.equal(r.name, 'PrismaClientKnownRequestError');
  assert.deepEqual(r.meta, { modelName: 'Commande', target: ['telephone'], field_name: undefined });
});

test('erreur ordinaire : message nettoyé, pile limitée aux lignes « at »', () => {
  const e = new Error('Échec pour 0470 12 34 56');
  const r = nettoyer(e) as { message: string; pile: string[] };
  assert.ok(!r.message.includes('0470'));
  assert.ok(r.pile.every((l) => l.startsWith('at ')));
  assert.ok(r.pile.length <= 5);
});

test('structures circulaires ou profondes : pas de boucle infinie', () => {
  const a: Record<string, unknown> = { id: 1 };
  a.soi = a;
  assert.doesNotThrow(() => nettoyer(a));
});

test('journaliser : ligne horodatée, filtrée, référence conservée', () => {
  const { lignes, retablir } = capturer();
  try {
    const ligne = journaliser({
      niveau: 'erreur',
      code: 'ERR_INATTENDUE',
      route: 'POST /api/commandes',
      reference: 'K7Q-3MD',
      utilisateur: 'profil-12',
      detail: { nomClient: 'Dupont', erreur: erreurPrisma('P2025', 'Record "Dupont" not found') },
    });
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0], ligne);
    assert.match(ligne.horodatage, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(ligne.reference, 'K7Q-3MD');
    assert.ok(!JSON.stringify(ligne).includes('Dupont'));
  } finally {
    retablir();
  }
});

test('journaliser ne lève jamais, même si la destination plante', () => {
  const retablir = definirDestination(() => {
    throw new Error('disque plein');
  });
  const erreurOrig = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => journaliser({ niveau: 'erreur', code: 'ERR_X' }));
  } finally {
    console.error = erreurOrig;
    retablir();
  }
});

test('nouvelleReference : 7 caractères lisibles au téléphone', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(nouvelleReference(), /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/);
  }
});
