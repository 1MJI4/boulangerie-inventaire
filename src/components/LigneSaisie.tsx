'use client';

import type { ReactNode } from 'react';
import type { Densite, Main } from '@/lib/preferencesSaisie';
import type { Unite } from '@/domaine/types';
import { formaterQuantite } from '@/domaine/unites';
import type { Niveau } from '@/domaine/resultat';
import { IconeNiveau, NIVEAUX } from '@/components/signalement';

/**
 * Une ligne de saisie, partagée par le comptage, la production et les prévisions.
 *
 * Le point important est visuel : un champ vide (« pas encore compté ») et un
 * champ à 0 (« il n'en reste plus ») ne se ressemblent pas. Sans cette
 * distinction, impossible de savoir ce qu'il reste à faire.
 *
 * Deux variantes :
 *   - « ligne » : une par rangée, nom à côté des cibles, hauteur réduite
 *     (≈ 56 px confortable, 44 px compact) pour voir un maximum de produits ;
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
 *
 * Grille plein écran du comptage (`hauteurFixe`) : la ligne a une hauteur
 * IMPOSÉE (40 à 80 px, `dispositionGrille.ts`) pour que toute la page tienne
 * sans défilement. Toute la ligne se touche (elle sélectionne le produit et
 * ouvre le pavé ; le bouton « 0 » garde son action seule). Le nom est
 * complet, sur deux lignes au besoin ; les signalements
 * ne l'agrandissent jamais : une icône de niveau sur la ligne, et le détail
 * (avec sa sortie) en surimpression quand la ligne est active.
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
  produitId,
  onEntree,
  hauteurFixe,
  niveauSignalement,
  surimpressionVers = 'bas',
}: {
  /** Grille plein écran : hauteur imposée de la ligne en px (signalements en surimpression). */
  hauteurFixe?: number;
  /** Niveau le plus grave des signalements (icône sur la ligne, grille plein écran). */
  niveauSignalement?: Niveau;
  /** Côté où s'ouvre la surimpression des signalements (lignes du bas : vers le haut). */
  surimpressionVers?: 'haut' | 'bas';
  /** Identifiant du produit : repère de la ligne pour l'amener en vue (`ligneActive.ts`). */
  produitId?: number;
  /** « Entrée » dans le champ (clavier, lecteur) : passer au produit suivant. */
  onEntree?: () => void;
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
  const fixe = hauteurFixe !== undefined;
  const compact = densite === 'compact' && !fixe;
  const carte = variante === 'carte' && !fixe;
  // En grille fixe, la taille suit la hauteur de ligne : 36 px (< 48), 44 px, puis 56 px (≥ 64).
  const cibleReduite = fixe ? hauteurFixe < 48 : compact;
  const grande = fixe && hauteurFixe >= 64;
  const gaucher = main === 'gauche';
  const auPoids = unite === 'kg';
  // Un produit au kilo se saisit toujours au pavé décimal, jamais au clavier.
  const viaPave = modePave || auPoids;
  const affichee = auPoids && rempli ? formaterQuantite('kg', Number(valeur)) : valeur;

  const tailleCible = grande ? 'h-14 w-14' : cibleReduite ? 'h-9 w-9' : 'h-11 w-11';
  const hauteurChamp = grande ? 'h-14' : cibleReduite ? 'h-9' : 'h-11';
  // En carte le champ s'étire pour offrir une grande cible au doigt, mais
  // borné : sur une carte large, un champ de 280 px pour trois chiffres se lit
  // comme une zone de texte, pas comme une quantité.
  const largeurChamp = carte
    ? 'flex-1 min-w-0 max-w-[9rem]'
    : auPoids
      ? grande
        ? 'w-28'
        : compact || fixe
        ? 'w-24'
        : 'w-28' // « 12,345 kg » doit tenir sans être coupé
      : grande
        ? 'w-20'
        : compact || fixe
        ? 'w-16'
        : 'w-20';

  const classesConteneur = carte
    ? `ligne-impression flex flex-col justify-between rounded-lg border transition-colors ${
        compact ? 'gap-1.5 p-2' : 'gap-2 p-2.5'
      } ${selectionne ? 'border-accent bg-accent-doux/60 ring-2 ring-accent/40' : 'border-line bg-surface'}`
    : fixe
      ? `relative flex cursor-pointer flex-col justify-center border-b border-line has-[input:focus]:bg-surface-2 ${
          selectionne ? 'z-10 bg-accent-doux shadow-[inset_4px_0_0_var(--color-accent)]' : ''
        }`
      : `ligne-impression border-b border-line last:border-b-0 has-[input:focus]:bg-surface-2 ${
          selectionne ? 'bg-accent-doux/60 shadow-[inset_4px_0_0_var(--color-accent)]' : ''
        }`;
  const classesRangee = carte
    ? 'contents'
    : `flex items-center ${compact ? 'gap-2 px-2.5 py-1' : fixe ? 'gap-1.5 px-2' : 'gap-2.5 px-3 py-1.5'} ${gaucher ? 'flex-row-reverse' : ''}`;
  // Grille fixe : nom COMPLET, à la lettre (LOI 5), jamais d'ellipse — sur deux
  // lignes au besoin ; `dispositionGrille` élargit les colonnes pour que ça tienne.
  const classesNom = fixe
    ? `whitespace-normal break-words leading-tight ${grande ? 'text-lg' : 'text-[15px]'}`
    : `${carte ? 'line-clamp-2 leading-snug' : 'truncate'} ${compact ? 'text-sm' : 'text-[15px]'}`;

  return (
    <div
      className={`${classesConteneur} scroll-mt-20 scroll-mb-2`}
      style={fixe ? { height: hauteurFixe } : undefined}
      // Grille fixe : toucher n'importe où sur la ligne sélectionne le produit.
      onClick={fixe ? onSelectionner : undefined}
      data-ligne-produit={produitId}
      aria-current={selectionne ? 'true' : undefined}
    >
      <div className={classesRangee}>
      <div
        className={`min-w-0 ${carte ? '' : 'flex-1'} ${gaucher && !carte ? 'text-right' : ''} ${
          fixe && niveauSignalement ? `flex items-center gap-1.5 ${gaucher ? 'flex-row-reverse' : ''}` : ''
        }`}
      >
        {fixe && niveauSignalement ? (
          <span className={NIVEAUX[niveauSignalement].icone} title={NIVEAUX[niveauSignalement].libelle}>
            <IconeNiveau niveau={niveauSignalement} className="h-4 w-4" />
            <span className="sr-only">{NIVEAUX[niveauSignalement].libelle}</span>
          </span>
        ) : null}
        <div className={`min-w-0 text-ink ${classesNom}`} title={nom}>
          {nom}
        </div>
        {indice && !compact && !fixe ? (
          <div className="mt-0.5 text-xs text-ink-3">{indice}</div>
        ) : null}
      </div>

      <div
        className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'} ${
          gaucher ? 'flex-row-reverse' : ''
        } ${carte ? '' : 'shrink-0'}`}
      >
        {suggestion != null && !rempli && onAppliquerSuggestion && !carte && !fixe ? (
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
          onClick={(e) => {
            // Le « 0 » ne fait que le zéro : il ne déplace pas la sélection (grille fixe).
            if (fixe) e.stopPropagation();
            onChange(zero ? '' : '0');
          }}
          aria-pressed={zero}
          aria-label={zero ? `Annuler le zéro pour ${nom}` : `${nom} : épuisé`}
          className={`sans-impression shrink-0 rounded-lg border font-medium transition-colors ${grande ? 'text-base' : 'text-sm'} ${tailleCible} ${
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
          data-champ-principal
          value={affichee}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEntree && !viaPave) {
              e.preventDefault();
              onEntree();
            }
          }}
          onFocus={(e) => {
            if (viaPave) e.currentTarget.blur();
            else e.currentTarget.select();
          }}
          onClick={fixe ? undefined : onSelectionner}
          placeholder={auPoids ? '— kg' : '—'}
          aria-label={auPoids ? `${nom}, poids en kg` : nom}
          className={`chiffres rounded-lg border text-center transition-colors placeholder:text-ink-3 focus:border-accent focus:outline-none ${hauteurChamp} ${largeurChamp} ${
            compact ? 'text-sm' : grande ? 'text-xl' : 'text-base'
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
      {signalements && fixe ? (
        // Surimpression : n'agrandit jamais la grille. Détail affiché sur la ligne active.
        selectionne ? (
          <div
            className={`sans-impression absolute inset-x-0 z-20 min-w-64 rounded-xl border border-line-fort bg-surface p-2 shadow-lg ${
              surimpressionVers === 'haut' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            {signalements}
          </div>
        ) : null
      ) : signalements ? (
        <div className={`sans-impression ${carte ? '' : compact ? 'px-2.5 pb-1.5' : 'px-3 pb-2'}`}>{signalements}</div>
      ) : null}
    </div>
  );
}
