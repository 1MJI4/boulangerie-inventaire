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
// Présentation : 2 semaines sur 2 rangées de 7 cases (réglable), sans faire
// défiler la page. Les semaines suivantes s'affichent par les flèches ou en
// glissant le doigt horizontalement sur la grille. Chaque rangée commence le
// même jour que la date du jour : les colonnes restent alignées, le nom du
// jour est écrit dans chaque case.

import { useRef, useState, type PointerEvent } from 'react';
import { aujourdhuiIso, decalagePour, fenetreSemaines, libelleLong, libelleMois, morceauxDate } from './dates';

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
  /** Nombre de rangées de 7 jours affichées à la fois (défaut 2). */
  semainesVisibles?: number;
  /** @deprecated Ignoré depuis l'affichage par semaines : utiliser `semainesVisibles`. */
  nombreJours?: number;
  /** Titre du groupe (défaut « Jour de retrait »). */
  titre?: string;
  enErreur?: boolean;
  decritPar?: string;
};

/** On ne prend pas de commande à plus d'un an (garde-fou d'affichage, pas une règle). */
const SEMAINES_MAX = 52;
/** Distance minimale d'un glissement horizontal pour changer de semaine. */
const SEUIL_GLISSEMENT_PX = 48;

export function SelecteurDateRetrait({
  valeur,
  onChange,
  estJourFerme,
  aujourdhui,
  premiereDate,
  semainesVisibles = 2,
  titre = 'Jour de retrait',
  enErreur = false,
  decritPar,
}: PropsSelecteurDateRetrait) {
  const [aujourdhuiAppareil] = useState(() => aujourdhuiIso());
  const debut = aujourdhui ?? aujourdhuiAppareil;
  const rangees = Math.max(1, Math.floor(semainesVisibles));
  const decalageMax = Math.max(0, SEMAINES_MAX - rangees);

  // Au montage : la semaine de la date déjà choisie (commande rouverte).
  const [decalage, setDecalage] = useState(() =>
    valeur !== null && valeur >= debut ? Math.min(decalagePour(debut, valeur), decalageMax) : 0,
  );

  const jours = fenetreSemaines(debut, decalage, rangees);
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  const valeurHorsVue = valeur !== null && valeur >= debut && (valeur < premier || valeur > dernier);

  const moisPremier = libelleMois(premier);
  const moisDernier = libelleMois(dernier);
  const titrePeriode = moisPremier === moisDernier ? moisPremier : `${moisPremier} – ${moisDernier}`;

  function allerA(d: number) {
    setDecalage(Math.min(Math.max(0, d), decalageMax));
  }

  // Glissement horizontal : une semaine de plus ou de moins. Le « clic » qui
  // suit un glissement est ignoré, sinon on choisirait le jour sous le doigt.
  const depart = useRef<{ x: number; y: number } | null>(null);
  const aGlisse = useRef(false);

  function auPose(e: PointerEvent<HTMLUListElement>) {
    depart.current = { x: e.clientX, y: e.clientY };
    aGlisse.current = false;
  }
  function auLever(e: PointerEvent<HTMLUListElement>) {
    const d = depart.current;
    depart.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) >= SEUIL_GLISSEMENT_PX && Math.abs(dx) > Math.abs(dy)) {
      aGlisse.current = true;
      allerA(decalage + (dx < 0 ? 1 : -1));
    }
  }

  const classeFleche =
    'inline-flex h-12 min-w-12 items-center justify-center rounded-xl border border-line-fort bg-surface px-3 text-2xl font-semibold leading-none text-ink hover:bg-surface-2 active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <fieldset aria-describedby={decritPar} aria-invalid={enErreur || undefined} className="min-w-0">
      <legend className="mb-2 text-base font-semibold text-ink">{titre}</legend>

      {valeur ? (
        <p className="mb-2 text-base text-ink" aria-live="polite">
          Choisi : <strong className="font-semibold">{libelleLong(valeur)}</strong>
          {valeur < debut ? (
            <span className="ml-2 font-semibold text-bloquant">— date passée, choisissez un autre jour</span>
          ) : null}
        </p>
      ) : null}

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => allerA(decalage - 1)}
          disabled={decalage === 0}
          aria-label="Semaine précédente"
          className={classeFleche}
        >
          <span aria-hidden>‹</span>
        </button>
        <p
          className="min-w-0 flex-1 truncate text-center text-sm font-semibold uppercase tracking-wide text-ink-2"
          aria-live="polite"
        >
          {titrePeriode}
        </p>
        <button
          type="button"
          onClick={() => allerA(decalage + 1)}
          disabled={decalage >= decalageMax}
          aria-label="Semaine suivante"
          className={classeFleche}
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <ul
        onPointerDown={auPose}
        onPointerUp={auLever}
        onPointerCancel={() => {
          depart.current = null;
        }}
        onClickCapture={(e) => {
          if (aGlisse.current) {
            aGlisse.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        // pan-y : le défilement vertical reste au navigateur, l'horizontal change de semaine.
        style={{ touchAction: 'pan-y' }}
        className={`grid select-none grid-cols-7 gap-1 sm:gap-1.5 ${
          enErreur ? 'rounded-xl outline-2 outline-offset-4 outline-bloquant' : ''
        }`}
      >
        {jours.map((iso, i) => (
          <JourItem
            key={iso}
            iso={iso}
            afficherMois={i === 0 || iso.endsWith('-01')}
            estAujourdhui={iso === debut}
            choisi={iso === valeur}
            tropTot={premiereDate !== undefined && iso < premiereDate}
            etat={estJourFerme(iso)}
            onChoisir={onChange}
          />
        ))}
      </ul>

      {valeurHorsVue ? (
        <button
          type="button"
          onClick={() => allerA(decalagePour(debut, valeur))}
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl border border-line-fort bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2"
        >
          Revoir le jour choisi
        </button>
      ) : decalage > 0 ? (
        <button
          type="button"
          onClick={() => allerA(0)}
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl px-2 text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Revenir à aujourd’hui
        </button>
      ) : null}
    </fieldset>
  );
}

function JourItem({
  iso,
  afficherMois,
  estAujourdhui,
  choisi,
  tropTot,
  etat,
  onChoisir,
}: {
  iso: string;
  afficherMois: boolean;
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
    <li className="min-w-0">
      <button
        type="button"
        disabled={indisponible}
        aria-pressed={choisi}
        aria-current={estAujourdhui ? 'date' : undefined}
        aria-label={`${libelleLong(iso)}${raison ? ` — ${raison}${etat.libelle ? ` (${etat.libelle})` : ''}` : ''}`}
        title={etat.libelle}
        onClick={() => {
          if (!indisponible) onChoisir(iso);
        }}
        className={`flex min-h-14 w-full flex-col items-center justify-center rounded-xl border-2 px-0.5 py-1 text-center ${classes}`}
      >
        <span className="text-xs font-medium leading-tight">{estAujourdhui ? 'auj.' : jour}</span>
        <span className={`chiffres text-xl font-semibold leading-tight ${indisponible ? 'line-through' : ''}`}>
          {numero}
        </span>
        {raison ? (
          <span className="max-w-full truncate rounded bg-surface px-1 text-[0.6875rem] font-bold uppercase leading-tight text-ink">
            {raison}
          </span>
        ) : (
          <span className="text-[0.6875rem] leading-tight opacity-80">{afficherMois ? mois : ' '}</span>
        )}
      </button>
    </li>
  );
}
