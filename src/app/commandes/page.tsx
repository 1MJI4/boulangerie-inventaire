'use client';

// src/app/commandes/page.tsx
//
// L'écran d'où part tout : ce qui reste à imprimer, les virements à vérifier,
// les retraits du jour. Il s'ouvre sur « Qui prend la commande ? » parce que
// la tablette du comptoir est partagée.

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, LienBouton } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import { depuisApi, typesDeCommande, type Commande, type CommandeApi } from '@/lib/commandes';
import { dateDuJour, formatDateLong } from '@/lib/dateProduction';
import { decalerJours, estJourFerme, type JourFerme } from '@/domaine/calendrier';
import { BandeSemaine } from '@/components/BandeSemaine';
import { RappelChargement } from '@/components/rappels';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { FicheCommande } from '@/components/FicheCommande';
import { CelluleCommande, ListeGroupee, Segmente } from '@/components/fiche/ElementsCommande';
import { useMaintenant } from '@/components/fiche/useMaintenant';
import { chercherCommandes, GROUPES, grouperCommandes, type CleGroupe } from '@/components/fiche/presentationCommande';

/**
 * Commandes annulées montrées : celles dont le retrait date de moins de N jours
 * (et celles à venir). Réglage d'affichage, pour que la liste reste courte.
 */
const JOURS_ANNULEES_VISIBLES = 60;

/** Libellés courts du contrôle segmenté (« Retraits en retard » ne tient pas sur cinq segments). */
const LIBELLE_FILTRE: Record<CleGroupe, string> = {
  aImprimer: 'À imprimer',
  enRetard: 'En retard',
  duJour: 'Aujourd’hui',
  aVenir: 'À venir',
};

/** `useSearchParams` impose une frontière Suspense : l'écran attend l'adresse lue. */
export default function PageCommandes() {
  return (
    <Suspense fallback={<Chargement libelle="Chargement des commandes…" />}>
      <EcranCommandes />
    </Suspense>
  );
}

