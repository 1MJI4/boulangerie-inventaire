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

export default function SaisiePrevue() {
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

      // Date de demain
      const demain = new Date();
      demain.setDate(demain.getDate() + 1);
      const dateDemain = demain.toISOString().split('T')[0];

      // Charger les inventaires de demain
      const inventairesResponse = await fetch(`/api/inventaires?date=${dateDemain}`);
      const inventairesData = await inventairesResponse.json();

      // Initialiser les inventaires avec les données existantes ou des valeurs par défaut
      const inventairesMap = inventairesData.reduce((acc: any, inv: any) => {
        acc[inv.produitId] = inv;
        return acc;
      }, {});

      const inventairesInit = produitsData.map((produit: Produit) => ({
        produitId: produit.id,
        quantitePrevue: inventairesMap[produit.id]?.quantitePrevue || null
      }));

      setInventaires(inventairesInit);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      setMessage('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantite = (produitId: number, quantite: number | null) => {
    setInventaires(prev => 
      prev.map(inv => 
        inv.produitId === produitId 
          ? { ...inv, quantitePrevue: quantite }
          : inv
      )
    );
  };

  const sauvegarder = async () => {
    try {
      setSaving(true);
      setMessage('');

      // Date de demain
      const demain = new Date();
      demain.setDate(demain.getDate() + 1);
      const dateDemain = demain.toISOString().split('T')[0];
      
      for (const inv of inventaires) {
        if (inv.quantitePrevue !== null) {
          const response = await fetch('/api/inventaires', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              produitId: inv.produitId,
              dateInventaire: dateDemain,
              quantitePrevue: inv.quantitePrevue
            }),
          });

          if (!response.ok) {
            throw new Error('Erreur lors de la sauvegarde');
          }
        }
      }

      setMessage('✅ Prévisions sauvegardées avec succès !');
      setTimeout(() => setMessage(''), 3000);
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                📋 Planifier Demain
              </h1>
              <p className="text-gray-600 mb-1">
                Définissez les quantités à produire pour {dateDemain()}
              </p>
              <p className="text-sm text-purple-600">
                💡 Souvent utilisé pour les viennoiseries et pains spéciaux
              </p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/planification-demain"
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                👁️ Voir planification
              </Link>
              <Link 
                href="/"
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                ← Accueil
              </Link>
            </div>
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

        {/* Version Mobile */}
        <div className="block sm:hidden space-y-4 mb-6">
          {inventaires.map((inv) => (
            <div key={inv.produitId} className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold text-gray-800 text-lg mb-3">
                {getProduitNom(inv.produitId)}
              </h3>
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">
                  Quantité Prévue (optionnel)
                </label>
                <input
                  type="number"
                  min="0"
                  value={inv.quantitePrevue || ''}
                  onChange={(e) => updateQuantite(inv.produitId, e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-3 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base text-gray-900"
                  placeholder="À produire demain"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Version Desktop */}
        <div className="hidden sm:block bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">
                    Quantité Prévue pour Demain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">
                    Type
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
                        value={inv.quantitePrevue || ''}
                        onChange={(e) => updateQuantite(inv.produitId, e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                        placeholder="Optionnel"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getProduitNom(inv.produitId).toLowerCase().includes('croissant') || 
                       getProduitNom(inv.produitId).toLowerCase().includes('pain') ||
                       getProduitNom(inv.produitId).toLowerCase().includes('brioche') ? 
                       '🥐 Viennoiserie' : '🍰 Pâtisserie'}
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
            <div className="text-sm text-gray-600">
              <p>💡 Définissez les quantités à préparer pour la production de nuit</p>
              <p className="text-xs mt-1">Laissez vide les produits non planifiés</p>
            </div>
            <button
              onClick={sauvegarder}
              disabled={saving}
              className="w-full sm:w-auto bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sauvegarde...
                </div>
              ) : (
                '💾 Sauvegarder Prévisions'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
