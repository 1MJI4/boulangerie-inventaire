// src/lib/serveur/cloudprnt.ts
//
// Le point de rendez-vous avec l'imprimante Star (protocole CloudPRNT).
//
// Le sens de la conversation est inversé par rapport à une impression
// classique : ce n'est pas l'application qui pousse vers l'imprimante, c'est
// l'imprimante qui vient demander du travail. C'est ce qui permet d'imprimer
// depuis un iPad, depuis le téléphone du manager le soir, depuis n'importe
// quoi — aucun pilote nulle part, aucune machine à laisser allumée au
// comptoir.
//
// Le dialogue, tel que Star le définit :
//   POST   → l'imprimante dit bonjour et donne son état. On répond s'il y a
//            du travail et dans quel format on sait le servir.
//   GET    → elle vient chercher le document. On renvoie le PNG.
//   DELETE → elle confirme avoir imprimé (« 200 OK ») ou signale l'échec.
//
// La confirmation est ce qui compte vraiment : c'est seulement quand le
// dernier exemplaire est sorti qu'on marque la commande imprimée.
//
// Ce module ne dépend ni de Next, ni de Netlify, ni d'un client de base : il
// parle à un `DepotImprimante` (deux implémentations : Prisma pour la route
// Next de secours, PostgreSQL léger pour la fonction Netlify dédiée, qui doit
// se réveiller en moins d'une seconde — voir depotImprimante.ts).
//
// Accès : l'imprimante ne sait pas ouvrir de session ; elle est authentifiée
// par la clé de son URL, et uniquement pour lire et acquitter des travaux
// d'impression. La clé n'est JAMAIS journalisée ni renvoyée dans une réponse.

import { createHash, timingSafeEqual } from 'node:crypto';
import { confirmationReussie } from '../cloudprnt.ts';
import { MEDIA_STARPRNT, pngVersStarPrnt } from './starprnt.ts';

export type TravailEnFile = { id: number; media: string; contenu: Uint8Array };
export type TravailRemis = { id: number; commandeId: number | null };

/** Tout ce dont le dialogue a besoin dans la base, et rien de plus. */
export interface DepotImprimante {
  /** Enregistre l'état annoncé par l'imprimante (réglage « imprimante:etat »). */
  noterEtat(valeur: string): Promise<void>;
  /** Média du premier travail en attente, sans son contenu (sondage léger). */
  mediaEnAttente(): Promise<string | null>;
  /** Premier travail en attente, contenu compris. */
  travailEnAttente(): Promise<TravailEnFile | null>;
  marquerRemis(id: number): Promise<void>;
  premierRemis(): Promise<TravailRemis | null>;
  marquerImprime(id: number): Promise<void>;
  remettreEnFile(id: number, erreur: string): Promise<void>;
  /** Exemplaires de la commande pas encore imprimés. */
  resteAImprimer(commandeId: number): Promise<number>;
  /**
   * Passe la commande « imprimée » si elle était « à imprimer », et trace
   * l'événement. Rien sinon.
   */
  conclureCommande(commandeId: number): Promise<void>;
}

/**
 * Longueur minimale de CLOUDPRNT_CLE. Une clé courte se devine ; en dessous,
 * on refuse tout.
 * HYPOTHÈSE À VALIDER : 32 caractères (clé aléatoire générée, jamais choisie).
 */
const LONGUEUR_MIN_CLE = 32;

function empreinte(valeur: string): Buffer {
  return createHash('sha256').update(valeur, 'utf8').digest();
}

/** L'URL configurée dans l'imprimante contient cette clé. Sans elle, rien. */
export function cleValide(cle: string, attendue: string | undefined): boolean {
  // Pas de clé configurée (ou trop courte) : on refuse tout plutôt que d'ouvrir
  // une file d'impression publique à qui passe.
  if (!attendue || attendue.length < LONGUEUR_MIN_CLE) return false;
  if (typeof cle !== 'string' || cle.length > 256) return false;
  // Comparaison à durée constante sur des empreintes de même longueur : le
  // temps de réponse ne révèle ni la clé ni sa longueur.
  return timingSafeEqual(empreinte(cle), empreinte(attendue));
}

const SANS_CACHE = { 'Cache-Control': 'no-store' };

function json(corps: unknown, status = 200): Response {
  const texte = JSON.stringify(corps);
  return new Response(texte, {
    status,
    headers: { ...SANS_CACHE, 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(texte)) },
  });
}

function vide(status: number): Response {
  return new Response(null, { status, headers: { ...SANS_CACHE, 'Content-Length': '0' } });
}

