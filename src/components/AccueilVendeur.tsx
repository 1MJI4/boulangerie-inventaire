'use client';

// src/components/AccueilVendeur.tsx
//
// L'accueil d'une tablette « Vendeur » (22/10/2026). Pensé pour quelqu'un qui
// ouvre l'application pour la première fois : deux gros boutons pour les deux
// gestes du métier, puis la SEMAINE en bande (aujourd'hui en évidence, nombre
// de retraits et types par jour) et le détail du jour touché en dessous.
// Les jours fermés viennent des données (/api/calendrier), jamais du code.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Carte, Puce } from '@/components/ui';
import {
  attendUnVirement,
  depuisApi,
  LIBELLE_TYPE,
  resteAFaire,
  typesDeCommande,
  type Commande,
  type CommandeApi,
  type TypeCommande,
} from '@/lib/commandes';
import { dateDuJour, formatDateLong } from '@/lib/dateProduction';
import { decalerJours, estJourFerme, type JourFerme } from '@/domaine/calendrier';
import { formaterEuros, resteDu } from '@/domaine/argent';

/** Couleur d'étiquette par type : repérable d'un coup d'œil, sans lire. */
const STYLE_TYPE: Record<TypeCommande, string> = {
  boulangerie: 'bg-amber-100 text-amber-900 border-amber-300',
  patisserie: 'bg-pink-100 text-pink-900 border-pink-300',
  sale: 'bg-emerald-100 text-emerald-900 border-emerald-300',
};

