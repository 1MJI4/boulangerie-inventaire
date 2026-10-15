// src/lib/inventaire/lot.ts
//
// Préparation d'un lot de saisies d'inventaire reçu par POST /api/inventaires.
// Propriétaire : `inventaire-scan`. AUCUNE règle ici : chaque quantité passe
// par le domaine (`validerSaisieProduit`, `totalInventaire`) — c'est le rejeu
// côté serveur des contrôles déjà faits sur la tablette (offline-first).
//
// LOI 10 : la liste de produits reçue est celle de la table "Produit"
// (inventaire). Ce module n'importe jamais src/catalogue.
//
// Fonction pure (pas de Prisma) : testée par lot.test.ts avec `node --test`.

import type { Echec, Signalement } from '../../domaine/resultat.ts';
import { signaler } from '../../domaine/messages.ts';
import {
  totalInventaire,
  validerSaisieProduit,
  type ProduitInventaire,
  type SaisieInventaire,
} from '../../domaine/inventaire.ts';
import type { Unite } from '../../domaine/types.ts';

export const CHAMPS_QUANTITE = [
  'quantiteRestante',
  'quantiteProduite',
  'quantitePrevue',
  'quantiteCommande',
] as const;
export type ChampQuantite = (typeof CHAMPS_QUANTITE)[number];

export type LigneEntrante = {
  produitId?: unknown;
  /** Identifiant du geste de saisie (UUID généré sur la tablette). */
  saisieId?: unknown;
  /** Unité dans laquelle l'écran a saisi (pièces, ou grammes si 'kg'). */
  unite?: unknown;
  dateInventaire?: unknown;
  date?: unknown; // ancien nom, accepté pour ne pas casser un onglet resté ouvert
  faitLe?: unknown;
  /** Horodatage du geste sur la tablette (ISO), pour l'heure du relevé (R57). */
  saisiLe?: unknown;
} & Partial<Record<ChampQuantite, unknown>>;

export type LignePreparee = {
  produitId: number;
  date: string;
  unite: Unite;
  /** Dernier geste appliqué à cette ligne (null : ancien écran sans saisieId). */
  saisieId: string | null;
  /** Gestes reçus pour cette ligne (idempotence). */
  saisieIds: string[];
  valeurs: Partial<Record<ChampQuantite, number | null>>;
  faitLe?: Date | null;
};

export type LotPrepare = {
  ok: true;
  lignes: LignePreparee[];
  /** Avertissements du domaine (AVERT_DOUBLE_SCAN…), champ « produit:<id> ». */
  signalements: Signalement[];
};

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT_SAISIE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function lireDate(...candidats: unknown[]): string | null {
  for (const c of candidats) {
    if (typeof c === 'string' && FORMAT_DATE.test(c)) return c;
  }
  return null;
}

