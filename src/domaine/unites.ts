// src/domaine/unites.ts
//
// LOI 2 — deux unités qui ne se confondent jamais.
// Propriétaire : agent `regles-metier`.
//
//   piece : quantité ENTIÈRE de pièces (ou de parts)
//   kg    : quantité en GRAMMES ENTIERS (0,750 kg → 750). Le prix associé est
//           un prix au KILO. Même convention que la base (LigneCommande.quantite,
//           Inventaire, Releve : grammes en Int).
//
// Un produit au kilo compté à la pièce est l'erreur silencieuse que ce module
// empêche : la quantité porte toujours son unité, et le calcul du total dépend
// de l'unité, jamais du nom du produit.

import type { Resultat } from './resultat.ts';
import { succes } from './resultat.ts';
import { signaler } from './messages.ts';
import { multiplier, prixAuPoids } from './argent.ts';
import type { Unite } from './types.ts';

const GRAMMES_PAR_KG = 1000;

/**
 * Règle : une quantité COMMANDÉE est un entier strictement positif dans
 * l'unité du produit (pièces, ou grammes pour un produit au kilo).
 * Niveau : BLOQUANT (une quantité fausse = un prix faux).
 * Sortie proposée : pour des pièces décimales, l'entier le plus proche (au moins 1).
 * N'interdit pas : une très grande quantité (les minimums/maximums sont ailleurs).
 */
export function validerQuantite(unite: Unite, quantite: number, champ = 'quantite'): Resultat<number> {
  if (Number.isSafeInteger(quantite) && quantite > 0) return succes(quantite);
  if (unite === 'piece' && Number.isFinite(quantite) && quantite > 0) {
    const proposee = Math.max(1, Math.round(quantite));
    return signaler(
      'ERR_QUANTITE_INVALIDE',
      { unite, proposition: String(proposee), zeroAccepte: false },
      { champ, valeurProposee: proposee },
    );
  }
  return signaler('ERR_QUANTITE_INVALIDE', { unite, zeroAccepte: false }, { champ });
}

/**
 * Total d'une ligne selon l'unité :
 *   piece → quantité × prix unitaire
 *   kg    → grammes × prix au kilo, arrondi half-up au centime (LOI 2)
 */
export function totalLigne(unite: Unite, quantite: number, prixCentimes: number): Resultat<number> {
  const q = validerQuantite(unite, quantite);
  if (!q.ok) return q;
  if (!Number.isSafeInteger(prixCentimes) || prixCentimes <= 0) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'prix' }, { champ: 'prixCentimes' });
  }
  return succes(unite === 'kg' ? prixAuPoids(quantite, prixCentimes) : multiplier(quantite, prixCentimes));
}

/**
 * Lecture du pavé décimal d'un produit au kilo : « 0,750 », « 0.75 », « 1,2 kg »
 * → grammes entiers (750, 750, 1200), sans flottant. Au plus 3 décimales
 * (le gramme). Zéro accepté ici (un rayon vide se pèse 0) : c'est l'appelant
 * (commande / inventaire) qui exige > 0 ou ≥ 0.
 */
export function lirePoids(texte: string, champ = 'quantite'): Resultat<number> {
  const nettoye = String(texte ?? '')
    .replace(/\s/g, '')
    .replace(/kg$/i, '');
  const m = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(nettoye);
  if (!m) return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'poids' }, { champ });
  const grammes = Number(m[1]) * GRAMMES_PAR_KG + Number((m[2] ?? '').padEnd(3, '0'));
  if (!Number.isSafeInteger(grammes)) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'poids' }, { champ });
  }
  return succes(grammes);
}

/** Lecture d'un nombre de pièces : entier sans décimale (« 12 »). Zéro accepté ici. */
export function lirePieces(texte: string, champ = 'quantite'): Resultat<number> {
  const nettoye = String(texte ?? '').replace(/\s/g, '');
  if (!/^\d+$/.test(nettoye) || !Number.isSafeInteger(Number(nettoye))) {
    return signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'quantité' }, { champ });
  }
  return succes(Number(nettoye));
}

/** Affichage d'une quantité avec son unité : « 12 » pour des pièces, « 0,750 kg » pour 750 g. */
export function formaterQuantite(unite: Unite, quantite: number): string {
  if (unite === 'piece') return String(quantite);
  const g = Math.abs(quantite) % GRAMMES_PAR_KG;
  const kg = (Math.abs(quantite) - g) / GRAMMES_PAR_KG;
  return `${quantite < 0 ? '-' : ''}${kg},${String(g).padStart(3, '0')} kg`;
}
