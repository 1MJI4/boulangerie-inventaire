'use client';

// src/components/saisie/PaveDecimalPoids.tsx
//
// Saisie d'un POIDS pour les produits vendus au kilo (LOI N°2). On lit la
// balance et on tape ce qu'elle affiche : « 1,250 ». L'écran affiche « kg »
// en gros à côté du nombre, le pavé a une virgule, et il n'y a JAMAIS de
// bouton « +1 » : un produit au kilo compté à la pièce est exactement
// l'erreur silencieuse que l'application doit empêcher.
//
// Le texte → grammes et la validation sont faits par le domaine
// (`lirePoids`, `validerQuantite` en commande) ; l'affichage par
// `formaterQuantite`. Sortie : des GRAMMES ENTIERS, jamais un flottant.

import type { Resultat } from '@/domaine/resultat';
import { formaterQuantite } from '@/domaine/unites';
import { CadrePave, type PropsCommunesPave } from './CadrePave';
import { appliquerTouche } from './mecanique';
import { lecteurPoids, texteDepuisGrammes, type ContexteQuantite } from './lecteurs';
import { useSaisiePave } from './useSaisiePave';

/** Garde-fou de frappe : 999 kg. Au-delà, c'est une faute de frappe (ergonomie, pas une règle). */
const CHIFFRES_ENTIERS_MAX = 3;

export type PropsPaveDecimalPoids = PropsCommunesPave & {
  /** Poids en grammes entiers, ou null si pas encore pesé. */
  grammes: number | null;
  /** 'inventaire' : 0 accepté · 'commande' : passe aussi par `validerQuantite` (> 0). */
  contexte: ContexteQuantite;
  /** À chaque touche : grammes lus par le domaine, null si vide ou refusé. */
  onChange: (grammes: number | null) => void;
  /** À chaque touche : verdict du domaine (null = champ vide), à afficher via `Signalement`. */
  onResultat?: (resultat: Resultat<number> | null) => void;
  /** Bouton de validation. Absent → pas de bouton. Appelé seulement si le domaine accepte. */
  onValider?: (grammes: number) => void;
  /** Nom du champ dans les signalements (défaut « quantite »). */
  champ?: string;
};

export function PaveDecimalPoids({
  grammes,
  contexte,
  onChange,
  onResultat,
  onValider,
  champ = 'quantite',
  ...communes
}: PropsPaveDecimalPoids) {
  const lire = lecteurPoids(contexte, champ);
  const lisible = (t: string) => lecteurPoids('inventaire', champ)(t).ok;
  const { texte, texteDeFrappe, aRemplacer, valeurLue, changer } = useSaisiePave({
    valeur: grammes,
    versTexte: texteDepuisGrammes,
    lire,
    onChange,
    onResultat,
  });

  return (
    <CadrePave
      {...communes}
      sousTitre="Poids lu sur la balance, en kilos"
      libelleAccessible={`Poids de ${communes.libelle}, en kilos`}
      texte={texte}
      aRemplacer={aRemplacer}
      // « kg » toujours visible, en gros : on ne doit jamais le confondre avec des pièces.
      suffixe={<span className="text-3xl font-bold text-ink">kg</span>}
      aide={valeurLue !== null ? `= ${formaterQuantite('kg', valeurLue)}` : ''}
      jeu="decimal"
      onTexte={changer}
      onTouche={(t) => changer(appliquerTouche(texteDeFrappe, t, { virgule: true, chiffresEntiersMax: CHIFFRES_ENTIERS_MAX, lisible }))}
      onValider={onValider ? () => valeurLue !== null && onValider(valeurLue) : undefined}
      valeurValide={valeurLue !== null}
    />
  );
}
