'use client';

// src/components/AccueilVendeur.tsx
//
// L'accueil d'une tablette « Vendeur » (22/10/2026). Pensé pour quelqu'un qui
// ouvre l'application pour la première fois : deux gros boutons pour les deux
// gestes du métier, puis les commandes à remettre aujourd'hui et demain, à
// retrouver en un toucher quand le client se présente au comptoir.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Carte, Puce } from '@/components/ui';
import { attendUnVirement, depuisApi, resteAFaire, type Commande, type CommandeApi } from '@/lib/commandes';
import { dateDuJour, formatDateLong } from '@/lib/dateProduction';
import { decalerJours } from '@/domaine/calendrier';
import { formaterEuros, resteDu } from '@/domaine/argent';

/** Résumé d'une commande en quelques mots : « Layer Cake 20 parts + 2 autres ». */
function resumeLignes(c: Commande): string {
  const [premiere, ...autres] = c.lignes;
  if (!premiere) return '';
  return autres.length ? `${premiere.libelle} + ${autres.length} autre${autres.length > 1 ? 's' : ''}` : premiere.libelle;
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

function Section({ titre, commandes, vide }: { titre: string; commandes: Commande[]; vide?: string }) {
  if (commandes.length === 0 && !vide) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">
        {titre} {commandes.length ? <span className="chiffres text-ink-3">({commandes.length})</span> : null}
      </h2>
      {commandes.length ? (
        <ul className="grid gap-2">
          {commandes.map((c) => (
            <LigneRetrait key={c.id} commande={c} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">{vide}</p>
      )}
    </section>
  );
}

export function AccueilVendeur({ libelleProfil, onChangerProfil }: { libelleProfil: string; onChangerProfil: () => void }) {
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const aujourdhui = dateDuJour();
  const demain = decalerJours(aujourdhui, 1);

  useEffect(() => {
    let vivant = true;
    fetch('/api/commandes?statut=en_cours', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((donnees: CommandeApi[]) => {
        if (vivant) setCommandes(Array.isArray(donnees) ? donnees.map(depuisApi) : []);
      })
      .catch(() => vivant && setCommandes([]));
    return () => {
      vivant = false;
    };
  }, []);

  const liste = (commandes ?? []).filter(resteAFaire);
  const duJour = liste.filter((c) => c.retraitLe.slice(0, 10) === aujourdhui);
  const deDemain = liste.filter((c) => c.retraitLe.slice(0, 10) === demain);
  // Pas encore imprimées, pour plus tard : l'atelier ne les a pas encore reçues.
  const aImprimerPlusTard = liste.filter((c) => c.statut === 'a_imprimer' && c.retraitLe.slice(0, 10) > demain);

  const tuile =
    'flex min-h-28 flex-col justify-center rounded-2xl border-2 px-5 py-4 transition-colors sm:min-h-32';

  return (
    <>
      <p className="mb-4 text-base capitalize text-ink-2">{formatDateLong(aujourdhui)}</p>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link href="/commandes/nouvelle" className={`${tuile} border-accent bg-accent text-white hover:bg-accent-fort`}>
          <span className="text-2xl font-semibold">+ Nouvelle commande</span>
          <span className="mt-1 text-sm text-white/85">Gâteau, traiteur, à retirer plus tard</span>
        </Link>
        <Link href="/saisie-vendeur" className={`${tuile} border-line-fort bg-surface text-ink hover:border-accent`}>
          <span className="text-2xl font-semibold">Compter le rayon</span>
          <span className="mt-1 text-sm text-ink-2">Le soir, à la fermeture</span>
        </Link>
      </div>

      {commandes === null ? (
        <p className="mb-6 text-sm text-ink-3">Chargement des commandes…</p>
      ) : (
        <>
          <Section titre="À retirer aujourd’hui" commandes={duJour} vide="Aucune commande à remettre aujourd’hui." />
          <Section titre="À retirer demain" commandes={deDemain} />
          <Section titre="Pas encore imprimées" commandes={aImprimerPlusTard} />
        </>
      )}

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
