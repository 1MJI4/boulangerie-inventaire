// src/components/saisie/useSaisiePave.ts
//
// État commun des pavés : le TEXTE brut tapé (« 1, » n'a pas d'équivalent
// numérique) et la valeur que le DOMAINE en lit. Le composant ne convertit
// jamais lui-même : `lire` est une fonction du domaine (`lirePoids`,
// `lirePieces`, `lireMontant`, `validerTelephone`…), éventuellement composée
// avec `validerQuantite`.

import { useState } from 'react';
import type { Resultat } from '@/domaine/resultat';
import { texteALire } from './mecanique';

export type ParametresSaisiePave<T> = {
  /** Valeur contrôlée par le parent (null = rien de saisi). */
  valeur: T | null;
  /** Valeur → texte affiché au départ ou après une correction externe (affichage seul). */
  versTexte: (valeur: T) => string;
  /** Verdict du domaine sur le texte (sans la virgule finale de frappe). */
  lire: (texte: string) => Resultat<T>;
  onChange: (valeur: T | null) => void;
  onResultat?: (resultat: Resultat<T> | null) => void;
};

export function useSaisiePave<T>({ valeur, versTexte, lire, onChange, onResultat }: ParametresSaisiePave<T>) {
  const [texte, setTexte] = useState(() => (valeur === null ? '' : versTexte(valeur)));
  const [valeurConnue, setValeurConnue] = useState(valeur);

  /** null = champ vide : rien à signaler pendant la frappe. */
  const resultat: Resultat<T> | null = texte === '' ? null : lire(texteALire(texte));
  const valeurLue: T | null = resultat?.ok ? resultat.donnees : null;

  // Valeur changée de l'extérieur (bouton de correction, ligne suivante) :
  // on resynchronise pendant le rendu (motif recommandé par React).
  if (valeur !== valeurConnue) {
    setValeurConnue(valeur);
    if (valeurLue !== valeur) setTexte(valeur === null ? '' : versTexte(valeur));
  }

  function changer(suivant: string) {
    if (suivant === texte) return;
    const r = suivant === '' ? null : lire(texteALire(suivant));
    const v = r?.ok ? r.donnees : null;
    setTexte(suivant);
    setValeurConnue(v);
    onChange(v);
    onResultat?.(r);
  }

  return { texte, resultat, valeurLue, changer };
}
