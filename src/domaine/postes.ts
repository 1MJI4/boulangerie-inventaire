// src/domaine/postes.ts
//
// R74 — un papier par poste de production (propriétaire, 19/11/2026).
// Propriétaire : agent `regles-metier`. Fonctions pures : ce module ne connaît
// aucun produit ni aucun rayon — la donnée vient de
// src/catalogue/postesProduction.ts (LOI 6 : jamais déduit du nom).

import { decalerJours } from './calendrier.ts';
import { AVANCE_POSTE_MINUTES } from './constantes.ts';
import { heureChamp, lireHeure } from './reglement.ts';
import type { DateISO } from './types.ts';

/** Les postes de production, dans l'ordre où sortent leurs papiers. */
export const POSTES = ['patissier', 'atelier', 'boulanger'] as const;
export type Poste = (typeof POSTES)[number];

/** Ce qu'un poste fait pour un produit. */
export type TachePoste = {
  poste: Poste;
  /** Ce que le poste fait (« le pain », « la pâte, cuits ») ; absent : il fait le produit. */
  role?: string;
  /**
   * Le poste n'est concerné qu'AU-DELÀ de cette quantité, comptée sur toute la
   * commande pour les produits du même `groupe` (crêpes farcies : plus de 5).
   */
  auDela?: { groupe: string; quantite: number };
};

export type DonneesPostes = {
  parRayon: Readonly<Record<string, readonly TachePoste[]>>;
  parProduit: Readonly<Record<string, readonly TachePoste[]>>;
};

/** Une ligne de commande, vue par la répartition. */
export type LignePoste = {
  /** Clé du produit au catalogue de commande ; null : ligne libre (« Autre demande »). */
  cle: string | null;
  /** Rayon du produit (catégorie du catalogue), à la lettre. */
  rayon: string | null;
  quantite: number;
  /** Ligne libre : le vendeur a dit que c'est un gâteau. */
  gateauLibre?: boolean | null;
};

/** Ce que la répartition rend pour un poste concerné. */
export type BonDePoste = {
  poste: Poste;
  /** Indices des lignes de la commande, dans l'ordre du bon, avec le rôle à imprimer. */
  lignes: { index: number; role: string | null }[];
};

/**
 * Tâches d'un produit : celles du produit s'il en a de propres (elles
 * REMPLACENT celles du rayon), sinon celles de son rayon.
 * null : rayon inconnu de la donnée (nouveau tarif) — l'appelant ne doit
 * laisser personne l'ignorer.
 */
export function tachesDuProduit(cle: string | null, rayon: string | null, donnees: DonneesPostes): readonly TachePoste[] | null {
  if (cle !== null && Object.hasOwn(donnees.parProduit, cle)) return donnees.parProduit[cle];
  if (rayon !== null && Object.hasOwn(donnees.parRayon, rayon)) return donnees.parRayon[rayon];
  return null;
}

/**
 * Règle R74 : répartit les lignes d'une commande entre les postes concernés.
 *  - Seuls les postes qui ont au moins une ligne sont rendus, dans l'ordre
 *    pâtissier, atelier, boulanger.
 *  - Une ligne peut aller à plusieurs postes (burger : atelier + boulanger),
 *    avec son rôle pour chacun.
 *  - Tâche « au-delà de N » : le poste reçoit TOUTES les lignes du groupe dès
 *    que leur total sur la commande dépasse N (crêpes farcies : 3 + 3 = 6).
 *  - Ligne libre : au pâtissier si c'est un gâteau, sinon à l'atelier.
 *  - Rayon inconnu : à TOUS les postes (personne ne doit manquer un produit
 *    que la donnée ne connaît pas encore).
 * N'interdit rien : aucun refus ici, seulement « qui reçoit quoi ».
 */
export function repartirParPoste(lignes: readonly LignePoste[], donnees: DonneesPostes): BonDePoste[] {
  const taches = lignes.map((l): readonly TachePoste[] => {
    if (l.cle === null) return [{ poste: l.gateauLibre === true ? 'patissier' : 'atelier' }];
    return tachesDuProduit(l.cle, l.rayon, donnees) ?? POSTES.map((poste) => ({ poste, role: 'poste à confirmer' }));
  });
  // Totaux par groupe « au-delà de », sur toute la commande.
  const totaux = new Map<string, number>();
  lignes.forEach((l, i) => {
    const groupes = new Set(taches[i].flatMap((t) => (t.auDela ? [t.auDela.groupe] : [])));
    const q = Number.isFinite(l.quantite) && l.quantite > 0 ? l.quantite : 0;
    for (const g of groupes) totaux.set(g, (totaux.get(g) ?? 0) + q);
  });
  const bons: BonDePoste[] = [];
  for (const poste of POSTES) {
    const duPoste: BonDePoste['lignes'] = [];
    taches.forEach((ts, index) => {
      const t = ts.find((x) => x.poste === poste && (!x.auDela || (totaux.get(x.auDela.groupe) ?? 0) > x.auDela.quantite));
      if (t) duPoste.push({ index, role: t.role ?? null });
    });
    if (duPoste.length > 0) bons.push({ poste, lignes: duPoste });
  }
  return bons;
}

/**
 * Échéance d'un poste : l'heure à laquelle sa part doit être prête.
 * Boulanger : 2 heures avant le retrait (`AVANCE_POSTE_MINUTES`, réglage) —
 * commande à 10h00 → prêt à 8h00 ; il travaille la nuit, 4h00 est normal.
 * Avant minuit : la veille. Les autres postes n'ont pas d'échéance propre.
 * null : poste sans avance, ou heure de retrait absente ou illisible (aucune
 * échéance n'est inventée).
 */
export function echeancePoste(
  poste: Poste,
  retraitLe: DateISO,
  retraitHeure: string | null | undefined,
  avances: Readonly<Partial<Record<Poste, number>>> = AVANCE_POSTE_MINUTES,
): { date: DateISO; heure: string } | null {
  const avance = avances[poste];
  if (typeof avance !== 'number' || !Number.isSafeInteger(avance) || avance <= 0) return null;
  const minutes = lireHeure(retraitHeure);
  if (minutes === null) return null;
  const MINUTES_PAR_JOUR = 24 * 60;
  let reste = minutes - avance;
  let jours = 0;
  while (reste < 0) {
    reste += MINUTES_PAR_JOUR;
    jours -= 1;
  }
  return { date: jours === 0 ? retraitLe : decalerJours(retraitLe, jours), heure: heureChamp(reste) };
}
