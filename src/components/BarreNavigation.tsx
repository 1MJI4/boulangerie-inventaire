'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BandeauOnglets } from './BandeauOnglets';

const LIENS = [
  { href: '/saisie-vendeur', libelle: 'Comptage' },
  { href: '/saisie-production', libelle: 'Production' },
  { href: '/saisie-prevue', libelle: 'Prévisions' },
  { href: '/planification-demain', libelle: 'Fournil' },
  { href: '/inventaire', libelle: 'Inventaire' },
  { href: '/dashboard', libelle: 'Tableau de bord' },
];

export function BarreNavigation() {
  const chemin = usePathname();

  return (
    <header className="sans-impression sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="shrink-0 text-[15px] font-semibold tracking-tight text-ink hover:text-accent"
        >
          Boulangerie
        </Link>

        {/* La barre déborde sur téléphone : elle se fait glisser au doigt
            comme à la souris, et recentre l'écran courant. */}
        <div className="min-w-0 flex-1">
          <BandeauOnglets ariaLabel="Navigation principale" fond="surface">
            {LIENS.map(({ href, libelle }) => {
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
                  {libelle}
                </Link>
              );
            })}
          </BandeauOnglets>
        </div>
      </div>
    </header>
  );
}
