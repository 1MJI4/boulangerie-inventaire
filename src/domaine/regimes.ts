// src/domaine/regimes.ts
//
// LOI 6 — trois régimes de prix coexistent. Le régime est LU sur le produit
// (`regimePrix`), JAMAIS déduit du nom : « Bavarois » se vend au prix comptoir
// du 6P (A) et, sur commande, au plancher par personne de l'affiche (C).
// Propriétaire : agent `regles-metier`.
//
//   A comptoir  : prix fixe du catalogue, à la pièce ou au kilo
//   B traiteur  : prix fixe du catalogue à la pièce (minimum : minimums.ts)
//   C gâteaux   : prix par personne (ou par pièce pour les minis), PLANCHER
//                 « à partir de » ; pré-rempli au plancher, modifiable vers le
//                 haut ; sous le plancher → refus sauf déverrouillage gérant.
//   Suppléments (basePrix forfait, prix non plancher) : prix fixe, une fois
//   par gâteau — jamais multiplié par le nombre de personnes (R7).
//
// Disparaît (décision du 15/10/2026) : paliers dégressifs, formats fixes de
// l'ancien `gateaux.ts` appliqués à un gâteau sur commande (mélange A/C),
// supplément « moins de 6 personnes ».

import type { Resultat, Signalement } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import { formaterEuros } from './argent.ts';
import { totalLigne } from './unites.ts';
import type { Deverrouillage, FicheTarifee, RegimePrix } from './types.ts';

export type PrixCalcule = {
  regimePrix: RegimePrix;
  /** Prix unitaire appliqué : pièce, KILO (kg) ou personne (C). Figé sur la ligne (R4). */
  prixUnitaireCentimes: number;
  totalCentimes: number;
  /** Présent si le prix est sous le plancher avec l'accord du gérant (tracé en base). */
  sousPlancher?: Deverrouillage;
};

/** Un déverrouillage n'est valable que s'il porte un nom ET un horodatage (miroir du CHECK en base). */
export function deverrouillageValide(d: Deverrouillage | undefined | null): d is Deverrouillage {
  return !!d && typeof d.par === 'string' && d.par.trim() !== '' && typeof d.le === 'string' && d.le.trim() !== '';
}

/**
 * Règle R5b : en régime C, le prix par personne saisi ne descend pas sous le
 * plancher « à partir de ».
 * Niveau : BLOQUANT, `valeurProposee` = le plancher, sauf déverrouillage du
 * gérant { par, le } → accepté, AVERTISSEMENT tracé.
 * Un prix à 0 € reste refusé même déverrouillé (QUESTIONS-GERANT n°13).
 * Vérifier que `par` est bien le gérant (code gérant) relève de `securite`,
 * côté route : le domaine vérifie seulement que l'accord est complet.
 * N'interdit pas : tout prix ≥ plancher (« modifiable vers le haut »).
 */
export function validerPrixParPersonne(
  fiche: FicheTarifee,
  prixSaisiCentimes: number,
  deverrouillage?: Deverrouillage | null,
): Resultat<number> {
  const plancher = fiche.prix.prixCentimes;
  if (!Number.isSafeInteger(prixSaisiCentimes) || prixSaisiCentimes <= 0) {
    return signaler(
      'ERR_SOUS_PLANCHER',
      { produit: fiche.produit.produit, plancherFormate: formaterEuros(plancher) },
      { champ: 'prixCentimes', valeurProposee: plancher },
    );
  }
  if (!fiche.prix.prixEstPlancher || prixSaisiCentimes >= plancher) return succes(prixSaisiCentimes);
  if (deverrouillageValide(deverrouillage)) {
    return succes(
      prixSaisiCentimes,
      signaler(
        'AVERT_SOUS_PLANCHER_AUTORISE',
        { produit: fiche.produit.produit, par: deverrouillage.par.trim() },
        { champ: 'prixCentimes' },
      ),
    );
  }
  return signaler(
    'ERR_SOUS_PLANCHER',
    { produit: fiche.produit.produit, plancherFormate: formaterEuros(plancher) },
    { champ: 'prixCentimes', valeurProposee: plancher },
  );
}

/**
 * Prix d'une ligne selon le régime du produit.
 *  - `quantite` : pièces, parts, ou GRAMMES si le produit est au kilo ;
 *  - `prixParPersonneCentimes` : prix saisi en régime C (absent → plancher) ;
 *    IGNORÉ en A/B et pour un supplément : le prix vient du catalogue.
 * Niveau : BLOQUANT si le produit n'a pas de régime, si l'unité du produit et
 * la base du prix se contredisent, ou si le prix C est sous le plancher.
 */
export function prixLigne(
  fiche: FicheTarifee,
  quantite: number,
  options: { prixParPersonneCentimes?: number; deverrouillage?: Deverrouillage | null } = {},
): Resultat<PrixCalcule> {
  const { produit, prix } = fiche;
  const regime = produit.regimePrix;
  if (regime !== 'A' && regime !== 'B' && regime !== 'C') {
    // Un produit sans régime n'est pas vendable (LOI 6, schéma : regimePrix NULL).
    return signaler('ERR_PRODUIT_SANS_REGIME', { produit: produit.produit }, { champ: 'produitId' });
  }
  if ((prix.basePrix === 'kg') !== (produit.unite === 'kg')) {
    return signaler('ERR_UNITE_INCOHERENTE', {}, { champ: 'unite' });
  }

  let unitaire = prix.prixCentimes;
  let sousPlancher: Deverrouillage | undefined;
  const signalements: Signalement[] = [];
  if (regime === 'C' && prix.prixEstPlancher) {
    const saisi = options.prixParPersonneCentimes ?? prix.prixCentimes;
    const v = validerPrixParPersonne(fiche, saisi, options.deverrouillage);
    if (!v.ok) return v;
    unitaire = v.donnees;
    signalements.push(...v.signalements);
    if (unitaire < prix.prixCentimes && deverrouillageValide(options.deverrouillage)) {
      sousPlancher = { par: options.deverrouillage.par.trim(), le: options.deverrouillage.le };
    }
  }

  const total = totalLigne(produit.unite, quantite, unitaire);
  if (!total.ok) return total;
  const donnees: PrixCalcule = { regimePrix: regime, prixUnitaireCentimes: unitaire, totalCentimes: total.donnees };
  if (sousPlancher) donnees.sousPlancher = sousPlancher;
  return succes(donnees, ...signalements);
}
