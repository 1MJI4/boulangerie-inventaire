'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface PlanificationItem {
  produitId: number;
  produitNom: string;
  quantitePrevue: number;
}

export default function PlanificationDemain() {
  const [planification, setPlanification] = useState<PlanificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chargerPlanification();
  }, []);

  const chargerPlanification = async () => {
    try {
      setLoading(true);
      
      // Date de demain
      const demain = new Date();
      demain.setDate(demain.getDate() + 1);
      const dateDemain = demain.toISOString().split('T')[0];

      console.log('🔍 Recherche des prévisions pour:', dateDemain);

      // Charger les inventaires de demain qui ont une quantitePrevue
      const response = await fetch(`/api/inventaires?date=${dateDemain}`);
      const inventaires = await response.json();

      console.log('📦 Inventaires trouvés:', inventaires);
      console.log('📊 Nombre d\'inventaires:', inventaires.length);

      // Charger tous les produits pour les noms
      const produitsResponse = await fetch('/api/produits');
      const produits: Produit[] = await produitsResponse.json();

      console.log('🛍️ Produits disponibles:', produits);

      // Filtrer seulement ceux qui ont une quantitePrevue > 0
      const avecPrevisions = inventaires.filter((inv: any) => {
        console.log(`🔎 Produit ${inv.produitId}: quantitePrevue = ${inv.quantitePrevue}`);
        return inv.quantitePrevue && inv.quantitePrevue > 0;
      });

      console.log('✅ Inventaires avec prévisions:', avecPrevisions);

      const planificationData = avecPrevisions.map((inv: any) => {
        const produit = produits.find(p => p.id === inv.produitId);
        return {
          produitId: inv.produitId,
          produitNom: produit?.nom || 'Produit inconnu',
          quantitePrevue: inv.quantitePrevue
        };
      });

      console.log('🎯 Planification finale:', planificationData);
      setPlanification(planificationData);
    } catch (error) {
      console.error('❌ Erreur lors du chargement de la planification:', error);
    } finally {
      setLoading(false);
    }
  };

  const dateDemain = () => {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    return demain.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                📋 Planning de Production
              </h1>
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-lg mb-2">
                <p className="text-lg font-semibold text-gray-800">
                  🕐 Aujourd'hui: {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-lg font-semibold text-blue-700">
                  🏭 À produire pour: {dateDemain()}
                </p>
              </div>
              <p className="text-sm text-blue-600">
                📋 Liste des productions planifiées pour cette nuit
              </p>
            </div>
            <Link 
              href="/"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              ← Retour
            </Link>
          </div>
        </div>

        {/* Liste de planification */}
        {planification.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Aucune production planifiée pour demain
            </h2>
            <p className="text-gray-600 mb-4">
              Le manager n'a pas encore défini les quantités à produire pour {dateDemain()}.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                💡 <strong>Pour planifier la production :</strong><br/>
                Le manager doit aller sur "Saisie Prévue" et définir les quantités à produire pour demain.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link 
                href="/saisie-prevue"
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors duration-200 font-medium"
              >
                📋 Définir la planification (Manager)
              </Link>
              <Link 
                href="/dashboard"
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors duration-200 font-medium"
              >
                📊 Voir le dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Version Mobile */}
            <div className="block sm:hidden">
              <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-4">
                <h2 className="text-lg font-semibold">À Produire Cette Nuit</h2>
                <p className="text-purple-100 text-sm">{planification.length} produit(s) planifié(s)</p>
              </div>
              <div className="divide-y divide-gray-200">
                {planification.map((item) => (
                  <div key={item.produitId} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-800 text-lg">
                          {item.produitNom}
                        </h3>
                        <p className="text-gray-600 text-sm">Quantité à produire</p>
                      </div>
                      <div className="text-right">
                        <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-bold text-lg">
                          {item.quantitePrevue}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Version Desktop */}
            <div className="hidden sm:block">
              <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-6">
                <h2 className="text-xl font-semibold mb-2">Production Planifiée pour la Nuit</h2>
                <p className="text-purple-100">{planification.length} produit(s) à préparer</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produit
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantité à Produire
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {planification.map((item) => (
                      <tr key={item.produitId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.produitNom}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex px-4 py-2 rounded-full text-lg font-bold bg-purple-100 text-purple-800">
                            {item.quantitePrevue}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm text-gray-500">
                            {item.produitNom.toLowerCase().includes('croissant') || 
                             item.produitNom.toLowerCase().includes('pain') ||
                             item.produitNom.toLowerCase().includes('brioche') ? 
                             '🥐 Viennoiserie' : '🍰 Pâtisserie'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row gap-3 justify-between items-center">
              <p className="text-sm text-gray-600">
                💡 Cette liste est mise à jour automatiquement selon les prévisions définies
              </p>
              <div className="flex gap-2">
                <Link 
                  href="/saisie-prevue"
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm"
                >
                  Modifier prévisions
                </Link>
                <button 
                  onClick={chargerPlanification}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm"
                >
                  🔄 Actualiser
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
