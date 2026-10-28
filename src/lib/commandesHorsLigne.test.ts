// node --test src/lib/commandesHorsLigne.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aGarderSurLaTablette,
  appliquerIssue,
  classerReponse,
  CONFIRMATION_ENVOI_MS,
  debuterEnvoi,
  FILE_VIDE,
  garder,
  lireFile,
  mettreDeCote,
  nettoyer,
  OUBLI_ENVOYEE_MS,
  prochaine,
  resumer,
  TEXTES_HORS_LIGNE,
  type FileCommandes,
  type NouvelleEntree,
} from './commandesHorsLigne.ts';

function entree(idClient: string, p: Partial<NouvelleEntree> = {}): NouvelleEntree {
  return {
    idClient,
    methode: 'POST',
    commandeId: null,
    numero: null,
    client: `Client ${idClient}`,
    dateRetrait: '2026-10-30',
    heureRetrait: '14:30',
    vendeur: 'Sara',
    priseLe: '2026-10-28T10:00:00.000Z',
    corps: { client: `Client ${idClient}` },
    ecran: null,
    ...p,
  };
}

const T0 = 1_800_000_000_000;

function avec(...ids: string[]): FileCommandes {
  return ids.reduce((f, id, k) => garder(f, entree(id), T0 + k), FILE_VIDE);
}

test('ajout : la commande gardée est en attente, horodatée, avec vendeur et identifiant', () => {
  const f = garder(FILE_VIDE, entree('a'), T0);
  assert.equal(f.commandes.length, 1);
  const c = f.commandes[0];
  assert.equal(c.etat, 'en_attente');
  assert.equal(c.gardeeLe, T0);
  assert.equal(c.vendeur, 'Sara');
  assert.equal(c.idClient, 'a');
  assert.equal(c.priseLe, '2026-10-28T10:00:00.000Z');
});

test('ordre : les commandes partent dans l’ordre où elles ont été gardées', () => {
  let f = avec('a', 'b', 'c');
  const ordre: string[] = [];
  for (let k = 0; k < 3; k++) {
    const p = prochaine(f)!;
    ordre.push(p.idClient);
    f = debuterEnvoi(f, p.idClient, T0);
    f = appliquerIssue(f, p.idClient, { type: 'envoyee', id: k + 1, numero: `2026-00${k + 1}` }, T0);
  }
  assert.deepEqual(ordre, ['a', 'b', 'c']);
  assert.equal(prochaine(f), null);
});

test('dédoublonnage : garder deux fois le même identifiant ne double rien', () => {
  let f = avec('a');
  f = garder(f, entree('a', { client: 'Corrigé' }), T0 + 10);
  assert.equal(f.commandes.length, 1);
  assert.equal(f.commandes[0].client, 'Corrigé');
  assert.equal(f.commandes[0].gardeeLe, T0, 'la date de première garde est conservée');
});

test('dédoublonnage : une commande déjà envoyée ou en cours d’envoi n’est jamais renvoyée sous le même identifiant', () => {
  let f = avec('a');
  f = debuterEnvoi(f, 'a', T0);
  assert.equal(garder(f, entree('a'), T0 + 1), f, 'en cours d’envoi : inchangé');
  f = appliquerIssue(f, 'a', { type: 'envoyee', id: 7, numero: '2026-0007' }, T0);
  const apres = garder(f, entree('a'), T0 + 2);
  assert.equal(apres.commandes.length, 1);
  assert.equal(apres.commandes[0].etat, 'envoyee');
  assert.equal(prochaine(apres), null);
});

test('dédoublonnage : une seconde modification de la même commande remplace la première en attente', () => {
  let f = garder(FILE_VIDE, entree('m1', { methode: 'PATCH', commandeId: 12, numero: '2026-0012' }), T0);
  f = garder(f, entree('autre'), T0 + 1);
  f = garder(f, entree('m2', { methode: 'PATCH', commandeId: 12, numero: '2026-0012', client: 'v2' }), T0 + 2);
  assert.equal(f.commandes.length, 2);
  assert.equal(f.commandes[0].idClient, 'm2', 'à la place de la première : l’ordre est gardé');
  assert.equal(f.commandes[0].client, 'v2');
});

test('dédoublonnage : une modification en cours d’envoi n’est pas écrasée par la suivante', () => {
  let f = garder(FILE_VIDE, entree('m1', { methode: 'PATCH', commandeId: 12 }), T0);
  f = debuterEnvoi(f, 'm1', T0);
  f = garder(f, entree('m2', { methode: 'PATCH', commandeId: 12 }), T0 + 1);
  assert.deepEqual(f.commandes.map((c) => c.idClient), ['m1', 'm2']);
});

