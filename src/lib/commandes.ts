// src/lib/commandes.ts
//
// Types et petits outils d'AFFICHAGE des commandes (liste, bon, message
// WhatsApp). AUCUNE règle ici depuis le lot 2 : minimums, plancher, délai,
// acompte, suppléments, contrôle d'une commande vivent dans `src/domaine/`
// (controlerCommande, validerTransitionStatut…), les prix dans le catalogue.
// Montants en centimes entiers, formatés et soustraits par `src/domaine/argent.ts`.

import { formaterEuros, resteDu } from '../domaine/argent.ts';
import { dateDuJour, type DateISO } from './dateProduction.ts';

// Ré-export pour le gabarit du bon (src/components/TicketCommande.tsx, agent
// `impression`) : un seul format d'euros dans toute l'application.
export { formaterEuros };

/* ------------------------------------------------------------------ Types */

export const STATUTS = ['a_imprimer', 'imprimee', 'remise', 'annulee'] as const;
export type StatutCommande = (typeof STATUTS)[number];

export const LIBELLE_STATUT: Record<StatutCommande, string> = {
  a_imprimer: 'À imprimer',
  imprimee: 'Imprimée',
  remise: 'Remise au client',
  annulee: 'Annulée',
};

export type ModePaiement = 'especes' | 'virement';
export type Origine = 'comptoir' | 'telephone';

export type LigneCommande = {
  id?: number;
  libelle: string;
  /** Pièces, parts, ou GRAMMES si `unite` = kg (LOI 2). */
  quantite: number;
  /** Prix unitaire appliqué, figé à la prise (pièce, kilo ou personne). */
  prixCentimes: number;
  unite?: 'piece' | 'kg';
  poste: string | null;
  precision: string | null;
  tarifId?: number | null;
  nbSymboles?: number | null;
  nbObjets?: number | null;
  /** Produit du catalogue de commande (null : ligne libre ou ligne antérieure au lot 2). */
  produitCatalogue?: { cleCatalogue: string } | null;
  sousPlancherAutorisePar?: string | null;
  sousPlancherAutoriseLe?: string | null;
  ligneLibreAutoriseePar?: string | null;
  ligneLibreAutoriseeLe?: string | null;
};

/** Signalement enregistré avec la commande (avertissement passé outre, tracé). */
export type AvertissementTrace = { code: string; message: string; champ?: string };

export type Commande = {
  id: number;
  numero: string;
  client: string;
  telephone: string;
  vendeur: string;
  priseLe: string;
  origine: Origine;
  retraitLe: DateISO;
  retraitHeure: string | null;
  modePaiement: ModePaiement;
  acompteCentimes: number;
  acompteRecuLe: string | null;
  totalCentimes: number;
  totalTarifCentimes?: number | null;
  remiseAutoriseePar?: string | null;
  remiseAutoriseeLe?: string | null;
  accordLendemainPar?: string | null;
  accordLendemainLe?: string | null;
  texteGateau: string | null;
  sansEcriture: boolean;
  photoWhatsapp: boolean;
  photoImprimee: boolean;
  demandeInhabituelle?: boolean;
  /** OBSOLÈTE (lot 2) : remplacé par `demandeInhabituelle`, encore lu par les gabarits imprimés. */
  gateauComplexe?: boolean;
  remarques: string | null;
  statut: StatutCommande;
  imprimeeLe: string | null;
  remiseLe: string | null;
  avertissements: AvertissementTrace[];
  anonymiseeLe: string | null;
  lignes: LigneCommande[];
};

/** Commande telle que renvoyée par GET /api/commandes (dates en ISO, avertissements en JSON). */
export type CommandeApi = Omit<Commande, 'retraitLe' | 'avertissements'> & {
  retraitLe: string;
  avertissements: string | null;
};

