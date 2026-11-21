// src/domaine/brouillons.ts
//
// Brouillons de commande WhatsApp (propriétaire, 21/11/2026). Le manager reçoit une
// commande par WhatsApp : il crée un BROUILLON, envoie au client un message avec le
// montant à virer, et le brouillon devient une vraie commande quand il confirme le
// paiement. Propriétaire : agent `regles-metier`. Fonctions pures, aucun accès base.
//
// Règles décidées :
//  - délai de paiement : 5 minutes pour un retrait LE JOUR MÊME, 1 heure pour un
//    retrait les jours suivants (compté sur l'heure du serveur) ;
//  - passé le délai, le brouillon n'est PAS effacé : il passe dans « Expirés » et se
//    relance en un geste ;
//  - 5 minutes après l'expiration, le manager est prévenu (notification) ;
//  - le montant demandé est le TOTAL de la commande ;
//  - messages en français et en anglais (pas de néerlandais) ;
//  - un brouillon ne compte pour rien : ni fournil, ni prévisions, ni bon imprimé.

import { formaterEuros } from './argent.ts';
import { formaterQuantite } from './unites.ts';
import { minutesDeLHeure } from './retard.ts';

/** Délai de paiement d'un retrait le jour même (minutes). Réglage, pas une constante d'écran. */
export const DELAI_PAIEMENT_MEME_JOUR_MINUTES = 5;
/** Délai de paiement d'un retrait un autre jour (minutes). */
export const DELAI_PAIEMENT_AUTRE_JOUR_MINUTES = 60;
/** Combien de temps après l'expiration on prévient le manager (minutes). */
export const DELAI_ALERTE_APRES_EXPIRATION_MINUTES = 5;

export type Langue = 'fr' | 'en';
export const LANGUES: readonly Langue[] = ['fr', 'en'];

export type StatutBrouillon = 'en_attente' | 'confirme' | 'abandonne';
export type EtatBrouillon = 'en_attente' | 'expire' | 'confirme' | 'abandonne';

/** 5 minutes si le retrait est aujourd'hui (date de Bruxelles), 1 heure sinon. */
export function delaiPaiementMinutes(retraitLe: string, aujourdhui: string): number {
  return retraitLe.slice(0, 10) === aujourdhui.slice(0, 10)
    ? DELAI_PAIEMENT_MEME_JOUR_MINUTES
    : DELAI_PAIEMENT_AUTRE_JOUR_MINUTES;
}

/** Instant de fin du délai, à partir de `depuis` (création ou relance). */
export function echeancePaiement(depuis: Date, delaiMinutes: number): Date {
  return new Date(depuis.getTime() + delaiMinutes * 60_000);
}

/** L'état affiché : « expiré » se déduit de l'heure, rien n'est jamais réécrit pour cela. */
export function etatBrouillon(b: { statut: StatutBrouillon; echeanceLe: Date }, maintenant: Date): EtatBrouillon {
  if (b.statut !== 'en_attente') return b.statut;
  return b.echeanceLe.getTime() > maintenant.getTime() ? 'en_attente' : 'expire';
}

/** Secondes restantes avant l'expiration (0 si expiré). */
export function secondesRestantes(echeanceLe: Date, maintenant: Date): number {
  return Math.max(0, Math.ceil((echeanceLe.getTime() - maintenant.getTime()) / 1000));
}

