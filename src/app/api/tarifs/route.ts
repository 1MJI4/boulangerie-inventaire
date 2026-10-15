// src/app/api/tarifs/route.ts
//
// La grille tarifaire aide le vendeur à saisir vite et au bon prix. Elle est
// à jour aujourd'hui, elle ne le sera plus dans six mois : le manager doit
// pouvoir la corriger lui-même, sans attendre une mise à jour de l'application.

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { traiterErreur } from '@/lib/erreurBase';
import { estPoste } from '@/lib/postes';
import { exigerRole } from '@/lib/auth/garde';

// Droits : voir src/lib/auth/matrice.ts (lecture : toute tablette installée ; écriture : gérant).

function texte(valeur: unknown, max = 120): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les tarifs');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);
    const inclureInactifs = searchParams.get('inclureInactifs') === '1';
    const aRanger = searchParams.get('aRanger') === '1';

    const where: Prisma.TarifWhereInput = {};
    if (!inclureInactifs) where.actif = true;
    if (aRanger) where.creeAuComptoir = true;

    const tarifs = await prisma.tarif.findMany({
      where,
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        categorie: true,
        prixCentimes: true,
        poste: true,
        actif: true,
        creeAuComptoir: true,
      },
    });

    return NextResponse.json(tarifs);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/tarifs');
    return NextResponse.json(corps, { status: statut });
  }
}

/**
 * HYPOTHÈSE À VALIDER : réservé au gérant (prix libre = H4 de l'audit sécurité)
 * tant que le gérant n'a pas confirmé qu'un vendeur peut créer seul un tarif.
 *
 * Produit inconnu créé au comptoir. Pas de code demandé : le vendeur a un
 * client en face, il ne va pas appeler le manager pour vendre une brioche.
 * En échange, la ligne arrive marquée « à ranger » dans l'écran des tarifs —
 * sans quoi la liste se remplirait de « Croissan », « croissant choco » et
 * « CROISSANT AMANDE » qui vivraient côte à côte.
 */
export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'créer un tarif');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();
    const nom = texte(corps.nom, 120);
    const prixCentimes = Math.max(0, Math.round(Number(corps.prixCentimes) || 0));

    if (!nom) return NextResponse.json({ error: 'Le libellé est obligatoire.' }, { status: 400 });
    if (prixCentimes <= 0) {
      return NextResponse.json({ error: 'Indiquez un prix.' }, { status: 400 });
    }

    const existant = await prisma.tarif.findFirst({
      where: { nom: { equals: nom, mode: 'insensitive' } },
    });
    if (existant) {
      // Le libellé existe déjà : on renvoie l'existant plutôt que d'en créer
      // un jumeau. Le prix retenu reste celui de la grille.
      return NextResponse.json(existant);
    }

    const tarif = await prisma.tarif.create({
      data: {
        nom,
        categorie: texte(corps.categorie, 60) || 'À ranger',
        prixCentimes,
        poste: estPoste(corps.poste) ? corps.poste : null,
        creeAuComptoir: true,
        ordre: 9000,
      },
    });

    return NextResponse.json(tarif, { status: 201 });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'POST /api/tarifs');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Correction d'un prix, d'un libellé ou d'un rangement. Réservé au manager. */
export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'gerant', 'modifier un tarif');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();

    const id = Number(corps.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Tarif invalide' }, { status: 400 });
    }

    const donnees: Prisma.TarifUpdateInput = {};
    if (typeof corps.nom === 'string' && texte(corps.nom, 120)) donnees.nom = texte(corps.nom, 120);
    if (Number.isFinite(Number(corps.prixCentimes))) {
      donnees.prixCentimes = Math.max(0, Math.round(Number(corps.prixCentimes)));
    }
    if (typeof corps.categorie === 'string') donnees.categorie = texte(corps.categorie, 60);
    if (typeof corps.poste === 'string' || corps.poste === null) {
      donnees.poste = estPoste(corps.poste) ? corps.poste : null;
    }
    if (typeof corps.actif === 'boolean') donnees.actif = corps.actif;
    if (corps.range === true) donnees.creeAuComptoir = false;

    const tarif = await prisma.tarif.update({ where: { id }, data: donnees });
    return NextResponse.json(tarif);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PATCH /api/tarifs');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
