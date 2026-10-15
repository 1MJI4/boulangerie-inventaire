// src/domaine/coherence.ts
//
// Cohérence d'une saisie de COMMANDE, hors prix et calendrier : client,
// téléphone, acompte, doublons, statut, prix convenu, écriture.
// Propriétaire : agent `regles-metier`. Orchestré par `commande.ts`.
//
// Chaque règle : une phrase, un niveau justifié, une sortie en un geste quand
// elle existe. Dans le doute (CLAUDE.md, règle de doute) : bloquer.
// (Les contrôles d'INVENTAIRE sont dans inventaire.ts : produits distincts.)

import type { Resultat, Signalement } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import { formaterEuros, partMinimale } from './argent.ts';
import { deverrouillageValide } from './regimes.ts';
import { decalerJours, estDateISO } from './calendrier.ts';
import { validerRemise } from './reglement.ts';
import type { ArticleRemise } from './reglement.ts';
import type { DateISO, Deverrouillage } from './types.ts';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Règle : un champ obligatoire (nom du client, téléphone) n'est jamais vide.
 * Niveau : BLOQUANT — une commande sans nom ni téléphone ne se rend pas.
 */
export function validerChampObligatoire(
  valeur: string | null | undefined,
  champLibelle: string,
  champ: string,
): Resultat<string> {
  const v = String(valeur ?? '').trim();
  if (v === '') return signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle }, { champ });
  return succes(v);
}

/**
 * Format plausible d'un téléphone, une fois espaces, points, tirets, barres et
 * parenthèses retirés.
 * HYPOTHÈSE À VALIDER : belge national (0 + 8 ou 9 chiffres : 02 123 45 67,
 * 0470 12 34 56) ou international (+ ou 00, puis 8 à 15 chiffres).
 */
export function telephonePlausible(telephone: string): boolean {
  const t = String(telephone ?? '').replace(/[\s.\-/()]/g, '');
  return /^0\d{8,9}$/.test(t) || /^(\+|00)\d{8,15}$/.test(t);
}

/**
 * Règle : téléphone obligatoire ; un format improbable est signalé.
 * Niveau : vide → BLOQUANT ; improbable → AVERTISSEMENT (un numéro étranger
 * ou inhabituel existe : on fait relire, on ne perd pas la vente).
 */
export function validerTelephone(telephone: string | null | undefined, champ = 'telephone'): Resultat<string> {
  const present = validerChampObligatoire(telephone, 'téléphone du client', champ);
  if (!present.ok) return present;
  if (telephonePlausible(present.donnees)) return present;
  return succes(present.donnees, signaler('AVERT_TELEPHONE_IMPROBABLE', {}, { champ }));
}

// ---------------------------------------------------------------------------
// Montants
// ---------------------------------------------------------------------------

/**
 * Règle R52 (règlement intérieur) : l'acompte est un montant entier, d'au
 * moins `pourcentageMin` % du total (arrondi au centime SUPÉRIEUR) et jamais
 * supérieur au total. Vaut pour TOUTE commande (plus d'acompte facultatif).
 * Niveau : BLOQUANT.
 *  - illisible / négatif → ERR_SAISIE_INVALIDE, sortie « mettre le minimum » ;
 *  - supérieur au total → ERR_ACOMPTE_SUPERIEUR_TOTAL, `valeurProposee` = total ;
 *  - sous le minimum → ERR_ACOMPTE_INSUFFISANT, `valeurProposee` = minimum.
 * `pourcentageMin` est une DONNÉE (REGLEMENT_COMMANDE.acomptePourcentageMin).
 * N'interdit pas : un acompte entre le minimum et le total (total payé d'avance).
 */
