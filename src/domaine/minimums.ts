// src/domaine/minimums.ts
//
// LOI 7 — tous les minimums sont BLOQUANTS (décision du gérant, 15/10/2026),
// avec la sortie en un geste : « Passer à N parts ».
// Propriétaire : agent `regles-metier`.
//
// Aucun seuil ici : minimum, minimum par symbole et maximum sont lus dans le
// prix du produit au catalogue (`minQuantite`, `minParSymbole`, `maxParUnite`).
// Les seuils restent distincts par produit — ne pas les unifier.
//
// Disparaît avec cette règle (décision du 15/10/2026) : supplément « moins de
// 6 personnes », « un gâteau se fait à la pièce ou à partir de 4 parts »,
// paliers dégressifs, réglage des coupes (13 parts). Plus de dérogation.

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import { deverrouillageValide } from './regimes.ts';
import { FAMILLE_SUPPLEMENT } from './constantes.ts';
import type { Deverrouillage, FicheTarifee } from './types.ts';

function libelleUnite(fiche: FicheTarifee, n: number): string {
  if (fiche.prix.basePrix === 'personne') return n > 1 ? 'parts' : 'part';
  return n > 1 ? 'pièces' : 'pièce';
}

/**
 * Séparateurs tapés ENTRE les chiffres ou lettres (« 2 5 », « 2-5 », « 2.5 ») :
 * ils ne se réalisent pas, ils ne comptent pas (audit du 28/10/2026).
 */
