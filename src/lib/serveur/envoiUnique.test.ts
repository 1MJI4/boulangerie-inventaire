// node --test src/lib/serveur/envoiUnique.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decisionEnvoi,
  ecrireUneFois,
  estConflitUnicite,
  JOURS_MAX_PRISE_HORS_LIGNE,
  lireIdClient,
  lirePriseTablette,
  TOLERANCE_HORLOGE_MS,
} from './envoiUnique.ts';

const UUID = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
const MAINTENANT = new Date('2026-10-28T14:00:00.000Z');
const JOUR = 24 * 60 * 60_000;

/* ------------------------------------------------------------ Identifiant */

test('idClient : corps seul, en-tête seul, les deux identiques → lu, normalisé en minuscules', () => {
  assert.deepEqual(lireIdClient(UUID, null), { ok: true, idClient: UUID });
  assert.deepEqual(lireIdClient(undefined, UUID), { ok: true, idClient: UUID });
  assert.deepEqual(lireIdClient(UUID.toUpperCase(), ` ${UUID} `), { ok: true, idClient: UUID });
});

test('idClient absent partout → null (envoi sans protection, comme avant)', () => {
  assert.deepEqual(lireIdClient(undefined, null), { ok: true, idClient: null });
  assert.deepEqual(lireIdClient('', ''), { ok: true, idClient: null });
});

test('idClient mal formé ou différent entre corps et en-tête → refus typé, message humain', () => {
  for (const [corps, entete] of [
    ['pas-un-uuid', null],
    [42, null],
    [UUID, '9f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f'],
    [undefined, 'abc'],
  ] as const) {
    const r = lireIdClient(corps, entete);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, 'ERR_SAISIE_INVALIDE');
      assert.equal(r.champ, 'idClient');
      assert.doesNotMatch(r.message, /uuid|idempotency|http/i);
    }
  }
});

/* ---------------------------------------------------------- Heure de prise */

test('priseLe : absente ou illisible → heure du serveur', () => {
  for (const brut of [undefined, null, '', 'lundi soir', '2026-10-27', '2026-10-27T18:00:00', 1730000000000]) {
    const r = lirePriseTablette(brut, MAINTENANT);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.source, 'serveur');
      assert.equal(r.instant.getTime(), MAINTENANT.getTime());
    }
  }
});

test('priseLe : lundi soir, envoyée mercredi → la date de la tablette est retenue (tarif de lundi)', () => {
  const lundi = '2026-10-26T19:45:00.000Z';
  const r = lirePriseTablette(lundi, MAINTENANT);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.source, 'tablette');
    assert.equal(r.instant.toISOString(), lundi);
  }
  // Décalage horaire explicite accepté.
  const r2 = lirePriseTablette('2026-10-26T20:45:00+01:00', MAINTENANT);
  assert.ok(r2.ok && r2.instant.toISOString() === lundi);
});

test('priseLe : dans le futur → jamais retenue (heure du serveur)', () => {
  const dansLaTolerance = new Date(MAINTENANT.getTime() + TOLERANCE_HORLOGE_MS - 1000).toISOString();
  const r = lirePriseTablette(dansLaTolerance, MAINTENANT);
  assert.ok(r.ok && r.source === 'avance' && r.instant.getTime() === MAINTENANT.getTime());

  const auDela = new Date(MAINTENANT.getTime() + TOLERANCE_HORLOGE_MS + 1000).toISOString();
  const r2 = lirePriseTablette(auDela, MAINTENANT);
  assert.ok(r2.ok && r2.source === 'futur' && r2.instant.getTime() === MAINTENANT.getTime());

  const demain = new Date(MAINTENANT.getTime() + JOUR).toISOString();
  const r3 = lirePriseTablette(demain, MAINTENANT);
  assert.ok(r3.ok && r3.instant.getTime() === MAINTENANT.getTime());
});

test('priseLe : 7 jours pile accepté, au-delà refus clair (la commande reste à reprendre)', () => {
  assert.equal(JOURS_MAX_PRISE_HORS_LIGNE, 7);
  const limite = new Date(MAINTENANT.getTime() - 7 * JOUR).toISOString();
  const r = lirePriseTablette(limite, MAINTENANT);
  assert.ok(r.ok && r.source === 'tablette');

  const tropVieille = new Date(MAINTENANT.getTime() - 7 * JOUR - 60_000).toISOString();
  const r2 = lirePriseTablette(tropVieille, MAINTENANT);
  assert.equal(r2.ok, false);
  if (!r2.ok) {
    assert.equal(r2.niveau, 'bloquant');
    assert.equal(r2.champ, 'priseLe');
    assert.match(r2.message, /7 jours/);
    assert.match(r2.message, /Rappelez le client/);
  }
});

/* ------------------------------------------------------------ Dédoublonnage */

