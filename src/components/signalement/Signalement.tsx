'use client';

// src/components/signalement/Signalement.tsx
//
// Affiche UN signalement (Echec / Avertissement / Information) du contrat
// `src/domaine/resultat.ts`. Composant présentationnel : il ne décide ni
// quand on refuse (regles-metier) ni comment on le dit (gestion-erreurs,
// `messages.ts`) — il rend visible, c'est tout.
//
// Règle centrale (LOI 7/8) : un refus porte sa sortie. Si un bloquant arrive
// sans bouton de correction ni autre sortie, on le signale en développement
// (console.warn + cadre pointillé) pour que l'oubli soit vu avant la mise en
// service. En production rien ne change à l'écran.

import { useEffect, type ReactNode } from 'react';
import { BoutonCorrection } from './BoutonCorrection';
import { IconeNiveau, NIVEAUX } from './niveaux';
import type { SignalementAffichable } from './trier';

export type PropsSignalement = {
  signalement: SignalementAffichable;
  /**
   * Libellé du bouton de sortie, obtenu par `libelleCorrection(code, params)`
   * (`src/domaine/messages.ts`). Le bouton n'apparaît que si ce libellé ET
   * `signalement.valeurProposee` ET `onCorriger` sont présents.
   */
  libelleCorrection?: string;
  /** Reçoit `signalement.valeurProposee` telle quelle (ex. 20, '2026-10-21'). */
  onCorriger?: (valeurProposee: unknown) => void;
  /**
   * Autre sortie quand il n'y a pas de valeur à proposer (ex. bouton
   * « Appeler le gérant » pour ERR_DROIT_INSUFFISANT). Compte comme une sortie.
   */
  autreSortie?: ReactNode;
  /** Pour relier le champ fautif : `aria-describedby={id}` sur l'input. */
  id?: string;
  className?: string;
  /**
   * Version discrète (22/10/2026) : petit cadre, sans bandeau de niveau. Pour
   * les formulaires où un récapitulatif central liste déjà ce qui manque.
   */
  compact?: boolean;
};

const EN_DEV = process.env.NODE_ENV !== 'production';

export function Signalement({
  signalement,
  libelleCorrection,
  onCorriger,
  autreSortie,
  id,
  className = '',
  compact = false,
}: PropsSignalement) {
  const { niveau, code, message, valeurProposee } = signalement;
  const style = NIVEAUX[niveau];

  const correctionPossible =
    valeurProposee !== undefined && !!libelleCorrection && typeof onCorriger === 'function';
  const refusSansSortie = niveau === 'bloquant' && !correctionPossible && !autreSortie;

  useEffect(() => {
    if (EN_DEV && refusSansSortie) {
      console.warn(
        `[design-ux] Refus « ${code} » affiché sans sortie. Tout refus doit proposer la sortie (LOI 7/8) : ` +
          `fournir valeurProposee + libelleCorrection + onCorriger, ou autreSortie.`,
      );
    }
  }, [refusSansSortie, code]);

  return (
    <div
      id={id}
      role={style.role}
      data-niveau={niveau}
      data-code={code}
      data-champ={signalement.champ ?? undefined}
      className={`flex rounded-xl ${compact ? 'gap-2 px-3 py-2' : 'gap-3 p-4'} ${style.cadre} ${
        EN_DEV && refusSansSortie ? 'outline-2 outline-offset-2 outline-dashed outline-bloquant' : ''
      } ${className}`}
    >
      <IconeNiveau niveau={niveau} className={`${compact ? 'h-5 w-5' : 'h-8 w-8'} shrink-0 ${style.icone}`} />

      <div className="min-w-0 flex-1">
        <p className={compact ? 'sr-only' : 'mb-1'}>
          <span
            className={`inline-block rounded-md text-sm font-bold uppercase tracking-wide ${
              niveau === 'information' ? '' : 'px-2 py-0.5'
            } ${style.pastille}`}
          >
            {style.libelle}
          </span>
        </p>

        <p className={`leading-snug text-ink text-pretty ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>{message}</p>

        {correctionPossible || autreSortie ? (
          <div className={`${compact ? 'mt-1.5' : 'mt-3'} flex flex-wrap gap-2`}>
            {correctionPossible ? (
              <BoutonCorrection
                libelle={libelleCorrection ?? ''}
                variante={niveau === 'bloquant' ? 'plein' : 'contour'}
                onClick={() => onCorriger?.(valeurProposee)}
              />
            ) : null}
            {autreSortie}
          </div>
        ) : null}

        {EN_DEV && refusSansSortie ? (
          <p className="mt-2 font-mono text-xs text-bloquant">
            [dev] Refus sans bouton de sortie — voir la console.
          </p>
        ) : null}
      </div>
    </div>
  );
}
