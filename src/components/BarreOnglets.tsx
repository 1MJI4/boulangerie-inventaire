'use client';

// src/components/BarreOnglets.tsx
//
// Barre d'onglets du bas, façon iOS actuel (propriétaire, 20/11/2026 : « ils
// sont habitués à Apple », « même sur tablette c'est mieux en bas ») : une
// pastille de verre FLOTTANTE, sur téléphone, tablette et ordinateur. Elle se
// RÉDUIT quand on descend dans la page (icônes seules) et se redéploie dès
// qu'on remonte. Cinq onglets au plus ; au-delà, les quatre premiers
// puis « Plus », qui ouvre la liste des autres écrans.
// Les barres collées en bas (pavé numérique, bouton « Valider ») passent
// AU-DESSUS de celle-ci : elles sont plus hautes dans l'empilement.
// Propriétaire : `design-ux`.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useProfil } from './ProfilAppareil';
import { DEFINITIONS, LIBELLES_ECRANS } from '@/lib/profils';

const TRAIT = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Icônes au trait, 24 px — même esprit que les symboles d'Apple. */
const ICONES: Record<string, ReactNode> = {
  '/': <path d="M4 11.2 12 4l8 7.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  '/commandes': (
    <>
      <path d="M6 8h12l-1 11.2a1 1 0 0 1-1 .8H8a1 1 0 0 1-1-.8z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </>
  ),
  '/commandes/reglages': (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  '/saisie-prevue': (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M9 3.5V7M15 3.5V7" />
    </>
  ),
  '/planification-demain': (
    <path d="M12 3c1 3.2 5 5 5 9.4A5 5 0 0 1 12 17.5a5 5 0 0 1-5-5.1c0-2 1.2-3 2.2-4.4C10.200 6.700 11.700 5.600 12 3z" />
  ),
  '/saisie-production': (
    <>
      <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.200z" />
      <path d="m4 7.200 8 4.300 8-4.300M12 11.500V21" />
    </>
  ),
  '/saisie-vendeur': (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="m8.800 10 1.300 1.300 2.200-2.400M8.800 16l1.300 1.300 2.200-2.400M14.200 10.500H16M14.200 16.500H16" />
    </>
  ),
  '/inventaire': (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1.500" />
      <rect x="4" y="14" width="16" height="6" rx="1.500" />
    </>
  ),
  '/stock': (
    <>
      <path d="M4 8.500 12 4l8 4.500v7L12 20l-8-4.500z" />
      <path d="M4 8.500 12 13l8-4.500M12 13v7" />
    </>
  ),
  '/dashboard': <path d="M5 20V11M12 20V5M19 20v-7" />,
  '/historique-previsions': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.500V12l3 2" />
    </>
  ),
};

const PAR_DEFAUT = <circle cx="12" cy="12" r="7.500" />;

function Icone({ chemin }: { chemin: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[26px] w-[26px]" {...TRAIT}>
      {ICONES[chemin] ?? PAR_DEFAUT}
    </svg>
  );
}

const MAX_ONGLETS = 5;

/**
 * Prise, modification et impression d'une commande, et comptage du restant : la barre du
 * bas disparaît (propriétaire, 20/11/2026 : « il gêne à la prise de commande », « quand on
 * fait l'inventaire, l'écran complet comme pour la commande »). Comme sur iPhone quand on
 * ouvre un écran de détail, l'écran n'a plus qu'une sortie : « Annuler » en haut,
 * et sa propre barre « Valider » en bas.
 */
const SAISIE_COMMANDE = /^\/(commandes\/(nouvelle|\d+\/(modifier|imprimer))|saisie-vendeur)(\/|$)/;