test('decisionEnvoi : déjà créée seulement avec un identifiant ET un enregistrement trouvé', () => {
  assert.deepEqual(decisionEnvoi(UUID, { id: 1 }), { type: 'deja', existant: { id: 1 } });
  assert.deepEqual(decisionEnvoi(UUID, null), { type: 'nouveau' });
  assert.deepEqual(decisionEnvoi(null, { id: 1 }), { type: 'nouveau' });
});

test('estConflitUnicite : P2002 / 23505 seulement', () => {
  assert.equal(estConflitUnicite({ code: 'P2002' }), true);
  assert.equal(estConflitUnicite({ code: '23505' }), true);
  assert.equal(estConflitUnicite({ code: 'P2025' }), false);
  assert.equal(estConflitUnicite(new Error('panne')), false);
  assert.equal(estConflitUnicite(null), false);
});

/**
 * Base factice : table « Commande » avec numéro séquentiel et index UNIQUE
 * sur idClient, transaction qui n'est visible qu'à son COMMIT (comme
 * PostgreSQL en READ COMMITTED), et compteur d'effets (numéros, événements).
 */
function baseFactice() {
  const lignes = new Map<string, { id: number; numero: string }>();
  let sequence = 0;
  let evenements = 0;
  let ecritures = 0;
  return {
    get evenements() {
      return evenements;
    },
    get ecritures() {
      return ecritures;
    },
    get nombre() {
      return lignes.size;
    },
    trouver: async (idClient: string) => lignes.get(idClient) ?? null,
    /** Transaction : `attente` simule le temps du contrôle entre lecture et COMMIT. */
    creer: (idClient: string, attente?: Promise<void>) => async () => {
      ecritures++;
      const brouillon = { id: sequence + 1, numero: `2026-${String(sequence + 1).padStart(4, '0')}` };
      if (attente) await attente;
      if (lignes.has(idClient)) throw Object.assign(new Error('Unique constraint failed on the fields: (`idClient`)'), { code: 'P2002' });
      sequence++;
      evenements++;
      lignes.set(idClient, brouillon);
      return brouillon;
    },
  };
}

test('dédoublonnage : premier envoi crée, le renvoi (réponse perdue) renvoie la MÊME commande sans rien refaire', async () => {
  const base = baseFactice();
  const premier = await ecrireUneFois(UUID, base.trouver, base.creer(UUID));
  assert.equal(premier.rejoue, false);
  const renvoi = await ecrireUneFois(UUID, base.trouver, base.creer(UUID));
  assert.equal(renvoi.rejoue, true);
  assert.deepEqual(renvoi.resultat, premier.resultat);
  assert.equal(base.nombre, 1);
  assert.equal(base.evenements, 1, 'un seul événement de création');
  assert.equal(base.ecritures, 1, 'la transaction n’est même pas relancée');
});

test('dédoublonnage : deux envois SIMULTANÉS → une seule commande, le perdant reçoit le gagnant (jamais d’erreur)', async () => {
  const base = baseFactice();
  let liberer!: () => void;
  const verrou = new Promise<void>((r) => (liberer = r));
  // Les deux lisent « rien » puis écrivent : la contrainte UNIQUE tranche au commit.
  const a = ecrireUneFois(UUID, base.trouver, base.creer(UUID, verrou));
  const b = ecrireUneFois(UUID, base.trouver, base.creer(UUID, verrou));
  await new Promise((r) => setImmediate(r));
  liberer();
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(base.nombre, 1);
  assert.equal(base.evenements, 1);
  assert.deepEqual(ra.resultat, rb.resultat);
  assert.deepEqual([ra.rejoue, rb.rejoue].sort(), [false, true]);
});

test('dédoublonnage : sans identifiant, chaque envoi crée (comportement d’avant)', async () => {
  const base = baseFactice();
  let n = 0;
  const creer = async () => ({ id: ++n });
  await ecrireUneFois(null, base.trouver, creer);
  await ecrireUneFois(null, base.trouver, creer);
  assert.equal(n, 2);
});

test('dédoublonnage : une autre violation d’unicité (numéro) sans existant est relancée, une panne aussi', async () => {
  const trouver = async () => null;
  await assert.rejects(
    ecrireUneFois(UUID, trouver, async () => {
      throw Object.assign(new Error('numero'), { code: 'P2002' });
    }),
    /numero/,
  );
  await assert.rejects(
    ecrireUneFois(UUID, trouver, async () => {
      throw new Error('panne');
    }),
    /panne/,
  );
});

test('dédoublonnage : identifiants différents → deux commandes', async () => {
  const base = baseFactice();
  const autre = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  await ecrireUneFois(UUID, base.trouver, base.creer(UUID));
  await ecrireUneFois(autre, base.trouver, base.creer(autre));
  assert.equal(base.nombre, 2);
});
