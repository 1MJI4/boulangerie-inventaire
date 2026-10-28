'use client';

// src/components/ImprimanteTicket.tsx
//
// L'imprimante à l'écran pendant l'impression : un boîtier, un petit écran
// d'état, une fente, et le VRAI ticket qui en sort. L'image est celle qui part
// à l'imprimante (même PNG) : le vendeur voit sortir à l'écran le papier qu'il
// va décrocher.
//
// Synchronisation (28/10/2026) : le papier avance en continu, à la vitesse
// mesurée de l'imprimante (millisecondes par ligne de points, apprises à
// chaque impression, voir vitesseImpression.ts) et selon la longueur réelle de
// chaque ticket. Tant que l'imprimante n'a pas confirmé, il ralentit sans
// jamais finir ; à la confirmation, il termine de sortir en douceur. Le
// mouvement est piloté image par image (requestAnimationFrame), sans passer
// par React : fluide même sur une vieille tablette.

import { useEffect, useRef, useState } from 'react';

export type EtatImprimanteTicket = 'envoi' | 'impression' | 'fini' | 'bloque';

/** Ce qui est dans l'imprimante : les tickets d'un même envoi, dans l'ordre de sortie. */
export type LotImprime = {
  cle: string;
  tickets: { image: string; hauteur: number }[];
  /** Moment où l'imprimante a pris le lot. */
  debut: number;
  /** Durée attendue de sortie du lot complet, d'après la vitesse apprise. */
  dureeMs: number;
  /** L'imprimante a confirmé : tout est sorti. */
  fini: boolean;
};

/** Part du trajet couverte à la durée attendue ; le reste attend la confirmation. */
const AVANT_CONFIRMATION = 0.94;
/** Fin de sortie après la confirmation. */
const FINALE_MS = 450;

function Rouet() {
  return <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

/** Avancement du lot (0 → 1) à l'instant `t` depuis la prise, sans la confirmation. */
function avancementAttendu(t: number, dureeMs: number): number {
  if (t <= 0) return 0;
  if (t < dureeMs) return (AVANT_CONFIRMATION * t) / dureeMs;
  // Plus lente que prévu : on continue d'avancer, de moins en moins vite.
  return AVANT_CONFIRMATION + (0.99 - AVANT_CONFIRMATION) * (1 - Math.exp(-(t - dureeMs) / 2500));
}

export function ImprimanteTicket({
  etat,
  libelle,
  sortis,
  total,
  lot,
}: {
  etat: EtatImprimanteTicket;
  libelle: string;
  sortis: number;
  total: number;
  lot: LotImprime | null;
}) {
  const papier = useRef<HTMLDivElement>(null);
  const [rang, setRang] = useState(0);
  // Avancement affiché, gardé d'une image à l'autre pour la finale en douceur.
  const affiche = useRef(0);

  useEffect(() => {
    if (!lot || !lot.tickets.length) return;
    const lignes = lot.tickets.map((t) => Math.max(1, t.hauteur));
    const totalLignes = lignes.reduce((a, b) => a + b, 0);
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let finaleDepart: { le: number; de: number } | null = null;
    let rangCourant = -1;
    let image = 0;

    const dessiner = () => {
      const maintenant = performance.timeOrigin + performance.now();
      let p = avancementAttendu(maintenant - lot.debut, lot.dureeMs);
      if (lot.fini) {
        finaleDepart ??= { le: maintenant, de: Math.min(affiche.current, p) };
        const k = Math.min(1, (maintenant - finaleDepart.le) / FINALE_MS);
        // Décélération à l'arrivée : le papier se pose.
        p = finaleDepart.de + (1 - finaleDepart.de) * (1 - (1 - k) ** 3);
      }
      if (reduit) p = lot.fini ? 1 : p;
      p = Math.max(affiche.current, Math.min(1, p));
      affiche.current = p;

      // Quel ticket du lot est en train de sortir, et de combien.
      let reste = p * totalLignes;
      let i = 0;
      while (i < lignes.length - 1 && reste >= lignes[i]) {
        reste -= lignes[i];
        i++;
      }
      const fraction = Math.min(1, reste / lignes[i]);
      if (i !== rangCourant) {
        rangCourant = i;
        setRang(i);
      }
      if (papier.current) papier.current.style.transform = `translateY(${(fraction - 1) * 100}%)`;
      if (p < 1) image = requestAnimationFrame(dessiner);
    };
    image = requestAnimationFrame(dessiner);
    return () => cancelAnimationFrame(image);
  }, [lot]);

  // Nouveau lot : on repart de zéro.
  const cle = lot?.cle;
  useEffect(() => {
    affiche.current = 0;
  }, [cle]);

  const ticket = lot?.tickets[Math.min(rang, (lot?.tickets.length ?? 1) - 1)];

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
          <div key={`${cle}-${rang}`} ref={papier} className="papier" style={{ transform: 'translateY(-100%)' }}>
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
          will-change: transform;
          /* Bord coupé en dents de scie, comme au couteau de la thermique. */
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), ${dents()} 0 calc(100% - 6px));
        }
        .imprimante-ticket .libelle { animation: libelle-monte .16s ease-out; }
        .imprimante-ticket .pose { animation: pose .16s ease-out; }
        @keyframes libelle-monte { from { transform: translateY(4px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes pose { from { transform: scale(.4); } to { transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .imprimante-ticket .libelle, .imprimante-ticket .pose { animation: none; }
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
