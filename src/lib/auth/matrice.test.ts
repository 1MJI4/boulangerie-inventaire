// node --test src/lib/auth/matrice.test.ts
//
// 1. Le code des routes correspond à la matrice déclarée (vérification du texte
//    source : chaque handler commence par `exigerRole` avec le bon rôle).
// 2. La matrice produit le bon verdict pour chaque rôle (appel réel du garde).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATRICE_ACCES, type Methode } from './matrice.ts';
import { ROLES, aLeRole, type Role } from './roles.ts';
import { DUREES, cleDeSignature, creerJeton, signerJeton } from './session.ts';
import { NOM_COOKIE_GERANT, NOM_COOKIE_TABLETTE } from './config.ts';
import { exigerRole } from './garde.ts';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
// Valeurs de test, sans rapport avec la production.
const SECRET = 'secret-de-test-suffisamment-long-0123456789';
const CODE_T = 'tablette-test-1234';
const CODE_G = 'gerant-test-5678';
process.env.SESSION_SECRET = SECRET;
process.env.CODE_TABLETTE = CODE_T;
process.env.CODE_GESTION = CODE_G;
const CLE_T = cleDeSignature('tablette', SECRET, CODE_T)!;
const CLE_G = cleDeSignature('gerant', SECRET, CODE_G)!;
const APPAREIL = 'tablette-test-01';

function routesApi(dossier = join(RACINE, 'src', 'app', 'api')): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...routesApi(chemin));
    else if (nom === 'route.ts') sortie.push(relative(RACINE, chemin).split(sep).join('/'));
  }
  return sortie;
}

