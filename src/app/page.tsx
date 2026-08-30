import Link from 'next/link';
import { Carte } from '@/components/ui';
import { formatDateLong, journeeProduction, dateDuJour } from '@/lib/dateProduction';

const TACHES = [
  {
    href: '/saisie-prevue',
    titre: 'Prévisions',
    description: 'Le manager note les quantités voulues pour la prochaine fournée.',
    moment: 'fin d’après-midi',
  },
  {
    href: '/planification-demain',
    titre: 'Feuille de production',
    description: 'Le pâtissier et le boulanger lisent ce qu’il y a à produire.',
    moment: 'la nuit',
  },
  {
    href: '/saisie-production',
    titre: 'Production réalisée',
    description: 'Les quantités effectivement sorties du four.',
    moment: 'au petit matin',
  },
  {
    href: '/saisie-vendeur',
    titre: 'Comptage du restant',
    description: 'Ce qu’il reste en rayon, zone du magasin par zone.',
    moment: 'en fin de journée',
  },
];

const CONSULTATION = [
  { href: '/inventaire', titre: 'Inventaire complet', description: 'Demandé, produit, restant et vendu sur une journée.' },
  { href: '/dashboard', titre: 'Tableau de bord', description: 'Tendances et taux d’invendu sur la durée.' },
  { href: '/historique-previsions', titre: 'Historique des prévisions', description: 'Ce qui a été demandé, jour après jour.' },
  { href: '/test-api', titre: 'Catalogue produits', description: 'Ajouter, renommer et réordonner les articles.' },
];

export default function Accueil() {
  const journee = journeeProduction();
  const aujourdhui = dateDuJour();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Inventaire de la boulangerie
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Prochaine fournée&nbsp;:{' '}
          <span className="font-medium capitalize text-ink">{formatDateLong(journee)}</span>
          {journee !== aujourdhui ? (
            <span className="text-ink-3"> — la journée bascule à 14h</span>
          ) : null}
        </p>
      </div>

      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">
        Le tour de la journée
      </h2>
      <ol className="mb-10 grid gap-3 sm:grid-cols-2">
        {TACHES.map((tache, index) => (
          <li key={tache.href}>
            <Link href={tache.href} className="block h-full">
              <Carte className="h-full p-4 transition-colors hover:border-accent">
                <div className="flex items-baseline gap-2">
                  <span className="chiffres text-xs text-ink-3">{index + 1}</span>
                  <h3 className="text-base font-medium text-ink">{tache.titre}</h3>
                </div>
                <p className="mt-1.5 text-sm text-ink-2 text-pretty">{tache.description}</p>
                <p className="mt-3 text-xs text-ink-3">{tache.moment}</p>
              </Carte>
            </Link>
          </li>
        ))}
      </ol>

      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">Consulter</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CONSULTATION.map((lien) => (
          <li key={lien.href}>
            <Link href={lien.href} className="block h-full">
              <Carte className="h-full p-4 transition-colors hover:border-accent">
                <h3 className="text-base font-medium text-ink">{lien.titre}</h3>
                <p className="mt-1.5 text-sm text-ink-2 text-pretty">{lien.description}</p>
              </Carte>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
