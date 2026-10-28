// src/domaine/supplements.ts
//
// R7 — Suppléments au forfait (Photo, Écriture… : `basePrix = 'forfait'` au
// catalogue) : « une fois par gâteau, jamais par personne » (affiche).
// Propriétaire : agent `regles-metier`.
//
// « Gâteau » est défini par les DONNÉES du produit, jamais par son nom :
//   - régime C vendu par personne (Layer Cake, mariage, Number Cake…) : la
//     ligne est UN gâteau, quel que soit le nombre de parts ;
//   - régime C vendu à la pièce (minis) : la ligne (le plateau) est UN gâteau ;
//   - régime A à la pièce, d'une famille « gâteau » (FAMILLES_GATEAU) : la
//     ligne est UN gâteau. « 2 Bavarois comptent pour 2 gâteaux différents,
//     avec leurs propres caractéristiques » (propriétaire, 28/10/2026, Q89) :
//     deux Bavarois 6P = DEUX lignes ; une ligne à quantité > 1 est refusée
//     (`controlerUnGateauParLigne`, unGateauParLigne.ts) ;
//   - tout le reste (kilo, traiteur B, viennoiserie, supplément — y compris
//     par personne, famille « supplement » —, ligne libre) : 0.
// HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°60) : plateau de minis = un gâteau ;
// pâtisserie individuelle du comptoir (éclair…) = un gâteau par pièce.

import type { Echec } from './resultat.ts';
import { signaler } from './messages.ts';
import { FAMILLE_SUPPLEMENT } from './constantes.ts';
import type { BasePrix, RegimePrix } from './types.ts';

export type RepereGateau = {
  regimePrix: RegimePrix | null;
  basePrix: BasePrix | null;
  quantite: number;
  /** `Produit.famille` du catalogue ; null = ligne libre. */
  famille: string | null;
};

/**
 * true : produit du comptoir (régime A, à la pièce) d'une famille « gâteau » —
 * un gâteau entier, une ligne par gâteau (28/10/2026). Données, jamais le nom.
 */
export function estGateauDuComptoir(
  l: Pick<RepereGateau, 'regimePrix' | 'basePrix' | 'famille'>,
  famillesGateau: readonly string[],
): boolean {
  return l.regimePrix === 'A' && l.basePrix === 'piece' && l.famille !== null && famillesGateau.includes(l.famille);
}

/** Nombre de gâteaux qu'apporte une ligne (cf. définition en tête de fichier) : 0 ou 1. */
export function gateauxDeLigne(l: RepereGateau, famillesGateau: readonly string[]): number {
  if (l.basePrix === 'forfait' || l.basePrix === 'kg' || l.basePrix === null) return 0;
  // Un supplément n'est jamais un gâteau, même vendu par personne (Pâte à sucre,
  // R64, 26/10/2026) : la famille du catalogue le dit, avant le régime.
  if (l.famille === FAMILLE_SUPPLEMENT) return 0;
  // Gâteau sur commande vendu par personne. Les minis (régime C à la pièce :
  // tartelettes, éclairs…) ne sont pas des gâteaux : ni écriture ni photo (22/10/2026).
  if (l.regimePrix === 'C') return l.basePrix === 'personne' ? 1 : 0;
  // Une ligne = un gâteau, même une ligne ancienne « 2 × Bavarois 6P » (refusée
  // avec la sortie « Séparer en 2 gâteaux ») : ses suppléments ne doublent pas.
  if (estGateauDuComptoir(l, famillesGateau)) {
    return Number.isSafeInteger(l.quantite) && l.quantite > 0 ? 1 : 0;
  }
  return 0;
}

export type RepereSupplement = {
  produitId: string | null;
  basePrix: BasePrix | null;
  quantite: number;
  /** Gâteaux apportés par la ligne (`gateauxDeLigne`). */
  nbGateaux: number;
};

/**
 * Règle R7 : un supplément au forfait se compte au plus une fois par gâteau de
 * la commande, et n'existe pas sans gâteau.
 * Niveau : BLOQUANT (un supplément de trop = un prix faux, LOI 1 ; « 40 photos »
 * pour un Layer Cake de 40 parts est l'erreur à empêcher).
 *  - aucun gâteau → ERR_SUPPLEMENT_SANS_GATEAU, sortie : supprimer la ligne
 *    (`valeurProposee` = index de la ligne, comme ERR_LIGNE_SANS_PRODUIT) ;
 *  - quantité cumulée d'un même supplément > nombre de gâteaux →
 *    ERR_SUPPLEMENT_TROP_NOMBREUX { max }, `valeurProposee` = quantité à
 *    mettre sur la ligne fautive pour atteindre exactement le maximum.
 * Champ : `lignes[i].quantite` (ou `.produitId` sans gâteau).
 * N'interdit pas : Photo ET Écriture sur le même gâteau (suppléments
 * différents) ; deux gâteaux, deux photos ; un gâteau sans supplément.
 */
