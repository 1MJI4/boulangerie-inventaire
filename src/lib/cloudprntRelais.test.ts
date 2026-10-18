// Relais CloudPRNT (netlify/functions/cloudprnt-relais.mjs) : la réponse part
// d'un seul bloc, avec sa taille, et ne transmet que ce que la route attend.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../netlify/functions/cloudprnt-relais.mjs';

type Appel = { url: string; init: RequestInit };

function faux(statut: number, corps: Uint8Array<ArrayBuffer> | string, type: string) {
  const appels: Appel[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    appels.push({ url, init });
    return new Response(corps, { status: statut, headers: { 'content-type': type } });
  };
  return { appels, fetch };
}

const env = { URL: 'https://site.exemple', DEPLOY_URL: 'https://deploiement--site.exemple' };
const CLE = 'Abc_def-123';

test('GET du ticket : corps intact, Content-Length exact, appel vers la route de l’application', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);
  const f = faux(200, png, 'image/png');
  const r = await handler(
    { httpMethod: 'GET', path: `/.netlify/functions/cloudprnt-relais/${CLE}`, rawQuery: 'mac=00%3A11&type=image%2Fpng' },
    {},
    { env, fetch: f.fetch },
  );
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['Content-Type'], 'image/png');
  assert.equal(r.headers['Content-Length'], String(png.length));
  assert.ok(r.isBase64Encoded);
  assert.deepEqual(new Uint8Array(Buffer.from(r.body, 'base64')), png);
  assert.equal(f.appels[0].url, `https://deploiement--site.exemple/api/cloudprnt/${CLE}?mac=00%3A11&type=image%2Fpng`);
  assert.equal(f.appels[0].init.method, 'GET');
});

test('POST du sondage : corps JSON transmis, réponse JSON avec sa taille', async () => {
  const f = faux(200, '{"jobReady":true}', 'application/json');
  const r = await handler(
    {
      httpMethod: 'POST',
      path: `/.netlify/functions/cloudprnt-relais/${CLE}`,
      rawQuery: '',
      body: Buffer.from('{"statusCode":"200 OK"}').toString('base64'),
      isBase64Encoded: true,
      headers: { 'content-type': 'application/json' },
    },
    {},
    { env, fetch: f.fetch },
  );
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['Content-Length'], String('{"jobReady":true}'.length));
  assert.equal(Buffer.from(f.appels[0].init.body as Buffer).toString(), '{"statusCode":"200 OK"}');
  assert.equal((f.appels[0].init.headers as Record<string, string>)['Content-Type'], 'application/json');
});

test('DELETE de confirmation : code transmis tel quel', async () => {
  const f = faux(200, '', 'text/plain');
  const r = await handler(
    { httpMethod: 'DELETE', path: `/.netlify/functions/cloudprnt-relais/${CLE}/`, rawQuery: 'code=OK' },
    {},
    { env, fetch: f.fetch },
  );
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['Content-Length'], '0');
  assert.equal(f.appels[0].url, `https://deploiement--site.exemple/api/cloudprnt/${CLE}?code=OK`);
});

test('refus du relais : méthode inattendue, clé illisible, statut de la route conservé', async () => {
  const f = faux(403, '', 'text/plain');
  const put = await handler({ httpMethod: 'PUT', path: `/.netlify/functions/cloudprnt-relais/${CLE}` }, {}, { env, fetch: f.fetch });
  assert.equal(put.statusCode, 405);
  const injection = await handler(
    { httpMethod: 'GET', path: '/.netlify/functions/cloudprnt-relais/../../api/commandes' },
    {},
    { env, fetch: f.fetch },
  );
  assert.equal(injection.statusCode, 403);
  assert.equal(f.appels.length, 0, 'rien ne part vers l’application');
  const refusee = await handler({ httpMethod: 'POST', path: `/.netlify/functions/cloudprnt-relais/${CLE}` }, {}, { env, fetch: f.fetch });
  assert.equal(refusee.statusCode, 403, 'la route décide de la clé');
});

test('application injoignable : 502 propre, l’imprimante réessaie au sondage suivant', async () => {
  const r = await handler(
    { httpMethod: 'POST', path: `/.netlify/functions/cloudprnt-relais/${CLE}` },
    {},
    { env, fetch: async () => { throw new Error('réseau'); } },
  );
  assert.equal(r.statusCode, 502);
});
