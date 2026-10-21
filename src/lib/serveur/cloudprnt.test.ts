// node --test src/lib/serveur/cloudprnt.test.ts
// Dialogue CloudPRNT complet sur une base factice en mémoire : sondage, remise
// du ticket, confirmation « 200 OK », échec qui repart en file, commande
// marquée imprimée au dernier exemplaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repondreImprimante, type BaseImprimante } from './cloudprnt.ts';

const CLE = 'k'.repeat(40);
const URL_IMPRIMANTE = `https://site.exemple/api/cloudprnt/${CLE}`;

type Travail = {
  id: number;
  commandeId: number | null;
  destination: string;
  statut: string;
  media: string;
  contenu: Uint8Array;
  erreur: string | null;
};

function base(travaux: Travail[], statutCommande = 'a_imprimer') {
  const etat: { reglage: string | null; commande: string; evenements: number } = {
    reglage: null,
    commande: statutCommande,
    evenements: 0,
  };
  const premier = (statut: string) => travaux.filter((t) => t.statut === statut).sort((a, b) => a.id - b.id)[0] ?? null;
  const db = {
    reglage: {
      upsert: async ({ update }: { update: { valeur: string } }) => {
        etat.reglage = update.valeur;
        return {};
      },
    },
    travailImpression: {
      findFirst: async ({ where }: { where: { statut: string } }) => premier(where.statut),
      update: async ({ where, data }: { where: { id: number }; data: Partial<Travail> }) => {
        const t = travaux.find((x) => x.id === where.id)!;
        Object.assign(t, data);
        return t;
      },
      count: async ({ where }: { where: { commandeId: number } }) =>
        travaux.filter((t) => t.commandeId === where.commandeId && t.statut !== 'imprime').length,
    },
    commande: {
      findUnique: async () => ({ statut: etat.commande }),
      update: async ({ data }: { data: { statut: string } }) => {
        etat.commande = data.statut;
        return {};
      },
    },
    evenementCommande: {
      create: async () => {
        etat.evenements++;
        return {};
      },
    },
  } as unknown as BaseImprimante;
  return { db, etat, travaux };
}

const ticket = (id: number, destination: string): Travail => ({
  id,
  commandeId: 12,
  destination,
  statut: 'en_attente',
  media: 'image/png',
  contenu: new Uint8Array([0x89, 0x50, 0x4e, 0x47, id]),
  erreur: null,
});

const appel = (method: string, chemin = '', corps?: string) =>
  new Request(URL_IMPRIMANTE + chemin, { method, body: corps, headers: corps ? { 'Content-Type': 'application/json' } : {} });

test('clé absente, fausse ou trop courte : refus sans toucher à la base', async () => {
  const { db, etat } = base([ticket(1, 'CLIENT')]);
  assert.equal((await repondreImprimante(appel('POST', '', '{}'), 'faux', db, CLE)).status, 403);
  assert.equal((await repondreImprimante(appel('GET'), CLE, db, undefined)).status, 403);
  assert.equal((await repondreImprimante(appel('GET'), 'court', db, 'court')).status, 403);
  assert.equal(etat.reglage, null);
});

test('les 4 exemplaires sortent dans l’ordre, la commande passe « imprimée » au dernier', async () => {
  const { db, etat, travaux } = base([ticket(1, 'CLIENT'), ticket(2, 'BUREAU'), ticket(3, 'MAGASIN'), ticket(4, 'ATELIER')]);
  for (const attendu of [1, 2, 3, 4]) {
    const sonde = await repondreImprimante(appel('POST', '', '{"statusCode":"200 OK","printerMAC":"00:11"}'), CLE, db, CLE);
    assert.deepEqual(await sonde.json(), { jobReady: true, mediaTypes: ['image/png'], deleteMethod: 'DELETE' });
    const png = await repondreImprimante(appel('GET', '?type=image%2Fpng'), CLE, db, CLE);
    assert.equal(png.status, 200);
    assert.equal(png.headers.get('Content-Type'), 'image/png');
    const octets = new Uint8Array(await png.arrayBuffer());
    assert.equal(png.headers.get('Content-Length'), String(octets.length));
    assert.equal(octets[4], attendu, `exemplaire n°${attendu}`);
    const ok = await repondreImprimante(appel('DELETE', '?code=200+OK'), CLE, db, CLE);
    assert.equal(ok.status, 200);
  }
  assert.ok(travaux.every((t) => t.statut === 'imprime'));
  assert.equal(etat.commande, 'imprimee');
  assert.equal(etat.evenements, 1);
  assert.match(etat.reglage ?? '', /"statusCode":"200 OK"/);
  const fin = await repondreImprimante(appel('POST', '', '{}'), CLE, db, CLE);
  assert.equal((await fin.json()).jobReady, false);
});

test('échec signalé (« 511 Media Decoding Error ») : le ticket repart en file avec son erreur', async () => {
  const { db, travaux, etat } = base([ticket(1, 'CLIENT')]);
  await repondreImprimante(appel('GET'), CLE, db, CLE);
  assert.equal(travaux[0].statut, 'remis');
  await repondreImprimante(appel('DELETE', '?code=511+Media+Decoding+Error'), CLE, db, CLE);
  assert.equal(travaux[0].statut, 'en_attente');
  assert.equal(travaux[0].erreur, '511 Media Decoding Error');
  assert.equal(etat.commande, 'a_imprimer');
});

test('sondage sans corps (certains firmwares) et file vide : réponse propre', async () => {
  const { db } = base([]);
  const r = await repondreImprimante(appel('POST'), CLE, db, CLE);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).jobReady, false);
  assert.equal((await repondreImprimante(appel('GET'), CLE, db, CLE)).status, 404);
  assert.equal((await repondreImprimante(appel('DELETE', '?code=200+OK'), CLE, db, CLE)).status, 200);
  assert.equal((await repondreImprimante(appel('PUT'), CLE, db, CLE)).status, 405);
});