export function controlerSupplements(lignes: readonly RepereSupplement[]): Echec[] {
  const max = lignes.reduce((n, l) => n + (l.basePrix === 'forfait' ? 0 : l.nbGateaux), 0);
  const blocages: Echec[] = [];
  const dejaCompte = new Map<string, number>();
  lignes.forEach((l, i) => {
    if (l.basePrix !== 'forfait') return;
    if (max === 0) {
      blocages.push(signaler('ERR_SUPPLEMENT_SANS_GATEAU', {}, { champ: `lignes[${i}].produitId`, valeurProposee: i }));
      return;
    }
    const cle = l.produitId ?? `#${i}`;
    const avant = dejaCompte.get(cle) ?? 0;
    dejaCompte.set(cle, avant + l.quantite);
    if (avant + l.quantite > max) {
      blocages.push(
        signaler('ERR_SUPPLEMENT_TROP_NOMBREUX', { max }, {
          champ: `lignes[${i}].quantite`,
          valeurProposee: Math.max(0, max - avant),
        }),
      );
    }
  });
  return blocages;
}

// ---------------------------------------------------------------------------
// Écriture et photo à imprimer : une par GÂTEAU (lot 2, propriétaire, 28/10/2026)
// ---------------------------------------------------------------------------
// « Une écriture par gâteau sur le bon, ça doit être clair quelle écriture
// pour quel gâteau. » L'écriture et la photo à imprimer sont des données de la
// LIGNE du gâteau ; le supplément au forfait correspondant (Écriture, Photo)
// est dû une fois par gâteau qui les porte — ni moins (une écriture se facture
// toujours), ni plus (un supplément sans écriture laisse le pâtissier sans
// texte), et jamais plus que le nombre de gâteaux (`controlerSupplements`).
// Une ligne = un gâteau (propriétaire, 28/10/2026, QUESTIONS-GERANT n°89) :
// deux Bavarois 6P sont deux lignes, chacune son écriture et sa photo. Il n'y
// a plus de « même texte sur chaque gâteau de la ligne » : une ligne gâteau
// qui porte une écriture appelle UN supplément Écriture.

/** Ce qu'une ligne contrôlée porte « sur le gâteau ». */
export type RepereSurLeGateau = {
  produitId: string | null;
  quantite: number;
  /** Gâteaux apportés par la ligne (`gateauxDeLigne`) : 0 = rien ne s'écrit dessus, sinon UN gâteau. */
  nbGateaux: number;
  texteGateau?: string | null;
  sansEcriture?: boolean | null;
  photoImprimee?: boolean | null;
};

/** 1 si la ligne est un gâteau (une ligne = un gâteau, 28/10/2026), sinon 0. */
function unGateau(n: number): number {
  return Number.isSafeInteger(n) && n > 0 ? 1 : 0;
}

/** true : la ligne porte un texte à écrire (non vide, « Pas d'écriture » non coché). */
export function porteUneEcriture(l: Pick<RepereSurLeGateau, 'texteGateau' | 'sansEcriture'>): boolean {
  return l.sansEcriture !== true && (l.texteGateau ?? '').trim() !== '';
}

/** true : la ligne porte une photo à imprimer sur le gâteau. */
export function porteUnePhoto(l: Pick<RepereSurLeGateau, 'photoImprimee'>): boolean {
  return l.photoImprimee === true;
}

/** Suppléments « Écriture » dus : un par gâteau qui porte une écriture. */
export function ecrituresAttendues(lignes: readonly RepereSurLeGateau[]): number {
  return lignes.reduce((n, l) => n + (porteUneEcriture(l) ? unGateau(l.nbGateaux) : 0), 0);
}

/** Suppléments « Photo » dus : un par gâteau qui porte une photo à imprimer. */
export function photosAttendues(lignes: readonly RepereSurLeGateau[]): number {
  return lignes.reduce((n, l) => n + (porteUnePhoto(l) ? unGateau(l.nbGateaux) : 0), 0);
}

type SupplementAutomatique = {
  cle: string;
  libelle?: string;
  porte: (l: RepereSurLeGateau) => boolean;
  codeManque: 'ERR_ECRITURE_SANS_SUPPLEMENT' | 'ERR_PHOTO_SANS_SUPPLEMENT';
  champManque: 'texteGateau' | 'photoImprimee';
  objet: string;
};

