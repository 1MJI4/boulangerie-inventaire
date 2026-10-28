// src/domaine/gouts.ts
//
// R62 — goût obligatoire d'un gâteau sur commande (propriétaire, 22/10/2026).
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
 *  - `goutsProposes` : goûts propres à ce gâteau, à la place de la liste du
 *    gérant (Bavarois : mousse chocolat ou Matadi chocolat, 28/10/2026).
 */
export type ChoixGout = { liste: 'parfum' | 'entremet'; parEtage: boolean; goutsProposes?: readonly string[] };

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
 * Niveau : BLOQUANT (ERR_GOUT_MANQUANT), à la saisie de la ligne, avec la
 * sortie « Au choix du pâtissier ».
 * N'interdit pas : un produit sans choix de goût (comptoir, salé, minis) ;
 * « Au choix du pâtissier » ; un goût hors de la liste (texte libre).
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
