// src/app/connexion/page.tsx
//
// Seule page accessible sans tablette installée. Vue une seule fois par
// tablette, le jour de son installation (code de tablette), puis plus jamais
// tant que la tablette sert au moins une fois tous les 180 jours.
// Elle se pose par-dessus la mise en page (z-[60]) : le sélecteur de profil de
// l'appareil (z-50) n'a pas de sens tant que la tablette n'est pas installée.
// Propriétaire : agent `securite`.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { signaler } from '@/domaine/messages';
import { cheminDeRetour } from '@/lib/auth/chemins';
import { NOM_COOKIE_TABLETTE, lireConfiguration } from '@/lib/auth/config';
import { verifierJeton } from '@/lib/auth/session';
import { retirerTablette } from './actions';
import { FormulaireConnexion } from './FormulaireConnexion';

export const metadata: Metadata = { title: 'Installation — PAin PAtisserie' };
export const dynamic = 'force-dynamic';

/** Tablette déjà installée ? (hors du rendu : l'heure est une entrée). */
async function tabletteInstallee(cle: Buffer): Promise<boolean> {
  const jeton = (await cookies()).get(NOM_COOKIE_TABLETTE)?.value;
  return verifierJeton(jeton, cle, 'tablette', Date.now()) !== null;
}

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametres = await searchParams;
  const suite = cheminDeRetour(parametres.suite);
  const conf = lireConfiguration('tablette');
  const installee = conf.ok && (await tabletteInstallee(conf.cle));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ground p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-ink">PAin PAtisserie</h1>

        {!conf.ok ? (
          <p role="alert" className="mt-4 text-sm text-ink text-pretty">
            {signaler('ERR_CONFIGURATION_SERVEUR', { reference: conf.reference }).message}
          </p>
        ) : installee ? (
          <>
            <p className="mt-2 text-sm text-ink-2 text-pretty">Cette tablette est installée.</p>
            <div className="mt-6 flex flex-col gap-2">
              <a
                href={suite}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-4 text-base font-medium text-white hover:bg-accent-fort"
              >
                Continuer
              </a>
              <form action={retirerTablette}>
                <button
                  type="submit"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-line-fort px-4 text-base text-ink hover:bg-surface-2"
                >
                  Retirer l’accès de cette tablette
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-2 text-pretty">
              Première ouverture sur cette tablette : saisissez le code de la tablette donné par
              le gérant. Il ne sera plus demandé ensuite.
            </p>
            <FormulaireConnexion suite={suite} />
          </>
        )}
      </div>
    </div>
  );
}
