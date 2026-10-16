'use client';

// src/lib/preferencesSaisie.ts
//
// Le comptage se fait debout, à une main, sur un téléphone ou une petite
// tablette. Il n'y a pas de disposition qui convienne à tout le monde :
// chacun règle la sienne une fois, et l'appareil s'en souvient.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

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

// Petit magasin en mémoire, partagé par tous les écrans ouverts : un réglage
// changé à un endroit est vu partout, sans relecture ni état périmé.
const abonnesPreferences = new Set<() => void>();
let preferencesSession: Preferences | null = null;

function abonnerPreferences(rappel: () => void) {
  abonnesPreferences.add(rappel);
  return () => {
    abonnesPreferences.delete(rappel);
  };
}

function instantanePreferences(): Preferences {
  if (preferencesSession === null) preferencesSession = lire();
  return preferencesSession;
}

function enregistrerPreferences(suivantes: Preferences | null) {
  preferencesSession = suivantes ?? PREFERENCES_PAR_DEFAUT;
  try {
    if (suivantes) window.localStorage.setItem(CLE, JSON.stringify(suivantes));
    else window.localStorage.removeItem(CLE);
  } catch {
    /* le réglage reste valable pour la session en cours */
  }
  abonnesPreferences.forEach((rappel) => rappel());
}

const pasDAbonnement = () => () => {};

export function usePreferencesSaisie() {
  // Rendu serveur (et hydratation) avec les valeurs par défaut, puis lecture
  // réelle côté client : sans cela les deux rendus divergent et React se plaint.
  const enregistrees = useSyncExternalStore(abonnerPreferences, instantanePreferences, () => PREFERENCES_PAR_DEFAUT);
  const pretes = useSyncExternalStore(
    pasDAbonnement,
    () => true,
    () => false,
  );
  // « Droitier / Gaucher » n'a qu'une source de vérité : `cotePave`. La valeur
  // `main` encore présente dans l'ancien enregistrement est ignorée (migrée une
  // fois par `lireCotePave`).
  const [cote] = useCotePave();
  const preferences = useMemo<Preferences>(() => ({ ...enregistrees, main: cote }), [enregistrees, cote]);

  const definir = useCallback(<C extends keyof Preferences>(cle: C, valeur: Preferences[C]) => {
    if (cle === 'main') {
      definirCotePave(valeur as CotePave);
      return;
    }
    enregistrerPreferences({ ...instantanePreferences(), [cle]: valeur });
  }, []);

  const reinitialiser = useCallback(() => {
    enregistrerPreferences(null);
    definirCotePave(COTE_PAVE_PAR_DEFAUT);
  }, []);

  return { preferences, definir, reinitialiser, pretes };
}

// ---------------------------------------------------------------------------
// Côté du pavé de l'application (droitier / gaucher)
//
// Préférence à part, sous sa propre clé : plusieurs écrans l'affichent en même
// temps (disposition + bouton de bascule dans l'en-tête), ils doivent rester
// synchronisés sans que l'un écrase les autres préférences avec un état périmé.
// ---------------------------------------------------------------------------

export type CotePave = 'droite' | 'gauche';

export const COTE_PAVE_PAR_DEFAUT: CotePave = 'droite';

const CLE_COTE_PAVE = 'boulangerie:cote-pave';

/**
 * Côté du pavé à partir de ce qui est enregistré. Pur, testable.
 * Rien d'enregistré → on reprend le réglage « Droitier / Gaucher » déjà fait
 * sur l'appareil, sinon droitier.
 */
export function cotePaveDepuisStockage(brutCote: string | null, brutPreferences: string | null): CotePave {
  if (brutCote === 'droite' || brutCote === 'gauche') return brutCote;
  if (brutPreferences) {
    try {
      const main = (JSON.parse(brutPreferences) as Partial<Preferences> | null)?.main;
      if (main === 'droite' || main === 'gauche') return main;
    } catch {
      /* préférences illisibles : défaut */
    }
  }
  return COTE_PAVE_PAR_DEFAUT;
}

function lireCotePave(): CotePave {
  if (typeof window === 'undefined') return COTE_PAVE_PAR_DEFAUT;
  try {
    const brutCote = window.localStorage.getItem(CLE_COTE_PAVE);
    const cote = cotePaveDepuisStockage(brutCote, window.localStorage.getItem(CLE));
    // Migration unique de l'ancien réglage `main` : écrit sous la nouvelle clé,
    // il ne sera plus jamais relu.
    if (brutCote !== cote) window.localStorage.setItem(CLE_COTE_PAVE, cote);
    return cote;
  } catch {
    return COTE_PAVE_PAR_DEFAUT;
  }
}

const abonnesCotePave = new Set<() => void>();
let cotePaveSession: CotePave | null = null;

function abonnerCotePave(rappel: () => void) {
  abonnesCotePave.add(rappel);
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE_COTE_PAVE || e.key === null) {
      cotePaveSession = null;
      rappel();
    }
  };
  window.addEventListener('storage', surStockage);
  return () => {
    abonnesCotePave.delete(rappel);
    window.removeEventListener('storage', surStockage);
  };
}

function instantaneCotePave(): CotePave {
  if (cotePaveSession === null) cotePaveSession = lireCotePave();
  return cotePaveSession;
}

/** Enregistre le côté du pavé (best-effort) et prévient tous les écrans abonnés. */
export function definirCotePave(cote: CotePave) {
  cotePaveSession = cote;
  try {
    window.localStorage.setItem(CLE_COTE_PAVE, cote);
  } catch {
    /* le réglage reste valable pour la session en cours */
  }
  abonnesCotePave.forEach((rappel) => rappel());
}

/** `[cote, definir]` — droitier par défaut ; rendu serveur toujours « droite ». */
export function useCotePave(): [CotePave, (cote: CotePave) => void] {
  const cote = useSyncExternalStore(abonnerCotePave, instantaneCotePave, () => COTE_PAVE_PAR_DEFAUT);
  return [cote, definirCotePave];
}
