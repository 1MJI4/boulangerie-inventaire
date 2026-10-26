// src/domaine/taillesInterdites.ts
//
// R65 — un produit du tarif qui ne se fait pas dans cette taille (propriétaire,
// 26/10/2026 : « matadi minimum 6p », la Mousse chocolat existe en 4P).
// Propriétaire : agent `regles-metier`.
//
// La ligne du tarif reste au catalogue (LOI 5 : on ne corrige pas le fichier du
// gérant) ; c'est la COMMANDE qui la refuse. Liste et remplaçants = DONNÉE
// (TailleInterdite, défaut TAILLES_INTERDITES de constantes.ts), jamais déduits
// du nom : « Mousse chocolat » n'est proposée que parce que la donnée le dit.

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { libelleRemplacement, signaler } from './messages.ts';
import type { TailleInterdite } from './constantes.ts';
import type { FicheTarifee, SortieRemplacement } from './types.ts';
import { libelleProduitFiche } from './libelles.ts';

/** L'entrée de la liste qui interdit ce produit, ou null. */
export function tailleInterditePour(
  produitId: string | null | undefined,
  table: readonly TailleInterdite[],
): TailleInterdite | null {
  if (!produitId) return null;
  return table.find((t) => t.produit === produitId) ?? null;
}

/**
 * Règle R65 : un produit de la liste des tailles interdites ne se commande pas.
 * Niveau : BLOQUANT (`ERR_TAILLE_INTERDITE`, champ `produitId`), à la saisie de
 * la ligne, AVANT le minimum. C'est un minimum de taille (LOI 7) : aucune
 * dérogation, pas même par le gérant.
 * Sortie en un geste : `valeurProposee` = la liste des remplaçants
 * (SortieRemplacement[]), dans l'ordre de la donnée — « Passer en Matadi
 * chocolat 6P », « Prendre Mousse chocolat 4P ». La quantité (nombre de
 * gâteaux) est gardée, relevée au minimum du remplaçant s'il en a un.
 * Un remplaçant sans tarif à la date (`fiche` → null) n'est pas proposé ; s'il
 * n'en reste aucun, le refus tient avec « Choisir un autre produit ».
 * N'interdit pas : les autres tailles du même gâteau (Matadi chocolat 6P, 8P) ;
 * le même gâteau en vitrine (le tarif comptoir n'est pas touché) ; un goût
 * « Matadi » sur une Bûche ou un Cœur (autres produits, hors liste).
 */
export function validerTailleAutorisee(
  fiche: FicheTarifee,
  quantite: number,
  table: readonly TailleInterdite[],
  ficheDe: (produitId: string) => FicheTarifee | null,
): Resultat<string> {
  const interdite = tailleInterditePour(fiche.produit.id, table);
  if (!interdite) return succes(fiche.produit.id);
  const remplacements: SortieRemplacement[] = [];
  const pourMessage: { libelle: string; action: 'passer' | 'prendre' }[] = [];
  for (const r of interdite.remplacements) {
    const f = ficheDe(r.produitId);
    if (!f) continue;
    const libelle = libelleProduitFiche(f);
    const min = f.prix.minQuantite;
    const base = Number.isSafeInteger(quantite) && quantite > 0 ? quantite : 1;
    const q = Math.max(base, typeof min === 'number' && Number.isSafeInteger(min) ? min : 0);
    remplacements.push({ produitId: f.produit.id, libelle, quantite: q, bouton: libelleRemplacement(r.action, libelle) });
    pourMessage.push({ libelle, action: r.action });
  }
  return signaler(
    'ERR_TAILLE_INTERDITE',
    { produit: libelleProduitFiche(fiche), remplacements: pourMessage },
    { champ: 'produitId', valeurProposee: remplacements },
  );
}
