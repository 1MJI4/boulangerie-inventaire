// src/domaine/argent.ts
//
// LOI 1 — tout montant est un ENTIER en centimes. Ce fichier est le SEUL
// endroit où un montant est lu, multiplié, additionné ou formaté
// (invariant n°3 du pré-commit). Aucune arithmétique à virgule : pas de
// parseFloat, pas de toFixed, pas de « × 100 » sur un nombre décimal.
//
// Les entrées invalides d'un helper de calcul (montant décimal, NaN…) sont des
// BUGS de programmation, pas des saisies d'employé : elles lèvent une
// RangeError, attrapée par les tests. Les saisies d'employé passent par
// `lireMontant`, qui renvoie un `Resultat` avec un message humain.

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';

/** Grammes dans un kilo — conversion d'unité, pas un montant. */
const GRAMMES_PAR_KG = 1000;

function exigerEntier(valeur: number, nom: string): void {
  if (!Number.isSafeInteger(valeur)) {
    throw new RangeError(`argent.ts : ${nom} doit être un entier (reçu ${String(valeur)}).`);
  }
}

/**
 * Règle : un montant tapé par un employé (« 12 », « 12,5 », « 12,50 », « 12.50 €», // invariant-ok: exemple de format
 * « 1 234,50 ») devient un nombre entier de centimes, sans passer par un flottant. // invariant-ok: exemple de format
 * Niveau : bloquant si illisible — on ne devine jamais un montant.
 * N'interdit pas : le point comme séparateur décimal, le symbole €, les espaces.
 * Refuse : négatif, plus de 2 décimales, séparateur de milliers « . » (ambigu).
 */
export function lireMontant(texte: string, champ = 'montant'): Resultat<number> {
  const refus = signaler('ERR_SAISIE_INVALIDE', { champLibelle: champ }, { champ });
  const nettoye = String(texte ?? '')
    .replace(/[\s  ]/g, '')
    .replace(/€$/, '');
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(nettoye);
  if (!m) return refus;
  const euros = Number(m[1]);
  const centimes = Number((m[2] ?? '').padEnd(2, '0'));
  const total = euros * 100 + centimes;
  if (!Number.isSafeInteger(total)) return refus;
  return succes(total);
}

/**
 * Format UNIQUE d'affichage et d'impression : « 1 234,50 € ». // invariant-ok: exemple de format
 * Séparateur de milliers : espace simple (lisible sur les imprimantes ticket).
 */
export function formaterEuros(centimes: number): string {
  exigerEntier(centimes, 'centimes');
  const signe = centimes < 0 ? '-' : '';
  const absolu = Math.abs(centimes);
  const reste = absolu % 100;
  const euros = (absolu - reste) / 100;
  const milliers = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${signe}${milliers},${String(reste).padStart(2, '0')} €`;
}

/** quantité (entière) × prix unitaire (centimes) → centimes. */
export function multiplier(quantite: number, prixCentimes: number): number {
  exigerEntier(quantite, 'quantite');
  exigerEntier(prixCentimes, 'prixCentimes');
  const total = quantite * prixCentimes;
  exigerEntier(total, 'total');
  return total;
}

/**
 * LOI 2 — prix d'une pesée : grammes × prix au kilo, arrondi HALF-UP au centime.
 * Exemple fictif : 750 g × 1000 c/kg = 750 c. Calcul en entiers (division euclidienne).
 */
export function prixAuPoids(grammes: number, prixKgCentimes: number): number {
  exigerEntier(grammes, 'grammes');
  exigerEntier(prixKgCentimes, 'prixKgCentimes');
  if (grammes < 0 || prixKgCentimes < 0) {
    throw new RangeError('argent.ts : poids et prix au kilo doivent être positifs.');
  }
  const milliCentimes = grammes * prixKgCentimes;
  exigerEntier(milliCentimes, 'grammes × prix');
  const reste = milliCentimes % GRAMMES_PAR_KG;
  const quotient = (milliCentimes - reste) / GRAMMES_PAR_KG;
  return reste * 2 >= GRAMMES_PAR_KG ? quotient + 1 : quotient;
}

/** Somme de montants en centimes. Liste vide → 0. */
export function somme(montants: readonly number[]): number {
  let total = 0;
  for (const m of montants) {
    exigerEntier(m, 'montant');
    total += m;
  }
  exigerEntier(total, 'somme');
  return total;
}

/** Reste à payer = total − acompte, jamais négatif (un acompte trop élevé ne crée pas de dette). */
export function resteDu(totalCentimes: number, acompteCentimes: number): number {
  exigerEntier(totalCentimes, 'totalCentimes');
  exigerEntier(acompteCentimes, 'acompteCentimes');
  return Math.max(0, totalCentimes - acompteCentimes);
}

/**
 * Part minimale d'un montant, en POURCENT entier, arrondie au centime SUPÉRIEUR
 * (le plus sûr : un acompte « à 50 % » d'un total impair ne descend jamais sous
 * la moitié). Exemple fictif : 50 % de 2 931 c = 1 466 c. Calcul en entiers.
 */
export function partMinimale(totalCentimes: number, pourcent: number): number {
  exigerEntier(totalCentimes, 'totalCentimes');
  exigerEntier(pourcent, 'pourcent');
  if (totalCentimes < 0 || pourcent < 0 || pourcent > 100) {
    throw new RangeError('argent.ts : total ≥ 0 et pourcentage entre 0 et 100 attendus.');
  }
  const produit = totalCentimes * pourcent;
  exigerEntier(produit, 'total × pourcentage');
  const reste = produit % 100;
  const quotient = (produit - reste) / 100;
  return reste === 0 ? quotient : quotient + 1;
}
