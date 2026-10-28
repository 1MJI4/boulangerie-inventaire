// src/domaine/unGateauParLigne.ts
//
// UNE LIGNE PAR GÂTEAU — décision du propriétaire (28/10/2026, QUESTIONS-GERANT
// n°89) : « 2 Bavarois comptent pour 2 gâteaux différents, avec leurs propres
// caractéristiques » (goût, forme, écriture, photo de modèle, photo à
// imprimer, précision). Propriétaire : agent `regles-metier`.
//
// « Gâteau du comptoir » = donnée du produit (`estGateauDuComptoir` :
// régime A, à la pièce, famille FAMILLES_GATEAU), jamais le nom (LOI 6).
// Un gâteau par personne (régime C) est déjà UNE ligne : sa quantité est le
// nombre de parts de CE gâteau, rien ne change pour lui.
//
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°93) : la règle vaut pour TOUTE la
// famille « gâteau » du comptoir, y compris les petites pièces du rayon
// « Special fin d'année » (Bûchette, Petit Cœurs) : 6 bûchettes = 6 lignes.

import type { Echec } from './resultat.ts';
import { bloquant } from './resultat.ts';
import { estGateauDuComptoir, type RepereGateau } from './supplements.ts';

/** Sortie « Séparer en N gâteaux » : `valeurProposee` du refus (forme reconnue par l'écran). */
export type SeparationProposee = { separerEn: number };

export function estSeparationProposee(v: unknown): v is SeparationProposee {
  return (
    typeof v === 'object' && v !== null &&
    Number.isSafeInteger((v as SeparationProposee).separerEn) && (v as SeparationProposee).separerEn > 1
  );
}

/**
 * Texte du refus et de sa sortie. Code réutilisé : ERR_QUANTITE_INVALIDE
 * (quantité impossible pour cette ligne) ; texte propre à la règle, défini
 * ICI en attendant son entrée au catalogue des messages (Dépendance
 * `gestion-erreurs`, src/domaine/messages.ts).
 */
export function messageUnGateauParLigne(produit: string, n: number): string {
  return (
    `« ${produit} » : ${n} gâteaux sur une seule ligne. Chaque gâteau a sa ligne, avec son goût, ` +
    `sa forme et son écriture : séparez-les.`
  );
}

export function libelleSeparation(n: number): string {
  return `Séparer en ${n} gâteaux`;
}

/**
 * Règle (28/10/2026) : une ligne de gâteau du comptoir porte UN gâteau.
 * Niveau : BLOQUANT, à la saisie de la ligne (LOI 7 : refus avec sortie).
 *  - quantité entière > 1 → ERR_QUANTITE_INVALIDE, champ `quantite`,
 *    `valeurProposee` = { separerEn: N } (sortie « Séparer en N gâteaux » : la
 *    ligne est remplacée par N lignes de 1, côté écran).
 * N'interdit pas : 1 gâteau ; deux lignes du même gâteau ; 6 viennoiseries,
 * 10 mini-burgers, un Layer Cake de 30 parts (pas des gâteaux du comptoir).
 * Quantité vide, nulle ou décimale : jugée avant (`validerQuantite`).
 */
export function controlerUnGateauParLigne(
  ligne: Omit<RepereGateau, 'quantite'> & { quantite: number; produit: string },
  famillesGateau: readonly string[],
): Echec | null {
  if (!estGateauDuComptoir(ligne, famillesGateau)) return null;
  const n = ligne.quantite;
  if (!Number.isSafeInteger(n) || n <= 1) return null;
  return bloquant('ERR_QUANTITE_INVALIDE', messageUnGateauParLigne(ligne.produit, n), {
    champ: 'quantite',
    valeurProposee: { separerEn: n } satisfies SeparationProposee,
  });
}
