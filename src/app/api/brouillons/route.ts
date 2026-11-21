// Brouillons de commande WhatsApp (21/11/2026) : écran du manager. Un brouillon n'est PAS une
// commande ; il le devient quand le manager confirme le paiement (PATCH « confirmer »).
// Les contrôles de la commande (prix, jours fermés, minimums, acompte…) sont ceux de
// POST /api/commandes, appelée en interne : rien n'est dupliqué ici.
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { dateDuJour } from '@/lib/dateProduction';
import {
  LANGUES,
  delaiPaiementMinutes,
  echeancePaiement,
  referencePaiement,
  type Langue,
} from '@/domaine/brouillons';
import { appelerCommandes, listerBrouillons, versVue, type CorpsBrouillon } from '@/lib/serveur/brouillons';

const SANS_STOCK = { 'Cache-Control': 'no-store' };

function nom(valeur: unknown): string {
  return String(valeur ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function message(texte: string, statut: number) {
  return NextResponse.json({ ok: false, message: texte, error: texte, erreur: texte }, { status: statut, headers: SANS_STOCK });
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les brouillons');
  if (!garde.ok) return garde.reponse;
  const maintenant = new Date();
  const brouillons = await listerBrouillons(maintenant);
  return NextResponse.json({ maintenant: maintenant.toISOString(), brouillons }, { headers: SANS_STOCK });
}

export async function POST(request: Request) {
  const garde = exigerRole(request, 'tablette', 'créer un brouillon de commande');
  if (!garde.ok) return garde.reponse;
  const entree = (await request.json().catch(() => null)) as { corps?: Record<string, unknown>; langue?: unknown; auteur?: unknown } | null;
  const auteur = nom(entree?.auteur);
  const langue = (LANGUES as readonly unknown[]).includes(entree?.langue) ? (entree?.langue as Langue) : 'fr';
  if (!entree?.corps || typeof entree.corps !== 'object') return message('La commande à mettre en brouillon est vide.', 400);
  if (!auteur) return message('Touchez votre prénom avant de créer le brouillon.', 400);

  // Mêmes contrôles qu'une commande, rejoués par le serveur ; le total vient de lui (LOI 1).
  const saisie = { ...entree.corps, origine: 'whatsapp', vendeur: auteur };
  const simule = await appelerCommandes(request, { ...saisie, simulation: true });
  if (!simule.ok) return simule;
  const calcule = (await simule.json()) as {
    totalCentimes: number;
    dateRetrait: string;
    heureRetrait: string | null;
    lignes: CorpsBrouillon['resume'];
  };

  const maintenant = new Date();
  const delai = delaiPaiementMinutes(calcule.dateRetrait, dateDuJour(maintenant));
  const corps: CorpsBrouillon = { saisie, resume: calcule.lignes };
  const cree = await prisma.$transaction(async (tx) => {
    const b = await tx.brouillonCommande.create({
      data: {
        reference: `tmp-${randomUUID()}`,
        langue,
        client: nom(entree.corps?.client) || 'WhatsApp',
        telephone: String(entree.corps?.telephone ?? '').trim().slice(0, 30),
        retraitLe: new Date(`${calcule.dateRetrait}T00:00:00Z`),
        retraitHeure: calcule.heureRetrait,
        totalCentimes: calcule.totalCentimes,
        corps: corps as never,
        idClient: randomUUID(),
        auteur,
        echeanceLe: echeancePaiement(maintenant, delai),
      },
    });
    return tx.brouillonCommande.update({
      where: { id: b.id },
      data: { reference: referencePaiement(dateDuJour(maintenant), b.id) },
    });
  });
  return NextResponse.json({ ok: true, brouillon: versVue(cree, maintenant) }, { status: 201, headers: SANS_STOCK });
}

export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'tablette', 'modifier un brouillon de commande');
  if (!garde.ok) return garde.reponse;
  const entree = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown; par?: unknown } | null;
  const id = Number(entree?.id);
  const par = nom(entree?.par);
  if (!Number.isSafeInteger(id) || id <= 0) return message('Brouillon introuvable.', 404);
  const b = await prisma.brouillonCommande.findUnique({ where: { id } });
  if (!b) return message('Brouillon introuvable.', 404);
  if (b.statut !== 'en_attente') return message('Ce brouillon est déjà traité.', 409);
  const maintenant = new Date();

  if (entree?.action === 'abandonner') {
    const mis = await prisma.brouillonCommande.update({ where: { id }, data: { statut: 'abandonne' } });
    return NextResponse.json({ ok: true, brouillon: versVue(mis, maintenant) }, { headers: SANS_STOCK });
  }

  if (entree?.action === 'relancer') {
    const retrait = b.retraitLe.toISOString().slice(0, 10);
    const aujourdhui = dateDuJour(maintenant);
    if (retrait < aujourdhui) return message('La date de retrait est passée : créez un nouveau brouillon.', 409);
    const mis = await prisma.brouillonCommande.update({
      where: { id },
      data: {
        echeanceLe: echeancePaiement(maintenant, delaiPaiementMinutes(retrait, aujourdhui)),
        relanceLe: maintenant,
        expireNotifieLe: null,
      },
    });
    return NextResponse.json({ ok: true, brouillon: versVue(mis, maintenant) }, { headers: SANS_STOCK });
  }

  if (entree?.action === 'confirmer') {
    if (!par) return message('Touchez votre prénom avant de confirmer le paiement.', 400);
    const corps = b.corps as unknown as CorpsBrouillon;
    // 1. Tout est revérifié MAINTENANT (une date a pu passer, un tarif changer).
    const simule = await appelerCommandes(request, { ...corps.saisie, simulation: true });
    if (!simule.ok) return simule;
    const calcule = (await simule.json()) as { totalCentimes: number };
    if (calcule.totalCentimes !== b.totalCentimes) {
      return message(
        'Le total de la commande a changé depuis l’envoi du message au client. Vérifiez avec lui avant de confirmer, ou écartez ce brouillon et créez-en un nouveau.',
        409,
      );
    }
    // 2. La vraie commande : payée en virement, l'acompte est le total demandé. Le même identifiant
    //    d'envoi (celui du brouillon) garantit qu'une confirmation répétée ne crée qu'UNE commande.
    const remarques = [String(corps.saisie.remarques ?? '').trim(), `Paiement WhatsApp — réf. ${b.reference}`]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 500);
    const creee = await appelerCommandes(request, {
      ...corps.saisie,
      simulation: false,
      idClient: b.idClient,
      priseLe: maintenant.toISOString(),
      modePaiement: 'virement',
      acompteCentimes: b.totalCentimes,
      remarques,
    });
    if (!creee.ok) return creee;
    const commande = (await creee.json()) as { id: number; numero: string };
    const mis = await prisma.brouillonCommande.update({
      where: { id },
      data: { statut: 'confirme', commandeId: commande.id, confirmeLe: maintenant, confirmePar: par },
    });
    return NextResponse.json({ ok: true, commande: { id: commande.id, numero: commande.numero }, brouillon: versVue(mis, maintenant) }, { headers: SANS_STOCK });
  }

  return message('Action inconnue.', 400);
}
