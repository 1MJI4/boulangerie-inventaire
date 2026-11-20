'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useProfil } from './ProfilAppareil';
import { DEFINITIONS } from '@/lib/profils';

export function BarreNavigation() {
  const { profil, ouvrirSelecteur } = useProfil();

  return (
    <header data-barre-navigation className="sans-impression sticky top-0 z-30 border-b border-line/70 bg-surface/80 backdrop-blur-xl backdrop-saturate-150">
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
            className="h-8 w-8 rounded-[9px]"
          />
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            PAin PAtisserie
          </span>
        </Link>

        {profil ? (
          <button
            type="button"
            onClick={ouvrirSelecteur}
            title="Changer de profil sur cet appareil"
            className="ml-auto flex min-h-9 shrink-0 items-center rounded-full bg-segment-fond px-3 text-xs font-medium text-ink-2 hover:text-ink"
          >
            {DEFINITIONS[profil].libelle}
          </button>
        ) : null}
      </div>
    </header>
  );
}
