// src/components/rappels/memoire.ts
//
// Mémoire LOCALE des rappels déjà vus, best-effort : si le stockage est
// indisponible (navigation privée, quota, rendu serveur), on continue sans
// mémoire. Aucun réseau, aucune synchronisation : ce n'est pas une donnée
// métier, juste un confort pour ne pas revoir le même rappel trois fois.

import { noterVu } from './rappels';

const CLE = 'pp.rappels.vus';

export function lireVus(): string[] {
  try {
    const brut = globalThis.localStorage?.getItem(CLE);
    if (!brut) return [];
    const v: unknown = JSON.parse(brut);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function memoriserVu(id: string): void {
  try {
    globalThis.localStorage?.setItem(CLE, JSON.stringify(noterVu(lireVus(), id)));
  } catch {
    // Stockage indisponible : sans conséquence.
  }
}
