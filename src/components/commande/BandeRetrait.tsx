'use client';

// src/components/commande/BandeRetrait.tsx
//
// Jour et heure de retrait en une BANDE compacte (demande du propriétaire,
// 18/10/2026), toujours visible au-dessus des produits : deux rangées de
// pastilles qui défilent horizontalement au doigt (scroll-snap), un toucher
// = un choix.
//   1. les jours, aujourd'hui en premier ; un jour fermé (LOI 3, niveau UI) ou
//      trop tôt pour le délai est affiché mais jamais sélectionnable ;
//   2. les heures du jour choisi, entre l'ouverture et la fermeture de CE jour
//      (réglages du gérant, lus par le domaine), plus « sans heure ».
// Commande lointaine (rare — propriétaire, 11/11/2026) : un petit bouton
// calendrier, au bout de la rangée des jours, ouvre un calendrier large qui va
// jusqu'à un an. Mêmes jours fermés et même première date que la bande.
// Aucune règle ici : le jour fermé, la première date possible et les heures
// d'ouverture sont donnés par l'écran, qui les tient du domaine. Le domaine
// rejuge de toute façon (validerDateRetrait, validerHeureRetrait).

import { useEffect, useRef, useState, type ReactNode, type WheelEvent } from 'react';
import { libelleLong, morceauxDate } from '@/components/saisie/dates';
import { SelecteurDateRetrait } from '@/components/saisie/SelecteurDateRetrait';
import { lireHeure } from '@/domaine/reglement';
import type { PlageOuverture } from '@/domaine/constantes';
import { JOURS_PROPOSES_RETRAIT, PAS_CRENEAU_MINUTES, creneauxRetrait, joursProposes } from './modele';

export type EtatJourRetrait = { ferme: boolean; libelle?: string };

const RANGEE =
  'relative flex min-w-0 snap-x snap-proximity gap-1.5 overflow-x-auto overscroll-x-contain scroll-px-1 px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const PASTILLE = 'flex h-12 shrink-0 snap-start flex-col items-center justify-center rounded-xl border-2 px-2 text-center leading-none';

