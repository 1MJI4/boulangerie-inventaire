'use client';

// src/lib/envoiHorsLigne.ts
//
// Côté navigateur de la file hors ligne (propriétaire : `data-offline`) :
// stockage sur la tablette et envoi automatique. Les décisions (ordre,
// dédoublonnage, états, refus) sont dans `commandesHorsLigne.ts`, testées.
//
// Stockage : `localStorage`, clé `commandes-en-attente`. Choisi plutôt
// qu'IndexedDB parce que l'écriture est SYNCHRONE : quand le vendeur lit
// « la commande est gardée sur cette tablette », elle l'est déjà, même si
// l'onglet est fermé ou la batterie lâche l'instant d'après. Une commande pèse
// quelques kilo-octets (les photos de modèle sont des références, pas des images).
//
// Envoi : au chargement de l'application, au retour du réseau (`online`), et
// toutes les 30 s tant que quelque chose attend. Une seule boucle d'envoi à la
// fois, même avec plusieurs onglets (Web Locks quand le navigateur les connaît).

import { nouvelIdSaisie } from '@/lib/inventaire/controles';
import {
  appliquerIssue,
  classerReponse,
  DELAI_REPONSE_MS,
  debuterEnvoi,
  FILE_VIDE,
  garder,
  INTERVALLE_ESSAI_MS,
  lireFile,
  mettreDeCote as mettreDeCotePur,
  nettoyer,
  prochaine,
  type CommandeEnAttente,
  type FileCommandes,
  type Issue,
  type NouvelleEntree,
  type ReponseLue,
} from '@/lib/commandesHorsLigne';

const CLE = 'commandes-en-attente';
const EVENEMENT = 'commandes-en-attente';
const VERROU = 'envoi-commandes-en-attente';

export const nouvelIdCommande = nouvelIdSaisie;

/* ---------------------------------------------------------------- Stockage */

export function lireCommandesEnAttente(): FileCommandes {
  try {
    const brut = window.localStorage.getItem(CLE);
    return brut ? lireFile(JSON.parse(brut)) : FILE_VIDE;
  } catch {
    return FILE_VIDE;
  }
}

/** Écrit la file ; `false` si la tablette refuse (stockage plein ou interdit). */
function ecrire(file: FileCommandes): boolean {
  let ok = true;
  try {
    window.localStorage.setItem(CLE, JSON.stringify(file));
    // Relecture : certains navigateurs (navigation privée) acceptent sans garder.
    ok = window.localStorage.getItem(CLE) !== null;
  } catch {
    ok = false;
  }
  window.dispatchEvent(new Event(EVENEMENT));
  return ok;
}

/** Lecture → transformation → écriture, en un seul geste synchrone. */
function transformer(f: (file: FileCommandes) => FileCommandes): boolean {
  return ecrire(f(lireCommandesEnAttente()));
}

/**
 * Garde une commande sur la tablette. `true` seulement si elle y est vraiment
 * (relue après écriture) : c'est la condition pour dire au vendeur qu'elle est gardée.
 */
export function garderCommande(entree: NouvelleEntree): boolean {
  const ok = transformer((f) => garder(f, entree, Date.now()));
  if (!ok) return false;
  const relue = lireCommandesEnAttente().commandes.find((c) => c.idClient === entree.idClient);
  return !!relue;
}

export function trouverCommandeEnAttente(idClient: string): CommandeEnAttente | null {
  return lireCommandesEnAttente().commandes.find((c) => c.idClient === idClient) ?? null;
}

/** Résultat d'un envoi fait par l'écran de commande lui-même (reprise corrigée, en ligne). */
export function noterIssue(idClient: string, issue: Issue) {
  transformer((f) => appliquerIssue(f, idClient, issue, Date.now()));
}

export function mettreDeCote(idClient: string) {
  transformer((f) => mettreDeCotePur(f, idClient, Date.now()));
}

