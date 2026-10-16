'use client';

// src/components/saisie/DispositionAvecPave.tsx
//
// « Sur cet écran, l'employé doit pouvoir faire défiler la liste sans jamais
// perdre le pavé de vue. »
//
// Tablette (≥ 640 px) : deux colonnes. Le contenu défile ; le pavé est
// collant (sticky), toujours visible, dans SA colonne — il ne recouvre jamais
// le contenu. Côté du pouce : préférence `cotePave` (droitier par défaut).
//
// Téléphone (< 640 px) : le pavé est un panneau fixé en bas. Le contenu reçoit
// une marge basse égale à la hauteur réelle du panneau (mesurée), et la page
// un `scroll-padding-bottom` identique, pour que la ligne active amenée à
// l'écran (`scrollIntoView`) ne finisse pas sous le pavé.
//
// `pave === null` → le contenu prend toute la largeur, aucune marge.
// Les pavés placés ici sont compacts par défaut (contexte), sauf `taille` explicite.

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useCotePave, type CotePave } from '@/lib/preferencesSaisie';
import { ContexteTaillePave } from './taillePave';

export type PropsDispositionAvecPave = {
  /** Le pavé (ou tout panneau de saisie). null → contenu pleine largeur. */
  pave: ReactNode | null;
  /** Contenu qui défile (liste de produits, formulaire…). */
  children: ReactNode;
  /** Côté du pavé. Défaut : préférence de l'appareil (`useCotePave`, droite). */
  cote?: CotePave;
};

const REQUETE_ETROIT = '(max-width: 639.98px)';

function abonnerLargeur(rappel: () => void) {
  const mq = window.matchMedia(REQUETE_ETROIT);
  mq.addEventListener('change', rappel);
  return () => mq.removeEventListener('change', rappel);
}

/** Barre de navigation collante (`data-barre-navigation`, BarreNavigation.tsx). */
const SELECTEUR_BARRE = '[data-barre-navigation]';
/** Espace entre la barre (ou le haut de l'écran) et le pavé collant, en px. */
const ECART_HAUT_PX = 16;

function estEtroit() {
  return window.matchMedia(REQUETE_ETROIT).matches;
}

export function DispositionAvecPave({ pave, children, cote }: PropsDispositionAvecPave) {
  const [cotePrefere] = useCotePave();
  const coteEffectif = cote ?? cotePrefere;
  const gauche = coteEffectif === 'gauche';
  const avecPave = pave !== null && pave !== undefined;

  const panneau = useRef<HTMLElement>(null);
  const [hauteurPanneau, setHauteurPanneau] = useState(0);
  // Largeur de l'écran : seulement pour la marge basse (la mise en page elle-même est en CSS).
  const etroit = useSyncExternalStore(abonnerLargeur, estEtroit, () => false);

  // Hauteur réelle du panneau (elle change avec le pavé affiché : kg, entier, valider…).
  // Le ResizeObserver rappelle aussi une première fois dès l'observation.
  useEffect(() => {
    const el = panneau.current;
    if (!avecPave || !el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => setHauteurPanneau(el.getBoundingClientRect().height));
    obs.observe(el);
    return () => obs.disconnect();
  }, [avecPave]);

  // Hauteur de la barre de navigation collante : le pavé collant se cale dessous,
  // jamais dessous elle (elle change si les onglets passent sur deux lignes).
  const [hauteurBarre, setHauteurBarre] = useState(0);
  useEffect(() => {
    const barre = document.querySelector<HTMLElement>(SELECTEUR_BARRE);
    if (!avecPave || !barre || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => setHauteurBarre(barre.getBoundingClientRect().height));
    obs.observe(barre);
    return () => obs.disconnect();
  }, [avecPave]);

  const margeBasse = avecPave && etroit ? Math.ceil(hauteurPanneau) : 0;

  // La ligne active amenée à l'écran par le navigateur s'arrête au-dessus du panneau.
  useEffect(() => {
    if (margeBasse === 0) return;
    const racine = document.documentElement;
    const precedent = racine.style.scrollPaddingBottom;
    racine.style.scrollPaddingBottom = `${margeBasse}px`;
    return () => {
      racine.style.scrollPaddingBottom = precedent;
    };
  }, [margeBasse]);

  if (!avecPave) return <div className="min-w-0">{children}</div>;

  const style: CSSProperties = margeBasse > 0 ? { paddingBottom: margeBasse } : {};
  // Tablette uniquement : au téléphone, le panneau est fixé en bas (pas de `top`).
  const hautCollant = Math.ceil(hauteurBarre) + ECART_HAUT_PX;
  const styleAside: CSSProperties = etroit
    ? {}
    : { top: hautCollant, maxHeight: `calc(100dvh - ${hautCollant + ECART_HAUT_PX}px)` };

  return (
    <div className={`flex min-w-0 items-start gap-4 ${gauche ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
      <div className="min-w-0 flex-1" style={style}>
        {children}
      </div>

      <aside
        ref={panneau}
        style={styleAside}
        aria-label="Pavé de saisie"
        className={[
          // Téléphone : panneau fixé en bas, collé du côté du pouce.
          'fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-line-fort bg-surface px-3 pt-2',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgb(0_0_0/0.08)]',
          gauche ? 'justify-start' : 'justify-end',
          // Tablette : colonne collante à côté du contenu, toujours visible.
          'sm:sticky sm:top-4 sm:inset-x-auto sm:bottom-auto sm:z-auto sm:max-h-[calc(100dvh-2rem)] sm:w-72 sm:shrink-0 lg:w-80',
          'sm:overflow-y-auto sm:rounded-2xl sm:border-2 sm:p-3 sm:shadow-none',
        ].join(' ')}
      >
        <div className="w-full max-w-xs sm:max-w-none">
          <ContexteTaillePave.Provider value="compact">{pave}</ContexteTaillePave.Provider>
        </div>
      </aside>
    </div>
  );
}