function controlerSupplementAutomatique(lignes: readonly RepereSurLeGateau[], s: SupplementAutomatique): Echec[] {
  let attendus = 0;
  let gateaux = 0;
  let presents = 0;
  for (const l of lignes) {
    gateaux += unGateau(l.nbGateaux);
    if (s.porte(l)) attendus += unGateau(l.nbGateaux);
    if (l.produitId === s.cle) presents += Number.isSafeInteger(l.quantite) && l.quantite > 0 ? l.quantite : 0;
  }
  const produit = s.libelle ? { produit: s.libelle } : {};
  if (presents < attendus) {
    // Champ : le premier gâteau dont l'écriture (la photo) n'est pas couverte.
    let cumul = 0;
    let k = 0;
    for (const [i, l] of lignes.entries()) {
      if (!s.porte(l)) continue;
      cumul += unGateau(l.nbGateaux);
      k = i;
      if (cumul > presents) break;
    }
    return [signaler(s.codeManque, produit, { champ: `lignes[${k}].${s.champManque}`, valeurProposee: s.cle })];
  }
  // Au-delà du nombre de gâteaux : `controlerSupplements` le refuse déjà (un seul message).
  if (presents > attendus && presents <= gateaux) {
    let avant = 0;
    for (const [i, l] of lignes.entries()) {
      if (l.produitId !== s.cle) continue;
      const q = Number.isSafeInteger(l.quantite) && l.quantite > 0 ? l.quantite : 0;
      if (avant + q > attendus) {
        return [
          signaler('ERR_SUPPLEMENT_EN_TROP', { ...produit, attendus, objet: s.objet }, {
            champ: `lignes[${i}].quantite`,
            valeurProposee: Math.max(0, attendus - avant),
          }),
        ];
      }
      avant += q;
    }
  }
  return [];
}

/**
 * Règle (décision du propriétaire, 28/10/2026, lot 2 « une écriture par
 * gâteau ») : une écriture sur un gâteau se facture TOUJOURS, une fois par
 * gâteau qui porte une écriture. Quantité cumulée du supplément « Écriture »
 * (clé catalogue `supplementEcriture`, donnée) = `ecrituresAttendues`.
 * Niveau : BLOQUANT.
 *  - moins → ERR_ECRITURE_SANS_SUPPLEMENT, champ `lignes[i].texteGateau` (le
 *    premier gâteau dont l'écriture n'est pas couverte), `valeurProposee` = clé
 *    du supplément (sortie « Ajouter … » en un geste : l'écran met la quantité
 *    exacte) ;
 *  - plus (sans dépasser le nombre de gâteaux) → ERR_SUPPLEMENT_EN_TROP
 *    { attendus }, champ `lignes[j].quantite` de la ligne du supplément,
 *    `valeurProposee` = quantité à y mettre (0 : retirer la ligne).
 * N'interdit pas : un gâteau sans écriture ; un texte vide ou d'espaces ; « Pas
 * d'écriture » coché ; un texte sur une ligne qui n'est pas un gâteau (le
 * domaine ne le garde pas, `controlerLigne`).
 */
export function controlerSupplementEcriture(entree: {
  lignes: readonly RepereSurLeGateau[];
  supplementEcriture: string;
  /** Libellé du supplément au catalogue (LOI 5), pour le message. */
  libelleSupplement?: string;
}): Echec[] {
  return controlerSupplementAutomatique(entree.lignes, {
    cle: entree.supplementEcriture,
    libelle: entree.libelleSupplement,
    porte: porteUneEcriture,
    codeManque: 'ERR_ECRITURE_SANS_SUPPLEMENT',
    champManque: 'texteGateau',
    objet: 'une écriture',
  });
}

/**
 * Règle (même décision) : une photo à imprimer SUR un gâteau se facture une
 * fois par gâteau qui la porte : quantité cumulée du supplément « Photo »
 * (`supplementPhoto`, donnée) = `photosAttendues`. Niveau : BLOQUANT.
 *  - moins → ERR_PHOTO_SANS_SUPPLEMENT, champ `lignes[i].photoImprimee` ;
 *  - plus → ERR_SUPPLEMENT_EN_TROP, comme l'écriture.
 * N'interdit pas : un gâteau sans photo ; la photo d'exemple envoyée sur
 * WhatsApp (niveau commande, ce n'est pas un supplément).
 */
export function controlerSupplementPhoto(entree: {
  lignes: readonly RepereSurLeGateau[];
  supplementPhoto: string;
  libelleSupplement?: string;
}): Echec[] {
  return controlerSupplementAutomatique(entree.lignes, {
    cle: entree.supplementPhoto,
    libelle: entree.libelleSupplement,
    porte: porteUnePhoto,
    codeManque: 'ERR_PHOTO_SANS_SUPPLEMENT',
    champManque: 'photoImprimee',
    objet: 'une photo à imprimer',
  });
}
