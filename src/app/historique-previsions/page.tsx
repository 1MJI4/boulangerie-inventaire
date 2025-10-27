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

interface PrevisionParDate {
  date: string;
  previsions: Inventaire[];
  totalPrevu: number;
  totalProduit: number;
  precision: number; // Pourcentage de précision
}

export default function HistoriquePrevisions() {
  const [previsions, setPrevisions] = useState<PrevisionParDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOuverte, setModalOuverte] = useState(false);
  const [dateSelectionnee, setDateSelectionnee] = useState('');
  const [previsionsDetail, setPrevisionsDetail] = useState<Inventaire[]>([]);

  useEffect(() => {
    chargerPrevisions();
  }, []);

  const chargerPrevisions = async () => {
    setLoading(true);
    try {
      // Charger tous les inventaires des 30 derniers jours
      const response = await fetch('/api/inventaires');
      const data = await response.json();
      
      // Filtrer seulement ceux qui ont des prévisions
      const avecPrevisions = data.filter((inv: Inventaire) => inv.quantitePrevue && inv.quantitePrevue > 0);
      
      // Grouper par date
      const groupesParDate = avecPrevisions.reduce((acc: any, inv: Inventaire) => {
        const date = inv.dateInventaire;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(inv);
        return acc;
      }, {});

      const previsionsAvecStats = Object.keys(groupesParDate)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, 15) // Dernières 15 dates avec prévisions
        .map(date => {
          const previsions = groupesParDate[date];
          return calculerStatsPrevision(date, previsions);
        });

      setPrevisions(previsionsAvecStats);
    } catch (error) {
      console.error('Erreur lors du chargement des prévisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculerStatsPrevision = (date: string, previsions: Inventaire[]): PrevisionParDate => {
    const totalPrevu = previsions.reduce((sum, inv) => sum + (inv.quantitePrevue || 0), 0);
    const totalProduit = previsions.reduce((sum, inv) => sum + (inv.quantiteProduite || 0), 0);
    
    // Calculer la précision (% de réalisation par rapport aux prévisions)
    const precision = totalPrevu > 0 ? Math.round((totalProduit / totalPrevu) * 100) : 0;

    return {
      date,
      previsions,
      totalPrevu,
      totalProduit,
      precision
    };
  };

  const ouvrirModal = (date: string, previsions: Inventaire[]) => {
    setDateSelectionnee(date);
    setPrevisionsDetail(previsions);
    setModalOuverte(true);
  };

  const fermerModal = () => {
    setModalOuverte(false);
    setDateSelectionnee('');
    setPrevisionsDetail([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDateHier = (dateString: string) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">📊 Historique des Prévisions</h1>
              <p className="text-gray-600">Analyse de la précision de vos planifications</p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/saisie-prevue"
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                📋 Nouvelle prévision
              </Link>
              <Link 
                href="/dashboard"
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                ← Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Liste des prévisions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Prévisions récentes</h2>
            <p className="text-sm text-gray-600 mt-1">Cliquez sur une date pour voir les détails</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : previsions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Aucune prévision trouvée</h3>
              <p className="text-gray-500 mb-4">Commencez à planifier vos productions pour voir l'historique ici</p>
              <Link 
                href="/saisie-prevue"
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Créer ma première prévision
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {previsions.map((previsionDate) => (
                <button
                  key={previsionDate.date}
                  onClick={() => ouvrirModal(previsionDate.date, previsionDate.previsions)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {formatDate(previsionDate.date)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Prévu le {getDateHier(previsionDate.date)} • {previsionDate.previsions.length} produit(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-purple-100 rounded-full"></span>
                        <span className="text-gray-600">Prévu: <span className="font-medium text-purple-600">{previsionDate.totalPrevu}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-100 rounded-full"></span>
                        <span className="text-gray-600">Produit: <span className="font-medium text-green-600">{previsionDate.totalProduit}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          previsionDate.precision >= 90 ? 'bg-green-500' :
                          previsionDate.precision >= 75 ? 'bg-yellow-500' : 
                          previsionDate.precision >= 50 ? 'bg-orange-500' : 'bg-red-500'
                        }`}></span>
                        <span className="text-gray-600">Précision: <span className="font-medium">{previsionDate.precision}%</span></span>
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
            href="/planification-demain"
            className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium transition-colors"
          >
            👁️ Planning actuel
          </Link>
          <Link
            href="/saisie-prevue"
            className="inline-flex items-center justify-center bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 font-medium transition-colors"
          >
            📋 Nouvelle prévision
          </Link>
        </div>
      </div>

      {/* Modal de détails */}
      {modalOuverte && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Prévisions pour le {formatDate(dateSelectionnee)}
                </h3>
                <p className="text-sm text-gray-600">
                  Planifié le {getDateHier(dateSelectionnee)}
                </p>
              </div>
              <button
                onClick={fermerModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                {previsionsDetail.map((inventaire) => {
                  const prevu = inventaire.quantitePrevue || 0;
                  const produit = inventaire.quantiteProduite || 0;
                  const precisionProduit = prevu > 0 ? Math.round((produit / prevu) * 100) : 0;
                  
                  return (
                    <div key={inventaire.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900 text-lg">
                          {inventaire.produit.nom}
                        </h4>
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                          precisionProduit >= 90 ? 'bg-green-100 text-green-800' :
                          precisionProduit >= 75 ? 'bg-yellow-100 text-yellow-800' :
                          precisionProduit >= 50 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {precisionProduit}% de précision
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-purple-100 p-3 rounded">
                          <p className="text-sm text-gray-600">Était prévu</p>
                          <p className="text-2xl font-bold text-purple-600">{prevu}</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded">
                          <p className="text-sm text-gray-600">Réellement produit</p>
                          <p className="text-2xl font-bold text-green-600">{produit}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-center">
                        <div className="bg-gray-100 p-2 rounded">
                          <p className="text-sm text-gray-600">
                            Écart: {produit - prevu > 0 ? '+' : ''}{produit - prevu}
                            {produit - prevu > 0 ? ' (surproduction)' : produit - prevu < 0 ? ' (sous-production)' : ' (pile poil!)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
