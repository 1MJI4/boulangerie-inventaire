'use client';

// src/components/inventaire/ligneActive.ts
//
// « Quand le pavé est ouvert, on doit toujours voir la LIGNE COMPLÈTE du
// produit qu'on compte. » (retour du propriétaire, essai sur tablette)
//
// Chaque <LigneSaisie> porte `data-ligne-produit="<id>"`. Ces fonctions
// amènent la ligne active dans la zone visible — au-dessus du panneau du pavé
// sur téléphone (`DispositionAvecPave` règle `scroll-padding-bottom`), sous la
// barre de navigation collante (`scroll-margin-top` de la ligne).
// Défilement doux, sauf si l'appareil demande moins d'animations.
// Propriétaire : `inventaire-scan`.

import { useEffect } from 'react';

const selecteurLigne = (produitId: number) => `[data-ligne-produit="${produitId}"]`;

function mouvementReduit(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Longueur CSS en pixels (« 120px » → 120 ; « auto » → 0). Mise en page, pas un montant. */
const pixels = (valeur: string): number => Number(valeur.replace('px', '')) || 0;

/**
 * La ligne est-elle entièrement visible (marges de défilement comprises) ?
 * Si la liste défile DANS son cadre (`data-defilement-liste`, tablette), on
 * mesure par rapport à ce cadre : une ligne coupée par le bord du cadre n'est
 * pas visible, même si elle est dans la fenêtre.
 */
function entierementVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const cadre = el.closest<HTMLElement>('[data-defilement-liste]');
  if (cadre && cadre.scrollHeight > cadre.clientHeight + 1) {
    const c = cadre.getBoundingClientRect();
    return r.top >= c.top + pixels(style.scrollMarginTop) && r.bottom <= c.bottom - pixels(style.scrollMarginBottom);
  }
  const racine = getComputedStyle(document.documentElement);
  const basLibre = window.innerHeight - pixels(racine.scrollPaddingBottom);
  const hautLibre = pixels(style.scrollMarginTop);
  return r.top >= hautLibre && r.bottom <= basLibre;
}

/** Amène la ligne du produit dans la zone visible, sans à-coup, seulement si nécessaire. */
export function amenerLigneEnVue(produitId: number): void {
  const el = document.querySelector<HTMLElement>(selecteurLigne(produitId));
  if (!el || entierementVisible(el)) return;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: mouvementReduit() ? 'auto' : 'smooth' });
}

/**
 * Donne le focus au champ principal de la ligne (saisie au clavier du
 * téléphone ou au lecteur), puis l'amène en vue.
 */
export function focaliserLigne(produitId: number): void {
  const champ = document.querySelector<HTMLInputElement>(`${selecteurLigne(produitId)} input[data-champ-principal]`);
  champ?.focus({ preventScroll: true });
  amenerLigneEnVue(produitId);
}

/**
 * Tant que `actif`, garde la ligne `produitId` en vue à chaque changement de
 * produit. Deux passages : tout de suite (image suivante), puis une fois le
 * pavé mis en place (sa hauteur n'est connue qu'après son premier affichage).
 */
export function useLigneActiveEnVue(produitId: number | null, actif: boolean): void {
  useEffect(() => {
    if (!actif || produitId === null) return;
    const image = requestAnimationFrame(() => amenerLigneEnVue(produitId));
    const rattrapage = window.setTimeout(() => amenerLigneEnVue(produitId), 250);
    return () => {
      cancelAnimationFrame(image);
      window.clearTimeout(rattrapage);
    };
  }, [produitId, actif]);
}
