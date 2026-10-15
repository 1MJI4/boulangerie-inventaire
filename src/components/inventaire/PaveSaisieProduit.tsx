'use client';

// src/components/inventaire/PaveSaisieProduit.tsx
//
// Pavé ancré en bas d'écran pour saisir la quantité d'UN produit d'inventaire.
// Propriétaire : `inventaire-scan`.
//
// LOI 2 : le pavé est choisi par l'unité DU PRODUIT (`SaisieQuantite`) :
//   - pièce → pavé entier (contexte « inventaire » : 0 accepté) ;
//   - kg    → pavé décimal, poids lu sur la balance, valeur en GRAMMES.
// Jamais de « +1 » pour un produit au kilo.
//
// Deux usages :
//   - saisie directe : la valeur de la ligne se modifie à chaque touche ;
//   - recomptage (`onAjouter`) : le produit a déjà été compté, ce qui est
//     tapé s'AJOUTE au premier comptage (addition par le domaine, R21).
//
// La valeur échangée avec l'écran est le texte de la ligne (entier en
// pièces ou en grammes, '' = pas encore compté).

import { useState } from 'react';
import { SaisieQuantite } from '@/components/saisie';
import type { Unite } from '@/domaine/types';
import type { Main } from '@/lib/preferencesSaisie';

export type PropsPaveSaisieProduit = {
  produit: { id: number; nom: string; unite: Unite };
  /** Texte de la ligne (pièces ou grammes), '' = pas encore compté. */
  valeur: string;
  onChange: (valeur: string) => void;
  /** Recomptage : ce qui est tapé s'ajoute (la ligne n'est pas modifiée avant validation). */
  onAjouter?: (quantite: number) => void;
  /** Ligne d'aide sous le nom (« Déjà compté : 12 pièces »). */
  sousTitre?: string;
  onSuivant?: () => void;
  peutAllerSuivant?: boolean;
  onFermer: () => void;
  main?: Main;
};

const versNombre = (v: string): number | null => (v === '' ? null : Number(v));
const versTexte = (n: number | null): string => (n === null ? '' : String(n));

export function PaveSaisieProduit({
  produit,
  valeur,
  onChange,
  onAjouter,
  sousTitre,
  onSuivant,
  peutAllerSuivant = false,
  onFermer,
  main = 'droite',
}: PropsPaveSaisieProduit) {
  const [ajout, setAjout] = useState<number | null>(null);
  const enAjout = typeof onAjouter === 'function';

  const courante = enAjout ? ajout : versNombre(valeur);
  const changer = (n: number | null) => (enAjout ? setAjout(n) : onChange(versTexte(n)));
  const valider = (n: number) => {
    if (onAjouter) {
      onAjouter(n);
      return;
    }
    if (onSuivant && peutAllerSuivant) onSuivant();
    else onFermer();
  };
  const libelleValider = enAjout ? 'Ajouter au comptage' : peutAllerSuivant ? 'Valider · suivant' : 'Valider';

  const alignement = main === 'droite' ? 'sm:ml-auto' : 'sm:mr-auto';

  return (
    <div
      role="region"
      aria-label={`Saisie de ${produit.nom}`}
      className="sans-impression fixed inset-x-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto border-t border-line bg-surface shadow-lg"
    >
      <div className={`mx-auto w-full max-w-md px-4 pb-4 pt-3 sm:max-w-md ${alignement}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onFermer}
            className="min-h-11 rounded-lg border border-line px-3 text-sm text-ink-2 hover:border-line-fort hover:text-ink"
          >
            Fermer
          </button>
          {onSuivant && !enAjout ? (
            <button
              type="button"
              onClick={onSuivant}
              disabled={!peutAllerSuivant}
              className="min-h-11 rounded-lg border border-line px-3 text-sm text-ink-2 hover:border-line-fort hover:text-ink disabled:opacity-40"
            >
              Suivant ›
            </button>
          ) : null}
        </div>

        {/* key : un autre produit (ou un autre mode) repart d'un afficheur propre. */}
        {produit.unite === 'kg' ? (
          <SaisieQuantite
            key={`${produit.id}-${enAjout ? 'ajout' : 'saisie'}`}
            unite="kg"
            contexte="inventaire"
            libelle={produit.nom}
            libelleValider={libelleValider}
            grammes={courante}
            onChange={changer}
            onValider={valider}
          />
        ) : (
          <SaisieQuantite
            key={`${produit.id}-${enAjout ? 'ajout' : 'saisie'}`}
            unite="piece"
            contexte="inventaire"
            libelle={produit.nom}
            libelleValider={libelleValider}
            quantite={courante}
            onChange={changer}
            onValider={valider}
          />
        )}
        {sousTitre ? <p className="mt-2 text-center text-sm text-ink-2">{sousTitre}</p> : null}
      </div>
    </div>
  );
}
