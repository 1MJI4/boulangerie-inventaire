'use client';

// src/components/inventaire/PaveSaisieProduit.tsx
//
// Pavé de saisie de la quantité d'UN produit d'inventaire.
// Propriétaire : `inventaire-scan`.
//
// Il ne se positionne PAS lui-même : l'écran le place dans
// `DispositionAvecPave` (design-ux) — colonne collante à côté de la liste sur
// tablette, panneau bas sur téléphone, taille « compact ». La liste reste
// visible et la ligne active est amenée en vue (`ligneActive.ts`).
//
// Enchaînement : « Valider » ou Entrée (clavier, lecteur) passe au produit
// suivant. Le focus est posé sur l'afficheur du pavé à chaque produit pour
// que la touche Entrée d'un clavier physique arrive ici — sauf si l'employé
// est en train de taper ailleurs (recherche).
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

import { useEffect, useRef, useState } from 'react';
import { SaisieQuantite } from '@/components/saisie';
import type { Unite } from '@/domaine/types';

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
  /** Absent (comptage plein écran : le pavé reste toujours ouvert) → pas de bouton « Fermer ». */
  onFermer?: () => void;
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
}: PropsPaveSaisieProduit) {
  const [ajout, setAjout] = useState<number | null>(null);
  const racine = useRef<HTMLDivElement>(null);

  // Nouveau produit → focus sur l'afficheur (div, jamais d'<input> : pas de
  // clavier système). On ne vole pas le focus d'un champ en cours de frappe.
  useEffect(() => {
    const actif = document.activeElement;
    if (actif instanceof HTMLInputElement || actif instanceof HTMLTextAreaElement) {
      if (!actif.readOnly) return;
    }
    racine.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus({ preventScroll: true });
  }, [produit.id]);

  const enAjout = typeof onAjouter === 'function';

  const courante = enAjout ? ajout : versNombre(valeur);
  const changer = (n: number | null) => (enAjout ? setAjout(n) : onChange(versTexte(n)));
  const valider = (n: number) => {
    if (onAjouter) {
      onAjouter(n);
      return;
    }
    if (onSuivant && peutAllerSuivant) onSuivant();
    else onFermer?.();
  };
  const libelleValider = enAjout ? 'Ajouter au comptage' : peutAllerSuivant ? 'Valider · suivant' : 'Valider';

  return (
    <div
      ref={racine}
      role="region"
      aria-label={`Saisie de ${produit.nom}`}
      // LOI 5 : le nom s'affiche EN ENTIER dans l'en-tête du pavé (jamais « Pain marocai… »).
      // Le libellé du pavé compact (`CadrePave`, design-ux) est tronqué par défaut : on le
      // laisse passer sur deux lignes et on lui donne la place (afficheur à sa largeur).
      // Police réduite seulement pour les noms longs.
      className={`sans-impression w-full [&_div:has(>div[title])]:grid-cols-[minmax(0,1fr)_auto] [&_div[title]]:whitespace-normal [&_div[title]]:break-words ${
        produit.nom.length > 22 ? '[&_div[title]]:text-sm' : ''
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {onFermer ? (
          <button
            type="button"
            onClick={onFermer}
            className="min-h-11 rounded-lg border border-line px-3 text-sm text-ink-2 hover:border-line-fort hover:text-ink"
          >
            Fermer
          </button>
        ) : (
          <span aria-hidden />
        )}
        {onSuivant && !enAjout ? (
          <button
            type="button"
            onClick={onSuivant}
            disabled={!peutAllerSuivant}
            className="min-h-11 rounded-lg border border-line px-3 text-sm text-ink-2 hover:border-line-fort hover:text-ink disabled:opacity-40"
          >
            Passer ›
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
      {sousTitre ? <p className="mt-1.5 text-center text-sm text-ink-2">{sousTitre}</p> : null}
    </div>
  );
}
