// src/app/api/reglages/previsions/route.ts
//
// Rayons proposés sur l'écran des prévisions (22/11/2026). GET : toute tablette
// (l'écran des prévisions filtre dessus). PUT : gérant seulement. Stocké dans
// "Reglage" (clé « previsions:rayons_masques », hors du contrôle « reglement: »).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exigerRole } from '@/lib/auth/garde';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { trierCategories } from '@/lib/postes';
import { lireRayonsMasques, validerRayonsMasques } from '@/domaine/rayonsPrevisions';

const CLE = 'previsions:rayons_masques';

async function vue() {
  const [lignes, ligne] = await Promise.all([
    prisma.produit.findMany({ where: { actif: true }, distinct: ['categorie'], select: { categorie: true } }),
    prisma.reglage.findUnique({ where: { cle: CLE } }),
  ]);
  const rayons = trierCategories(lignes.map((l) => l.categorie));
  return { rayons, masques: lireRayonsMasques(ligne?.valeur).filter((m) => rayons.includes(m)) };
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les rayons des prévisions');
  if (!garde.ok) return garde.reponse;
  try {
    return NextResponse.json(await vue(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/reglages/previsions');
    return NextResponse.json(corps, { status: statut });
  }
}

export async function PUT(request: Request) {
  const garde = exigerRole(request, 'gerant', 'régler les rayons des prévisions');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = (await request.json().catch(() => null)) as { masques?: unknown } | null;
    const { rayons } = await vue();
    const r = validerRayonsMasques(corps?.masques, rayons);
    if (!r.ok) {
      const { corps: c, statut } = reponseEchec(r, 'PUT /api/reglages/previsions');
      return NextResponse.json(c, { status: statut });
    }
    const valeur = JSON.stringify(r.donnees);
    await prisma.reglage.upsert({ where: { cle: CLE }, create: { cle: CLE, valeur }, update: { valeur } });
    return NextResponse.json(await vue());
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PUT /api/reglages/previsions');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
