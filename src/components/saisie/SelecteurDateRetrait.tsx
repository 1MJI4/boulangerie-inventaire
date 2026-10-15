'use client';

// src/components/saisie/SelecteurDateRetrait.tsx
//
// Choix du jour de retrait, au doigt. Niveau 1 (UI) de la LOI N°3 : les jours
// fermés sont GRISÉS, HACHURÉS, NON CLIQUABLES et portent le mot « Fermé »
// (jamais la couleur seule). Les dates passées ne sont pas proposées.
//
// Ce composant ne sait PAS quels jours sont fermés : il le demande à
// `estJourFerme`, fournie par le domaine (invariant 2 : aucun jour de
// fermeture ni calcul de jour de semaine hors de `src/domaine/`). Il ne sait
// pas non plus le délai de préparation : `premiereDate` le lui donne.
//
// Présentation en liste de jours (et non en grille de calendrier) : de grosses
// cases de 64 px, le nom du jour écrit en toutes lettres, rien à aligner sur
// des colonnes lun→dim.

import { useState } from 'react';
import { aujourdhuiIso, joursSuccessifs, libelleLong, libelleMois, morceauxDate } from './dates';

export type EtatJour = { ferme: boolean; libelle?: string };

export type PropsSelecteurDateRetrait = {
  /** Date choisie (AAAA-MM-JJ) ou null. */
  valeur: string | null;
  /** Ne reçoit jamais un jour fermé, une date passée ou antérieure à `premiereDate`. */
  onChange: (dateIso: string) => void;
  /** Fournie par le domaine. `libelle` : précision affichée (« Férié », « Congés »…). */
  estJourFerme: (dateIso: string) => EtatJour;
  /** Date du jour (AAAA-MM-JJ). Par défaut : la date de l'appareil. */
  aujourdhui?: string;
  /** Première date autorisée (délai de préparation, calculé par le domaine). */
  premiereDate?: string;
  /** Nombre de jours affichés au départ (défaut 21). Un bouton en ajoute. */
  nombreJours?: number;
  /** Titre du groupe (défaut « Jour de retrait »). */
  titre?: string;
  enErreur?: boolean;
  decritPar?: string;
};

const PAS_SUPPLEMENTAIRE = 21;

export function SelecteurDateRetrait({
  valeur,
  onChange,
  estJourFerme,
  aujourdhui,
  premiereDate,
  nombreJours = 21,
  titre = 'Jour de retrait',
  enErreur = false,
  decritPar,
}: PropsSelecteurDateRetrait) {
  const [aujourdhuiAppareil] = useState(() => aujourdhuiIso());
  const [nombre, setNombre] = useState(nombreJours);

  const debut = aujourdhui ?? aujourdhuiAppareil;
  const jours = joursSuccessifs(debut, nombre);
  const valeurPlusLoin = valeur !== null && valeur > jours[jours.length - 1];

  return (
    <fieldset aria-describedby={decritPar} aria-invalid={enErreur || undefined} className="min-w-0">
      <legend className="mb-2 text-base font-semibold text-ink">{titre}</legend>

      {valeur ? (
        <p className="mb-3 text-base text-ink" aria-live="polite">
          Choisi : <strong className="font-semibold">{libelleLong(valeur)}</strong>
          {valeur < debut ? (
            <span className="ml-2 font-semibold text-bloquant">— date passée, choisissez un autre jour</span>
          ) : null}
        </p>
      ) : null}

      <ul
        className={`grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 ${
          enErreur ? 'rounded-xl outline-2 outline-offset-4 outline-bloquant' : ''
        }`}
      >
        {jours.map((iso, i) => {
          const nouveauMois = i === 0 || iso.slice(0, 7) !== jours[i - 1].slice(0, 7);
          return (
            <JourItem
              key={iso}
              iso={iso}
              enteteMois={nouveauMois ? libelleMois(iso) : null}
              estAujourdhui={iso === debut}
              choisi={iso === valeur}
              tropTot={premiereDate !== undefined && iso < premiereDate}
              etat={estJourFerme(iso)}
              onChoisir={onChange}
            />
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setNombre((n) => n + PAS_SUPPLEMENTAIRE)}
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line-fort bg-surface px-4 text-base font-medium text-ink hover:bg-surface-2 sm:w-auto"
      >
        Voir les jours suivants
      </button>

      {valeurPlusLoin ? (
        <p className="mt-2 text-sm text-ink-2">La date choisie est plus loin : « Voir les jours suivants » pour l’afficher.</p>
      ) : null}
    </fieldset>
  );
}

function JourItem({
  iso,
  enteteMois,
  estAujourdhui,
  choisi,
  tropTot,
  etat,
  onChoisir,
}: {
  iso: string;
  enteteMois: string | null;
  estAujourdhui: boolean;
  choisi: boolean;
  tropTot: boolean;
  etat: EtatJour;
  onChoisir: (iso: string) => void;
}) {
  const { jour, numero, mois } = morceauxDate(iso);
  const indisponible = etat.ferme || tropTot;
  const raison = etat.ferme ? 'Fermé' : tropTot ? 'Trop tôt' : null;

  let classes: string;
  if (etat.ferme) {
    classes = 'jour-ferme border-line text-ink-2 cursor-not-allowed';
  } else if (tropTot) {
    classes = 'border-dashed border-line-fort bg-surface-2 text-ink-2 cursor-not-allowed';
  } else if (choisi) {
    classes = 'border-sortie bg-sortie text-sortie-texte';
  } else {
    classes = 'border-line-fort bg-surface text-ink hover:border-ink-2 active:bg-surface-2';
  }

  return (
    <>
      {enteteMois ? (
        <li aria-hidden className="col-span-full mt-2 text-sm font-semibold uppercase tracking-wide text-ink-2 first:mt-0">
          {enteteMois}
        </li>
      ) : null}
      <li>
        <button
          type="button"
          disabled={indisponible}
          aria-pressed={choisi}
          aria-label={`${libelleLong(iso)}${raison ? ` — ${raison}${etat.libelle ? ` (${etat.libelle})` : ''}` : ''}`}
          onClick={() => {
            if (!indisponible) onChoisir(iso);
          }}
          className={`flex min-h-16 w-full flex-col items-center justify-center rounded-xl border-2 px-1 py-1.5 text-center ${classes}`}
        >
          <span className="text-sm font-medium leading-tight">
            {jour}
            {estAujourdhui ? ' · auj.' : ''}
          </span>
          <span className={`chiffres text-2xl font-semibold leading-tight ${indisponible ? 'line-through' : ''}`}>
            {numero}
          </span>
          {raison ? (
            <span className="rounded bg-surface px-1.5 text-xs font-bold uppercase leading-tight text-ink">
              {raison}
              {etat.ferme && etat.libelle ? ` · ${etat.libelle}` : ''}
            </span>
          ) : (
            <span className="text-xs leading-tight opacity-80">{mois}</span>
          )}
        </button>
      </li>
    </>
  );
}
