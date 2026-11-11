// src/components/fiche/historiqueCommande.ts
//
// Historique d'une commande À L'ÉCRAN (fiche, propriétaire 11/11/2026 :
// « facilement visible »). Fonctions pures, testées seules
// (historiqueCommande.test.ts). AUCUNE règle métier : on met en mots ce que la
// table des événements contient déjà (quand, qui, quoi, détail).
//
// Le détail d'une modification est écrit par
// src/components/commande/historique.ts (`detailModification`) : changements
// joints par « , », marqueur « à réimprimer » en tête. Ce format est RELU ici,
// jamais changé (le bon imprimé le relit aussi, src/lib/ticketCanvas.ts).
//
// Découpage sûr : un changement peut contenir des virgules (nom du client,
// remarques, liste des produits). On ne coupe donc qu'à une virgule SUIVIE
// d'un libellé connu, dans l'ordre où `changementsLisibles` les écrit, chacun
// une seule fois, et chaque morceau à forme fixe (montant, oui / non, date…)
// doit avoir cette forme. Au moindre doute : le détail entier, en un bloc.
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import { MARQUEUR_REIMPRESSION } from '../commande/historique.ts';
import { dateHeureCourte } from '../../lib/ticketCanvas.ts';

/** Un événement tel que renvoyé par l'API (du plus récent au plus ancien). */
export type EvenementCommande = { quand: string; action: string; detail: string | null; auteur?: string | null };

/** Un changement d'une modification, prêt à afficher sur une ligne. */
export type ChangementAffiche = {
  /** « Client », « Heure de retrait », « Produits avant la modification »… */
  libelle: string;
  /** Valeur avant / après quand le changement s'écrit « avant → après ». */
  avant?: string;
  apres?: string;
  /** Autres cas (anciens produits) : une ou plusieurs lignes de texte. */
  textes?: string[];
};

/** Une entrée d'historique, en mots d'écran. */
export type LigneHistorique = {
  action: string;
  /** « Commande prise », « Modifiée », « Bon imprimé »… */
  libelle: string;
  /** « par Sara », « par le manager », « par l’imprimante » ; null : inconnu ou masqué. */
  auteur: string | null;
  /** « 10/11 à 14h32 », heure de Bruxelles. */
  quand: string;
  /** « Modifiée par Sara · 10/11 à 14h32 ». */
  resume: string;
  /** Étiquette « à réimprimer » (jamais du texte brut dans le détail). */
  aReimprimer: boolean;
  /** Changements d'une modification, un par ligne ; vide si non découpé. */
  changements: ChangementAffiche[];
  /** Détail montré tel quel, en un bloc (autres actions, ou découpage pas sûr). */
  bloc: string | null;
};

export type OptionsHistorique = {
  /**
   * Commande anonymisée : les détails peuvent contenir l'ancien nom du client
   * ou des remarques, les auteurs sont des personnes → seulement action et date.
   */
  anonymisee?: boolean;
};

/* ---------------------------------------------------------------- Actions */

const LIBELLES_ACTION: Record<string, string> = {
  creation: 'Commande prise',
  modification: 'Modifiée',
  impression: 'Bon imprimé',
  remise: 'Retirée par le client',
  // L'action « acompte » ne fait qu'une chose : constater le virement (bouton « Virement reçu »).
  acompte: 'Virement reçu',
  annulation: 'Annulée',
};

/** Détail d'une modification qui n'a rien changé (`detailModification`). */
const AUCUN_CHANGEMENT = 'aucun changement';

export function libelleAction(action: string, detail?: string | null): string {
  if (action === 'modification' && (detail ?? '').trim() === AUCUN_CHANGEMENT) return 'Enregistrée sans changement';
  return LIBELLES_ACTION[action] ?? 'Mise à jour';
}

/**
 * « par Sara ». Auteur absent ou « inconnu » : rien (on ne montre pas un mot
 * technique). L'imprimante et le comptoir ne sont pas des personnes ; le nom
 * par défaut de l'accord (« Gérant », « manager ») se dit « le manager ».
 */
export function auteurLisible(auteur: string | null | undefined): string | null {
  const a = (auteur ?? '').trim();
  if (!a || a.toLowerCase() === 'inconnu') return null;
  if (a.toLowerCase() === 'imprimante') return 'par l’imprimante';
  if (a.toLowerCase() === 'comptoir') return 'au comptoir';
  if (/^(g[ée]rant|manager)$/i.test(a)) return 'par le manager';
  return `par ${a}`;
}

/* ------------------------------------------------- Détail d'une modification */

/** Formes fixes écrites par `changementsLisibles`. */
const EUROS = String.raw`-?\d[\d\s]*,\d{2}\s€`;
const OUI_NON = '(?:oui|non)';
const JOUR = String.raw`\d{4}-\d{2}-\d{2}`;

type Gabarit = {
  /** Début du changement tel qu'il est écrit. */
  prefixe: string;
  libelle: string;
  /** Forme attendue du morceau ENTIER ; absente : texte libre (non vérifiable). */
  forme?: RegExp;
  /** Mise en mots d'une valeur (date, mode de paiement). */
  valeur?: (v: string) => string;
};

