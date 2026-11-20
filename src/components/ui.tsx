import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconeNiveau, NIVEAUX } from '@/components/signalement/niveaux';
import { typographier } from '@/domaine/messages';
import type { Niveau } from '@/domaine/resultat';

/* ---------------------------------------------------------------- Entête */

export function Entete({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink text-balance sm:text-4xl">
          {titre}
        </h1>
        {sousTitre ? <div className="mt-1 text-[13px] text-ink-2 sm:mt-1.5 sm:text-[15px]">{sousTitre}</div> : null}
      </div>
      {actions ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Carte */

export function Carte({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-surface ${className}`}
    >
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- Boutons */

type VarianteBouton = 'principal' | 'secondaire' | 'discret' | 'danger';

const STYLES_BOUTON: Record<VarianteBouton, string> = {
  principal: 'bg-accent text-accent-texte hover:bg-accent-fort disabled:bg-ink-3',
  // « Gris » d'iOS : fond de piste, texte d'encre — jamais de contour.
  secondaire: 'bg-segment-fond text-ink hover:bg-line-fort/40',
  discret: 'text-accent hover:bg-accent-doux',
  danger: 'bg-alerte-doux text-alerte hover:bg-alerte/15',
};

const BASE_BOUTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60';

export function Bouton({
  variante = 'secondaire',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBouton }) {
  return <button className={`${BASE_BOUTON} ${STYLES_BOUTON[variante]} ${className}`} {...props} />;
}

export function LienBouton({
  href,
  variante = 'secondaire',
  className = '',
  children,
}: {
  href: string;
  variante?: VarianteBouton;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE_BOUTON} ${STYLES_BOUTON[variante]} ${className}`}>
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------- Puces */

type TonPuce = 'neutre' | 'accent' | 'ok' | 'attention' | 'alerte';

const STYLES_PUCE: Record<TonPuce, string> = {
  neutre: 'bg-segment-fond text-ink-2',
  accent: 'bg-accent-doux text-accent',
  ok: 'bg-ok-doux text-ok',
  attention: 'bg-attention-doux text-attention',
  alerte: 'bg-alerte-doux text-alerte',
};

export function Puce({
  ton = 'neutre',
  children,
  className = '',
}: {
  ton?: TonPuce;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES_PUCE[ton]} ${className}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- États */

export function Chargement({ libelle = 'Chargement…' }: { libelle?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-2">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-line-fort border-t-accent"
      />
      {libelle}
    </div>
  );
}

export function EtatVide({ titre, detail, action }: { titre: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-base font-medium text-ink text-balance">{titre}</p>
      {detail ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-2 text-pretty">{detail}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * Message d'écran sans sortie propre (chargement impossible, constat). Plus de
 * quatrième style (audit 28/10/2026, 3.12) : `alerte`, `attention` et `info`
 * reprennent les TROIS niveaux de la LOI 8 (icône, libellé, couleur de
 * `signalement/niveaux`) ; `ok` reste la confirmation verte. Un simple constat
 * se passe en `attention` ou `info`, jamais en rouge. Texte en typographie
 * française (espaces insécables) quand c'est une chaîne.
 */
const NIVEAU_DU_TON: Record<'alerte' | 'attention' | 'info', Niveau> = {
  alerte: 'bloquant',
  attention: 'avertissement',
  info: 'information',
};

export function Alerte({
  ton = 'alerte',
  children,
}: {
  ton?: 'alerte' | 'attention' | 'info' | 'ok';
  children: ReactNode;
}) {
  const contenu = typeof children === 'string' ? typographier(children) : children;
  if (ton === 'ok') {
    return (
      <div role="status" className="rounded-2xl bg-ok-doux px-4 py-3 text-base text-ink text-pretty">
        {contenu}
      </div>
    );
  }
  const niveau = NIVEAU_DU_TON[ton];
  const style = NIVEAUX[niveau];
  return (
    <div role={style.role} data-niveau={niveau} className={`flex gap-3 rounded-2xl px-4 py-3 ${style.cadre}`}>
      <IconeNiveau niveau={niveau} className={`mt-0.5 h-6 w-6 ${style.icone}`} />
      <div className="min-w-0 flex-1">
        <p className={`mb-0.5 text-sm font-semibold ${style.pastille}`}>{style.libelle}</p>
        <div className="text-base leading-snug text-ink text-pretty">{contenu}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Progression */

export function Progression({ fait, total }: { fait: number; total: number }) {
  const pourcent = total === 0 ? 0 : Math.round((fait / total) * 100);
  const termine = total > 0 && fait === total;

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={fait}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${fait} sur ${total}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${termine ? 'bg-ok' : 'bg-accent'}`}
          style={{ width: `${pourcent}%` }}
        />
      </div>
      <span className="chiffres text-xs text-ink-2">
        {fait}/{total}
      </span>
    </div>
  );
}
