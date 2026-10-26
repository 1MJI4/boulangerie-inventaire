#!/usr/bin/env node
// scripts/recette.mjs — agent `deploiement`
//
// Lanceur de la RECETTE locale (base PostgreSQL 15 dans Docker). Guide :
// docs/RECETTE.md. Usage : npm run recette:<commande>
//
//   base       démarre la base Docker et attend qu'elle réponde
//              (crée .env.recette avec des codes de test au hasard s'il manque)
//   migrer     prisma migrate deploy sur la recette
//   donnees    liste d'inventaire (seed) + catalogue de commande (import)
//              + dossier des photos modèles (reprise de public/modeles, sans écraser)
//   demo       quelques commandes de test (le serveur recette:dev doit tourner)
//   dev        next dev, port 3000, pour le PC (http://localhost:3000)
//   tablette   next dev sur l’adresse wifi du PC (PC + tablette écrivent)
//   arreter    arrête la base (les données restent)
//   effacer    supprime la base ET ses données, après confirmation
//
// SÉCURITÉ — le fichier « .env » du projet désigne la PRODUCTION. Il n'est ni
// lu ni modifié ici. Next.js et Prisma le chargent d'eux-mêmes, mais ne
// remplacent JAMAIS une variable déjà présente dans le processus : ce lanceur
// pose DATABASE_URL, DIRECT_URL et les codes depuis « .env.recette » avant de
// lancer quoi que ce soit, donc ce sont eux qui gagnent.
// Garde-fou : refus de démarrer si l'hôte de DATABASE_URL ou de DIRECT_URL
// n'est pas la machine locale, ou si le nom de base ne contient pas
// « recette ». Le mot de passe n'est jamais affiché.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants as FS, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER_ENV = join(RACINE, '.env.recette');
const FICHIER_MODELE = join(RACINE, '.env.recette.example');
const COMPOSE = ['compose', '-f', join(RACINE, 'docker-compose.recette.yml')];
const SERVICE = 'base';
const UTILISATEUR_BASE = 'recette';
const NOM_BASE = 'pain_recette';
const PORT_APPLI = 3000;
// Photos modèles : dossier de DONNÉES (ignoré par git), jamais public/.
const DOSSIER_PHOTOS_DEFAUT = join(RACINE, 'donnees', 'modeles');
const SOURCE_PHOTOS = join(RACINE, 'public', 'modeles');

const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const MARQUE_RECETTE = /recette/i;
const VARIABLES_BASE = ['DATABASE_URL', 'DIRECT_URL'];
const LONGUEURS_MIN = { SESSION_SECRET: 32, CODE_TABLETTE: 8, CODE_GESTION: 8, CLOUDPRNT_CLE: 32 };

function arreter(message) {
  console.error(`\nRECETTE ARRÊTÉE : ${message}\n`);
  process.exit(1);
}

// ------------------------------------------------------------ .env.recette

/** Code facile à taper sur une tablette : minuscules et chiffres, sans 0/o/1/l. */
function codeTapable(longueur) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const octets = randomBytes(longueur);
  let code = '';
  for (const o of octets) code += alphabet[o % alphabet.length];
  return code;
}

function creerEnvRecette() {
  const modele = readFileSync(FICHIER_MODELE, 'utf8');
  const valeurs = {
    SESSION_SECRET: randomBytes(36).toString('base64url'),
    CODE_TABLETTE: codeTapable(10),
    CODE_GESTION: codeTapable(10),
    CLOUDPRNT_CLE: randomBytes(36).toString('base64url'),
  };
  let contenu = modele.replace(/^(SESSION_SECRET|CODE_TABLETTE|CODE_GESTION|CLOUDPRNT_CLE)=.*$/gm, (_l, nom) => `${nom}="${valeurs[nom]}"`);
  // Chemin absolu propre à ce PC (barres obliques : lisible par dotenv sur Windows).
  contenu = contenu.replace(/^DOSSIER_PHOTOS_MODELES=.*$/m, `DOSSIER_PHOTOS_MODELES="${DOSSIER_PHOTOS_DEFAUT.replace(/\\/g, '/')}"`);
  contenu = contenu.replace(
    /^# \.env\.recette\.example — modèle.*$/m,
    '# .env.recette — configuration LOCALE de recette (ignorée par git, codes de TEST)',
  );
  writeFileSync(FICHIER_ENV, contenu, { encoding: 'utf8', flag: 'wx' });
  console.log('.env.recette créé avec des codes de test tirés au hasard (voir docs/RECETTE.md pour les lire).');
}

