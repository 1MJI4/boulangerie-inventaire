// src/lib/commandes.ts
//
// Types et petits outils d'AFFICHAGE des commandes (liste, bon, message
// WhatsApp). AUCUNE règle ici depuis le lot 2 : minimums, plancher, délai,
// acompte, suppléments, contrôle d'une commande vivent dans `src/domaine/`
// (controlerCommande, validerTransitionStatut…), les prix dans le catalogue.
// Montants en centimes entiers, formatés et soustraits par `src/domaine/argent.ts`.

import { familleDuProduit } from '../catalogue/familles.ts';
import { TYPE_ACCUEIL_PAR_PRODUIT, TYPE_ACCUEIL_PAR_RAYON } from '../catalogue/typesAccueil.ts';
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
  remise: 'Retirée par le client',
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
  /** Number Cake : formes à réaliser (« 25 », « cœur + 1 »). */
  formes?: string | null;
  /** R63 : forme du gâteau (carré / rond), null si non concerné. Distinct de `formes` (Number Cake). */
  forme?: 'carre' | 'rond' | null;
  /** R62 : goût(s) du gâteau, un par étage. */
  gouts?: string[];
  /** R62 : décorations facultatives. */
  decorations?: string[];
  nbObjets?: number | null;
  /**
   * Galerie (26/10/2026) : identifiant de la photo de modèle choisie (« G043 »),
   * imprimé « Photo sélectionnée : G043 » sur le bon. null / absent : pas de photo.
   */
  photoModele?: string | null;
  /**
   * Lot 2 (propriétaire, 28/10/2026 : « une écriture par gâteau ») : ce qui
   * s'écrit sur CE gâteau, imprimé en gras sous sa ligne. null / absent : rien.
   * Ancienne commande (écriture au niveau de la commande) : `depuisApi` la
   * reporte sur son premier gâteau (`lignesSurLeGateau`), en lecture seulement.
   */
  texteGateau?: string | null;
  /** Lot 2 : « Pas d'écriture » coché pour CE gâteau. */
  sansEcriture?: boolean | null;
  /** Lot 2 : photo à imprimer SUR ce gâteau (supplément Photo). */
  photoImprimee?: boolean | null;
  /** Produit du catalogue de commande (null : ligne libre ou ligne antérieure au lot 2). */
  /** Rayon, nom et régime : de quoi classer la ligne (boulangerie, pâtisserie, salé). */
  produitCatalogue?: { cleCatalogue: string; categorie?: string; nom?: string; regimePrix?: 'A' | 'B' | 'C' | null } | null;
  /** Base de prix de la version de tarif appliquée (piece, personne, kg, forfait) ; null : ligne libre ou ancienne. */
  prixProduit?: { basePrix: string } | null;
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
  /**
   * Lot 2 (28/10/2026) : l'écriture est sur la LIGNE (`LigneCommande.texteGateau`).
   * Ici : l'écriture des commandes anciennes, et pour les nouvelles un RÉSUMÉ
   * (« A · B ») gardé pour les écrans qui ne lisent pas encore les lignes.
   * Lire de préférence `lignesSurLeGateau` / `ecrituresDeCommande`.
   */
  texteGateau: string | null;
  /** Ancien format ; nouvelles commandes : true si TOUS les gâteaux sont sans écriture. */
  sansEcriture: boolean;
  /** Photo d'exemple envoyée par le client sur WhatsApp : reste au niveau de la commande. */
  photoWhatsapp: boolean;
  /** Ancien format ; nouvelles commandes : true si au moins un gâteau porte une photo à imprimer. */
  photoImprimee: boolean;
  demandeInhabituelle?: boolean;
  /** OBSOLÈTE (lot 2) : remplacé par `demandeInhabituelle`, encore lu par les gabarits imprimés. */
  gateauComplexe?: boolean;
  /**
   * Zone « dessin, précisions » imprimée sur les exemplaires internes, seulement
   * si le vendeur l'a demandée (21/10/2026). Absente (anciennes données) = non.
   */
  zoneDessin?: boolean;
  remarques: string | null;
  statut: StatutCommande;
  imprimeeLe: string | null;
  remiseLe: string | null;
  avertissements: AvertissementTrace[];
  anonymiseeLe: string | null;
  lignes: LigneCommande[];
  /** Historique (20 derniers, du plus récent au plus ancien), tel que renvoyé par l'API. */
  evenements?: { quand: string; action: string; detail: string | null; auteur?: string }[];
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
  const commande = { ...c, retraitLe: c.retraitLe.slice(0, 10), avertissements };
  return { ...commande, lignes: lignesSurLeGateau(commande) };
}

