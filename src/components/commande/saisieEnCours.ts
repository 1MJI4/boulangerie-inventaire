// src/components/commande/saisieEnCours.ts
//
// Écran de commande (propriétaire : `commandes-traiteur`) — deux aides d'affichage
// issues de l'audit du 28/10/2026, sans aucune règle métier :
//  - le total à annoncer quand une ligne n'est pas encore complète (le montant
//    vient du domaine, `totalEnCours` ; ici, seulement le texte) ;
//  - « Annuler » : la saisie contient-elle quelque chose à perdre ?
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import { formaterEuros } from '../../domaine/argent.ts';
import type { LigneEcran } from './modele.ts';

/** Ce qui suit un montant incomplet (« <montant> + à compléter »). */
export const A_COMPLETER = 'à compléter';

/**
 * Texte d'un montant pendant la saisie. Jamais un total partiel présenté comme
 * définitif : incomplet → « + à compléter » ; rien de chiffrable → pas de
 * montant du tout (jamais « 0,00 € » annoncé au client), seulement « à compléter ».
 */
export function texteMontantEnCours(centimes: number, complet: boolean): { montant: string | null; suite: string | null } {
  if (complet) return { montant: formaterEuros(centimes), suite: null };
  if (centimes > 0) return { montant: formaterEuros(centimes), suite: `+ ${A_COMPLETER}` };
  return { montant: null, suite: A_COMPLETER };
}

/** « reste <montant> », « reste <montant> + à compléter », « reste à compléter ». */
export function texteResteEnCours(resteCentimes: number, totalCentimes: number, complet: boolean): string {
  if (complet) return `reste ${formaterEuros(resteCentimes)}`;
  if (totalCentimes > 0) return `reste ${formaterEuros(resteCentimes)} + ${A_COMPLETER}`;
  return `reste ${A_COMPLETER}`;
}

/** Ce qu'« Annuler » ferait perdre. */
export type SaisieAPerdre = {
  client: string;
  telephone: string;
  lignes: readonly unknown[];
  remarques: string;
};

/** Nouvelle commande : y a-t-il quelque chose à perdre (client, téléphone, une ligne, une remarque) ? */
export function saisieEntamee(s: SaisieAPerdre): boolean {
  return s.client.trim() !== '' || s.telephone.trim() !== '' || s.lignes.length > 0 || s.remarques.trim() !== '';
}

/**
 * Empreinte d'une saisie, pour savoir si une commande en MODIFICATION a changé
 * (sans les clés locales des lignes, régénérées à chaque ouverture).
 */
export function empreinteSaisie(e: Record<string, unknown> & { lignes: readonly LigneEcran[] }): string {
  const { lignes, ...reste } = e;
  return JSON.stringify({
    ...reste,
    lignes: lignes.map((l) => Object.fromEntries(Object.entries(l).filter(([k]) => k !== 'cle'))),
  });
}
