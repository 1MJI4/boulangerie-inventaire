// src/app/api/gestion/route.ts
//
// Ouverture de l'accès gérant sur une tablette déjà installée.
// Propriétaire : agent `securite`.
//
// POST { code } : vérifie CODE_GESTION (durée constante, limite de tentatives
// par adresse, par tablette et globale) puis pose le cookie gérant signé, de
// courte durée, lié à cette tablette. Les routes réservées au gérant
// (tarifs, produits, gâteaux, réorganisation) ne lisent plus aucun code dans
// la requête : elles exigent ce cookie via `exigerRole(…, 'gerant')`.
//
// Réponse compatible avec les écrans existants :
//   succès → 200 { valide: true }
//   échec  → 403/429/503 { ok:false, niveau, code, message, error, valide:false, erreur }
//
// DELETE : referme l'accès gérant de cette tablette.

import { NextResponse } from 'next/server';
import { signaler } from '@/domaine/messages';
import { LIMITEURS_GERANT, verifierCode } from '@/lib/auth/codes';
import { NOM_COOKIE_GERANT, adresseClient, lireConfiguration, optionsCookie } from '@/lib/auth/config';
import { exigerRole, reponseEchec } from '@/lib/auth/garde';
import { creerJeton, dureeCookieSecondes, signerJeton } from '@/lib/auth/session';

export async function POST(request: Request) {
  const garde = exigerRole(request, 'tablette', 'ouvrir le profil manager');
  if (!garde.ok) return garde.reponse;

  const conf = lireConfiguration('gerant');
  if (!conf.ok) {
    const echec = signaler('ERR_CONFIGURATION_SERVEUR', { reference: conf.reference });
    return reponseEchec(echec, 503, { valide: false, erreur: echec.message });
  }

  let code: unknown = null;
  try {
    const corps: unknown = await request.json();
    if (corps && typeof corps === 'object') code = (corps as Record<string, unknown>).code;
  } catch {
    // Corps illisible : traité comme un code incorrect (et compté).
  }

  const maintenant = Date.now();
  const verdict = verifierCode(
    code,
    conf.code,
    [`ip:${adresseClient(request.headers)}`, `tablette:${garde.acces.appareil}`],
    LIMITEURS_GERANT,
    maintenant
  );
  if (!verdict.ok) {
    const statut = verdict.code === 'ERR_TROP_DE_TENTATIVES' ? 429 : 403;
    return reponseEchec(verdict, statut, { valide: false, erreur: verdict.message });
  }

  const jeton = creerJeton('gerant', garde.acces.appareil, maintenant);
  const reponse = NextResponse.json({ valide: true }, { headers: { 'Cache-Control': 'no-store' } });
  reponse.cookies.set(NOM_COOKIE_GERANT, signerJeton(jeton, conf.cle), optionsCookie(dureeCookieSecondes(jeton, maintenant)));
  return reponse;
}

export async function DELETE(request: Request) {
  const garde = exigerRole(request, 'tablette', 'fermer le profil manager');
  if (!garde.ok) return garde.reponse;
  const reponse = NextResponse.json({ valide: false }, { headers: { 'Cache-Control': 'no-store' } });
  reponse.cookies.set(NOM_COOKIE_GERANT, '', optionsCookie(0));
  return reponse;
}

export const dynamic = 'force-dynamic';
