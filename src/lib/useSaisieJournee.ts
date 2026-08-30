'use client';

// src/lib/useSaisieJournee.ts
//
// Toute la saisie de la boulangerie passe par ce hook. Il tient trois promesses :
//
//   1. Seuls les champs réellement modifiés partent en base. Un champ laissé
//      vide reste vide — il n'est jamais transformé en 0. C'est la différence
//      entre « il n'en reste plus » et « personne n'a encore compté ».
//   2. Chaque frappe est écrite dans un brouillon local. Batterie à plat,
//      onglet fermé, tunnel réseau : la saisie est retrouvée au rechargement.
//   3. L'enregistrement se déclenche tout seul, et l'écran dit toujours où
//      il en est — y compris quand ça a échoué.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Poste } from './postes';

export type ChampSaisie = 'quantiteRestante' | 'quantiteProduite' | 'quantitePrevue';

export type Produit = {
  id: number;
  nom: string;
  ordre: number;
  categorie: string;
  poste: Poste;
};

export type LigneInventaire = {
  produitId: number;
  quantiteRestante: number | null;
  quantiteProduite: number | null;
  quantitePrevue: number | null;
  faitLe: string | null;
};

export type StatutSauvegarde =
  | 'vierge'
  | 'brouillon'
  | 'envoi'
  | 'enregistre'
  | 'echec'
  | 'hors-ligne';

const DELAI_AUTO_MS = 1500;
const VERSION_BROUILLON = 1;

type Brouillon = {
  v: number;
  date: string;
  champ: ChampSaisie;
  valeurs: Record<string, string>;
  modifies: number[];
  horodatage: number;
};

function cleBrouillon(champ: ChampSaisie, date: string) {
  return `boulangerie:brouillon:${champ}:${date}`;
}

function lireBrouillon(champ: ChampSaisie, date: string): Brouillon | null {
  if (typeof window === 'undefined') return null;
  try {
    const brut = window.localStorage.getItem(cleBrouillon(champ, date));
    if (!brut) return null;
    const b = JSON.parse(brut) as Brouillon;
    if (b?.v !== VERSION_BROUILLON || b.date !== date || b.champ !== champ) return null;
    return b;
  } catch {
    return null; // navigation privée, quota plein : on continue sans brouillon
  }
}

function ecrireBrouillon(b: Brouillon) {
  try {
    window.localStorage.setItem(cleBrouillon(b.champ, b.date), JSON.stringify(b));
  } catch {
    /* le brouillon est un confort, jamais un prérequis */
  }
}

function effacerBrouillon(champ: ChampSaisie, date: string) {
  try {
    window.localStorage.removeItem(cleBrouillon(champ, date));
  } catch {
    /* idem */
  }
}

/** Nettoie une frappe : on ne garde que des entiers positifs, 4 chiffres max. */
export function nettoyerQuantite(saisie: string): string {
  const chiffres = saisie.replace(/[^\d]/g, '').slice(0, 4);
  return chiffres.replace(/^0+(?=\d)/, '');
}

