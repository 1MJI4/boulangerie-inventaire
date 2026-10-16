// src/components/inventaire/progression.ts
//
// « Comment savoir que j'ai fini l'inventaire ? » (retour du propriétaire)
//
// Calculs PURS de l'écran de comptage : où en est le comptage, quel est le
// prochain produit à compter, et l'inventaire est-il vraiment terminé —
// c'est-à-dire compté ET enregistré. Aucune dépendance React ni réseau.
// Propriétaire : `inventaire-scan`.
//
// Une valeur vide ('') = « pas encore compté ». '0' = compté, il n'en reste
// plus. Les deux ne se confondent jamais.

/** Ce dont le calcul a besoin d'un produit de la liste d'inventaire (LOI 10). */
export type ProduitCompte = {
  id: number;
  /** Produit retiré de la liste : absent du comptage. Absent = actif. */
  actif?: boolean;
};

export type Progression = {
  /** Produits actifs comptés (valeur non vide, 0 compris). */
  comptes: number;
  /** Produits actifs de la liste. */
  total: number;
  /** Identifiants des produits actifs pas encore comptés, dans l'ordre reçu. */
  restants: number[];
  /** Avancement en pour cent, entier arrondi vers le bas (100 seulement si tout est compté). */
  pourcent: number;
};

const estCompte = (valeurs: Readonly<Record<string, string>>, id: number): boolean =>
  (valeurs[id] ?? '') !== '';

/** Avancement du comptage, sur les seuls produits ACTIFS ; un produit n'est compté qu'une fois. */
export function calculerProgression(
  produits: readonly ProduitCompte[],
  valeurs: Readonly<Record<string, string>>
): Progression {
  const vus = new Set<number>();
  const restants: number[] = [];
  let comptes = 0;
  for (const p of produits) {
    if (p.actif === false || vus.has(p.id)) continue;
    vus.add(p.id);
    if (estCompte(valeurs, p.id)) comptes += 1;
    else restants.push(p.id);
  }
  const total = vus.size;
  const pourcent = total === 0 ? 0 : Math.floor((comptes * 100) / total); // invariant-ok: pourcentage de progression (entiers), pas un montant
  return { comptes, total, restants, pourcent };
}

/**
 * Prochain produit non compté APRÈS `depuisId` dans l'ordre d'affichage, en
 * repartant du début si besoin. `depuisId` absent ou inconnu : le premier non
 * compté. Le produit de départ lui-même n'est proposé qu'en dernier recours.
 * null si tout est compté.
 */
export function prochainNonCompte(
  ordre: readonly number[],
  valeurs: Readonly<Record<string, string>>,
  depuisId: number | null
): number | null {
  if (ordre.length === 0) return null;
  const depart = depuisId === null ? -1 : ordre.indexOf(depuisId);
  for (let pas = 1; pas <= ordre.length; pas += 1) {
    const id = ordre[(depart + pas + ordre.length) % ordre.length];
    if (!estCompte(valeurs, id)) return id;
  }
  return null;
}

export type EtatFin =
  /** Liste d'inventaire vide. */
  | 'vide'
  /** Il reste des produits à compter. */
  | 'en_cours'
  /** Tout est compté, mais une saisie est refusée : elle n'est PAS enregistrée. */
  | 'a_corriger'
  /** Tout est compté, mais des saisies ne sont pas encore parties. */
  | 'attente_envoi'
  /** Compté ET enregistré (éventuellement « terminé quand même » avec des manquants). */
  | 'termine';

export type BilanFin = {
  etat: EtatFin;
  /** Terminé à la demande de l'employé alors qu'il restait des produits. */
  incomplet: boolean;
  restants: number;
  enAttente: number;
  aCorriger: number;
  avertissements: number;
};

/**
 * L'inventaire est-il terminé ? Règle de doute : on n'annonce JAMAIS
 * « terminé » tant qu'une saisie attend son envoi ou a été refusée — l'écran
 * dirait « tout est enregistré » alors que ce n'est pas vrai.
 */
export function bilanFinInventaire(entree: {
  progression: Progression;
  /** Saisies modifiées pas encore enregistrées en base. */
  nbEnAttente: number;
  /** Un envoi est en cours (statut « envoi »). */
  envoiEnCours: boolean;
  /** Lignes portant un signalement bloquant (refus du serveur ou du domaine). */
  nbACorriger: number;
  /** Lignes portant un avertissement (accepté, signalé). */
  nbAvertissements: number;
  /** L'employé a confirmé « Terminer quand même ». */
  termineQuandMeme: boolean;
}): BilanFin {
  const { progression, nbEnAttente, envoiEnCours, nbACorriger, nbAvertissements, termineQuandMeme } = entree;
  const restants = progression.restants.length;
  const base = {
    restants,
    enAttente: nbEnAttente,
    aCorriger: nbACorriger,
    avertissements: nbAvertissements,
    incomplet: false,
  };
  if (progression.total === 0) return { ...base, etat: 'vide' };
  if (restants > 0 && !termineQuandMeme) return { ...base, etat: 'en_cours' };
  const incomplet = restants > 0;
  if (nbACorriger > 0) return { ...base, incomplet, etat: 'a_corriger' };
  if (nbEnAttente > 0 || envoiEnCours) return { ...base, incomplet, etat: 'attente_envoi' };
  return { ...base, incomplet, etat: 'termine' };
}

/** « 3 saisies pas encore envoyées » — accord en nombre, jamais de jargon. */
export function texteEnAttente(n: number): string {
  return n > 1 ? `${n} saisies pas encore envoyées` : `${n} saisie pas encore envoyée`;
}
