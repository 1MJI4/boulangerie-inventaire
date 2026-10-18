// netlify/functions/cloudprnt-relais.mjs
//
// Relais entre l'imprimante Star (CloudPRNT) et la route de l'application
// (src/app/api/cloudprnt/[cle]/route.ts).
//
// Pourquoi : sur Netlify, les réponses de Next.js partent « en morceaux »
// (Transfer-Encoding: chunked), sans Content-Length. La TSP100IV (CloudPRNT
// 5.1) imprime le ticket mais ne voit jamais la fin de la réponse : elle
// attend son délai maximal, n'envoie pas la confirmation (DELETE) et ralentit
// tout le reste de la file (constaté le 18/10/2026 : « 520 Download failed »,
// un seul exemplaire sur quatre).
//
// Ce relais est une fonction Netlify « classique » (réponse tamponnée) : il
// appelle la route de l'application, lit TOUTE la réponse, puis la renvoie
// d'un seul bloc, avec sa taille. Aucune logique métier ici, aucun accès à la
// base : la clé est vérifiée par la route, comme avant.
//
// Adresse à saisir dans l'imprimante (Server URL) :
//   https://<site>/.netlify/functions/cloudprnt-relais/<CLOUDPRNT_CLE>

const PREFIXE = '/.netlify/functions/cloudprnt-relais/';
const METHODES = new Set(['GET', 'POST', 'DELETE']);
/** Une clé n'a que ces caractères (base64url) : rien d'autre ne part vers la route. */
const CLE_LISIBLE = /^[A-Za-z0-9_-]{1,256}$/;

/** Site à appeler : ce déploiement-ci d'abord (aperçus), sinon l'adresse principale. */
function origine(env) {
  return env.DEPLOY_URL || env.URL || '';
}

function reponse(statusCode, corps, typeContenu) {
  const octets = Buffer.isBuffer(corps) ? corps : Buffer.from(corps ?? '', 'utf8');
  return {
    statusCode,
    headers: {
      'Content-Type': typeContenu || 'text/plain; charset=utf-8',
      'Content-Length': String(octets.length),
      'Cache-Control': 'no-store',
    },
    body: octets.toString('base64'),
    isBase64Encoded: true,
  };
}

export async function handler(event, _contexte, dependances = {}) {
  const env = dependances.env ?? process.env;
  const appeler = dependances.fetch ?? fetch;

  if (!METHODES.has(event.httpMethod)) return reponse(405, '');
  const chemin = String(event.path ?? '');
  const i = chemin.indexOf(PREFIXE);
  const cle = i >= 0 ? chemin.slice(i + PREFIXE.length).replace(/\/+$/, '') : '';
  if (!CLE_LISIBLE.test(cle)) return reponse(403, '');

  const base = origine(env);
  if (!base) return reponse(503, '');
  const requete = event.rawQuery ? `?${event.rawQuery}` : '';
  const cible = `${base}/api/cloudprnt/${cle}${requete}`;

  const corps =
    event.httpMethod === 'POST' && event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
      : undefined;
  const typeEntrant = event.headers?.['content-type'] ?? event.headers?.['Content-Type'];

  let r;
  try {
    r = await appeler(cible, {
      method: event.httpMethod,
      headers: typeEntrant ? { 'Content-Type': typeEntrant } : {},
      body: corps,
      redirect: 'manual',
    });
  } catch {
    // Application injoignable : l'imprimante réessaiera au prochain sondage.
    return reponse(502, '');
  }
  const octets = Buffer.from(await r.arrayBuffer());
  return reponse(r.status, octets, r.headers.get('content-type'));
}
