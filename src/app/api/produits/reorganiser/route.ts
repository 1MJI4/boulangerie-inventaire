// app/api/produits/reorganiser/route.ts
// API optimisée pour la réorganisation en masse des produits

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    const { ordreNouveau, codeSecurite } = await request.json();

    // Vérification du code de sécurité
    if (codeSecurite !== '5551') {
      return NextResponse.json({ error: 'Code de sécurité incorrect' }, { status: 403 });
    }

    if (!ordreNouveau || !Array.isArray(ordreNouveau)) {
      return NextResponse.json({ 
        error: 'Format invalide. Attendu: { ordreNouveau: [produitId1, produitId2, ...], codeSecurite: "5551" }' 
      }, { status: 400 });
    }

    console.log(`🔄 Début réorganisation de ${ordreNouveau.length} produits`);
    const startTime = Date.now();

    // Vérifier que tous les produits existent
    const produitIds = ordreNouveau.map(id => parseInt(id));
    const produitsExistants = await prisma.produit.findMany({
      where: { id: { in: produitIds } },
      select: { id: true, nom: true, ordre: true }
    });

    if (produitsExistants.length !== ordreNouveau.length) {
      const existantIds = produitsExistants.map((p: any) => p.id);
      const manquants = produitIds.filter(id => !existantIds.includes(id));
      return NextResponse.json({ 
        error: `Produits introuvables: ${manquants.join(', ')}` 
      }, { status: 404 });
    }

    // Transaction optimisée pour mise à jour en masse
    const result = await prisma.$transaction(async (tx: any) => {
      const updates = [];
      
      // Créer toutes les opérations de mise à jour
      for (let i = 0; i < ordreNouveau.length; i++) {
        const produitId = parseInt(ordreNouveau[i]);
        const nouvelOrdre = i + 1; // Ordre commence à 1
        
        updates.push(
          tx.produit.update({
            where: { id: produitId },
            data: { ordre: nouvelOrdre },
            select: { id: true, nom: true, ordre: true }
          })
        );
      }

      // Exécution en parallèle avec limitation
      const batchSize = 25;
      const results = [];
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
        console.log(`📦 Batch réorganisation ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)} terminé`);
      }

      return results;
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Réorganisation terminée en ${duration}ms pour ${result.length} produits`);

    return NextResponse.json({
      message: `Réorganisation de ${result.length} produits réussie en ${duration}ms`,
      success: result.length,
      data: result.sort((a: any, b: any) => a.ordre - b.ordre), // Retourner dans le bon ordre
      performance: {
        duration: `${duration}ms`,
        recordsPerSecond: Math.round((result.length / duration) * 1000)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la réorganisation:', error);
    return NextResponse.json({ error: 'Échec de la réorganisation des produits.' }, { status: 500 });
  }
}
