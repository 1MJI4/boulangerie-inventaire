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

test('trace de pile : chemins et versions de paquets conservés, vraies adresses toujours masquées', () => {
  const e = new Error('échec');
  e.stack = [
    'Error: échec',
    '    at f (/var/task/node_modules/.pnpm/next@16.0.11_react-dom@19.2.8_react@19.2.8/node_modules/next/dist/server/base-server.js:12:3)',
    '    at g (/app/node_modules/.pnpm/@prisma+client@6.18.0_prisma@6.18.0/node_modules/@prisma/client/runtime/library.js:1:2)',
    '    at h (file:///C:/projet/src/lib/x.ts:4:5)',
    '    at i (/home/jean.dupont@exemple.be/app.js:1:1)',
  ].join('\n');
  const r = nettoyer(e) as { pile: string[] };
  assert.match(r.pile[0], /next@16\.0\.11_react-dom@19\.2\.8.*base-server\.js:12:3/);
  assert.match(r.pile[1], /@prisma\+client@6\.18\.0.*library\.js/);
  assert.match(r.pile[2], /file:\/\/\/C:\/projet\/src\/lib\/x\.ts:4:5/);
  assert.ok(!r.pile.slice(0, 3).join(' ').includes('masqué'), r.pile.join('\n'));
  // Une vraie adresse reste masquée, même dans un chemin.
  assert.ok(!r.pile[3].includes('jean.dupont'), r.pile[3]);
  assert.match(r.pile[3], /\[e-mail masqué\]/);
});

test('e-mails : formes variées toujours masquées (pas d’affaiblissement)', () => {
  for (const adresse of ['jean.dupont@exemple.be', 'J.Dupont+commande@mail.exemple.co.uk', 'a_b-c@x-y.org', 'client@exemple.be.']) {
    const t = nettoyerTexte(`contact ${adresse} fin`);
    assert.ok(!t.includes('@'), `${adresse} → ${t}`);
  }
  // Les chaînes de connexion restent masquées (seul file:// est exempté).
  assert.ok(!nettoyerTexte('postgresql://u:secret@h:5432/b').includes('secret'));
});
