'use client';

// src/components/BandeauCommandes.tsx
//
// Le rappel doit se greffer sur une habitude existante : un écran que
// personne n'ouvre ne rappelle rien. Le manager, lui, ouvre les prévisions
// tous les soirs entre 15 h et 22 h. C'est donc ici que les commandes du
// lendemain apparaissent — en tête, avant les quantités.
//
// L'application ne convertit pas les pièces en plateaux : les deux listes ne
// sont pas rapprochées, et c'est le manager qui sait ce que tient un plateau.
// Elle pose les chiffres du client à côté, il en tient compte.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Carte, Puce } from '@/components/ui';
import type { Commande } from '@/lib/commandes';
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

  // Une même ligne peut venir de plusieurs commandes : on regroupe par
  // libellé pour que le manager lise « 30 × Huit » et pas trois fois « 10 ».
  const parProduit = new Map<string, number>();
  for (const commande of commandes) {
    for (const ligne of commande.lignes) {
      parProduit.set(ligne.libelle, (parProduit.get(ligne.libelle) ?? 0) + ligne.quantite);
    }
  }

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

      {parProduit.size > 0 ? (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {[...parProduit.entries()].map(([libelle, quantite]) => (
            <li key={libelle} className="flex items-baseline gap-2 text-sm">
              <span className="chiffres w-12 shrink-0 font-semibold text-accent">{quantite} ×</span>
              <span className="min-w-0 text-ink">{libelle}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {parProduit.size > 0 ? (
        <p className="mt-3 text-xs text-ink-3">
          Quantités dites par le client, en pièces. À ajouter à ce que vous prévoyez ci-dessous.
        </p>
      ) : null}
    </Carte>
  );
}
