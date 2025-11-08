// app/api/inventaires/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Saisie d'inventaire (une ou plusieurs entrées) - VERSION OPTIMISÉE
export async function POST(request: Request) {
  try {
    const { inventaires } = await request.json();
    
    if (!inventaires || !Array.isArray(inventaires)) {
      return NextResponse.json({ error: 'Format invalide. Attendu: { inventaires: [...] }' }, { status: 400 });
    }

    console.log(`🚀 Début traitement optimisé de ${inventaires.length} inventaires`);
    const startTime = Date.now();

    // Étape 1: Validation rapide et préparation des données
    const validInventaires = [];
    const errors = [];
    const produitIds = new Set();

    for (const inventaire of inventaires) {
      const { produitId, quantiteRestante, quantiteProduite, quantitePrevue, dateInventaire, modeAddition } = inventaire;

      if (!produitId) {
        errors.push(`Produit ${produitId}: produitId requis`);
        continue;
      }

      const seulementPrevision = quantitePrevue !== undefined && quantitePrevue !== null && 
                                quantiteRestante === undefined && quantiteProduite === undefined;

      if (!seulementPrevision && quantiteRestante === undefined) {
        errors.push(`Produit ${produitId}: quantiteRestante requis pour un inventaire complet`);
        continue;
      }

      if (quantiteRestante < 0 || (quantiteProduite && quantiteProduite < 0) || (quantitePrevue && quantitePrevue < 0)) {
        errors.push(`Produit ${produitId}: les quantités ne peuvent pas être négatives`);
        continue;
      }

      validInventaires.push(inventaire);
      produitIds.add(parseInt(produitId));
    }

    // Étape 2: Vérification batch des produits existants
    const produitsExistants = await prisma.produit.findMany({
      where: { id: { in: Array.from(produitIds) as number[] } },
      select: { id: true, nom: true }
    });

    const produitsExistantsMap = new Map(produitsExistants.map((p: any) => [p.id, p]));
    
    // Filtrer les inventaires avec des produits inexistants
    const inventairesValides = validInventaires.filter(inv => {
      if (!produitsExistantsMap.has(parseInt(inv.produitId))) {
        errors.push(`Produit avec l'ID ${inv.produitId} introuvable`);
        return false;
      }
      return true;
    });

    console.log(`✅ Validation terminée: ${inventairesValides.length} inventaires valides, ${errors.length} erreurs`);

    if (inventairesValides.length === 0) {
      return NextResponse.json({
        message: 'Aucun inventaire valide à traiter',
        success: 0,
        errors,
      });
    }

    // Étape 3: Pour les modes addition, récupération batch des inventaires existants
    const inventairesAvecAddition = inventairesValides.filter(inv => inv.modeAddition && inv.quantiteProduite);
    let inventairesExistants = new Map();

    if (inventairesAvecAddition.length > 0) {
      const clefs = inventairesAvecAddition.map(inv => ({
        produitId: parseInt(inv.produitId),
        dateInventaire: inv.dateInventaire ? new Date(inv.dateInventaire) : new Date(),
      }));

      const existants = await prisma.inventaire.findMany({
        where: {
          OR: clefs.map(clef => ({
            produitId: clef.produitId,
            dateInventaire: clef.dateInventaire,
          }))
        }
      });

      existants.forEach((inv: any) => {
        const key = `${inv.produitId}_${inv.dateInventaire.toISOString().split('T')[0]}`;
        inventairesExistants.set(key, inv);
      });
    }

    // Étape 4: Transaction optimisée avec opérations batch et timeout étendu
    const result = await prisma.$transaction(async (tx: any) => {
      const operations = [];
      const results = [];

      for (const inventaire of inventairesValides) {
        const { produitId, quantiteRestante, quantiteProduite, quantitePrevue, dateInventaire, modeAddition } = inventaire;
        
        const dateInv = dateInventaire ? new Date(dateInventaire) : new Date();
        const dateKey = dateInv.toISOString().split('T')[0];
        
        // Calcul de la quantité produite finale en mode addition
        let quantiteProduiteFinale = quantiteProduite;
        if (modeAddition && quantiteProduite !== undefined && quantiteProduite !== null) {
          const existantKey = `${produitId}_${dateKey}`;
          const existant = inventairesExistants.get(existantKey);
          if (existant && existant.quantiteProduite) {
            quantiteProduiteFinale = existant.quantiteProduite + parseInt(quantiteProduite);
          }
        }

        // Préparer les données
        const dataInventaire: any = {
          produitId: parseInt(produitId),
          dateInventaire: dateInv,
        };

        const seulementPrevision = quantitePrevue !== undefined && quantitePrevue !== null && 
                                  quantiteRestante === undefined && quantiteProduite === undefined;

        if (quantiteRestante !== undefined) {
          dataInventaire.quantiteRestante = parseInt(quantiteRestante);
        } else if (seulementPrevision) {
          dataInventaire.quantiteRestante = 0;
        }

        if (quantiteProduiteFinale !== undefined && quantiteProduiteFinale !== null) {
          dataInventaire.quantiteProduite = parseInt(quantiteProduiteFinale);
        }

        if (quantitePrevue !== undefined && quantitePrevue !== null) {
          dataInventaire.quantitePrevue = parseInt(quantitePrevue);
        }

        // Ajout à la liste des opérations
        operations.push({
          where: {
            produitId_dateInventaire: {
              produitId: parseInt(produitId),
              dateInventaire: dateInv,
            }
          },
          update: {
            ...(quantiteRestante !== undefined && { quantiteRestante: parseInt(quantiteRestante) }),
            ...(quantiteProduiteFinale !== undefined && quantiteProduiteFinale !== null && { quantiteProduite: parseInt(quantiteProduiteFinale) }),
            ...(quantitePrevue !== undefined && quantitePrevue !== null && { quantitePrevue: parseInt(quantitePrevue) }),
          },
          create: dataInventaire,
          include: {
            produit: {
              select: { nom: true }
            }
          }
        });
      }

      // Exécution en séquentiel avec des batches plus petits pour éviter le timeout
      const batchSize = 20; // Réduit pour éviter les timeouts
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        
        // Exécuter chaque upsert individuellement dans la transaction
        for (const operation of batch) {
          const batchResult = await tx.inventaire.upsert(operation);
          results.push(batchResult);
        }
        
        console.log(`📦 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(operations.length/batchSize)} terminé (${batch.length} items)`);
      }

      return results;
    }, {
      maxWait: 10000, // Attendre maximum 10 secondes pour obtenir une connexion DB
      timeout: 15000  // Timeout de transaction étendu à 15 secondes
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`🎉 Traitement terminé en ${duration}ms pour ${result.length} inventaires`);

    return NextResponse.json({
      message: `${result.length} inventaire(s) traité(s) en ${duration}ms`,
      success: result.length,
      errors: errors.length > 0 ? errors : undefined,
      data: result,
      performance: {
        duration: `${duration}ms`,
        recordsPerSecond: Math.round((result.length / duration) * 1000),
        batchSize: 50
      }
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
          select: { id: true, nom: true, ordre: true }
        }
      },
      orderBy: [
        { dateInventaire: 'desc' },
        { produit: { ordre: 'asc' } }
      ],
      take: limitParam ? parseInt(limitParam) : undefined,
    });

    return NextResponse.json(inventaires);

  } catch (error) {
    console.error('Erreur lors de la récupération des inventaires:', error);
    return NextResponse.json({ error: 'Échec de la récupération des inventaires.' }, { status: 500 });
  }
}