const jourLisible = (iso: string): string => {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
};

const PAIEMENTS: Record<string, string> = { especes: 'espèces', virement: 'virement' };

/** Dans l'ORDRE où `changementsLisibles` les écrit — l'ordre fait partie du contrôle. */
const GABARITS: readonly Gabarit[] = [
  { prefixe: 'client : ', libelle: 'Client' },
  { prefixe: 'téléphone', libelle: 'Téléphone', forme: /^téléphone$/ },
  { prefixe: 'retrait : ', libelle: 'Jour de retrait', forme: new RegExp(`^retrait : ${JOUR} → ${JOUR}$`), valeur: jourLisible },
  { prefixe: 'heure : ', libelle: 'Heure de retrait', forme: /^heure : [^,→]+ → [^,→]+$/ },
  { prefixe: 'écriture : ', libelle: 'Écriture' },
  { prefixe: 'zone dessin : ', libelle: 'Zone de dessin sur le bon', forme: new RegExp(`^zone dessin : ${OUI_NON} → ${OUI_NON}$`) },
  { prefixe: 'remarques : ', libelle: 'Remarques' },
  { prefixe: 'photo à imprimer : ', libelle: 'Photo à imprimer', forme: new RegExp(`^photo à imprimer : ${OUI_NON} → ${OUI_NON}$`) },
  { prefixe: 'photo WhatsApp : ', libelle: 'Photo WhatsApp', forme: new RegExp(`^photo WhatsApp : ${OUI_NON} → ${OUI_NON}$`) },
  { prefixe: 'demande inhabituelle : ', libelle: 'Demande inhabituelle', forme: new RegExp(`^demande inhabituelle : ${OUI_NON} → ${OUI_NON}$`) },
  { prefixe: 'paiement : ', libelle: 'Paiement', forme: /^paiement : \w+ → \w+$/, valeur: (v) => PAIEMENTS[v] ?? v },
  { prefixe: 'produits — avant : ', libelle: 'Produits avant la modification' },
  { prefixe: 'total : ', libelle: 'Total', forme: new RegExp(`^total : ${EUROS} → ${EUROS}$`) },
  { prefixe: 'acompte : ', libelle: 'Acompte', forme: new RegExp(`^acompte : ${EUROS} → ${EUROS}$`) },
];

const FLECHE = ' → ';
const SEPARATEUR = ', ';

/** Rang du gabarit dont le préfixe commence à `position`, ou -1. */
function gabaritA(texte: string, position: number): number {
  return GABARITS.findIndex((g) => texte.startsWith(g.prefixe, position));
}

/**
 * Anciens produits : « 2 × Croissant à … € ; 20 × Layer Cake […] à … € ».
 * Une ligne par produit, en ne coupant qu'entre un prix et une quantité.
 */
function lignesProduits(texte: string): string[] {
  return texte.split(/(?<=€) ; (?=-?\d[\d\s,.]*(?:kg )?× )/).map((t) => t.trim()).filter(Boolean);
}

function changementDe(morceau: string, g: Gabarit): ChangementAffiche {
  const reste = morceau.slice(g.prefixe.length);
  if (g.prefixe === 'téléphone') return { libelle: g.libelle, textes: ['Numéro changé'] };
  if (g.prefixe.startsWith('produits')) return { libelle: g.libelle, textes: lignesProduits(reste) };
  const parties = reste.split(FLECHE);
  // Une seule flèche : « avant → après ». Sinon (flèche dans le texte saisi) : le texte entier.
  if (parties.length !== 2) return { libelle: g.libelle, textes: [reste] };
  const dire = g.valeur ?? ((v: string) => v);
  return { libelle: g.libelle, avant: dire(parties[0].trim()), apres: dire(parties[1].trim()) };
}

/**
 * Découpe le corps d'un détail de modification (sans le marqueur). null : pas
 * sûr — l'appelant montre le détail en un bloc.
 */
export function decouperChangements(corps: string): ChangementAffiche[] | null {
  const texte = corps.trim();
  if (!texte) return null;
  const premier = gabaritA(texte, 0);
  if (premier < 0) return null;

  // Toutes les coupes possibles : « , » suivi d'un libellé connu.
  const debuts: { position: number; rang: number }[] = [{ position: 0, rang: premier }];
  for (let i = texte.indexOf(SEPARATEUR); i >= 0; i = texte.indexOf(SEPARATEUR, i + 1)) {
    const rang = gabaritA(texte, i + SEPARATEUR.length);
    if (rang >= 0) debuts.push({ position: i + SEPARATEUR.length, rang });
  }
  // Ordre d'écriture strict, chaque libellé une fois : sinon un libellé vient d'un texte saisi.
  for (let k = 1; k < debuts.length; k++) {
    if (debuts[k].rang <= debuts[k - 1].rang) return null;
  }

  const changements: ChangementAffiche[] = [];
  for (const [k, d] of debuts.entries()) {
    const fin = k + 1 < debuts.length ? debuts[k + 1].position - SEPARATEUR.length : texte.length;
    const morceau = texte.slice(d.position, fin);
    const g = GABARITS[d.rang];
    if (g.forme && !g.forme.test(morceau)) return null;
    changements.push(changementDe(morceau, g));
  }
  return changements;
}

