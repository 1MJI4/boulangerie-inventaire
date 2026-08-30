'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EXPLICATIONS,
  LIBELLES,
  type Preferences,
  type Clavier,
  type Densite,
  type Main,
  type ModeAffichage,
  type Tri,
  type Colonnes,
  type Decoupage,
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
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4 shadow-lg">
          <p className="mb-4 text-xs text-ink-3 text-pretty">
            Ces réglages restent sur cet appareil. Chacun peut avoir le sien.
          </p>

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
                          className={`min-h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
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
      ) : null}
    </div>
  );
}