/** Charge .env.recette dans process.env (en REMPLAÇANT toute valeur déjà là). */
function chargerEnvRecette() {
  if (!existsSync(FICHIER_ENV)) {
    arreter('le fichier .env.recette manque. Lancez d’abord : npm run recette:base');
  }
  const valeurs = parse(readFileSync(FICHIER_ENV));
  for (const [cle, valeur] of Object.entries(valeurs)) process.env[cle] = valeur;
  // .env.recette créé avant l'arrivée des photos modèles : chemin par défaut.
  const photos = process.env.DOSSIER_PHOTOS_MODELES;
  if (!photos || photos.startsWith('[')) process.env.DOSSIER_PHOTOS_MODELES = DOSSIER_PHOTOS_DEFAUT;
}

/** Le dossier des photos doit être absolu et hors de public/ (sinon écrasé, ou servi sans contrôle). */
function verifierDossierPhotos() {
  const dossier = process.env.DOSSIER_PHOTOS_MODELES;
  if (!isAbsolute(dossier)) arreter('DOSSIER_PHOTOS_MODELES doit être un chemin absolu dans .env.recette.');
  const rel = relative(join(RACINE, 'public'), resolve(dossier));
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    arreter('DOSSIER_PHOTOS_MODELES ne doit pas être dans public/ : choisissez un dossier de données (par défaut donnees/modeles).');
  }
  return resolve(dossier);
}

/**
 * Reprise des photos du dépôt dans le dossier de données, UNE fois : copie
 * sans jamais écraser, puis repère « .reprise-modeles-faite » posé à côté du
 * dossier (pas dedans). Ensuite : rien — une photo supprimée ne revient pas.
 * Même règle que deploiement/vps/preparer-photos-modeles.sh en production.
 */
function preparerPhotosModeles() {
  const dossier = verifierDossierPhotos();
  const repere = join(dirname(dossier), '.reprise-modeles-faite');
  mkdirSync(dossier, { recursive: true });
  if (existsSync(repere)) {
    console.log(`[recette] photos modèles : reprise déjà faite, rien à copier (${readdirSync(dossier).length} fichiers dans ${dossier}).`);
    return;
  }
  let copiees = 0;
  let gardees = 0;
  for (const nom of existsSync(SOURCE_PHOTOS) ? readdirSync(SOURCE_PHOTOS) : []) {
    const source = join(SOURCE_PHOTOS, nom);
    if (!statSync(source).isFile()) continue;
    try {
      copyFileSync(source, join(dossier, nom), FS.COPYFILE_EXCL);
      copiees++;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      gardees++;
    }
  }
  writeFileSync(repere, new Date().toISOString() + '\n');
  console.log(`[recette] photos modèles : reprise faite — ${copiees} copiées, ${gardees} déjà présentes (non écrasées), dans ${dossier}.`);
}

// ------------------------------------------------------------ garde-fou

function decrireUrl(nom) {
  const brute = process.env[nom];
  if (!brute) arreter(`${nom} est vide dans .env.recette.`);
  let url;
  try {
    url = new URL(brute);
  } catch {
    arreter(`${nom} est illisible dans .env.recette.`);
  }
  const hote = url.hostname.toLowerCase();
  const base = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return { hote, port: url.port || '5432', base, utilisateur: decodeURIComponent(url.username) };
}

/** Refuse tout ce qui n'est pas la base de recette locale. Affiche hôte et base, jamais le mot de passe. */
function gardeFou() {
  for (const nom of VARIABLES_BASE) {
    const { hote, port, base, utilisateur } = decrireUrl(nom);
    if (!HOTES_LOCAUX.has(hote)) {
      arreter(`${nom} désigne l’hôte « ${hote} », qui n’est pas cette machine. La recette ne parle QU’À la base Docker locale (localhost). Rien n’a été lancé.`);
    }
    if (!MARQUE_RECETTE.test(base)) {
      arreter(`${nom} désigne la base « ${base} », dont le nom ne contient pas « recette ». Rien n’a été lancé.`);
    }
    console.log(`[recette] ${nom.padEnd(12)} → base « ${base} » sur ${hote}:${port} (utilisateur ${utilisateur}) — OK, base de recette locale.`);
  }
  for (const [nom, min] of Object.entries(LONGUEURS_MIN)) {
    const v = process.env[nom];
    if (typeof v !== 'string' || v.length < min || v.startsWith('[')) {
      arreter(`${nom} manque ou fait moins de ${min} caractères dans .env.recette.`);
    }
  }
}

// ------------------------------------------------------------ outils

