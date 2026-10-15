'use client';

// src/components/saisie/SaisieQuantite.tsx
//
// Point d'entrée unique pour saisir une quantité : choisit le pavé selon
// l'unité DU PRODUIT (LOI N°2). Les props sont une union discriminée : avec
// `unite: 'kg'` on manipule des `grammes`, avec `unite: 'piece'` une
// `quantite` entière. Impossible, à la compilation, de passer des pièces à un
// produit au kilo ou l'inverse.
//
// L'unité vient du catalogue (`getProduit(id).unite`), jamais du nom.

import type { Resultat } from '@/domaine/resultat';
import type { PropsCommunesPave } from './CadrePave';
import type { ContexteQuantite } from './lecteurs';
import { PaveDecimalPoids } from './PaveDecimalPoids';
import { PaveEntier } from './PaveEntier';

type Commun = PropsCommunesPave & {
  /** 'inventaire' : 0 accepté · 'commande' : passe aussi par `validerQuantite` (> 0). */
  contexte: ContexteQuantite;
  /** À chaque touche : verdict du domaine (null = champ vide). */
  onResultat?: (resultat: Resultat<number> | null) => void;
  /** Nom du champ dans les signalements (défaut « quantite »). */
  champ?: string;
};

export type PropsSaisieQuantite =
  | (Commun & {
      unite: 'piece';
      quantite: number | null;
      onChange: (quantite: number | null) => void;
      onValider?: (quantite: number) => void;
      /** « pièces » par défaut, « parts » pour un gâteau. */
      libelleUnite?: string;
    })
  | (Commun & {
      unite: 'kg';
      /** Poids en GRAMMES entiers. */
      grammes: number | null;
      onChange: (grammes: number | null) => void;
      onValider?: (grammes: number) => void;
    });

export function SaisieQuantite(props: PropsSaisieQuantite) {
  if (props.unite === 'kg') {
    const { unite: _unite, ...reste } = props;
    void _unite;
    return <PaveDecimalPoids {...reste} />;
  }
  const { unite: _unite, ...reste } = props;
  void _unite;
  return <PaveEntier {...reste} />;
}
