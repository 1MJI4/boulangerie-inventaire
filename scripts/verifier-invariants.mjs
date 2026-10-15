#!/usr/bin/env node
// scripts/verifier-invariants.mjs
//
// Vérifie mécaniquement les trois invariants de CLAUDE.md (+ frontières de
// dépendances). Aucune dépendance npm : Node seul (+ git si disponible).
// Spécification : docs/audits/2026-10-15-architecture.md §6.
//
//   node scripts/verifier-invariants.mjs            bloquant : sortie 1 si violation
//   node scripts/verifier-invariants.mjs --rapport  liste seulement, sortie 0
//   node scripts/verifier-invariants.mjs --indexe   ne lit que le contenu INDEXÉ
//                                                   (git add) — utilisé par le pré-commit
//
// Échappatoire, sur la ligne concernée : `// invariant-ok: <raison>` (raison
// obligatoire). À utiliser avec parcimonie : chaque occurrence se relit.
//
// Fichiers *.test.* : soumis à INV3 seulement (fixtures fictives, sorties
// attendues, messages cités, lecture du CSV) — voir verifierFichier.
//
// Invariants :
//   INV1  aucun littéral de prix hors src/catalogue/** (commentaires compris ; 0 autorisé)
//   INV2  aucune logique de jour hors src/domaine/** (code seulement)
//   INV3  aucune arithmétique flottante sur un montant hors src/domaine/argent.ts ;
//         aucun Float/Decimal sur un prix dans prisma/schema.prisma
//   DEP   src/domaine/** n'importe ni react, ni next, ni @prisma, ni fs ;
//         src/domaine/** et src/lib/inventaire/** n'importent pas src/catalogue (LOI 10) ;
//         aucun nouveau .mjs dans src/lib
//   DATA  toute source de data/ citée (code, CLAUDE.md, registre des versions)
//         est suivie par git

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const MODE_RAPPORT = args.has('--rapport');
const MODE_INDEXE = args.has('--indexe');

const EXTENSIONS = /\.(m?[jt]sx?|cjs)$/;
const ECHAPPATOIRE = /invariant-ok:\s*\S/;

// .mjs historiques tolérés dans src/lib (à migrer, pas à multiplier).
const MJS_LIB_TOLERES = new Set(['src/lib/catalogue.mjs']);

// --------------------------------------------------------------------------
// Fichiers à vérifier

function estCible(f) {
  if (f.startsWith('src/') || f.startsWith('scripts/')) return EXTENSIONS.test(f);
  if (f.startsWith('prisma/')) return /\.mjs$/.test(f) || f === 'prisma/schema.prisma';
  return false;
}

function listerSansGit(dossier, acc = []) {
  for (const nom of readdirSync(join(RACINE, dossier))) {
    const rel = posix.join(dossier, nom);
    if (nom === 'node_modules' || nom.startsWith('.')) continue;
    const st = statSync(join(RACINE, rel));
    if (st.isDirectory()) listerSansGit(rel, acc);
    else acc.push(rel);
  }
  return acc;
}

