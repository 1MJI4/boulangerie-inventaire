// src/components/commande/historique.ts
//
// Historique d'une modification de commande (R31 : aucune version effacée) et
// décision « à réimprimer » (propriétaire de l'écran : `commandes-traiteur`).
// Extrait de src/app/api/commandes/route.ts (audit du 28/10/2026) pour être
// testé : TOUT champ imprimé sur le bon compte, sinon le bon accroché à
// l'atelier ne dit plus la vérité (goût, décoration, chiffres du Number Cake,
// précision, remarques — allergies —, photos, demande inhabituelle…).
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import { formaterEuros } from '../../domaine/argent.ts';
import { formaterQuantite } from '../../domaine/unites.ts';
import { LIBELLES_FORME } from '../../domaine/messages.ts';
import { estForme } from '../../domaine/formes.ts';
import { HEURE_A_FIXER, texteHeure } from './saisieEnCours.ts';

/** Une ligne telle qu'enregistrée (base) ou à enregistrer (route) : ce qui s'imprime sur le bon. */
export type LigneTexte = {
  libelle: string;
  quantite: number;
  prixCentimes: number;
  unite: string;
  forme?: string | null;
  photoModele?: string | null;
  /** R62 : goût(s), un par étage. */
  gouts?: readonly string[] | null;
  /** R62 : décorations (Oreo, Kinder…). */
  decorations?: readonly string[] | null;
  /** Number Cake : chiffres ou lettres à réaliser (« 25 »). */
  formes?: string | null;
  /** Number Cake : nombre de chiffres ou lettres. */
  nbSymboles?: number | null;
  /** Précision imprimée sous la ligne. */
  precision?: string | null;
  /** Pain surprise : nombre de sandwichs. */
  nbObjets?: number | null;
  /** Lot 2 (28/10/2026) : écriture de CE gâteau, imprimée sous sa ligne. */
  texteGateau?: string | null;
  /** Lot 2 : « Pas d'écriture » (rien ne s'imprime : ne compte pas pour la réimpression). */
  sansEcriture?: boolean | null;
  /** Lot 2 : photo à imprimer sur CE gâteau, imprimée sous sa ligne. */
  photoImprimee?: boolean | null;
};

/** Champs de la commande imprimés sur le bon, avant ou après modification. */
export type EtatImprime = {
  client: string;
  telephone: string;
  heureRetrait: string | null;
  texteGateau: string | null;
  zoneDessin: boolean;
  totalCentimes: number;
  acompteCentimes: number;
  remarques: string | null;
  photoImprimee: boolean;
  photoWhatsapp: boolean;
  demandeInhabituelle: boolean;
  modePaiement: string;
};

/** État de la commande après modification, pour l'historique. */
export type Apres = EtatImprime & { dateRetrait: string };

/** Commande en base avant modification (sous-ensemble lu par la route). */
export type Existante = Omit<EtatImprime, 'heureRetrait'> & {
  retraitLe: Date;
  retraitHeure: string | null;
  lignes: readonly LigneTexte[];
};

/** Marqueur lu par le bon imprimé (`modifieeApresImpression`, bandeau « MODIFIÉE »). Ne pas changer. */
export const MARQUEUR_REIMPRESSION = 'à réimprimer';

/** Longueur maximale du détail d'un événement (colonne texte de l'historique). */
export const LONGUEUR_MAX_DETAIL = 2000;

function jourIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ouiNon = (b: boolean) => (b ? 'oui' : 'non');
const vide = (t: string | null | undefined) => (t ?? '').trim();
const mots = (l: readonly string[] | null | undefined) => (l ?? []).map((m) => m.trim()).filter(Boolean);

/** Une ligne en clair : tout ce que le bon en imprime, pour comparer et tracer (R31). */
export function ligneEnTexte(l: LigneTexte): string {
  // R63 : un changement de forme seul change le bon (réimpression, historique).
  const forme = estForme(l.forme) ? ` (${LIBELLES_FORME[l.forme].toLowerCase()})` : '';
  // Galerie : un changement de photo seul change le bon (réimpression, historique).
  const photo = l.photoModele ? ` (photo ${l.photoModele})` : '';
  const gouts = mots(l.gouts);
  const decorations = mots(l.decorations);
  const details = [
    gouts.length ? `goût ${gouts.join(' / ')}` : '',
    decorations.length ? `déco ${decorations.join(', ')}` : '',
    vide(l.formes) ? `chiffres ou lettres « ${vide(l.formes)} »` : '',
    l.nbSymboles != null ? `${l.nbSymboles} chiffre(s) ou lettre(s)` : '',
    vide(l.precision) ? `précision « ${vide(l.precision)} »` : '',
    l.nbObjets != null ? `${l.nbObjets} demandés` : '',
    // Une écriture par gâteau (lot 2) : changer le texte ou la photo à imprimer
    // d'UN gâteau change le bon → réimpression, et l'ancien texte est tracé (R31).
    vide(l.texteGateau) && l.sansEcriture !== true ? `écriture « ${vide(l.texteGateau)} »` : '',
    l.photoImprimee === true ? 'photo à imprimer' : '',
  ].filter(Boolean);
  const suite = details.length ? ` [${details.join(' ; ')}]` : '';
  return `${formaterQuantite(l.unite === 'kg' ? 'kg' : 'piece', l.quantite)} × ${l.libelle}${forme}${photo}${suite} à ${formaterEuros(l.prixCentimes)}`;
}

