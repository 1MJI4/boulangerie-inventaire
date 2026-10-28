// src/components/signalement/niveaux.tsx
//
// Les trois niveaux de la LOI N°8, définis UNE SEULE FOIS. Tout écran qui
// affiche un refus, un avertissement ou une information passe par ici.
//
// Chaque niveau se distingue par TROIS canaux indépendants, pour rester
// reconnaissable en un quart de seconde, sans lecture, au soleil derrière une
// vitrine ou pour un employé daltonien :
//
//   | Niveau        | Forme d'icône        | Libellé    | Poids visuel                           |
//   |---------------|----------------------|------------|----------------------------------------|
//   | bloquant      | octogone (stop) + ✕  | « À corriger » | cadre épais 2 px + barre 8 px, pastille pleine |
//   | avertissement | triangle + !         | « Attention » | cadre 2 px + barre 8 px, pastille ambre |
//   | information   | cercle + i           | « Info »   | cadre fin 1 px, pas de pastille         |
//
// Le bloquant est cramoisi (`--bloquant`), jamais le rouge-orangé de l'accent :
// le rouge de l'enseigne est réservé aux prix (fiche design-ux).

import type { Niveau } from '@/domaine/resultat';

type Style = {
  /** Libellé texte du niveau — le canal qui ne dépend ni de la couleur ni de la forme. */
  libelle: string;
  /** Rôle ARIA : un refus interrompt le lecteur d'écran, le reste non. */
  role: 'alert' | 'status';
  cadre: string;
  icone: string;
  pastille: string;
};

export const NIVEAUX: Record<Niveau, Style> = {
  bloquant: {
    libelle: 'À corriger',
    role: 'alert',
    cadre: 'border-2 border-l-8 border-bloquant bg-bloquant-doux',
    icone: 'text-bloquant',
    pastille: 'bg-bloquant-plein text-bloquant-plein-texte',
  },
  avertissement: {
    libelle: 'Attention',
    role: 'status',
    cadre: 'border-2 border-l-8 border-avertissement-trait bg-avertissement-doux',
    icone: 'text-avertissement',
    pastille: 'bg-avertissement-plein text-ink',
  },
  information: {
    libelle: 'Info',
    role: 'status',
    cadre: 'border border-information-trait bg-information-doux',
    icone: 'text-information',
    pastille: 'text-information',
  },
};

/** Icône du niveau. Formes différentes, pas seulement couleurs. */
export function IconeNiveau({ niveau, className = '' }: { niveau: Niveau; className?: string }) {
  const commun = {
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: false,
    className: `shrink-0 ${className}`,
  } as const;

  if (niveau === 'bloquant') {
    return (
      <svg {...commun}>
        <path
          d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"
          fill="currentColor"
        />
        <path
          d="M8.5 8.5l7 7m0-7l-7 7"
          stroke="var(--bloquant-doux)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (niveau === 'avertissement') {
    return (
      <svg {...commun}>
        <path d="M12 2.5L23 21.5H1z" fill="currentColor" strokeLinejoin="round" />
        <path d="M12 9v6" stroke="var(--avertissement-doux)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="12" cy="18.2" r="1.5" fill="var(--avertissement-doux)" />
      </svg>
    );
  }
  return (
    <svg {...commun}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="7.6" r="1.5" fill="currentColor" />
      <path d="M12 11v6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
