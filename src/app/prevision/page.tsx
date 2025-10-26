'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface InventaireItem {
  produitId: number;
  quantitePrevue: number | null;
}

export default function InventairePrevision() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [inventaires, setInventaires] = useState<InventaireItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProduits();
  }, []);

  const fetchProduits = async () => {
    try {
      const response = await fetch('/api/produits');
      const data = await response.json();
      setProduits(data);
      
      // Initialiser les inventaires avec quantité prévue null
      const initialInventaires = data.map((produit: Produit) => ({
        produitId: produit.id,
        quantitePrevue: null
      }));
      setInventaires(initialInventaires);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantitePrevue = (produitId: number, quantite: number | null) => {
    setInventaires(prevInventaires =>
      prevInventaires.map(inv =>
        inv.produitId === produitId
          ? { ...inv, quantitePrevue: quantite }
          : inv
      )
    );
  };

  const getProduitNom = (produitId: number) => {
    const produit = produits.find(p => p.id === produitId);
    return produit ? produit.nom : 'Produit inconnu';
  };

  const sauvegarderPrevision = async () => {
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/inventaires', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventaires: inventaires.map(inv => ({
            produitId: inv.produitId,
            quantitePrevue: inv.quantitePrevue
          }))
        }),
      });

      if (response.ok) {
        setMessage('✅ Prévisions sauvegardées avec succès !');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const errorData = await response.json();
        setMessage(`❌ Erreur: ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const getFormattedDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                🔮 Prévisions Production
              </h1>
              <p className="text-gray-600">
                Planification pour <strong>{getFormattedDate()}</strong>
              </p>
            </div>
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Retour
            </Link>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 mb-6 rounded-lg ${
            message.includes('✅') 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-purple-100 border-l-4 border-purple-500 p-4 mb-6 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-purple-700">
                <strong>Astuce :</strong> Utilisez ces prévisions pour planifier votre production de demain. Par exemple : "10 croissants chocolat à sortir demain".
              </p>
            </div>
          </div>
        </div>

        {/* Interface Mobile */}
        <div className="sm:hidden space-y-4 mb-6">
          {inventaires.map((inv) => (
            <div key={inv.produitId} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
              <h3 className="font-semibold text-gray-800 text-lg mb-3">
                {getProduitNom(inv.produitId)}
              </h3>
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">
                  Quantité à prévoir pour demain
                </label>
                <input
                  type="number"
                  min="0"
                  value={inv.quantitePrevue || ''}
                  onChange={(e) => updateQuantitePrevue(inv.produitId, e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-3 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-semibold"
                  placeholder="À prévoir demain"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Interface Desktop */}
        <div className="hidden sm:block">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider">
                      Quantité à Prévoir Demain
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventaires.map((inv) => (
                    <tr key={inv.produitId} className="hover:bg-purple-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getProduitNom(inv.produitId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={inv.quantitePrevue || ''}
                          onChange={(e) => updateQuantitePrevue(inv.produitId, e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-semibold"
                          placeholder="À prévoir demain"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bouton de sauvegarde */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <button
            onClick={sauvegarderPrevision}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg"
          >
            {isSaving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sauvegarde en cours...
              </span>
            ) : (
              '💾 Sauvegarder Prévisions'
            )}
          </button>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Planifiez les quantités à produire pour demain (optionnel)
          </p>
        </div>
      </div>
    </div>
  );
}
