'use client';

import { useEffect, useState } from 'react';
import type { StatutSauvegarde } from '@/lib/useSaisieJournee';

function ilYA(instant: Date, maintenant: number): string {
  const secondes = Math.max(0, Math.round((maintenant - instant.getTime()) / 1000));
  if (secondes < 10) return "à l'instant";
  if (secondes < 60) return `il y a ${secondes} s`;
  const minutes = Math.round(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  return instant.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Le vendeur doit pouvoir vérifier d'un coup d'œil que son comptage est
 * bien parti. Un message qui disparaît au bout de trois secondes ne le
 * permet pas : ce badge reste affiché en permanence.
 */
export function IndicateurSauvegarde({
  statut,
  derniereSauvegarde,
  nbEnAttente,
  messageErreur,
  onReessayer,
}: {
  statut: StatutSauvegarde;
  derniereSauvegarde: Date | null;
  nbEnAttente: number;
  messageErreur?: string | null;
  onReessayer?: () => void;
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const contenu = {
    vierge: { texte: 'Rien à enregistrer', point: 'bg-ink-3', couleur: 'text-ink-2' },
    brouillon: {
      texte: `${nbEnAttente} modification${nbEnAttente > 1 ? 's' : ''} à enregistrer`,
      point: 'bg-attention',
      couleur: 'text-attention',
    },
    envoi: { texte: 'Enregistrement…', point: 'bg-accent animate-pulse', couleur: 'text-ink-2' },
    enregistre: {
      texte: derniereSauvegarde ? `Enregistré ${ilYA(derniereSauvegarde, maintenant)}` : 'Enregistré',
      point: 'bg-ok',
      couleur: 'text-ok',
    },
    'hors-ligne': {
      texte: `Hors ligne — ${nbEnAttente} saisie${nbEnAttente > 1 ? 's' : ''} en attente`,
      point: 'bg-attention',
      couleur: 'text-attention',
    },
    echec: {
      texte: `Échec — ${nbEnAttente} saisie${nbEnAttente > 1 ? 's' : ''} conservée${nbEnAttente > 1 ? 's' : ''}`,
      point: 'bg-alerte',
      couleur: 'text-alerte',
    },
  }[statut];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`inline-flex items-center gap-2 text-xs font-medium ${contenu.couleur}`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${contenu.point}`} />
        {contenu.texte}
      </span>

      {statut === 'echec' && onReessayer ? (
        <button
          type="button"
          onClick={onReessayer}
          className="text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-fort"
        >
          Réessayer
        </button>
      ) : null}

      {statut === 'echec' && messageErreur ? (
        <span className="w-full text-xs text-ink-3">{messageErreur}</span>
      ) : null}
    </div>
  );
}
