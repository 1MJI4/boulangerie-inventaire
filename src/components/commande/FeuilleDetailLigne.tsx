'use client';

// src/components/commande/FeuilleDetailLigne.tsx
//
// TÉLÉPHONE uniquement (propriétaire, 21/11/2026) : quand un produit demande plus de
// détails (taille, nombre de personnes, goût, viande…), une feuille s'ouvre par-dessus
// l'écran des produits et montre seulement ce qu'il faut. « OK » la referme ; la ligne
// reste ensuite dans la bande au-dessus du total, d'où on la rouvre d'un toucher.
//
// La feuille ne contient que les réglages déjà existants de la ligne (`LigneDuBon`) :
// aucune règle ici. Quand le pavé numérique est ouvert (panneau fixé en bas, z-30), la
// feuille passe derrière et garde sa marge basse égale à la hauteur du pavé pour que le
// champ en cours reste visible.

import { useEffect, useState, type ReactNode } from 'react';
import { Bouton } from '@/components/ui';

const SELECTEUR_PAVE = 'aside[aria-label="Pavé de saisie"]';

/** Hauteur du pavé fixé en bas (0 s'il est fermé). */
function useHauteurPave(paveOuvert: boolean): number {
  const [hauteur, setHauteur] = useState(0);
  useEffect(() => {
    if (!paveOuvert) return;
    const el = document.querySelector<HTMLElement>(SELECTEUR_PAVE);
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => setHauteur(Math.ceil(el.getBoundingClientRect().height)));
    obs.observe(el);
    return () => obs.disconnect();
  }, [paveOuvert]);
  return paveOuvert ? hauteur : 0;
}

export function FeuilleDetailLigne({
  titre,
  paveOuvert,
  onOk,
  children,
}: {
  /** Nom du produit réglé. */
  titre: string;
  paveOuvert: boolean;
  onOk: () => void;
  children: ReactNode;
}) {
  const hautPave = useHauteurPave(paveOuvert);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Détails : ${titre}`}
      // Derrière le pavé (z-30) quand il est ouvert, devant la barre du bas sinon.
      className={`fixed inset-0 ${paveOuvert ? 'z-20' : 'z-40'} flex items-end bg-black/40`}
    >
      <div
        className="flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-surface shadow-xl"
        style={{ marginBottom: hautPave }}
      >
        <div className="flex-none px-4 pb-1 pt-3">
          <p className="truncate text-base font-semibold text-ink">{titre}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">{children}</div>
        <div className="flex-none border-t border-line px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <Bouton variante="principal" className="min-h-12 w-full text-lg" onClick={onOk}>
            OK
          </Bouton>
        </div>
      </div>
    </div>
  );
}