function EcranCommandes() {
  // Propriétaire, 14/11/2026 : plus de « Qui prend la commande ? » à l'entrée. Le prénom se
  // choisit à chaque commande, avant « Valider ». Ici ne reste que la liste des prénoms.
  const { equipe, prete, ajouter, retirer } = useEquipe();
  const [gestionEquipe, setGestionEquipe] = useState(false);
  const [gererNoms, setGererNoms] = useState(false);
  const parametres = useSearchParams();
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // « /commandes?q=2026-0016 » (depuis l'accueil vendeur) : liste déjà filtrée sur la commande.
  const [recherche, setRecherche] = useState(parametres.get('q') ?? '');
  const [nouveauNom, setNouveauNom] = useState('');
  // Filtre sous la recherche (propriétaire, 28/10/2026) : un groupe à la fois, ou tout.
  const [filtre, setFiltre] = useState<CleGroupe | null>(null);
  // Toucher une commande ouvre sa fiche sur place (propriétaire, 28/10/2026).
  const [ouverteId, setOuverteId] = useState<number | null>(null);
  // Accès discret aux commandes annulées (11/11/2026) : lues seulement si on les demande.
  const [vue, setVue] = useState<'enCours' | 'annulees'>('enCours');
  const [annulees, setAnnulees] = useState<Commande[] | null>(null);
  const [erreurAnnulees, setErreurAnnulees] = useState<string | null>(null);
  const aujourdhui = dateDuJour();
  // Bande de la semaine (21/11/2026) : retraits par jour ; toucher un jour filtre la liste.
  const [debutSemaine, setDebutSemaine] = useState(0);
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  const [joursFermes, setJoursFermes] = useState<JourFerme[]>([]);
  // En retard dès l'heure de retrait passée, rouge à 19h (29/10/2026) : l'écran suit l'heure.
  const { minutes } = useMaintenant();

  const charger = useCallback(async () => {
    try {
      // Ménage au passage : archivage à J+2, anonymisation à 30 jours.
      // Pas de tâche planifiée à surveiller — quelqu'un ouvre cet écran
      // tous les jours, cela suffit.
      void fetch('/api/commandes', { method: 'PUT' }).catch(() => {});

      const r = await lireReponse<CommandeApi[]>(await fetch('/api/commandes?statut=en_cours'));
      if (!r.ok) {
        setErreur(r.message);
        setCommandes([]);
        return;
      }
      setCommandes(r.donnees.map(depuisApi));
      setErreur(null);
    } catch {
      const e = echecReseau();
      setErreur(e.ok ? null : e.message);
      setCommandes([]);
    }
  }, []);

  const chargerAnnulees = useCallback(async () => {
    try {
      const du = decalerJours(dateDuJour(), -JOURS_ANNULEES_VISIBLES);
      const r = await lireReponse<CommandeApi[]>(await fetch(`/api/commandes?statut=annulee&du=${du}`));
      if (!r.ok) {
        setErreurAnnulees(r.message);
        setAnnulees([]);
        return;
      }
      // La dernière annulée en premier.
      setAnnulees(r.donnees.map(depuisApi).sort((a, b) => (b.annuleeLe ?? '').localeCompare(a.annuleeLe ?? '')));
      setErreurAnnulees(null);
    } catch {
      const e = echecReseau();
      setErreurAnnulees(e.ok ? null : e.message);
      setAnnulees([]);
    }
  }, []);

  const voirAnnulees = () => {
    setVue('annulees');
    setAnnulees(null);
    void chargerAnnulees();
  };

  // Après un changement dans la fiche : la liste en cours, et les annulées si elles sont à l'écran.
  const recharger = useCallback(async () => {
    await charger();
    if (vue === 'annulees') await chargerAnnulees();
  }, [charger, chargerAnnulees, vue]);

  useEffect(() => {
    let annule = false;
    (async () => {
      await Promise.resolve();
      if (!annule) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [charger]);

  useEffect(() => {
    let vivant = true;
    fetch('/api/calendrier', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { joursFermes?: JourFerme[] } | null) => {
        if (vivant && c && Array.isArray(c.joursFermes)) setJoursFermes(c.joursFermes);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);

  const groupes = useMemo(
    () =>
      grouperCommandes(
        chercherCommandes(
          jourChoisi ? (commandes ?? []).filter((c) => c.retraitLe.slice(0, 10) === jourChoisi) : (commandes ?? []),
          recherche,
        ),
        aujourdhui,
        minutes,
      ),
    [commandes, recherche, aujourdhui, minutes, jourChoisi],
  );
  const semaine = Array.from({ length: 7 }, (_, k) => decalerJours(aujourdhui, debutSemaine * 7 + k));
  const retraitsDuJour = (iso: string) => (commandes ?? []).filter((c) => c.retraitLe.slice(0, 10) === iso);
  const annuleesTrouvees = useMemo(() => chercherCommandes(annulees ?? [], recherche), [annulees, recherche]);
  const ouverte = [...(commandes ?? []), ...(annulees ?? [])].find((c) => c.id === ouverteId) ?? null;

  /* ------------------------------------------- Prénoms de l'équipe */

  if (!prete)
    return (
      <>
        <Chargement />
        <RappelChargement />
      </>
    );

  if (gestionEquipe) {
    return (
      <>
        <Entete
          titre="Prénoms du jour"
          sousTitre="Les prénoms écrits aujourd’hui restent proposés jusqu’à ce soir, sans jamais être cochés d’avance. Demain, la liste repart vide."
          actions={
            <Bouton
              variante="principal"
              onClick={() => {
                setGestionEquipe(false);
                setGererNoms(false);
              }}
            >
              Retour aux commandes
            </Bouton>
          }
        />
        <Carte className="p-4">
          <div className="flex flex-wrap gap-2">
            {equipe.map((nom) =>
              gererNoms ? (
                // Mode « retirer » : un toucher retire le prénom de cette tablette.
                <Bouton key={nom} variante="danger" onClick={() => retirer(nom)} aria-label={`Retirer ${nom}`}>
                  {nom} ×
                </Bouton>
              ) : (
                <span key={nom} className="inline-flex min-h-11 items-center rounded-full bg-segment-fond px-4 text-base font-medium text-ink">
                  {nom}
                </span>
              ),
            )}
            {equipe.length === 0 ? <p className="text-sm text-ink-2">Aucun prénom aujourd’hui : chacun écrit le sien à sa première commande.</p> : null}
          </div>
          {equipe.length > 0 ? (
            <button
              type="button"
              onClick={() => setGererNoms((v) => !v)}
              className="mt-3 min-h-11 text-sm text-ink-2 underline underline-offset-2"
            >
              {gererNoms ? 'Terminé' : 'Retirer un prénom'}
            </button>
          ) : null}
          <form
            className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const nom = nouveauNom.trim();
              if (!nom) return;
              ajouter(nom);
              setNouveauNom('');
            }}
          >
            <label htmlFor="nouveau-vendeur" className="text-xs text-ink-3">
              Ajouter un prénom
            </label>
            <input
              id="nouveau-vendeur"
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
              placeholder="Prénom"
              className="min-h-11 rounded-xl border border-transparent bg-segment-fond px-3 text-sm text-ink"
            />
            <Bouton type="submit" variante="secondaire">
              Ajouter
            </Bouton>
          </form>
          <p className="mt-4 text-xs text-ink-3">
            Cette liste reste sur cette tablette. L’application ne conserve aucun répertoire du
            personnel.
          </p>
        </Carte>
      </>
    );
  }

  /* ------------------------------------------------------- La liste */

  return (
    <>
      <Entete
        titre="Commandes"
        sousTitre={
          <button
            type="button"
            onClick={() => setGestionEquipe(true)}
            className="underline underline-offset-2 hover:text-ink"
          >
            Prénoms du jour
          </button>
        }
        actions={
          <>
            {/* Barre d'outils façon iOS : réglages en bouton rond, l'action principale à côté. */}
            <Link
              href="/commandes/reglages"
              aria-label="Réglages des commandes"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-segment-fond text-ink-2 transition active:scale-95 active:opacity-80"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 1.9 1.5a7.6 7.6 0 0 0 0 3l-1.9 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z" />
              </svg>
            </Link>
            <LienBouton href="/commandes/nouvelle" variante="principal">
              Nouvelle commande
            </LienBouton>
          </>
        }
      />

      {erreur ? <Alerte>{erreur}</Alerte> : null}

      {vue === 'enCours' ? (
        <BandeSemaine
          titre="Retraits de la semaine"
          jours={semaine}
          aujourdhui={aujourdhui}
          choisi={jourChoisi}
          onChoisir={(j) => setJourChoisi((avant) => (avant === j ? null : j))}
          onPrecedente={() => setDebutSemaine((d) => d - 1)}
          onSuivante={() => setDebutSemaine((d) => d + 1)}
          onRetourAujourdhui={debutSemaine !== 0 ? () => setDebutSemaine(0) : null}
          cellule={(iso) => {
            const liste = retraitsDuJour(iso);
            const ferme = estJourFerme(iso, joursFermes);
            return {
              libelle: `${formatDateLong(iso)} : ${ferme ? 'fermé' : `${liste.length} retrait${liste.length > 1 ? 's' : ''}`}`,
              ferme,
              bas: ferme ? <span className="text-xs font-normal">fermé</span> : liste.length === 0 ? undefined : liste.length,
              point: liste.some((c) => c.statut === 'a_imprimer'),
            };
          }}
          note={
            jourChoisi ? (
              <>
                Retraits du {formatDateLong(jourChoisi)} seulement ·{' '}
                <button type="button" onClick={() => setJourChoisi(null)} className="min-h-11 font-medium text-accent">
                  Tout afficher
                </button>
              </>
            ) : (
              'Toucher un jour pour ne voir que ses retraits · un point = bon à imprimer.'
            )
          }
        />
      ) : null}

      <div className="mb-5">
        {/* Champ de recherche d'iOS : piste grise, loupe, texte de 17 points. */}
        <label className="relative block">
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Chercher une commande"
            placeholder="Nom, téléphone ou numéro"
            className="min-h-11 w-full rounded-2xl bg-segment-fond pl-10 pr-4 text-[17px] text-ink placeholder:text-ink-3 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        {vue === 'enCours' && commandes && commandes.length > 0 ? (
          <div className="mt-3">
            {/* Même contrôle segmenté que l'accueil vendeur (Tout / Pâtisserie / Salé…). */}
            <Segmente<CleGroupe | 'toutes'>
              libelle="Filtrer les commandes"
              valeur={filtre ?? 'toutes'}
              onChange={(v) => setFiltre(v === 'toutes' ? null : v)}
              nombreDessous
              options={[
                { valeur: 'toutes', libelle: 'Toutes' },
                ...GROUPES.map((g) => ({ valeur: g.cle, libelle: LIBELLE_FILTRE[g.cle], nombre: groupes[g.cle].length })),
              ]}
            />
          </div>
        ) : null}
      </div>

      {vue === 'annulees' ? (
        <section>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-4">
            <h2 className="text-sm font-semibold text-ink-2">
              Commandes annulées{annulees ? <> · <span className="chiffres">{annuleesTrouvees.length}</span></> : null}
            </h2>
            <button type="button" onClick={() => setVue('enCours')} className="min-h-11 px-2 text-base font-medium text-accent">
              Revenir aux commandes en cours
            </button>
          </div>
          {erreurAnnulees ? <Alerte>{erreurAnnulees}</Alerte> : null}
          {annulees === null ? (
            <Chargement libelle="Chargement des commandes annulées…" />
          ) : annuleesTrouvees.length === 0 ? (
            <div className="rounded-2xl bg-surface px-4 py-6 text-center">
              <p className="text-base text-ink-2">
                {recherche.trim() ? 'Aucune commande annulée ne correspond à cette recherche.' : 'Aucune commande annulée ces derniers temps.'}
              </p>
            </div>
          ) : (
            <ListeGroupee>
              {annuleesTrouvees.map((commande) => (
                <CelluleCommande
                  key={commande.id}
                  commande={commande}
                  types={typesDeCommande(commande)}
                  aujourdhui={aujourdhui}
                  avecDate
                  avecStatut
                  onOuvrir={(c) => setOuverteId(c.id)}
                />
              ))}
            </ListeGroupee>
          )}
        </section>
      ) : commandes === null ? (
        <>
          <Chargement />
          <RappelChargement />
        </>
      ) : commandes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucune commande en cours"
            detail="Les commandes retirées par le client ou annulées sortent de cette liste. Elles s’archivent d’elles-mêmes deux jours après le retrait."
            action={<LienBouton href="/commandes/nouvelle" variante="principal">Nouvelle commande</LienBouton>}
          />
        </Carte>
      ) : (
        <div className="grid gap-6">
          {GROUPES.filter((g) => filtre === null || filtre === g.cle).map((g) => (
            <Groupe
              key={g.cle}
              titre={g.titre}
              commandes={groupes[g.cle]}
              aujourdhui={aujourdhui}
              minutes={minutes}
              avecDate={g.cle !== 'duJour'}
              onOuvrir={(c) => setOuverteId(c.id)}
            />
          ))}
          {jourChoisi && filtre === null && GROUPES.every((g) => groupes[g.cle].length === 0) ? (
            <div className="rounded-2xl bg-surface px-4 py-6 text-center">
              <p className="text-base text-ink-2">Aucun retrait ce jour-là.</p>
              <button type="button" onClick={() => setJourChoisi(null)} className="mt-2 min-h-11 px-3 text-base font-medium text-accent">
                Voir toutes les commandes
              </button>
            </div>
          ) : null}
          {filtre !== null && groupes[filtre].length === 0 ? (
            <div className="rounded-2xl bg-surface px-4 py-6 text-center">
              <p className="text-base text-ink-2">Aucune commande ici.</p>
              <button type="button" onClick={() => setFiltre(null)} className="mt-2 min-h-11 px-3 text-base font-medium text-accent">
                Voir toutes les commandes
              </button>
            </div>
          ) : null}
        </div>
      )}

      {vue === 'enCours' && commandes !== null ? (
        // Accès discret : les annulées ne sont pas du travail à faire, mais on doit pouvoir les retrouver.
        <p className="mt-6 text-center">
          <button type="button" onClick={voirAnnulees} className="min-h-11 px-3 text-sm text-ink-2 underline underline-offset-2">
            Voir les commandes annulées
          </button>
        </p>
      ) : null}

      <FicheCommande commande={ouverte} onFermer={() => setOuverteId(null)} onChange={recharger} />
    </>
  );
}

