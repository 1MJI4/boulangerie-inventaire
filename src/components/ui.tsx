import Link from 'next/link';
import type { ReactNode } from 'react';

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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink text-balance sm:text-3xl">
          {titre}
        </h1>
        {sousTitre ? <div className="mt-1.5 text-sm text-ink-2">{sousTitre}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
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
      className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- Boutons */

type VarianteBouton = 'principal' | 'secondaire' | 'discret' | 'danger';

const STYLES_BOUTON: Record<VarianteBouton, string> = {
  principal: 'bg-accent text-white hover:bg-accent-fort disabled:bg-ink-3',
  secondaire: 'border border-line-fort bg-surface text-ink hover:bg-surface-2',
  discret: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'border border-alerte/40 bg-alerte-doux text-alerte hover:border-alerte',
};

const BASE_BOUTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';

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
  neutre: 'bg-surface-2 text-ink-2 border-line',
  accent: 'bg-accent-doux text-accent border-accent/25',
  ok: 'bg-ok-doux text-ok border-ok/25',
  attention: 'bg-attention-doux text-attention border-attention/25',
  alerte: 'bg-alerte-doux text-alerte border-alerte/25',
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES_PUCE[ton]} ${className}`}
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

export function Alerte({
  ton = 'alerte',
  children,
}: {
  ton?: 'alerte' | 'attention' | 'ok';
  children: ReactNode;
}) {
  const styles = {
    alerte: 'border-alerte/30 bg-alerte-doux text-alerte',
    attention: 'border-attention/30 bg-attention-doux text-attention',
    ok: 'border-ok/30 bg-ok-doux text-ok',
  }[ton];

  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
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
