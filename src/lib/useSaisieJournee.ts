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
//
// LOI 2 : chaque produit porte son unité ; pour un produit au kilo la valeur
// est un nombre entier de GRAMMES, et l'unité part avec chaque saisie.
// Idempotence : chaque geste de saisie porte un `saisieId` (UUID) ; un même
// geste renvoyé (réseau coupé, rejeu du brouillon) n'est compté qu'une fois.
// Refus du serveur (format LOI 9) : la ligne visée est marquée et sort de la
// file, les autres continuent de partir.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Poste } from './postes';
import type { Echec, Signalement } from '@/domaine/resultat';
import type { Unite } from '@/domaine/types';
import { nouvelIdSaisie } from './inventaire/controles';

export type ChampSaisie =
  | 'quantiteRestante'
  | 'quantiteProduite'
  | 'quantitePrevue'
  /** Part de la quantité prévue due à une commande client. */
  | 'quantiteCommande';

export type Produit = {
  id: number;
  nom: string;
  ordre: number;
  categorie: string;
  poste: Poste;
  /** LOI 2 — 'kg' : valeurs en grammes, saisies au pavé décimal. */
  unite: Unite;
};

export type LigneInventaire = {
  produitId: number;
  quantiteRestante: number | null;
  quantiteProduite: number | null;
  quantitePrevue: number | null;
  quantiteCommande: number | null;
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
/** Fréquence des nouvelles tentatives quand un envoi a échoué. */
const INTERVALLE_REPRISE_MS = 30_000;
const VERSION_BROUILLON = 1;

/** Geste de saisie en cours sur un produit (fermé quand sa valeur est enregistrée). */
type Geste = { id: string; le: number };

type Brouillon = {
  v: number;
  date: string;
  champ: ChampSaisie;
  valeurs: Record<string, string>;
  modifies: number[];
  horodatage: number;
  /** Absent des brouillons écrits avant l'idempotence : un nouveau geste est créé. */
  gestes?: Record<string, Geste>;
};

/** Envoi échoué sans réponse lisible (LOI 9 : jamais de code HTTP à l'écran). */
const MESSAGE_ENVOI_IMPOSSIBLE =
  'Enregistrement impossible pour le moment. La saisie est gardée sur cet appareil et repartira toute seule.';

const CHAMP_PRODUIT = /^produit:(\d+)$/;

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

/**
 * Nettoie une frappe : on ne garde que des entiers positifs — pièces (4 chiffres
 * max) ou grammes pour un produit au kilo (6 chiffres max, soit 999 kg).
 * Garde-fou de frappe, pas une règle : la validation est celle du domaine.
 */
export function nettoyerQuantite(saisie: string, unite: Unite = 'piece'): string {
  const chiffres = saisie.replace(/[^\d]/g, '').slice(0, unite === 'kg' ? 6 : 4);
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
  /** Refus du serveur par produit (bloquant, format LOI 9). */
  const [refus, setRefus] = useState<Map<number, Echec>>(new Map());
  /** Avertissements renvoyés par le serveur (AVERT_DOUBLE_SCAN…) par produit. */
  const [avertissementsServeur, setAvertissementsServeur] = useState<Map<number, Signalement[]>>(new Map());
  /** Heure de fermeture (réglage en base), lue avec le chargement du comptage. */
  const [heureFermeture, setHeureFermeture] = useState<string | null>(null);

  // Les identifiants dont la valeur a été touchée depuis le dernier envoi réussi.
  const modifies = useRef<Set<number>>(new Set());
  const gestes = useRef<Map<number, Geste>>(new Map());
  /** Produits de la requête en cours. */
  const enVol = useRef<Set<number>>(new Set());
  const unites = useRef<Map<number, Unite>>(new Map());
  const [nbEnAttente, setNbEnAttente] = useState(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envoiEnCours = useRef(false);
  const reprise = useRef(false);

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
        // Le comptage du restant reçoit aussi l'heure de fermeture (en-tête), sans requête de plus.
        fetch(
          `/api/inventaires?date=${date}${poste ? `&poste=${poste}` : ''}${
            champ === 'quantiteRestante' ? '&reglages=1' : ''
          }`
        ),
      ]);

      if (!repProduits.ok || !repInventaires.ok) {
        throw new Error('Réponse invalide du serveur');
      }

      setHeureFermeture(repInventaires.headers.get('X-Heure-Fermeture'));
      // LOI 2 : unité du produit, jamais déduite du nom ; absente = pièce.
      const listeProduits: Produit[] = ((await repProduits.json()) as Produit[]).map((p) => ({
        ...p,
        unite: p.unite === 'kg' ? 'kg' : 'piece',
      }));
      unites.current = new Map(listeProduits.map((p) => [p.id, p.unite]));
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
      gestes.current = new Map();
      if (brouillon) {
        modifies.current = new Set(brouillon.modifies);
        // Seuls les gestes encore en attente sont repris : un geste déjà
        // enregistré ne doit jamais porter une nouvelle valeur.
        for (const [id, geste] of Object.entries(brouillon.gestes ?? {})) {
          if (modifies.current.has(Number(id))) gestes.current.set(Number(id), geste);
        }
        for (const id of brouillon.modifies) {
          if (brouillon.valeurs[id] !== undefined) depuisServeur[id] = brouillon.valeurs[id];
        }
        if (brouillon.modifies.length > 0) {
          setStatut('brouillon');
          // Un brouillon retrouvé au chargement contient des saisies qui n'ont
          // jamais atteint la base. Sans ce déclenchement, elles restaient
          // affichées à l'écran en attendant une frappe qui ne venait pas.
          reprise.current = true;
        }
      }

      setProduits(listeProduits);
      setInventaires(parProduit);
      setRefus(new Map());
      setAvertissementsServeur(new Map());
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
    enVol.current = new Set(aEnvoyer);
    setStatut('envoi');

    const instantane = new Map(aEnvoyer.map((id) => [id, valeursRef.current[id] ?? '']));
    let relancer = false;

    try {
      const reponse = await fetch('/api/inventaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateInventaire: date,
          inventaires: aEnvoyer.map((id) => {
            const geste = gestes.current.get(id);
            return {
              produitId: id,
              unite: unites.current.get(id) ?? 'piece',
              saisieId: geste?.id,
              saisiLe: geste ? new Date(geste.le).toISOString() : undefined,
              // Chaîne vide => null : la valeur est effacée, pas remise à zéro.
              [champ]: instantane.get(id) === '' ? null : Number(instantane.get(id)),
            };
          }),
        }),
      });

      const corps = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        // Refus métier visant UNE ligne : elle est marquée et sort de la file,
        // les autres repartent aussitôt (un produit retiré ne bloque pas tout).
        const cible = typeof corps?.champ === 'string' ? CHAMP_PRODUIT.exec(corps.champ) : null;
        const id = cible ? Number(cible[1]) : null;
        if (corps?.ok === false && id !== null && modifies.current.has(id)) {
          setRefus((precedent) => new Map(precedent).set(id, corps as Echec));
          modifies.current.delete(id);
          synchroniserCompteur();
          relancer = modifies.current.size > 0;
        }
        throw new Error(typeof corps?.message === 'string' ? corps.message : MESSAGE_ENVOI_IMPOSSIBLE);
      }

      const recus: Signalement[] = Array.isArray(corps?.signalements) ? corps.signalements : [];
      setAvertissementsServeur((precedent) => {
        const suivant = new Map(precedent);
        for (const id of instantane.keys()) suivant.delete(id);
        for (const s of recus) {
          const m = typeof s?.champ === 'string' ? CHAMP_PRODUIT.exec(s.champ) : null;
          if (!m) continue;
          const id = Number(m[1]);
          suivant.set(id, [...(suivant.get(id) ?? []), s]);
        }
        return suivant;
      });

      // Seules les lignes envoyées sont retirées de la file : celles saisies
      // pendant la requête restent en attente pour le prochain envoi.
      for (const [id, valeur] of instantane) {
        if (valeursRef.current[id] === valeur) {
          modifies.current.delete(id);
          gestes.current.delete(id); // geste enregistré : la prochaine frappe en ouvre un nouveau
        }
      }
      synchroniserCompteur();

      setDerniereSauvegarde(new Date());
      setMessageErreur(null);
      setStatut(modifies.current.size > 0 ? 'brouillon' : 'enregistre');

      if (modifies.current.size === 0) effacerBrouillon(champ, date);
      return true;
    } catch (e) {
      console.error(e);
      setMessageErreur(e instanceof Error && e.message ? e.message : MESSAGE_ENVOI_IMPOSSIBLE);
      setStatut('echec');
      return false; // les valeurs restent en attente et dans le brouillon local
    } finally {
      envoiEnCours.current = false;
      enVol.current = new Set();
      // Une ligne refusée vient de sortir de la file : les autres repartent tout de suite.
      if (relancer) {
        if (minuteur.current) clearTimeout(minuteur.current);
        minuteur.current = setTimeout(() => void envoyerRef.current(), 0);
      }
    }
  }, [champ, date, synchroniserCompteur]);

  const envoyerRef = useRef(envoyer);
  useEffect(() => {
    envoyerRef.current = envoyer;
  }, [envoyer]);

  const definir = useCallback(
    (produitId: number, saisie: string) => {
      const valeur = nettoyerQuantite(saisie, unites.current.get(produitId) ?? 'piece');
      if (valeursRef.current[produitId] === valeur) return;

      // Un nouveau geste commence si le précédent sur ce produit est enregistré,
      // ou s'il est en cours d'envoi (sa valeur est déjà partie, elle ne change plus).
      if (!gestes.current.has(produitId) || enVol.current.has(produitId)) {
        gestes.current.set(produitId, { id: nouvelIdSaisie(), le: Date.now() });
      }
      setRefus((precedent) => {
        if (!precedent.has(produitId)) return precedent;
        const suivant = new Map(precedent);
        suivant.delete(produitId);
        return suivant;
      });

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
        gestes: Object.fromEntries(gestes.current),
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

  // Un brouillon retrouvé au chargement part dès que les données sont prêtes.
  useEffect(() => {
    if (!reprise.current || chargement) return;
    reprise.current = false;
    void envoyer();
  }, [chargement, envoyer]);

  // Filet de dernier recours : tant qu'il reste des saisies non transmises, on
  // réessaie régulièrement. Sans cela, un échec réseau survenu pendant que le
  // vendeur comptait au comptoir restait bloqué jusqu'à sa prochaine frappe —
  // et si le comptage était fini, plus rien ne repartait jamais.
  useEffect(() => {
    const tic = setInterval(() => {
      if (modifies.current.size > 0 && !envoiEnCours.current) void envoyer();
    }, INTERVALLE_REPRISE_MS);
    return () => clearInterval(tic);
  }, [envoyer]);

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
    refus,
    avertissementsServeur,
    heureFermeture,
  };
}
