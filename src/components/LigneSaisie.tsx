'use client';

import type { ReactNode } from 'react';
import type { Densite, Main } from '@/lib/preferencesSaisie';
import type { Unite } from '@/domaine/types';
import { formaterQuantite } from '@/domaine/unites';

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
 *
 * LOI 2 : un produit au kilo (`unite="kg"`) a une valeur en GRAMMES, affichée
 * en kg ; son champ ne se tape jamais au clavier — toucher la ligne ouvre le
 * pavé décimal (`onSelectionner`). Jamais de « +1 » pour un produit au kilo.
 * Les contrôles (refus, avertissements) arrivent déjà rendus par
 * <Signalement> dans `signalements`.
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
  signalements,
  complement,
  unite = 'piece',
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
  /** Signalements de la ligne (refus, avertissements), rendus par <Signalement>. */
  signalements?: ReactNode;
  /** Unité du produit (LOI 2) : 'kg' → valeur en grammes, saisie au pavé décimal. */
  unite?: Unite;
  /**
   * Un second champ, plus petit, à côté du premier. Sert à distinguer ce qui
   * sort normalement du four de ce qu'une commande client ajoute — le « 1 + 11 »
   * des anciennes feuilles.
   */
  complement?: {
    valeur: string;
    onChange: (valeur: string) => void;
    titre: string;
  };
}) {
  const rempli = valeur !== '';
  const zero = valeur === '0';
  const compact = densite === 'compact';
  const carte = variante === 'carte';
  const gaucher = main === 'gauche';
  const auPoids = unite === 'kg';
  // Un produit au kilo se saisit toujours au pavé décimal, jamais au clavier.
  const viaPave = modePave || auPoids;
  const affichee = auPoids && rempli ? formaterQuantite('kg', Number(valeur)) : valeur;

  const tailleCible = compact ? 'h-9 w-9' : 'h-11 w-11';
  const hauteurChamp = compact ? 'h-9' : 'h-11';
  // En carte le champ s'étire pour offrir une grande cible au doigt, mais
  // borné : sur une carte large, un champ de 280 px pour trois chiffres se lit
  // comme une zone de texte, pas comme une quantité.
  const largeurChamp = carte
    ? 'flex-1 min-w-0 max-w-[9rem]'
    : auPoids
      ? compact
        ? 'w-24'
        : 'w-28' // « 12,345 kg » doit tenir sans être coupé
      : compact
        ? 'w-16'
        : 'w-20';

  const classesConteneur = carte
    ? `ligne-impression flex flex-col justify-between rounded-lg border transition-colors ${
        compact ? 'gap-1.5 p-2' : 'gap-2 p-2.5'
      } ${selectionne ? 'border-accent bg-accent-doux/60' : 'border-line bg-surface'}`
    : `ligne-impression border-b border-line last:border-b-0 has-[input:focus]:bg-surface-2 ${
        selectionne ? 'bg-accent-doux/60' : ''
      }`;
  const classesRangee = carte
    ? 'contents'
    : `flex items-center ${compact ? 'gap-2 px-3 py-1.5' : 'gap-3 px-4 py-2.5'} ${gaucher ? 'flex-row-reverse' : ''}`;

  return (
    <div className={classesConteneur}>
      <div className={classesRangee}>
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
        {indice && !compact ? (
          <div className="mt-0.5 text-xs text-ink-3">{indice}</div>
        ) : null}
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
          inputMode={viaPave ? 'none' : 'numeric'}
          pattern={auPoids ? undefined : '[0-9]*'}
          autoComplete="off"
          autoFocus={autoFocus && !viaPave}
          readOnly={viaPave}
          value={affichee}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            if (viaPave) e.currentTarget.blur();
            else e.currentTarget.select();
          }}
          onClick={onSelectionner}
          placeholder={auPoids ? '— kg' : '—'}
          aria-label={auPoids ? `${nom}, poids en kg` : nom}
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

        {complement ? (
          <>
            <span aria-hidden className="shrink-0 text-sm text-ink-3">
              +
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={complement.valeur}
              onChange={(e) => complement.onChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0"
              aria-label={complement.titre}
              title={complement.titre}
              className={`chiffres shrink-0 rounded-lg border text-center transition-colors placeholder:text-ink-3 focus:border-accent focus:outline-none ${hauteurChamp} ${
                compact ? 'w-12 text-sm' : 'w-14 text-base'
              } ${
                complement.valeur !== '' && complement.valeur !== '0'
                  ? 'border-accent bg-accent-doux font-medium text-accent'
                  : 'border-dashed border-line bg-surface-2 text-ink-3'
              }`}
            />
          </>
        ) : null}
      </div>
      </div>
      {signalements ? (
        <div className={`sans-impression ${carte ? '' : compact ? 'px-3 pb-2' : 'px-4 pb-3'}`}>{signalements}</div>
      ) : null}
    </div>
  );
}
