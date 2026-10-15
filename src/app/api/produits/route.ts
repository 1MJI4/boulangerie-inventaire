// src/app/api/produits/route.ts

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { traiterErreur } from '@/lib/erreurBase';
import { estPoste } from '@/lib/postes';
import { exigerRole } from '@/lib/auth/garde';

// Droits : voir src/lib/auth/matrice.ts (lecture : toute tablette installée ; écriture : gérant).

export async function GET(request: Request) {
  const garde = exigerRole(request, 'tablette', 'consulter le catalogue');
  if (!garde.ok) return garde.reponse;
  try {
    const { searchParams } = new URL(request.url);
    const poste = searchParams.get('poste');
    const categorie = searchParams.get('categorie');
    const inclureInactifs = searchParams.get('inclureInactifs') === '1';

    const where: Prisma.ProduitWhereInput = {};
    if (estPoste(poste)) where.poste = poste;
    if (categorie) where.categorie = categorie;
    if (!inclureInactifs) where.actif = true;

    const produits = await prisma.produit.findMany({
      where,
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      select: { id: true, nom: true, ordre: true, categorie: true, poste: true, actif: true },
    });

    return NextResponse.json(produits);
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'GET /api/produits');
    return NextResponse.json(corps, { status: statut });
  }
}

/** Ajout en masse : "Croissant, Torsade, Huit" */
export async function POST(request: Request) {
  const garde = exigerRole(request, 'gerant', 'ajouter un produit');
  if (!garde.ok) return garde.reponse;
  try {
    const { noms, categorie, poste } = await request.json();

    if (typeof noms !== 'string') {
      return NextResponse.json({ error: 'Liste de noms invalide' }, { status: 400 });
    }

    const donnees = [...new Set(
      noms.split(',').map((n: string) => n.trim()).filter(Boolean)
    )].map((nom) => ({
      nom,
      ...(typeof categorie === 'string' && categorie ? { categorie } : {}),
      ...(estPoste(poste) ? { poste } : {}),
    }));

    if (donnees.length === 0) {
      return NextResponse.json({ error: 'Aucun nom de produit valide fourni.' }, { status: 400 });
    }

    const resultat = await prisma.produit.createMany({ data: donnees, skipDuplicates: true });
    return NextResponse.json({ message: `${resultat.count} produit(s) ajouté(s).` });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'POST /api/produits');
    return NextResponse.json(corps, { status: statut });
  }
}

export async function PUT(request: Request) {
  const garde = exigerRole(request, 'gerant', 'modifier un produit');
  if (!garde.ok) return garde.reponse;
  try {
    const { id, nouveauNom, nouvelOrdre, categorie, poste, actif } = await request.json();

    const produitId = Number(id);
    if (!Number.isInteger(produitId)) {
      return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });
    }

    const donnees: Prisma.ProduitUpdateInput = {};

    if (typeof nouveauNom === 'string' && nouveauNom.trim()) {
      const nom = nouveauNom.trim();
      const conflit = await prisma.produit.findFirst({
        where: { nom, NOT: { id: produitId } },
        select: { id: true },
      });
      if (conflit) {
        return NextResponse.json({ error: 'Un produit porte déjà ce nom' }, { status: 400 });
      }
      donnees.nom = nom;
    }

    if (nouvelOrdre !== undefined && nouvelOrdre !== null) {
      const ordre = Number(nouvelOrdre);
      if (!Number.isInteger(ordre) || ordre < 0) {
        return NextResponse.json({ error: "L'ordre doit être un entier positif" }, { status: 400 });
      }
      donnees.ordre = ordre;
    }

    if (typeof categorie === 'string' && categorie.trim()) donnees.categorie = categorie.trim();
    if (estPoste(poste)) donnees.poste = poste;
    if (typeof actif === 'boolean') donnees.actif = actif;

    if (Object.keys(donnees).length === 0) {
      return NextResponse.json({ error: 'Aucune modification demandée' }, { status: 400 });
    }

    const produit = await prisma.produit.update({ where: { id: produitId }, data: donnees });
    return NextResponse.json({ message: 'Produit modifié', produit });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }
    const { corps, statut } = traiterErreur(error, 'PUT /api/produits');
    return NextResponse.json(corps, { status: statut });
  }
}

/**
 * Un produit qui a un historique n'est jamais supprimé : il est désactivé.
 * Supprimer effacerait des mois d'inventaire au passage.
 */
export async function DELETE(request: Request) {
  const garde = exigerRole(request, 'gerant', 'retirer un produit');
  if (!garde.ok) return garde.reponse;
  try {
    const { id, forceSuppression } = await request.json();

    const produitId = Number(id);
    if (!Number.isInteger(produitId)) {
      return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({
      where: { id: produitId },
      select: { id: true, nom: true, _count: { select: { inventaires: true } } },
    });

    if (!produit) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    const historique = produit._count.inventaires;

    if (historique > 0 && !forceSuppression) {
      await prisma.produit.update({ where: { id: produitId }, data: { actif: false } });
      return NextResponse.json({
        message: `« ${produit.nom} » a été retiré des listes de saisie. Ses ${historique} jour(s) d'historique sont conservés.`,
        desactive: true,
        historique,
      });
    }

    await prisma.$transaction([
      prisma.inventaire.deleteMany({ where: { produitId } }),
      prisma.produit.delete({ where: { id: produitId } }),
    ]);

    return NextResponse.json({
      message:
        historique > 0
          ? `« ${produit.nom} » et ${historique} jour(s) d'historique ont été supprimés.`
          : `« ${produit.nom} » a été supprimé.`,
      supprime: true,
    });
  } catch (error) {
    const { corps, statut } = traiterErreur(error, 'DELETE /api/produits');
    return NextResponse.json(corps, { status: statut });
  }
}