export function BarreOnglets() {
  const chemin = usePathname();
  const { profil, prete } = useProfil();
  const [plusOuvert, setPlusOuvert] = useState(false);
  const [reduite, setReduite] = useState(false);
  const enSaisie = SAISIE_COMMANDE.test(chemin);

  // Sans la barre, la page retrouve sa marge basse d'avant (voir globals.css).
  useEffect(() => {
    if (!enSaisie) return;
    document.documentElement.dataset.sansOnglets = '';
    // La page vient de perdre sa marge haute et basse : l'écran de saisie (qui mesure
    // sa hauteur au chargement) se remesure.
    window.dispatchEvent(new Event('resize'));
    return () => {
      delete document.documentElement.dataset.sansOnglets;
      window.dispatchEvent(new Event('resize'));
    };
  }, [enSaisie]);

  // Descendre réduit la barre, remonter (ou être tout en haut) la redéploie.
  // Un petit seuil évite le tremblement sur les défilements au doigt.
  useEffect(() => {
    let dernier = window.scrollY;
    const surDefilement = () => {
      const y = window.scrollY;
      if (Math.abs(y - dernier) < 12) return;
      setReduite(y > dernier && y > 80);
      dernier = y;
    };
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  if (!prete || !profil || enSaisie) return null;

  const def = DEFINITIONS[profil];
  // L'accueil est un onglet quand il n'est pas déjà l'un des écrans du profil.
  const tous = def.ecrans.includes(def.accueil) ? def.ecrans : [def.accueil, ...def.ecrans];
  const trop = tous.length > MAX_ONGLETS;
  const visibles = trop ? tous.slice(0, MAX_ONGLETS - 1) : tous;
  const autres = trop ? tous.slice(MAX_ONGLETS - 1) : [];

  // L'onglet actif est le chemin le plus long qui correspond (Réglages avant Commandes).
  const actifDe = (liste: string[]) =>
    liste
      .filter((h) => chemin === h || (h !== '/' && chemin.startsWith(`${h}/`)))
      .sort((a, b) => b.length - a.length)[0];
  const actif = actifDe(tous);
  const plusActif = autres.includes(actif ?? '');

  // Réduite : icônes seules, l'onglet actif garde sa pastille ; les libellés se replient.
  const compacte = reduite && !plusOuvert;
  const classe = (est: boolean) =>
    `flex flex-col items-center justify-center rounded-full text-[11px] font-medium transition-[padding,min-width,background-color,color] duration-300 ease-out active:opacity-60 ${
      compacte ? 'min-w-12 px-2 py-2' : 'min-w-[4.25rem] px-2 py-1.5'
    } ${est ? 'bg-accent-doux text-accent' : 'text-ink-2'}`;
  const libelle = `block truncate px-0.5 transition-[max-height,max-width,opacity,margin] duration-300 ${
    compacte ? 'mt-0 max-h-0 max-w-0 overflow-hidden opacity-0' : 'mt-0.5 max-h-4 max-w-[7rem] opacity-100'
  }`;

  return (
    <>
      {plusOuvert ? (
        <>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setPlusOuvert(false)}
            className="sans-impression fixed inset-0 z-20 bg-voile"
          />
          <div
            role="dialog"
            aria-label="Autres écrans"
            className="sans-impression fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-[min(calc(100%-1.5rem),24rem)] -translate-x-1/2 overflow-hidden rounded-3xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          >
            <ul className="divide-y divide-line">
              {autres.map((href) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setPlusOuvert(false)}
                    aria-current={href === actif ? 'page' : undefined}
                    className={`flex min-h-12 items-center gap-3 px-4 text-[17px] ${href === actif ? 'font-semibold text-accent' : 'text-ink'}`}
                  >
                    <Icone chemin={href} />
                    {LIBELLES_ECRANS[href] ?? href}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <div
        data-barre-navigation
        className="sans-impression barre-onglets pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <nav
          aria-label="Navigation principale"
          className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-line/60 bg-surface/70 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.14)] backdrop-blur-2xl backdrop-saturate-150 transition-[padding] duration-300"
        >
          {visibles.map((href) => (
            <Link key={href} href={href} aria-current={href === actif ? 'page' : undefined} className={classe(href === actif)}>
              <Icone chemin={href} />
              <span className={libelle}>{LIBELLES_ECRANS[href] ?? href}</span>
            </Link>
          ))}
          {trop ? (
            <button
              type="button"
              aria-expanded={plusOuvert}
              onClick={() => setPlusOuvert((o) => !o)}
              className={classe(plusActif || plusOuvert)}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-[26px] w-[26px]" {...TRAIT}>
                <circle cx="6" cy="12" r="1.200" />
                <circle cx="12" cy="12" r="1.200" />
                <circle cx="18" cy="12" r="1.200" />
              </svg>
              <span className={libelle}>Plus</span>
            </button>
          ) : null}
        </nav>
      </div>
    </>
  );
}
