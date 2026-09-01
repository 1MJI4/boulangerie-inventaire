'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BandeauOnglets } from './BandeauOnglets';
import { useProfil } from './ProfilAppareil';
import { DEFINITIONS, LIBELLES_ECRANS } from '@/lib/profils';

export function BarreNavigation() {
  const chemin = usePathname();
  const { profil, prete, ouvrirSelecteur } = useProfil();

  // Tant que le profil n'est pas lu, on n'affiche aucun lien : afficher tous
  // les écrans une fraction de seconde avant de les retirer donnerait
  // l'impression que l'application se referme.
  const ecrans = prete && profil ? DEFINITIONS[profil].ecrans : [];

  return (
    <header className="sans-impression sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link
          href={profil ? DEFINITIONS[profil].accueil : '/'}
          className="flex shrink-0 items-center gap-2"
          aria-label="PAin PAtisserie — accueil"
        >
          {/* Le logotype complet serait illisible à cette hauteur : on garde
              le monogramme, et le nom en toutes lettres à côté. */}
          <Image
            src="/monogramme.png"
            alt=""
            width={28}
            height={28}
            priority
            className="h-7 w-7 rounded-md"
          />
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:inline">
            PAin PAtisserie
          </span>
        </Link>

        {/* La barre déborde sur téléphone : elle se fait glisser au doigt
            comme à la souris, et recentre l'écran courant. */}
        <div className="min-w-0 flex-1">
          <BandeauOnglets ariaLabel="Navigation principale" fond="surface">
            {ecrans.map((href) => {
              const actif = chemin === href;
              return (
                <Link
                  key={href}
                  href={href}
                  data-actif={actif}
                  aria-current={actif ? 'page' : undefined}
                  className={`block shrink-0 snap-start whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    actif
                      ? 'bg-accent-doux font-medium text-accent'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  {LIBELLES_ECRANS[href] ?? href}
                </Link>
              );
            })}
          </BandeauOnglets>
        </div>

        {profil ? (
          <button
            type="button"
            onClick={ouvrirSelecteur}
            title="Changer de profil sur cet appareil"
            className="flex min-h-9 shrink-0 items-center rounded-md border border-line px-2.5 text-xs text-ink-2 hover:border-line-fort hover:text-ink"
          >
            {DEFINITIONS[profil].libelle}
          </button>
        ) : null}
      </div>
    </header>
  );
}
