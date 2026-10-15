'use client';

// src/components/saisie/PaveTelephone.tsx
//
// Saisie du téléphone du client au pavé : chiffres, espace, « + » en tête.
// Jamais le clavier du système. Le domaine (`validerTelephone`) dit si le
// numéro est présent (bloquant) et plausible (avertissement) : ce composant
// transmet son verdict par `onResultat`, il ne juge pas.

import type { Resultat } from '@/domaine/resultat';
import { CadrePave, type PropsCommunesPave } from './CadrePave';
import { appliquerToucheTelephone } from './mecanique';
import { lecteurTelephone } from './lecteurs';
import { useSaisiePave } from './useSaisiePave';

export type PropsPaveTelephone = PropsCommunesPave & {
  /** Numéro tel que tapé ('' = vide). */
  telephone: string;
  /** À chaque touche : numéro retenu par le domaine ('' si vide). */
  onChange: (telephone: string) => void;
  /** À chaque touche : verdict de `validerTelephone` (null = champ vide ; le bloquant « obligatoire » vient au Valider de l'écran). */
  onResultat?: (resultat: Resultat<string> | null) => void;
  onValider?: (telephone: string) => void;
  /** Nom du champ dans les signalements (défaut « telephone »). */
  champ?: string;
};

const identite = (t: string) => t;

export function PaveTelephone({
  telephone,
  onChange,
  onResultat,
  onValider,
  champ = 'telephone',
  ...communes
}: PropsPaveTelephone) {
  const { texte, valeurLue, changer } = useSaisiePave({
    valeur: telephone === '' ? null : telephone,
    versTexte: identite,
    lire: lecteurTelephone(champ),
    onChange: (v) => onChange(v ?? ''),
    onResultat,
  });

  return (
    <CadrePave
      {...communes}
      libelleAccessible={`${communes.libelle}, numéro de téléphone`}
      texte={texte}
      jeu="telephone"
      onTexte={changer}
      onTouche={(t) => changer(appliquerToucheTelephone(texte, t))}
      onValider={onValider ? () => valeurLue !== null && onValider(valeurLue) : undefined}
      valeurValide={valeurLue !== null}
    />
  );
}
