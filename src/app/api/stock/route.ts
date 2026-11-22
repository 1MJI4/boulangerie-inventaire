// src/app/api/stock/route.ts
//
// Stock de la feuille de commande (22/11/2026) : GET = la liste + les quantités
// comptées d'une journée ; PUT = enregistre les quantités restantes.
// Une case vidée efface le comptage (retour à « pas encore compté »).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { signaler } from '@/domaine/messages';
import { validerQuantiteStock } from '@/domaine/stock';
import { dateDuJour } from '@/lib/dateProduction';

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIGNES_MAX = 500;
const versDatePg = (d: string) => new Date(`${d}T12:00:00.000Z`);

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter le stock');
  if (!garde.ok) return garde.reponse;
  try {
    const demandee = new URL(request.url).searchParams.get('date');
    const date = demandee && FORMAT_DATE.test(demandee) ? demandee : dateDuJour();
    const articles = await prisma.articleStock.findMany({
      where: { actif: true },
      orderBy: { ordre: 'asc' },
      select: { id: true, nom: true, categorie: true, ordre: true, comptages: { where: { journee: versDatePg(date) }, select: { quantite: true } }, photos: { orderBy: { id: 'asc' }, select: { id: true } } },
    });
    return NextResponse.json({
      date,
      articles: articles.map((a) => ({ id: a.id, nom: a.nom, categorie: a.categorie, ordre: a.ordre, quantite: a.comptages[0]?.quantite ?? null, photos: a.photos.map((p) => p.id) })),
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/stock');
    return NextResponse.json(corps, { status: statut });
  }
}

export async function PUT(request: Request) {
  const garde = exigerRole(request, 'tablette', 'compter le stock');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json().catch(() => null);
    const date: unknown = corps?.date;
    const lignes: unknown = corps?.lignes;
    if (typeof date !== 'string' || !FORMAT_DATE.test(date) || !Array.isArray(lignes) || lignes.length > LIGNES_MAX) {
      const { corps: refus, statut } = reponseEchec(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'comptage du stock' }, { champ: 'lignes' }), 'PUT /api/stock');
      return NextResponse.json(refus, { status: statut });
    }

    const prepares: { articleId: number; quantite: number | null }[] = [];
    for (const l of lignes) {
      const articleId = Number((l as { articleId?: unknown })?.articleId);
      const champ = `article:${articleId}`;
      if (!Number.isInteger(articleId) || articleId <= 0) {
        const { corps: refus, statut } = reponseEchec(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'article' }, { champ }), 'PUT /api/stock');
        return NextResponse.json(refus, { status: statut });
      }
      const q = validerQuantiteStock((l as { quantite?: unknown }).quantite, champ);
      if (!q.ok) {
        const { corps: refus, statut } = reponseEchec(q, 'PUT /api/stock');
        return NextResponse.json(refus, { status: statut });
      }
      prepares.push({ articleId, quantite: q.donnees });
    }

    const jour = versDatePg(date);
    await prisma.$transaction(
      prepares.map((p) =>
        p.quantite === null
          ? prisma.comptageStock.deleteMany({ where: { articleId: p.articleId, journee: jour } })
          : prisma.comptageStock.upsert({
              where: { articleId_journee: { articleId: p.articleId, journee: jour } },
              create: { articleId: p.articleId, journee: jour, quantite: p.quantite },
              update: { quantite: p.quantite, compteLe: new Date() },
            }),
      ),
    );
    return NextResponse.json({ ok: true, enregistres: prepares.length });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PUT /api/stock');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
