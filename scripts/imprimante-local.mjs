#!/usr/bin/env node
// Lance le Worker de l'imprimante en local (wrangler dev) sur la base de
// RECETTE Docker. La connexion est lue dans .env.recette et passée par
// variable d'environnement : elle n'est jamais écrite dans wrangler.jsonc.
// Usage : npm run recette:base, puis npm run imprimante:local
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const env = dotenv.config({ path: '.env.recette', quiet: true }).parsed ?? {};
const url = (env.DATABASE_URL ?? '').split('?')[0];
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('ARRÊT : .env.recette ne désigne pas la base de recette locale.');
  process.exit(1);
}
const enfant = spawn(
  'npx',
  ['wrangler', 'dev', '--config', 'cloudflare/imprimante/wrangler.jsonc', '--port', '8787', '--var', `CLOUDPRNT_CLE:${'t'.repeat(40)}`],
  { stdio: 'inherit', shell: true, env: { ...process.env, CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: url } },
);
enfant.on('exit', (code) => process.exit(code ?? 0));