/** Prévient quand la file change (sur cette page ou dans un autre onglet). */
export function ecouterCommandesEnAttente(rappel: () => void): () => void {
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE) rappel();
  };
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('storage', surStockage);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener('storage', surStockage);
  };
}

/* ------------------------------------------------------------------- Envoi */

/**
 * Envoie une commande au serveur et lit la réponse, sans jamais lever :
 * réseau coupé ou délai dépassé → `{ type: 'reseau' }`. L'identifiant client
 * part dans le corps ET en en-tête `Idempotency-Key`, pour que le serveur
 * puisse ignorer un second exemplaire.
 */
export async function envoyerAuServeur(
  methode: 'POST' | 'PATCH',
  corps: Record<string, unknown>,
  idClient: string,
): Promise<ReponseLue> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { type: 'reseau' };
  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), DELAI_REPONSE_MS);
  try {
    const reponse = await fetch('/api/commandes', {
      method: methode,
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idClient },
      body: JSON.stringify({ ...corps, idClient }),
      signal: arret.signal,
      cache: 'no-store',
    });
    let donnees: unknown = null;
    try {
      donnees = await reponse.json();
    } catch {
      donnees = null;
    }
    const d = donnees as { ok?: unknown; code?: unknown; message?: unknown; champ?: unknown; valeurProposee?: unknown } | null;
    if (reponse.ok && !(d && d.ok === false)) return { type: 'reponse', statut: reponse.status, ok: true, donnees };
    if (d && typeof d.code === 'string' && d.code.startsWith('ERR_') && typeof d.message === 'string') {
      return {
        type: 'reponse',
        statut: reponse.status,
        ok: false,
        refus: {
          code: d.code,
          message: d.message,
          ...(typeof d.champ === 'string' ? { champ: d.champ } : {}),
          ...(d.valeurProposee !== undefined ? { valeurProposee: d.valeurProposee } : {}),
        },
      };
    }
    // Réponse illisible (passerelle, page d'erreur intermédiaire) : le serveur est injoignable.
    return { type: 'reseau' };
  } catch {
    return { type: 'reseau' };
  } finally {
    clearTimeout(minuteur);
  }
}

let boucleEnCours = false;

async function boucle(): Promise<void> {
  for (;;) {
    const suivante = prochaine(lireCommandesEnAttente());
    if (!suivante) return;
    if (!transformer((f) => debuterEnvoi(f, suivante.idClient, Date.now()))) return;
    const issue = classerReponse(await envoyerAuServeur(suivante.methode, suivante.corps, suivante.idClient));
    transformer((f) => appliquerIssue(f, suivante.idClient, issue, Date.now()));
    // Réseau toujours absent : on s'arrête là, l'ordre est gardé (pas de saut à la suivante).
    if (issue.type === 'reessayer') return;
  }
}

/** Envoie, dans l'ordre, tout ce qui attend. Sans effet si un envoi tourne déjà. */
export async function envoyerCommandesEnAttente(): Promise<void> {
  if (boucleEnCours) return;
  boucleEnCours = true;
  try {
    transformer((f) => nettoyer(f, Date.now()));
    const verrous = (navigator as Navigator & { locks?: LockManager }).locks;
    if (verrous?.request) {
      await verrous.request(VERROU, { ifAvailable: true }, async (verrou) => {
        if (verrou) await boucle();
      });
    } else {
      await boucle();
    }
  } catch {
    // Rien ne remonte au vendeur : la commande reste en attente, on réessaiera.
  } finally {
    boucleEnCours = false;
  }
}

/** Démarre l'envoi automatique (une fois, dans un composant toujours monté). */
export function demarrerEnvoiAutomatique(): () => void {
  const essayer = () => void envoyerCommandesEnAttente();
  essayer();
  window.addEventListener('online', essayer);
  const minuteur = setInterval(() => {
    if (prochaine(lireCommandesEnAttente())) essayer();
  }, INTERVALLE_ESSAI_MS);
  return () => {
    window.removeEventListener('online', essayer);
    clearInterval(minuteur);
  };
}
