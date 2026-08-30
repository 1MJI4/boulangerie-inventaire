'use client';

// src/lib/parcours.ts
//
// Un vendeur ne compte pas dans l'ordre de la feuille : il tourne dans le
// magasin, vitrine par vitrine, et son trajet est toujours le même. Plutôt
// que de lui imposer un ordre, l'application observe celui qu'il suit, le lui
// propose à l'enregistrement, et peut ensuite classer la liste dessus.
//
// Tout reste sur l'appareil : chaque tablette garde les parcours de la
// personne qui l'utilise.

import { useCallback, useEffect, useState } from 'react';

export type Parcours = {
  id: string;
  nom: string;
  /** Identifiants produits, dans l'ordre où ils ont été comptés. */
  produitIds: number[];
  creeLe: string;
};

const CLE_PARCOURS = 'boulangerie:parcours';
const CLE_DEFAUT = 'boulangerie:parcours-defaut';

function cleEnregistrement(date: string) {
  return `boulangerie:ordre-saisie:${date}`;
}

function lireJSON<T>(cle: string, secours: T): T {
  if (typeof window === 'undefined') return secours;
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : secours;
  } catch {
    return secours;
  }
}

function ecrireJSON(cle: string, valeur: unknown) {
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* navigation privée ou quota plein : le parcours n'est pas critique */
  }
}

/**
 * Classe des produits selon un parcours. Ceux qui n'y figurent pas (produit
 * ajouté depuis, ou jamais compté ce jour-là) passent à la fin, dans l'ordre
 * de la feuille — ils restent visibles au lieu de disparaître.
 */
export function classerSelonParcours<T extends { id: number; ordre: number }>(
  produits: T[],
  produitIds: number[]
): T[] {
  const rang = new Map(produitIds.map((id, index) => [id, index]));
  return [...produits].sort((a, b) => {
    const ra = rang.get(a.id) ?? Number.POSITIVE_INFINITY;
    const rb = rang.get(b.id) ?? Number.POSITIVE_INFINITY;
    return ra - rb || a.ordre - b.ordre;
  });
}

export function useParcours(date: string) {
  const [parcours, setParcours] = useState<Parcours[]>([]);
  const [idParDefaut, setIdParDefaut] = useState<string | null>(null);
  const [ordreEnCours, setOrdreEnCours] = useState<number[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    setParcours(lireJSON<Parcours[]>(CLE_PARCOURS, []));
    setIdParDefaut(lireJSON<string | null>(CLE_DEFAUT, null));
    setPret(true);
  }, []);

  // L'ordre en cours est propre à la journée : on le recharge au changement
  // de date pour qu'un comptage repris après un rechargement continue.
  useEffect(() => {
    setOrdreEnCours(lireJSON<number[]>(cleEnregistrement(date), []));
  }, [date]);

  /** Appelé à chaque première saisie d'un produit : construit le trajet. */
  const noterPassage = useCallback(
    (produitId: number) => {
      setOrdreEnCours((precedent) => {
        if (precedent.includes(produitId)) return precedent;
        const suivant = [...precedent, produitId];
        ecrireJSON(cleEnregistrement(date), suivant);
        return suivant;
      });
    },
    [date]
  );

  const oublierPassage = useCallback(
    (produitId: number) => {
      setOrdreEnCours((precedent) => {
        if (!precedent.includes(produitId)) return precedent;
        const suivant = precedent.filter((id) => id !== produitId);
        ecrireJSON(cleEnregistrement(date), suivant);
        return suivant;
      });
    },
    [date]
  );

  const reinitialiserOrdre = useCallback(() => {
    setOrdreEnCours([]);
    ecrireJSON(cleEnregistrement(date), []);
  }, [date]);

  const enregistrer = useCallback(
    (nom: string, produitIds: number[]) => {
      const nouveau: Parcours = {
        id: `p${Date.now().toString(36)}`,
        nom: nom.trim() || 'Mon parcours',
        produitIds,
        creeLe: new Date().toISOString(),
      };
      setParcours((precedent) => {
        const suivant = [...precedent, nouveau];
        ecrireJSON(CLE_PARCOURS, suivant);
        return suivant;
      });
      return nouveau;
    },
    []
  );

  const remplacer = useCallback((id: string, produitIds: number[]) => {
    setParcours((precedent) => {
      const suivant = precedent.map((p) =>
        p.id === id ? { ...p, produitIds, creeLe: new Date().toISOString() } : p
      );
      ecrireJSON(CLE_PARCOURS, suivant);
      return suivant;
    });
  }, []);

  const renommer = useCallback((id: string, nom: string) => {
    setParcours((precedent) => {
      const suivant = precedent.map((p) => (p.id === id ? { ...p, nom: nom.trim() || p.nom } : p));
      ecrireJSON(CLE_PARCOURS, suivant);
      return suivant;
    });
  }, []);

  const supprimer = useCallback((id: string) => {
    setParcours((precedent) => {
      const suivant = precedent.filter((p) => p.id !== id);
      ecrireJSON(CLE_PARCOURS, suivant);
      return suivant;
    });
    setIdParDefaut((precedent) => {
      if (precedent !== id) return precedent;
      ecrireJSON(CLE_DEFAUT, null);
      return null;
    });
  }, []);

  const definirParDefaut = useCallback((id: string | null) => {
    setIdParDefaut(id);
    ecrireJSON(CLE_DEFAUT, id);
  }, []);

  return {
    parcours,
    idParDefaut,
    ordreEnCours,
    pret,
    noterPassage,
    oublierPassage,
    reinitialiserOrdre,
    enregistrer,
    remplacer,
    renommer,
    supprimer,
    definirParDefaut,
  };
}
