// app/api/inventaires/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Saisie d'inventaire (une ou plusieurs entrées)
export async function POST(request: Request) {
  try {
    const { inventaires } = await request.json();
    
    // inventaires est un tableau d'objets comme :
    // [{ produitId: 1, quantiteRestante: 5, quantiteProduite: 20, dateInventaire?: "2025-10-26" }]
    
    if (!inventaires || !Array.isArray(inventaires)) {
      return NextResponse.json({ error: 'Format invalide. Attendu: { inventaires: [...] }' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const inventaire of inventaires) {
      try {
        const { produitId, quantiteRestante, quantiteProduite, quantitePrevue, dateInventaire, modeAddition } = inventaire;

        // Validations
        if (!produitId || quantiteRestante === undefined) {
          errors.push(`Produit ${produitId}: produitId et quantiteRestante requis`);
          continue;
        }

        if (quantiteRestante < 0 || (quantiteProduite && quantiteProduite < 0) || (quantitePrevue && quantitePrevue < 0)) {
          errors.push(`Produit ${produitId}: les quantités ne peuvent pas être négatives`);
          continue;
        }

        // Vérifier que le produit existe
        const produitExiste = await prisma.produit.findUnique({
          where: { id: parseInt(produitId) }
        });

        if (!produitExiste) {
          errors.push(`Produit avec l'ID ${produitId} introuvable`);
          continue;
        }

        // Si mode addition et qu'on a une quantité produite, on doit d'abord récupérer l'existant
        let quantiteProduiteFinale = quantiteProduite;
        if (modeAddition && quantiteProduite !== undefined && quantiteProduite !== null) {
          const inventaireExistant = await prisma.inventaire.findUnique({
            where: {
              produitId_dateInventaire: {
                produitId: parseInt(produitId),
                dateInventaire: dateInventaire ? new Date(dateInventaire) : new Date(),
              }
            }
          });
          
          if (inventaireExistant && inventaireExistant.quantiteProduite) {
            quantiteProduiteFinale = inventaireExistant.quantiteProduite + parseInt(quantiteProduite);
          }
        }

        // Préparer les données d'inventaire
        const dataInventaire: any = {
          produitId: parseInt(produitId),
          quantiteRestante: parseInt(quantiteRestante),
        };

        if (quantiteProduiteFinale !== undefined && quantiteProduiteFinale !== null) {
          dataInventaire.quantiteProduite = parseInt(quantiteProduiteFinale);
        }

        if (quantitePrevue !== undefined && quantitePrevue !== null) {
          dataInventaire.quantitePrevue = parseInt(quantitePrevue);
        }

        if (dateInventaire) {
          dataInventaire.dateInventaire = new Date(dateInventaire);
        }

        // Upsert : créer ou mettre à jour si existe déjà pour cette date
        const result = await prisma.inventaire.upsert({
          where: {
            produitId_dateInventaire: {
              produitId: parseInt(produitId),
              dateInventaire: dateInventaire ? new Date(dateInventaire) : new Date(),
            }
          },
          update: {
            quantiteRestante: parseInt(quantiteRestante),
            quantiteProduite: quantiteProduiteFinale ? parseInt(quantiteProduiteFinale) : undefined,
            quantitePrevue: quantitePrevue ? parseInt(quantitePrevue) : undefined,
          },
          create: dataInventaire,
          include: {
            produit: {
              select: { nom: true }
            }
          }
        });

        results.push(result);
      } catch (itemError) {
        console.error(`Erreur pour le produit ${inventaire.produitId}:`, itemError);
        errors.push(`Produit ${inventaire.produitId}: erreur lors de la sauvegarde`);
      }
    }

    return NextResponse.json({
      message: `${results.length} inventaire(s) traité(s)`,
      success: results.length,
      errors: errors.length > 0 ? errors : undefined,
      data: results
    });

  } catch (error) {
    console.error('Erreur lors de la saisie d\'inventaire:', error);
    return NextResponse.json({ error: 'Échec de la saisie d\'inventaire.' }, { status: 500 });
  }
}

// GET - Récupérer les inventaires avec filtres
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const produitIdParam = searchParams.get('produitId');
    const limitParam = searchParams.get('limit');

    const where: any = {};

    // Filtre par date (format: YYYY-MM-DD)
    if (dateParam) {
      const date = new Date(dateParam);
      where.dateInventaire = date;
    }

    // Filtre par produit
    if (produitIdParam) {
      where.produitId = parseInt(produitIdParam);
    }

    const inventaires = await prisma.inventaire.findMany({
      where,
      include: {
        produit: {
          select: { id: true, nom: true }
        }
      },
      orderBy: [
        { dateInventaire: 'desc' },
        { produit: { nom: 'asc' } }
      ],
      take: limitParam ? parseInt(limitParam) : undefined,
    });

    return NextResponse.json(inventaires);

  } catch (error) {
    console.error('Erreur lors de la récupération des inventaires:', error);
    return NextResponse.json({ error: 'Échec de la récupération des inventaires.' }, { status: 500 });
  }
}
