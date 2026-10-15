'use server';

// src/app/connexion/actions.ts
//
// Installation d'une tablette (code de tablette, une seule fois) et retrait.
// Server Actions : postées sur /connexion, protégées par la vérification
// d'origine intégrée à Next. Propriétaire : agent `securite`.
// Rien n'est journalisé : ni le code saisi, ni l'adresse.

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signaler } from '@/domaine/messages';
import { cheminDeRetour, CHEMIN_CONNEXION } from '@/lib/auth/chemins';
import { LIMITEURS_TABLETTE, verifierCode } from '@/lib/auth/codes';
import {
  NOM_COOKIE_GERANT,
  NOM_COOKIE_TABLETTE,
  adresseClient,
  lireConfiguration,
  optionsCookie,
} from '@/lib/auth/config';
import { creerJeton, dureeCookieSecondes, nouvelAppareil, signerJeton } from '@/lib/auth/session';

export type EtatConnexion = { message: string | null };

export async function installerTablette(_etat: EtatConnexion, donnees: FormData): Promise<EtatConnexion> {
  const conf = lireConfiguration('tablette');
  if (!conf.ok) {
    return { message: signaler('ERR_CONFIGURATION_SERVEUR', { reference: conf.reference }).message };
  }

  const maintenant = Date.now();
  const adresse = adresseClient(await headers());
  const verdict = verifierCode(donnees.get('code'), conf.code, [`ip:${adresse}`], LIMITEURS_TABLETTE, maintenant);
  if (!verdict.ok) return { message: verdict.message };

  const jeton = creerJeton('tablette', nouvelAppareil(), maintenant);
  const pot = await cookies();
  pot.set(NOM_COOKIE_TABLETTE, signerJeton(jeton, conf.cle), optionsCookie(dureeCookieSecondes(jeton, maintenant)));
  pot.delete(NOM_COOKIE_GERANT);

  redirect(cheminDeRetour(donnees.get('suite')));
}

/** Retire l'accès de CETTE tablette (prêt, remplacement). Les autres ne bougent pas. */
export async function retirerTablette(): Promise<void> {
  const pot = await cookies();
  pot.delete(NOM_COOKIE_TABLETTE);
  pot.delete(NOM_COOKIE_GERANT);
  redirect(CHEMIN_CONNEXION);
}
