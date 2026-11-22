// src/domaine/rayonsPrevisions.ts
//
// Réglage du gérant (22/11/2026) : quels RAYONS (Viennoiserie, Pains, Salé…)
// sont proposés sur l'écran des prévisions. Un rayon masqué n'est qu'un
// affichage : ses quantités déjà saisies ne sont ni effacées ni comptées en
// moins. Au moins un rayon reste visible.

import { signaler } from './messages.ts';
import { succes, type Resultat } from './resultat.ts';

/** Liste de rayons masqués : sans doublon, uniquement des rayons connus, jamais tous. */
export function validerRayonsMasques(valeur: unknown, connus: readonly string[]): Resultat<string[]> {
  const refus = () => signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'rayons des prévisions' }, { champ: 'masques' });
  if (!Array.isArray(valeur) || valeur.some((v) => typeof v !== 'string')) return refus();
  const uniques = [...new Set(valeur as string[])];
  if (uniques.some((v) => !connus.includes(v))) return refus();
  if (connus.length > 0 && uniques.length >= connus.length) return refus();
  return succes(uniques);
}

/** Lecture tolérante de la valeur stockée : illisible = rien de masqué (on affiche tout). */
export function lireRayonsMasques(brut: string | null | undefined): string[] {
  if (!brut) return [];
  try {
    const j: unknown = JSON.parse(brut);
    return Array.isArray(j) ? j.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
