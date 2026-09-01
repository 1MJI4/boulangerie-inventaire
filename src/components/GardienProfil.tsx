'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfil } from './ProfilAppareil';
import { DEFINITIONS, LIBELLES_ECRANS, ecranAutorise } from '@/lib/profils';

/**
 * Empêche d'afficher un écran hors du profil de l'appareil — typiquement en
 * arrivant par un favori ou un lien collé. Ce n'est pas une barrière de
 * sécurité (le code de gestion s'en charge côté serveur) mais un garde-fou :
 * on explique et on propose une sortie, plutôt que de rediriger sans un mot.
 */
export function GardienProfil({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const { profil, prete, ouvrirSelecteur } = useProfil();

  // Avant lecture du profil, on ne rend rien : le sélecteur s'affiche par-dessus.
  if (!prete || !profil) return null;

  if (ecranAutorise(profil, chemin)) return <>{children}</>;

  const definition = DEFINITIONS[profil];

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold text-ink text-balance">
        Cet écran n’est pas dans le profil {definition.libelle}
      </h1>
      <p className="mt-2 text-sm text-ink-2 text-pretty">
        Cette tablette est réglée sur « {definition.libelle} » : {definition.description.toLowerCase()}.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href={definition.accueil}
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-fort"
        >
          Aller à {LIBELLES_ECRANS[definition.accueil] ?? 'mon écran'}
        </Link>
        <button
          type="button"
          onClick={ouvrirSelecteur}
          className="inline-flex min-h-11 items-center rounded-lg border border-line-fort px-4 text-sm text-ink hover:bg-surface-2"
        >
          Changer de profil
        </button>
      </div>
    </div>
  );
}
