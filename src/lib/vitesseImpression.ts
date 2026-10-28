// src/lib/vitesseImpression.ts
//
// La vitesse de l'imprimante, apprise sur cette tablette : millisecondes par
// ligne de points, du moment où l'imprimante prend les tickets à sa
// confirmation. Sert à caler l'animation de l'écran sur le vrai papier.
//
// Une moyenne glissante : une impression plus lente (papier qui coince) ne
// fausse pas tout, et la vitesse suit l'imprimante si on la change.

const CLE = 'impression:ms-par-ligne';

/** Point de départ avant toute mesure : ~1,2 s pour un ticket de 1 000 lignes. */
export const MS_PAR_LIGNE_DEFAUT = 1.2;
const MIN = 0.2;
const MAX = 12;
/** Poids de la dernière mesure dans la moyenne. */
const POIDS_MESURE = 0.4;

const borner = (v: number) => Math.min(MAX, Math.max(MIN, v));

export function lireMsParLigne(): number {
  try {
    const v = Number(window.localStorage.getItem(CLE));
    return Number.isFinite(v) && v > 0 ? borner(v) : MS_PAR_LIGNE_DEFAUT;
  } catch {
    return MS_PAR_LIGNE_DEFAUT;
  }
}

/** Moyenne glissante entre l'ancienne vitesse et la mesure (pure, testée). */
export function moyenneVitesse(ancienne: number, dureeMs: number, lignes: number): number {
  if (!(dureeMs > 0) || !(lignes > 0)) return ancienne;
  return borner((1 - POIDS_MESURE) * ancienne + POIDS_MESURE * (dureeMs / lignes));
}

export function apprendreVitesse(dureeMs: number, lignes: number): void {
  try {
    window.localStorage.setItem(CLE, String(moyenneVitesse(lireMsParLigne(), dureeMs, lignes)));
  } catch {
    // Stockage indisponible : l'animation garde la vitesse par défaut.
  }
}
