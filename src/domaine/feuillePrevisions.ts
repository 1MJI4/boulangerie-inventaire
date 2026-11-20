// src/domaine/feuillePrevisions.ts
//
// La feuille de prévisions imprimée (propriétaire, 20/11/2026) : ce que le
// manager a demandé au poste, à cocher au crayon. Une ligne sur deux est un
// aplat noir à texte blanc, l'autre blanche à texte noir : l'œil suit la
// ligne d'un bout à l'autre du ticket, et la case à cocher se repère tout de
// suite. Pur : aucun accès canvas, base ni navigateur — le même contenu sert
// au ticket Star (feuilleCanvas.ts) et à l'impression de secours (page).
//
// Les quantités reprennent celles de l'écran du fournil, à l'identique :
// plateaux pour le croissant et la couque au chocolat (LOI 2), part commandée
// en pièces, produits dérivés (R72). Aucun prix ici (LOI 1).

import { enPlateaux, formaterPlateaux, sePlanifieEnPlateaux } from './plateaux.ts';
import { totalAProduire } from './commandesFournil.ts';

/** Une ligne telle que l'écran du fournil la lit en base. */
export type LignePrevision = {
  nom: string;
  quantitePrevue: number | null;
  /** « + » saisi par le manager (déjà compris dans `quantitePrevue`). */
  quantiteCommande: number | null;
  /** Pièces commandées dans l'application (dérivés compris). */
  commandeAuto: number | null;
  /** Pièces à sortir en plus (plateaux entiers partagés entre sortes). */
  plateauCommandes: number | null;
  piecesParPlateau: number | null;
  /** « dont 7 Croissant à la pâte d'amande » ; vide s'il n'y en a pas. */
  derives: string;
};

export type LigneFeuille = {
  nom: string;
  /** Le gros chiffre à droite : « 24 » ou « 3 plateaux ». */
  quantite: string;
  /** Sous le nom : d'où vient le chiffre (« = 48 pièces », « dont 5 commandés »). */
  precision: string | null;
  /** Ligne noire à texte blanc (une sur deux, la première de chaque rayon est blanche). */
  inverse: boolean;
};

export type SectionFeuille = { titre: string; lignes: LigneFeuille[] };

export type FeuillePrevisions = {
  titre: string;
  sousTitre: string;
  sections: SectionFeuille[];
  references: number;
  totalPieces: number;
};

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/** Le gros chiffre et sa précision, comme à l'écran. */
export function quantiteDeLigne(l: LignePrevision): { quantite: string; precision: string | null; pieces: number } {
  const commandeManuelle = l.quantiteCommande ?? 0;
  const commandeTotale = commandeManuelle + (l.commandeAuto ?? 0);
  const pieces = totalAProduire(l.quantitePrevue, l.plateauCommandes);

  if (sePlanifieEnPlateaux(l.piecesParPlateau)) {
    const base = Math.max(0, (l.quantitePrevue ?? 0) - commandeManuelle);
    const { plateaux, reste } = enPlateaux(base, l.piecesParPlateau);
    const morceaux = [`${reste > 0 ? `${formaterPlateaux(base, l.piecesParPlateau)} · ` : ''}= ${base} pièces`];
    if (commandeTotale > 0) morceaux.push(`+ ${commandeTotale} ${pluriel(commandeTotale, 'pièce commandée', 'pièces commandées')}`);
    if (l.derives) morceaux.push(l.derives);
    return {
      quantite: `${plateaux} ${pluriel(plateaux, 'plateau', 'plateaux')}`,
      precision: morceaux.join(' · '),
      pieces,
    };
  }

  const morceaux: string[] = [];
  if (commandeTotale > 0) morceaux.push(`dont ${commandeTotale} ${pluriel(commandeTotale, 'commandé', 'commandés')}`);
  if (l.derives) morceaux.push(l.derives);
  return { quantite: String(pieces), precision: morceaux.length > 0 ? morceaux.join(' · ') : null, pieces };
}

export function construireFeuille(entree: {
  /** « Feuille pâtissier ». */
  titre: string;
  /** « Samedi 21 novembre 2026 ». */
  dateLongue: string;
  sections: readonly { titre: string; lignes: readonly LignePrevision[] }[];
}): FeuillePrevisions {
  let totalPieces = 0;
  let references = 0;
  const sections = entree.sections
    .filter((s) => s.lignes.length > 0)
    .map((s) => ({
      titre: s.titre,
      lignes: s.lignes.map((l, i) => {
        const q = quantiteDeLigne(l);
        totalPieces += q.pieces;
        references += 1;
        return { nom: l.nom, quantite: q.quantite, precision: q.precision, inverse: i % 2 === 1 };
      }),
    }));
  return {
    titre: entree.titre,
    sousTitre: `À produire pour le ${entree.dateLongue}`,
    sections,
    references,
    totalPieces,
  };
}