test('états : réseau toujours absent → la commande repasse en attente, essai compté', () => {
  let f = avec('a');
  f = debuterEnvoi(f, 'a', T0);
  assert.equal(f.commandes[0].etat, 'envoi');
  assert.equal(f.commandes[0].essais, 1);
  f = appliquerIssue(f, 'a', { type: 'reessayer' }, T0 + 1);
  assert.equal(f.commandes[0].etat, 'en_attente');
  assert.equal(prochaine(f)?.idClient, 'a');
});

test('états : envoyée → numéro et identifiant du serveur retenus', () => {
  let f = debuterEnvoi(avec('a'), 'a', T0);
  f = appliquerIssue(f, 'a', { type: 'envoyee', id: 42, numero: '2026-0042' }, T0 + 5);
  const c = f.commandes[0];
  assert.equal(c.etat, 'envoyee');
  assert.equal(c.commandeId, 42);
  assert.equal(c.numero, '2026-0042');
  assert.equal(c.envoyeeLe, T0 + 5);
});

test('refus du serveur : la commande n’est pas perdue, elle est « à reprendre » avec le message', () => {
  let f = debuterEnvoi(avec('a', 'b'), 'a', T0);
  const refus = { code: 'ERR_JOUR_FERME', message: 'Fermé le mardi — choisissez un autre jour de retrait.', champ: 'dateRetrait' };
  f = appliquerIssue(f, 'a', { type: 'refusee', refus }, T0 + 1);
  const a = f.commandes.find((c) => c.idClient === 'a')!;
  assert.equal(a.etat, 'a_reprendre');
  assert.deepEqual(a.refus, refus);
  assert.deepEqual(a.corps, { client: 'Client a' }, 'la saisie est intacte');
  assert.equal(prochaine(f)?.idClient, 'b', 'les suivantes continuent de partir');
  assert.equal(resumer(f, T0).aReprendre, 1);
});

test('refus puis correction : revalider sous le même identifiant la remet en attente, refus effacé', () => {
  let f = debuterEnvoi(avec('a'), 'a', T0);
  f = appliquerIssue(f, 'a', { type: 'refusee', refus: { code: 'ERR_JOUR_FERME', message: 'x' } }, T0);
  f = garder(f, entree('a', { dateRetrait: '2026-10-29' }), T0 + 1);
  assert.equal(f.commandes.length, 1);
  assert.equal(f.commandes[0].etat, 'en_attente');
  assert.equal(f.commandes[0].refus, null);
  assert.equal(f.commandes[0].dateRetrait, '2026-10-29');
});

test('mettre de côté : archivée, plus comptée, jamais effacée', () => {
  let f = debuterEnvoi(avec('a'), 'a', T0);
  f = appliquerIssue(f, 'a', { type: 'refusee', refus: { code: 'ERR_X', message: 'x' } }, T0);
  f = mettreDeCote(f, 'a', T0 + 1);
  assert.equal(f.commandes.length, 1);
  assert.equal(f.commandes[0].etat, 'mise_de_cote');
  assert.deepEqual(resumer(f, T0 + 1), { enAttente: 0, enEnvoi: 0, aReprendre: 0, envoyeesRecentes: [] });
  assert.equal(nettoyer(f, T0 + 10 * OUBLI_ENVOYEE_MS).commandes.length, 1);
});

test('nettoyage : seules les commandes envoyées depuis longtemps sont oubliées', () => {
  let f = avec('a', 'b');
  f = appliquerIssue(debuterEnvoi(f, 'a', T0), 'a', { type: 'envoyee', id: 1, numero: 'n' }, T0);
  assert.equal(nettoyer(f, T0 + 1000).commandes.length, 2);
  const apres = nettoyer(f, T0 + OUBLI_ENVOYEE_MS + 1);
  assert.deepEqual(apres.commandes.map((c) => c.idClient), ['b']);
});

test('coupure pendant l’envoi (onglet fermé, batterie vide) : relue « en attente », sans doublon', () => {
  const f = debuterEnvoi(avec('a', 'b'), 'a', T0);
  const relue = lireFile(JSON.parse(JSON.stringify({ ...f, commandes: [...f.commandes, f.commandes[0]] })));
  assert.equal(relue.commandes.length, 2);
  assert.equal(relue.commandes[0].etat, 'en_attente');
  assert.equal(relue.commandes[0].idClient, 'a');
});

test('lecture : un contenu abîmé ne fait pas perdre les entrées lisibles', () => {
  const f = avec('a');
  const brut = { v: 99, commandes: [null, { idClient: 'x' }, 'n’importe quoi', ...f.commandes] };
  assert.deepEqual(lireFile(brut).commandes.map((c) => c.idClient), ['a']);
  assert.deepEqual(lireFile(null).commandes, []);
  assert.deepEqual(lireFile('{').commandes, []);
});

