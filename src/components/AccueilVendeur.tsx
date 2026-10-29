'use client';

// src/components/AccueilVendeur.tsx
//
// L'accueil d'une tablette « Vendeur » (22/10/2026, refait façon Apple le
// 28/10/2026). Sur cet écran, le vendeur doit pouvoir voir ce qui part ce jour
// et ouvrir une commande d'un toucher, sans quitter l'écran.
//
// De haut en bas : la date en grand titre · les deux gestes du métier
// (Nouvelle commande, Compter le rayon) · la semaine en bande · le filtre
// Tout / Pâtisserie / Salé / Boulangerie, toujours visible · les retraits du
// jour choisi, chacun avec le détail de ses articles · les retraits passés.
// Toucher une commande ouvre sa FICHE sur place (FicheCommande).
// Les jours fermés viennent des données (/api/calendrier), jamais du code ;
// les types, du rayon de chaque produit (`typesDeCommande`), jamais du nom.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FicheCommande } from '@/components/FicheCommande';
import { CelluleCommande, ListeGroupee, Segmente } from '@/components/fiche/ElementsCommande';
import { useMaintenant } from '@/components/fiche/useMaintenant';
import { compterParType, filtrerParType, majusculeInitiale, trierParHeure, TYPES_FILTRE } from '@/components/fiche/presentationCommande';
import { IconeNiveau } from '@/components/signalement';
import { depuisApi, LIBELLE_TYPE, resteAFaire, typesDeCommande, type Commande, type CommandeApi, type TypeCommande } from '@/lib/commandes';
import { dateDuJour, formatDateCourt, formatDateLong } from '@/lib/dateProduction';
import { decalerJours, estJourFerme, type JourFerme } from '@/domaine/calendrier';

/** « mer » / « 22 » pour la bande de la semaine (casse normale : pas de capitales criées). */
function jourCourt(iso: string): { nom: string; numero: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    nom: d.toLocaleDateString('fr-BE', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''),
    numero: String(d.getUTCDate()),
  };
}

type Filtre = TypeCommande | 'tout';

