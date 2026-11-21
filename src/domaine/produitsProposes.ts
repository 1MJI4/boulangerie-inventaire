// src/domaine/produitsProposes.ts
//
// Produits PROPOSÉS par les vendeurs au comptage (propriétaire, 21/11/2026) : un produit
// qui se compte ce soir mais n'est pas dans la liste d'inventaire. Le vendeur le propose
// (nom + reste), le manager décide : l'AJOUTER à la liste, le rattacher à un produit
// DÉJÀ listé (une autre façon de l'écrire), ou en faire une EXCEPTION. Tant qu'il n'a pas
// décidé, la proposition n'entre dans aucun total (LOI 10 : la liste d'inventaire reste
// la seule table de produits). Propriétaire : agent `regles-metier`. Fonctions pures.

import { succes, type Resultat } from './resultat.ts';
import { signaler } from './messages.ts';

export const LONGUEUR_NOM_MAX = 80;
export const QUANTITE_MAX = 99_999;

/** « Bàgnat  Blanc » → « bagnat blanc » : sans accents, sans casse, espaces réduits. */
export function normaliserNomProduit(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Deux écritures du même nom (accents, casse, ponctuation ignorés). */
export function memeNomDeProduit(a: string, b: string): boolean {
  const x = normaliserNomProduit(a);
  return x !== '' && x === normaliserNomProduit(b);
}

export type PropositionSaisie = { nom: string; quantite: number | null };

/**
 * Règle : une proposition a un nom lisible (2 à 80 caractères, espaces réduits) et, si elle
 * donne un reste, un entier positif ou nul. Le nom est gardé tel que le vendeur l'a écrit
 * (LOI 5), seuls les espaces sont nettoyés.
 */
export function validerProposition(nom: unknown, quantite: unknown): Resultat<PropositionSaisie> {
  const propre = String(nom ?? '').replace(/\s+/g, ' ').trim();
  if (propre.length < 2 || normaliserNomProduit(propre) === '') {
    return signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'nom du produit' }, { champ: 'nom' });
  }
  if (propre.length > LONGUEUR_NOM_MAX) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'nom du produit (80 caractères au plus)' }, { champ: 'nom' });
  }
  if (quantite === null || quantite === undefined || quantite === '') return succes({ nom: propre, quantite: null });
  const n = Number(quantite);
  if (!Number.isSafeInteger(n) || n < 0 || n > QUANTITE_MAX) {
    return signaler('ERR_QUANTITE_INVALIDE', { unite: 'piece', zeroAccepte: true }, { champ: 'quantite' });
  }
  return succes({ nom: propre, quantite: n });
}
