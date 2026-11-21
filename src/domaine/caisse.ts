// src/domaine/caisse.ts
//
// Comptage de la Glory (monnayeur du comptoir) : combien de pièces et de
// billets il y a dans la machine, coupure par coupure (demande du
// propriétaire, 17/11/2026 — page de test à part, avant de décider où la mettre).
//
// Les coupures sont celles de l'euro, pas des prix : elles ne viennent pas du
// catalogue. Tous les montants en centimes, calculés avec les helpers d'argent.
// Fonctions pures, sans écran ni base.
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import { formaterEuros, multiplier, somme } from './argent.ts';

/** Coupures comptées, en centimes, dans l'ordre de la feuille : pièces puis billets. */
export const COUPURES_CENTIMES: readonly number[] = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/** Plus petite coupure en billet (cinq euros) : en dessous, c'est une pièce. */
const PREMIER_BILLET = COUPURES_CENTIMES[6];

export type NatureCoupure = 'piece' | 'billet';

export function natureCoupure(coupureCentimes: number): NatureCoupure {
  return coupureCentimes >= PREMIER_BILLET ? 'billet' : 'piece';
}

/** « 5 cents » sous l'euro, sinon le montant en euros sans les centimes : comme au comptoir. */
export function libelleCoupure(coupureCentimes: number): string {
  if (coupureCentimes < 100) return `${coupureCentimes} cents`;
  return formaterEuros(coupureCentimes).replace(',00', '');
}

/** Nombre de pièces / billets par coupure ; absent ou null = pas encore compté. */
export type ComptageCaisse = Readonly<Record<number, number | null | undefined>>;

export type TotauxCaisse = {
  /** Montant par coupure (centimes), dans l'ordre de COUPURES_CENTIMES ; null si non compté. */
  parCoupure: readonly { coupure: number; nombre: number | null; montant: number | null }[];
  totalPieces: number;
  totalBillets: number;
  total: number;
  /** Coupures encore vides (le total ne les compte pas). */
  nonComptees: readonly number[];
};

/**
 * Totaux du comptage. Un nombre qui n'est pas un entier positif ou nul est
 * refusé (RangeError) : l'écran ne laisse taper que des chiffres.
 */
export function totauxCaisse(comptage: ComptageCaisse): TotauxCaisse {
  const parCoupure = COUPURES_CENTIMES.map((coupure) => {
    const nombre = comptage[coupure] ?? null;
    if (nombre !== null && (!Number.isSafeInteger(nombre) || nombre < 0)) {
      throw new RangeError(`caisse.ts : nombre invalide pour ${libelleCoupure(coupure)}.`);
    }
    return { coupure, nombre, montant: nombre === null ? null : multiplier(nombre, coupure) };
  });
  const montants = (nature: NatureCoupure) =>
    parCoupure.filter((l) => natureCoupure(l.coupure) === nature && l.montant !== null).map((l) => l.montant as number);
  const totalPieces = somme(montants('piece'));
  const totalBillets = somme(montants('billet'));
  return {
    parCoupure,
    totalPieces,
    totalBillets,
    total: somme([totalPieces, totalBillets]),
    nonComptees: parCoupure.filter((l) => l.nombre === null).map((l) => l.coupure),
  };
}
