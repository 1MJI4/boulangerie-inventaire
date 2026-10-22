'use client';

// src/components/saisie/PaveMontant.tsx
//
// Saisie d'un MONTANT en euros au pavé (acompte, prix par personne…), jamais
// au clavier du système. Pavé avec virgule ; « € » affiché en gros.
//
// Texte → centimes ENTIERS par le domaine (`lireMontant`, LOI 1) ; affichage
// par `formaterEuros`. Aucun plancher ni plafond ici : l'écran les vérifie
// via le domaine (`validerAcompte`, plancher du régime C…) et affiche le
// refus avec sa sortie (`Signalement`).

import type { Resultat } from '@/domaine/resultat';
import { formaterEuros } from '@/domaine/argent';
import { CadrePave, type PropsCommunesPave } from './CadrePave';
import { appliquerTouche } from './mecanique';
import { lecteurMontant, texteDepuisCentimes } from './lecteurs';
import { useSaisiePave } from './useSaisiePave';

export type PropsPaveMontant = PropsCommunesPave & {
  /** Montant en centimes entiers, ou null si rien de saisi. */
  centimes: number | null;
  /** À chaque touche : centimes lus par le domaine, null si vide ou refusé. */
  onChange: (centimes: number | null) => void;
  /** À chaque touche : verdict de `lireMontant` (null = champ vide). */
  onResultat?: (resultat: Resultat<number> | null) => void;
  onValider?: (centimes: number) => void;
  /** Précision sous le libellé (« par personne », « versé à la commande »). */
  sousTitre?: string;
  /** Garde-fou de frappe sur les euros (défaut 5 chiffres). */
  chiffresMax?: number;
  /** Nom du champ, repris dans le message du domaine (défaut « montant »). */
  champ?: string;
};

export function PaveMontant({
  centimes,
  onChange,
  onResultat,
  onValider,
  sousTitre,
  chiffresMax = 5,
  champ = 'montant',
  ...communes
}: PropsPaveMontant) {
  const lire = lecteurMontant(champ);
  const lisible = (t: string) => lire(t).ok;
  const { texte, texteDeFrappe, aRemplacer, valeurLue, changer } = useSaisiePave({
    valeur: centimes,
    versTexte: texteDepuisCentimes,
    lire,
    onChange,
    onResultat,
  });

  return (
    <CadrePave
      {...communes}
      sousTitre={sousTitre}
      libelleAccessible={`${communes.libelle}, en euros`}
      texte={texte}
      aRemplacer={aRemplacer}
      suffixe={<span className="text-3xl font-bold text-ink">€</span>}
      aide={valeurLue !== null ? `= ${formaterEuros(valeurLue)}` : ''}
      jeu="decimal"
      onTexte={changer}
      onTouche={(t) => changer(appliquerTouche(texteDeFrappe, t, { virgule: true, chiffresEntiersMax: chiffresMax, lisible }))}
      onValider={onValider ? () => valeurLue !== null && onValider(valeurLue) : undefined}
      valeurValide={valeurLue !== null}
    />
  );
}
