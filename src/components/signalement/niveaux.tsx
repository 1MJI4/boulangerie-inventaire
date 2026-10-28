// src/components/signalement/niveaux.tsx
//
// Les trois niveaux de la LOI N°8, définis UNE SEULE FOIS. Tout écran qui
// affiche un refus, un avertissement ou une information passe par ici.
//
// Chaque niveau se distingue par TROIS canaux indépendants, pour rester
// reconnaissable en un quart de seconde, sans lecture, au soleil derrière une
// vitrine ou pour un employé daltonien :
//
//   | Niveau        | Forme d'icône     | Libellé        | Couleur              |
//   |---------------|-------------------|----------------|----------------------|
//   | bloquant      | cercle plein + !  | « À corriger » | rouge système iOS    |
//   | avertissement | triangle + !      | « Attention »  | orange système iOS   |
//   | information   | cercle vide + i   | « Info »       | bleu                 |
//
// Style Apple (propriétaire, 28/10/2026) : plus de cadres épais ni de barre
// latérale ; un fond à peine teinté, l'icône et le libellé en couleur, le
// message en encre.

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
    cadre: 'bg-bloquant-doux',
    icone: 'text-bloquant',
    pastille: 'text-bloquant',
  },
  avertissement: {
    libelle: 'Attention',
    role: 'status',
    cadre: 'bg-avertissement-doux',
    icone: 'text-avertissement',
    pastille: 'text-avertissement',
  },
  information: {
    libelle: 'Info',
    role: 'status',
    cadre: 'bg-information-doux',
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
        <circle cx="12" cy="12" r="10.5" fill="currentColor" />
        <path d="M12 6.8v6.4" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.5" fill="#fff" />
      </svg>
    );
  }
  if (niveau === 'avertissement') {
    return (
      <svg {...commun}>
        <path d="M12 2.5L23 21.5H1z" fill="currentColor" strokeLinejoin="round" />
        <path d="M12 9v6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="12" cy="18.2" r="1.5" fill="#fff" />
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
