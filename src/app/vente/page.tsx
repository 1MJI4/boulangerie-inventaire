'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface InventaireItem {
  produitId: number;
  quantiteRestante: number;
}

export default function InventaireVente() {
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
      
      // Initialiser les inventaires avec quantité restante à 0
      const initialInventaires = data.map((produit: Produit) => ({
        produitId: produit.id,
        quantiteRestante: 0
      }));
      setInventaires(initialInventaires);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantiteRestante = (produitId: number, quantite: number) => {
    setInventaires(prevInventaires =>
      prevInventaires.map(inv =>
        inv.produitId === produitId
          ? { ...inv, quantiteRestante: quantite }
          : inv
      )
    );
  };

  const getProduitNom = (produitId: number) => {
    const produit = produits.find(p => p.id === produitId);
    return produit ? produit.nom : 'Produit inconnu';
  };

  const sauvegarderInventaire = async () => {
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
            quantiteRestante: inv.quantiteRestante
          }))
        }),
      });

      if (response.ok) {
        setMessage('✅ Inventaire vente sauvegardé avec succès !');
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                📦 Inventaire Vente
              </h1>
              <p className="text-gray-600">
                Saisie des quantités restantes en fin de journée
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
            <div key={inv.produitId} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
              <h3 className="font-semibold text-gray-800 text-lg mb-3">
                {getProduitNom(inv.produitId)}
              </h3>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Quantité Restante *
                </label>
                <input
                  type="number"
                  min="0"
                  value={inv.quantiteRestante}
                  onChange={(e) => updateQuantiteRestante(inv.produitId, parseInt(e.target.value) || 0)}
                  className="w-full p-3 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold"
                  placeholder="0"
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
                <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider">
                      Quantité Restante *
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventaires.map((inv) => (
                    <tr key={inv.produitId} className="hover:bg-blue-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getProduitNom(inv.produitId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          min="0"
                          value={inv.quantiteRestante}
                          onChange={(e) => updateQuantiteRestante(inv.produitId, parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                          placeholder="0"
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
            onClick={sauvegarderInventaire}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg"
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
              '💾 Sauvegarder Inventaire Vente'
            )}
          </button>
          <p className="text-sm text-gray-500 mt-2 text-center">
            * Champs obligatoires - Indiquez les quantités restantes après la vente
          </p>
        </div>
      </div>
    </div>
  );
}
