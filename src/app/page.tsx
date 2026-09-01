'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Carte } from '@/components/ui';
import { useProfil } from '@/components/ProfilAppareil';
import { dateDuJour, formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { DEFINITIONS, LIBELLES_ECRANS } from '@/lib/profils';

const DESCRIPTIONS: Record<string, { description: string; moment?: string }> = {
  '/saisie-prevue': {
    description: 'Noter les quantités voulues pour la prochaine fournée.',
    moment: 'fin d’après-midi',
  },
  '/planification-demain': {
    description: 'Lire ce qu’il y a à produire, et cocher au fur et à mesure.',
    moment: 'la nuit',
  },
  '/saisie-production': {
    description: 'Saisir les quantités réellement sorties du four.',
    moment: 'au petit matin',
  },
  '/saisie-vendeur': {
    description: 'Compter ce qu’il reste en rayon, zone par zone.',
    moment: 'en fin de journée',
  },
  '/inventaire': { description: 'Demandé, produit, restant et vendu sur une journée.' },
  '/dashboard': { description: 'Tendances et taux d’invendu sur la durée.' },
  '/historique-previsions': { description: 'Ce qui a été demandé, jour après jour.' },
  '/test-api': { description: 'Ajouter, renommer et réordonner les articles.' },
};

/** Les quatre écrans qui forment le tour de la journée, dans l'ordre. */
const DEROULE = [
  '/saisie-prevue',
  '/planification-demain',
  '/saisie-production',
  '/saisie-vendeur',
];

export default function Accueil() {
  const { profil, prete, ouvrirSelecteur } = useProfil();
  const journee = journeeProduction();
  const aujourdhui = dateDuJour();

  if (!prete || !profil) return null;

  const definition = DEFINITIONS[profil];
  const deroule = definition.ecrans.filter((e) => DEROULE.includes(e));
  const consultation = definition.ecrans.filter((e) => !DEROULE.includes(e));

  return (
    <>
      <div className="mb-8">
        {/* Ici le logotype a la place de respirer et reste lisible. */}
        <Image
          src="/logo.png"
          alt="PAin PAtisserie"
          width={900}
          height={317}
          priority
          className="mb-3 h-auto w-52 sm:w-64"
        />
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Inventaire
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Prochaine fournée&nbsp;:{' '}
          <span className="font-medium capitalize text-ink">{formatDateLong(journee)}</span>
          {journee !== aujourdhui ? (
            <span className="text-ink-3"> — la journée bascule à 14h</span>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Cet appareil est réglé sur « {definition.libelle} ».{' '}
          <button
            type="button"
            onClick={ouvrirSelecteur}
            className="underline underline-offset-2 hover:text-ink-2"
          >
            Changer
          </button>
        </p>
      </div>

      {deroule.length > 0 ? (
        <>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">
            {deroule.length > 1 ? 'Le tour de la journée' : 'Votre écran'}
          </h2>
          <ol className="mb-10 grid gap-3 sm:grid-cols-2">
            {deroule.map((href, index) => (
              <li key={href}>
                <Link href={href} className="block h-full">
                  <Carte className="h-full p-4 transition-colors hover:border-accent">
                    <div className="flex items-baseline gap-2">
                      {deroule.length > 1 ? (
                        <span className="chiffres text-xs text-ink-3">{index + 1}</span>
                      ) : null}
                      <h3 className="text-base font-medium text-ink">{LIBELLES_ECRANS[href]}</h3>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-2 text-pretty">
                      {DESCRIPTIONS[href]?.description}
                    </p>
                    {DESCRIPTIONS[href]?.moment ? (
                      <p className="mt-3 text-xs text-ink-3">{DESCRIPTIONS[href]?.moment}</p>
                    ) : null}
                  </Carte>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {consultation.length > 0 ? (
        <>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">Consulter</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {consultation.map((href) => (
              <li key={href}>
                <Link href={href} className="block h-full">
                  <Carte className="h-full p-4 transition-colors hover:border-accent">
                    <h3 className="text-base font-medium text-ink">{LIBELLES_ECRANS[href]}</h3>
                    <p className="mt-1.5 text-sm text-ink-2 text-pretty">
                      {DESCRIPTIONS[href]?.description}
                    </p>
                  </Carte>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
