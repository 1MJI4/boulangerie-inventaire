'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface InventaireItem {
  produitId: number;
  quantiteRestante: number | string;
}

export default function SaisieVendeur() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [inventaires, setInventaires] = useState<InventaireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    try {
      setLoading(true);
      
      // Charger les produits
      const produitsResponse = await fetch('/api/produits');
      const produitsData = await produitsResponse.json();
      setProduits(produitsData);

      // Charger les inventaires du jour
      const today = new Date().toISOString().split('T')[0];
      const inventairesResponse = await fetch(`/api/inventaires?date=${today}`);
      const inventairesData = await inventairesResponse.json();

      // Initialiser les inventaires avec les données existantes ou des valeurs par défaut
      const inventairesMap = inventairesData.reduce((acc: any, inv: any) => {
        acc[inv.produitId] = inv;
        return acc;
      }, {});

      const inventairesInit = produitsData.map((produit: Produit) => ({
        produitId: produit.id,
        quantiteRestante: inventairesMap[produit.id]?.quantiteRestante ?? ''
      }));

      setInventaires(inventairesInit);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setMessage('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantite = (produitId: number, quantite: number | string) => {
    setInventaires(prev => 
      prev.map(inv => 
        inv.produitId === produitId 
          ? { ...inv, quantiteRestante: quantite }
          : inv
      )
    );
  };

  const sauvegarder = async () => {
    try {
      setSaving(true);
      setMessage('');

      const startTime = Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      // Préparer tous les inventaires en une seule fois
      const inventairesData = inventaires.map(inv => {
        // Convertir les chaînes vides ou invalides en 0
        const quantiteRestante = typeof inv.quantiteRestante === 'string' 
          ? (inv.quantiteRestante === '' ? 0 : parseInt(inv.quantiteRestante) || 0)
          : inv.quantiteRestante;

        return {
          produitId: inv.produitId,
          dateInventaire: today,
          quantiteRestante: quantiteRestante
        };
      });

      console.log(`🚀 Sauvegarde optimisée de ${inventairesData.length} inventaires vendeur`);

      // Une seule requête pour tous les inventaires
      const response = await fetch('/api/inventaires', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventaires: inventairesData
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      const result = await response.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`✅ Sauvegarde vendeur terminée en ${duration}ms`);
      
      setMessage(`✅ Inventaire sauvegardé avec succès !
📊 ${result.success} produits traités en ${duration}ms
${result.performance ? `⚡ ${result.performance.recordsPerSecond} produits/seconde` : ''}`);
      setTimeout(() => setMessage(''), 5000);
      
      // Recharger les données pour afficher les nouvelles valeurs
      await chargerDonnees();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getProduitNom = (id: number) => {
    const produit = produits.find(p => p.id === id);
    return produit?.nom || 'Produit inconnu';
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
              <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">
                🛒 Saisie Vendeur
              </h1>
              <p className="text-black">
                Indiquez les quantités restantes en fin de journée
              </p>
            </div>
            <Link 
              href="/"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              ← Accueil
            </Link>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-center font-medium ${
            message.includes('✅') 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        {/* Version Mobile - Optimisée tactile */}
        <div className="block sm:hidden space-y-4 mb-6">
          {inventaires.map((inv) => (
            <div key={inv.produitId} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-black text-xl mb-4 text-center">
                {getProduitNom(inv.produitId)}
              </h3>
              <div>
                <label className="block text-lg font-semibold text-blue-700 mb-3 text-center">
                  Quantité Restante
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inv.quantiteRestante}
                    onChange={(e) => updateQuantite(inv.produitId, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full p-4 border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 text-2xl text-center font-bold text-gray-900 bg-gray-50 h-16"
                    placeholder="Tapez la quantité"
                  />
                  {inv.quantiteRestante !== '' && inv.quantiteRestante !== 0 && (
                    <button
                      onClick={() => updateQuantite(inv.produitId, '')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full w-8 h-8 flex items-center justify-center font-bold"
                      type="button"
                    >
                      ×
                    </button>
                  )}
                </div>
                
                {/* Boutons rapides pour quantités courantes */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {[0, 1, 2, 3, 5].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => updateQuantite(inv.produitId, qty)}
                      className="bg-blue-100 hover:bg-blue-200 active:bg-blue-300 text-blue-800 font-bold py-3 px-2 rounded-lg transition-colors text-lg"
                      type="button"
                    >
                      {qty}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[10, 15, 20, 25].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => updateQuantite(inv.produitId, qty)}
                      className="bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-800 font-bold py-2 px-2 rounded-lg transition-colors text-sm"
                      type="button"
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Version Desktop */}
        <div className="hidden sm:block bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                    Quantité Restante *
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventaires.map((inv) => (
                  <tr key={inv.produitId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getProduitNom(inv.produitId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={inv.quantiteRestante}
                        onChange={(e) => updateQuantite(inv.produitId, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full p-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-center font-semibold text-gray-900"
                        placeholder="Quantité restante"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <p className="text-sm text-black">
              * Les quantités restantes sont obligatoires pour le suivi des stocks
            </p>
            <button
              onClick={sauvegarder}
              disabled={saving}
              className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sauvegarde...
                </div>
              ) : (
                '💾 Sauvegarder'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