test('classement : réseau, panne serveur et session expirée → réessayer', () => {
  assert.equal(classerReponse({ type: 'reseau' }).type, 'reessayer');
  for (const code of ['ERR_SERVEUR_INDISPONIBLE', 'ERR_SESSION_EXPIREE', 'ERR_TROP_DE_TENTATIVES', 'ERR_CONFIGURATION_SERVEUR']) {
    assert.equal(classerReponse({ type: 'reponse', statut: 503, ok: false, refus: { code, message: 'm' } }).type, 'reessayer', code);
  }
  assert.equal(classerReponse({ type: 'reponse', statut: 504, ok: false, refus: { code: 'ERR_AUTRE', message: 'm' } }).type, 'reessayer');
});

test('classement : règle métier rejouée → refusée ; succès lisible → envoyée ; succès illisible → réessayer', () => {
  const refus = { code: 'ERR_JOUR_FERME', message: 'Fermé le mardi — choisissez un autre jour de retrait.' };
  assert.deepEqual(classerReponse({ type: 'reponse', statut: 422, ok: false, refus }), { type: 'refusee', refus });
  assert.deepEqual(classerReponse({ type: 'reponse', statut: 201, ok: true, donnees: { id: 3, numero: '2026-0003' } }), {
    type: 'envoyee',
    id: 3,
    numero: '2026-0003',
  });
  assert.equal(classerReponse({ type: 'reponse', statut: 200, ok: true, donnees: null }).type, 'reessayer');
});

test('écran : garder sur la tablette seulement pour une panne, jamais pour un refus métier ni une session expirée', () => {
  assert.equal(aGarderSurLaTablette({ type: 'reseau' }), true);
  assert.equal(aGarderSurLaTablette({ type: 'reponse', statut: 503, ok: false, refus: { code: 'ERR_SERVEUR_INDISPONIBLE', message: 'm' } }), true);
  assert.equal(aGarderSurLaTablette({ type: 'reponse', statut: 401, ok: false, refus: { code: 'ERR_SESSION_EXPIREE', message: 'm' } }), false);
  assert.equal(aGarderSurLaTablette({ type: 'reponse', statut: 422, ok: false, refus: { code: 'ERR_QUANTITE_MIN', message: 'm' } }), false);
  assert.equal(aGarderSurLaTablette({ type: 'reponse', statut: 201, ok: true, donnees: { id: 1, numero: 'n' } }), false);
});

test('résumé du voyant : en attente, envoi, à reprendre, envoyées récentes', () => {
  let f = avec('a', 'b', 'c', 'd');
  f = debuterEnvoi(f, 'a', T0);
  f = appliquerIssue(f, 'a', { type: 'envoyee', id: 1, numero: '2026-0001' }, T0);
  f = debuterEnvoi(f, 'b', T0);
  f = appliquerIssue(f, 'b', { type: 'refusee', refus: { code: 'ERR_X', message: 'x' } }, T0);
  f = debuterEnvoi(f, 'c', T0);
  const r = resumer(f, T0 + 1);
  assert.equal(r.enAttente, 1);
  assert.equal(r.enEnvoi, 1);
  assert.equal(r.aReprendre, 1);
  assert.deepEqual(r.envoyeesRecentes.map((c) => c.numero), ['2026-0001']);
  assert.equal(resumer(f, T0 + CONFIRMATION_ENVOI_MS + 1).envoyeesRecentes.length, 0);
});

test('textes (LOI 9) : français, pluriels, aucune trace technique', () => {
  assert.equal(TEXTES_HORS_LIGNE.enAttente(1), '1 commande en attente d’envoi');
  assert.equal(TEXTES_HORS_LIGNE.enAttente(2), '2 commandes en attente d’envoi');
  assert.equal(TEXTES_HORS_LIGNE.aReprendre(1), '1 commande à reprendre');
  assert.equal(
    TEXTES_HORS_LIGNE.gardee.replace(/ /g, ' '),
    'Pas de connexion : la commande est gardée sur cette tablette et sera envoyée dès le retour du réseau.',
  );
  for (const t of [TEXTES_HORS_LIGNE.gardee, TEXTES_HORS_LIGNE.pasDImpression, TEXTES_HORS_LIGNE.stockageIndisponible]) {
    assert.doesNotMatch(t, /fetch|HTTP|\b[45]\d\d\b|erreur|failed|réseau indisponible/i);
    assert.doesNotMatch(t, / [:;?!]/, 'espace insécable avant la ponctuation haute');
  }
});
