// scripts/imprimante-simulee.mjs
//
// Joue le role de la Star TSP143IV avant qu'elle n'arrive, et sert ensuite a
// verifier la chaine sans gaspiller de rouleau.
//
//   node scripts/imprimante-simulee.mjs
//
// Elle sonde, recupere les tickets, les ecrit dans .tickets-recus/ et confirme
// exactement comme le ferait la machine. Ouvrir les PNG obtenus, c'est voir ce
// qui sortirait du rouleau.

import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    })
);

const BASE = process.env.BASE ?? 'http://localhost:3000';
const CLE = process.env.CLOUDPRNT_CLE ?? env.CLOUDPRNT_CLE;
const URL_IMPRIMANTE = `${BASE}/api/cloudprnt/${CLE}`;
const DOSSIER = new URL('../.tickets-recus/', import.meta.url);
const INTERVALLE = Number(process.env.INTERVALLE ?? 3000);

if (!CLE) {
  console.error('CLOUDPRNT_CLE absente du .env.');
  process.exit(1);
}
mkdirSync(DOSSIER, { recursive: true });
// La cle ne s'affiche jamais : un terminal se copie, se partage, s'enregistre.
console.log('Imprimante simulee sur', `${BASE}/api/cloudprnt/[cle masquee]`);
console.log('Sondage toutes les', INTERVALLE / 1000, 's. Ctrl+C pour arreter.\n');

let recus = 0;

async function tour() {
  const sondage = await fetch(URL_IMPRIMANTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Online',
      statusCode: '200 OK',
      printerMAC: '00:11:62:SIMULEE',
      uniqueID: 'simulation',
      printingInProgress: false,
    }),
  });
  if (!sondage.ok) {
    console.error('Sondage refuse :', sondage.status, await sondage.text());
    return;
  }
  const reponse = await sondage.json();
  if (!reponse.jobReady) {
    process.stdout.write('.');
    return;
  }

  const type = (reponse.mediaTypes ?? ['image/png'])[0];
  const job = await fetch(`${URL_IMPRIMANTE}?uid=simulation&mac=00:11:62:SIMULEE&type=${encodeURIComponent(type)}`);
  if (!job.ok) {
    console.error('\nRecuperation refusee :', job.status);
    return;
  }
  const octets = Buffer.from(await job.arrayBuffer());
  recus += 1;
  const nom = `ticket-${String(recus).padStart(2, '0')}.png`;
  writeFileSync(new URL(nom, DOSSIER), octets);
  console.log(`\n${nom} : ${octets.length} octets, ${type}`);

  await fetch(`${URL_IMPRIMANTE}?uid=simulation&mac=00:11:62:SIMULEE&code=OK`, { method: 'DELETE' });
  console.log('  confirme imprime');
}

setInterval(() => {
  // Un message d'erreur de fetch peut recopier l'URL : on y masque la cle.
  tour().catch((e) => console.error('\n', String(e?.message ?? e).split(CLE).join('[cle masquee]')));
}, INTERVALLE);
