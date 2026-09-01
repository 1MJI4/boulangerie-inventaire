// src/lib/profils.ts
//
// Chaque tablette est dédiée à un poste : celle du comptoir au vendeur, celle
// du fournil au pâtissier. Plutôt que des comptes et des mots de passe — que
// personne ne tapera à 4h du matin et que tout le monde finirait par partager —
// l'appareil retient son profil, et n'affiche que les écrans de ce rôle.
//
// Ce n'est pas une barrière de sécurité : c'est un filtre qui évite qu'un
// vendeur atterrisse par erreur sur le catalogue. Les opérations destructrices
// restent protégées par le code de gestion, côté serveur.

import type { Poste } from './postes';

export const PROFILS = ['vendeur', 'patissier', 'boulanger', 'manager'] as const;
export type Profil = (typeof PROFILS)[number];

type DefinitionProfil = {
  libelle: string;
  description: string;
  /** Écran ouvert par défaut quand on arrive sur l'application. */
  accueil: string;
  /** Écrans visibles dans la barre de navigation, dans cet ordre. */
  ecrans: string[];
  /** Pour le fournil : le poste est imposé, l'onglet disparaît. */
  posteImpose?: Poste;
  /** Le passage à ce profil demande le code de gestion. */
  protege?: boolean;
};

export const DEFINITIONS: Record<Profil, DefinitionProfil> = {
  vendeur: {
    libelle: 'Vendeur',
    description: 'Compter ce qu’il reste en rayon',
    accueil: '/saisie-vendeur',
    ecrans: ['/saisie-vendeur'],
  },
  patissier: {
    libelle: 'Pâtissier',
    description: 'Viennoiserie, pâtisserie, makla et beignets',
    accueil: '/planification-demain',
    ecrans: ['/planification-demain', '/saisie-production'],
    posteImpose: 'patissier',
  },
  boulanger: {
    libelle: 'Boulanger',
    description: 'Pains, pains spéciaux et briochés',
    accueil: '/planification-demain',
    ecrans: ['/planification-demain', '/saisie-production'],
    posteImpose: 'boulanger',
  },
  manager: {
    libelle: 'Manager',
    description: 'Tous les écrans, prévisions et statistiques',
    accueil: '/',
    ecrans: [
      '/saisie-prevue',
      '/planification-demain',
      '/saisie-production',
      '/saisie-vendeur',
      '/inventaire',
      '/dashboard',
      '/historique-previsions',
      '/test-api',
    ],
    protege: true,
  },
};

export const LIBELLES_ECRANS: Record<string, string> = {
  '/': 'Accueil',
  '/saisie-prevue': 'Prévisions',
  '/planification-demain': 'Fournil',
  '/saisie-production': 'Production',
  '/saisie-vendeur': 'Comptage',
  '/inventaire': 'Inventaire',
  '/dashboard': 'Tableau de bord',
  '/historique-previsions': 'Historique',
  '/test-api': 'Catalogue',
};

export function estProfil(valeur: string | null | undefined): valeur is Profil {
  return !!valeur && (PROFILS as readonly string[]).includes(valeur);
}

/** L'accueil reste ouvert à tous : c'est de là qu'on change de profil. */
export function ecranAutorise(profil: Profil, chemin: string): boolean {
  if (chemin === '/') return true;
  return DEFINITIONS[profil].ecrans.some(
    (ecran) => chemin === ecran || chemin.startsWith(`${ecran}/`)
  );
}
