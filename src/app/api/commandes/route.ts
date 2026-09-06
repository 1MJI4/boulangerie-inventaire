// src/app/api/commandes/route.ts
//
// Une commande n'est jamais effacée : l'annuler pose un statut, la modifier
// ajoute une ligne d'historique. Le vendeur reste libre de tout changer, mais
// le jour où une commande pose problème on sait ce qui s'est passé.

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { diagnostiquer } from '@/lib/erreurBase';
import {
  JOURS_AVANT_ANONYMISATION,
  MENTION_ANONYME,
  STATUTS,
  formaterNumero,
  totalCentimes,
} from '@/lib/commandes';
import { decalerJours, dateDuJour } from '@/lib/dateProduction';

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT_HEURE = /^\d{2}:\d{2}$/;

const inclusions = {
  lignes: { orderBy: { ordre: 'asc' } as const },
  evenements: { orderBy: { quand: 'desc' } as const, take: 20 },
};

function texte(valeur: unknown, max = 200): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

/* -------------------------------------------------------------------- GET */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const numero = searchParams.get('numero');
    const statut = searchParams.get('statut');
    const du = searchParams.get('du');
    const au = searchParams.get('au');
    const recherche = texte(searchParams.get('q'), 60);

    if (Number.isFinite(id) && id > 0) {
      const commande = await prisma.commande.findUnique({ where: { id }, include: inclusions });
      if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      return NextResponse.json(commande);
    }

    if (numero) {
      const commande = await prisma.commande.findUnique({ where: { numero }, include: inclusions });
      if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      return NextResponse.json(commande);
    }

    const where: Prisma.CommandeWhereInput = {};
    if (statut && (STATUTS as readonly string[]).includes(statut)) where.statut = statut;
    if (statut === 'en_cours') where.statut = { in: ['a_imprimer', 'imprimee'] };
    if (du && FORMAT_DATE.test(du)) where.retraitLe = { gte: new Date(`${du}T00:00:00Z`) };
    if (au && FORMAT_DATE.test(au)) {
      where.retraitLe = { ...(where.retraitLe as object), lte: new Date(`${au}T00:00:00Z`) };
    }
    if (recherche) {
      where.OR = [
        { client: { contains: recherche, mode: 'insensitive' } },
        { telephone: { contains: recherche } },
        { numero: { contains: recherche, mode: 'insensitive' } },
      ];
    }

    const commandes = await prisma.commande.findMany({
      where,
      include: inclusions,
      orderBy: [{ retraitLe: 'asc' }, { retraitHeure: 'asc' }],
      take: 200,
    });

    return NextResponse.json(commandes);
  } catch (error) {
    console.error('GET /api/commandes', error);
    return NextResponse.json(diagnostiquer(error), { status: 500 });
  }
}

/* ------------------------------------------------------------------- POST */

type LigneEntrante = {
  libelle?: unknown;
  quantite?: unknown;
  prixCentimes?: unknown;
  poste?: unknown;
  precision?: unknown;
  tarifId?: unknown;
};

function normaliserLignes(brut: unknown) {
  if (!Array.isArray(brut)) return [];
  return brut
    .map((l: LigneEntrante, index) => ({
      libelle: texte(l.libelle, 120),
      quantite: Math.max(1, Math.round(Number(l.quantite) || 0)),
      prixCentimes: Math.max(0, Math.round(Number(l.prixCentimes) || 0)),
      poste: typeof l.poste === 'string' && l.poste ? l.poste : null,
      precision: texte(l.precision, 200) || null,
      tarifId: Number.isFinite(Number(l.tarifId)) && Number(l.tarifId) > 0 ? Number(l.tarifId) : null,
      ordre: index,
    }))
    .filter((l) => l.libelle !== '');
}

