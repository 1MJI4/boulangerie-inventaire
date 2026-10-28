// node --test src/lib/serveur/cloudprnt.test.ts
// Dialogue CloudPRNT complet sur un dépôt factice en mémoire : sondage, remise
// du ticket, confirmation « 200 OK », échec qui repart en file, commande
// marquée imprimée au dernier exemplaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repondreImprimante, type DepotImprimante } from './cloudprnt.ts';

const CLE = 'k'.repeat(40);
const URL_IMPRIMANTE = `https://site.exemple/api/cloudprnt/${CLE}`;

type Travail = {
  id: number;
  commandeId: number | null;
  statut: string;
  media: string;
  contenu: Uint8Array;
  erreur: string | null;
};

function depot(travaux: Travail[], statutCommande = 'a_imprimer') {
  const etat = { reglage: null as string | null, commande: statutCommande, evenements: 0, echecEtat: false };
  const premier = (statut: string) => travaux.filter((t) => t.statut === statut).sort((a, b) => a.id - b.id)[0] ?? null;
  const trouver = (id: number) => travaux.find((t) => t.id === id)!;
  const d: DepotImprimante = {
    async noterEtat(valeur) {
      if (etat.echecEtat) throw new Error('base indisponible');
      etat.reglage = valeur;
    },
    async mediaEnAttente() {
      return premier('en_attente')?.media ?? null;
    },
    async travailEnAttente() {
      const t = premier('en_attente');
      return t ? { id: t.id, commandeId: t.commandeId, media: t.media, contenu: t.contenu } : null;
    },
    async suiteEnAttente(commandeId, apresId) {
      return travaux
        .filter((t) => t.commandeId === commandeId && t.statut === 'en_attente' && t.id > apresId)
        .sort((a, b) => a.id - b.id)
        .map((t) => ({ id: t.id, commandeId: t.commandeId, media: t.media, contenu: t.contenu }));
    },
    async remisDeCommande(commandeId) {
      return travaux
        .filter((t) => t.commandeId === commandeId && t.statut === 'remis')
        .sort((a, b) => a.id - b.id)
        .map((t) => t.id);
    },
    async marquerRemis(id) {
      trouver(id).statut = 'remis';
    },
    async premierRemis() {
      const t = premier('remis');
      return t ? { id: t.id, commandeId: t.commandeId } : null;
    },
    async marquerImprime(id) {
      Object.assign(trouver(id), { statut: 'imprime', erreur: null });
    },
    async remettreEnFile(id, erreur) {
      Object.assign(trouver(id), { statut: 'en_attente', erreur });
    },
    async resteAImprimer(commandeId) {
      return travaux.filter((t) => t.commandeId === commandeId && t.statut !== 'imprime').length;
    },
    async conclureCommande() {
      if (etat.commande !== 'a_imprimer') return;
      etat.commande = 'imprimee';
      etat.evenements++;
    },
  };
  return { d, etat, travaux };
}

const ticket = (id: number): Travail => ({
  id,
  commandeId: 12,
  statut: 'en_attente',
  media: 'image/png',
  contenu: new Uint8Array([0x89, 0x50, 0x4e, 0x47, id]),
  erreur: null,
});

const appel = (method: string, chemin = '', corps?: string) =>
  new Request(URL_IMPRIMANTE + chemin, { method, body: corps, headers: corps ? { 'Content-Type': 'application/json' } : {} });

test('clé absente, fausse ou trop courte : refus sans toucher à la base', async () => {
  const { d, etat } = depot([ticket(1)]);
  assert.equal((await repondreImprimante(appel('POST', '', '{}'), 'faux', d, CLE)).status, 403);
  assert.equal((await repondreImprimante(appel('GET'), CLE, d, undefined)).status, 403);
  assert.equal((await repondreImprimante(appel('GET'), 'court', d, 'court')).status, 403);
  assert.equal(etat.reglage, null);
});

test('les 4 exemplaires sortent dans l’ordre, la commande passe « imprimée » au dernier', async () => {
  const { d, etat, travaux } = depot([ticket(1), ticket(2), ticket(3), ticket(4)]);
  for (const attendu of [1, 2, 3, 4]) {
    const sonde = await repondreImprimante(appel('POST', '', '{"statusCode":"200 OK","printerMAC":"00:11"}'), CLE, d, CLE);
    assert.deepEqual(await sonde.json(), { jobReady: true, mediaTypes: ['application/vnd.star.starprnt', 'image/png'], deleteMethod: 'DELETE' });
    const png = await repondreImprimante(appel('GET', '?type=image%2Fpng'), CLE, d, CLE);
    assert.equal(png.status, 200);
    assert.equal(png.headers.get('Content-Type'), 'image/png');
    const octets = new Uint8Array(await png.arrayBuffer());
    assert.equal(png.headers.get('Content-Length'), String(octets.length));
    assert.equal(octets[4], attendu, `exemplaire n°${attendu}`);
    assert.equal(etat.commande, 'a_imprimer', 'pas imprimée avant la confirmation du dernier exemplaire');
    assert.equal((await repondreImprimante(appel('DELETE', '?code=200+OK'), CLE, d, CLE)).status, 200);
  }
  assert.ok(travaux.every((t) => t.statut === 'imprime'));
  assert.equal(etat.commande, 'imprimee');
  assert.equal(etat.evenements, 1);
  assert.match(etat.reglage ?? '', /"statusCode":"200 OK"/);
  const fin = await repondreImprimante(appel('POST', '', '{}'), CLE, d, CLE);
  assert.equal((await fin.json()).jobReady, false);
});

