// src/components/signalement/trier.ts
//
// Ordre d'affichage d'une liste de signalements : bloquants d'abord (c'est ce
// qui empêche d'avancer), puis avertissements, puis informations. Ordre
// d'arrivée conservé à niveau égal. Doublons (même code + même champ) retirés :
// le premier gagne. Fonction pure.

import type { Avertissement, Echec, Information, Niveau } from '@/domaine/resultat';

export type SignalementAffichable = Echec | Avertissement | Information;

const RANG: Record<Niveau, number> = { bloquant: 0, avertissement: 1, information: 2 };

export function cleSignalement(s: { code: string; champ?: string }): string {
  return `${s.code}|${s.champ ?? ''}`;
}

export function trierSignalements<S extends SignalementAffichable>(liste: readonly S[]): S[] {
  const vus = new Set<string>();
  const uniques: S[] = [];
  for (const s of liste) {
    const k = cleSignalement(s);
    if (vus.has(k)) continue;
    vus.add(k);
    uniques.push(s);
  }
  // Array.prototype.sort est stable : l'ordre d'arrivée est conservé à rang égal.
  return uniques.sort((a, b) => RANG[a.niveau] - RANG[b.niveau]);
}
