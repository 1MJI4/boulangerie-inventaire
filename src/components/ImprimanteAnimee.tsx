// src/components/ImprimanteAnimee.tsx
//
// Petite imprimante dont le papier sort en boucle pendant l'impression.
// Partagée par l'écran d'impression et le voyant en bas d'écran.

export function ImprimanteAnimee({ active, className = 'h-12 w-12' }: { active: boolean; className?: string }) {
  return (
    <>
      <svg aria-hidden viewBox="0 0 48 48" className={`imprimante-animee shrink-0 ${className} ${active ? 'active' : ''}`}>
        {/* Le papier est dessiné d'abord : caché derrière le corps, il sort par le bas. */}
        <g className="papier">
          <rect x="14" y="26" width="20" height="18" fill="#fff" stroke="currentColor" strokeWidth="2" />
          <path d="M18 35h12M18 39h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <rect x="13" y="6" width="22" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <rect x="6" y="14" width="36" height="16" rx="3" fill="currentColor" />
        <circle cx="36" cy="20" r="1.8" fill="#fff" className="voyant" />
      </svg>
      <style>{`
        .imprimante-animee .papier { transform: translateY(-8px); }
        .imprimante-animee .voyant { opacity: .4; }
        .imprimante-animee.active .papier { animation: papier-sort 1.6s ease-in-out infinite; }
        .imprimante-animee.active .voyant { animation: voyant 0.8s steps(2) infinite; }
        @keyframes papier-sort { 0% { transform: translateY(-14px); opacity: 1; } 70% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(3px); opacity: 0; } }
        @keyframes voyant { 0% { opacity: .2; } 100% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .imprimante-animee.active .papier, .imprimante-animee.active .voyant { animation: none; } }
      `}</style>
    </>
  );
}
