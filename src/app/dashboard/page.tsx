'use client';

// src/app/dashboard/page.tsx
//
// Tableau de bord du manager. La question de l'écran : « qu'est-ce qui est
// resté hier soir, et qu'est-ce qui a manqué ? ». Les restes sont comptés
// chaque soir ; la production ne l'est souvent pas (constat du propriétaire,
// 19/11/2026). L'écran met donc en avant ce qui est toujours connu — les
// restes — et n'affiche le vendu que lorsque la production a été saisie.
//
// Mise en page (propriétaire, 19/11/2026 : « propre ») : une liste alignée en
// colonnes, des chiffres à droite en chiffres tabulaires, un tiret gris pour ce
// qui manque, la couleur réservée à ce qui demande attention. Aucun calcul
// ici : tout vient de `src/domaine/bilanInventaire.ts`.

import { dateDuJour, decalerJours } from '@/lib/dateProduction';
import {
  bilanJournee,
  ecartDeRestes,
  plusGrosRestes,
  tauxDeLaLigne,
  venduDeLaLigne,
  type BilanJournee,
  type LigneBilan,
} from '@/domaine/bilanInventaire';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
  ordre: number;
}

interface Inventaire {
  id: number;
  dateInventaire: string;
  quantiteRestante: number | null;
  quantiteProduite: number | null;
  quantitePrevue: number | null;
  /** 'kg' : quantités en grammes (LOI 2). */
  unite?: string | null;
  produit: Produit;
}

interface DateInventaire {
  date: string;
  /** Bilan calculé par le domaine : inconnu ≠ zéro, vendu seulement si tout est connu. */
  bilan: BilanJournee;
  /** Écart de restes avec le même jour la semaine d'avant ; null si non comparable. */
  ecartSemaine: number | null;
}

/** Ce que le domaine a besoin de savoir d'une ligne d'inventaire. */
const versLigne = (inv: Inventaire): LigneBilan & { id: number } => ({
  id: inv.id,
  nom: inv.produit?.nom ?? '',
  quantiteRestante: inv.quantiteRestante,
  quantiteProduite: inv.quantiteProduite,
  unite: inv.unite,
});

/** Nombre de plus gros restes montrés en tête d'une journée (affichage, pas une règle). */
const NB_PLUS_GROS_RESTES = 5;
/** Plus gros restes cités dans le bloc « Dernier comptage » (affichage). */
const NB_RESTES_EN_TETE = 4;
/** Noms de produits à zéro cités en tête du détail ; au-delà : « et N autres » (affichage). */
const NB_ZEROS_CITES = 6;
/** Filtres du tableau des produits d'une journée. */
const FILTRES = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'reste', libelle: 'Avec reste' },
  { cle: 'zero', libelle: 'À zéro' },
  { cle: 'vide', libelle: 'Non comptés' },
] as const;
type Filtre = (typeof FILTRES)[number]['cle'];
/** Journées listées (affichage). */
const NB_JOURNEES = 10;
/** Sous ce pourcentage vendu, le chiffre passe en alerte (affichage). */
const SEUIL_VENTE_FAIBLE = 60;

/** Colonnes de la liste des journées, partagées par l'en-tête et les lignes. */
const COLONNES_JOURNEES = 'sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_7rem_5rem_11rem] sm:items-center sm:gap-x-4';
/** Colonnes du détail d'une journée. */
const COLONNES_DETAIL = 'grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_6.5rem] items-center gap-x-3';

const MANQUE = <span className="text-ink-3">—</span>;

const dateLongue = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

/** Quantité affichée : pièces telles quelles, grammes en kilos (LOI 2). */
function quantite(valeur: number | null, unite?: string | null) {
  if (valeur == null) return MANQUE;
  if (unite === 'kg') return `${(valeur / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 2 })} kg`;
  return valeur;
}

