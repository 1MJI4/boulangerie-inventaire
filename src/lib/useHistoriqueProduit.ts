'use client';

// src/lib/useHistoriqueProduit.ts
//
// Le manager décide de mémoire ce qu'il faut produire demain. Les mois de
// saisie déjà en base peuvent lui répondre : voilà ce qui a été produit et
// ce qui est resté sur l'étal les mêmes jours de semaine précédents.

import { useEffect, useState } from 'react';
import { FUSEAU, memesJoursPrecedents } from './dateProduction';

export type RepereProduit = {
  /** Moyenne produite les mêmes jours de semaine, arrondie. */
  moyenneProduite: number | null;
  /** Moyenne de ce qui est resté invendu. */
  moyenneInvendue: number | null;
  /** Dernière occurrence connue du même jour de semaine. */
  dernier: { produite: number | null; restante: number | null } | null;
  /**
   * Heure moyenne du premier zéro, en minutes depuis minuit, sur les journées
   * où le produit s'est épuisé. Un produit à sec dès 11h n'a pas manqué de peu :
   * il a manqué toute l'après-midi.
   */
  ruptureMoyenneMinutes: number | null;
  /** Nombre de ces journées où il y a eu rupture. */
  joursEnRupture: number;
  /** Nombre de journées ayant servi au calcul. */
  echantillon: number;
};

const SEMAINES = 4;

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length);
}

export function useHistoriqueProduit(date: string, actif = true) {
  const [reperes, setReperes] = useState<Map<number, RepereProduit>>(new Map());
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!actif) return;
    let annule = false;

    (async () => {
      setChargement(true);
      try {
        const jours = memesJoursPrecedents(date, SEMAINES);
        const debut = jours[jours.length - 1];
        const fin = jours[0];

        const reponse = await fetch(`/api/inventaires?debut=${debut}&fin=${fin}&limit=2000`);
        if (!reponse.ok) throw new Error('historique indisponible');

        const lignes: {
          produitId: number;
          dateInventaire: string;
          quantiteProduite: number | null;
          quantiteRestante: number | null;
          rupturePremiereA: string | null;
        }[] = await reponse.json();

        const retenues = new Set(jours);
        const parProduit = new Map<number, typeof lignes>();

        for (const ligne of lignes) {
          const jour = String(ligne.dateInventaire).slice(0, 10);
          if (!retenues.has(jour)) continue; // on ne garde que les mêmes jours de semaine
          const liste = parProduit.get(ligne.produitId) ?? [];
          liste.push({ ...ligne, dateInventaire: jour });
          parProduit.set(ligne.produitId, liste);
        }

        const calcules = new Map<number, RepereProduit>();
        for (const [produitId, liste] of parProduit) {
          liste.sort((a, b) => String(b.dateInventaire).localeCompare(String(a.dateInventaire)));
          const produites = liste
            .map((l) => l.quantiteProduite)
            .filter((v): v is number => typeof v === 'number');
          const restantes = liste
            .map((l) => l.quantiteRestante)
            .filter((v): v is number => typeof v === 'number');

          // L'heure de rupture est lue dans le fuseau du magasin : un
          // horodatage UTC brut décalerait tout d'une ou deux heures.
          const ruptures = liste
            .map((l) => l.rupturePremiereA)
            .filter((v): v is string => typeof v === 'string')
            .map((iso) => {
              const d = new Date(iso);
              const hhmm = new Intl.DateTimeFormat('fr-BE', {
                timeZone: FUSEAU,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(d);
              const [h, m] = hhmm.split(':').map(Number);
              return (h % 24) * 60 + m;
            });

          calcules.set(produitId, {
            moyenneProduite: moyenne(produites),
            moyenneInvendue: moyenne(restantes),
            ruptureMoyenneMinutes: moyenne(ruptures),
            joursEnRupture: ruptures.length,
            dernier: liste[0]
              ? { produite: liste[0].quantiteProduite, restante: liste[0].quantiteRestante }
              : null,
            echantillon: liste.length,
          });
        }

        if (!annule) setReperes(calcules);
      } catch {
        if (!annule) setReperes(new Map()); // l'aide est un bonus, jamais bloquante
      } finally {
        if (!annule) setChargement(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [date, actif]);

  return { reperes, chargement };
}

/** "11h40" à partir de minutes depuis minuit. */
export function formatHeure(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
