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
import type { FicheTarifee } from './types.ts';

function libelleUnite(fiche: FicheTarifee, n: number): string {
  if (fiche.prix.basePrix === 'personne') return n > 1 ? 'parts' : 'part';
  return n > 1 ? 'pièces' : 'pièce';
}

/**
 * Number Cake : nombre de symboles à réaliser. « 25 » → 2.
 * HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°21) : chaque caractère visible
 * compte, signes compris (« 18+ » → 3). C'est le comptage le plus exigeant,
 * donc le plus sûr ; les espaces ne comptent pas.
 */
export function compterSymboles(texte: string): number {
  return [...String(texte ?? '').replace(/\s/g, '')].length;
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
        `${nbSymboles} ${nbSymboles > 1 ? 'symboles' : 'symbole'}`
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