export default function DashboardInventaires() {
  const [journees, setJournees] = useState<DateInventaire[]>([]);
  const [dernierComptage, setDernierComptage] = useState<(DateInventaire & { gros: (LigneBilan & { id: number })[] }) | null>(null);
  const [detail, setDetail] = useState<Inventaire[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [echec, setEchec] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [filtreEtat, setFiltreEtat] = useState<Filtre>('tous');
  const fenetre = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        // Les 60 derniers jours, bornés côté serveur.
        const debut = decalerJours(dateDuJour(), -60);
        const reponse = await fetch(`/api/inventaires?debut=${debut}&limit=2000`);
        const lignes: Inventaire[] = await reponse.json();
        const parDate = new Map<string, Inventaire[]>();
        for (const inv of lignes) {
          const date = String(inv.dateInventaire).slice(0, 10);
          parDate.set(date, [...(parDate.get(date) ?? []), inv]);
        }
        // Bilan de chaque journée chargée, pour comparer à la semaine d'avant.
        const bilans = new Map([...parDate].map(([date, l]) => [date, bilanJournee(l.map(versLigne))] as const));
        const liste = [...bilans.keys()]
          .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
          .slice(0, NB_JOURNEES)
          .map((date) => {
            const bilan = bilans.get(date)!;
            return { date, bilan, ecartSemaine: ecartDeRestes(bilan, bilans.get(decalerJours(date, -7))) };
          });
        if (!annule) {
          setJournees(liste);
          // Le dernier soir compté : la réponse à la question de l'écran, dite en premier.
          const dernier = liste.find((j) => j.bilan.restesComptes > 0);
          setDernierComptage(
            dernier
              ? { ...dernier, gros: plusGrosRestes((parDate.get(dernier.date) ?? []).map(versLigne), NB_RESTES_EN_TETE) }
              : null,
          );
        }
      } catch {
        if (!annule) setEchec(true);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  const ouvrir = async (date: string) => {
    setOuverte(date);
    setRecherche('');
    setFiltreEtat('tous');
    setDetail([]);
    setChargementDetail(true);
    fenetre.current?.showModal();
    try {
      // L'API n'accepte que AAAA-MM-JJ : un horodatage complet ferait sauter le filtre de date.
      const reponse = await fetch(`/api/inventaires?date=${date.slice(0, 10)}`);
      const lignes: Inventaire[] = await reponse.json();
      // Même ordre que la feuille de comptage.
      setDetail([...lignes].sort((a, b) => (a.produit?.ordre || 0) - (b.produit?.ordre || 0)));
    } catch {
      setDetail([]);
    } finally {
      setChargementDetail(false);
    }
  };

  // Résumé de la journée ouverte (toute la journée, pas seulement les lignes filtrées).
  const lignesDetail = detail.map(versLigne);
  const bilanDetail = bilanJournee(lignesDetail);
  const grosRestes = plusGrosRestes(lignesDetail, NB_PLUS_GROS_RESTES);
  const filtre = recherche.trim().toLowerCase();
  const selonEtat = (inv: Inventaire) =>
    filtreEtat === 'tous' ||
    (filtreEtat === 'reste' && (inv.quantiteRestante ?? 0) > 0) ||
    (filtreEtat === 'zero' && inv.quantiteRestante === 0) ||
    (filtreEtat === 'vide' && inv.quantiteRestante == null);
  const visibles = detail.filter((inv) => selonEtat(inv) && (!filtre || inv.produit.nom.toLowerCase().includes(filtre)));
  const nombrePar: Record<Filtre, number> = {
    tous: detail.length,
    reste: detail.filter((inv) => (inv.quantiteRestante ?? 0) > 0).length,
    zero: bilanDetail.aZero.length,
    vide: detail.filter((inv) => inv.quantiteRestante == null).length,
  };
  const productionConnue = bilanDetail.productionsSaisies > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* ------------------------------------------------------------ Titre */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Tableau de bord</h1>
          <p className="mt-0.5 text-sm text-ink-2">Ce qui est resté chaque soir, et ce qui a manqué.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/historique-previsions" className="inline-flex min-h-11 items-center rounded-xl border border-line-fort px-4 text-sm font-medium text-ink">
            Historique
          </Link>
          <Link href="/planification-demain" className="inline-flex min-h-11 items-center rounded-xl border border-line-fort px-4 text-sm font-medium text-ink">
            Planification
          </Link>
          <Link href="/inventaire" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-texte">
            Saisir un inventaire
          </Link>
        </div>
      </div>

      {/* -------------------------------------------------- Dernier comptage */}
      {dernierComptage ? (
        <section
          aria-labelledby="dernier-comptage"
          className="mt-6 grid gap-x-10 gap-y-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div>
            <h2 id="dernier-comptage" className="text-sm text-ink-2">
              Dernier comptage · <span className="first-letter:uppercase">{dateLongue(dernierComptage.date)}</span>
            </h2>
            <p className="mt-1.5">
              <span className="chiffres text-4xl font-semibold tracking-tight text-ink">
                {dernierComptage.bilan.resteTotalPieces ?? MANQUE}
              </span>
              <span className="ml-2 text-base text-ink-2">pièces restées en rayon</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {dernierComptage.ecartSemaine === null ? (
                'Pas de comptage le même jour la semaine d’avant pour comparer.'
              ) : dernierComptage.ecartSemaine === 0 ? (
                'Autant que le même jour la semaine d’avant.'
              ) : (
                <>
                  <span className={`chiffres font-medium ${dernierComptage.ecartSemaine > 0 ? 'text-alerte' : 'text-ok'}`}>
                    {Math.abs(dernierComptage.ecartSemaine)} de {dernierComptage.ecartSemaine > 0 ? 'plus' : 'moins'}
                  </span>{' '}
                  que le même jour la semaine d’avant.
                </>
              )}
              {dernierComptage.bilan.aZero.length > 0
                ? ` ${dernierComptage.bilan.aZero.length} ${dernierComptage.bilan.aZero.length > 1 ? 'produits comptés' : 'produit compté'} à zéro.`
                : ''}
            </p>
            <button
              type="button"
              onClick={() => void ouvrir(dernierComptage.date)}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line-fort px-4 text-sm font-medium text-ink"
            >
              Voir le détail
            </button>
          </div>
          <div className="border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0">
            <h3 className="text-sm text-ink-2">Plus gros restes</h3>
            {dernierComptage.gros.length === 0 ? (
              <p className="mt-1.5 text-base text-ink-2">Aucun reste : tout ce qui a été compté est parti.</p>
            ) : (
              <ul className="mt-1.5">
                {dernierComptage.gros.map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-3 py-1 text-base">
                    <span className="min-w-0 truncate text-ink">{l.nom}</span>
                    <span className="chiffres font-semibold text-ink">{l.quantiteRestante}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- Journées */}
      <section aria-label="Journées d’inventaire" className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <div className={`hidden px-4 py-2.5 text-xs text-ink-2 ${COLONNES_JOURNEES}`}>
          <span>Journée</span>
          <span className="text-right">Restes (pièces)</span>
          <span className="text-right">Semaine d’avant</span>
          <span className="text-right">À zéro</span>
          <span className="text-right">Vendu</span>
        </div>

        {chargement ? (
          <p className="border-t border-line px-4 py-8 text-center text-sm text-ink-2">Chargement des inventaires…</p>
        ) : echec ? (
          <p className="border-t border-line px-4 py-8 text-center text-sm text-ink-2">
            Les inventaires n’ont pas pu être chargés. Vérifiez le réseau puis rouvrez cet écran.
          </p>
        ) : journees.length === 0 ? (
          <p className="border-t border-line px-4 py-8 text-center text-sm text-ink-2">
            Aucun inventaire sur les 60 derniers jours. Le premier comptage du soir apparaîtra ici.
          </p>
        ) : (
          <ul>
            {journees.map(({ date, bilan, ecartSemaine }) => (
              <li key={date} className="border-t border-line">
                <button
                  type="button"
                  onClick={() => void ouvrir(date)}
                  className={`w-full px-4 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none ${COLONNES_JOURNEES}`}
                >
                  <span className="block min-w-0">
                    <span className="block truncate text-base font-medium text-ink first-letter:uppercase">{dateLongue(date)}</span>
                    <span className="block text-[0.8125rem] text-ink-2">
                      {bilan.restesComptes === bilan.produits
                        ? `${bilan.produits} produits comptés`
                        : `${bilan.restesComptes} produits comptés sur ${bilan.produits}`}
                    </span>
                  </span>

                  {/* Téléphone : les mêmes chiffres, en une ligne étiquetée. */}
                  <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink-2 sm:contents">
                    <span className="sm:text-right">
                      <span className="sm:hidden">Restes </span>
                      <span className="chiffres text-base font-semibold text-ink">{bilan.resteTotalPieces ?? MANQUE}</span>
                    </span>
                    <span className="sm:text-right">
                      <span className="sm:hidden">Semaine d’avant </span>
                      {ecartSemaine === null ? (
                        MANQUE
                      ) : ecartSemaine === 0 ? (
                        <span className="chiffres text-ink-2">=</span>
                      ) : (
                        // Plus d'invendus que la semaine d'avant : c'est la mauvaise direction.
                        <span className={`chiffres font-medium ${ecartSemaine > 0 ? 'text-alerte' : 'text-ok'}`}>
                          {ecartSemaine > 0 ? '+' : '−'}
                          {Math.abs(ecartSemaine)}
                        </span>
                      )}
                    </span>
                    <span className="sm:text-right">
                      <span className="sm:hidden">À zéro </span>
                      <span className={`chiffres ${bilan.aZero.length > 0 ? 'font-medium text-ink' : 'text-ink-2'}`}>{bilan.aZero.length}</span>
                    </span>
                    <span className="sm:text-right">
                      {bilan.tauxVente === null ? (
                        <span className="text-ink-3">{bilan.restesComptes === 0 ? 'pas encore compté' : 'production non saisie'}</span>
                      ) : (
                        <>
                          <span className="sm:hidden">Vendu </span>
                          <span className="chiffres text-ink">
                            {bilan.venduTotalPieces} / {bilan.produitTotalPieces}
                          </span>
                          <span className={`chiffres ml-1.5 font-medium ${bilan.tauxVente < SEUIL_VENTE_FAIBLE ? 'text-alerte' : 'text-ink'}`}>
                            {bilan.tauxVente}&nbsp;%
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ Détail d'une journée */}
      <dialog
        ref={fenetre}
        aria-labelledby="detail-titre"
        onClose={() => setOuverte(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="fixed inset-0 m-auto w-[calc(100%-1.5rem)] max-w-3xl border-0 bg-transparent p-0 text-ink backdrop:bg-voile"
      >
        {ouverte ? (
          <div className="flex max-h-[92dvh] flex-col overflow-hidden rounded-2xl bg-surface shadow-xl">
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div className="min-w-0">
                <h2 id="detail-titre" className="truncate text-lg font-semibold text-ink first-letter:uppercase">
                  {dateLongue(ouverte)}
                </h2>
                <p className="text-sm text-ink-2">
                  {chargementDetail
                    ? 'Chargement…'
                    : `${bilanDetail.restesComptes} produits comptés sur ${bilanDetail.produits}` +
                      (bilanDetail.resteTotalPieces !== null ? ` · ${bilanDetail.resteTotalPieces} pièces restantes` : '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fenetre.current?.close()}
                className="-mr-2 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-2 hover:text-ink"
              >
                Fermer
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 pb-5 pt-4">
              {!chargementDetail && detail.length > 0 ? (
                <>
                  {/* L'essentiel : un seul cadre, deux réponses côte à côte. */}
                  <div className="grid rounded-xl border border-line sm:grid-cols-2">
                    <div className="p-4">
                      <h3 className="text-sm text-ink-2">Plus gros restes</h3>
                      {grosRestes.length === 0 ? (
                        <p className="mt-1.5 text-base text-ink-2">Aucun reste : tout ce qui a été compté est parti.</p>
                      ) : (
                        <ul className="mt-1.5">
                          {grosRestes.map((l) => (
                            <li key={l.id} className="flex items-baseline justify-between gap-3 py-0.5 text-base">
                              <span className="min-w-0 truncate text-ink">{l.nom}</span>
                              <span className="chiffres font-semibold text-ink">{l.quantiteRestante}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="border-t border-line p-4 sm:border-l sm:border-t-0">
                      <h3 className="text-sm text-ink-2">
                        Comptés à zéro{bilanDetail.aZero.length > 0 ? ` (${bilanDetail.aZero.length})` : ''}
                      </h3>
                      {bilanDetail.aZero.length === 0 ? (
                        <p className="mt-1.5 text-base text-ink-2">Aucun produit à zéro.</p>
                      ) : (
                        <>
                          {/* Quelques noms, jamais un mur de texte : la liste entière est dans le tableau (filtre « À zéro »). */}
                          <p className="mt-1.5 text-base leading-snug text-ink">
                            {bilanDetail.aZero.slice(0, NB_ZEROS_CITES).join(', ')}
                            {bilanDetail.aZero.length > NB_ZEROS_CITES ? (
                              <span className="text-ink-2"> et {bilanDetail.aZero.length - NB_ZEROS_CITES} autres</span>
                            ) : null}
                          </p>
                          <p className="mt-1.5 text-[0.8125rem] text-ink-2">Tout est parti, peut-être avant la fermeture.</p>
                          {bilanDetail.aZero.length > NB_ZEROS_CITES ? (
                            <button
                              type="button"
                              onClick={() => setFiltreEtat('zero')}
                              className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-line-fort px-4 text-sm font-medium text-ink"
                            >
                              Voir les {bilanDetail.aZero.length} produits à zéro
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {!productionConnue && bilanDetail.restesComptes > 0 ? (
                    <p className="mt-3 text-sm text-ink-2">
                      La production de cette journée n’a pas été saisie : le vendu ne se calcule pas, seuls les restes sont connus.
                    </p>
                  ) : null}

                  <input
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Chercher un produit"
                    aria-label="Chercher un produit"
                    className="mt-4 min-h-11 w-full rounded-xl border border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                  />

                  <div role="group" aria-label="Filtrer les produits" className="mt-2 flex flex-wrap gap-1.5">
                    {FILTRES.filter((f) => f.cle === 'tous' || nombrePar[f.cle] > 0).map((f) => (
                      <button
                        key={f.cle}
                        type="button"
                        aria-pressed={filtreEtat === f.cle}
                        onClick={() => setFiltreEtat(f.cle)}
                        className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                          filtreEtat === f.cle ? 'bg-ink text-surface' : 'bg-segment-fond text-ink'
                        }`}
                      >
                        {f.libelle} <span className="chiffres font-normal opacity-80">{nombrePar[f.cle]}</span>
                      </button>
                    ))}
                  </div>

                  {/* Tous les produits : une ligne chacun, chiffres alignés à droite. */}
                  <div className="mt-3">
                    <div className={`${COLONNES_DETAIL} pb-1.5 text-xs text-ink-2`}>
                      <span>Produit</span>
                      <span className="text-right">Fabriqué</span>
                      <span className="text-right">Reste</span>
                      <span className="text-right">Vendu</span>
                    </div>
                    {visibles.length === 0 ? (
                      <p className="border-t border-line py-6 text-center text-sm text-ink-2">
                        {filtre ? <>Aucun produit ne correspond à « {recherche} ».</> : 'Aucun produit dans ce filtre.'}
                      </p>
                    ) : (
                      <ul>
                        {visibles.map((inv) => {
                          const ligne = versLigne(inv);
                          const vendu = venduDeLaLigne(ligne);
                          const taux = tauxDeLaLigne(ligne);
                          const reste = inv.quantiteRestante;
                          return (
                            <li key={inv.id} className={`${COLONNES_DETAIL} min-h-11 border-t border-line py-1.5 text-base`}>
                              <span className="min-w-0 truncate text-ink">{inv.produit.nom}</span>
                              <span className="chiffres text-right text-ink-2">{quantite(inv.quantiteProduite, inv.unite)}</span>
                              <span className={`chiffres text-right ${reste ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                                {quantite(reste, inv.unite)}
                              </span>
                              <span className="chiffres text-right text-ink-2">
                                {vendu === null ? (
                                  MANQUE
                                ) : (
                                  <>
                                    {quantite(vendu, inv.unite)}
                                    {taux !== null ? (
                                      <span className={`ml-1.5 text-[0.8125rem] ${taux < SEUIL_VENTE_FAIBLE ? 'font-medium text-alerte' : ''}`}>
                                        {taux}&nbsp;%
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              ) : !chargementDetail ? (
                <p className="py-8 text-center text-sm text-ink-2">Aucune ligne d’inventaire pour cette journée.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
