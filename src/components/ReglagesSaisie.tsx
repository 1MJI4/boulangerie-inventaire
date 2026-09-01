'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EXPLICATIONS,
  LIBELLES,
  type Preferences,
  type Clavier,
  type Colonnes,
  type Decoupage,
  type Densite,
  type Main,
  type ModeAffichage,
  type Tri,
} from '@/lib/preferencesSaisie';

type Reglage<C extends keyof Preferences> = {
  cle: C;
  titre: string;
  choix: readonly Preferences[C][];
};

const REGLAGES = [
  { cle: 'main', titre: 'Main', choix: ['droite', 'gauche'] as const satisfies readonly Main[] },
  { cle: 'mode', titre: 'Affichage', choix: ['liste', 'focus'] as const satisfies readonly ModeAffichage[] },
  { cle: 'decoupage', titre: 'Découpage', choix: ['pages', 'zones'] as const satisfies readonly Decoupage[] },
  { cle: 'colonnes', titre: 'Colonnes', choix: ['auto', '1', '2'] as const satisfies readonly Colonnes[] },
  { cle: 'densite', titre: 'Densité', choix: ['confortable', 'compact'] as const satisfies readonly Densite[] },
  { cle: 'clavier', titre: 'Saisie des chiffres', choix: ['natif', 'pave'] as const satisfies readonly Clavier[] },
  { cle: 'tri', titre: 'Ordre', choix: ['feuille', 'parcours', 'restants'] as const satisfies readonly Tri[] },
] as const;

export function ReglagesSaisie({
  preferences,
  onChanger,
  onReinitialiser,
}: {
  preferences: Preferences;
  onChanger: <C extends keyof Preferences>(cle: C, valeur: Preferences[C]) => void;
  onReinitialiser: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const aLEchap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };

    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', aLEchap);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', aLEchap);
    };
  }, [ouvert]);

  return (
    <div ref={conteneur} className="sans-impression relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-fort bg-surface px-3 text-sm text-ink hover:bg-surface-2"
      >
        Affichage
        <span aria-hidden className="text-ink-3">
          {ouvert ? '▴' : '▾'}
        </span>
      </button>

      {ouvert ? (
        <>
          {/* Sur téléphone le panneau dépassait de 360 px sous l'écran et le
              dernier réglage était inatteignable. Il devient donc un panneau
              ancré en bas, défilant — et reste une bulle sur grand écran. */}
          <div
            aria-hidden
            onClick={() => setOuvert(false)}
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          />

          <div
            role="dialog"
            aria-label="Réglages d’affichage"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface p-4 pb-8 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:max-h-[70vh] sm:w-80 sm:rounded-xl sm:border sm:p-4 sm:pb-4"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-xs text-ink-3 text-pretty">
                Ces réglages restent sur cet appareil. Chacun peut avoir le sien.
              </p>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer les réglages"
                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink sm:hidden"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>

            <div className="space-y-4">
              {REGLAGES.map((reglage) => {
                const r = reglage as unknown as Reglage<keyof Preferences>;
                return (
                  <fieldset key={r.cle}>
                    <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
                      {r.titre}
                    </legend>

                    <div className="flex flex-wrap gap-1.5">
                      {r.choix.map((valeur) => {
                        const actif = preferences[r.cle] === valeur;
                        const libelle = (LIBELLES[r.cle] as Record<string, string>)[valeur as string];
                        return (
                          <button
                            key={String(valeur)}
                            type="button"
                            onClick={() => onChanger(r.cle, valeur)}
                            aria-pressed={actif}
                            className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
                              actif
                                ? 'border-accent bg-accent-doux text-accent'
                                : 'border-line text-ink-2 hover:border-line-fort hover:text-ink'
                            }`}
                          >
                            {libelle}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-1.5 text-xs text-ink-3 text-pretty">{EXPLICATIONS[r.cle]}</p>
                  </fieldset>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onReinitialiser}
              className="mt-4 text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2"
            >
              Revenir aux réglages par défaut
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