function git(...a) {
  return execFileSync('git', a, { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function listerFichiers() {
  try {
    if (MODE_INDEXE) {
      return git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
        .split('\0').filter(Boolean);
    }
    // Suivis + nouveaux non ignorés (le pré-commit voit aussi ce qui va être ajouté).
    return git('ls-files', '-co', '--exclude-standard', '-z', '--', 'src', 'scripts', 'prisma')
      .split('\0').filter(Boolean).filter((f) => existsSync(join(RACINE, f)));
  } catch {
    // Pas de git (ex. build en CI sans .git) : parcours du disque.
    return ['src', 'scripts', 'prisma']
      .filter((d) => existsSync(join(RACINE, d)))
      .flatMap((d) => listerSansGit(d));
  }
}

function lire(f) {
  if (MODE_INDEXE) return git('show', `:${f}`);
  return readFileSync(join(RACINE, f), 'utf8');
}

// --------------------------------------------------------------------------
// Séparation code / commentaires, ligne par ligne (lexeur volontairement
// simple : chaînes '"`, commentaires // et /* */ ; suffisant pour nos motifs).

function decouper(texte) {
  const lignes = texte.split(/\r?\n/);
  const sortie = [];
  let dansBloc = false;
  let dansGabarit = false;
  for (const ligne of lignes) {
    let code = '';
    let commentaire = '';
    let i = 0;
    let quote = dansGabarit ? '`' : null;
    while (i < ligne.length) {
      const c = ligne[i];
      const d = ligne[i + 1];
      if (dansBloc) {
        if (c === '*' && d === '/') { dansBloc = false; commentaire += '*/'; i += 2; continue; }
        commentaire += c; i++; continue;
      }
      if (quote) {
        code += c;
        if (c === '\\') { code += d ?? ''; i += 2; continue; }
        if (c === quote) quote = null;
        i++; continue;
      }
      if (c === '/' && d === '/') { commentaire += ligne.slice(i); break; }
      if (c === '/' && d === '*') { dansBloc = true; commentaire += '/*'; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') quote = c;
      code += c; i++;
    }
    dansGabarit = quote === '`';
    sortie.push({ brut: ligne, code, commentaire });
  }
  return sortie;
}

// --------------------------------------------------------------------------
// Règles

const MOTS_MONTANT = /(prix|montant|centimes|euros?|tarif|supplement|suppl[ée]ment|acompte|total|reste|solde|remise)/i;

const INV1 = [
  { re: /\d+[.,]\d{2}\s*€/, zero: /^0+[.,]00\s*€$/, msg: 'montant en euros écrit en dur' },
  { re: /(?<![\w.,])\d+\s*€/, zero: /^0+\s*€$/, msg: 'montant en euros écrit en dur' },
  {
    re: /\b(prix|centimes|montant|supplement|tarif)\w*\s*[:=]\s*\{?\s*[1-9]\d*(?![\w])/i,
    msg: 'prix / montant affecté à un littéral',
  },
  { re: /formatsFixes\s*:\s*\{/, msg: 'formats à prix fixe écrits en dur' },
];

const INV2 = [
  { re: /\bgetDay\s*\(/, msg: 'getDay() hors du domaine' },
  { re: /\bgetUTCDay\s*\(/, msg: 'getUTCDay() hors du domaine' },
  { re: /\bmardi\b/i, msg: '« mardi » hors du domaine' },
  { re: /\btuesday\b/i, msg: '« tuesday » hors du domaine' },
  { re: /\bday\s*[!=]==?\s*[0-6]\b/i, msg: 'test de jour de semaine hors du domaine' },
  { re: /\bJOURS_FERMETURE\b/, msg: 'JOURS_FERMETURE hors du domaine' },
];

const INV3 = [
  { re: /\bparseFloat\s*\(/, msg: 'parseFloat — passer par lireMontant / les helpers centimes' },
  { re: /\.toFixed\s*\(/, msg: 'toFixed — passer par formaterEuros' },
  {
    re: /([/*]\s*100\b|\b100\s*\*)/,
    siLigne: MOTS_MONTANT,
    // `(a / b) * 100` est un POURCENTAGE (progression, taux de vente), pas un montant.
    sauf: /\/[^/()]*\)\s*\*\s*100\b/,
    msg: '×/÷ 100 sur un montant — passer par les helpers de src/domaine/argent.ts',
  },
];

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])([^'"]+)\1/g;

function cheminImporte(fichier, spec) {
  if (spec.startsWith('@/')) return 'src/' + spec.slice(2);
  if (spec.startsWith('.')) return posix.normalize(posix.join(posix.dirname(fichier), spec));
  return null;
}

function verifierFichier(f, texte, violations) {
  const ajouter = (ligne, inv, msg, extrait) =>
    violations.push({ f, ligne, inv, msg, extrait: extrait.trim().slice(0, 140) });

  if (f === 'prisma/schema.prisma') {
    texte.split(/\r?\n/).forEach((l, i) => {
      const m = /^\s*(\w+)\s+(Float|Decimal)\b/.exec(l.replace(/\/\/.*$/, ''));
      if (m && MOTS_MONTANT.test(m[1]) && !ECHAPPATOIRE.test(l)) {
        ajouter(i + 1, 'INV3', `champ ${m[1]} en ${m[2]} — un montant est un Int en centimes`, l);
      }
    });
    return;
  }

  if (f.startsWith('src/lib/') && f.endsWith('.mjs') && !MJS_LIB_TOLERES.has(f)) {
    ajouter(1, 'DEP', 'nouveau .mjs dans src/lib (hors typage) — écrire en TypeScript', f);
  }

  // Fichiers de test : les montants y sont des fixtures fictives et des sorties
  // attendues (« 2,50 € »), les messages testés citent « mardi », et un test du
  // domaine peut lire le CSV (fs) ou le catalogue. Ils restent soumis à INV3.
  const estTest = /\.test\.[cm]?[jt]sx?$/.test(f);
  const horsCatalogue = !estTest && !f.startsWith('src/catalogue/');
  const horsDomaine = !estTest && !f.startsWith('src/domaine/');
  const horsArgent = f !== 'src/domaine/argent.ts';
  const dansDomaine = !estTest && f.startsWith('src/domaine/');
  const sansCatalogue = dansDomaine || (!estTest && f.startsWith('src/lib/inventaire/'));
  // Ce script décrit les motifs qu'il cherche : il ne se vérifie pas lui-même.
  if (f === 'scripts/verifier-invariants.mjs') return;

  decouper(texte).forEach(({ brut, code }, i) => {
    if (ECHAPPATOIRE.test(brut)) return;
    const n = i + 1;

    if (horsCatalogue) {
      for (const r of INV1) {
        const m = r.re.exec(brut);
        if (m && !(r.zero && r.zero.test(m[0].trim()))) { ajouter(n, 'INV1', r.msg, brut); break; }
      }
    }
    if (horsDomaine) {
      for (const r of INV2) {
        if (r.re.test(code)) { ajouter(n, 'INV2', r.msg, brut); break; }
      }
    }
    if (horsArgent) {
      for (const r of INV3) {
        if (r.re.test(code) && (!r.siLigne || r.siLigne.test(code)) && !(r.sauf && r.sauf.test(code))) { ajouter(n, 'INV3', r.msg, brut); break; }
      }
    }
    if (dansDomaine || sansCatalogue) {
      for (const m of code.matchAll(IMPORT)) {
        const spec = m[2];
        if (dansDomaine && /^(react(-dom)?|next|@prisma\/|prisma$|(node:)?fs(\/|$))/.test(spec)) {
          ajouter(n, 'DEP', `src/domaine importe « ${spec} » — le domaine reste pur`, brut);
        }
        const cible = cheminImporte(f, spec);
        if (sansCatalogue && cible && (cible === 'src/catalogue' || cible.startsWith('src/catalogue/'))) {
          ajouter(n, 'DEP', `${dansDomaine ? 'src/domaine' : 'src/lib/inventaire'} importe src/catalogue (LOI 10)`, brut);
        }
      }
    }
  });
}

// --------------------------------------------------------------------------

// DATA — toute source de data/ citée par le code (import, chemin), par
// CLAUDE.md ou par le registre data/versions-tarifs.json doit être SUIVIE par
// git : sinon un clone / un déploiement casse le build et les tests.
// Contrôle ignoré sans git (rien à comparer).
function verifierDonneesSuivies(violations) {
  let suivis;
  try {
    suivis = new Set(git('ls-files', '-z', '--', 'data').split('\0').filter(Boolean));
  } catch {
    return;
  }
  const citations = new Map(); // fichier data/ → première citation « source:ligne »
  const citer = (nom, ou) => { if (!citations.has(nom)) citations.set(nom, ou); };
  const sources = git('ls-files', '-co', '--exclude-standard', '-z', '--', 'src', 'scripts', 'prisma')
    .split('\0')
    .filter((f) => f && f !== 'scripts/verifier-invariants.mjs' && EXTENSIONS.test(f) && existsSync(join(RACINE, f)));
  for (const f of [...sources, 'CLAUDE.md']) {
    if (!existsSync(join(RACINE, f))) continue;
    readFileSync(join(RACINE, f), 'utf8').split(/\r?\n/).forEach((l, i) => {
      for (const m of l.matchAll(/\bdata\/([\w.-]+\.(?:csv|json))\b/g)) citer(`data/${m[1]}`, `${f}:${i + 1}`);
    });
  }
  const registre = join(RACINE, 'data/versions-tarifs.json');
  if (existsSync(registre)) {
    citer('data/versions-tarifs.json', 'src/catalogue/chargerFichiers.ts');
    for (const v of JSON.parse(readFileSync(registre, 'utf8')).versions ?? []) {
      if (v.fichier) citer(`data/${v.fichier}`, 'data/versions-tarifs.json');
    }
  }
  for (const [nom, ou] of [...citations].sort()) {
    if (/AAAA|MM\b/.test(nom)) continue; // gabarit de nom dans un commentaire
    const present = existsSync(join(RACINE, nom));
    if (present && suivis.has(nom)) continue;
    violations.push({
      f: nom, ligne: 1, inv: 'DATA',
      msg: present
        ? `source citée (${ou}) mais NON SUIVIE par git — git add ${nom} (et vérifier .gitignore)`
        : `source citée (${ou}) mais ABSENTE du dépôt`,
      extrait: '',
    });
  }
}

const fichiers = listerFichiers().map((f) => f.split(sep).join('/')).filter(estCible).sort();
const violations = [];
for (const f of fichiers) verifierFichier(f, lire(f), violations);
verifierDonneesSuivies(violations);

if (violations.length === 0) {
  console.log(`Invariants : OK (${fichiers.length} fichier(s) vérifié(s)).`);
  process.exit(0);
}

const parInv = {};
for (const v of violations) {
  parInv[v.inv] = (parInv[v.inv] ?? 0) + 1;
  console.log(`${v.f}:${v.ligne}  [${v.inv}] ${v.msg}${v.extrait ? `\n    ${v.extrait}` : ''}`);
}
const resume = Object.entries(parInv).map(([k, n]) => `${k} ${n}`).join(' · ');
console.log(`\n${violations.length} violation(s) — ${resume} — ${fichiers.length} fichier(s) vérifié(s).`);
console.log('Corriger, ou justifier sur la ligne : // invariant-ok: <raison>');
process.exit(MODE_RAPPORT ? 0 : 1);