function handlers(source: string): Map<Methode, string> {
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\(([^)]*)\)[^{]*\{/g;
  const debuts: { methode: Methode; corps: number }[] = [];
  for (const m of source.matchAll(re)) {
    debuts.push({ methode: m[1] as Methode, corps: (m.index ?? 0) + m[0].length });
  }
  const sortie = new Map<Methode, string>();
  debuts.forEach((d, i) => {
    const fin = i + 1 < debuts.length ? debuts[i + 1].corps : source.length;
    sortie.set(d.methode, source.slice(d.corps, fin));
  });
  return sortie;
}

test('chaque route API figure dans la matrice, et réciproquement', () => {
  assert.deepEqual(routesApi().sort(), Object.keys(MATRICE_ACCES).sort());
});

for (const [fichier, methodes] of Object.entries(MATRICE_ACCES)) {
  test(`${fichier} : le code applique la matrice`, () => {
    const source = readFileSync(join(RACINE, fichier), 'utf8');
    if (!fichier.includes('cloudprnt')) {
      assert.doesNotMatch(source, /codeSecurite|codeValide|process\.env/, 'code lu hors du module auth');
    }
    const trouves = handlers(source);
    assert.deepEqual([...trouves.keys()].sort(), Object.keys(methodes).sort(), 'méthodes exportées');

    for (const [methode, corps] of trouves) {
      const attendu = methodes[methode]!;
      if (attendu.role === 'cle') {
        assert.doesNotMatch(corps, /exigerRole/);
        assert.match(corps, /^\s*const \{ cle \} = await params;\s*if \(!cleValide\(cle\)\)/, `${methode} : clé vérifiée en premier`);
        continue;
      }
      const m = corps.match(/^\s*(?:\/\/[^\n]*\n\s*)*const garde = exigerRole\(\s*\w+\s*,\s*'(\w+)'/);
      assert.ok(m, `${methode} : exigerRole doit être la première instruction`);
      assert.equal(m[1], attendu.role, `${methode} : rôle exigé`);
      assert.match(corps, /if \(!garde\.ok\) return garde\.reponse;/, `${methode} : refus renvoyé`);
    }
  });
}

test('vendeur et auteur : déclarés par la tablette, nettoyés, hypothèse marquée', () => {
  const source = readFileSync(join(RACINE, 'src/app/api/commandes/route.ts'), 'utf8');
  assert.match(source, /const vendeur = nomDeclare\(corps\.vendeur\)/);
  assert.match(source, /const auteur = nomDeclare\(corps\.auteur\)/);
  const marques = source.match(
    /HYPOTHÈSE À VALIDER : identité déclarée par la tablette, pas de compte individuel \(décision 15\/10\/2026\)/g
  );
  assert.equal(marques?.length, 2);
});

/** Requête avec un cookie tablette et, pour `gerant`, un cookie gérant. */
function requeteAvec(role: Role | null, options: { appareilGerant?: string; gerantA?: number } = {}): Request {
  const entetes = new Headers();
  if (role) {
    const maintenant = Date.now();
    const tablette = signerJeton(creerJeton('tablette', APPAREIL, maintenant), CLE_T);
    const morceaux = ['autre=1', `${NOM_COOKIE_TABLETTE}=${tablette}`];
    if (role === 'gerant') {
      const g = creerJeton('gerant', options.appareilGerant ?? APPAREIL, options.gerantA ?? maintenant);
      morceaux.push(`${NOM_COOKIE_GERANT}=${signerJeton(g, CLE_G)}`);
    }
    entetes.set('cookie', morceaux.join('; '));
  }
  return new Request('https://exemple.test/api/x', { headers: entetes });
}

test('matrice tablette / gérant : verdict du garde sur chaque route et chaque méthode', async () => {
  for (const [fichier, methodes] of Object.entries(MATRICE_ACCES)) {
    for (const [methode, entree] of Object.entries(methodes)) {
      if (!entree || entree.role === 'cle') continue;
      const requis = entree.role;

      const anonyme = exigerRole(requeteAvec(null), requis, entree.action);
      assert.equal(anonyme.ok, false);
      if (!anonyme.ok) {
        assert.equal(anonyme.statut, 401, `${fichier} ${methode} sans tablette`);
        assert.equal(anonyme.echec.code, 'ERR_SESSION_EXPIREE');
      }

      for (const role of ROLES) {
        const g = exigerRole(requeteAvec(role), requis, entree.action);
        assert.equal(g.ok, aLeRole(role, requis), `${fichier} ${methode} en ${role}`);
        if (!g.ok) {
          assert.equal(g.statut, 403);
          assert.equal(g.echec.code, 'ERR_DROIT_INSUFFISANT');
          const corps = await g.reponse.json();
          assert.equal(corps.code, 'ERR_DROIT_INSUFFISANT');
          assert.match(corps.message, /Seul le gérant peut/);
          assert.equal(corps.error, corps.message, 'champ lu par les écrans existants');
          assert.doesNotMatch(JSON.stringify(corps), /stack|secret|gerant-test|tablette-test|at \w+ \(/i);
        }
      }
    }
  }
});

test('écritures sensibles réservées au gérant, tout le reste ouvert à la tablette', () => {
  const gerantSeulement = new Set([
    'src/app/api/tarifs/route.ts PATCH',
    'src/app/api/tarifs/route.ts POST',
    'src/app/api/produits/route.ts POST',
    'src/app/api/produits/route.ts PUT',
    'src/app/api/produits/route.ts DELETE',
    'src/app/api/produits/reorganiser/route.ts PUT',
    'src/app/api/gateaux/route.ts POST',
    'src/app/api/gateaux/route.ts PATCH',
  ]);
  for (const [fichier, methodes] of Object.entries(MATRICE_ACCES)) {
    for (const [methode, entree] of Object.entries(methodes)) {
      if (!entree || entree.role === 'cle') continue;
      const attendu = gerantSeulement.has(`${fichier} ${methode}`) ? 'gerant' : 'tablette';
      assert.equal(entree.role, attendu, `${fichier} ${methode}`);
    }
  }
});

test('élévation gérant : liée à la tablette, expirée après 30 min sans action', () => {
  assert.equal(exigerRole(requeteAvec('gerant'), 'gerant').ok, true);
  // Cookie gérant obtenu sur une AUTRE tablette : refusé.
  const volee = exigerRole(requeteAvec('gerant', { appareilGerant: 'une-autre-tablette' }), 'gerant');
  assert.equal(volee.ok, false);
  if (!volee.ok) assert.equal(volee.statut, 403);
  // Cookie gérant trop ancien : refusé ; la tablette, elle, reste ouverte.
  const r = requeteAvec('gerant', { gerantA: Date.now() - DUREES.gerant.inactiviteMs - 1000 });
  assert.equal(exigerRole(r, 'gerant').ok, false);
  assert.equal(exigerRole(r, 'tablette').ok, true);
});

test('réglages absents ou trop courts : on échoue fermé (503 ERR_CONFIGURATION_SERVEUR)', async () => {
  const cas: [string, string | undefined, Role, string][] = [
    ['SESSION_SECRET', undefined, 'tablette', 'CONF-SESSION'],
    ['SESSION_SECRET', 'trop-court', 'tablette', 'CONF-SESSION'],
    ['CODE_TABLETTE', undefined, 'tablette', 'CONF-TABLETTE'],
    ['CODE_TABLETTE', '1234567', 'tablette', 'CONF-TABLETTE'],
    ['CODE_GESTION', '1234', 'gerant', 'CONF-GESTION'],
    ['CODE_GESTION', undefined, 'gerant', 'CONF-GESTION'],
  ];
  for (const [variable, valeur, requis, reference] of cas) {
    const sauvegarde = process.env[variable];
    if (valeur === undefined) delete process.env[variable];
    else process.env[variable] = valeur;
    try {
      const g = exigerRole(requeteAvec('gerant'), requis);
      assert.equal(g.ok, false, `${variable}=${valeur}`);
      if (!g.ok) {
        assert.equal(g.statut, 503);
        assert.equal(g.echec.code, 'ERR_CONFIGURATION_SERVEUR');
        assert.match((await g.reponse.json()).message, new RegExp(reference));
      }
    } finally {
      process.env[variable] = sauvegarde;
    }
  }
  // Un code gérant trop court ne bloque PAS le travail courant des tablettes.
  const sauvegarde = process.env.CODE_GESTION;
  process.env.CODE_GESTION = '1234';
  try {
    assert.equal(exigerRole(requeteAvec('tablette'), 'tablette').ok, true);
  } finally {
    process.env.CODE_GESTION = sauvegarde;
  }
});

test('changer CODE_TABLETTE déconnecte les tablettes déjà installées', () => {
  const r = requeteAvec('tablette');
  assert.equal(exigerRole(r, 'tablette').ok, true);
  const sauvegarde = process.env.CODE_TABLETTE;
  process.env.CODE_TABLETTE = 'nouveau-code-tablette';
  try {
    const g = exigerRole(r, 'tablette');
    assert.equal(g.ok, false);
    if (!g.ok) assert.equal(g.statut, 401);
  } finally {
    process.env.CODE_TABLETTE = sauvegarde;
  }
});
