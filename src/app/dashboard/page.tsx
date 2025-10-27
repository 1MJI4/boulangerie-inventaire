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
  quantitePrevue: number | null;
  produit: Produit;
}

interface DateInventaire {
  date: string;
  totalProduits: number;
  totalProduit: number;
  totalVendu: number;
  tauxVente: number;
}

export default function DashboardInventaires() {
  const [datesInventaires, setDatesInventaires] = useState<DateInventaire[]>([]);
  const [inventairesDetail, setInventairesDetail] = useState<Inventaire[]>([]);
  const [modalOuverte, setModalOuverte] = useState(false);
  const [dateSelectionnee, setDateSelectionnee] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadDatesInventaires();
  }, []);

  const loadDatesInventaires = async () => {
    setLoading(true);
    try {
      // Charger tous les inventaires des 30 derniers jours
      const response = await fetch('/api/inventaires');
      const data = await response.json();
      
      // Grouper par date et calculer les stats
      const groupesParDate = data.reduce((acc: any, inv: Inventaire) => {
        const date = inv.dateInventaire;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(inv);
        return acc;
      }, {});

      const datesAvecStats = Object.keys(groupesParDate)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, 10) // Dernières 10 dates
        .map(date => {
          const inventaires = groupesParDate[date];
          return calculerStatsDate(date, inventaires);
        });

      setDatesInventaires(datesAvecStats);
    } catch (error) {
      console.error('Erreur lors du chargement des dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculerStatsDate = (date: string, inventaires: Inventaire[]): DateInventaire => {
    const totalProduit = inventaires.reduce((sum, inv) => sum + (inv.quantiteProduite || 0), 0);
    const totalVendu = inventaires.reduce((sum, inv) => {
      const produit = inv.quantiteProduite || 0;
      const restant = inv.quantiteRestante;
      return sum + Math.max(0, produit - restant);
    }, 0);
    
    const tauxVente = totalProduit > 0 ? Math.round((totalVendu / totalProduit) * 100) : 0;

    return {
      date,
      totalProduits: inventaires.length,
      totalProduit,
      totalVendu,
      tauxVente
    };
  };

  const ouvrirModal = async (date: string) => {
    setDateSelectionnee(date);
    setModalOuverte(true);
    setLoadingDetail(true);
    
    try {
      const response = await fetch(`/api/inventaires?date=${date}`);
      const data = await response.json();
      setInventairesDetail(data);
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fermerModal = () => {
    setModalOuverte(false);
    setDateSelectionnee('');
    setInventairesDetail([]);
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
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard Inventaires</h1>
              <p className="text-gray-600">Aperçu des performances par date</p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/historique-previsions"
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📊 Historique
              </Link>
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

        {/* Liste des dates d'inventaire */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Inventaires récents</h2>
            <p className="text-sm text-gray-600 mt-1">Cliquez sur une date pour voir les détails</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : datesInventaires.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Aucun inventaire trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {datesInventaires.map((dateInv) => (
                <button
                  key={dateInv.date}
                  onClick={() => ouvrirModal(dateInv.date)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {formatDate(dateInv.date)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {dateInv.totalProduits} produit(s) inventorié(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-100 rounded-full"></span>
                        <span className="text-gray-600">Produit: <span className="font-medium text-green-600">{dateInv.totalProduit}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-100 rounded-full"></span>
                        <span className="text-gray-600">Vendu: <span className="font-medium text-blue-600">{dateInv.totalVendu}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          dateInv.tauxVente >= 80 ? 'bg-green-500' :
                          dateInv.tauxVente >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></span>
                        <span className="text-gray-600">Taux: <span className="font-medium">{dateInv.tauxVente}%</span></span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liens de navigation */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/inventaire"
            className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium transition-colors"
          >
            ➕ Nouvelle saisie d'inventaire
          </Link>
          <Link
            href="/test-api"
            className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium transition-colors"
          >
            🛠️ Gérer les produits
          </Link>
        </div>
      </div>

      {/* Modal de détails */}
      {modalOuverte && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Détails du {formatDate(dateSelectionnee)}
              </h3>
              <button
                onClick={fermerModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingDetail ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Chargement des détails...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {inventairesDetail.map((inventaire) => {
                    const produit = inventaire.quantiteProduite || 0;
                    const restant = inventaire.quantiteRestante;
                    const vendu = Math.max(0, produit - restant);
                    const tauxVente = produit > 0 ? Math.round((vendu / produit) * 100) : 0;
                    
                    return (
                      <div key={inventaire.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900 text-lg">
                            {inventaire.produit.nom}
                          </h4>
                          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                            tauxVente >= 80 ? 'bg-green-100 text-green-800' :
                            tauxVente >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {tauxVente}% vendu
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="bg-green-100 p-3 rounded">
                            <p className="text-sm text-gray-600">Produit</p>
                            <p className="text-xl font-bold text-green-600">{produit}</p>
                          </div>
                          <div className="bg-blue-100 p-3 rounded">
                            <p className="text-sm text-gray-600">Vendu</p>
                            <p className="text-xl font-bold text-blue-600">{vendu}</p>
                          </div>
                          <div className="bg-orange-100 p-3 rounded">
                            <p className="text-sm text-gray-600">Restant</p>
                            <p className="text-xl font-bold text-orange-600">{restant}</p>
                          </div>
                        </div>
                        {inventaire.quantitePrevue && (
                          <div className="mt-3 bg-purple-100 p-3 rounded">
                            <p className="text-sm text-gray-600">Était prévu pour ce jour</p>
                            <p className="text-lg font-medium text-purple-600">{inventaire.quantitePrevue}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