/** « 12:34 » à partir de secondes : le compte à rebours de l'écran. */
export function formaterCompteARebours(secondes: number): string {
  const s = Math.max(0, Math.trunc(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const reste = s % 60;
  const deux = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${deux(m)}:${deux(reste)}` : `${deux(m)}:${deux(reste)}`;
}

/** La notification « non payé » est due 5 minutes après l'expiration, une seule fois. */
export function alerteExpirationDue(
  b: { statut: StatutBrouillon; echeanceLe: Date; expireNotifieLe: Date | null },
  maintenant: Date,
): boolean {
  if (b.statut !== 'en_attente' || b.expireNotifieLe !== null) return false;
  return maintenant.getTime() >= b.echeanceLe.getTime() + DELAI_ALERTE_APRES_EXPIRATION_MINUTES * 60_000;
}

/**
 * Communication du virement : jour de création (JJ/MM, Bruxelles) + numéro du
 * brouillon — « 21/11-727 ». Conservée sur la commande une fois payée.
 */
export function referencePaiement(jourCreation: string, numero: number): string {
  return `${jourCreation.slice(8, 10)}/${jourCreation.slice(5, 7)}-${numero}`;
}

/* ------------------------------------------------------------- Le message */

export type LigneMessage = {
  quantite: number;
  /** Libellé du catalogue, à la lettre (LOI 5). */
  libelle: string;
  unite?: 'piece' | 'kg';
  /** « personne » : la quantité est un nombre de parts. */
  basePrix?: string | null;
};

export type EntreeMessage = {
  langue: Langue;
  lignes: readonly LigneMessage[];
  /** « AAAA-MM-JJ ». */
  retraitLe: string;
  /** « HH:MM » ou absent. */
  retraitHeure: string | null | undefined;
  totalCentimes: number;
  reference: string;
  delaiMinutes: number;
  beneficiaire: string;
  iban: string;
};

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MOIS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function jourDeSemaine(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay();
}

/** « 14h00 » (fr) ou « 2:00 PM » (en) ; null si l'heure est absente ou illisible. */
export function heureDuMessage(heure: string | null | undefined, langue: Langue): string | null {
  const min = minutesDeLHeure(heure);
  if (min === null) return null;
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  if (langue === 'fr') return `${h}h${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** « samedi 21/11 » (fr) ou « Saturday, 21 November » (en). */
export function jourDuMessage(retraitLe: string, langue: Langue): string {
  const iso = retraitLe.slice(0, 10);
  const jour = jourDeSemaine(iso);
  const j = Number(iso.slice(8, 10));
  const mois = Number(iso.slice(5, 7));
  return langue === 'fr'
    ? `${JOURS_FR[jour]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
    : `${JOURS_EN[jour]}, ${j} ${MOIS_EN[mois - 1]}`;
}

/** Montant écrit à la française, ou à l'anglaise (symbole devant, point décimal) — jamais de calcul, seulement une mise en forme. */
export function montantDuMessage(centimes: number, langue: Langue): string {
  const fr = formaterEuros(centimes);
  if (langue === 'fr') return fr;
  return `€${fr.replace(/\s*€/, '').replace(/\s/g, '').replace(',', '.')}`;
}

function delaiEnTexte(minutes: number, langue: Langue): string {
  if (minutes === 60) return langue === 'fr' ? 'dans l’heure' : 'within one hour';
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return langue === 'fr' ? `dans les ${h} heures` : `within ${h} hours`;
  }
  return langue === 'fr' ? `dans les ${minutes} minutes` : `within ${minutes} minutes`;
}

function ligneDuMessage(l: LigneMessage, langue: Langue): string {
  if (l.unite === 'kg') return `${formaterQuantite('kg', l.quantite)} ${l.libelle}`;
  if (l.basePrix === 'personne') return langue === 'fr' ? `${l.libelle} pour ${l.quantite} personnes` : `${l.libelle} for ${l.quantite} people`;
  return `${l.quantite} ${l.libelle}`;
}

/**
 * Le message de confirmation envoyé au client par WhatsApp (modèles du manager,
 * 21/11/2026). Le total vient du serveur, jamais d'une saisie.
 */
export function messagePaiement(e: EntreeMessage): string {
  const lignes = e.lignes.map((l) => `* ${ligneDuMessage(l, e.langue)}`).join('\n');
  const jour = jourDuMessage(e.retraitLe, e.langue);
  const heure = heureDuMessage(e.retraitHeure, e.langue);
  const montant = montantDuMessage(e.totalCentimes, e.langue);
  const delai = delaiEnTexte(e.delaiMinutes, e.langue);
  if (e.langue === 'fr') {
    return [
      'Je vous envoie ce message pour confirmer votre commande de :',
      '',
      lignes,
      '',
      `Pour ${jour}${heure ? ` à ${heure}` : ''}.`,
      '',
      `Vous pouvez effectuer le règlement de ${montant} sur le compte suivant :`,
      '',
      `Bénéficiaire : ${e.beneficiaire}`,
      `IBAN : ${e.iban}`,
      '',
      'Communication :',
      `Commande ${e.reference}`,
      '',
      `Afin de valider votre commande, veuillez nous envoyer la preuve de paiement ${delai}.`,
      'Merci encore pour votre confiance.',
    ].join('\n');
  }
  return [
    'I’m sending you this message to confirm the following order:',
    '',
    lignes,
    '',
    `For ${jour}${heure ? `, at ${heure}` : ''}.`,
    '',
    `You can make the payment of ${montant} to the following bank account:`,
    '',
    `Beneficiary: ${e.beneficiaire}`,
    `IBAN: ${e.iban}`,
    '',
    `Payment reference: Order ${e.reference}`,
    '',
    `To confirm your order, please send us proof of payment ${delai}.`,
    'Thank you once again for your trust!',
  ].join('\n');
}

/**
 * Lien WhatsApp qui ouvre la conversation avec le texte déjà écrit. Le numéro belge
 * « 0472 25 05 78 » devient « 32472250578 ». null si le numéro est inutilisable.
 */
export function lienWhatsApp(telephone: string, message: string): string | null {
  let chiffres = telephone.replace(/[^\d+]/g, '');
  if (chiffres.startsWith('+')) chiffres = chiffres.slice(1);
  else if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  else if (chiffres.startsWith('0')) chiffres = `32${chiffres.slice(1)}`;
  if (!/^\d{9,15}$/.test(chiffres)) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`;
}