function Etiquette({ type, nombre }: { type: TypeCommande; nombre?: number }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLE_TYPE[type]}`}>
      {nombre !== undefined ? `${nombre} ` : ''}
      {LIBELLE_TYPE[type]}
    </span>
  );
}

/** « Layer Cake + 2 autres ». */
function resumeLignes(c: Commande): string {
  const [premiere, ...autres] = c.lignes;
  if (!premiere) return '';
  return autres.length ? `${premiere.libelle} + ${autres.length} autre${autres.length > 1 ? 's' : ''}` : premiere.libelle;
}

/** « MER » / « 22 » pour la bande de la semaine. */
function jourCourt(iso: string): { nom: string; numero: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    nom: d.toLocaleDateString('fr-BE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase(),
    numero: String(d.getUTCDate()),
  };
}

function LigneRetrait({ commande }: { commande: Commande }) {
  const reste = resteDu(commande.totalCentimes, commande.acompteCentimes);
  return (
    <li>
      <Link
        href={`/commandes?q=${encodeURIComponent(commande.numero)}`}
        className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:border-accent"
      >
        <span className="chiffres w-14 shrink-0 text-lg font-semibold text-ink">{commande.retraitHeure ?? '—'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink">{commande.client}</span>
          <span className="block truncate text-sm text-ink-2">{resumeLignes(commande)}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {typesDeCommande(commande).map((t) => (
              <Etiquette key={t} type={t} />
            ))}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {commande.statut === 'a_imprimer' ? <Puce ton="accent">à imprimer</Puce> : null}
          {attendUnVirement(commande) ? <Puce ton="attention">virement ?</Puce> : null}
          {reste > 0 ? <span className="chiffres text-sm text-ink-2">reste {formaterEuros(reste)}</span> : null}
        </span>
      </Link>
    </li>
  );
}

export function AccueilVendeur({ libelleProfil, onChangerProfil }: { libelleProfil: string; onChangerProfil: () => void }) {
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [joursFermes, setJoursFermes] = useState<JourFerme[]>([]);
  const [aujourdhui, setAujourdhui] = useState(dateDuJour());
  const [debutSemaine, setDebutSemaine] = useState(0);
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<TypeCommande | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch('/api/commandes?statut=en_cours', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((donnees: CommandeApi[]) => {
        if (vivant) setCommandes(Array.isArray(donnees) ? donnees.map(depuisApi) : []);
      })
      .catch(() => vivant && setCommandes([]));
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
  }, []);

  const parJour = useMemo(() => {
    const m = new Map<string, Commande[]>();
    for (const c of (commandes ?? []).filter(resteAFaire)) {
      const j = c.retraitLe.slice(0, 10);
      m.set(j, [...(m.get(j) ?? []), c]);
    }
    for (const liste of m.values()) liste.sort((a, b) => (a.retraitHeure ?? '99').localeCompare(b.retraitHeure ?? '99'));
    return m;
  }, [commandes]);

  const semaine = Array.from({ length: 7 }, (_, k) => decalerJours(aujourdhui, debutSemaine + k));
  const choisi = jourChoisi ?? aujourdhui;
  const duJour = (parJour.get(choisi) ?? []).filter((c) => filtre === null || typesDeCommande(c).includes(filtre));
  const typesDuJour = (['boulangerie', 'patisserie', 'sale'] as const).filter((t) =>
    (parJour.get(choisi) ?? []).some((c) => typesDeCommande(c).includes(t)),
  );
  // Commandes déjà passées mais jamais imprimées : à ne pas oublier.
  const enRetard = (commandes ?? []).filter((c) => resteAFaire(c) && c.retraitLe.slice(0, 10) < aujourdhui);

  const tuile = 'flex min-h-24 flex-col justify-center rounded-2xl border-2 px-5 py-3 transition-colors';

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link href="/commandes/nouvelle" className={`${tuile} border-accent bg-accent text-white hover:bg-accent-fort`}>
          <span className="text-2xl font-semibold">+ Nouvelle commande</span>
          <span className="mt-1 text-sm text-white/85">Gâteau, traiteur, à retirer plus tard</span>
        </Link>
        <Link href="/saisie-vendeur" className={`${tuile} border-line-fort bg-surface text-ink hover:border-accent`}>
          <span className="text-2xl font-semibold">Compter le rayon</span>
          <span className="mt-1 text-sm text-ink-2">Le soir, à la fermeture</span>
        </Link>
      </div>

      {/* ------------------------------------------------- La semaine en bande */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-2">Retraits de la semaine</h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => setDebutSemaine((d) => d - 7)}
            className="h-11 w-11 rounded-lg border border-line bg-surface text-xl text-ink-2"
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
              className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2"
            >
              Aujourd’hui
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Semaine suivante"
            onClick={() => setDebutSemaine((d) => d + 7)}
            className="h-11 w-11 rounded-lg border border-line bg-surface text-xl text-ink-2"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-7 gap-1.5">
        {semaine.map((iso) => {
          const { nom, numero } = jourCourt(iso);
          const ferme = estJourFerme(iso, joursFermes);
          const liste = parJour.get(iso) ?? [];
          const estAujourdhui = iso === aujourdhui;
          const actif = iso === choisi;
          const aImprimer = liste.some((c) => c.statut === 'a_imprimer');
          const compte = (t: TypeCommande) => liste.filter((c) => typesDeCommande(c).includes(t)).length;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={actif}
              aria-label={`${formatDateLong(iso)} : ${ferme ? 'fermé' : `${liste.length} retrait${liste.length > 1 ? 's' : ''}`}`}
              onClick={() => {
                setJourChoisi(iso);
                setFiltre(null);
              }}
              className={`relative flex min-h-24 flex-col items-center rounded-xl border-2 px-0.5 py-1.5 transition-colors ${
                actif
                  ? 'border-accent bg-accent text-white'
                  : estAujourdhui
                    ? 'border-accent bg-accent-doux text-ink'
                    : ferme
                      ? 'border-line bg-surface-2 text-ink-3'
                      : 'border-line bg-surface text-ink'
              }`}
            >
              {aImprimer ? (
                <span aria-hidden className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-bloquant ring-2 ring-white" />
              ) : null}
              <span className={`text-[11px] font-semibold ${estAujourdhui && !actif ? 'text-accent' : ''}`}>
                {estAujourdhui ? 'AUJ.' : nom}
              </span>
              <span className="chiffres text-xl font-bold leading-tight">{numero}</span>
              {ferme ? (
                <span className="mt-auto text-[11px]">fermé</span>
              ) : liste.length === 0 ? (
                <span className="mt-auto text-sm opacity-50">—</span>
              ) : (
                <span className="mt-auto flex flex-col items-center gap-0.5">
                  <span className="chiffres text-base font-bold">{liste.length}</span>
                  <span className="flex gap-0.5">
                    {(['boulangerie', 'patisserie', 'sale'] as const).map((t) =>
                      compte(t) > 0 ? (
                        <span
                          key={t}
                          title={`${compte(t)} ${LIBELLE_TYPE[t]}`}
                          className={`h-2 w-2 rounded-full border ${STYLE_TYPE[t]}`}
                        />
                      ) : null,
                    )}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------- Le jour choisi */}
      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold capitalize text-ink">
            {choisi === aujourdhui ? 'Aujourd’hui — ' : ''}
            {formatDateLong(choisi)}
          </h2>
          {typesDuJour.length > 1
            ? typesDuJour.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={filtre === t}
                  onClick={() => setFiltre(filtre === t ? null : t)}
                  className={`rounded-full border-2 ${filtre === t ? 'border-ink' : 'border-transparent'}`}
                >
                  <Etiquette type={t} nombre={(parJour.get(choisi) ?? []).filter((c) => typesDeCommande(c).includes(t)).length} />
                </button>
              ))
            : null}
        </div>
        {commandes === null ? (
          <p className="text-sm text-ink-3">Chargement des commandes…</p>
        ) : estJourFerme(choisi, joursFermes) ? (
          <p className="text-sm text-ink-3">Magasin fermé ce jour-là.</p>
        ) : duJour.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune commande à remettre ce jour-là.</p>
        ) : (
          <ul className="grid gap-2">
            {duJour.map((c) => (
              <LigneRetrait key={c.id} commande={c} />
            ))}
          </ul>
        )}
      </section>

      {enRetard.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-bloquant">
            Date passée, pas encore remises ({enRetard.length})
          </h2>
          <ul className="grid gap-2">
            {enRetard.map((c) => (
              <LigneRetrait key={c.id} commande={c} />
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/commandes" className="mb-8 block">
        <Carte className="flex min-h-14 items-center justify-between p-4 hover:border-accent">
          <span className="text-base font-medium text-ink">Toutes les commandes</span>
          <span aria-hidden className="text-xl text-ink-3">→</span>
        </Carte>
      </Link>

      <p className="text-xs text-ink-3">
        Cet appareil est réglé sur « {libelleProfil} ».{' '}
        <button type="button" onClick={onChangerProfil} className="underline underline-offset-2 hover:text-ink-2">
          Changer
        </button>
      </p>
    </>
  );
}