/* ------------------------------------- Écriture par gâteau (lot 2, 28/10/2026) */

/** Ce qui s'écrit et s'imprime sur UN gâteau. */
export type SurLeGateau = { texteGateau: string | null; sansEcriture: boolean; photoImprimee: boolean };

const texteOuNull = (t: string | null | undefined): string | null => (t ?? '').trim() || null;

/** Ce qu'il faut d'une ligne (écran, API ou base) pour lire son écriture. */
export type LigneSurLeGateau = Pick<LigneCommande, 'texteGateau' | 'sansEcriture' | 'photoImprimee'> & {
  produitCatalogue?: { categorie?: string; nom?: string; regimePrix?: 'A' | 'B' | 'C' | null } | null;
  prixProduit?: { basePrix: string } | null;
};

/** Champs de la commande à l'ancien format (repli). */
type CommandeSurLeGateau<L extends LigneSurLeGateau = LigneSurLeGateau> = { lignes: readonly L[] } & Partial<
  Pick<Commande, 'texteGateau' | 'sansEcriture' | 'photoImprimee'>
>;

/** true : au moins une ligne porte son écriture ou sa photo (commande prise depuis le lot 2). */
export function commandeParGateau(c: { lignes: readonly LigneSurLeGateau[] }): boolean {
  return c.lignes.some((l) => l.texteGateau != null || l.sansEcriture != null || l.photoImprimee != null);
}

/**
 * Ligne enregistrée qui est un gâteau, lue sur les DONNÉES du tarif (régime,
 * base de prix, rayon), jamais sur le nom : gâteau sur commande par personne,
 * ou gâteau du comptoir. Sert seulement au repli de l'ancien format.
 */
export function estGateauEnregistre(l: LigneSurLeGateau): boolean {
  const p = l.produitCatalogue;
  const base = l.prixProduit?.basePrix;
  if (!p?.categorie || !p.nom || !p.regimePrix || base === 'forfait' || base === 'kg') return false;
  const famille = familleDuProduit(p.regimePrix === 'A' ? 'comptoir' : 'sur-commande', p.categorie, p.nom);
  if (famille === 'supplement') return false;
  if (p.regimePrix === 'C') return base === 'personne';
  return p.regimePrix === 'A' && famille === 'gateau';
}

function estSupplementEnregistre(l: LigneSurLeGateau): boolean {
  const p = l.produitCatalogue;
  if (l.prixProduit?.basePrix === 'forfait') return true;
  if (!p?.categorie || !p.nom || !p.regimePrix) return false;
  return familleDuProduit(p.regimePrix === 'A' ? 'comptoir' : 'sur-commande', p.categorie, p.nom) === 'supplement';
}

/**
 * Écriture, « Pas d'écriture » et photo à imprimer de CHAQUE ligne, dans
 * l'ordre des lignes. Commande ancienne (aucune ligne ne porte la sienne) :
 * l'écriture de la commande devient celle du PREMIER gâteau (à défaut, de la
 * première ligne qui n'est pas un supplément) — lecture seule, rien n'est réécrit.
 */
export function surLesGateaux(c: CommandeSurLeGateau): SurLeGateau[] {
  if (commandeParGateau(c)) {
    return c.lignes.map((l) => {
      const sans = l.sansEcriture === true;
      return { texteGateau: sans ? null : texteOuNull(l.texteGateau), sansEcriture: sans, photoImprimee: l.photoImprimee === true };
    });
  }
  const rien = c.lignes.map((): SurLeGateau => ({ texteGateau: null, sansEcriture: false, photoImprimee: false }));
  const texte = texteOuNull(c.texteGateau);
  if (!texte && !c.sansEcriture && !c.photoImprimee) return rien;
  let k = c.lignes.findIndex(estGateauEnregistre);
  if (k < 0) k = c.lignes.findIndex((l) => !estSupplementEnregistre(l));
  if (k < 0) k = 0;
  if (rien[k]) rien[k] = { texteGateau: c.sansEcriture ? null : texte, sansEcriture: c.sansEcriture === true, photoImprimee: c.photoImprimee === true };
  return rien;
}