export function validerAcompte(
  acompteCentimes: number,
  totalCentimes: number,
  pourcentageMin: number,
  champ = 'acompte',
): Resultat<number> {
  const minimum = partMinimale(totalCentimes, pourcentageMin);
  if (!Number.isSafeInteger(acompteCentimes) || acompteCentimes < 0) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'acompte' }, { champ, valeurProposee: minimum });
  }
  if (acompteCentimes > totalCentimes) {
    return signaler(
      'ERR_ACOMPTE_SUPERIEUR_TOTAL',
      { acompteFormate: formaterEuros(acompteCentimes), totalFormate: formaterEuros(totalCentimes) },
      { champ, valeurProposee: totalCentimes },
    );
  }
  if (acompteCentimes < minimum) {
    return signaler(
      'ERR_ACOMPTE_INSUFFISANT',
      {
        acompteFormate: formaterEuros(acompteCentimes),
        minimumFormate: formaterEuros(minimum),
        pourcentage: pourcentageMin,
      },
      { champ, valeurProposee: minimum },
    );
  }
  return succes(acompteCentimes);
}

/**
 * Règle : le prix convenu avec le client ne descend pas sous le total du tarif
 * sans l'accord du gérant, et ne le dépasse jamais.
 * Niveau :
 *  - absent ou égal au tarif → accepté ;
 *  - inférieur sans déverrouillage → BLOQUANT (sortie : remettre le total) ;
 *  - inférieur avec déverrouillage { par, le } → accepté, AVERTISSEMENT tracé ;
 *  - supérieur → BLOQUANT : un écart au catalogue est un bug (LOI 1) ; une
 *    hausse se fait par le prix par personne (régime C), pas sur le total ;
 *  - 0 € ou moins → BLOQUANT (QUESTIONS-GERANT n°13).
 * Renvoie le total à facturer.
 */
export function validerPrixConvenu(
  totalTarifCentimes: number,
  totalConvenuCentimes: number | null | undefined,
  remise?: Deverrouillage | null,
  champ = 'total',
): Resultat<number> {
  if (totalConvenuCentimes === null || totalConvenuCentimes === undefined) return succes(totalTarifCentimes);
  const options = { champ, valeurProposee: totalTarifCentimes };
  if (!Number.isSafeInteger(totalConvenuCentimes)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'total' }, options);
  }
  if (totalConvenuCentimes <= 0) return signaler('ERR_MONTANT_NUL', { objet: 'la commande' }, options);
  if (totalConvenuCentimes === totalTarifCentimes) return succes(totalTarifCentimes);
  const totalFormate = formaterEuros(totalTarifCentimes);
  if (totalConvenuCentimes > totalTarifCentimes) {
    return signaler('ERR_TOTAL_INCOHERENT', { totalFormate }, options);
  }
  if (!deverrouillageValide(remise)) {
    return signaler('ERR_REMISE_NON_AUTORISEE', { totalFormate }, options);
  }
  return succes(
    totalConvenuCentimes,
    signaler('AVERT_REMISE_AUTORISEE', { par: remise.par.trim() }, { champ }),
  );
}

// ---------------------------------------------------------------------------
// Lignes
// ---------------------------------------------------------------------------

/**
 * Règle : un même produit sur plusieurs lignes est signalé, avec la sortie
 * « fusionner les lignes » (`valeurProposee` = indices des lignes concernées).
 * Niveau : AVERTISSEMENT — deux Number Cake aux textes différents, ou deux
 * variantes d'un même produit, sont légitimes.
 */
export function reperesDoublons(
  lignes: readonly { produitId?: string | null; libelle: string }[],
): Signalement[] {
  const parId = new Map<string, number[]>();
  lignes.forEach((l, i) => {
    if (!l.produitId) return;
    parId.set(l.produitId, [...(parId.get(l.produitId) ?? []), i]);
  });
  const sortie: Signalement[] = [];
  for (const indices of parId.values()) {
    if (indices.length < 2) continue;
    sortie.push(
      signaler(
        'AVERT_PRODUIT_EN_DOUBLE',
        { produit: lignes[indices[0]].libelle },
        { champ: `lignes[${indices[0]}].produitId`, valeurProposee: indices },
      ),
    );
  }
  return sortie;
}

/**
 * Règle : un gâteau sur commande demande une réponse explicite sur l'écriture
 * (texte, ou « pas d'écriture »). Niveau : AVERTISSEMENT (question à poser au
 * client, pas une erreur de prix).
 */
