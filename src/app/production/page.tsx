'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface InventaireItem {
  produitId: number;
  quantiteProduite: number | null;
}

export default function InventaireProduction() {
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
      
      // Initialiser les inventaires avec quantité produite null
      const initialInventaires = data.map((produit: Produit) => ({
        produitId: produit.id,
        quantiteProduite: null
      }));
      setInventaires(initialInventaires);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantiteProduite = (produitId: number, quantite: number | null) => {
    setInventaires(prevInventaires =>
      prevInventaires.map(inv =>
        inv.produitId === produitId
          ? { ...inv, quantiteProduite: quantite }
          : inv
      )
    );
  };

  const getProduitNom = (produitId: number) => {
    const produit = produits.find(p => p.id === produitId);
    return produit ? produit.nom : 'Produit inconnu';
  };

  const sauvegarderProduction = async () => {
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
            quantiteProduite: inv.quantiteProduite
          }))
        }),
      });

      if (response.ok) {
        setMessage('✅ Production sauvegardée avec succès !');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                🥖 Saisie Production
              </h1>
              <p className="text-gray-600">
                Enregistrement des quantités produites aujourd'hui
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

        {/* Interface Mobile */}
        <div className="sm:hidden space-y-4 mb-6">
          {inventaires.map((inv) => (
            <div key={inv.produitId} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
              <h3 className="font-semibold text-gray-800 text-lg mb-3">
                {getProduitNom(inv.produitId)}
              </h3>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">
                  Quantité Produite
                </label>
                <input
                  type="number"
                  min="0"
                  value={inv.quantiteProduite || ''}
                  onChange={(e) => updateQuantiteProduite(inv.produitId, e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-3 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-semibold"
                  placeholder="Optionnel"
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
                <thead className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider">
                      Quantité Produite
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventaires.map((inv) => (
                    <tr key={inv.produitId} className="hover:bg-green-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getProduitNom(inv.produitId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={inv.quantiteProduite || ''}
                          onChange={(e) => updateQuantiteProduite(inv.produitId, e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-2 border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 font-semibold"
                          placeholder="Optionnel"
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
            onClick={sauvegarderProduction}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg"
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
              '💾 Sauvegarder Production'
            )}
          </button>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Enregistrez les quantités produites aujourd'hui (optionnel)
          </p>
        </div>
      </div>
    </div>
  );
}
