// src/domaine/supplementsParPersonne.ts
//
// R64 — supplément vendu PAR PERSONNE du gâteau auquel il s'ajoute (Pâte à
// sucre, propriétaire 26/10/2026 : prix par part, lu au catalogue).
// Propriétaire : agent `regles-metier`.
//
// Contrairement à R7 (Photo, Écriture : une fois par gâteau, au forfait), ce
// supplément se compte par PART : sa ligne porte autant de parts que le gâteau.
// Le prix vient du catalogue (basePrix « personne », famille « supplement »,
// prix fixe) et le total de la ligne est `parts × prix` comme toute ligne.
//
// Ce module ne contrôle que le RATTACHEMENT : quels gâteaux peuvent le recevoir
// et à partir de combien de parts = DONNÉES (RegleSupplementParPersonne, défaut
// SUPPLEMENTS_PAR_PERSONNE de constantes.ts). Aucun lien explicite n'est stocké
// entre la ligne du supplément et celle du gâteau : il se retrouve par les
// parts (un gâteau reçoit au plus un supplément de chaque sorte), donc sans
// nouvelle colonne en base, et rejouable tel quel à la synchronisation.

import type { Echec } from './resultat.ts';
import { signaler } from './messages.ts';
import type { RegleSupplementParPersonne, ReglesForme } from './constantes.ts';
import { FAMILLE_SUPPLEMENT } from './constantes.ts';
import type { BasePrix, Forme } from './types.ts';

/** Un supplément par personne se lit dans les DONNÉES du produit, jamais dans son nom. */
export function estSupplementParPersonne(p: { famille: string | null; basePrix: BasePrix | null }): boolean {
  return p.famille === FAMILLE_SUPPLEMENT && p.basePrix === 'personne';
}

export type RepereLignePP = {
  produitId: string | null;
  libelle: string;
  /** Parts (gâteau par personne) ou parts du supplément. */
  quantite: number;
  /** Forme du gâteau (R63), null si non concerné. */
  forme: Forme | null;
  /** Gâteaux apportés par la ligne (R7) : distingue « aucun gâteau » de « gâteau non admis ». */
  nbGateaux: number;
  supplementParPersonne: boolean;
};

/** Ce gâteau peut-il recevoir ce supplément ? Un gâteau « à forme » doit être carré. */
function admis(l: RepereLignePP, regle: RegleSupplementParPersonne, formes: ReglesForme): boolean {
  if (l.supplementParPersonne || !l.produitId || !regle.gateaux.includes(l.produitId)) return false;
  return !formes.produits.includes(l.produitId) || l.forme === 'carre';
}

/**
 * Règle R64 : chaque supplément par personne s'ajoute à UN gâteau admis de la
 * commande, d'au moins `partsMin` parts, et en porte exactement les parts.
 * Niveau : BLOQUANT (LOI 7 pour le minimum ; un autre nombre de parts = un prix
 * faux, LOI 1). Sorties en un geste :
 *  - aucun gâteau du tout → ERR_SUPPLEMENT_SANS_GATEAU, « Supprimer la ligne »
 *    (`valeurProposee` = index de la ligne, comme R7) ;
 *  - des gâteaux, mais aucun admis (Number Cake, pièce montée, rond…) →
 *    ERR_SUPPLEMENT_NON_ADMIS, « Supprimer la ligne » ;
 *  - gâteau admis sous le minimum → ERR_QUANTITE_MIN sur la ligne DU GÂTEAU
 *    (`lignes[g].quantite`, `valeurProposee` = partsMin : « Passer à 20 parts ») ;
 *  - parts du supplément ≠ parts du gâteau → ERR_SUPPLEMENT_PARTS sur la ligne
 *    du supplément, `valeurProposee` = parts du gâteau ;
 *  - plus de suppléments que de gâteaux admis → ERR_SUPPLEMENT_TROP_NOMBREUX
 *    { max }, `valeurProposee` = 0 (l'écran retire la ligne, comme R7).
 * Appariement : d'abord les correspondances exactes (mêmes parts, ≥ minimum),
 * puis chaque supplément restant est comparé au premier gâteau admis libre
 * (de préférence celui qui a les mêmes parts).
 * `libelleDe(cle)` : libellé à la lettre d'un gâteau admis, pour le message.
 * N'interdit pas : Pâte à sucre ET Photo / Écriture sur le même gâteau (rien ne
 * l'interdit, QUESTIONS-GERANT n°68) ; deux gâteaux de 20 parts, deux lignes de
 * Pâte à sucre de 20 ; un Layer Cake de 37 parts avec 37 parts de Pâte à sucre.
 */
