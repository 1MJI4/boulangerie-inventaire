'use client';

// src/components/inventaire/hauteurEcran.ts
//
// « On veut scroller le moins possible. » (retour du propriétaire, tablette)
//
// Sur tablette (≥ 640 px), l'écran de comptage tient dans la hauteur de
// l'écran : la PAGE ne défile pas, seule la liste défile dans son cadre. Ce
// hook donne la hauteur disponible sous le haut de l'élément `ref` (barre de
// navigation et titre au-dessus, marge basse de <main> en dessous).
//
// Pas de boucle de mesure : la hauteur appliquée ne change jamais la position
// du HAUT de l'élément, seule chose mesurée.
//
// null → pas de contrainte (téléphone, ou écran trop bas pour une liste
// utile : la page défile comme avant).
// Propriétaire : `inventaire-scan`.

import { useEffect, useState, type RefObject } from 'react';

const REQUETE_TABLETTE = '(min-width: 640px)';
/** En dessous, une liste encadrée serait trop petite : on laisse la page défiler. */
const HAUTEUR_MINIMALE_PX = 360;

/** Longueur CSS en pixels (« 32px » → 32). Mise en page, pas un montant. */
const pixels = (valeur: string): number => Number(valeur.replace('px', '')) || 0;

export function useHauteurSansDefilementPage(ref: RefObject<HTMLElement | null>, actif: boolean): number | null {
  const [hauteur, setHauteur] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!actif || !el) return;
    const mesurer = () => {
      if (!window.matchMedia(REQUETE_TABLETTE).matches) {
        setHauteur(null);
        return;
      }
      const haut = el.getBoundingClientRect().top + window.scrollY;
      const main = el.closest('main');
      const basMain = main ? pixels(getComputedStyle(main).paddingBottom) : 0;
      const disponible = Math.floor(window.innerHeight - haut - basMain);
      setHauteur(disponible >= HAUTEUR_MINIMALE_PX ? disponible : null);
    };
    window.addEventListener('resize', mesurer);
    // Ce qui est AU-DESSUS peut changer de hauteur (titre sur deux lignes, barre de navigation) :
    // toute variation de la page relance la mesure (même valeur → aucun rendu).
    // L'observateur mesure aussi une première fois dès l'observation.
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer);
    obs?.observe(document.body);
    return () => {
      window.removeEventListener('resize', mesurer);
      obs?.disconnect();
    };
  }, [ref, actif]);

  return actif ? hauteur : null;
}
