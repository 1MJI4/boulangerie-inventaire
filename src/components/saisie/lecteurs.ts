// src/components/saisie/lecteurs.ts
//
// Branchement des pavés sur le DOMAINE. Aucune règle ici : on choisit quelle
// fonction de `src/domaine/` lit le texte tapé, et on recompose le texte
// d'affichage à partir des formateurs du domaine.
//
//   poids   → lirePoids   (+ validerQuantite('kg') en commande)
//   pièces  → lirePieces  (+ validerQuantite('piece') en commande)
//   montant → lireMontant
//   tél.    → validerTelephone
//
// Imports relatifs avec extension : ce module est exécuté tel quel par
// `node --test`.

import type { Resultat } from '../../domaine/resultat.ts';
import { formaterQuantite, lirePieces, lirePoids, validerQuantite } from '../../domaine/unites.ts';
import { formaterEuros, lireMontant } from '../../domaine/argent.ts';
import { validerTelephone } from '../../domaine/coherence.ts';

/**
 * Contexte de saisie d'une quantité :
 *  - 'inventaire' : zéro accepté (un rayon vide se compte 0) — lecture seule ;
 *  - 'commande'   : la quantité passe en plus par `validerQuantite` (> 0).
 */
export type ContexteQuantite = 'inventaire' | 'commande';

export type Lecteur<T> = (texte: string) => Resultat<T>;

export function lecteurPoids(contexte: ContexteQuantite, champ = 'quantite'): Lecteur<number> {
  return (texte) => {
    const r = lirePoids(texte, champ);
    if (!r.ok || contexte === 'inventaire') return r;
    return validerQuantite('kg', r.donnees, champ);
  };
}

export function lecteurPieces(contexte: ContexteQuantite, champ = 'quantite'): Lecteur<number> {
  return (texte) => {
    const r = lirePieces(texte, champ);
    if (!r.ok || contexte === 'inventaire') return r;
    return validerQuantite('piece', r.donnees, champ);
  };
}

export function lecteurMontant(champ = 'montant'): Lecteur<number> {
  return (texte) => lireMontant(texte, champ);
}

export function lecteurTelephone(champ = 'telephone'): Lecteur<string> {
  return (texte) => validerTelephone(texte, champ);
}

// ---------------------------------------------------------------- affichage
// Valeur → texte remis dans l'afficheur du pavé (sans l'unité, affichée à
// part en gros). Dérivé des formateurs du domaine, relisible par le lecteur.

/** 1250 g → « 1,250 » (via `formaterQuantite`). */
export function texteDepuisGrammes(grammes: number): string {
  return formaterQuantite('kg', grammes).replace(/\s*kg$/, '');
}

/** 12 → « 12 » (via `formaterQuantite`). */
export function texteDepuisPieces(quantite: number): string {
  return formaterQuantite('piece', quantite);
}

/** 123450 c → « 1234,50 » (via `formaterEuros`, sans espaces ni « € » : relisible tel quel). */
export function texteDepuisCentimes(centimes: number): string {
  return formaterEuros(centimes).replace(/\s/g, '').replace(/€$/, '');
}
