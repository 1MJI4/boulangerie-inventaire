'use client';

// src/components/inventaire/pleinEcran.ts
//
// « Il ne faut PAS scroller. Un mode plein écran où tous les éléments pas
// utiles disparaissent ; garder seulement les pages et le pavé. »
// (retour du propriétaire)
//
// Mode plein écran du comptage :
//   - ACTIVÉ PAR DÉFAUT sur tablette (≥ 640 px), jamais au téléphone ;
//   - désactivable d'un geste, choix mémorisé sur l'appareil ;
//   - pose `data-plein-ecran` sur <html> : globals.css masque alors la barre
//     de navigation et réduit les marges de <main> ;
//   - demande aussi le vrai plein écran du navigateur (API Fullscreen) au
//     premier geste — sans échec si c'est refusé ou absent (iPad Safari) :
//     le mode masque quand même les éléments.
//
// `useTailleZone` mesure la zone de la grille (largeur × hauteur) pour le
// calcul pur de `dispositionGrille.ts`.
// Propriétaire : `inventaire-scan`.

import { useEffect, useState, useSyncExternalStore } from 'react';

const REQUETE_TABLETTE = '(min-width: 640px)';
const CLE = 'boulangerie:plein-ecran-comptage';
/** Attribut posé sur <html> (voir globals.css). */
export const ATTRIBUT_PLEIN_ECRAN = 'data-plein-ecran';

/* ------------------------------------------------- Préférence de l'appareil */

const abonnes = new Set<() => void>();
let enSession: boolean | null = null;

function lire(): boolean {
  try {
    return window.localStorage.getItem(CLE) !== 'non';
  } catch {
    return true;
  }
}

function abonner(rappel: () => void) {
  abonnes.add(rappel);
  const mq = window.matchMedia(REQUETE_TABLETTE);
  mq.addEventListener('change', rappel);
  return () => {
    abonnes.delete(rappel);
    mq.removeEventListener('change', rappel);
  };
}

function instantane(): boolean {
  if (enSession === null) enSession = lire();
  return enSession && window.matchMedia(REQUETE_TABLETTE).matches;
}

function definir(actif: boolean) {
  enSession = actif;
  try {
    window.localStorage.setItem(CLE, actif ? 'oui' : 'non');
  } catch {
    /* valable pour la session en cours */
  }
  abonnes.forEach((r) => r());
}

function sortirPleinEcranNavigateur() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  } catch {
    /* API absente : rien à faire */
  }
}

/**
 * `[actif, definir]`. `autorise` = false (mode « un par un », par exemple)
 * neutralise le mode sans toucher à la préférence.
 */
export function usePleinEcranComptage(autorise: boolean): [boolean, (actif: boolean) => void] {
  const prefere = useSyncExternalStore(abonner, instantane, () => false);
  const actif = prefere && autorise;

  // Attribut sur <html> le temps de l'écran : retiré en quittant le comptage.
  useEffect(() => {
    if (!actif) return;
    const racine = document.documentElement;
    racine.setAttribute(ATTRIBUT_PLEIN_ECRAN, '');
    return () => racine.removeAttribute(ATTRIBUT_PLEIN_ECRAN);
  }, [actif]);

  // Vrai plein écran du navigateur au premier geste (exigé par les navigateurs).
  useEffect(() => {
    if (!actif) return;
    const demander = () => {
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && document.fullscreenEnabled && el.requestFullscreen) {
          void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
      } catch {
        /* refusé ou non pris en charge : les éléments restent masqués quand même */
      }
    };
    window.addEventListener('pointerdown', demander, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', demander, { capture: true });
  }, [actif]);

  // Quitter l'écran de comptage rend le navigateur normal.
  useEffect(() => (actif ? sortirPleinEcranNavigateur : undefined), [actif]);

  const changer = (suivant: boolean) => {
    if (!suivant) sortirPleinEcranNavigateur();
    definir(suivant);
  };
  return [actif, changer];
}

/* ------------------------------------------------------- Taille de la zone */

export type TailleZone = { largeur: number; hauteur: number };

/**
 * Largeur × hauteur intérieures de l'élément (null tant que non mesuré ou
 * inactif). Ref « callback » : l'élément peut être remonté (le pavé qui
 * apparaît change l'arbre de `DispositionAvecPave`) — la mesure le suit.
 */
export function useTailleZone(actif: boolean): [(el: HTMLElement | null) => void, TailleZone | null] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [taille, setTaille] = useState<TailleZone | null>(null);
  useEffect(() => {
    if (!actif || !el || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => {
      const largeur = Math.floor(el.clientWidth);
      const hauteur = Math.floor(el.clientHeight);
      setTaille((p) => (p && p.largeur === largeur && p.hauteur === hauteur ? p : { largeur, hauteur }));
    };
    // Première mesure tout de suite (l'observateur n'est rappelé qu'à l'image suivante),
    // puis à chaque changement de taille (rotation, apparition des onglets, du pavé).
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    window.addEventListener('resize', mesurer);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [el, actif]);
  return [setEl, actif ? taille : null];
}
