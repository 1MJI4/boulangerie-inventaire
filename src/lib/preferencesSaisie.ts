'use client';

// src/lib/preferencesSaisie.ts
//
// Le comptage se fait debout, à une main, sur un téléphone ou une petite
// tablette. Il n'y a pas de disposition qui convienne à tout le monde :
// chacun règle la sienne une fois, et l'appareil s'en souvient.

import { useCallback, useEffect, useState } from 'react';

export type Main = 'droite' | 'gauche';
export type Densite = 'compact' | 'confortable';
export type ModeAffichage = 'liste' | 'focus';
export type Tri = 'feuille' | 'parcours' | 'restants';
export type Clavier = 'natif' | 'pave';
/** 'auto' reprend le comportement d'origine : 1 colonne au téléphone, 2 sur petite tablette, 3 en grand. */
export type Colonnes = 'auto' | '1' | '2';
/** Pages de taille fixe suivant l'ordre choisi, ou pages calées sur les zones du magasin. */
export type Decoupage = 'pages' | 'zones';

export type Preferences = {
  main: Main;
  densite: Densite;
  mode: ModeAffichage;
  tri: Tri;
  clavier: Clavier;
  colonnes: Colonnes;
  decoupage: Decoupage;
};

export const PREFERENCES_PAR_DEFAUT: Preferences = {
  main: 'droite',
  densite: 'confortable',
  mode: 'liste',
  tri: 'feuille',
  clavier: 'natif',
  colonnes: 'auto',
  decoupage: 'pages',
};

export const LIBELLES = {
  main: { droite: 'Droitier', gauche: 'Gaucher' },
  densite: { compact: 'Compact', confortable: 'Confortable' },
  mode: { liste: 'Liste', focus: 'Un par un' },
  tri: {
    feuille: 'Ordre de la feuille',
    parcours: 'Mon parcours',
    restants: 'À compter d’abord',
  },
  clavier: { natif: 'Clavier du téléphone', pave: 'Pavé de l’application' },
  colonnes: { auto: 'Adaptatif', '1': 'Une colonne', '2': 'Deux colonnes' },
  decoupage: { pages: 'Pages', zones: 'Par zones' },
} as const;

export const EXPLICATIONS = {
  main: 'Place le pavé et les boutons du côté du pouce.',
  densite: 'Compact montre plus de produits ; confortable agrandit les cibles.',
  mode: 'Un par un affiche un seul produit en grand et passe au suivant tout seul.',
  tri: 'Mon parcours suit le trajet enregistré dans le magasin. À compter d’abord remonte ce qui n’a pas encore été saisi.',
  clavier: 'Le pavé de l’application reste sous le pouce et évite que le clavier recouvre la liste.',
  colonnes:
    'Adaptatif met deux colonnes au téléphone et trois sur grand écran. Une colonne affiche les noms entiers, sans troncature.',
  decoupage:
    'Pages découpe toute la liste en tranches égales, dans l’ordre choisi — un parcours reste suivi de bout en bout. Par zones cale les pages sur les rayons du magasin.',
} as const;

const CLE = 'boulangerie:preferences-saisie';

function lire(): Preferences {
  if (typeof window === 'undefined') return PREFERENCES_PAR_DEFAUT;
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return PREFERENCES_PAR_DEFAUT;
    const enregistre = JSON.parse(brut) as Partial<Preferences>;
    // Fusion avec les valeurs par défaut : une préférence ajoutée plus tard
    // ne casse pas les réglages déjà enregistrés sur les tablettes.
    return { ...PREFERENCES_PAR_DEFAUT, ...enregistre };
  } catch {
    return PREFERENCES_PAR_DEFAUT;
  }
}

export function usePreferencesSaisie() {
  // Premier rendu identique au serveur, puis lecture réelle : sans cela le
  // rendu serveur et le rendu client divergent et React se plaint.
  const [preferences, setPreferences] = useState<Preferences>(PREFERENCES_PAR_DEFAUT);
  const [pretes, setPretes] = useState(false);

  useEffect(() => {
    setPreferences(lire());
    setPretes(true);
  }, []);

  const definir = useCallback(<C extends keyof Preferences>(cle: C, valeur: Preferences[C]) => {
    setPreferences((precedentes) => {
      const suivantes = { ...precedentes, [cle]: valeur };
      try {
        window.localStorage.setItem(CLE, JSON.stringify(suivantes));
      } catch {
        /* le réglage reste valable pour la session en cours */
      }
      return suivantes;
    });
  }, []);

  const reinitialiser = useCallback(() => {
    setPreferences(PREFERENCES_PAR_DEFAUT);
    try {
      window.localStorage.removeItem(CLE);
    } catch {
      /* sans effet */
    }
  }, []);

  return { preferences, definir, reinitialiser, pretes };
}