/* ------------------------------------------------------------- Les groupes */

/* ------------------------------------------------------------- Un groupe */

/**
 * Un groupe en liste façon iOS : titre discret, cellules blanches arrondies.
 * Chaque cellule dit l'heure et le client d'abord, puis le détail court, puis
 * le statut ; un toucher ouvre la fiche (Modifier, Imprimer le bon, Marquer
 * retirée y sont réunis, au lieu de trois boutons sur chaque carte).
 */
function Groupe({
  titre,
  commandes,
  aujourdhui,
  minutes,
  avecDate,
  onOuvrir,
}: {
  titre: string;
  commandes: Commande[];
  aujourdhui: string;
  minutes: number;
  avecDate: boolean;
  onOuvrir: (c: Commande) => void;
}) {
  if (commandes.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1.5 px-4 text-sm font-semibold text-ink-2">
        {titre} · <span className="chiffres">{commandes.length}</span>
      </h2>
      <ListeGroupee>
        {commandes.map((commande) => (
          <CelluleCommande
            key={commande.id}
            commande={commande}
            types={typesDeCommande(commande)}
            aujourdhui={aujourdhui}
            minutes={minutes}
            avecDate={avecDate}
            avecStatut
            onOuvrir={onOuvrir}
          />
        ))}
      </ListeGroupee>
    </section>
  );
}
