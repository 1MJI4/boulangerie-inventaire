'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface Inventaire {
  id: number;
  dateInventaire: string;
  quantiteRestante: number;
  quantiteProduite: number | null;
  produit: Produit;
}

export default function DashboardInventaires() {
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [filtreDate, setFiltreDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalProduits: 0,
    totalProduit: 0,
    totalVendu: 0,
    tauxVente: 0
  });

  useEffect(() => {
    loadInventaires();
  }, [filtreDate]);

  const loadInventaires = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtreDate) {
        params.append('date', filtreDate);
      }
      
      const response = await fetch(`/api/inventaires?${params}`);
      const data = await response.json();
      setInventaires(data);
      
      // Calculer les statistiques
      calculerStats(data);
    } catch (error) {
      console.error('Erreur lors du chargement des inventaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculerStats = (inventaires: Inventaire[]) => {
    const stats = {
      totalProduits: inventaires.length,
      totalProduit: inventaires.reduce((sum, inv) => sum + (inv.quantiteProduite || 0), 0),
      totalVendu: inventaires.reduce((sum, inv) => {
        const produit = inv.quantiteProduite || 0;
        const restant = inv.quantiteRestante;
        return sum + Math.max(0, produit - restant);
      }, 0),
      tauxVente: inventaires.length > 0 ? Math.round(
        (inventaires.reduce((sum, inv) => {
          const produit = inv.quantiteProduite || 0;
          const restant = inv.quantiteRestante;
          const vendu = Math.max(0, produit - restant);
          return sum + (produit > 0 ? (vendu / produit) * 100 : 0);
        }, 0) / inventaires.filter(inv => (inv.quantiteProduite || 0) > 0).length)
      ) : 0
    };
    setStats(stats);
  };

  const loadInventairesRecents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventaires?limit=50');
      const data = await response.json();
      setInventaires(data);
      setFiltreDate(''); // Effacer le filtre de date
    } catch (error) {
      console.error('Erreur lors du chargement des inventaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:py-8 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Dashboard Inventaires */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard Inventaires</h1>
              <p className="text-gray-600">Analyse des performances de vente</p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/planification-demain"
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                🌙 Planification
              </Link>
              <Link 
                href="/"
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                ← Retour
              </Link>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Filtres</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="flex-1 sm:flex-none">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date spécifique
              </label>
              <input
                type="date"
                value={filtreDate}
                onChange={(e) => setFiltreDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900"
                title="Sélectionner une date"
                placeholder="Sélectionner une date"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={loadInventaires}
                className="w-full sm:w-auto bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 font-medium text-base transition-colors"
              >
                Filtrer
              </button>
              <button
                onClick={loadInventairesRecents}
                className="w-full sm:w-auto bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 font-medium text-base transition-colors"
              >
                Voir tous les récents
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques - Mobile responsive */}
        {filtreDate && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm sm:text-base font-medium text-gray-700 mb-1 sm:mb-2">Produits inventoriés</h3>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalProduits}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm sm:text-base font-medium text-gray-700 mb-1 sm:mb-2">Total produit</h3>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.totalProduit}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm sm:text-base font-medium text-gray-700 mb-1 sm:mb-2">Total vendu</h3>
              <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.totalVendu}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-sm sm:text-base font-medium text-gray-700 mb-1 sm:mb-2">Taux de vente</h3>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.tauxVente}%</p>
            </div>
          </div>
        )}

        {/* Liste des inventaires */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {filtreDate ? `Inventaires du ${formatDate(filtreDate)}` : 'Inventaires récents'}
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : inventaires.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">
                {filtreDate ? 'Aucun inventaire trouvé pour cette date' : 'Aucun inventaire trouvé'}
              </p>
            </div>
          ) : (
            <>
              {/* Version Mobile : Cards */}
              <div className="block sm:hidden p-4 space-y-4">
                {inventaires.map((inventaire) => {
                  const produit = inventaire.quantiteProduite || 0;
                  const restant = inventaire.quantiteRestante;
                  const vendu = Math.max(0, produit - restant);
                  const tauxVente = produit > 0 ? Math.round((vendu / produit) * 100) : 0;
                  
                  return (
                    <div key={inventaire.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900 text-base">
                          {inventaire.produit.nom}
                        </h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          tauxVente >= 80 ? 'bg-green-100 text-green-800' :
                          tauxVente >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {tauxVente}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><span className="font-medium">Date:</span> {new Date(inventaire.dateInventaire).toLocaleDateString('fr-FR')}</p>
                        <div className="flex justify-between">
                          <p><span className="font-medium">Produit:</span> <span className="text-green-600">{produit}</span></p>
                          <p><span className="font-medium">Vendu:</span> <span className="text-blue-600">{vendu}</span></p>
                          <p><span className="font-medium">Restant:</span> <span className="text-orange-600">{restant}</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Version Desktop : Tableau */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produit
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produit
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendu
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Restant
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Taux Vente
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventaires.map((inventaire) => {
                      const produit = inventaire.quantiteProduite || 0;
                      const restant = inventaire.quantiteRestante;
                      const vendu = Math.max(0, produit - restant);
                      const tauxVente = produit > 0 ? Math.round((vendu / produit) * 100) : 0;
                      
                      return (
                        <tr key={inventaire.id} className="hover:bg-gray-50">
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(inventaire.dateInventaire).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {inventaire.produit.nom}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                              {produit}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {vendu}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                              {restant}
                            </span>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              tauxVente >= 80 ? 'bg-green-100 text-green-800' :
                              tauxVente >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {tauxVente}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Liens de navigation */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <a
            href="/inventaire"
            className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium text-base transition-colors"
          >
            ➕ Nouvelle saisie d'inventaire
          </a>
          <a
            href="/test-api"
            className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium text-base transition-colors"
          >
            🛠️ Gérer les produits
          </a>
        </div>
      </div>
    </div>
  );
}