export function controlerSupplementsParPersonne(
  lignes: readonly RepereLignePP[],
  regles: Readonly<Record<string, RegleSupplementParPersonne>>,
  formes: ReglesForme,
  libelleDe: (cle: string) => string,
): Echec[] {
  const supps = lignes.flatMap((l, i) => (l.supplementParPersonne ? [i] : []));
  if (supps.length === 0) return [];
  const blocages: Echec[] = [];
  const pris = new Set<number>();
  const apparie = new Set<number>();
  const regleDe = (i: number) => regles[lignes[i].produitId ?? ''] ?? null;
  const minDe = (r: RegleSupplementParPersonne) =>
    Number.isSafeInteger(r.partsMin) && r.partsMin > 0 ? r.partsMin : 0;

  // 1. Correspondances exactes.
  for (const s of supps) {
    const r = regleDe(s);
    if (!r) continue;
    const g = lignes.findIndex(
      (l, i) => !pris.has(i) && admis(l, r, formes) && l.quantite === lignes[s].quantite && l.quantite >= minDe(r),
    );
    if (g >= 0) {
      pris.add(g);
      apparie.add(s);
    }
  }

  // 2. Le reste : dire quoi corriger.
  const aDesGateaux = lignes.some((l) => !l.supplementParPersonne && l.nbGateaux > 0);
  for (const s of supps) {
    if (apparie.has(s)) continue;
    const sup = lignes[s];
    const r = regleDe(s);
    const admisIdx = r ? lignes.flatMap((l, i) => (admis(l, r, formes) ? [i] : [])) : [];
    if (!r || admisIdx.length === 0) {
      if (!r || !aDesGateaux) {
        blocages.push(signaler('ERR_SUPPLEMENT_SANS_GATEAU', { produit: sup.libelle }, { champ: `lignes[${s}].produitId`, valeurProposee: s }));
      } else {
        // Le minimum est cité : un Bavarois 6 parts devenu gâteau du comptoir
        // (R60) n'est pas admis, et le vendeur doit comprendre pourquoi.
        const noms = r.gateaux.map(libelleDe).join(', ') + (minDe(r) > 0 ? ` (${minDe(r)} parts au moins)` : '');
        blocages.push(signaler('ERR_SUPPLEMENT_NON_ADMIS', { produit: sup.libelle, gateaux: noms }, { champ: `lignes[${s}].produitId`, valeurProposee: s }));
      }
      continue;
    }
    const libres = admisIdx.filter((i) => !pris.has(i));
    if (libres.length === 0) {
      blocages.push(
        signaler('ERR_SUPPLEMENT_TROP_NOMBREUX', { max: admisIdx.length, produit: sup.libelle }, { champ: `lignes[${s}].quantite`, valeurProposee: 0 }),
      );
      continue;
    }
    const g = libres.find((i) => lignes[i].quantite === sup.quantite) ?? libres[0];
    pris.add(g);
    const gateau = lignes[g];
    const min = minDe(r);
    if (gateau.quantite < min) {
      blocages.push(
        signaler(
          'ERR_QUANTITE_MIN',
          { produit: gateau.libelle, minimum: min, unite: 'parts', precision: `avec « ${sup.libelle} »` },
          { champ: `lignes[${g}].quantite`, valeurProposee: min },
        ),
      );
    } else {
      blocages.push(
        signaler(
          'ERR_SUPPLEMENT_PARTS',
          { produit: sup.libelle, gateau: gateau.libelle, parts: gateau.quantite },
          { champ: `lignes[${s}].quantite`, valeurProposee: gateau.quantite },
        ),
      );
    }
  }
  return blocages;
}
