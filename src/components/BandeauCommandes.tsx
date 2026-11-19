'use client';

// src/components/BandeauCommandes.tsx
//
// Le rappel doit se greffer sur une habitude existante : un écran que
// personne n'ouvre ne rappelle rien. Le manager, lui, ouvre les prévisions
// tous les soirs entre 15 h et 22 h. C'est donc ici que les commandes du
// lendemain apparaissent — en tête, avant les quantités.
//
// L'application pose les chiffres du client à côté des prévisions. Seuls les
// produits reliés au fournil (R72 : croissants, couques) sont comptés tout
// seuls dans leurs plateaux ; pour le reste, le manager en tient compte.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Carte, Puce } from '@/components/ui';
import type { Commande } from '@/lib/commandes';
import { resumeCommandesDuJour } from '@/lib/commandesDuJour';
import { formatDateRelative, type DateISO } from '@/lib/dateProduction';

type CommandeApi = Commande & { retraitLe: string };

export function BandeauCommandes({ journee }: { journee: DateISO }) {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [aImprimer, setAImprimer] = useState(0);

  useEffect(() => {
    let vivant = true;
    fetch('/api/commandes?statut=en_cours')
      .then((r) => (r.ok ? r.json() : []))
      .then((donnees: CommandeApi[]) => {
        if (!vivant) return;
        const normalisees = donnees.map((c) => ({ ...c, retraitLe: c.retraitLe.slice(0, 10) }));
        setCommandes(normalisees.filter((c) => c.retraitLe === journee));
        setAImprimer(normalisees.filter((c) => c.statut === 'a_imprimer').length);
      })
      .catch(() => {
        setCommandes([]);
        setAImprimer(0);
      });
    return () => {
      vivant = false;
    };
  }, [journee]);

  if (commandes.length === 0 && aImprimer === 0) return null;

  // Une même ligne peut venir de plusieurs commandes : on regroupe pour que le
  // manager lise « 30 × Huit » et pas trois fois « 10 ». Un gâteau par personne
  // ne s'additionne pas : « 1 gâteau · Bavarois — 10 personnes » (commandesDuJour).
  const lignesDuJour = resumeCommandesDuJour(commandes);

  return (
    <Carte className="mb-5 border-accent/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">
          {commandes.length > 0
            ? `Commandes pour ${formatDateRelative(journee)}`
            : 'Commandes en attente'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {commandes.length > 0 ? <Puce ton="accent">{commandes.length}</Puce> : null}
          {aImprimer > 0 ? <Puce ton="attention">{aImprimer} à imprimer</Puce> : null}
          <Link href="/commandes" className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink">
            Voir
          </Link>
        </div>
      </div>

      {lignesDuJour.length > 0 ? (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {lignesDuJour.map((l) => (
            <li key={`${l.quantite}|${l.libelle}`} className="flex items-baseline gap-2 text-sm">
              <span className="chiffres min-w-[4.5rem] shrink-0 whitespace-nowrap font-semibold text-accent">{l.quantite}</span>
              <span className="min-w-0 text-ink">{l.libelle}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {lignesDuJour.length > 0 ? (
        <p className="mt-3 text-xs text-ink-3">
          Quantités dites par le client. Croissants et couques commandés sont déjà comptés dans leurs plateaux ci-dessous.
        </p>
      ) : null}
    </Carte>
  );
}
