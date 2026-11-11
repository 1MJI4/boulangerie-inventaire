// src/domaine/gouts.ts
//
// R62 — goût obligatoire d'un gâteau sur commande (propriétaire, 22/10/2026).
// R67 — goût obligatoire à liste FERMÉE, propre au produit : Bûches et Cœurs
//       du rayon « Special fin d'année » (propriétaire, 11/11/2026).
// Propriétaire : agent `regles-metier`.
//
// Quel gâteau demande quoi est une DONNÉE (src/catalogue/goutsSurCommande.ts),
// jamais déduite du nom (LOI 6). Les listes proposées (goûts, recettes
// d'entremet, décorations) sont réglées par le gérant : le domaine ne juge pas
// le mot choisi, seulement qu'il y en a un par goût attendu.

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import type { FicheTarifee } from './types.ts';

/**
 * Ce qu'un gâteau sur commande demande :
 *  - `parfum` : UN goût (Bavarois, Layer Cake…) — un goût peut déjà être un
 *    mélange de la liste (« Chocolat caramel ») ;
 *  - `entremet` : UNE recette d'entremet (Saint-Michel, Javanais…) ;
 *  - `parEtage` : un goût PAR ÉTAGE (pièces montées : des gâteaux posés l'un
 *    sur l'autre), le nombre d'étages venant du tarif ;
 *  - `goutsEnTete` : goûts que le magasin fait DÉJÀ pour ce gâteau, montrés en
 *    premier ; la liste du manager suit (Bavarois, propriétaire 28/10/2026) ;
 *  - `propre` : UN goût pris dans la liste FERMÉE du produit (`gouts` : les
 *    goûts écrits sur le tarif, à la lettre — Bûches, Cœurs ; R67). La liste du
 *    manager n'est jamais proposée, et il n'y a jamais de goût par étage.
 */
export type ChoixGout =
  | { liste: 'parfum' | 'entremet'; parEtage: boolean; goutsEnTete?: readonly string[] }
  | { liste: 'propre'; parEtage: false; gouts: readonly string[] };

/** Listes réglées par le gérant (goûts, recettes d'entremet), telles que l'écran les reçoit. */
export type ListesGouts = { parfums?: readonly string[] | null; entremets?: readonly string[] | null };

/** Sortie en un geste quand le client hésite : la vente n'est jamais perdue. */
export const GOUT_AU_CHOIX = 'Au choix du pâtissier';

/** Nombre de goûts attendus pour ce gâteau (0 = non concerné). */
export function goutsAttendus(choix: ChoixGout | null | undefined, fiche: FicheTarifee): number {
  if (!choix) return 0;
  if (!choix.parEtage) return 1;
  const etages = fiche.prix.etages;
  return typeof etages === 'number' && etages > 0 ? etages : 1;
}

/**
 * Règle R62 : un gâteau sur commande porte son goût (ou sa recette
 * d'entremet), un par étage pour une pièce montée.
 * Règle R67 : une Bûche ou un Cœur porte UN goût, pris dans sa propre liste.
 * Niveau : BLOQUANT (ERR_GOUT_MANQUANT), à la saisie de la ligne, avec la
 * sortie « Au choix du pâtissier » — sans goût, l'atelier ne peut pas produire.
 * N'interdit pas : un produit sans choix de goût (comptoir, salé, minis) ;
 * « Au choix du pâtissier » ; un goût hors de la liste (texte libre).
 *
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°97) : pour une liste `propre`, un
 * goût hors de la liste du produit est accepté comme pour les autres gâteaux
 * (« Autre… ») : le domaine ne juge pas le mot. La liste est fermée à l'écran
 * (seuls ses goûts sont proposés) ; si le propriétaire veut un refus, il se
 * mettra ici, avec la sortie vers un goût de la liste.
 */
export function validerGouts(
  choix: ChoixGout | null | undefined,
  fiche: FicheTarifee,
  gouts: readonly (string | null | undefined)[] | null | undefined,
): Resultat<string[]> {
  const attendus = goutsAttendus(choix, fiche);
  const remplis = (gouts ?? []).map((g) => String(g ?? '').trim());
  if (attendus === 0) return succes(remplis.filter(Boolean));
  const manquants = Array.from({ length: attendus }, (_, i) => i).filter((i) => !remplis[i]);
  if (manquants.length === 0) return succes(remplis.slice(0, attendus));
  return signaler(
    'ERR_GOUT_MANQUANT',
    {
      produit: fiche.produit.produit,
      objet: choix?.liste === 'entremet' ? 'la recette' : 'le goût',
      etage: attendus > 1 ? manquants[0] + 1 : null,
    },
    { champ: 'gouts', valeurProposee: GOUT_AU_CHOIX },
  );
}

/**
 * Goûts à proposer pour ce produit, dans l'ordre d'affichage :
 *  - liste `propre` : les goûts du produit, dans l'ordre du tarif — jamais la
 *    liste du manager ;
 *  - `entremet` : les recettes d'entremet ; `parfum` : les goûts du manager —
 *    dans les deux cas précédés des `goutsEnTete` du gâteau.
 * Sans doublon ni entrée vide ; liste absente → vide. « Au choix du pâtissier »
 * n'en fait pas partie : c'est une sortie, proposée à part.
 */
export function goutsProposes(choix: ChoixGout, listes: ListesGouts | null | undefined): string[] {
  if (choix.liste === 'propre') return ordonnerGouts(undefined, choix.gouts);
  const liste = (choix.liste === 'entremet' ? listes?.entremets : listes?.parfums) ?? [];
  return ordonnerGouts(choix.goutsEnTete, liste);
}

/**
 * Ordre des goûts proposés : ceux du gâteau d'abord (`goutsEnTete`, dans leur
 * ordre), puis la liste du manager sans doublon (comparaison sans casse ni
 * espaces en trop). Le libellé affiché est celui de la donnée, à la lettre (LOI 5).
 */
export function ordonnerGouts(enTete: readonly string[] | undefined, liste: readonly string[]): string[] {
  const cle = (g: string) => g.trim().toLocaleLowerCase('fr');
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const g of [...(enTete ?? []), ...liste]) {
    if (!g.trim() || vus.has(cle(g))) continue;
    vus.add(cle(g));
    sortie.push(g);
  }
  return sortie;
}