export function useSaisieJournee({
  date,
  champ,
  poste,
  actif = true,
}: {
  date: string;
  champ: ChampSaisie;
  poste?: Poste;
  actif?: boolean;
}) {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [inventaires, setInventaires] = useState<Map<number, LigneInventaire>>(new Map());
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [statut, setStatut] = useState<StatutSauvegarde>('vierge');
  const [derniereSauvegarde, setDerniereSauvegarde] = useState<Date | null>(null);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);

  // Les identifiants dont la valeur a été touchée depuis le dernier envoi réussi.
  const modifies = useRef<Set<number>>(new Set());
  const [nbEnAttente, setNbEnAttente] = useState(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envoiEnCours = useRef(false);

  // Miroir des valeurs, écrit au chargement puis à chaque frappe. Il sert à
  // lire l'état le plus récent sans dépendre du cycle de rendu — indispensable
  // pour comparer, au retour d'une requête, ce qui a été envoyé et ce qui a
  // été tapé entre-temps. On ne le réaligne jamais pendant le rendu : un rendu
  // déclenché par ailleurs le ferait reculer d'une frappe.
  const valeursRef = useRef(valeurs);

  const synchroniserCompteur = useCallback(() => {
    setNbEnAttente(modifies.current.size);
  }, []);

  /* ------------------------------------------------------------ Chargement */

  const charger = useCallback(async () => {
    if (!actif) return;
    setChargement(true);
    setErreurChargement(null);

    try {
      const paramsProduits = new URLSearchParams();
      if (poste) paramsProduits.set('poste', poste);

      const [repProduits, repInventaires] = await Promise.all([
        fetch(`/api/produits?${paramsProduits}`),
        fetch(`/api/inventaires?date=${date}${poste ? `&poste=${poste}` : ''}`),
      ]);

      if (!repProduits.ok || !repInventaires.ok) {
        throw new Error('Réponse invalide du serveur');
      }

      const listeProduits: Produit[] = await repProduits.json();
      const listeInventaires: (LigneInventaire & { produit: Produit })[] =
        await repInventaires.json();

      const parProduit = new Map<number, LigneInventaire>(
        listeInventaires.map((i) => [Number(i.produitId), i])
      );

      // Les valeurs déjà en base réapparaissent à l'écran. C'est ce qui
      // permet de reprendre un comptage interrompu au lieu de tout refaire.
      const depuisServeur: Record<string, string> = {};
      for (const produit of listeProduits) {
        const valeur = parProduit.get(produit.id)?.[champ];
        depuisServeur[produit.id] = valeur === null || valeur === undefined ? '' : String(valeur);
      }

      // Un brouillon local plus récent l'emporte sur ce que dit le serveur :
      // il contient forcément des frappes qui n'ont pas encore pu partir.
      const brouillon = lireBrouillon(champ, date);
      if (brouillon) {
        modifies.current = new Set(brouillon.modifies);
        for (const id of brouillon.modifies) {
          if (brouillon.valeurs[id] !== undefined) depuisServeur[id] = brouillon.valeurs[id];
        }
        if (brouillon.modifies.length > 0) setStatut('brouillon');
      }

      setProduits(listeProduits);
      setInventaires(parProduit);
      valeursRef.current = depuisServeur;
      setValeurs(depuisServeur);
      synchroniserCompteur();
    } catch (e) {
      console.error(e);
      setErreurChargement(
        "Impossible de charger les données. Vérifiez la connexion, puis réessayez."
      );
    } finally {
      setChargement(false);
    }
  }, [actif, champ, date, poste, synchroniserCompteur]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /* ---------------------------------------------------------- Enregistrement */

  const envoyer = useCallback(async (): Promise<boolean> => {
    if (envoiEnCours.current) return false;
    const aEnvoyer = [...modifies.current];
    if (aEnvoyer.length === 0) return true;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatut('hors-ligne');
      return false;
    }

    envoiEnCours.current = true;
    setStatut('envoi');

    const instantane = new Map(aEnvoyer.map((id) => [id, valeursRef.current[id] ?? '']));

    try {
      const reponse = await fetch('/api/inventaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateInventaire: date,
          inventaires: aEnvoyer.map((id) => ({
            produitId: id,
            // Chaîne vide => null : la valeur est effacée, pas remise à zéro.
            [champ]: instantane.get(id) === '' ? null : Number(instantane.get(id)),
          })),
        }),
      });

      if (!reponse.ok) {
        const corps = await reponse.json().catch(() => null);
        throw new Error(corps?.error ?? `Erreur ${reponse.status}`);
      }

      // Seules les lignes envoyées sont retirées de la file : celles saisies
      // pendant la requête restent en attente pour le prochain envoi.
      for (const [id, valeur] of instantane) {
        if (valeursRef.current[id] === valeur) modifies.current.delete(id);
      }
      synchroniserCompteur();

      setDerniereSauvegarde(new Date());
      setMessageErreur(null);
      setStatut(modifies.current.size > 0 ? 'brouillon' : 'enregistre');

      if (modifies.current.size === 0) effacerBrouillon(champ, date);
      return true;
    } catch (e) {
      console.error(e);
      setMessageErreur(e instanceof Error ? e.message : 'Erreur inconnue');
      setStatut('echec');
      return false; // les valeurs restent en attente et dans le brouillon local
    } finally {
      envoiEnCours.current = false;
    }
  }, [champ, date, synchroniserCompteur]);

  const definir = useCallback(
    (produitId: number, saisie: string) => {
      const valeur = nettoyerQuantite(saisie);
      if (valeursRef.current[produitId] === valeur) return;

      // L'écriture du brouillon reste hors de l'updater de setState : React
      // peut rejouer un updater, et un effet de bord rejoué fausserait la
      // file d'attente.
      const suivant = { ...valeursRef.current, [produitId]: valeur };
      valeursRef.current = suivant;
      modifies.current.add(produitId);

      ecrireBrouillon({
        v: VERSION_BROUILLON,
        date,
        champ,
        valeurs: suivant,
        modifies: [...modifies.current],
        horodatage: Date.now(),
      });

      setValeurs(suivant);
      synchroniserCompteur();
      setStatut((precedent) => (precedent === 'envoi' ? precedent : 'brouillon'));

      if (minuteur.current) clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => void envoyer(), DELAI_AUTO_MS);
    },
    [champ, date, envoyer, synchroniserCompteur]
  );

  const enregistrerMaintenant = useCallback(async () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    return envoyer();
  }, [envoyer]);

  /* --------------------------------------------------------------- Filets */

  // Retour du réseau : on repart aussitôt avec ce qui attendait.
  useEffect(() => {
    const auRetour = () => {
      if (modifies.current.size > 0) void envoyer();
    };
    window.addEventListener('online', auRetour);
    return () => window.removeEventListener('online', auRetour);
  }, [envoyer]);

  // Onglet remis au premier plan : on tente aussi de vider la file.
  useEffect(() => {
    const auReveil = () => {
      if (document.visibilityState === 'visible' && modifies.current.size > 0) void envoyer();
    };
    document.addEventListener('visibilitychange', auReveil);
    return () => document.removeEventListener('visibilitychange', auReveil);
  }, [envoyer]);

  // Dernier rempart avant la fermeture de l'onglet.
  useEffect(() => {
    const avantFermeture = (e: BeforeUnloadEvent) => {
      if (modifies.current.size > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', avantFermeture);
    return () => window.removeEventListener('beforeunload', avantFermeture);
  }, []);

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  /* -------------------------------------------------------------- Dérivés */

  const categories = useMemo(() => {
    const vues = new Set<string>();
    for (const p of produits) vues.add(p.categorie);
    return [...vues];
  }, [produits]);

  const nbRenseignes = useMemo(
    () => produits.filter((p) => (valeurs[p.id] ?? '') !== '').length,
    [produits, valeurs]
  );

  return {
    produits,
    inventaires,
    categories,
    valeurs,
    definir,
    chargement,
    erreurChargement,
    recharger: charger,
    statut,
    messageErreur,
    derniereSauvegarde,
    nbEnAttente,
    nbRenseignes,
    enregistrerMaintenant,
  };
}
