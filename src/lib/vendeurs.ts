'use client';

// src/lib/vendeurs.ts
//
// La tablette du comptoir est partagée : son profil dit « vendeur », il ne dit
// pas lequel. Décisions du propriétaire (14/11/2026) :
//
//   1. le prénom se choisit (ou s'écrit) À CHAQUE commande, juste avant
//      « Valider ». Il n'est JAMAIS présélectionné : un prénom déjà coché ferait
//      signer la commande par la vendeuse précédente sans que personne s'en
//      aperçoive ;
//   2. les prénoms de ceux qui ont pris une commande AUJOURD'HUI restent
//      proposés toute la journée (un toucher pour la commande suivante). Le
//      lendemain, la liste repart vide : chacun écrit son prénom à sa première
//      commande du jour.
//
// La liste vit sur l'appareil, jamais en base : l'application ne conserve
// aucun répertoire de personnel. Le prénom écrit sur une commande est effacé
// avec elle, au bout de trente jours.

import { useCallback, useEffect, useState } from 'react';

/** Prénoms du jour : { jour: 'AAAA-MM-JJ', noms: [...] }. */
const CLE_JOUR = 'pa.commandes.equipe.jour';
/** Anciennes mémoires (liste permanente, « vendeur du service ») : plus lues, effacées au passage. */
const CLES_OBSOLETES = ['pa.commandes.equipe', 'pa.commandes.vendeur'];

type PrenomsDuJour = { jour: string; noms: string[] };

/** Jour de l'appareil, « AAAA-MM-JJ » (heure locale de la tablette). */
function jourAppareil(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

function lireDuJour(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE_JOUR);
    if (brut === null) return [];
    const lu = JSON.parse(brut) as Partial<PrenomsDuJour> | null;
    if (!lu || lu.jour !== jourAppareil() || !Array.isArray(lu.noms)) return [];
    return lu.noms.filter((n): n is string => typeof n === 'string' && n.trim() !== '');
  } catch {
    return [];
  }
}

function ecrireDuJour(noms: string[]) {
  try {
    window.localStorage.setItem(CLE_JOUR, JSON.stringify({ jour: jourAppareil(), noms } satisfies PrenomsDuJour));
  } catch {
    /* navigation privée : la liste vaut au moins pour l'écran ouvert */
  }
}

export function useEquipe() {
  /** Prénoms proposés : ceux qui ont déjà signé une commande aujourd'hui sur cette tablette. */
  const [equipe, setEquipe] = useState<string[]>([]);
  const [vendeur, setVendeurEtat] = useState<string | null>(null);
  const [prete, setPrete] = useState(false);

  useEffect(() => {
    for (const cle of CLES_OBSOLETES) {
      try {
        window.localStorage.removeItem(cle);
      } catch {
        /* rien à faire */
      }
    }
    // Lecture de l'appareil après le premier rendu (pas de stockage côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEquipe(lireDuJour());
    setPrete(true);
  }, []);

  /** Le prénom choisi pour CET écran : jamais écrit comme « vendeur en cours ». */
  const definirVendeur = useCallback((nom: string | null) => {
    setVendeurEtat(nom);
  }, []);

  /** Ajoute un prénom à la liste du jour (sans doublon, casse ignorée). */
  const ajouter = useCallback((nom: string) => {
    const propre = nom.trim();
    if (!propre) return;
    // Relu sur l'appareil : un autre écran a pu ajouter un prénom, ou minuit est passé.
    const actuelle = lireDuJour();
    const suivante = actuelle.some((n) => n.toLowerCase() === propre.toLowerCase()) ? actuelle : [...actuelle, propre];
    ecrireDuJour(suivante);
    setEquipe(suivante);
  }, []);

  /** Retire un prénom de la liste du jour (faute de frappe). */
  const retirer = useCallback((nom: string) => {
    const suivante = lireDuJour().filter((n) => n !== nom);
    ecrireDuJour(suivante);
    setEquipe(suivante);
  }, []);

  return { equipe, vendeur, prete, definirVendeur, ajouter, retirer };
}
