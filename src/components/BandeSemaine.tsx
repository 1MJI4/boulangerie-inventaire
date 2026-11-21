'use client';

// src/components/BandeSemaine.tsx
//
// La bande de 7 jours (même présentation que l'accueil vendeur) : un jour par
// case, ce qu'on veut dire de ce jour en bas, un point optionnel en haut à
// droite, flèches pour changer de semaine. L'écran décide du contenu des cases
// (nombre de retraits, restes comptés…) ; ici, seulement l'affichage et le toucher.

import type { ReactNode } from 'react';

export type CaseJour = {
  /** Texte lu par le lecteur d'écran : « jeudi 26 novembre : 3 retraits ». */
  libelle: string;
  /** Ce qui s'affiche en bas de la case (un nombre, « fermé »…). Absent : un point. */
  bas?: ReactNode;
  /** Pastille en haut à droite (bon à imprimer, produit à zéro…). */
  point?: boolean;
  ferme?: boolean;
  /** Case non touchable (rien à ouvrir ce jour-là). */
  desactive?: boolean;
};

export function BandeSemaine({
  titre,
  jours,
  aujourdhui,
  choisi,
  onChoisir,
  cellule,
  onPrecedente,
  onSuivante,
  onRetourAujourdhui,
  peutPrecedente = true,
  peutSuivante = true,
  note,
}: {
  titre: string;
  jours: readonly string[];
  aujourdhui: string;
  /** Jour sélectionné (null : aucun). */
  choisi: string | null;
  onChoisir: (jour: string) => void;
  cellule: (jour: string) => CaseJour;
  onPrecedente: () => void;
  onSuivante: () => void;
  /** Affiché quand on n'est pas sur la semaine d'aujourd'hui. */
  onRetourAujourdhui?: (() => void) | null;
  peutPrecedente?: boolean;
  peutSuivante?: boolean;
  note?: ReactNode;
}) {
  return (
    <section aria-label={titre} className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight text-ink">{titre}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Semaine précédente"
            disabled={!peutPrecedente}
            onClick={onPrecedente}
            className="h-11 w-11 rounded-full text-2xl text-accent hover:bg-accent-doux disabled:opacity-30"
          >
            ‹
          </button>
          {onRetourAujourdhui ? (
            <button
              type="button"
              onClick={onRetourAujourdhui}
              className="h-11 rounded-full px-3 text-base font-medium text-accent hover:bg-accent-doux"
            >
              Aujourd’hui
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Semaine suivante"
            disabled={!peutSuivante}
            onClick={onSuivante}
            className="h-11 w-11 rounded-full text-2xl text-accent hover:bg-accent-doux disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl bg-surface p-1.5">
        {jours.map((iso) => {
          const d = new Date(`${iso}T12:00:00Z`);
          const nom = d.toLocaleDateString('fr-BE', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
          const c = cellule(iso);
          const estAujourdhui = iso === aujourdhui;
          const actif = iso === choisi;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={actif}
              aria-label={c.libelle}
              disabled={c.desactive}
              onClick={() => onChoisir(iso)}
              className={`relative flex min-h-[4.75rem] flex-col items-center justify-start rounded-2xl px-0.5 py-1.5 ${
                actif
                  ? 'bg-accent text-accent-texte'
                  : c.ferme
                    ? 'jour-ferme text-ink-2'
                    : 'text-ink hover:bg-surface-2 disabled:hover:bg-transparent'
              }`}
            >
              <span className={`text-xs font-medium ${actif ? '' : estAujourdhui ? 'text-accent' : 'text-ink-2'}`}>
                {estAujourdhui ? 'auj.' : nom}
              </span>
              <span className={`chiffres text-xl font-semibold leading-tight ${!actif && estAujourdhui ? 'text-accent' : ''}`}>
                {d.getUTCDate()}
              </span>
              <span className="chiffres mt-auto text-sm font-semibold">
                {c.bas ?? <span className="opacity-40">·</span>}
              </span>
              {c.point ? (
                <span aria-hidden className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${actif ? 'bg-accent-texte' : 'bg-accent'}`} />
              ) : null}
            </button>
          );
        })}
      </div>
      {note ? <p className="mt-1 px-1 text-xs text-ink-2">{note}</p> : null}
    </section>
  );
}