test('échec signalé (« 511 Media Decoding Error ») : le ticket repart en file avec son erreur', async () => {
  const { d, travaux, etat } = depot([ticket(1)]);
  await repondreImprimante(appel('GET'), CLE, d, CLE);
  assert.equal(travaux[0].statut, 'remis');
  await repondreImprimante(appel('DELETE', '?code=511+Media+Decoding+Error'), CLE, d, CLE);
  assert.equal(travaux[0].statut, 'en_attente');
  assert.equal(travaux[0].erreur, '511 Media Decoding Error');
  assert.equal(etat.commande, 'a_imprimer');
});

test('état de l’imprimante impossible à noter : le sondage répond quand même', async () => {
  const { d, etat } = depot([ticket(1)]);
  etat.echecEtat = true;
  const r = await repondreImprimante(appel('POST', '', '{}'), CLE, d, CLE);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).jobReady, true);
});

test('sondage sans corps (certains firmwares) et file vide : réponse propre', async () => {
  const { d } = depot([]);
  const r = await repondreImprimante(appel('POST'), CLE, d, CLE);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).jobReady, false);
  assert.equal((await repondreImprimante(appel('GET'), CLE, d, CLE)).status, 404);
  assert.equal((await repondreImprimante(appel('DELETE', '?code=200+OK'), CLE, d, CLE)).status, 200);
  assert.equal((await repondreImprimante(appel('PUT'), CLE, d, CLE)).status, 405);
});

test('état de l’imprimante : réécrit s’il change, pas à chaque sondage', async () => {
  const { d } = depot([]);
  let ecritures = 0;
  const noter = d.noterEtat.bind(d);
  d.noterEtat = async (v) => {
    ecritures++;
    return noter(v);
  };
  const sonder = (statut: string) =>
    repondreImprimante(appel('POST', '', JSON.stringify({ statusCode: statut, printerMAC: '00:11' })), CLE, d, CLE);
  await sonder('200 OK');
  await sonder('200 OK');
  await sonder('200 OK');
  assert.equal(ecritures, 1, 'même état, moins de 30 s : une seule écriture');
  await sonder('410 Paper Empty');
  assert.equal(ecritures, 2, 'changement d’état : écrit tout de suite');
});

test('en StarPRNT, les 4 exemplaires partent en un seul envoi, coupés entre eux, et se confirment ensemble', async () => {
  const { deflateSync } = await import('node:zlib');
  const { pngMonochrome } = await import('../pngMonochrome.ts');
  const points = new Uint8ClampedArray(10 * 2 * 4).fill(255);
  const png = await pngMonochrome(points, 10, 2, async (d) => new Uint8Array(deflateSync(d)));
  const vrai = (id: number): Travail => ({ ...ticket(id), contenu: png });
  // Un exemplaire d'une autre commande attend derrière : il ne doit pas partir avec.
  const { d, etat, travaux } = depot([vrai(1), vrai(2), vrai(3), vrai(4), { ...vrai(5), commandeId: 13 }]);

  const natif = await repondreImprimante(appel('GET', '?type=application%2Fvnd.star.starprnt'), CLE, d, CLE);
  assert.equal(natif.headers.get('Content-Type'), 'application/vnd.star.starprnt');
  const octets = new Uint8Array(await natif.arrayBuffer());
  // Chaque ticket fait 18 octets et finit par sa coupe (ESC d 3).
  assert.equal(octets.length, 4 * 18);
  for (let n = 1; n <= 4; n++) assert.deepEqual([...octets.subarray(n * 18 - 3, n * 18)], [0x1b, 0x64, 0x03]);
  assert.deepEqual(travaux.map((t) => t.statut), ['remis', 'remis', 'remis', 'remis', 'en_attente']);

  assert.equal((await repondreImprimante(appel('DELETE', '?code=200+OK'), CLE, d, CLE)).status, 200);
  assert.deepEqual(travaux.map((t) => t.statut), ['imprime', 'imprime', 'imprime', 'imprime', 'en_attente']);
  assert.equal(etat.commande, 'imprimee');
  assert.equal(etat.evenements, 1);
});

test('envoi groupé en échec : les 4 exemplaires repartent en file ensemble', async () => {
  const { deflateSync } = await import('node:zlib');
  const { pngMonochrome } = await import('../pngMonochrome.ts');
  const points = new Uint8ClampedArray(10 * 2 * 4).fill(255);
  const png = await pngMonochrome(points, 10, 2, async (d) => new Uint8Array(deflateSync(d)));
  const { d, etat, travaux } = depot([1, 2, 3, 4].map((id) => ({ ...ticket(id), contenu: png })));
  await repondreImprimante(appel('GET', '?type=application%2Fvnd.star.starprnt'), CLE, d, CLE);
  await repondreImprimante(appel('DELETE', '?code=520+Download+failed'), CLE, d, CLE);
  assert.ok(travaux.every((t) => t.statut === 'en_attente' && t.erreur === '520 Download failed'));
  assert.equal(etat.commande, 'a_imprimer');
});