/* ------------------------------------------------ POST : le sondage */

async function sondage(requete: Request, depot: DepotImprimante): Promise<Response> {
  let corps: Record<string, unknown> = {};
  try {
    corps = await requete.json();
  } catch {
    // Certaines versions de firmware sondent sans corps. Ce n'est pas une
    // erreur : on répond quand même.
  }
  const statusCode = typeof corps.statusCode === 'string' ? corps.statusCode : '';
  const mac = typeof corps.printerMAC === 'string' ? corps.printerMAC : null;
  const etat = JSON.stringify({ statusCode, mac, vueLe: new Date().toISOString() });

  // Les deux accès en parallèle : la réponse part plus vite. L'état n'est
  // qu'informatif : son échec ne doit jamais empêcher d'imprimer.
  const [, media] = await Promise.all([depot.noterEtat(etat).catch(() => {}), depot.mediaEnAttente()]);

  return json({
    jobReady: media !== null,
    // Ticket PNG : le format natif d'abord (plus rapide, rien à décoder), le PNG
    // en secours — l'imprimante prend le premier qu'elle sait lire (22/10/2026).
    mediaTypes: media === null ? [] : media === 'image/png' ? [MEDIA_STARPRNT, media] : [media],
    // L'imprimante confirmera par DELETE ; c'est le comportement par défaut,
    // on l'énonce quand même pour ne dépendre d'aucune valeur implicite.
    deleteMethod: 'DELETE',
  });
}

/* --------------------------------------- GET : elle vient chercher */

async function remise(url: URL, depot: DepotImprimante): Promise<Response> {
  const travail = await depot.travailEnAttente();
  if (!travail) return vide(404);
  // Format choisi par l'imprimante parmi ceux proposés au sondage.
  const demande = url.searchParams.get('type');

  // « remis » et pas « imprimé » : le papier n'est pas encore sorti. Si
  // l'imprimante tombe entre les deux, le travail reste visible comme non
  // terminé au lieu de disparaître en silence.
  await depot.marquerRemis(travail.id);

  let media = travail.media;
  let octets = Buffer.from(travail.contenu);
  if (demande === MEDIA_STARPRNT && media === 'image/png') {
    const natif = pngVersStarPrnt(travail.contenu);
    // PNG inattendu : on sert le PNG plutôt que rien.
    if (natif) {
      media = MEDIA_STARPRNT;
      octets = Buffer.from(natif);
    }
  }
  // Une ligne par ticket servi, pour mesurer (journal du serveur, jamais la clé).
  console.info(`[imprimante] ticket ${travail.id} servi en ${media} (${octets.length} octets)`);
  return new Response(octets, {
    status: 200,
    headers: { ...SANS_CACHE, 'Content-Type': media, 'Content-Length': String(octets.length) },
  });
}

/* --------------------------------- DELETE : elle confirme avoir imprimé */

async function confirmation(url: URL, depot: DepotImprimante): Promise<Response> {
  const code = url.searchParams.get('code') ?? 'OK';
  const reussi = confirmationReussie(code);

  const travail = await depot.premierRemis();
  if (!travail) return vide(200);

  if (!reussi) {
    // Un échec repart en file : le vendeur remet du papier, l'imprimante
    // reprend toute seule là où elle s'était arrêtée.
    await depot.remettreEnFile(travail.id, code);
    return vide(200);
  }

  await depot.marquerImprime(travail.id);
  // Tous les exemplaires sortis : c'est maintenant, et seulement maintenant,
  // que la commande est vraiment imprimée.
  if (travail.commandeId && (await depot.resteAImprimer(travail.commandeId)) === 0) {
    await depot.conclureCommande(travail.commandeId);
  }
  return vide(200);
}

/**
 * Répond à un appel de l'imprimante. `cle` : dernier segment de l'adresse ;
 * `cleAttendue` : CLOUDPRNT_CLE de l'environnement.
 */
export async function repondreImprimante(
  requete: Request,
  cle: string,
  depot: DepotImprimante,
  cleAttendue: string | undefined,
): Promise<Response> {
  if (!cleValide(cle, cleAttendue)) {
    return requete.method === 'POST' ? json({ jobReady: false }, 403) : vide(403);
  }
  switch (requete.method) {
    case 'POST':
      return sondage(requete, depot);
    case 'GET':
      return remise(new URL(requete.url), depot);
    case 'DELETE':
      return confirmation(new URL(requete.url), depot);
    default:
      return vide(405);
  }
}
