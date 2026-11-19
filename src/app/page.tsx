'use client';

// Accueil (manager, pâtissier, boulanger). Le vendeur a le sien : `AccueilVendeur`.
//
// La question de l'écran : « où est-ce que je vais maintenant ? ». Le tour de la
// journée se lit comme un horaire — le moment à gauche, l'écran, ce qu'on y fait —
// et non comme une grille de cartes identiques (propriétaire, 19/11/2026 :
// « propre »). Ce qui se consulte vient ensuite, dans une seconde liste.

import Image from 'next/image';
import Link from 'next/link';
import { useProfil } from '@/components/ProfilAppareil';
import { dateDuJour, formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { DEFINITIONS, LIBELLES_ECRANS } from '@/lib/profils';
import { CarteCommandes } from '@/components/CarteCommandes';
import { AccueilVendeur } from '@/components/AccueilVendeur';

const DESCRIPTIONS: Record<string, { description: string; moment?: string }> = {
  '/saisie-prevue': {
    description: 'Noter les quantités voulues pour la prochaine fournée.',
    moment: 'Fin d’après-midi',
  },
  '/planification-demain': {
    description: 'Lire ce qu’il y a à produire, et cocher au fur et à mesure.',
    moment: 'La nuit',
  },
  '/saisie-production': {
    description: 'Noter les quantités réellement sorties du four.',
    moment: 'Au petit matin',
  },
  '/saisie-vendeur': {
    description: 'Compter ce qu’il reste en rayon, page par page.',
    moment: 'En fin de journée',
  },
  '/commandes': {
    description: 'Prendre une commande, l’imprimer, la retrouver au retrait.',
  },
  '/commandes/reglages': { description: 'Heures d’ouverture, tailles et goûts des gâteaux, photos modèles.' },
  '/inventaire': { description: 'Demandé, produit, restant et vendu sur une journée.' },
  '/dashboard': { description: 'Ce qui est resté chaque soir, et ce qui a manqué.' },
  '/historique-previsions': { description: 'Ce qui a été demandé, jour après jour.' },
};

/** Les quatre écrans qui forment le tour de la journée, dans l'ordre. */
const DEROULE = ['/saisie-prevue', '/planification-demain', '/saisie-production', '/saisie-vendeur'];

const CHEVRON = (
  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

/** Une liste d'écrans : un seul cadre, une ligne par écran, tout ce qui est écrit se touche. */
function ListeEcrans({ titre, ecrans, avecMoment }: { titre: string; ecrans: readonly string[]; avecMoment?: boolean }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm text-ink-2">{titre}</h2>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {ecrans.map((href, index) => (
          <li key={href} className={index > 0 ? 'border-t border-line' : undefined}>
            <Link
              href={href}
              className={`flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none ${
                avecMoment ? 'sm:grid sm:grid-cols-[9.5rem_minmax(0,1fr)_auto]' : ''
              }`}
            >
              {avecMoment ? (
                <span className="hidden text-sm text-ink-2 sm:block">{DESCRIPTIONS[href]?.moment}</span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-ink">
                  {LIBELLES_ECRANS[href]}
                  {avecMoment && DESCRIPTIONS[href]?.moment ? (
                    <span className="ml-2 text-sm font-normal text-ink-2 sm:hidden">{DESCRIPTIONS[href]?.moment}</span>
                  ) : null}
                </span>
                {DESCRIPTIONS[href]?.description ? (
                  <span className="mt-0.5 block text-sm text-ink-2 text-pretty">{DESCRIPTIONS[href]?.description}</span>
                ) : null}
              </span>
              {CHEVRON}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Accueil() {
  const { profil, prete, ouvrirSelecteur } = useProfil();
  const journee = journeeProduction();
  const aujourdhui = dateDuJour();

  if (!prete || !profil) return null;

  const definition = DEFINITIONS[profil];

  // Tablette du comptoir (22/10/2026) : deux gros boutons et les retraits du
  // jour, pensé pour un vendeur qui découvre l'application.
  if (profil === 'vendeur') {
    return <AccueilVendeur libelleProfil={definition.libelle} onChangerProfil={ouvrirSelecteur} />;
  }
  const deroule = definition.ecrans.filter((e) => DEROULE.includes(e));
  const consultation = definition.ecrans.filter((e) => !DEROULE.includes(e) && e !== '/commandes');
  const voitLesCommandes = definition.ecrans.includes('/commandes');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Image src="/logo.png" alt="PAin PAtisserie" width={900} height={317} priority className="mb-4 h-auto w-40" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink first-letter:uppercase">{formatDateLong(aujourdhui)}</h1>
          <p className="mt-1 text-base text-ink-2">
            Prochaine fournée&nbsp;: <span className="font-medium text-ink first-letter:uppercase">{formatDateLong(journee)}</span>
            {journee !== aujourdhui ? ' — la journée bascule à 14h' : null}
          </p>
        </div>
        <button
          type="button"
          onClick={ouvrirSelecteur}
          className="inline-flex min-h-11 items-center rounded-xl border border-line-fort px-4 text-sm text-ink-2 hover:text-ink"
        >
          Profil&nbsp;: <span className="ml-1 font-medium text-ink">{definition.libelle}</span>
          <span className="ml-2 underline underline-offset-2">Changer</span>
        </button>
      </div>

      {voitLesCommandes ? (
        // La carte porte sa propre marge basse (elle sert aussi ailleurs) : annulée ici,
        // l'espacement entre les blocs est celui des listes.
        <div className="mt-6 [&>a]:mb-0">
          <CarteCommandes />
        </div>
      ) : null}

      {deroule.length > 0 ? (
        <ListeEcrans titre={deroule.length > 1 ? 'Le tour de la journée' : 'Votre écran'} ecrans={deroule} avecMoment={deroule.length > 1} />
      ) : null}

      {consultation.length > 0 ? <ListeEcrans titre="À consulter" ecrans={consultation} /> : null}
    </div>
  );
}
