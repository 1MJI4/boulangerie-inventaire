'use client';

import { decalerJours, formatDateLong, formatDateRelative } from '@/lib/dateProduction';

/**
 * La date de travail était implicite partout — c'est ce qui rendait
 * invisible le décalage entre ce que saisissait le manager et ce que
 * lisait le fournil. Elle est désormais affichée et modifiable.
 */
export function SelecteurJournee({
  date,
  onChange,
  libelle = 'Journée',
}: {
  date: string;
  onChange: (date: string) => void;
  libelle?: string;
}) {
  const relatif = formatDateRelative(date);
  const complet = formatDateLong(date);

  return (
    <div className="flex items-center gap-1 rounded-xl border border-transparent bg-surface p-1">
      <button
        type="button"
        onClick={() => onChange(decalerJours(date, -1))}
        aria-label="Journée précédente"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <span aria-hidden>‹</span>
      </button>

      <div className="min-w-0 px-2 text-center">
        <div className="text-[11px] uppercase tracking-wide text-ink-3">{libelle}</div>
        <div className="truncate text-sm font-medium capitalize text-ink" title={complet}>
          {relatif}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(decalerJours(date, 1))}
        aria-label="Journée suivante"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}