export function AccueilVendeur({ libelleProfil, onChangerProfil }: { libelleProfil: string; onChangerProfil: () => void }) {
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [joursFermes, setJoursFermes] = useState<JourFerme[]>([]);
  const [aujourdhui, setAujourdhui] = useState(dateDuJour());
  // En retard dès l'heure de retrait passée, rouge à 19h (29/10/2026).
  const { minutes } = useMaintenant();
  const [debutSemaine, setDebutSemaine] = useState(0);
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  // Le filtre reste quand on change de jour : un pâtissier regarde « Pâtisserie » toute la semaine.
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [ouverteId, setOuverteId] = useState<number | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await fetch('/api/commandes?statut=en_cours', { cache: 'no-store' });
      const donnees = (r.ok ? await r.json() : []) as CommandeApi[];
      setCommandes(Array.isArray(donnees) ? donnees.map(depuisApi) : []);
    } catch {
      setCommandes((avant) => avant ?? []);
    }
  }, []);

  useEffect(() => {
    let vivant = true;
    (async () => {
      await Promise.resolve();
      if (vivant) await charger();
    })();
    // Jours fermés et date du jour du serveur (Bruxelles) : données, pas constantes.
    fetch('/api/calendrier', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { aujourdhui?: string; joursFermes?: JourFerme[] } | null) => {
        if (!vivant || !c) return;
        if (Array.isArray(c.joursFermes)) setJoursFermes(c.joursFermes);
        if (typeof c.aujourdhui === 'string') setAujourdhui(c.aujourdhui);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [charger]);

  const parJour = useMemo(() => {
    const m = new Map<string, Commande[]>();
    for (const c of (commandes ?? []).filter(resteAFaire)) {
      const j = c.retraitLe.slice(0, 10);
      m.set(j, [...(m.get(j) ?? []), c]);
    }
    for (const [j, liste] of m) m.set(j, trierParHeure(liste));
    return m;
  }, [commandes]);

  const type = filtre === 'tout' ? null : filtre;
  const semaine = Array.from({ length: 7 }, (_, k) => decalerJours(aujourdhui, debutSemaine + k));
  const choisi = jourChoisi ?? aujourdhui;
  const tousDuJour = parJour.get(choisi) ?? [];
  const comptes = compterParType(tousDuJour);
  const duJour = filtrerParType(tousDuJour, type);
  // Commandes dont la date est passée mais jamais retirées : à ne pas oublier.
  const enRetard = filtrerParType(
    trierParHeure((commandes ?? []).filter((c) => resteAFaire(c) && c.retraitLe.slice(0, 10) < aujourdhui)).sort((a, b) =>
      a.retraitLe.localeCompare(b.retraitLe),
    ),
    type,
  );
  const ouverte = (commandes ?? []).find((c) => c.id === ouverteId) ?? null;
  const titreJour = formatDateCourt(aujourdhui);

  return (
    <>
      {/* ------------------------------------------------- Grand titre */}
      <header className="mb-5">
        <p className="text-sm font-medium text-ink-2">Aujourd’hui</p>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-ink">{majusculeInitiale(titreJour)}</h1>
      </header>

      {/* ------------------------------------------------- Les deux gestes */}
      <div className="mb-7 grid gap-3 sm:grid-cols-2">
        <Link
          href="/commandes/nouvelle"
          className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl bg-accent px-5 py-3 text-accent-texte hover:bg-accent-fort"
        >
          <span aria-hidden className="text-3xl font-light leading-none">
            +
          </span>
          <span>
            <span className="block text-xl font-semibold">Nouvelle commande</span>
            <span className="block text-sm opacity-90">Gâteau, traiteur, à retirer plus tard</span>
          </span>
        </Link>
        <Link
          href="/saisie-vendeur"
          className="flex min-h-[4.5rem] items-center gap-4 rounded-2xl bg-surface px-5 py-3 text-ink hover:bg-surface-2"
        >
          <span className="flex-1">
            <span className="block text-xl font-semibold">Compter le rayon</span>
            <span className="block text-sm text-ink-2">Le soir, à la fermeture</span>
          </span>
          <span aria-hidden className="text-2xl text-ink-2">
            ›
          </span>
        </Link>
      </div>

      {/* ------------------------------------------------- La semaine en bande */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Retraits</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => setDebutSemaine((d) => d - 7)}
            className="h-11 w-11 rounded-full text-2xl text-accent hover:bg-accent-doux"
          >
            ‹
          </button>
          {debutSemaine !== 0 ? (
            <button
              type="button"
              onClick={() => {
                setDebutSemaine(0);
                setJourChoisi(null);
              }}
              className="h-11 rounded-full px-3 text-base font-medium text-accent hover:bg-accent-doux"
            >
              Aujourd’hui
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Semaine suivante"
            onClick={() => setDebutSemaine((d) => d + 7)}
            className="h-11 w-11 rounded-full text-2xl text-accent hover:bg-accent-doux"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-7 gap-1 rounded-2xl bg-surface p-1.5">
        {semaine.map((iso) => {
          const { nom, numero } = jourCourt(iso);
          const ferme = estJourFerme(iso, joursFermes);
          const liste = filtrerParType(parJour.get(iso) ?? [], type);
          const estAujourdhui = iso === aujourdhui;
          const actif = iso === choisi;
          const aImprimer = liste.some((c) => c.statut === 'a_imprimer');
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={actif}
              aria-label={`${formatDateLong(iso)} : ${
                ferme ? 'fermé' : `${liste.length} retrait${liste.length > 1 ? 's' : ''}${aImprimer ? ', bon à imprimer' : ''}`
              }`}
              onClick={() => setJourChoisi(iso)}
              className={`relative flex min-h-[4.75rem] flex-col items-center justify-start rounded-xl px-0.5 py-1.5 ${
                actif ? 'bg-accent text-accent-texte' : ferme ? 'jour-ferme text-ink-2' : 'text-ink hover:bg-surface-2'
              }`}
            >
              <span className={`text-xs font-medium ${actif ? '' : estAujourdhui ? 'text-accent' : 'text-ink-2'}`}>
                {estAujourdhui ? 'auj.' : nom}
              </span>
              <span className={`chiffres text-xl font-semibold leading-tight ${!actif && estAujourdhui ? 'text-accent' : ''}`}>
                {numero}
              </span>
              <span className="chiffres mt-auto text-sm font-semibold">
                {ferme ? <span className="text-xs font-normal">fermé</span> : liste.length === 0 ? <span className="opacity-40">·</span> : liste.length}
              </span>
              {aImprimer ? (
                <span
                  aria-hidden
                  className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${actif ? 'bg-accent-texte' : 'bg-accent'}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------- Filtre par type, toujours visible */}
      <div className="mb-4">
        <Segmente<Filtre>
          libelle="Type de commande"
          valeur={filtre}
          onChange={setFiltre}
          options={[
            { valeur: 'tout', libelle: 'Tout', nombre: comptes.tout },
            ...TYPES_FILTRE.map((t) => ({ valeur: t, libelle: LIBELLE_TYPE[t], nombre: comptes[t] })),
          ]}
        />
      </div>

      {/* ------------------------------------------------- Le jour choisi */}
      <section className="mb-7">
        <h3 className="mb-1.5 px-4 text-sm text-ink-2">
          {choisi === aujourdhui ? 'Aujourd’hui' : majusculeInitiale(formatDateCourt(choisi))}
          {duJour.length > 0 ? ` · ${duJour.length} retrait${duJour.length > 1 ? 's' : ''}` : ''}
          {type ? ` · ${LIBELLE_TYPE[type]}` : ''}
        </h3>
        {commandes === null ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-base text-ink-2">Chargement des commandes…</p>
        ) : estJourFerme(choisi, joursFermes) ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-base text-ink-2">Le magasin est fermé ce jour-là.</p>
        ) : duJour.length === 0 ? (
          <div className="rounded-2xl bg-surface px-4 py-6 text-center">
            <p className="text-base text-ink-2">
              {type && tousDuJour.length > 0 ? `Aucune commande ${LIBELLE_TYPE[type].toLowerCase()} ce jour-là.` : 'Aucun retrait ce jour-là.'}
            </p>
            {type && tousDuJour.length > 0 ? (
              <button type="button" onClick={() => setFiltre('tout')} className="mt-2 min-h-11 px-3 text-base font-medium text-accent">
                Voir tout ({tousDuJour.length})
              </button>
            ) : null}
          </div>
        ) : (
          <ListeGroupee>
            {duJour.map((c) => (
              <CelluleCommande
                key={c.id}
                commande={c}
                types={typesDeCommande(c)}
                aujourdhui={aujourdhui}
                minutes={minutes}
                onOuvrir={(x) => setOuverteId(x.id)}
              />
            ))}
          </ListeGroupee>
        )}
      </section>

      {enRetard.length > 0 ? (
        <section className="mb-7">
          <h3 className="mb-1.5 flex items-center gap-1.5 px-4 text-sm font-semibold text-bloquant">
            <IconeNiveau niveau="bloquant" className="h-4 w-4" />
            Date passée, pas encore retirées · {enRetard.length}
          </h3>
          <ListeGroupee>
            {enRetard.map((c) => (
              <CelluleCommande
                key={c.id}
                commande={c}
                types={typesDeCommande(c)}
                aujourdhui={aujourdhui}
                minutes={minutes}
                avecDate
                onOuvrir={(x) => setOuverteId(x.id)}
              />
            ))}
          </ListeGroupee>
        </section>
      ) : null}

      <ListeGroupee className="mb-8">
        <li>
          <Link href="/commandes" className="flex min-h-12 items-center justify-between px-4 py-3 hover:bg-surface-2">
            <span className="text-base font-medium text-ink">Toutes les commandes</span>
            <span aria-hidden className="text-xl text-ink-2">
              ›
            </span>
          </Link>
        </li>
      </ListeGroupee>

      <p className="px-4 text-sm text-ink-2">
        Cet appareil est réglé sur « {libelleProfil} ».{' '}
        <button type="button" onClick={onChangerProfil} className="min-h-11 underline underline-offset-2 hover:text-ink">
          Changer
        </button>
      </p>

      <FicheCommande commande={ouverte} onFermer={() => setOuverteId(null)} onChange={charger} />
    </>
  );
}