export function controlerEcriture(entree: {
  contientGateau: boolean;
  texteGateau?: string | null;
  sansEcriture?: boolean;
}): Signalement[] {
  const aUnTexte = !!entree.texteGateau && entree.texteGateau.trim() !== '';
  if (!entree.contientGateau || aUnTexte || entree.sansEcriture) return [];
  return [signaler('AVERT_ECRITURE_NON_PRECISEE', {}, { champ: 'texteGateau' })];
}

// ---------------------------------------------------------------------------
// Statut et modification
// ---------------------------------------------------------------------------

export type StatutCommande = 'a_imprimer' | 'imprimee' | 'remise' | 'annulee';

const LIBELLE_STATUT: Record<StatutCommande, string> = {
  a_imprimer: 'À imprimer',
  imprimee: 'Imprimée',
  remise: 'Remise au client',
  annulee: 'Annulée',
};

/**
 * Transitions permises. Remise et annulée sont TERMINALES.
 * HYPOTHÈSE À VALIDER : « à imprimer → remise » est refusé (une commande se
 * prépare d'après son bon imprimé) ; « imprimée → à imprimer » est permis
 * (réimpression après modification).
 */
const TRANSITIONS: Record<StatutCommande, readonly StatutCommande[]> = {
  a_imprimer: ['imprimee', 'annulee'],
  imprimee: ['remise', 'annulee', 'a_imprimer'],
  remise: [],
  annulee: [],
};

/**
 * Règle : un changement de statut suit le cycle de vie de la commande.
 * Niveau : BLOQUANT (une commande remise qui redevient « à imprimer » serait
 * produite deux fois).
 * Passage à « remise » : exige le décompte complet des articles devant le
 * client (R58, `validerRemise`) → sinon ERR_DECOMPTE_INCOMPLET.
 */
export function validerTransitionStatut(
  de: StatutCommande,
  vers: StatutCommande,
  options: { articles?: readonly ArticleRemise[] | null } = {},
  champ = 'statut',
): Resultat<StatutCommande> {
  if (de === vers) return succes(vers);
  if (!TRANSITIONS[de]?.includes(vers)) {
    return signaler(
      'ERR_STATUT_INCOHERENT',
      { de: LIBELLE_STATUT[de] ?? String(de), vers: LIBELLE_STATUT[vers] ?? String(vers) },
      { champ, valeurProposee: de },
    );
  }
  if (vers === 'remise') {
    const decompte = validerRemise(options.articles);
    if (!decompte.ok) return decompte;
  }
  return succes(vers);
}

export type EtatCommandeExistante = {
  statut: StatutCommande;
  retraitLe: DateISO;
  anonymiseeLe?: string | null;
};

/**
 * Règle : on ne modifie pas le contenu d'une commande annulée, remise,
 * anonymisée ou archivée (retrait passé depuis plus de `joursAvantArchivage`).
 * Niveau : BLOQUANT (R31 : l'historique sert en cas de litige). Sortie :
 * créer une nouvelle commande.
 * Commande déjà imprimée → acceptée, AVERTISSEMENT « réimprimez ».
 * `joursAvantArchivage` est une donnée (aujourd'hui 2 dans src/lib/commandes.ts).
 */
export function validerModification(
  existante: EtatCommandeExistante,
  aujourdhui: DateISO,
  joursAvantArchivage: number,
): Resultat<EtatCommandeExistante> {
  const figee = (etat: string) => signaler('ERR_COMMANDE_FIGEE', { etat }, { champ: 'statut' });
  if (existante.anonymiseeLe) return figee('anonymisée');
  if (existante.statut === 'annulee') return figee('annulée');
  if (existante.statut === 'remise') return figee('remise au client');
  if (estDateISO(existante.retraitLe) && decalerJours(existante.retraitLe, joursAvantArchivage) < aujourdhui) {
    return figee('archivée');
  }
  if (existante.statut === 'imprimee') {
    return succes(existante, signaler('AVERT_COMMANDE_DEJA_IMPRIMEE', {}, { champ: 'statut' }));
  }
  return succes(existante);
}
