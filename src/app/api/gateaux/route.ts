// src/app/api/gateaux/route.ts
//
// Parfums, garnitures et décorations proposés au vendeur pour décrire un
// gâteau ou un plateau (précision imprimée sur le bon). Des MOTS, jamais des
// prix : depuis le lot 2, tout prix, minimum ou format vient du catalogue de
// commande (LOI 1, 6, 7). Les anciennes familles à prix par personne, paliers,
// formats fixes et réglages de coupes ne sont plus ni lus ni écrits.
// Droits : src/lib/auth/matrice.ts (lecture : toute tablette ; écriture : gérant).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reponseEchec, traiterErreur } from '@/lib/erreurBase';
import { exigerRole } from '@/lib/auth/garde';
import { signaler } from '@/domaine/messages';
import type { GenreOption } from '@/lib/gateaux';

function texte(valeur: unknown, max = 80): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

function genreDe(type: unknown): GenreOption | null {
  return type === 'parfum' || type === 'garniture' || type === 'decoration' ? type : null;
}

function refus(echec: Parameters<typeof reponseEchec>[0], route: string) {
  const { corps, statut } = reponseEchec(echec, route);
  return NextResponse.json(corps, { status: statut });
}

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter les gâteaux');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);
    const inclureInactifs = searchParams.get('inclureInactifs') === '1';
    const options = await prisma.optionGateau.findMany({
      where: inclureInactifs ? {} : { actif: true },
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      select: { id: true, genre: true, nom: true, actif: true },
    });
    const de = (genre: GenreOption) =>
      options.filter((o) => o.genre === genre).map((o) => ({ id: o.id, nom: o.nom, actif: o.actif }));
    return NextResponse.json({ parfums: de('parfum'), garnitures: de('garniture'), decorations: de('decoration') });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/gateaux');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Ajout d'un parfum, d'une garniture ou d'une décoration (un mot, sans prix). */
export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'ajouter une option de gâteau');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();
    const genre = genreDe(corps.type);
    const nom = texte(corps.nom, 60);
    if (!genre) {
      return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'type d’option' }, { champ: 'type' }), 'POST /api/gateaux');
    }
    if (!nom) {
      return refus(signaler('ERR_CHAMP_OBLIGATOIRE', { champLibelle: 'nom' }, { champ: 'nom' }), 'POST /api/gateaux');
    }
    const option = await prisma.optionGateau.upsert({
      where: { genre_nom: { genre, nom } },
      create: { genre, nom, ordre: 900 },
      update: { actif: true },
      select: { id: true, genre: true, nom: true, actif: true },
    });
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'POST /api/gateaux');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Retirer ou remettre une option. */
export async function PATCH(request: Request) {
  const garde = exigerRole(request, 'gerant', 'modifier les gâteaux');
  if (!garde.ok) return garde.reponse;
  try {
    const corps = await request.json();
    const id = Number(corps.id);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof corps.actif !== 'boolean') {
      return refus(signaler('ERR_SAISIE_INVALIDE', { champLibelle: 'option' }, { champ: 'id' }), 'PATCH /api/gateaux');
    }
    const option = await prisma.optionGateau.update({
      where: { id },
      data: { actif: corps.actif },
      select: { id: true, genre: true, nom: true, actif: true },
    });
    return NextResponse.json(option);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'PATCH /api/gateaux');
    return NextResponse.json(corps, { status: statut });
  }
}

export const dynamic = 'force-dynamic';
