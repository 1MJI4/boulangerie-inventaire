'use client';

// src/components/fiche/ElementsCommande.tsx
//
// Briques d'affichage d'une commande, partagées par l'accueil vendeur, la
// liste des commandes et la fiche (propriétaire : design-ux, 28/10/2026).
// Style Apple : listes groupées (cellules blanches arrondies sur fond gris),
// séparateurs fins, hiérarchie par la taille et le gris, pas de cadres épais.
// Couleurs : jetons de src/app/globals.css uniquement. Une information n'est
// jamais portée par la couleur seule : chaque pastille a son texte.

import type { ReactNode } from 'react';
import { IconeNiveau } from '@/components/signalement';
import { attendUnVirement, LIBELLE_TYPE, type Commande, type TypeCommande } from '@/lib/commandes';
import { formatDateRelative } from '@/lib/dateProduction';
import { formaterEuros, resteDu } from '@/domaine/argent';
import { heureLisible, LIBELLE_STATUT_ECRAN, majusculeInitiale, resumeCommande, texteAutres } from './presentationCommande';

/* ------------------------------------------------------- Type de commande */

const STYLE_TYPE: Record<TypeCommande, string> = {
  patisserie: 'bg-type-patisserie-doux text-type-patisserie',
  sale: 'bg-type-sale-doux text-type-sale',
  boulangerie: 'bg-type-boulangerie-doux text-type-boulangerie',
};

export function EtiquetteType({ type }: { type: TypeCommande }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-px text-xs font-semibold ${STYLE_TYPE[type]}`}>
      {LIBELLE_TYPE[type]}
    </span>
  );
}

/* --------------------------------------------------------------- Pastilles */

/** Pastille de statut ou d'état : texte toujours présent, icône pour ce qui demande une action. */
export function Pastille({ ton, children }: { ton: 'accent' | 'avertissement' | 'neutre' | 'ok'; children: ReactNode }) {
  const styles = {
    accent: 'bg-accent-doux text-accent',
    avertissement: 'bg-avertissement-doux text-avertissement',
    neutre: 'bg-segment-fond text-ink-2',
    ok: 'bg-ok-doux text-ok',
  }[ton];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {ton === 'avertissement' ? <IconeNiveau niveau="avertissement" className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

/** Statut à l'écran (« Bon à imprimer », « Retirée par le client »…). */
export function PastilleStatut({ commande }: { commande: Pick<Commande, 'statut'> }) {
  const ton = commande.statut === 'a_imprimer' ? 'accent' : commande.statut === 'remise' ? 'ok' : 'neutre';
  return <Pastille ton={ton}>{LIBELLE_STATUT_ECRAN[commande.statut]}</Pastille>;
}

/* ----------------------------------------------------------------- Résumé */

/**
 * Les articles en clair : « 20 parts Layer Cake · Framboise · Rond · « Bravo » ».
 * Deux lignes de texte au plus par article : compact, mais rien de vital ne
 * disparaît (le reste est dans la fiche).
 */
export function ResumeArticles({ commande, max = 2 }: { commande: Commande; max?: number }) {
  const r = resumeCommande(commande, max);
  if (r.lignes.length === 0) return <p className="text-sm text-ink-2">Aucun article</p>;
  return (
    <div className="mt-0.5 grid gap-0.5">
      {r.lignes.map((l, k) => (
        <p key={k} className="line-clamp-2 text-[15px] leading-snug text-ink">
          <span className="chiffres font-semibold">{l.quantite}</span> {l.libelle}
          {l.details.length ? <span className="text-ink-2"> · {l.details.join(' · ')}</span> : null}
        </p>
      ))}
      {r.autres > 0 ? <p className="text-sm text-ink-2">{texteAutres(r.autres)}</p> : null}
    </div>
  );
}

/* --------------------------------------------------- Liste groupée (iOS) */

export function ListeGroupee({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <ul className={`divide-y divide-line overflow-hidden rounded-2xl bg-surface ${className}`}>{children}</ul>;
}

/**
 * Une commande dans une liste : l'heure et le client d'abord, puis le détail
 * court, puis l'état. Toute la cellule s'ouvre sur la fiche.
 */
export function CelluleCommande({
  commande,
  onOuvrir,
  types,
  aujourdhui,
  avecDate = false,
  avecStatut = false,
}: {
  commande: Commande;
  onOuvrir: (c: Commande) => void;
  types?: TypeCommande[];
  aujourdhui: string;
  avecDate?: boolean;
  avecStatut?: boolean;
}) {
  const reste = resteDu(commande.totalCentimes, commande.acompteCentimes);
  const heure = heureLisible(commande.retraitHeure);
  const date = formatDateRelative(commande.retraitLe, aujourdhui);
  const virement = attendUnVirement(commande);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOuvrir(commande)}
        aria-haspopup="dialog"
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 active:bg-surface-2"
      >
        <span className="w-16 shrink-0 pt-px">
          <span className="chiffres block text-lg font-semibold leading-tight text-ink">{heure ?? '—'}</span>
          {heure === null ? <span className="block text-xs text-ink-2">sans heure</span> : null}
          {avecDate ? <span className="block text-xs text-ink-2">{majusculeInitiale(date)}</span> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[17px] font-semibold text-ink">{commande.client}</span>
            <span className="chiffres text-sm text-ink-2">n° {commande.numero}</span>
          </span>
          <ResumeArticles commande={commande} />
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {avecStatut || commande.statut === 'a_imprimer' ? <PastilleStatut commande={commande} /> : null}
            {virement ? <Pastille ton="avertissement">Virement à vérifier</Pastille> : null}
            {(types ?? []).map((t) => (
              <EtiquetteType key={t} type={t} />
            ))}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 self-center">
          <span className="text-right">
            <span className="chiffres block text-sm font-medium text-ink">{formaterEuros(commande.totalCentimes)}</span>
            {reste > 0 ? <span className="chiffres block text-xs text-ink-2">reste {formaterEuros(reste)}</span> : null}
          </span>
          <span aria-hidden className="text-xl text-ink-2">›</span>
        </span>
      </button>
    </li>
  );
}

/* ------------------------------------------------- Contrôle segmenté (iOS) */

export function Segmente<T extends string>({
  options,
  valeur,
  onChange,
  libelle,
}: {
  options: readonly { valeur: T; libelle: string; nombre?: number }[];
  valeur: T;
  onChange: (v: T) => void;
  libelle: string;
}) {
  return (
    <div role="radiogroup" aria-label={libelle} className="flex gap-0.5 rounded-xl bg-segment-fond p-0.5">
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(o.valeur)}
            className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-1.5 text-sm ${
              actif ? 'bg-segment-actif font-semibold text-ink shadow-sm' : 'font-medium text-ink-2'
            }`}
          >
            <span className="truncate">{o.libelle}</span>
            {o.nombre !== undefined ? <span className="chiffres">{o.nombre}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