export function depuisApi(c: CommandeApi): Commande {
  let avertissements: AvertissementTrace[] = [];
  try {
    avertissements = c.avertissements ? (JSON.parse(c.avertissements) as AvertissementTrace[]) : [];
  } catch {
    avertissements = [];
  }
  return { ...c, retraitLe: c.retraitLe.slice(0, 10), avertissements };
}

/* ------------------------------------------------------------- Échéances */

/**
 * Les personnes disparaissent au bout d'un mois : assez pour retrouver un
 * client qui revient réclamer, assez court pour ne pas reconstituer un fichier.
 * Ce qui reste — date, produits, montants — n'identifie plus personne.
 */
export const JOURS_AVANT_ANONYMISATION = 30;

export const MENTION_ANONYME = 'anonyme';

/* --------------------------------------------------------------- Numéro */

/** 2026-0247 : lisible au téléphone, unique, et se met en communication d'un virement. */
export function formaterNumero(annee: number, sequence: number): string {
  return `${annee}-${String(sequence).padStart(4, '0')}`;
}

/* ------------------------------------------- Message de confirmation client */

/**
 * Préparé par l'application, envoyé par le manager depuis son WhatsApp.
 * Volontairement sans coordonnées bancaires. Le numéro en communication permet
 * de rapprocher un virement de la bonne commande.
 */
export function messageConfirmation(commande: {
  numero: string;
  lignes: Pick<LigneCommande, 'libelle' | 'quantite'>[];
  retraitLe: DateISO;
  retraitHeure: string | null;
  totalCentimes: number;
  acompteCentimes: number;
  texteGateau?: string | null;
  modePaiement: ModePaiement;
}): string {
  const lignes = [
    `PAin PAtisserie — Commande n° ${commande.numero}`,
    '',
    ...commande.lignes.map((l) => `• ${l.quantite} × ${l.libelle}`),
  ];

  if (commande.texteGateau) lignes.push(`• À écrire : « ${commande.texteGateau} »`);

  lignes.push(
    '',
    `À retirer le ${formaterDateMessage(commande.retraitLe)}${commande.retraitHeure ? ` à ${commande.retraitHeure}` : ''}`,
    `Total : ${formaterEuros(commande.totalCentimes)}`,
    `Acompte : ${formaterEuros(commande.acompteCentimes)}`,
    `Reste à payer : ${formaterEuros(resteDu(commande.totalCentimes, commande.acompteCentimes))}`,
  );

  if (commande.modePaiement === 'virement') {
    lignes.push('', `Merci d’indiquer « ${commande.numero} » en communication du virement.`);
  }

  return lignes.join('\n');
}

function formaterDateMessage(date: DateISO): string {
  const [a, m, j] = date.split('-');
  return `${j}/${m}/${a}`;
}

/* ------------------------------------------------------------- Prédicats */

export function attendUnVirement(commande: Pick<Commande, 'modePaiement' | 'acompteRecuLe' | 'statut'>): boolean {
  return commande.modePaiement === 'virement' && !commande.acompteRecuLe && commande.statut !== 'annulee';
}

export function resteAFaire(commande: Pick<Commande, 'statut'>): boolean {
  return commande.statut === 'a_imprimer' || commande.statut === 'imprimee';
}

/** Ce qui alimente la pastille de l'accueil. */
export function compterCeQuiReste(
  commandes: Pick<Commande, 'statut' | 'retraitLe' | 'modePaiement' | 'acompteRecuLe'>[],
  aujourdhui: DateISO = dateDuJour(),
): { aImprimer: number; retraitsDuJour: number; virements: number; total: number } {
  const aImprimer = commandes.filter((c) => c.statut === 'a_imprimer').length;
  const retraitsDuJour = commandes.filter((c) => c.retraitLe === aujourdhui && resteAFaire(c)).length;
  const virements = commandes.filter(attendUnVirement).length;
  return { aImprimer, retraitsDuJour, virements, total: aImprimer + retraitsDuJour };
}
