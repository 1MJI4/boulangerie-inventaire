'use client';

// src/components/saisie/PaveEntier.tsx
//
// Saisie d'un nombre ENTIER : pièces, parts, nombre de symboles d'un Number
// Cake… Pas de virgule : une demi-pièce n'existe pas. Même apparence que
// `PaveDecimalPoids` et `PaveNumerique`.
//
// Lecture et validation par le domaine : `lirePieces` (+ `validerQuantite`
// en commande). Les minimums (LOI 7) ne sont PAS ici : l'écran les vérifie
// via le domaine et affiche le refus avec sa sortie (`Signalement`).

import type { Resultat } from '@/domaine/resultat';
import { CadrePave, type PropsCommunesPave } from './CadrePave';
import { appliquerTouche } from './mecanique';
import { lecteurPieces, texteDepuisPieces, type ContexteQuantite } from './lecteurs';
import { useSaisiePave } from './useSaisiePave';

export type PropsPaveEntier = PropsCommunesPave & {
  quantite: number | null;
  /** 'inventaire' : 0 accepté · 'commande' : passe aussi par `validerQuantite` (> 0). */
  contexte: ContexteQuantite;
  /** À chaque touche : nombre lu par le domaine, null si vide ou refusé. */
  onChange: (quantite: number | null) => void;
  /** À chaque touche : verdict du domaine (null = champ vide). */
  onResultat?: (resultat: Resultat<number> | null) => void;
  /** Unité affichée à côté du nombre : « pièces » (défaut), « parts », « symboles »… */
  libelleUnite?: string;
  onValider?: (quantite: number) => void;
  /** Garde-fou de frappe (défaut 4 chiffres). */
  chiffresMax?: number;
  /** Nom du champ dans les signalements (défaut « quantite »). */
  champ?: string;
};

export function PaveEntier({
  quantite,
  contexte,
  onChange,
  onResultat,
  libelleUnite = 'pièces',
  onValider,
  chiffresMax = 4,
  champ = 'quantite',
  ...communes
}: PropsPaveEntier) {
  const lire = lecteurPieces(contexte, champ);
  const lisible = (t: string) => lecteurPieces('inventaire', champ)(t).ok;
  const { texte, valeurLue, changer } = useSaisiePave({
    valeur: quantite,
    versTexte: texteDepuisPieces,
    lire,
    onChange,
    onResultat,
  });

  return (
    <CadrePave
      {...communes}
      libelleAccessible={`${communes.libelle}, en ${libelleUnite}`}
      texte={texte}
      suffixe={<span className="text-xl font-medium text-ink-2">{libelleUnite}</span>}
      jeu="entier"
      onTexte={changer}
      onTouche={(t) => changer(appliquerTouche(texte, t, { virgule: false, chiffresEntiersMax: chiffresMax, lisible }))}
      onValider={onValider ? () => valeurLue !== null && onValider(valeurLue) : undefined}
      valeurValide={valeurLue !== null}
    />
  );
}