export async function POST(request: Request) {
  try {
    const corps = await request.json();

    const client = texte(corps.client, 80);
    const telephone = texte(corps.telephone, 30);
    const vendeur = texte(corps.vendeur, 40);
    const retraitLe = texte(corps.retraitLe, 10);
    const retraitHeure = texte(corps.retraitHeure, 5);

    if (!client) return NextResponse.json({ error: 'Le nom du client est obligatoire.' }, { status: 400 });
    if (!telephone) return NextResponse.json({ error: 'Le téléphone est obligatoire.' }, { status: 400 });
    if (!vendeur) return NextResponse.json({ error: 'Le vendeur est obligatoire.' }, { status: 400 });
    if (!FORMAT_DATE.test(retraitLe)) {
      return NextResponse.json({ error: 'Date de retrait invalide.' }, { status: 400 });
    }
    if (!FORMAT_HEURE.test(retraitHeure)) {
      return NextResponse.json({ error: 'Heure de retrait invalide.' }, { status: 400 });
    }

    const lignes = normaliserLignes(corps.lignes);
    if (lignes.length === 0) {
      return NextResponse.json({ error: 'Ajoutez au moins un produit.' }, { status: 400 });
    }

    const acompteCentimes = Math.max(0, Math.round(Number(corps.acompteCentimes) || 0));
    if (acompteCentimes <= 0) {
      // « Pas d'acompte, pas de commande » : une commande sans acompte n'est
      // pas fiable. Au téléphone il se paie par virement, mais il est promis.
      return NextResponse.json(
        { error: "Une commande doit avoir un acompte pour être validée." },
        { status: 400 }
      );
    }

    const modePaiement = corps.modePaiement === 'virement' ? 'virement' : 'especes';
    const origine = corps.origine === 'telephone' ? 'telephone' : 'comptoir';
    const total = corps.totalCentimes ? Math.round(Number(corps.totalCentimes)) : totalCentimes(lignes);

    const annee = Number(retraitLe.slice(0, 4)) || new Date().getFullYear();

    // La numérotation se fait dans la transaction qui crée la commande :
    // deux vendeurs qui valident en même temps ne peuvent pas obtenir le
    // même numéro, or ce numéro sert de communication de virement.
    const commande = await prisma.$transaction(async (tx) => {
      const derniere = await tx.commande.findFirst({
        where: { annee },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      const sequence = (derniere?.sequence ?? 0) + 1;

      return tx.commande.create({
        data: {
          numero: formaterNumero(annee, sequence),
          annee,
          sequence,
          client,
          telephone,
          vendeur,
          origine,
          retraitLe: new Date(`${retraitLe}T00:00:00Z`),
          retraitHeure,
          modePaiement,
          acompteCentimes,
          // Au comptoir l'argent est là ; au téléphone il arrive par virement.
          acompteRecuLe: modePaiement === 'especes' ? new Date() : null,
          totalCentimes: total,
          texteGateau: texte(corps.texteGateau, 200) || null,
          sansEcriture: corps.sansEcriture === true,
          photoWhatsapp: corps.photoWhatsapp === true,
          photoImprimee: corps.photoImprimee === true,
          gateauComplexe: corps.gateauComplexe === true,
          remarques: texte(corps.remarques, 500) || null,
          avertissements: Array.isArray(corps.avertissements)
            ? JSON.stringify(corps.avertissements)
            : null,
          lignes: { create: lignes },
          evenements: {
            create: {
              auteur: vendeur,
              action: 'creation',
              detail: origine === 'telephone' ? 'Prise par téléphone' : null,
            },
          },
        },
        include: inclusions,
      });
    });

    return NextResponse.json(commande, { status: 201 });
  } catch (error) {
    console.error('POST /api/commandes', error);
    return NextResponse.json(diagnostiquer(error), { status: 500 });
  }
}

/* ------------------------------------------------------------------ PATCH */

export async function PATCH(request: Request) {
  try {
    const corps = await request.json();
    const id = Number(corps.id);
    const auteur = texte(corps.auteur, 40) || 'inconnu';
    const action = texte(corps.action, 30);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Commande invalide' }, { status: 400 });
    }

    const existante = await prisma.commande.findUnique({ where: { id } });
    if (!existante) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

    const maintenant = new Date();
    const donnees: Prisma.CommandeUpdateInput = {};
    let detail: string | null = null;

    switch (action) {
      case 'impression':
        donnees.statut = 'imprimee';
        donnees.imprimeeLe = maintenant;
        detail = 'Feuillets sortis';
        break;

      case 'remise':
        donnees.statut = 'remise';
        donnees.remiseLe = maintenant;
        // Le solde est encaissé au moment où la commande part.
        if (!existante.acompteRecuLe) donnees.acompteRecuLe = maintenant;
        break;

      case 'acompte':
        donnees.acompteRecuLe = maintenant;
        detail = 'Virement constaté';
        break;

      case 'annulation':
        donnees.statut = 'annulee';
        donnees.annuleeLe = maintenant;
        donnees.motif = texte(corps.motif, 200) || 'Sans motif';
        detail = donnees.motif as string;
        break;

      case 'modification': {
        const changements: string[] = [];
        if (typeof corps.client === 'string' && texte(corps.client, 80) !== existante.client) {
          donnees.client = texte(corps.client, 80);
          changements.push(`client : ${existante.client} → ${donnees.client}`);
        }
        if (typeof corps.telephone === 'string' && texte(corps.telephone, 30) !== existante.telephone) {
          donnees.telephone = texte(corps.telephone, 30);
          changements.push('téléphone');
        }
        if (typeof corps.retraitHeure === 'string' && FORMAT_HEURE.test(corps.retraitHeure)) {
          if (corps.retraitHeure !== existante.retraitHeure) {
            donnees.retraitHeure = corps.retraitHeure;
            changements.push(`heure : ${existante.retraitHeure} → ${corps.retraitHeure}`);
          }
        }
        if (typeof corps.retraitLe === 'string' && FORMAT_DATE.test(corps.retraitLe)) {
          const avant = existante.retraitLe.toISOString().slice(0, 10);
          if (corps.retraitLe !== avant) {
            donnees.retraitLe = new Date(`${corps.retraitLe}T00:00:00Z`);
            changements.push(`retrait : ${avant} → ${corps.retraitLe}`);
          }
        }
        if (typeof corps.remarques === 'string') donnees.remarques = texte(corps.remarques, 500) || null;
        if (typeof corps.texteGateau === 'string') donnees.texteGateau = texte(corps.texteGateau, 200) || null;
        if (typeof corps.sansEcriture === 'boolean') donnees.sansEcriture = corps.sansEcriture;
        if (typeof corps.photoWhatsapp === 'boolean') donnees.photoWhatsapp = corps.photoWhatsapp;
        if (typeof corps.photoImprimee === 'boolean') donnees.photoImprimee = corps.photoImprimee;
        if (typeof corps.gateauComplexe === 'boolean') donnees.gateauComplexe = corps.gateauComplexe;

        if (Array.isArray(corps.lignes)) {
          const lignes = normaliserLignes(corps.lignes);
          if (lignes.length > 0) {
            await prisma.ligneCommande.deleteMany({ where: { commandeId: id } });
            await prisma.ligneCommande.createMany({
              data: lignes.map((l) => ({ ...l, commandeId: id })),
            });
            donnees.totalCentimes = totalCentimes(lignes);
            changements.push('produits');
          }
        }

        // Un prix convenu au comptoir l'emporte sur la somme des lignes. On ne
        // journalise le total qu'une fois la valeur finale connue, sinon
        // l'historique annonce un montant qui n'a jamais été enregistré.
        if (Number.isFinite(Number(corps.totalCentimes)) && Number(corps.totalCentimes) > 0) {
          donnees.totalCentimes = Math.round(Number(corps.totalCentimes));
        }
        if (
          typeof donnees.totalCentimes === 'number' &&
          donnees.totalCentimes !== existante.totalCentimes
        ) {
          changements.push(
            `total : ${(existante.totalCentimes / 100).toFixed(2)} → ${(donnees.totalCentimes / 100).toFixed(2)}`
          );
        }

        if (Number.isFinite(Number(corps.acompteCentimes)) && Number(corps.acompteCentimes) > 0) {
          const acompte = Math.round(Number(corps.acompteCentimes));
          if (acompte !== existante.acompteCentimes) {
            donnees.acompteCentimes = acompte;
            changements.push(
              `acompte : ${(existante.acompteCentimes / 100).toFixed(2)} → ${(acompte / 100).toFixed(2)}`
            );
          }
        }

        if (corps.modePaiement === 'especes' || corps.modePaiement === 'virement') {
          if (corps.modePaiement !== existante.modePaiement) {
            donnees.modePaiement = corps.modePaiement;
            changements.push(`paiement : ${corps.modePaiement}`);
          }
        }

        // Une commande modifiée doit repasser par l'imprimante : le feuillet
        // accroché à l'atelier ne dit plus la vérité.
        if (changements.length > 0 && existante.statut === 'imprimee') {
          donnees.statut = 'a_imprimer';
          donnees.imprimeeLe = null;
          changements.push('à réimprimer');
        }

        // Une commande retouchée cinq fois la veille, c'est un signal :
        // on garde le détail, pas seulement le fait qu'elle a changé.
        detail = changements.join(', ') || 'aucun changement';
        break;
      }

      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    const commande = await prisma.commande.update({
      where: { id },
      data: { ...donnees, evenements: { create: { auteur, action, detail } } },
      include: inclusions,
    });

    return NextResponse.json(commande);
  } catch (error) {
    console.error('PATCH /api/commandes', error);
    return NextResponse.json(diagnostiquer(error), { status: 500 });
  }
}

/* -------------------------------------------------------------- Entretien */

/**
 * Archivage à J+2, anonymisation à 30 jours. Appelée par l'application au
 * chargement de la liste : pas de tâche planifiée à surveiller, et le ménage
 * se fait de toute façon puisque quelqu'un ouvre l'écran tous les jours.
 */
export async function PUT() {
  try {
    const aujourdhui = dateDuJour();
    const limiteArchivage = new Date(`${decalerJours(aujourdhui, -2)}T00:00:00Z`);
    const limiteAnonymisation = new Date(
      `${decalerJours(aujourdhui, -JOURS_AVANT_ANONYMISATION)}T00:00:00Z`
    );

    const archivees = await prisma.commande.updateMany({
      where: { retraitLe: { lt: limiteArchivage }, archiveeLe: null },
      data: { archiveeLe: new Date() },
    });

    // Ce qui reste — date, produits, montants — n'identifie plus personne.
    const anonymisees = await prisma.commande.updateMany({
      where: { retraitLe: { lt: limiteAnonymisation }, anonymiseeLe: null },
      data: {
        client: MENTION_ANONYME,
        telephone: '',
        vendeur: '',
        anonymiseeLe: new Date(),
      },
    });

    return NextResponse.json({ archivees: archivees.count, anonymisees: anonymisees.count });
  } catch (error) {
    console.error('PUT /api/commandes', error);
    return NextResponse.json(diagnostiquer(error), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
