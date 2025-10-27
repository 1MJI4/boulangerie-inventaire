// app/api/produits/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { noms } = await request.json(); // noms est une chaîne comme "Croissant, Pain, Tarte"

    if (!noms || typeof noms !== 'string') {
      return NextResponse.json({ error: 'Noms invalides' }, { status: 400 });
    }

    // 1. Transformer la chaîne en tableau de noms (nettoyage inclus)
    const productNames = noms
      .split(',')
      .map((name: string) => name.trim())
      .filter((name: string) => name.length > 0)
      .map((name: string) => ({ nom: name }));

    if (productNames.length === 0) {
      return NextResponse.json({ error: 'Aucun nom de produit valide fourni.' }, { status: 400 });
    }

    // 2. Création en masse avec Prisma (gestion des duplicata si un produit existe déjà)
    // Note : on utilise createMany pour l'efficacité, avec 'skipDuplicates: true'
    const result = await prisma.produit.createMany({
      data: productNames,
      skipDuplicates: true, // Ignore les produits qui ont le même nom (champ @unique)
    });

    return NextResponse.json({ message: `${result.count} produit(s) ajouté(s) ou mis à jour.` });

  } catch (error) {
    console.error('Erreur lors de l\'ajout en masse:', error);
    return NextResponse.json({ error: 'Échec de l\'ajout des produits.' }, { status: 500 });
  }
}

// OPTIONNEL : API pour lister les produits (utile pour le frontend)
export async function GET() {
  try {
    const produits = await prisma.produit.findMany({
      orderBy: [
        { ordre: 'asc' },  // D'abord par ordre
        { nom: 'asc' }     // Puis par nom si même ordre
      ]
    });
    return NextResponse.json(produits);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    return NextResponse.json({ error: 'Échec de la récupération des produits.' }, { status: 500 });
  }
}

// PUT - Modifier un produit (avec code de sécurité)
export async function PUT(request: Request) {
  try {
    const { id, nouveauNom, nouvelOrdre, codeSecurite } = await request.json();

    // Vérification du code de sécurité
    if (codeSecurite !== '5551') {
      return NextResponse.json({ error: 'Code de sécurité incorrect' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    // Vérifier que le produit existe
    const produitExiste = await prisma.produit.findUnique({
      where: { id: parseInt(id) }
    });

    if (!produitExiste) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    // Préparer les données à mettre à jour
    const updateData: any = {};

    // Si on veut changer le nom
    if (nouveauNom && typeof nouveauNom === 'string') {
      // Vérifier que le nouveau nom n'existe pas déjà (sauf pour le produit actuel)
      const nomExiste = await prisma.produit.findFirst({
        where: { 
          nom: nouveauNom.trim(),
          NOT: { id: parseInt(id) }
        }
      });

      if (nomExiste) {
        return NextResponse.json({ error: 'Un produit avec ce nom existe déjà' }, { status: 400 });
      }

      updateData.nom = nouveauNom.trim();
    }

    // Si on veut changer l'ordre
    if (nouvelOrdre !== undefined && nouvelOrdre !== null) {
      const ordre = parseInt(nouvelOrdre);
      if (isNaN(ordre) || ordre < 0) {
        return NextResponse.json({ error: 'L\'ordre doit être un nombre positif' }, { status: 400 });
      }
      updateData.ordre = ordre;
    }

    // Vérifier qu'on a au moins une donnée à mettre à jour
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à modifier' }, { status: 400 });
    }

    // Mettre à jour le produit
    const produitMisAJour = await prisma.produit.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    return NextResponse.json({ 
      message: 'Produit modifié avec succès', 
      produit: produitMisAJour 
    });

  } catch (error) {
    console.error('Erreur lors de la modification du produit:', error);
    return NextResponse.json({ error: 'Échec de la modification du produit.' }, { status: 500 });
  }
}

// DELETE - Supprimer un produit (avec code de sécurité)
export async function DELETE(request: Request) {
  try {
    const { id, codeSecurite, forceSuppression } = await request.json();

    // Vérification du code de sécurité
    if (codeSecurite !== '5551') {
      return NextResponse.json({ error: 'Code de sécurité incorrect' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID du produit requis' }, { status: 400 });
    }

    // Vérifier que le produit existe
    const produitExiste = await prisma.produit.findUnique({
      where: { id: parseInt(id) },
      include: {
        inventaires: {
          select: { id: true, dateInventaire: true }
        }
      }
    });

    if (!produitExiste) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    // Si il y a des inventaires liés
    if (produitExiste.inventaires.length > 0) {
      if (!forceSuppression) {
        return NextResponse.json({ 
          error: 'Ce produit a des inventaires associés',
          inventairesCount: produitExiste.inventaires.length,
          canForceDelete: true,
          message: 'Utilisez la suppression forcée pour supprimer le produit et tous ses inventaires.'
        }, { status: 400 });
      }

      // Suppression forcée : supprimer d'abord tous les inventaires
      await prisma.inventaire.deleteMany({
        where: { produitId: parseInt(id) }
      });
    }

    // Supprimer le produit
    await prisma.produit.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ 
      message: forceSuppression 
        ? `Produit et ${produitExiste.inventaires.length} inventaire(s) supprimé(s) avec succès`
        : 'Produit supprimé avec succès',
      deletedInventories: forceSuppression ? produitExiste.inventaires.length : 0
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    return NextResponse.json({ error: 'Échec de la suppression du produit.' }, { status: 500 });
  }
}