/** Amène la pastille choisie au milieu de sa rangée (défilement de la rangée seule, jamais de la page). */
function useCentrer(cle: string | null) {
  const rangee = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = rangee.current;
    const el = r?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!r || !el) return;
    r.scrollTo({ left: Math.max(0, el.offsetLeft - (r.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
  }, [cle]);
  return rangee;
}

/** Souris (poste de recette) : la molette fait glisser la rangée ; au doigt, rien ne change. */
function glisserALaMolette(e: WheelEvent<HTMLDivElement>) {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
}

/** « 9h », « 9h15 » — heure affichée sur une pastille. */
function libelleHeure(hhmm: string): { texte: string; pleine: boolean } {
  const [h, m] = hhmm.split(':');
  const heure = String(Number(h));
  return m === '00' ? { texte: `${heure}h`, pleine: true } : { texte: `${heure}h${m}`, pleine: false };
}

export function BandeRetrait({
  aujourdhui,
  date,
  heure,
  etatJour,
  premiereDate,
  horaires,
  onDate,
  onHeure,
  enErreur = false,
  signalements,
  messageJour,
  messageHeure,
}: {
  aujourdhui: string;
  date: string | null;
  /** « HH:MM » ou '' (sans heure). */
  heure: string;
  /** Jour fermé ? — réponse du domaine (fermetureDuJour sur les jours fermés reçus). */
  etatJour: (iso: string) => EtatJourRetrait;
  /** Première date possible pour le délai des produits (domaine, jours ouvrés). */
  premiereDate?: string;
  /** Heures d'ouverture du jour choisi (domaine : horairesOuvertureDuJour), null si aucun jour. */
  horaires: PlageOuverture | null;
  onDate: (iso: string) => void;
  onHeure: (hhmm: string) => void;
  enErreur?: boolean;
  /** Messages du domaine sur le jour et l'heure, rendus sous la bande. */
  signalements?: ReactNode;
  /**
   * Champ vide (« Choisissez le jour de retrait. ») : rendu juste SOUS la rangée
   * des jours, la rangée bordée de rouge (propriétaire, 28/10/2026).
   */
  messageJour?: ReactNode;
  /** Idem sous la rangée des heures. */
  messageHeure?: ReactNode;
}) {
  const jours = joursProposes(aujourdhui, JOURS_PROPOSES_RETRAIT, date);
  const creneaux = date ? creneauxRetrait(horaires, PAS_CRENEAU_MINUTES, heure) : [];
  const rangeeJours = useCentrer(date);
  const rangeeHeures = useCentrer(`${date ?? ''}|${heure}`);
  const debut = horaires ? lireHeure(horaires.ouverture) : null;
  const fin = horaires ? lireHeure(horaires.fermeture) : null;
  const aFaire = date === null;
  const [calendrier, setCalendrier] = useState(false);

  return (
    <div
      role="group"
      aria-label="Jour et heure de retrait"
      className={`grid min-w-0 gap-1.5 rounded-xl border-2 p-1.5 ${
        enErreur ? 'border-bloquant' : aFaire ? 'border-accent bg-accent-doux/40' : 'border-line'
      }`}
    >
      {/* ------------------------------------------------------------ Jours */}
      <div className={`flex min-w-0 items-center gap-1.5 rounded-xl border-2 ${messageJour ? 'border-alerte' : 'border-transparent'}`}>
        <span className="w-12 shrink-0 text-xs font-semibold leading-tight text-ink-2">
          {aFaire ? <span className="text-accent">Jour ?</span> : 'Jour'}
        </span>
        <div ref={rangeeJours} role="group" aria-label="Jour de retrait" onWheel={glisserALaMolette} className={`${RANGEE} flex-1`}>
          {jours.map((iso, i) => {
            const { jour, numero, mois } = morceauxDate(iso);
            const etat = etatJour(iso);
            const tropTot = !etat.ferme && premiereDate !== undefined && iso < premiereDate && iso !== date;
            const indisponible = etat.ferme || tropTot;
            const choisi = iso === date;
            const raison = etat.ferme ? 'fermé' : tropTot ? 'trop tôt' : null;
            const estAujourdhui = iso === aujourdhui;
            // Date lointaine choisie au calendrier (hors de la bande) : son mois, et
            // son année si ce n'est pas celle en cours — « 6 » seul ne dit pas quand.
            const lointain = choisi && jours.length > JOURS_PROPOSES_RETRAIT && (i === 0 || i === jours.length - 1);
            const annee = lointain && iso.slice(0, 4) !== aujourdhui.slice(0, 4) ? iso.slice(0, 4) : null;
            const avecMois = i === 0 || iso.endsWith('-01') || lointain;
            const classes = etat.ferme
              ? 'jour-ferme border-line text-ink-3 cursor-not-allowed'
              : tropTot
                ? 'border-dashed border-line-fort bg-surface-2 text-ink-3 cursor-not-allowed'
                : choisi
                  ? 'border-sortie bg-sortie text-sortie-texte shadow'
                  : 'border-line-fort bg-surface text-ink active:bg-surface-2';
            return (
              <button
                key={iso}
                type="button"
                disabled={indisponible}
                aria-pressed={choisi}
                aria-current={estAujourdhui ? 'date' : undefined}
                aria-label={`${libelleLong(iso)}${raison ? ` — ${raison}${etat.libelle ? ` (${etat.libelle})` : ''}` : ''}`}
                title={etat.libelle}
                onClick={() => {
                  if (!indisponible) onDate(iso);
                }}
                className={`${PASTILLE} min-w-[3.25rem] gap-0.5 ${classes}`}
              >
                <span className="text-[0.6875rem] font-medium">
                  {raison ?? (estAujourdhui ? 'auj.' : jour)}
                </span>
                <span className={`chiffres whitespace-nowrap text-lg font-semibold ${indisponible ? 'line-through' : ''}`}>
                  {numero}
                  {avecMois ? (
                    <span className="ml-0.5 text-[0.6875rem] font-medium">
                      {mois}
                      {annee ? ` ${annee}` : ''}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCalendrier(true)}
          aria-label="Autre date : ouvrir le calendrier (jusqu’à un an)"
          title="Autre date"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-fort bg-surface text-ink-2 active:bg-surface-2"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </div>
      {calendrier ? (
        <CalendrierLarge
          aujourdhui={aujourdhui}
          date={date}
          etatJour={etatJour}
          premiereDate={premiereDate}
          onChoisir={(iso) => {
            onDate(iso);
            setCalendrier(false);
          }}
          onFermer={() => setCalendrier(false)}
        />
      ) : null}
      {messageJour ? <div className="-mt-1 pl-14">{messageJour}</div> : null}

      {/* ----------------------------------------------------------- Heures */}
      <div className={`flex min-w-0 items-center gap-1.5 rounded-xl border-2 ${messageHeure ? 'border-alerte' : 'border-transparent'}`}>
        <span className="w-12 shrink-0 text-xs font-semibold leading-tight text-ink-2">Heure</span>
        {date === null ? (
          <p className="flex h-12 min-w-0 flex-1 items-center px-1 text-sm text-ink-2">Choisissez d’abord le jour.</p>
        ) : (
          <div
            ref={rangeeHeures}
            role="group"
            aria-label="Heure de retrait (facultative)"
            onWheel={glisserALaMolette}
            className={`${RANGEE} flex-1`}
          >
            <button
              type="button"
              aria-pressed={heure === ''}
              onClick={() => onHeure('')}
              className={`${PASTILLE} text-sm font-medium ${
                heure === '' ? 'border-sortie bg-sortie text-sortie-texte shadow' : 'border-line-fort bg-surface text-ink-2'
              }`}
            >
              sans heure
            </button>
            {creneaux.length === 0 ? (
              <p className="flex h-12 shrink-0 items-center px-1 text-sm text-ink-2">Heures d’ouverture inconnues ce jour-là.</p>
            ) : null}
            {creneaux.map((h) => {
              const { texte, pleine } = libelleHeure(h);
              const choisie = h === heure;
              const m = lireHeure(h);
              // Heure déjà choisie hors des heures du jour (jour changé) : montrée, en erreur ; le domaine propose la sortie.
              const hors = m !== null && ((debut !== null && m < debut) || (fin !== null && m > fin));
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={choisie}
                  aria-label={`Retrait à ${texte}`}
                  onClick={() => onHeure(h)}
                  className={`${PASTILLE} chiffres ${pleine ? 'min-w-12 text-lg font-bold' : 'min-w-11 text-sm'} ${
                    choisie
                      ? hors
                        ? 'border-bloquant bg-bloquant-doux text-ink'
                        : 'border-sortie bg-sortie text-sortie-texte shadow'
                      : pleine
                        ? 'border-line-fort bg-surface text-ink'
                        : 'border-line bg-surface text-ink-2'
                  }`}
                >
                  {texte}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {messageHeure ? <div className="-mt-1 pl-14">{messageHeure}</div> : null}
      {signalements}
    </div>
  );
}

/** Semaines montrées à la fois dans le calendrier large, et parcourues par flèche (affichage, pas une règle). */
const SEMAINES_CALENDRIER = 5;
const PAS_CALENDRIER = 4;

/**
 * Calendrier large pour une date lointaine : fenêtre au-dessus de l'écran,
 * fermée par « Fermer », Échap ou un toucher à côté. Un toucher sur un jour
 * ouvert le choisit et referme. Aucune règle ici : jours fermés et première
 * date viennent du domaine, comme pour la bande.
 */
function CalendrierLarge({
  aujourdhui,
  date,
  etatJour,
  premiereDate,
  onChoisir,
  onFermer,
}: {
  aujourdhui: string;
  date: string | null;
  etatJour: (iso: string) => EtatJourRetrait;
  premiereDate?: string;
  onChoisir: (iso: string) => void;
  onFermer: () => void;
}) {
  const fenetre = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = fenetre.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={fenetre}
      aria-label="Calendrier : choisir une date de retrait"
      onClose={onFermer}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      // Ancrée en haut (pas centrée) : les flèches ne bougent pas sous le doigt
      // quand « Revenir à aujourd'hui » apparaît et allonge la fenêtre.
      className="fixed inset-0 mx-auto mb-auto mt-6 w-[calc(100%-1.5rem)] max-w-xl border-0 bg-transparent p-0 text-ink backdrop:bg-voile"
    >
      <div className="max-h-[92dvh] overflow-y-auto overscroll-contain rounded-2xl bg-surface p-4 shadow-xl">
        <SelecteurDateRetrait
          titre="Autre date de retrait"
          valeur={date}
          aujourdhui={aujourdhui}
          premiereDate={premiereDate}
          estJourFerme={etatJour}
          semainesVisibles={SEMAINES_CALENDRIER}
          pasFleches={PAS_CALENDRIER}
          onChange={onChoisir}
        />
        <button
          type="button"
          onClick={() => fenetre.current?.close()}
          className="mt-3 min-h-12 w-full rounded-xl bg-segment-fond text-base font-semibold text-ink"
        >
          Fermer
        </button>
      </div>
    </dialog>
  );
}