function lancer(commande, args, options = {}) {
  const r = spawnSync(commande, args, { cwd: RACINE, stdio: 'inherit', env: process.env, ...options });
  if (r.error) arreter(`impossible de lancer « ${commande} » (${r.error.code ?? r.error.message}).`);
  return r.status ?? 1;
}

function docker(args, options) {
  return lancer('docker', [...COMPOSE, ...args], options);
}

function baseRepond() {
  const r = spawnSync('docker', [...COMPOSE, 'exec', '-T', SERVICE, 'pg_isready', '-U', UTILISATEUR_BASE, '-d', NOM_BASE], {
    cwd: RACINE,
    stdio: 'ignore',
  });
  return r.status === 0;
}

function portOuvert(port, hote = '127.0.0.1') {
  return new Promise((ok) => {
    const s = createConnection({ port, host: hote });
    s.once('connect', () => { s.destroy(); ok(true); });
    s.once('error', () => ok(false));
    s.setTimeout(1500, () => { s.destroy(); ok(false); });
  });
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function psql(sql) {
  return lancer('docker', [...COMPOSE, 'exec', '-T', SERVICE, 'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', UTILISATEUR_BASE, '-d', NOM_BASE, '-c', sql]);
}

async function exigerBaseDemarree() {
  const { port } = decrireUrl('DATABASE_URL');
  if (!(await portOuvert(Number(port)))) arreter('la base de recette ne répond pas. Lancez d’abord : npm run recette:base');
}

// ------------------------------------------------------------ commandes

async function base() {
  if (!existsSync(FICHIER_ENV)) creerEnvRecette();
  chargerEnvRecette();
  gardeFou();
  if (docker(['up', '-d']) !== 0) arreter('Docker n’a pas pu démarrer la base. Docker Desktop est-il lancé ?');
  process.stdout.write('[recette] attente de la base');
  for (let i = 0; i < 60; i++) {
    if (baseRepond()) {
      console.log(' — prête.');
      // Rôles publics de Supabase, pour que la recette ressemble à la production :
      // la migration rls_et_revoke leur retire alors vraiment tous les droits.
      psql(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      END $$;`);
      lancer('docker', [...COMPOSE, 'exec', '-T', SERVICE, 'psql', '-tA', '-U', UTILISATEUR_BASE, '-d', NOM_BASE, '-c', 'SHOW server_version']);
      console.log('[recette] base prête. Suite : npm run recette:migrer');
      return;
    }
    process.stdout.write('.');
    await pause(1000);
  }
  arreter('la base ne répond pas après 60 secondes (docker compose -f docker-compose.recette.yml logs base).');
}

const BIN_PRISMA = join(RACINE, 'node_modules', 'prisma', 'build', 'index.js');
const BIN_NEXT = join(RACINE, 'node_modules', 'next', 'dist', 'bin', 'next');

async function migrer() {
  chargerEnvRecette();
  gardeFou();
  await exigerBaseDemarree();
  const code = lancer(process.execPath, [BIN_PRISMA, 'migrate', 'deploy']);
  if (code !== 0) arreter('les migrations ont échoué (message de Prisma ci-dessus). Rien n’a touché la production.');
  psql('SELECT count(*) AS "migrations appliquées" FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;');
}

async function donnees() {
  chargerEnvRecette();
  gardeFou();
  await exigerBaseDemarree();
  console.log('\n[recette] 1/3 — liste d’inventaire (prisma/seed.mjs)');
  if (lancer(process.execPath, [join(RACINE, 'prisma', 'seed.mjs')]) !== 0) arreter('le seed a échoué.');
  console.log('\n[recette] 2/3 — catalogue de commande (scripts/importer-catalogue.mjs)');
  const { hote } = decrireUrl('DATABASE_URL');
  const code = lancer(process.execPath, [
    join(RACINE, 'scripts', 'importer-catalogue.mjs'),
    '--ecrire-en-base',
    `--je-confirme-la-base=${hote}`,
  ]);
  if (code !== 0) arreter('l’import du catalogue a échoué.');
  console.log('\n[recette] 3/3 — photos modèles (dossier de données)');
  preparerPhotosModeles();
  console.log('\n[recette] données chargées. Commandes de démonstration : lancez recette:dev, puis npm run recette:demo');
}

/** Adresse IPv4 du PC sur le wifi (ou --ip=<adresse> pour la forcer). */
function adresseWifi() {
  const forcee = process.argv.find((a) => a.startsWith('--ip='))?.slice(5);
  if (forcee) return forcee;
  const candidates = [];
  for (const [nom, adresses] of Object.entries(networkInterfaces())) {
    for (const a of adresses ?? []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push({ nom, ip: a.address });
    }
  }
  const wifi = candidates.find((c) => /wi-?fi|wlan|sans fil/i.test(c.nom));
  return (wifi ?? candidates.find((c) => !/virtual|vethernet|docker|wsl/i.test(c.nom)))?.ip ?? null;
}

// Pourquoi deux modes : Next construit l'adresse vue par le proxy avec le nom
// d'hôte du serveur (« -H »), pas avec celui tapé dans le navigateur. Le proxy
// (src/proxy.ts) refuse toute écriture dont l'Origin n'a pas CET hôte
// (ERR_ORIGINE_REFUSEE). Donc :
//   recette:dev      → hôte « localhost » : le PC écrit ; la tablette peut
//                      afficher les pages mais ses écritures sont refusées ;
//   recette:tablette → hôte = adresse wifi du PC : PC ET tablette écrivent, à
//                      condition d'ouvrir http://<adresse-wifi>:3000 sur les deux.
// (« -H 0.0.0.0 » casserait les deux : hôte vu = 0.0.0.0.) À corriger côté
// `securite` (comparer l'Origin à l'en-tête Host) — voir docs/RECETTE.md.
async function dev() {
  chargerEnvRecette();
  gardeFou();
  await exigerBaseDemarree();
  const tablette = process.argv[2] === 'tablette';
  const ip = tablette ? adresseWifi() : null;
  if (tablette && !ip) arreter('adresse wifi du PC introuvable. Relancez avec : npm run recette:tablette -- --ip=192.168.x.y');
  // Sans effet après la première fois (repère) : rattrape une recette déjà installée.
  preparerPhotosModeles();
  console.log(
    tablette
      ? `[recette] application sur http://${ip}:${PORT_APPLI} — à ouvrir sur le PC ET sur la tablette (même wifi).\n`
      : `[recette] application sur http://localhost:${PORT_APPLI} (PC ; pour écrire depuis la tablette : npm run recette:tablette)\n`,
  );
  const enfant = spawn(process.execPath, [BIN_NEXT, 'dev', ...(ip ? ['-H', ip] : []), '-p', String(PORT_APPLI)], {
    cwd: RACINE,
    stdio: 'inherit',
    env: process.env,
  });
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => enfant.kill(s));
  enfant.on('exit', (code) => process.exit(code ?? 0));
}

async function demo() {
  chargerEnvRecette();
  gardeFou();
  await exigerBaseDemarree();
  const { lancerDemo } = await import('./recette-demo.mjs');
  // Le serveur écoute soit sur localhost (recette:dev), soit sur l’adresse wifi (recette:tablette).
  const ip = adresseWifi();
  const hote = (await portOuvert(PORT_APPLI, "127.0.0.1")) ? "localhost" : ip && (await portOuvert(PORT_APPLI, ip)) ? ip : null;
  if (!hote) arreter("le serveur ne répond pas sur le port 3000. Lancez d’abord npm run recette:dev dans un autre terminal.");
  await lancerDemo({ base: `http://${hote}:${PORT_APPLI}` });
}

function arreterBase() {
  // « stop » et non « down » : le conteneur et ses données restent.
  if (docker(['stop']) !== 0) arreter('Docker n’a pas pu arrêter la base.');
  console.log('[recette] base arrêtée. Les données sont conservées (npm run recette:base pour la relancer).');
}

async function effacer() {
  const confirme = process.argv.includes('--oui-effacer-la-recette');
  if (!confirme) {
    if (!process.stdin.isTTY) {
      arreter('confirmation impossible sans clavier. Relancez dans un terminal, ou ajoutez --oui-effacer-la-recette.');
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const reponse = await rl.question(
      'Ceci SUPPRIME la base de recette locale et toutes ses données de test\n(la production n’est pas concernée). Tapez EFFACER pour confirmer : ',
    );
    rl.close();
    if (reponse.trim() !== 'EFFACER') {
      console.log('Rien n’a été effacé.');
      return;
    }
  }
  if (docker(['down', '-v']) !== 0) arreter('Docker n’a pas pu supprimer la base.');
  console.log('[recette] base et données de test supprimées. Pour repartir : recette:base, recette:migrer, recette:donnees.');
}

const COMMANDES = { base, migrer, donnees, dev, tablette: dev, demo, arreter: arreterBase, effacer };
const nom = process.argv[2];
if (!COMMANDES[nom]) arreter(`commande inconnue « ${nom ?? ''} ». Possibles : ${Object.keys(COMMANDES).join(', ')}.`);
await COMMANDES[nom]();
