'use client';

import type { ReactNode } from 'react';
import type { Densite, Main } from '@/lib/preferencesSaisie';

/**
 * Une ligne de saisie, partagée par le comptage, la production et les prévisions.
 *
 * Le point important est visuel : un champ vide (« pas encore compté ») et un
 * champ à 0 (« il n'en reste plus ») ne se ressemblent pas. Sans cette
 * distinction, impossible de savoir ce qu'il reste à faire.
 *
 * Deux variantes :
 *   - « ligne » : une par rangée, nom à côté des cibles ;
 *   - « carte » : pour la grille à deux ou trois colonnes, le nom passe
 *     au-dessus des cibles — sur une colonne étroite il n'y a plus la place
 *     de le mettre à côté sans tout tronquer.
 *
 * Pour un usage à une main, la disposition se retourne : les cibles tactiles
 * passent du côté du pouce.
 */
export function LigneSaisie({
  nom,
  valeur,
  onChange,
  indice,
  suggestion,
  onAppliquerSuggestion,
  autoFocus,
  densite = 'confortable',
  main = 'droite',
  modePave = false,
  selectionne = false,
  onSelectionner,
  variante = 'ligne',
}: {
  nom: string;
  valeur: string;
  onChange: (valeur: string) => void;
  indice?: ReactNode;
  suggestion?: number | null;
  onAppliquerSuggestion?: () => void;
  autoFocus?: boolean;
  densite?: Densite;
  main?: Main;
  modePave?: boolean;
  selectionne?: boolean;
  onSelectionner?: () => void;
  variante?: 'ligne' | 'carte';
}) {
  const rempli = valeur !== '';
  const zero = valeur === '0';
  const compact = densite === 'compact';
  const carte = variante === 'carte';
  const gaucher = main === 'gauche';

  const tailleCible = compact ? 'h-9 w-9' : 'h-11 w-11';
  const hauteurChamp = compact ? 'h-9' : 'h-11';
  // En carte le champ s'étire pour offrir une grande cible au doigt, mais
  // borné : sur une carte large, un champ de 280 px pour trois chiffres se lit
  // comme une zone de texte, pas comme une quantité.
  const largeurChamp = carte
    ? 'flex-1 min-w-0 max-w-[9rem]'
    : compact
      ? 'w-16'
      : 'w-20';

  const classesConteneur = carte
    ? `ligne-impression flex flex-col justify-between rounded-lg border transition-colors ${
        compact ? 'gap-1.5 p-2' : 'gap-2 p-2.5'
      } ${selectionne ? 'border-accent bg-accent-doux/60' : 'border-line bg-surface'}`
    : `ligne-impression flex items-center border-b border-line last:border-b-0 has-[input:focus]:bg-surface-2 ${
        compact ? 'gap-2 px-3 py-1.5' : 'gap-3 px-4 py-2.5'
      } ${gaucher ? 'flex-row-reverse' : ''} ${selectionne ? 'bg-accent-doux/60' : ''}`;

  return (
    <div className={classesConteneur}>
      <div
        className={`min-w-0 ${carte ? '' : 'flex-1'} ${gaucher && !carte ? 'text-right' : ''}`}
      >
        <div
          className={`text-ink ${carte ? 'line-clamp-2 leading-snug' : 'truncate'} ${
            compact ? 'text-sm' : 'text-[15px]'
          }`}
          title={nom}
        >
          {nom}
        </div>
        {indice && !compact ? <div className="mt-0.5 text-xs text-ink-3">{indice}</div> : null}
      </div>

      <div
        className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'} ${
          gaucher ? 'flex-row-reverse' : ''
        } ${carte ? '' : 'shrink-0'}`}
      >
        {suggestion != null && !rempli && onAppliquerSuggestion && !carte ? (
          <button
            type="button"
            onClick={onAppliquerSuggestion}
            className="sans-impression chiffres hidden shrink-0 rounded-md border border-dashed border-line-fort px-2.5 py-1 text-xs text-ink-3 hover:border-accent hover:text-accent sm:block"
            title={`Reprendre ${suggestion}`}
          >
            {suggestion}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onChange(zero ? '' : '0')}
          aria-pressed={zero}
          aria-label={zero ? `Annuler le zéro pour ${nom}` : `${nom} : épuisé`}
          className={`sans-impression shrink-0 rounded-lg border text-sm font-medium transition-colors ${tailleCible} ${
            zero
              ? 'border-accent bg-accent-doux text-accent'
              : 'border-line text-ink-3 hover:border-line-fort hover:text-ink-2'
          }`}
        >
          0
        </button>

        <input
          type="text"
          inputMode={modePave ? 'none' : 'numeric'}
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus={autoFocus}
          readOnly={modePave}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            if (modePave) e.currentTarget.blur();
            else e.currentTarget.select();
          }}
          onClick={onSelectionner}
          placeholder="—"
          aria-label={nom}
          className={`chiffres rounded-lg border text-center transition-colors placeholder:text-ink-3 focus:border-accent focus:outline-none ${hauteurChamp} ${largeurChamp} ${
            compact ? 'text-sm' : 'text-base'
          } ${
            selectionne
              ? 'border-accent bg-surface font-medium text-ink ring-2 ring-accent/30'
              : rempli
                ? 'border-line-fort bg-surface font-medium text-ink'
                : 'border-line bg-surface-2 text-ink-2'
          }`}
        />
      </div>
    </div>
  );
}
