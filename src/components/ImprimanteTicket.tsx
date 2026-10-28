// src/components/ImprimanteTicket.tsx
//
// L'imprimante à l'écran pendant l'impression : un boîtier, un petit écran
// d'état, une fente, et le VRAI ticket qui en sort par à-coups, comme sur la
// thermique. L'image est celle qui part à l'imprimante (même canvas que
// l'aperçu) : le vendeur voit sortir à l'écran le papier qu'il va décrocher.

export type EtatImprimanteTicket = 'envoi' | 'impression' | 'fini' | 'bloque';

/** Durée de sortie d'un ticket à l'écran (le papier avance en 24 à-coups). */
export const SORTIE_TICKET_MS = 2400;

function Rouet() {
  return <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

export function ImprimanteTicket({
  etat,
  libelle,
  sortis,
  total,
  ticket,
}: {
  etat: EtatImprimanteTicket;
  libelle: string;
  sortis: number;
  total: number;
  /**
   * Le ticket à montrer sous la fente : son image, et s'il est en train de
   * sortir (animé) ou déjà sorti (posé). Absent : rien ne dépasse encore.
   */
  ticket?: { cle: string; image: string; sort: boolean } | null;
}) {
  return (
    <div className="imprimante-ticket mx-auto w-64 select-none" aria-hidden>
      <div className="corps relative rounded-2xl border border-line bg-surface-2 px-4 pt-3 pb-5 shadow-lg">
        <div className="flex min-h-9 items-center gap-2 rounded-lg bg-[#1d1c19] px-3 py-1.5 text-xs font-medium text-white">
          {etat === 'fini' ? (
            <span className="pose grid h-4 w-4 place-items-center rounded-full bg-ok text-[10px] text-white">✓</span>
          ) : etat === 'bloque' ? (
            <span className="pose grid h-4 w-4 place-items-center rounded-full bg-attention text-[10px] text-white">!</span>
          ) : (
            <Rouet />
          )}
          <span key={libelle} className="libelle truncate">
            {libelle}
          </span>
          {total > 0 && etat !== 'envoi' ? (
            <span className="chiffres ml-auto text-white/70">
              {sortis}/{total}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-6 bottom-2 h-1.5 rounded-full bg-[#1d1c19]" />
      </div>
      {/* Sous la fente : le ticket descend de l'intérieur de la machine. */}
      <div className="sortie relative mx-auto w-48 overflow-hidden">
        {ticket ? (
          <div key={ticket.cle} className={`papier ${ticket.sort ? 'sort' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- image locale (data:), pas d'optimisation possible */}
            <img src={ticket.image} alt="" className="block w-full" draggable={false} />
          </div>
        ) : null}
      </div>
      <style>{`
        .imprimante-ticket .corps { z-index: 1; }
        .imprimante-ticket .sortie { margin-top: -6px; max-height: 300px; min-height: 12px;
          -webkit-mask-image: linear-gradient(to bottom, #000 75%, transparent);
                  mask-image: linear-gradient(to bottom, #000 75%, transparent); }
        .imprimante-ticket .papier {
          background: #fff; box-shadow: 0 6px 14px rgba(0,0,0,.18); padding-bottom: 6px;
          /* Bord coupé en dents de scie, comme au couteau de la thermique. */
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), ${dents()} 0 calc(100% - 6px));
        }
        .imprimante-ticket .papier.sort { animation: ticket-sort ${SORTIE_TICKET_MS}ms steps(24, end) both; }
        .imprimante-ticket .libelle { animation: libelle-monte .16s ease-out; }
        .imprimante-ticket .pose { animation: pose .16s ease-out; }
        @keyframes ticket-sort {
          0% { transform: translateY(-100%); opacity: 0; }
          6% { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes libelle-monte { from { transform: translateY(4px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes pose { from { transform: scale(.4); } to { transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .imprimante-ticket .papier.sort, .imprimante-ticket .libelle, .imprimante-ticket .pose { animation: none; }
        }
      `}</style>
    </div>
  );
}

/** Points du bas du ticket en zigzag, de droite à gauche (pour clip-path). */
function dents(): string {
  const n = 16;
  const points: string[] = [];
  for (let i = n; i > 0; i--) {
    const x = (i / n) * 100;
    const milieu = ((i - 0.5) / n) * 100;
    points.push(`${x}% calc(100% - 6px)`, `${milieu}% 100%`);
  }
  return points.join(', ') + ',';
}
