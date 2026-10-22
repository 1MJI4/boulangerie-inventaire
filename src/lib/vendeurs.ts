'use client';

// src/lib/vendeurs.ts
//
// La tablette du comptoir est partagée : son profil dit « vendeur », il ne dit
// pas lequel. On demande donc le prénom à l'entrée de l'écran Commandes, et on
// le retient pour le service — pas à chaque commande, sinon c'est un tap de
// plus toutes les fois, avec un client en face.
//
// La liste vit sur l'appareil, jamais en base : l'application ne conserve
// aucun répertoire de personnel. Le prénom écrit sur une commande est effacé
// avec elle, au bout de trente jours.

import { useCallback, useEffect, useState } from 'react';

const CLE_LISTE = 'pa.commandes.equipe';
const CLE_ACTIF = 'pa.commandes.vendeur';

/** Au-delà, on redemande : un service ne dure pas douze heures. */
const DUREE_SERVICE_MS = 10 * 60 * 60 * 1000;

// Un seul prénom d'essai (22/10/2026) : chaque équipe ajoute ses propres prénoms
// sur sa tablette, et peut retirer ceux qui ne servent plus.
export const EQUIPE_PAR_DEFAUT = ['Test'];

type VendeurRetenu = { nom: string; depuis: number };

function lire<T>(cle: string): T | null {
  try {
    const brut = window.localStorage.getItem(cle);
    return brut === null ? null : (JSON.parse(brut) as T);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* navigation privée : le réglage vaut au moins pour la session */
  }
}

export function useEquipe() {
  const [equipe, setEquipe] = useState<string[]>(EQUIPE_PAR_DEFAUT);
  const [vendeur, setVendeurEtat] = useState<string | null>(null);
  const [prete, setPrete] = useState(false);

  useEffect(() => {
    const liste = lire<string[]>(CLE_LISTE);
    // Une liste enregistrée, même vide (tous les prénoms retirés), remplace celle par défaut.
    if (Array.isArray(liste)) setEquipe(liste);

    const retenu = lire<VendeurRetenu>(CLE_ACTIF);
    if (retenu && Date.now() - retenu.depuis < DUREE_SERVICE_MS) {
      setVendeurEtat(retenu.nom);
    }
    setPrete(true);
  }, []);

  const definirVendeur = useCallback((nom: string | null) => {
    setVendeurEtat(nom);
    if (nom === null) {
      try {
        window.localStorage.removeItem(CLE_ACTIF);
      } catch {
        /* rien à faire */
      }
      return;
    }
    ecrire(CLE_ACTIF, { nom, depuis: Date.now() } satisfies VendeurRetenu);
  }, []);

  const definirEquipe = useCallback((liste: string[]) => {
    const propre = [...new Set(liste.map((n) => n.trim()).filter(Boolean))];
    setEquipe(propre);
    ecrire(CLE_LISTE, propre);
  }, []);

  const ajouter = useCallback(
    (nom: string) => {
      const propre = nom.trim();
      if (!propre) return;
      setEquipe((actuelle) => {
        if (actuelle.some((n) => n.toLowerCase() === propre.toLowerCase())) return actuelle;
        const suivante = [...actuelle, propre];
        ecrire(CLE_LISTE, suivante);
        return suivante;
      });
    },
    []
  );

  const retirer = useCallback((nom: string) => {
    setEquipe((actuelle) => {
      const suivante = actuelle.filter((n) => n !== nom);
      ecrire(CLE_LISTE, suivante);
      return suivante;
    });
  }, []);

  return { equipe, vendeur, prete, definirVendeur, definirEquipe, ajouter, retirer };
}
