// src/domaine/formes.ts
//
// R63 — forme d'un gâteau simple sur commande : carré ou rond (propriétaire,
// 26/10/2026). Propriétaire : agent `regles-metier`.
//
// Quels gâteaux, et jusqu'à combien de parts le rond est possible : DONNÉES
// (ReglesForme, défaut REGLES_FORME de constantes.ts), jamais déduites du nom.
//   - 4 à 8 parts : carré OU rond, au choix du client (forme obligatoire) ;
//   - au-dessus de 8 parts : carré d'office ; un client qui veut un rond plus
//     grand passe en Layer Cake (avec SON minimum, LOI 7).

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { libelleRemplacement, signaler } from './messages.ts';
import type { ReglesForme } from './constantes.ts';
import type { FicheTarifee, Forme, SortieRemplacement } from './types.ts';
import { libelleProduitFiche } from './libelles.ts';

/** Les formes connues, dans l'ordre des boutons. */
export const FORMES: readonly Forme[] = ['carre', 'rond'];

export function estForme(v: unknown): v is Forme {
  return typeof v === 'string' && (FORMES as readonly string[]).includes(v);
}

/** Seuil lu dans la donnée ; illisible → 0 : jamais de rond (refuser plutôt qu'accepter à tort). */
function partsMaxRond(regles: ReglesForme): number {
  return Number.isSafeInteger(regles.partsMaxRond) && regles.partsMaxRond >= 0 ? regles.partsMaxRond : 0;
}

/** Ce gâteau (clé catalogue) demande-t-il une forme ? */
export function formeDemandee(cleGateau: string | null | undefined, regles: ReglesForme): boolean {
  return !!cleGateau && regles.produits.includes(cleGateau);
}

/**
 * Formes proposées à l'écran pour ce gâteau à ce nombre de parts :
 * [] (non concerné) · ['carre', 'rond'] (jusqu'au seuil) · ['carre'] (au-dessus).
 */
export function formesPossibles(cleGateau: string | null | undefined, parts: number, regles: ReglesForme): Forme[] {
  if (!formeDemandee(cleGateau, regles)) return [];
  return parts > partsMaxRond(regles) ? ['carre'] : [...FORMES];
}

/** Valeur portée par ERR_FORME_ROND_IMPOSSIBLE : les deux sorties en un geste. */
export type SortiesRondImpossible = {
  /** « Passer en carré » : la ligne garde son gâteau et ses parts, forme = carré. */
  forme: 'carre';
  /** « Passer en Layer Cake (20 parts) » : vide si le Layer Cake n'a pas de tarif à cette date. */
  remplacements: SortieRemplacement[];
};

/**
 * Règle R63 : un gâteau simple sur commande (liste réglable) porte sa forme.
 * Niveau : BLOQUANT, à la saisie de la ligne, après le goût (R62).
 *  - forme absente, jusqu'au seuil → ERR_FORME_MANQUANTE, `valeurProposee` =
 *    les formes possibles (deux boutons « Carré » / « Rond ») ;
 *  - forme absente, au-dessus du seuil → ACCEPTÉ, carré d'office (seule forme
 *    possible : rien à demander) ;
 *  - rond au-dessus du seuil → ERR_FORME_ROND_IMPOSSIBLE, sorties « Passer en
 *    carré » et « Passer en Layer Cake (max(parts, minimum du Layer) parts) » ;
 *  - forme inconnue (donnée altérée, synchro) → ERR_SAISIE_INVALIDE.
 * `parts` : parts du gâteau (pour une ligne devenue gâteau du comptoir, R60 :
 * les parts de la correspondance, pas la quantité 1).
 * `gateauRondGrand` : fiche du gâteau proposé pour un grand rond à la date de la
 * commande (Layer Cake), ou null s'il n'est pas disponible.
 * N'interdit pas : un carré à toute taille ; un rond de 4 à 8 parts ; une forme
 * sur un gâteau non concerné (ignorée : non imprimée, non enregistrée).
 */
export function validerForme(
  cleGateau: string | null | undefined,
  libelleGateau: string,
  parts: number,
  forme: unknown,
  regles: ReglesForme,
  gateauRondGrand: FicheTarifee | null,
): Resultat<Forme | null> {
  if (!formeDemandee(cleGateau, regles)) return succes(null);
  const max = partsMaxRond(regles);
  const possibles = formesPossibles(cleGateau, parts, regles);
  const vide = forme === null || forme === undefined || (typeof forme === 'string' && forme.trim() === '');
  if (vide) {
    if (parts > max) return succes('carre');
    return signaler('ERR_FORME_MANQUANTE', { produit: libelleGateau }, { champ: 'forme', valeurProposee: possibles });
  }
  if (!estForme(forme)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'forme du gâteau' }, { champ: 'forme', valeurProposee: possibles });
  }
  if (forme === 'rond' && parts > max) {
    const remplacements: SortieRemplacement[] = [];
    let gateauRond: string | undefined;
    let partsRond: number | undefined;
    if (gateauRondGrand) {
      gateauRond = libelleProduitFiche(gateauRondGrand);
      const min = gateauRondGrand.prix.minQuantite;
      partsRond = Math.max(parts, typeof min === 'number' && Number.isSafeInteger(min) ? min : 0);
      remplacements.push({
        produitId: gateauRondGrand.produit.id,
        libelle: gateauRond,
        quantite: partsRond,
        bouton: libelleRemplacement('passer', gateauRond, partsRond),
      });
    }
    const valeur: SortiesRondImpossible = { forme: 'carre', remplacements };
    const params = gateauRond !== undefined && partsRond !== undefined
      ? { produit: libelleGateau, parts, partsMaxRond: max, gateauRond, partsRond }
      : { produit: libelleGateau, parts, partsMaxRond: max };
    return signaler('ERR_FORME_ROND_IMPOSSIBLE', params, { champ: 'forme', valeurProposee: valeur });
  }
  return succes(forme);
}
