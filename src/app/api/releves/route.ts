// src/app/api/releves/route.ts
//
// Historique des comptages. Sert aux statistiques et, surtout, à l'heure de
// rupture : savoir qu'un produit était à zéro dès midi vaut mieux, pour
// décider des quantités du lendemain, que de savoir qu'il en restait zéro
// le soir.

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { traiterErreur } from '@/lib/erreurBase';
import { estPoste } from '@/lib/postes';
import { exigerRole } from '@/lib/auth/garde';

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const versDatePg = (d: string) => new Date(`${d}T12:00:00.000Z`);
const lireDate = (v: string | null) => (v && FORMAT_DATE.test(v) ? v : null);

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les relevés');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);

    const journee = lireDate(searchParams.get('journee'));
    const debut = lireDate(searchParams.get('debut'));
    const fin = lireDate(searchParams.get('fin'));
    const produitId = Number(searchParams.get('produitId'));
    const poste = searchParams.get('poste');

    const where: Prisma.ReleveWhereInput = {};

    if (journee) {
      where.journee = versDatePg(journee);
    } else if (debut || fin) {
      where.journee = {
        ...(debut ? { gte: versDatePg(debut) } : {}),
        ...(fin ? { lte: versDatePg(fin) } : {}),
      };
    }

    if (Number.isInteger(produitId) && produitId > 0) where.produitId = produitId;
    if (estPoste(poste)) where.produit = { poste };

    const releves = await prisma.releve.findMany({
      where,
      orderBy: [{ journee: 'desc' }, { releveA: 'asc' }],
      take: 5000,
      select: {
        id: true,
        produitId: true,
        journee: true,
        quantiteRestante: true,
        releveA: true,
        produit: { select: { nom: true, categorie: true, poste: true } },
      },
    });

    return NextResponse.json(releves);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/releves');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