/** Sépare le marqueur « à réimprimer » (en tête ; en fin dans les anciens détails) du reste. */
export function lireMarqueur(detail: string): { aReimprimer: boolean; corps: string } {
  const d = detail.trim();
  const tete = `${MARQUEUR_REIMPRESSION} — `;
  if (d.startsWith(tete)) return { aReimprimer: true, corps: d.slice(tete.length).trim() };
  if (d === MARQUEUR_REIMPRESSION) return { aReimprimer: true, corps: '' };
  if (!d.includes(MARQUEUR_REIMPRESSION)) return { aReimprimer: false, corps: d };
  // Ancien format : marqueur en fin de texte.
  const fin = new RegExp(`[\\s,;·—-]*\\(?${MARQUEUR_REIMPRESSION}\\)?\\s*$`);
  return { aReimprimer: true, corps: d.replace(fin, '').trim() };
}

/* ----------------------------------------------------------------- Lignes */

export function ligneHistorique(e: EvenementCommande, options: OptionsHistorique = {}): LigneHistorique {
  const detail = (e.detail ?? '').trim();
  const libelle = libelleAction(e.action, detail);
  const auteur = options.anonymisee ? null : auteurLisible(e.auteur);
  const quand = dateHeureCourte(e.quand);
  const resume = `${libelle}${auteur ? ` ${auteur}` : ''} · ${quand}`;
  const base = { action: e.action, libelle, auteur, quand, resume };

  if (e.action !== 'modification') {
    return { ...base, aReimprimer: false, changements: [], bloc: options.anonymisee || !detail ? null : detail };
  }
  const { aReimprimer, corps } = lireMarqueur(detail);
  if (options.anonymisee || !corps || corps === AUCUN_CHANGEMENT) {
    return { ...base, aReimprimer, changements: [], bloc: null };
  }
  const changements = decouperChangements(corps);
  return changements ? { ...base, aReimprimer, changements, bloc: null } : { ...base, aReimprimer, changements: [], bloc: corps };
}

/** Du plus récent au plus ancien, quel que soit l'ordre reçu. */
export function lignesHistorique(evenements: readonly EvenementCommande[] | null | undefined, options: OptionsHistorique = {}): LigneHistorique[] {
  return [...(evenements ?? [])].sort((a, b) => b.quand.localeCompare(a.quand)).map((e) => ligneHistorique(e, options));
}

/** true : la commande a été changée après sa prise (une modification qui a changé quelque chose). */
function estVraieModification(l: LigneHistorique): boolean {
  return l.action === 'modification' && l.libelle === LIBELLES_ACTION.modification;
}

export type ResumeHistorique = {
  /** Toutes les entrées, de la plus récente à la plus ancienne. */
  lignes: LigneHistorique[];
  /** La dernière action : toujours affichée en clair. */
  derniere: LigneHistorique | null;
  /**
   * Dernière modification, quand ce n'est PAS la dernière action (un bon
   * réimprimé depuis ne doit pas la cacher) : affichée en clair elle aussi.
   */
  derniereModification: LigneHistorique | null;
  nbModifications: number;
};

export function resumeHistorique(evenements: readonly EvenementCommande[] | null | undefined, options: OptionsHistorique = {}): ResumeHistorique {
  const lignes = lignesHistorique(evenements, options);
  const derniere = lignes[0] ?? null;
  const modifications = lignes.filter(estVraieModification);
  const derniereModification = modifications[0] && modifications[0] !== derniere ? modifications[0] : null;
  return { lignes, derniere, derniereModification, nbModifications: modifications.length };
}

/** « Modifiée 2 fois » / « Modifiée 1 fois ». */
export function texteModifications(n: number): string {
  return n <= 0 ? '' : `Modifiée ${n} fois`;
}

/** « Tout l’historique (5) ». */
export function titreDepli(n: number): string {
  return `Tout l’historique (${n})`;
}

/* ------------------------------------------------------------- Annulation */

/** « Annulée le 11/11 à 9h05 — motif : Le client a annulé ». */
export function texteAnnulation(c: { annuleeLe?: string | null; motif?: string | null; anonymiseeLe?: string | null }): string {
  const quand = c.annuleeLe ? `Annulée le ${dateHeureCourte(c.annuleeLe)}` : 'Annulée';
  const motif = (c.motif ?? '').trim();
  return motif && !c.anonymiseeLe ? `${quand} — motif : ${motif}` : quand;
}

/** Motifs rapides de la fenêtre d'annulation (un toucher) ; le texte libre reste possible. */
export const MOTIFS_ANNULATION: readonly string[] = ['Le client a annulé', 'Erreur de saisie', 'Doublon'];