/** Identifiants numériques valides du lot (pour la requête des produits). */
export function idsDuLot(lignes: readonly LigneEntrante[]): number[] {
  const ids = new Set<number>();
  for (const l of lignes) {
    const id = Number(l?.produitId);
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

function champProduit(id: unknown): string {
  return `produit:${String(id)}`;
}

function produitInconnu(id: unknown): Echec {
  return signaler('ERR_PRODUIT_INCONNU', { liste: 'inventaire' }, { champ: champProduit(id) });
}

/** Texte ou nombre reçu → nombre brut, SANS correction (le domaine tranche). */
function lireNombre(valeur: unknown): number {
  if (typeof valeur === 'number') return valeur;
  if (typeof valeur === 'string' && valeur.trim() !== '') return Number(valeur.trim());
  return Number.NaN;
}

/**
 * Valide et regroupe un lot. Premier refus → Echec (format LOI 9), avec
 * `champ = "produit:<id>"` quand il vise un produit : l'écran sait quelle
 * ligne marquer et laisse partir les autres.
 *
 * - id inconnu de la liste d'INVENTAIRE (ou retiré) → ERR_PRODUIT_INCONNU ;
 * - unité différente de celle du produit → ERR_UNITE_INCOHERENTE (LOI 2) ;
 * - quantité négative / décimale / illisible → refus du domaine ;
 * - même saisieId reçu deux fois → compté une fois (rejeu) ; deux saisies
 *   distinctes du même produit → additionnées + AVERT_DOUBLE_SCAN.
 * `null` (ou '') efface la valeur : « pas encore compté », distinct de 0.
 */
export function preparerLot(
  lignes: readonly LigneEntrante[],
  produits: readonly ProduitInventaire[],
  dateLot: string,
): LotPrepare | Echec {
  type Groupe = { date: string; champ: ChampQuantite; saisies: SaisieInventaire[] };
  const groupes = new Map<string, Groupe>();
  const parLigne = new Map<string, LignePreparee>();
  const effacements: { cle: string; champ: ChampQuantite }[] = [];

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i] ?? {};
    const brut = ligne.produitId;
    const id = Number(brut);
    if (!Number.isSafeInteger(id) || id <= 0) return produitInconnu(brut);
    const produit = produits.find((p) => p.id === String(id) && p.actif !== false);
    if (!produit) return produitInconnu(id);

    // HYPOTHÈSE À VALIDER : un écran resté ouvert depuis l'ancienne version
    // n'envoie pas d'unité ; il ne connaissait que la pièce. Un produit au
    // kilo reçu sans unité est donc refusé (ERR_UNITE_INCOHERENTE) plutôt que
    // de compter des pièces comme des grammes.
    const unite: unknown = ligne.unite ?? 'piece';
    if (unite !== 'piece' && unite !== 'kg') {
      return signaler('ERR_UNITE_INCOHERENTE', {}, { champ: champProduit(id) });
    }

    const saisieId =
      typeof ligne.saisieId === 'string' && FORMAT_SAISIE_ID.test(ligne.saisieId) ? ligne.saisieId : null;
    const date = lireDate(ligne.dateInventaire, ligne.date) ?? dateLot;

    let faitLe: Date | null | undefined;
    if (ligne.faitLe === null) faitLe = null;
    else if (ligne.faitLe !== undefined) {
      const d = new Date(String(ligne.faitLe));
      if (Number.isNaN(d.getTime())) {
        return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'heure de production' }, { champ: 'faitLe' });
      }
      faitLe = d;
    }

    const cle = `${id}|${date}`;
    let preparee = parLigne.get(cle);
    let aDesValeurs = false;

    for (const champ of CHAMPS_QUANTITE) {
      const valeur = ligne[champ];
      if (valeur === undefined) continue;
      aDesValeurs = true;
      if (valeur === null || valeur === '') {
        effacements.push({ cle, champ });
        continue;
      }
      const saisie: SaisieInventaire = {
        // Sans saisieId (ancien écran), chaque ligne est un geste distinct.
        saisieId: saisieId ?? `ligne-${i}`,
        produitId: produit.id,
        unite,
        quantite: lireNombre(valeur),
      };
      const v = validerSaisieProduit(produits, saisie);
      if (!v.ok) return { ...v, champ: champProduit(id) };

      const cleGroupe = `${date}|${champ}`;
      const groupe = groupes.get(cleGroupe) ?? { date, champ, saisies: [] };
      groupe.saisies.push(saisie);
      groupes.set(cleGroupe, groupe);
    }

    if (!aDesValeurs && faitLe === undefined) continue; // rien à dire : jamais de 0 inventé

    if (!preparee) {
      preparee = { produitId: id, date, unite: produit.unite, saisieId: null, saisieIds: [], valeurs: {} };
      parLigne.set(cle, preparee);
    }
    if (saisieId) {
      preparee.saisieId = saisieId;
      if (!preparee.saisieIds.includes(saisieId)) preparee.saisieIds.push(saisieId);
    }
    if (faitLe !== undefined) preparee.faitLe = faitLe;
  }

  for (const { cle, champ } of effacements) {
    const l = parLigne.get(cle);
    if (l && l.valeurs[champ] === undefined) l.valeurs[champ] = null;
  }

  const signalements: Signalement[] = [];
  for (const groupe of groupes.values()) {
    const total = totalInventaire(produits, groupe.saisies);
    if (!total.ok) return total;
    signalements.push(...total.signalements);
    for (const l of total.donnees.lignes) {
      const preparee = parLigne.get(`${l.produitId}|${groupe.date}`);
      if (preparee) preparee.valeurs[groupe.champ] = l.quantite;
    }
  }

  return { ok: true, lignes: [...parLigne.values()], signalements };
}

/** Convertit une ligne de la table "Produit" en produit d'inventaire du domaine. */
export function versProduitInventaire(p: { id: number; nom: string; unite: Unite; actif: boolean }): ProduitInventaire {
  return { id: String(p.id), nom: p.nom, unite: p.unite, actif: p.actif };
}