const SEPARATEURS_SYMBOLES = /[\s\-‐‑‒–—_.,;:/·']/gu;

/**
 * Number Cake : nombre de chiffres ou lettres à réaliser. « 25 », « 2 5 »,
 * « 2-5 » → 2.
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°21) : chaque caractère visible
 * compte, signes compris (« 18+ » → 3). C'est le comptage le plus exigeant,
 * donc le plus sûr ; les espaces et les séparateurs (tiret, point, virgule,
 * barre) ne comptent pas.
 */
export function compterSymboles(texte: string): number {
  return [...String(texte ?? '').replace(SEPARATEURS_SYMBOLES, '')].length;
}

/**
 * Règle (audit du 28/10/2026) : le nombre de chiffres ou lettres d'un Number
 * Cake SUIT le texte saisi, jamais un nombre déclaré à part (« 25 » avec « 1 »
 * touché = 2, donc 30 parts minimum). Retourne le nombre compté dans le texte,
 * ou `null` quand le texte ne permet pas de compter :
 *  - texte vide (le nombre déclaré reste seul juge) ;
 *  - « Autre forme » (cœur, étoile… : `formesLibres`), où les lettres tapées
 *    décrivent une forme au lieu d'être réalisées une à une.
 */
export function symbolesDuTexte(texte: string | null | undefined, formesLibres = false): number | null {
  if (formesLibres) return null;
  const n = compterSymboles(String(texte ?? ''));
  return n > 0 ? n : null;
}

/** Minimum applicable à cette ligne, ou `null` si le produit n'en a pas. */
export function minimumApplicable(fiche: FicheTarifee, nbSymboles?: number): number | null {
  const { minQuantite, minParSymbole } = fiche.prix;
  const parSymbole =
    minParSymbole !== null && nbSymboles !== undefined ? minParSymbole * nbSymboles : null;
  if (minQuantite === null && parSymbole === null) return null;
  return Math.max(minQuantite ?? 0, parSymbole ?? 0);
}

/**
 * Règle R10–R13 : la quantité d'une ligne doit atteindre le minimum du produit.
 *  - minimum simple (Layer Cake 20, mini burger 10…) ;
 *  - Number Cake : minimum PAR SYMBOLE × nombre de symboles (« 25 » = 2 × 15 = 30).
 * Niveau : BLOQUANT, à la saisie de la ligne, `valeurProposee` = le minimum.
 * Le `typeMin` du catalogue n'est pas lu : depuis le 15/10/2026, TOUT minimum
 * bloque, y compris un minimum que le catalogue aurait laissé sans type.
 * Sans nombre de symboles sur un produit à minimum par symbole → BLOQUANT
 * (on ne peut pas vérifier : on refuse).
 * N'interdit pas : toute quantité ≥ minimum ; un produit sans minimum.
 */
export function validerQuantiteMin(
  fiche: FicheTarifee,
  quantite: number,
  options: { nbSymboles?: number } = {},
): Resultat<number> {
  const { nbSymboles } = options;
  if (fiche.prix.minParSymbole !== null) {
    if (nbSymboles === undefined || !Number.isSafeInteger(nbSymboles) || nbSymboles <= 0) {
      return signaler(
        'ERR_NB_SYMBOLES_MANQUANT',
        { produit: fiche.produit.produit },
        { champ: 'nbSymboles' },
      );
    }
  }
  const minimum = minimumApplicable(fiche, nbSymboles);
  if (minimum === null || quantite >= minimum) return succes(quantite);

  const unite = libelleUnite(fiche, minimum);
  const precision =
    fiche.prix.minParSymbole !== null && nbSymboles !== undefined
      ? `${fiche.prix.minParSymbole} ${libelleUnite(fiche, fiche.prix.minParSymbole)} par chiffre ou lettre, ` +
        `${nbSymboles} ${nbSymboles > 1 ? 'chiffres ou lettres' : 'chiffre ou lettre'}`
      : undefined;
  return signaler(
    'ERR_QUANTITE_MIN',
    precision
      ? { produit: fiche.produit.produit, minimum, unite, precision }
      : { produit: fiche.produit.produit, minimum, unite },
    { champ: 'quantite', valeurProposee: minimum },
  );
}

/**
 * Règle R14 — pain surprise : au plus `maxParUnite.valeur` sandwichs par pain.
 * Niveau : AVERTISSEMENT (affiche : « proposer un 2e pain » plutôt que refuser).
 * `valeurProposee` = nombre de pains nécessaires.
 * N'interdit pas : 21 sandwichs (accepté, signalé) ; un produit sans maximum.
 *
 * @param nbPains   quantité de la ligne (nombre de pains)
 * @param nbObjets  nombre d'objets demandés au total (sandwichs)
 */
export function validerMaximum(fiche: FicheTarifee, nbPains: number, nbObjets: number): Resultat<number> {
  const max = fiche.prix.maxParUnite;
  if (!max || nbPains <= 0) return succes(nbPains);
  if (nbObjets <= max.valeur * nbPains) return succes(nbPains);
  const painsNecessaires = Math.ceil(nbObjets / max.valeur);
  return succes(
    nbPains,
    signaler(
      'AVERT_PAIN_SUPPLEMENTAIRE',
      { maximum: max.valeur, demande: nbObjets },
      { champ: 'quantite', valeurProposee: painsNecessaires },
    ),
  );
}

// ---------------------------------------------------------------------------
// R59 — tailles standard d'un gâteau simple sur commande (LOI 11, 15/10/2026)
// ---------------------------------------------------------------------------

/**
 * Tailles standard les plus proches de `parts`, strictement en dessous et
 * strictement au-dessus (`null` s'il n'y en a pas). Les tailles invalides
 * (non entières, ≤ 0) de la liste sont ignorées ; l'ordre de la liste est libre.
 */
export function taillesProches(
  parts: number,
  tailles: readonly number[],
): { inferieure: number | null; superieure: number | null } {
  let inferieure: number | null = null;
  let superieure: number | null = null;
  for (const t of tailles) {
    if (!Number.isSafeInteger(t) || t <= 0) continue;
    if (t < parts && (inferieure === null || t > inferieure)) inferieure = t;
    if (t > parts && (superieure === null || t < superieure)) superieure = t;
  }
  return { inferieure, superieure };
}

/**
 * Le produit est-il un « gâteau simple sur commande », soumis aux tailles
 * standard ? Lu dans les DONNÉES de la fiche, jamais dans le nom :
 * régime C, prix par personne, pas un supplément (Pâte à sucre, R64), SANS minimum particulier (ni `minQuantite`, ni
 * `minParSymbole`), sans étages, sans maximum par unité.
 * Layer Cake (minimum 20), Number Cake (minimum par symbole), gâteau de
 * mariage et pièce montée (minimum + étages) gardent leurs propres règles (LOI 7).
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT, tailles standard) : « gâteau simple »
 * = cette combinaison de données ; un gâteau à minimum n'a pas de taille imposée.
 */
export function estGateauSimpleSurCommande(fiche: FicheTarifee): boolean {
  const { produit, prix } = fiche;
  return (
    produit.regimePrix === 'C' &&
    prix.basePrix === 'personne' &&
    produit.famille !== FAMILLE_SUPPLEMENT &&
    prix.minQuantite === null &&
    prix.minParSymbole === null &&
    !(typeof prix.etages === 'number' && prix.etages > 0) &&
    prix.maxParUnite === null
  );
}

/** Écart entre deux tailles proposées à partir du minimum (propriétaire, 22/10/2026 : « toujours par 5 »). */
export const PAS_TAILLES_A_MINIMUM = 5;
/** Nombre de tailles proposées : 9 boutons + « Autre » tiennent sur deux rangées de 5. */
export const NB_TAILLES_A_MINIMUM = 9;

/**
 * Règle R61 (propriétaire, 22/10/2026) : un gâteau par personne À MINIMUM
 * (Layer Cake, Number Cake, pièces montées) se choisit aux boutons de taille,
 * comme le Bavarois, en partant de SON minimum, de 5 en 5 :
 * Layer Cake 20, 25, 30… · Number Cake « 25 » (2 symboles) 30, 35… ·
 * pièce montée 2 étages 40, 45… · 3 étages 60, 65…
 * Ce sont des RACCOURCIS, pas une limite : toute quantité ≥ minimum reste
 * acceptée au pavé (« Autre ») ; sous le minimum, `validerQuantiteMin` refuse.
 * Vide si le produit n'est pas concerné, ou si le minimum n'est pas encore
 * connu (Number Cake sans nombre de symboles).
 */
export function taillesAPartirDuMinimum(fiche: FicheTarifee, nbSymboles?: number | null): number[] {
  if (fiche.produit.regimePrix !== 'C' || fiche.prix.basePrix !== 'personne') return [];
  if (fiche.produit.famille === FAMILLE_SUPPLEMENT) return [];
  if (fiche.prix.minParSymbole !== null && !(typeof nbSymboles === 'number' && nbSymboles > 0)) return [];
  const minimum = minimumApplicable(fiche, nbSymboles ?? undefined);
  if (minimum === null || minimum <= 0) return [];
  return Array.from({ length: NB_TAILLES_A_MINIMUM }, (_, i) => minimum + i * PAS_TAILLES_A_MINIMUM);
}

/**
 * Règle R59 (règlement intérieur, décision du 15/10/2026) : un gâteau simple
 * sur commande se fait dans une des tailles standard (`tailles`, donnée
 * réglable — défaut REGLEMENT_COMMANDE.taillesGateau).
 * Niveau : BLOQUANT (ERR_TAILLE_NON_STANDARD), à la saisie de la ligne, avec la
 * sortie en un geste vers la taille standard supérieure (ou inférieure s'il
 * n'y a pas de supérieure) ; le message cite les deux tailles proches.
 * Avec le déverrouillage du gérant { par, le } → accepté,
 * AVERT_TAILLE_NON_STANDARD_AUTORISEE tracé.
 * Contrôlé APRÈS le minimum (validerQuantiteMin).
 * N'interdit pas : une taille de la liste ; un produit qui n'est pas un gâteau
 * simple (Layer 22 parts, mini-pâtisseries, comptoir, salé).
 * HYPOTHÈSE À VALIDER : liste vide → aucune taille imposée (le gérant a retiré
 * la règle) ; refuser tous les gâteaux sans proposition ferait perdre la vente.
 */
export function validerTailleGateau(
  fiche: FicheTarifee,
  parts: number,
  tailles: readonly number[],
  deverrouillage?: Deverrouillage | null,
): Resultat<number> {
  if (!estGateauSimpleSurCommande(fiche)) return succes(parts);
  const valides = tailles.filter((t) => Number.isSafeInteger(t) && t > 0);
  if (valides.length === 0 || valides.includes(parts)) return succes(parts);
  if (deverrouillageValide(deverrouillage)) {
    return succes(
      parts,
      signaler('AVERT_TAILLE_NON_STANDARD_AUTORISEE', { par: deverrouillage.par.trim() }, { champ: 'quantite' }),
    );
  }
  const { inferieure, superieure } = taillesProches(parts, valides);
  return signaler(
    'ERR_TAILLE_NON_STANDARD',
    { parts, inferieure, superieure },
    { champ: 'quantite', valeurProposee: superieure ?? inferieure },
  );
}