/** Lignes avec leur écriture et leur photo à imprimer (repli de l'ancien format compris). */
export function lignesSurLeGateau<L extends LigneSurLeGateau>(c: CommandeSurLeGateau<L>): (L & SurLeGateau)[] {
  const sur = surLesGateaux(c);
  return c.lignes.map((l, i) => ({ ...l, ...sur[i] }));
}

/** Écritures de la commande, dans l'ordre des gâteaux (vide : aucune). */
export function ecrituresDeCommande(c: CommandeSurLeGateau): string[] {
  return surLesGateaux(c).flatMap((s) => (s.texteGateau ? [s.texteGateau] : []));
}

/**
 * Résumé enregistré dans `Commande.texteGateau` pour les nouvelles commandes
 * (« JOYEUX ANNIVERSAIRE LINA · BRAVO MARC ») : null s'il n'y a aucune écriture.
 */
export function resumeEcritures(textes: readonly (string | null | undefined)[]): string | null {
  const t = textes.map((x) => (x ?? '').trim()).filter(Boolean);
  return t.length > 0 ? t.join(' · ').slice(0, 200) : null;
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
  lignes: Pick<LigneCommande, 'libelle' | 'quantite' | 'texteGateau' | 'sansEcriture' | 'photoImprimee' | 'produitCatalogue' | 'prixProduit'>[];
  retraitLe: DateISO;
  retraitHeure: string | null;
  totalCentimes: number;
  acompteCentimes: number;
  texteGateau?: string | null;
  sansEcriture?: boolean;
  photoImprimee?: boolean;
  modePaiement: ModePaiement;
}): string {
  // Une écriture par gâteau (lot 2, 28/10/2026) : sous la ligne de son gâteau.
  const sur = surLesGateaux(commande);
  const lignes = [
    `PAin PAtisserie — Commande n° ${commande.numero}`,
    '',
    ...commande.lignes.flatMap((l, i) => {
      const t = sur[i]?.texteGateau;
      return [`• ${l.quantite} × ${l.libelle}`, ...(t ? [`   À écrire : « ${t} »`] : [])];
    }),
  ];

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

/* ----------------------------------------------- Type de commande (accueil) */

export type TypeCommande = 'boulangerie' | 'patisserie' | 'sale';

export const LIBELLE_TYPE: Record<TypeCommande, string> = {
  boulangerie: 'Boulangerie',
  patisserie: 'Pâtisserie',
  sale: 'Salé',
};

/**
 * Types d'une commande (accueil vendeur, 22/10/2026), tirés du RAYON de chaque
 * produit au tarif (famille du catalogue), jamais de son nom. Une commande
 * mixte a plusieurs types ; boissons, suppléments et lignes libres n'en donnent pas.
 */
export function typesDeCommande(c: Pick<Commande, 'lignes'>): TypeCommande[] {
  const types = new Set<TypeCommande>();
  for (const l of c.lignes) {
    const p = l.produitCatalogue;
    // Exceptions explicites : produit, puis rayon du tarif (Oriental → Salé, 29/10/2026).
    const exception =
      (p?.cleCatalogue ? TYPE_ACCUEIL_PAR_PRODUIT[p.cleCatalogue] : undefined) ??
      (p?.categorie ? TYPE_ACCUEIL_PAR_RAYON[p.categorie] : undefined);
    if (exception) {
      types.add(exception);
      continue;
    }
    if (!p?.categorie || !p.nom || !p.regimePrix) continue;
    const famille = familleDuProduit(p.regimePrix === 'A' ? 'comptoir' : 'sur-commande', p.categorie, p.nom);
    if (famille === 'gateau' || famille === 'patisserie') types.add('patisserie');
    else if (famille === 'boulangerie' || famille === 'viennoiserie') types.add('boulangerie');
    else if (famille === 'sale') types.add('sale');
  }
  return (['boulangerie', 'patisserie', 'sale'] as const).filter((t) => types.has(t));
}
