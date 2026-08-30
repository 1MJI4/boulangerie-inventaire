'use client';

import type { Main } from '@/lib/preferencesSaisie';

/**
 * Pavé numérique de l'application, alternative au clavier du téléphone.
 *
 * Deux raisons de le proposer : le clavier natif recouvre la moitié de
 * l'écran et masque la liste, et ses touches sont placées pour deux mains.
 * Celui-ci reste ancré en bas, du côté du pouce, avec des touches assez
 * grandes pour être frappées sans regarder.
 */

const TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function PaveNumerique({
  produitNom,
  valeur,
  main,
  onTouche,
  onEffacer,
  onVider,
  onSuivant,
  onFermer,
  peutAllerSuivant,
}: {
  produitNom: string | null;
  valeur: string;
  main: Main;
  onTouche: (chiffre: string) => void;
  onEffacer: () => void;
  onVider: () => void;
  onSuivant: () => void;
  onFermer: () => void;
  peutAllerSuivant: boolean;
}) {
  if (!produitNom) return null;

  const alignement = main === 'droite' ? 'sm:ml-auto' : 'sm:mr-auto';

  return (
    <div className="sans-impression fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className={`w-full max-w-md p-3 ${alignement}`}>
        <div className="mb-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{produitNom}</div>
            <div className="text-xs text-ink-3">
              {valeur === '' ? 'pas encore compté' : 'quantité restante'}
            </div>
          </div>

          <div className="chiffres min-w-16 rounded-lg border border-line-fort bg-surface-2 px-3 py-1 text-right text-2xl font-semibold text-ink">
            {valeur === '' ? '—' : valeur}
          </div>

          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer le pavé"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {TOUCHES.map((touche) => (
            <button
              key={touche}
              type="button"
              onClick={() => onTouche(touche)}
              className="chiffres h-14 rounded-xl border border-line bg-surface text-xl font-medium text-ink active:bg-accent-doux active:text-accent"
            >
              {touche}
            </button>
          ))}

          <button
            type="button"
            onClick={onVider}
            className="h-14 rounded-xl border border-line text-sm font-medium text-ink-2 active:bg-surface-2"
          >
            Vider
          </button>

          <button
            type="button"
            onClick={() => onTouche('0')}
            className="chiffres h-14 rounded-xl border border-line bg-surface text-xl font-medium text-ink active:bg-accent-doux active:text-accent"
          >
            0
          </button>

          <button
            type="button"
            onClick={onEffacer}
            aria-label="Effacer le dernier chiffre"
            className="h-14 rounded-xl border border-line text-xl text-ink-2 active:bg-surface-2"
          >
            <span aria-hidden>⌫</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onSuivant}
          disabled={!peutAllerSuivant}
          className="mt-2 h-12 w-full rounded-xl bg-accent text-sm font-medium text-white active:bg-accent-fort disabled:bg-ink-3 disabled:opacity-60"
        >
          Produit suivant
        </button>
      </div>
    </div>
  );
}