/**
 * Historique lisible : ce qui a changé, et l'ancienne version des lignes
 * (litige, R31). Liste vide = rien d'imprimé n'a changé.
 * Règle : tout champ imprimé sur le bon compte (audit du 28/10/2026).
 */
export function changementsLisibles(existante: Existante, apres: Apres, lignesApres: readonly LigneTexte[]): string[] {
  const changements: string[] = [];
  if (apres.client !== existante.client) changements.push(`client : ${existante.client} → ${apres.client}`);
  if (apres.telephone !== existante.telephone) changements.push('téléphone');
  const avantRetrait = jourIso(existante.retraitLe);
  if (apres.dateRetrait !== avantRetrait) changements.push(`retrait : ${avantRetrait} → ${apres.dateRetrait}`);
  if ((apres.heureRetrait ?? '') !== (existante.retraitHeure ?? '')) {
    // « 14h30 » comme partout ; sans heure : « heure à fixer » (audit du 28/10/2026).
    changements.push(`heure : ${texteHeure(existante.retraitHeure) ?? HEURE_A_FIXER} → ${texteHeure(apres.heureRetrait) ?? HEURE_A_FIXER}`);
  }
  if (vide(apres.texteGateau) !== vide(existante.texteGateau)) {
    changements.push(`écriture : ${existante.texteGateau ?? 'aucune'} → ${apres.texteGateau ?? 'aucune'}`);
  }
  // Le bon imprimé change (zone ajoutée ou retirée) : tracé, donc réimprimé.
  if (apres.zoneDessin !== existante.zoneDessin) {
    changements.push(`zone dessin : ${ouiNon(existante.zoneDessin)} → ${ouiNon(apres.zoneDessin)}`);
  }
  // Remarques : c'est là que vivent les allergies (propriétaire, 28/10/2026) — texte complet tracé.
  if (vide(apres.remarques) !== vide(existante.remarques)) {
    changements.push(`remarques : ${vide(existante.remarques) || 'aucune'} → ${vide(apres.remarques) || 'aucune'}`);
  }
  if (apres.photoImprimee !== existante.photoImprimee) {
    changements.push(`photo à imprimer : ${ouiNon(existante.photoImprimee)} → ${ouiNon(apres.photoImprimee)}`);
  }
  if (apres.photoWhatsapp !== existante.photoWhatsapp) {
    changements.push(`photo WhatsApp : ${ouiNon(existante.photoWhatsapp)} → ${ouiNon(apres.photoWhatsapp)}`);
  }
  if (apres.demandeInhabituelle !== existante.demandeInhabituelle) {
    changements.push(`demande inhabituelle : ${ouiNon(existante.demandeInhabituelle)} → ${ouiNon(apres.demandeInhabituelle)}`);
  }
  if (apres.modePaiement !== existante.modePaiement) {
    changements.push(`paiement : ${existante.modePaiement} → ${apres.modePaiement}`);
  }
  const versTexte = (ls: readonly LigneTexte[]) => ls.map(ligneEnTexte).join(' ; ');
  const avant = versTexte(existante.lignes);
  if (avant !== versTexte(lignesApres)) changements.push(`produits — avant : ${avant}`);
  if (apres.totalCentimes !== existante.totalCentimes) {
    changements.push(`total : ${formaterEuros(existante.totalCentimes)} → ${formaterEuros(apres.totalCentimes)}`);
  }
  if (apres.acompteCentimes !== existante.acompteCentimes) {
    changements.push(`acompte : ${formaterEuros(existante.acompteCentimes)} → ${formaterEuros(apres.acompteCentimes)}`);
  }
  return changements;
}

/**
 * Détail de l'événement « modification ». Le marqueur « à réimprimer » est
 * EN TÊTE et n'est jamais coupé : seule la suite est tronquée à
 * `LONGUEUR_MAX_DETAIL` (avant : marqueur en fin de texte, perdu sur une
 * grosse commande → plus de bandeau « MODIFIÉE » sur le bon).
 */
export function detailModification(changements: readonly string[], aReimprimer: boolean, max = LONGUEUR_MAX_DETAIL): string {
  if (changements.length === 0) return 'aucun changement';
  const corps = changements.join(', ');
  if (!aReimprimer) return corps.slice(0, max);
  const tete = `${MARQUEUR_REIMPRESSION} — `;
  return (tete + corps).slice(0, Math.max(max, tete.length));
}
