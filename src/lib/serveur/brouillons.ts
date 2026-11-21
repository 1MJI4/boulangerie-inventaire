// src/lib/serveur/brouillons.ts
//
// Brouillons de commande WhatsApp (21/11/2026) : accès base et appels aux contrôles
// existants. AUCUNE règle ici : délais, état et message sont dans
// src/domaine/brouillons.ts ; les contrôles de la commande (prix, jours fermés, minimums,
// acompte…) sont REJOUÉS par la route des commandes elle-même, appelée en interne — une
// seule source de validation.
//
// Coordonnées du compte (jamais dans le dépôt) :
//   PAIEMENT_BENEFICIAIRE, PAIEMENT_IBAN  → /etc/pain-patisserie/env
// Sans elles, le brouillon se crée mais le message n'est pas généré (dit à l'écran).

import { prisma } from '@/lib/prisma';
import { POST as creerOuSimulerCommande } from '@/app/api/commandes/route';
import {
  etatBrouillon,
  lienWhatsApp,
  messagePaiement,
  type EtatBrouillon,
  type Langue,
  type LigneMessage,
  type StatutBrouillon,
} from '@/domaine/brouillons';

export type CoordonneesPaiement = { beneficiaire: string; iban: string };

export function coordonneesPaiement(): CoordonneesPaiement | null {
  const beneficiaire = process.env.PAIEMENT_BENEFICIAIRE?.trim();
  const iban = process.env.PAIEMENT_IBAN?.trim();
  return beneficiaire && iban ? { beneficiaire, iban } : null;
}

/** Ce qui est gardé dans `BrouillonCommande.corps` : la saisie telle que reçue + le résumé calculé par le serveur. */
export type CorpsBrouillon = { saisie: Record<string, unknown>; resume: LigneMessage[] };

export type BrouillonVue = {
  id: number;
  reference: string;
  statut: StatutBrouillon;
  etat: EtatBrouillon;
  langue: Langue;
  client: string;
  telephone: string;
  retraitLe: string;
  retraitHeure: string | null;
  totalCentimes: number;
  creeLe: string;
  echeanceLe: string;
  delaiMinutes: number;
  auteur: string;
  commandeId: number | null;
  confirmePar: string | null;
  /** Texte prêt à envoyer ; null si les coordonnées du compte ne sont pas réglées sur le serveur. */
  message: string | null;
  /** Lien qui ouvre WhatsApp avec le texte ; null sans message ou sans numéro utilisable. */
  lienWhatsApp: string | null;
};

type Ligne = Awaited<ReturnType<typeof prisma.brouillonCommande.findMany>>[number];

export function versVue(b: Ligne, maintenant: Date): BrouillonVue {
  const retraitLe = b.retraitLe.toISOString().slice(0, 10);
  // Le délai en cours : de la création (ou de la dernière relance) à l'échéance.
  const debut = b.relanceLe ?? b.creeLe;
  const delaiMinutes = Math.max(1, Math.round((b.echeanceLe.getTime() - debut.getTime()) / 60_000));
  const compte = coordonneesPaiement();
  const corps = b.corps as unknown as CorpsBrouillon;
  const message = compte
    ? messagePaiement({
        langue: b.langue as Langue,
        lignes: corps.resume ?? [],
        retraitLe,
        retraitHeure: b.retraitHeure,
        totalCentimes: b.totalCentimes,
        reference: b.reference,
        delaiMinutes,
        beneficiaire: compte.beneficiaire,
        iban: compte.iban,
      })
    : null;
  return {
    id: b.id,
    reference: b.reference,
    statut: b.statut as StatutBrouillon,
    etat: etatBrouillon({ statut: b.statut as StatutBrouillon, echeanceLe: b.echeanceLe }, maintenant),
    langue: b.langue as Langue,
    client: b.client,
    telephone: b.telephone,
    retraitLe,
    retraitHeure: b.retraitHeure,
    totalCentimes: b.totalCentimes,
    creeLe: b.creeLe.toISOString(),
    echeanceLe: b.echeanceLe.toISOString(),
    delaiMinutes,
    auteur: b.auteur,
    commandeId: b.commandeId,
    confirmePar: b.confirmePar,
    message,
    lienWhatsApp: message && b.telephone ? lienWhatsApp(b.telephone, message) : null,
  };
}

/**
 * Appelle la route des commandes EN INTERNE, avec les cookies de la requête d'origine :
 * mêmes droits, mêmes contrôles, mêmes messages que depuis l'écran.
 */
export async function appelerCommandes(requete: Request, corps: Record<string, unknown>): Promise<Response> {
  const interne = new Request(new URL('/api/commandes', requete.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: requete.headers.get('cookie') ?? '' },
    body: JSON.stringify(corps),
  });
  return creerOuSimulerCommande(interne);
}

export async function listerBrouillons(maintenant: Date): Promise<BrouillonVue[]> {
  const depuis = new Date(maintenant.getTime() - 2 * 86_400_000);
  const lignes = await prisma.brouillonCommande.findMany({
    // En attente (ou expirés) sans limite de temps ; payés ou écartés : les deux derniers jours seulement.
    where: { OR: [{ statut: 'en_attente' }, { creeLe: { gte: depuis } }] },
    orderBy: { creeLe: 'desc' },
    take: 200,
  });
  return lignes.map((l) => versVue(l, maintenant));
}
